import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { Report, ReportDocument } from '../schemas/Report.schema'
import { User } from '../schemas/User.schema'

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
        // ✅ fix TS2352: cast qua unknown trước
        const reportAny = report.toObject() as unknown as ReportWithTargetDetail

        try {
          // ✅ MANGA: thêm author info
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
          }

          // ✅ CHAPTER: thêm author info qua manga
          else if (report.target_type === 'Chapter') {
            const chapter = reportAny.target_id as ChapterTarget

            // lấy manga theo manga_id
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
          }

          // ✅ COMMENT: thêm info của user viết comment
          else if (report.target_type === 'Comment') {
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
                    // ✅ fix TS2322: dùng "as unknown as Types.ObjectId" để ép kiểu null an toàn
                    user_Id: null as unknown as Types.ObjectId,
                    username: 'Unknown User',
                    email: 'No email available',
                  },
            }
          }

          // ⚫ fallback
          else {
            reportAny.target_detail = { title: null, target_human: null }
          }
        } catch (err) {
          console.error(`❌ Populate detail error for report ${report._id}:`, err.message)
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

  // 🔵 Alias cho findById
  async findOne(id: string): Promise<ReportWithTargetDetail | null> {
    return this.findById(id)
  }

  // 🟠 Cập nhật trạng thái hoặc ghi chú xử lý
  async update(id: string, dto: any) {
    const updated = await this.reportModel.findByIdAndUpdate(id, dto, { new: true })
    if (!updated) throw new NotFoundException(`Report with id ${id} not found`)
    return updated
  }

  // 🔴 Xoá report
  async delete(id: string) {
    const deleted = await this.reportModel.findByIdAndDelete(id)
    if (!deleted) throw new NotFoundException(`Report with id ${id} not found`)
    return { message: 'Report deleted successfully', deleted }
  }

  // == SUMMARY ==
  async getAdminSummary() {
    const [open, new7d] = await Promise.all([
      this.reportModel.countDocuments({ status: { $in: ['new', 'in-progress'] } }),
      this.reportModel.countDocuments({
        status: 'new',
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      }),
    ])
    return { open, new7d }
  }

  // == WEEKLY ==
  async getWeeklyNew(weeks = 4) {
    const now = new Date()
    const from = new Date(now)
    from.setDate(from.getDate() - weeks * 7)

    const rows = await this.reportModel.aggregate([
      { $match: { createdAt: { $gte: from, $lte: now } } },
      {
        $group: {
          _id: { y: { $isoWeekYear: '$createdAt' }, w: { $isoWeek: '$createdAt' } },
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
