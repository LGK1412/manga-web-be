import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel, Schema } from '@nestjs/mongoose';
import { isValidObjectId, Model, PipelineStage, Types } from 'mongoose';
import { Chapter, ChapterDocument } from 'src/schemas/chapter.schema';
import {
  UserChapterProgress,
  UserChapterProgressDocument,
} from 'src/schemas/UserChapterProgress.schema';
import {
  UserStoryHistory,
  UserStoryHistoryDocument,
} from 'src/schemas/UserStoryHistory.schema';
@Injectable()
export class ChapterServiceOnlyNormalChapterInfor {
  constructor(
    @InjectModel(Chapter.name) private chapterModel: Model<Chapter>,
    @InjectModel(UserChapterProgress.name)
    private progressModel: Model<UserChapterProgressDocument>,
    @InjectModel(UserStoryHistory.name)
    private historyModel: Model<UserStoryHistoryDocument>,
  ) {}

  async getChapterById(id) {
    return this.chapterModel
      .findById(id)
      .populate({ path: 'manga_id', populate: { path: 'authorId' } })
      .lean();
  }
  async getAllChapter() {
    // lọc soft-delete cho an toàn
    return this.chapterModel.find({ isDeleted: {$ne: true} }).lean().exec();
  }

  async getChapterCompact(id: Types.ObjectId) {
    const docs = await this.chapterModel
      .aggregate([
        { $match: { _id: id } },

        // lấy text và image subdocs
        {
          $lookup: {
            from: 'textchapters',
            localField: '_id',
            foreignField: 'chapter_id',
            as: 'texts',
          },
        },
        {
          $lookup: {
            from: 'imagechapters',
            localField: '_id',
            foreignField: 'chapter_id',
            as: 'imageDocs',
          },
        },

        // chuẩn hóa: lấy phần tử đầu (giả định 1-1), fallback rỗng
        {
          $addFields: {
            _text: { $first: '$texts' },
            _image: { $first: '$imageDocs' },
          },
        },

        // dựng fields gộp
        {
          $addFields: {
            content: { $ifNull: ['$_text.content', null] },
            _imageFiles: { $ifNull: ['$_image.images', []] },
            type: {
              $switch: {
                branches: [
                  {
                    case: {
                      $gt: [{ $size: { $ifNull: ['$_image.images', []] } }, 0],
                    },
                    then: 'image',
                  },
                  {
                    case: {
                      $and: [
                        {
                          $not: [
                            {
                              $gt: [
                                { $size: { $ifNull: ['$_image.images', []] } },
                                0,
                              ],
                            },
                          ],
                        },
                        { $ne: ['$_text.content', null] },
                      ],
                    },
                    then: 'text',
                  },
                ],
                default: 'unknown',
              },
            },
          },
        },
        {
          $addFields: {
            images: {
              $map: {
                input: '$_imageFiles',
                as: 'f',
                in: {
                  $concat: [
                    '/uploads/image-chapters/',
                    { $toString: '$_id' },
                    '/',
                    '$$f',
                  ],
                },
              },
            },
            image_count: { $size: '$_imageFiles' },
          },
        },

        // loại bỏ rác
        {
          $project: {
            texts: 0,
            imageDocs: 0,
            _text: 0,
            _image: 0,
            _imageFiles: 0,
            __v: 0,
          },
        },
      ])
      .exec();

    if (!docs?.[0]) throw new NotFoundException('Chapter not found');
    return docs[0];
  }
  async checkChapterHaveNextOrPre(id: Types.ObjectId) {
    const cur = await this.chapterModel
      .findById(id)
      .select('manga_id order')
      .lean();
    if (!cur) return { prevId: null, nextId: null };

    const [prev, next] = await Promise.all([
      this.chapterModel
        .findOne({ manga_id: cur.manga_id, order: cur.order - 1 })
        .select('_id')
        .lean(),
      this.chapterModel
        .findOne({ manga_id: cur.manga_id, order: cur.order + 1 })
        .select('_id')
        .lean(),
    ]);

    return {
      prevId: prev?._id ?? null,
      nextId: next?._id ?? null,
    };
  }
  async getChapterList(id: Types.ObjectId) {
    const cur = await this.chapterModel.findById(id).select('manga_id').lean();
    if (!cur) return [];

    return this.chapterModel
      .find({ manga_id: cur.manga_id /*, is_published: true */ })
      .sort({ order: 1 })
      .select('_id order title is_published created_at updated_at')
      .lean();
  }
  // ================== CREATE & GET PROGRESS ==================
  async createChapterProgress(
    user_id: Types.ObjectId,
    chapter_id: Types.ObjectId,
    progressPercent: number,
  ) {
    // ✅ Cập nhật tiến trình chapter
    const chapterProgress = await this.progressModel
      .findOneAndUpdate(
        { user_id, chapter_id },
        {
          $set: {
            progress: progressPercent,
            last_read_at: new Date(),
            is_completed: progressPercent >= 100,
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
          runValidators: true,
        },
      )
      .lean()
      .exec();

    // ✅ Lấy story_id từ chapter
    const chapter = await this.chapterModel.findById(chapter_id).lean();
    if (!chapter?.manga_id) return chapterProgress;

    // ✅ Cập nhật lịch sử đọc (UserStoryHistory)
    await this.historyModel
      .findOneAndUpdate(
        { user_id, story_id: chapter.manga_id },
        {
          $set: {
            last_read_chapter: chapter_id,
            last_read_at: new Date(),
          },
          // Chỉ update overall_progress khi có progress của chapter
          $max: { overall_progress: progressPercent },
        },
        { upsert: true, new: true },
      )
      .exec();

    return chapterProgress;
  }

  async getOrUpdateChapterProgress(
    user_id: Types.ObjectId,
    chapter_id: Types.ObjectId,
  ) {
    const now = new Date();
    const progress = await this.progressModel
      .findOneAndUpdate(
        { user_id, chapter_id },
        { $set: { last_read_at: now } },
        { upsert: true, new: true },
      )
      .lean()
      .exec();

    return progress;
  }

  // ================== CREATE & GET HISTORY ==================
  async createStoryHistory(user_id: Types.ObjectId, story_id: Types.ObjectId) {
    const latestProgress = await this.progressModel
      .findOne({ user_id })
      .sort({ last_read_at: -1 })
      .lean()
      .exec();

    if (!latestProgress) return { message: 'No progress found for this story' };

    return this.historyModel
      .findOneAndUpdate(
        { user_id, story_id },
        {
          $set: {
            last_read_chapter: latestProgress.chapter_id,
            last_read_at: latestProgress.last_read_at,
          },
        },
        { new: true, upsert: true },
      )
      .lean()
      .exec();
  }

  async getLastReadChapterFromHistory(
    user_id: Types.ObjectId,
    story_id: Types.ObjectId,
  ) {
    return this.historyModel
      .findOne({ user_id, story_id })
      .populate('last_read_chapter')
      .lean()
      .exec();
  }
  async deleteStoryHistory(userId: Types.ObjectId, storyId: Types.ObjectId) {
    const result = await this.historyModel.deleteOne({
      user_id: userId,
      story_id: storyId,
    });

    if (result.deletedCount === 0) {
      return { message: 'No history found for this user and story' };
    }

    return { message: 'History deleted successfully' };
  }
  async getReadingHistoryListByUser(user_id: Types.ObjectId) {
    return this.historyModel
      .find({ user_id })
      .populate({
        path: 'last_read_chapter',
        populate: {
          path: 'manga_id',
          select: 'coverImage',
        },
      })
      .lean()
      .exec();
  }

  // ---------------- [31/10/2025] FIX: dùng cho controller mới ----------------
    async findChaptersByMangaId(mangaId: string) {
      if (!Types.ObjectId.isValid(mangaId)) {
        throw new BadRequestException('mangaId không hợp lệ');
      }
      return this.chapterModel
        .find({ manga_id: new Types.ObjectId(mangaId), isDeleted: { $ne: true } })
        .select('_id title manga_id')
        .sort({ order: 1, createdAt: 1 })
        .lean()
        .exec();
    }
}
