import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'

import { Report, ReportDocument } from '../schemas/Report.schema'
import { User } from '../schemas/User.schema'

import { AuditLogService } from '../audit-log/audit-log.service'
import { AuditActorRole, AuditTargetType } from '../schemas/AuditLog.schema'

// === Interface definitions ===
export interface MangaTarget {
  _id: Types.ObjectId
  title: string
  authorId: Types.ObjectId
  isPublish?: boolean
  isDeleted?: boolean
  status?: string
}

export interface ChapterTarget {
  _id: Types.ObjectId
  manga_id: Types.ObjectId
  title?: string
  chapter_number?: number
  content?: string
  isPublish?: boolean
  isDeleted?: boolean
  createdAt?: Date
  updatedAt?: Date
}

export interface CommentTarget {
  _id: Types.ObjectId
  user_id: Types.ObjectId
  content: string
}

export interface ReportWithTargetDetail {
  _id: Types.ObjectId
  reporter_id: {
    _id: Types.ObjectId
    username: string
    email: string
    role: string
  }
  target_type: string
  target_id: MangaTarget | ChapterTarget | CommentTarget
  reason: string
  description: string
  status: string
  createdAt: Date
  updatedAt: Date
  reportCode: string
  id: string
  resolver_id?: Types.ObjectId
  resolution_note?: string
  target_detail?: {
    title?: string | null
    content?: string | null
    target_human?: {
      user_Id: Types.ObjectId | null
      username: string
      email: string
    } | null
  }
}

@Injectable()
export class ReportService {
  constructor(
    @InjectModel(Report.name) private reportModel: Model<ReportDocument>,
    @InjectModel(User.name) private userModel: Model<User>,
    private readonly audit: AuditLogService,
  ) {}

  // 🟢 Tạo report mới
  async create(dto: any) {
    const payload = {
      ...dto,
      reporter_id: new Types.ObjectId(dto.reporter_id),
      target_id: new Types.ObjectId(dto.target_id),
    }
    return await this.reportModel.create(payload)
  }

  // 🟡 Lấy toàn bộ report, kèm populate reporter + chi tiết target + author/comment user info
  async findAll(): Promise<ReportWithTargetDetail[]> {
    const reports = await this.reportModel
      .find()
      .populate({
        path: 'reporter_id',
        select: 'username email role',
      })
      .populate({
        path: 'target_id',
        select: 'title authorId content manga_id user_id isPublish isDeleted status',
        options: { strictPopulate: false },
      })
      .exec()

    const detailedReports = await Promise.all(
      reports.map(async (report) => {
        const reportAny = report.toObject() as unknown as ReportWithTargetDetail

        try {
          if (report.target_type === 'Manga') {
            const manga = reportAny.target_id as MangaTarget
            const author = await this.userModel
              .findById(manga.authorId)
              .select('username email')
              .lean()

            reportAny.target_detail = {
              title: manga.title,
              target_human: author
                ? {
                    user_Id: manga.authorId,
                    username: author.username,
                    email: author.email,
                  }
                : null,
            }
          } else if (report.target_type === 'Chapter') {
            const chapter = reportAny.target_id as ChapterTarget

            const manga = await this.reportModel.db
              .collection('mangas')
              .findOne(
                { _id: chapter.manga_id },
                { projection: { title: 1, authorId: 1 } },
              )

            if (manga) {
              const author = await this.userModel
                .findById(manga.authorId)
                .select('username email')
                .lean()

              reportAny.target_detail = {
                title: chapter.title || manga.title,
                target_human: author
                  ? {
                      user_Id: manga.authorId,
                      username: author.username,
                      email: author.email,
                    }
                  : null,
              }
            } else {
              reportAny.target_detail = {
                title: chapter.title || null,
                target_human: null,
              }
            }
          } else if (report.target_type === 'Comment') {
            const comment = reportAny.target_id as CommentTarget
            const user = await this.userModel
              .findById(comment.user_id)
              .select('username email')
              .lean()

            reportAny.target_detail = {
              content: comment.content,
              target_human: user
                ? {
                    user_Id: comment.user_id,
                    username: user.username,
                    email: user.email,
                  }
                : {
                    user_Id: null as unknown as Types.ObjectId,
                    username: 'Unknown User',
                    email: 'No email available',
                  },
            }
          } else {
            reportAny.target_detail = { title: null, target_human: null }
          }
        } catch (err: any) {
          console.error(
            `❌ Populate detail error for report ${report._id}:`,
            err?.message,
          )
          reportAny.target_detail = { title: null, target_human: null }
        }

        return reportAny
      }),
    )

    return detailedReports
  }

