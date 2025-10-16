import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { Report, ReportDocument } from '../schemas/Report.schema'
import { User } from '../schemas/User.schema'

// Define interfaces for populated target_id structures
export interface MangaTarget {
  _id: Types.ObjectId
  title: string
  authorId: Types.ObjectId
  summary?: string
  coverImage?: string
  isPublish?: boolean
  isDeleted?: boolean
  styles?: any[]
  genres?: any[]
  rating?: any[]
  status?: string
  views?: number
  createdAt?: Date
  updatedAt?: Date
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
  target_id: MangaTarget | ChapterTarget | CommentTarget | null
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
    author?: {
      authorId: Types.ObjectId | null
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
    const created = await this.reportModel.create(dto)
    return created
  }

  // 🟡 Lấy toàn bộ report, kèm populate reporter + chi tiết target
  async findAll(): Promise<ReportWithTargetDetail[]> {
    const reports = await this.reportModel
      .find()
      .populate({
        path: 'reporter_id',
        select: 'username email role',
      })
      .populate({
        path: 'target_id',
        options: { strictPopulate: false },
      })
      .exec()

    // 🧠 Hậu xử lý: thêm chi tiết (title + author/username/email) tuỳ loại
    const detailedReports = await Promise.all(
      reports.map(async (report) => {
        const reportObj = report.toObject()
        const reportAny = reportObj as unknown as ReportWithTargetDetail // Sử dụng assertion với unknown để bỏ qua kiểm tra overlap

        try {
          /** ===== 🟦 MANGA ===== */
          if (report.target_type === 'Manga' && (reportAny.target_id as MangaTarget)?.authorId) {
            const author = await this.userModel
              .findById((reportAny.target_id as MangaTarget).authorId)
              .select('username email')
            reportAny.target_detail = {
              title: (reportAny.target_id as MangaTarget).title,
              author: author
                ? {
                    authorId: (reportAny.target_id as MangaTarget).authorId,
                    username: author.username,
                    email: author.email,
                  }
                : null,
            }
          }

          /** ===== 🟧 CHAPTER ===== */
          else if (report.target_type === 'Chapter' && (reportAny.target_id as ChapterTarget)?.manga_id) {
            const manga = await this.reportModel.db
              .collection('mangas')
              .findOne(
                { _id: (reportAny.target_id as ChapterTarget).manga_id },
                { projection: { title: 1, authorId: 1 } },
              )

            if (manga && manga.authorId) {
              const author = await this.userModel.findById(manga.authorId).select('username email')
              reportAny.target_detail = {
                title: manga.title,
                author: author
                  ? {
                      authorId: manga.authorId,
                      username: author.username,
                      email: author.email,
                    }
                  : null,
              }
            } else {
              reportAny.target_detail = {
                title: manga?.title || null,
                author: null,
              }
            }
          }

          /** ===== 🟥 COMMENT ===== */
          else if (report.target_type === 'Comment' && (reportAny.target_id as CommentTarget)?.user_id) {
            const user = await this.userModel
              .findById((reportAny.target_id as CommentTarget).user_id)
              .select('username email')
            reportAny.target_detail = {
              content: (reportAny.target_id as CommentTarget).content,
              author: user
                ? {
                    authorId: (reportAny.target_id as CommentTarget).user_id,
                    username: user.username,
                    email: user.email,
                  }
                : {
                    authorId: null,
                    username: 'Unknown User',
                    email: 'No email available',
                  },
            }
          } else {
            reportAny.target_detail = { title: null, author: null }
          }
        } catch (err) {
          console.error('Populate detail error for report', report._id, ':', err.message)
          reportAny.target_detail = { title: null, author: null }
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

    // Reuse logic từ findAll để thêm target_detail
    const all = await this.findAll()
    return all.find((r) => String(r._id) === String(id)) || null
  }

  // 🔵 Alias cho findById (controller đang gọi findOne)
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

  // == SUMMARY: tổng số report đang mở + số "new" trong 7 ngày gần nhất ==
async getAdminSummary() {
  const [open, new7d] = await Promise.all([
    this.reportModel.countDocuments({ status: { $in: ["new", "in-progress"] } }),
    this.reportModel.countDocuments({
      status: "new",
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    }),
  ]);
  return { open, new7d }; // FE sẽ hiển thị "open" + "+new7d"
}

// == WEEKLY NEW REPORTS (last N weeks) ==
async getWeeklyNew(weeks = 4) {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - weeks * 7);

  const rows = await this.reportModel.aggregate([
    { $match: { createdAt: { $gte: from, $lte: now } } },
    {
      $group: {
        _id: { y: { $isoWeekYear: "$createdAt" }, w: { $isoWeek: "$createdAt" } },
        cnt: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        week: {
          $concat: [
            { $toString: "$_id.y" },
            "-W",
            {
              $cond: [
                { $lt: ["$_id.w", 10] },
                { $concat: ["0", { $toString: "$_id.w" }] },
                { $toString: "$_id.w" },
              ],
            },
          ],
        },
        value: "$cnt",
      },
    },
    { $sort: { week: 1 } },
  ]);

  return rows; // [{ week: "2025-W41", value: 7 }, ...]
}

}