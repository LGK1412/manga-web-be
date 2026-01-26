import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'

import { Report, ReportDocument } from '../schemas/Report.schema'
import { User } from '../schemas/User.schema'

import { AuditLogService } from '../audit-log/audit-log.service'
import { AuditActorRole, AuditTargetType } from '../schemas/AuditLog.schema'
import { Role } from 'src/common/enums/role.enum'
import type { JwtPayload } from 'src/common/interfaces/jwt-payload.interface'

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

export interface ReplyTarget {
  _id: Types.ObjectId
  user_id: Types.ObjectId
  content: string
  comment_id?: Types.ObjectId
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
  target_id: MangaTarget | ChapterTarget | CommentTarget | ReplyTarget
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

  private normalizeRole(role?: string) {
    return String(role || '').toLowerCase()
  }

  private allowedTargetTypesByRole(role?: string): string[] | null {
    const r = this.normalizeRole(role)

    if (r === Role.ADMIN) return null // null => all
    if (r === Role.CONTENT_MODERATOR) return ['Manga', 'Chapter']
    if (r === Role.COMMUNITY_MANAGER) return ['Comment', 'Reply']
    return [] // none
  }

  private ensureCanAccessReport(role: string | undefined, targetType: string) {
    const allow = this.allowedTargetTypesByRole(role)
    if (allow === null) return // admin
    if (!allow.includes(targetType)) {
      throw new ForbiddenException('Permission denied for this report target type')
    }
  }

  private getUserId(payload: any): string | undefined {
    return (
      payload?.userId ||
      payload?.user_id ||
      payload?.user_id?.toString?.()
    )
  }

  private getUsername(payload: any): string | undefined {
    return payload?.username || payload?.name || payload?.user_name
  }

  private getEmail(payload: any): string | undefined {
    return payload?.email || payload?.user_email
  }

  private mapAuditActorRole(appRole?: string): AuditActorRole {
  const r = String(appRole || '').toLowerCase();
  if (r === 'admin') return AuditActorRole.ADMIN; // ✅ NEW
  if (r === 'content_moderator') return AuditActorRole.CONTENT_MODERATOR;
  if (r === 'community_manager') return AuditActorRole.COMMUNITY_MANAGER;
  return AuditActorRole.SYSTEM;
}


  private computeReportCode(reportId: any): string {
    const idStr = String(reportId)
    return 'RPT-' + idStr.slice(-6).toUpperCase()
  }

  // 🟢 Tạo report mới
  async create(dto: any) {
    const payload = {
      ...dto,
      reporter_id: new Types.ObjectId(dto.reporter_id),
      target_id: new Types.ObjectId(dto.target_id),
    }
    return await this.reportModel.create(payload)
  }

  // ✅ NEW: findAll filtered by role
  async findAllForRole(role?: string): Promise<ReportWithTargetDetail[]> {
    const allow = this.allowedTargetTypesByRole(role)
    if (Array.isArray(allow) && allow.length === 0) return []

    const match: any = {}
    if (Array.isArray(allow) && allow.length > 0) {
      match.target_type = { $in: allow }
    }

    const reports = await this.reportModel
      .find(match)
      .populate({ path: 'reporter_id', select: 'username email role' })
      .populate({
        path: 'target_id',
        select: 'title authorId content manga_id user_id isPublish isDeleted status comment_id',
        options: { strictPopulate: false },
      })
      .sort({ createdAt: -1 })
      .exec()

    const detailedReports = await Promise.all(
      reports.map(async (report) => {
        const reportAny = report.toObject() as unknown as ReportWithTargetDetail
        return await this.attachTargetDetail(reportAny)
      }),
    )

    return detailedReports
  }

  // ✅ NEW: findOne filtered by role
  async findOneForRole(id: string, role?: string): Promise<ReportWithTargetDetail | null> {
    const report = await this.reportModel
      .findById(id)
      .populate({ path: 'reporter_id', select: 'username email role' })
      .populate({ path: 'target_id', options: { strictPopulate: false } })
      .exec()

    if (!report) throw new NotFoundException(`Report with id ${id} not found`)

    // ✅ enforce permission
    this.ensureCanAccessReport(role, (report as any).target_type)

    const reportAny = report.toObject() as unknown as ReportWithTargetDetail
    return await this.attachTargetDetail(reportAny)
  }

  // ===== Helper attach detail (tách riêng để reuse) =====
  private async attachTargetDetail(reportAny: ReportWithTargetDetail) {
    try {
      if (reportAny.target_type === 'Manga') {
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
      } else if (reportAny.target_type === 'Chapter') {
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
            title: chapter.title || (manga as any).title,
            target_human: author
              ? {
                  user_Id: (manga as any).authorId,
                  username: author.username,
                  email: author.email,
                }
              : null,
          }
        } else {
          reportAny.target_detail = { title: chapter.title || null, target_human: null }
        }
      } else if (reportAny.target_type === 'Comment') {
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
      } else if (reportAny.target_type === 'Reply') {
        const reply = reportAny.target_id as ReplyTarget
        const user = await this.userModel
          .findById(reply.user_id)
          .select('username email')
          .lean()

        reportAny.target_detail = {
          content: reply.content,
          target_human: user
            ? {
                user_Id: reply.user_id,
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
      console.error(`❌ Populate detail error for report ${reportAny?._id}:`, err?.message)
      reportAny.target_detail = { title: null, target_human: null }
    }

    return reportAny
  }

  /**
   * ✅ Staff update report:
   * - Content Moderator: Manga/Chapter
   * - Community Manager: Comment/Reply
   * - Admin: all
   */
  async updateByStaff(id: string, dto: any, payload: JwtPayload) {
    const beforeDoc = await this.reportModel.findById(id).lean()
    if (!beforeDoc) throw new NotFoundException(`Report with id ${id} not found`)

    // ✅ enforce role vs target_type
    this.ensureCanAccessReport(payload?.role, (beforeDoc as any).target_type)

    const staffId = this.getUserId(payload)
    const payloadUpdate = {
      ...dto,
      resolver_id: staffId ? new Types.ObjectId(staffId) : undefined,
    }

    const updated = await this.reportModel
      .findByIdAndUpdate(id, payloadUpdate, { new: true })
      .lean()

    if (!updated) throw new NotFoundException(`Report with id ${id} not found`)

    const action = dto?.status ? `report_status_${dto.status}` : 'report_update'
    const summary = dto?.status
      ? `Staff updated report status: ${beforeDoc.status} → ${dto.status}`
      : `Staff updated report fields`

    const risk: 'low' | 'medium' | 'high' =
      beforeDoc.reason === 'Harassment' || beforeDoc.reason === 'Inappropriate'
        ? 'high'
        : beforeDoc.reason === 'Copyright'
          ? 'medium'
          : 'low'

    try {
      await this.audit.createLog({
        actor_id: staffId,
        actor_name: this.getUsername(payload),
        actor_email: this.getEmail(payload),

        actor_role: this.mapAuditActorRole(payload?.role),
        action,
        target_type: AuditTargetType.REPORT,
        target_id: id,

        // ✅ always compute reportCode
        reportCode: this.computeReportCode(beforeDoc._id),

        summary,
        risk,
        before: {
          status: beforeDoc.status,
          resolution_note: (beforeDoc as any).resolution_note ?? null,
        },
        after: {
          status: (updated as any).status,
          resolution_note: (updated as any).resolution_note ?? null,
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