  // 🟣 Lấy 1 report chi tiết theo ID
  async findById(id: string): Promise<ReportWithTargetDetail | null> {
    const report = await this.reportModel
      .findById(id)
      .populate({
        path: 'reporter_id',
        select: 'username email role',
      })
      .populate({
        path: 'target_id',
        options: { strictPopulate: false },
      })
      .exec()

    if (!report) throw new NotFoundException(`Report with id ${id} not found`)

    const all = await this.findAll()
    return all.find((r) => String(r._id) === String(id)) || null
  }

  async findOne(id: string): Promise<ReportWithTargetDetail | null> {
    return this.findById(id)
  }

  /**
   * ✅ Content Moderator update report -> auto create audit log
   * actor_id lấy từ TOKEN (moderatorId)
   */
  async updateByModerator(id: string, dto: any, moderatorId: string) {
    const beforeDoc = await this.reportModel.findById(id).lean()
    if (!beforeDoc) throw new NotFoundException(`Report with id ${id} not found`)

    // ✅ gán resolver_id theo token để DB tracking ai xử lý
    const payloadUpdate = {
      ...dto,
      resolver_id: moderatorId ? new Types.ObjectId(moderatorId) : undefined,
    }

    const updated = await this.reportModel
      .findByIdAndUpdate(id, payloadUpdate, { new: true })
      .lean()

    if (!updated) throw new NotFoundException(`Report with id ${id} not found`)

    const action = dto?.status ? `report_status_${dto.status}` : 'report_update'
    const summary = dto?.status
      ? `Moderator updated report status: ${beforeDoc.status} → ${dto.status}`
      : `Moderator updated report fields`

    const risk: 'low' | 'medium' | 'high' =
      beforeDoc.reason === 'Harassment' || beforeDoc.reason === 'Inappropriate'
        ? 'high'
        : beforeDoc.reason === 'Copyright'
        ? 'medium'
        : 'low'

    try {
      await this.audit.createLog({
        actor_id: moderatorId,
        actor_role: AuditActorRole.CONTENT_MODERATOR,
        action,
        target_type: AuditTargetType.REPORT,
        target_id: id,
        reportCode: (beforeDoc as any)?.reportCode,
        summary,
        risk,
        before: {
          status: beforeDoc.status,
          resolution_note: beforeDoc.resolution_note ?? null,
        },
        after: {
          status: updated.status,
          resolution_note: updated.resolution_note ?? null,
        },
        note: dto?.resolution_note,
      })
    } catch (err: any) {
      console.error('❌ Audit log create failed:', err?.message)
    }

    return updated
  }

  // 🔴 Xoá report
  async delete(id: string) {
    const deleted = await this.reportModel.findByIdAndDelete(id)
    if (!deleted) throw new NotFoundException(`Report with id ${id} not found`)
    return { message: 'Report deleted successfully', deleted }
  }

  async getAdminSummary() {
    const [open, new7d] = await Promise.all([
      this.reportModel.countDocuments({
        status: { $in: ['new', 'in-progress'] },
      }),
      this.reportModel.countDocuments({
        status: 'new',
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      }),
    ])
    return { open, new7d }
  }

  async getWeeklyNew(weeks = 4) {
    const now = new Date()
    const from = new Date(now)
    from.setDate(from.getDate() - weeks * 7)

    const rows = await this.reportModel.aggregate([
      { $match: { createdAt: { $gte: from, $lte: now } } },
      {
        $group: {
          _id: {
            y: { $isoWeekYear: '$createdAt' },
            w: { $isoWeek: '$createdAt' },
          },
          cnt: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          week: {
            $concat: [
              { $toString: '$_id.y' },
              '-W',
              {
                $cond: [
                  { $lt: ['$_id.w', 10] },
                  { $concat: ['0', { $toString: '$_id.w' }] },
                  { $toString: '$_id.w' },
                ],
              },
            ],
          },
          value: '$cnt',
        },
      },
      { $sort: { week: 1 } },
    ])

    return rows
  }
}
