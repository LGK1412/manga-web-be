import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import fs from 'fs';
import { join, extname } from 'path';
import crypto from 'crypto';

import { Manga, MangaDocument, MangaLicenseStatus } from '../schemas/Manga.schema';
import { CreateMangaDto } from './dto/CreateManga.dto';
import { UpdateMangaDto } from './dto/UpdateManga.dto';
import { StylesService } from '../styles/styles.service';
import { GenreService } from '../genre/genre.service';
import { Chapter, ChapterDocument } from 'src/schemas/chapter.schema';
import {
  ChapterPurchase,
  ChapterPurchaseDocument,
} from 'src/schemas/chapter-purchase.schema';
import {
  UserStoryHistory,
  UserStoryHistoryDocument,
} from 'src/schemas/UserStoryHistory.schema';

import { Rating, RatingDocument } from '../schemas/Rating.schema';
import { startOfMonth, subMonths } from 'date-fns';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class MangaService {
  constructor(
    @InjectModel(Manga.name) private mangaModel: Model<MangaDocument>,
    private stylesService: StylesService,
    private genreService: GenreService,
    @InjectModel(Chapter.name) private chapterModel: Model<ChapterDocument>,
    @InjectModel(ChapterPurchase.name)
    private chapterPurchaseModel: Model<ChapterPurchaseDocument>,
    @InjectModel(Rating.name) private ratingModel: Model<RatingDocument>,
    private readonly eventEmitter: EventEmitter2,
    @InjectModel(UserStoryHistory.name)
    private historyModel: Model<UserStoryHistoryDocument>,
  ) {}

  // =========================================================
  // ✅ License upload helpers
  // =========================================================

  private genFileName(originalName: string) {
    const ext = extname(originalName || '').toLowerCase();
    const safeExt = ext && ext.length <= 8 ? ext : '';
    return `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${safeExt}`;
  }

  private async unlinkSafe(absPath: string) {
    await fs.promises.unlink(absPath).catch(() => {});
  }

  private toAbsFromRel(rel: string) {
    return join('public', rel.replace(/^\/?/, ''));
  }

  /**
   * ✅ Upload license files for a manga (owner-only)
   */
  async uploadLicenseForManga(
    mangaId: string,
    actorId: string,
    files: Express.Multer.File[],
    note?: string,
  ) {
    if (!Types.ObjectId.isValid(mangaId)) {
      throw new BadRequestException('Invalid mangaId');
    }
    if (!Types.ObjectId.isValid(actorId)) {
      throw new BadRequestException('Invalid actorId');
    }
    if (!Array.isArray(files) || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    const manga = await this.mangaModel
      .findById(mangaId)
      .select(
        'authorId licenseFiles licenseStatus licenseNote licenseSubmittedAt licenseRejectReason licenseReviewedAt licenseReviewedBy',
      );

    if (!manga) throw new NotFoundException('Manga not found');

    if (String((manga as any).authorId) !== String(actorId)) {
      throw new BadRequestException('You are not the owner of this manga');
    }

    const dir = join('public', 'assets', 'licenses', mangaId);
    await fs.promises.mkdir(dir, { recursive: true });

    const oldRelFiles: string[] = Array.isArray((manga as any).licenseFiles)
      ? [...((manga as any).licenseFiles as string[])]
      : [];

    const newRelFiles: string[] = [];
    const newAbsFiles: string[] = [];

    try {
      for (const f of files) {
        if (!f?.buffer || !Buffer.isBuffer(f.buffer)) {
          throw new BadRequestException('Invalid file buffer');
        }

        const filename = this.genFileName(f.originalname);
        const absPath = join(dir, filename);

        await fs.promises.writeFile(absPath, f.buffer);

        const relPath = join('assets', 'licenses', mangaId, filename).replace(
          /\\/g,
          '/',
        );

        newAbsFiles.push(absPath);
        newRelFiles.push(relPath);
      }
    } catch (err) {
      await Promise.allSettled(newAbsFiles.map((p) => this.unlinkSafe(p)));
      if (err instanceof BadRequestException) throw err;
      throw new InternalServerErrorException('Unable to save license files');
    }

    try {
      (manga as any).licenseStatus = MangaLicenseStatus.PENDING;
      (manga as any).licenseFiles = newRelFiles;
      (manga as any).licenseNote = note ?? '';
      (manga as any).licenseSubmittedAt = new Date();

      // reset if re-upload
      (manga as any).licenseRejectReason = '';
      (manga as any).licenseReviewedAt = undefined;
      (manga as any).licenseReviewedBy = undefined;

      await manga.save();
    } catch {
      await Promise.allSettled(newAbsFiles.map((p) => this.unlinkSafe(p)));
      throw new InternalServerErrorException('Unable to update manga license');
    }

    if (oldRelFiles.length > 0) {
      await Promise.allSettled(
        oldRelFiles.map((rel) => this.unlinkSafe(this.toAbsFromRel(rel))),
      );
    }

    return {
      success: true,
      mangaId,
      licenseStatus: (manga as any).licenseStatus,
      files: (manga as any).licenseFiles,
      submittedAt: (manga as any).licenseSubmittedAt,
    };
  }

  // ====================== CRUD ======================

  async createManga(createMangaDto: CreateMangaDto, authorId: Types.ObjectId) {
    try {
      if (createMangaDto.styles?.length) {
        for (const styleId of createMangaDto.styles) {
          const style = await this.stylesService.findById(styleId.toString());
          if (!style) {
            throw new BadRequestException(`Style với ID ${styleId} không tồn tại`);
          }
          if ((style as any).status === 'hide') {
            throw new BadRequestException(
              `Style "${(style as any).name}" đã bị ẩn, không thể tạo truyện với style này`,
            );
          }
        }
      }

      if (createMangaDto.genres?.length) {
        for (const genreId of createMangaDto.genres) {
          const genre = await this.genreService.getGenreById(genreId.toString());
          if (!genre) {
            throw new BadRequestException(`Genre với ID ${genreId} không tồn tại`);
          }
          if ((genre as any).status === 'hide') {
            throw new BadRequestException(
              `Genre "${(genre as any).name}" đã bị ẩn, không thể tạo truyện với genre này`,
            );
          }
        }
      }

      const newManga = new this.mangaModel({
        ...createMangaDto,
        authorId,
      });

      this.eventEmitter.emit('story_create_count', { userId: authorId });

      return await newManga.save();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error creating manga:', error);
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Unable to create new manga');
    }
  }

  async updateManga(
    id: string,
    updateMangaDto: UpdateMangaDto,
    authorId: Types.ObjectId,
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid manga ID');
    }

    if (updateMangaDto.styles?.length) {
      for (const styleId of updateMangaDto.styles) {
        const style = await this.stylesService.findById(styleId.toString());
        if (!style) {
          throw new BadRequestException(`Style với ID ${styleId} không tồn tại`);
        }
        if ((style as any).status === 'hide') {
          throw new BadRequestException(
            `Style "${(style as any).name}" đã bị ẩn, không thể cập nhật truyện với style này`,
          );
        }
      }
    }

    const result = await this.mangaModel.updateOne(
      { _id: id, authorId },
      { $set: updateMangaDto },
    );

    if (result.modifiedCount === 0) {
      throw new BadRequestException(
        'Unable to update manga or manga does not exist',
      );
    }

    return this.mangaModel
      .findById(id)
      .populate('genres', 'name')
      .populate('styles', 'name');
  }

  async deleteManga(id: string, authorId: Types.ObjectId) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid manga ID');
    }

    const result = await this.mangaModel.deleteOne({ _id: id, authorId });
    if (result.deletedCount === 0) {
      throw new BadRequestException(
        'Unable to delete manga or manga does not exist',
      );
    }

    return { success: true, message: 'Manga deleted successfully' };
  }

  async toggleDelete(id: string, authorId: Types.ObjectId) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid manga ID');
    }

    const manga = await this.mangaModel.findOne({ _id: id, authorId });
    if (!manga) {
      throw new BadRequestException(
        'Manga does not exist or does not belong to you',
      );
    }

    const nextDeleted = !Boolean((manga as any).isDeleted);
    await this.mangaModel.updateOne(
      { _id: id, authorId },
      { $set: { isDeleted: nextDeleted } },
    );

    return this.mangaModel
      .findById(id)
      .populate('genres', 'name')
      .populate('styles', 'name');
  }

  // ====================== LISTING & DETAIL ======================

  async getAllMangasByAuthor(authorId: Types.ObjectId) {
    const mangas = await this.mangaModel
      .find({ authorId })
      .populate('genres', 'name')
      .populate('styles', 'name')
      .sort({ createdAt: -1 });

    return mangas ?? [];
  }

  // ✅ Updated: include licenseStatus so frontend can show tick on cover
  async getAllManga(page = 1, limit = 24) {
    const skip = (page - 1) * limit;

    const matchStage = {
      isDeleted: false,
      isPublish: true,
    };

    const pipeline: any[] = [
      { $match: matchStage },

      {
        $lookup: {
          from: 'chapters',
          let: { mangaId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$manga_id', '$$mangaId'] },
                    { $ne: ['$isDeleted', true] },
                    { $eq: ['$is_published', true] },
                  ],
                },
              },
            },
            { $sort: { createdAt: -1 } },
            { $project: { _id: 1, title: 1, order: 1, createdAt: 1 } },
          ],
          as: '_chapters',
        },
      },

      {
        $lookup: {
          from: 'styles',
          localField: 'styles',
          foreignField: '_id',
          as: 'styles',
        },
      },

      {
        $lookup: {
          from: 'genres',
          localField: 'genres',
          foreignField: '_id',
          as: 'genres',
        },
      },

      {
        $lookup: {
          from: 'ratings',
          localField: '_id',
          foreignField: 'mangaId',
          as: 'ratings',
        },
      },

      {
        $addFields: {
          chapters_count: { $size: '$_chapters' },
          latest_chapter: { $arrayElemAt: ['$_chapters', 0] },
          rating_avg: { $avg: '$ratings.rating' },
          isLicensed: { $eq: ['$licenseStatus', MangaLicenseStatus.APPROVED] },
          styles: {
            $map: {
              input: '$styles',
              as: 's',
              in: { _id: '$$s._id', name: '$$s.name' },
            },
          },
          genres: {
            $map: {
              input: '$genres',
              as: 'g',
              in: { _id: '$$g._id', name: '$$g.name' },
            },
          },
        },
      },

      {
        $project: {
          _id: 1,
          title: 1,
          slug: 1,
          authorId: 1,
          summary: 1,
          coverImage: 1,
          isPublish: 1,
          status: 1,
          views: 1,
          follows: 1,
          createdAt: 1,
          updatedAt: 1,
          styles: 1,
          genres: 1,
          rating_avg: { $ifNull: ['$rating_avg', 0] },
          chapters_count: 1,
          'latest_chapter.title': 1,
          'latest_chapter.order': 1,
          'latest_chapter.createdAt': 1,

          // ✅ for badge
          licenseStatus: 1,
          isLicensed: 1,
        },
      },

      { $sort: { updatedAt: -1 } },

      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: 'count' }],
        },
      },
      {
        $project: {
          data: 1,
          total: { $ifNull: [{ $arrayElemAt: ['$total.count', 0] }, 0] },
        },
      },
    ];

    const [res] = await this.mangaModel
      .aggregate(pipeline)
      .allowDiskUse(true)
      .exec();

    return { data: res?.data ?? [], total: res?.total ?? 0 };
  }

  // ✅ Updated detail: include licenseStatus for badge on cover
  async findMangaDetail(mangaId: string, userId: string): Promise<any> {
    if (!Types.ObjectId.isValid(mangaId)) {
      throw new NotFoundException('Manga not found');
    }

    const manga = await this.mangaModel
      .findById(mangaId)
      .populate('authorId', 'username avatar')
      .lean();

    if (!manga) throw new NotFoundException('Manga not found');

    const chapters = await this.chapterModel
      .find({ manga_id: new Types.ObjectId(mangaId), is_published: true })
      .sort({ order: 1 })
      .select('_id title order price')
      .lean();

    let purchasedChapterIds: string[] = [];
    if (userId) {
      const purchases = await this.chapterPurchaseModel
        .find({ userId: new Types.ObjectId(userId) })
        .select('chapterId');
      purchasedChapterIds = purchases.map((p) => p.chapterId.toString());
    }

    const chaptersWithPurchase = chapters.map((c) => {
      const purchased = purchasedChapterIds.includes(c._id.toString());
      const isFree = (c as any).price === 0;
      return {
        ...c,
        purchased,
        locked: !isFree && !purchased,
      };
    });

    const summaryAgg = await this.ratingModel.aggregate([
      { $match: { mangaId: new Types.ObjectId(mangaId) } },
      {
        $group: {
          _id: '$mangaId',
          count: { $sum: 1 },
          avgRating: { $avg: '$rating' },
        },
      },
    ]);

    const ratingSummary = summaryAgg[0]
      ? { count: summaryAgg[0].count, avgRating: summaryAgg[0].avgRating }
      : { count: 0, avgRating: 0 };

    const licenseStatus = (manga as any).licenseStatus || MangaLicenseStatus.NONE;

    return {
      _id: (manga as any)._id.toString(),
      title: (manga as any).title,
      summary: (manga as any).summary,
      coverImage: (manga as any).coverImage,
      author: (manga as any).authorId,
      views: (manga as any).views,
      status: (manga as any).status,
      chapters: chaptersWithPurchase,
      ratingSummary,

      // ✅ for verified badge
      licenseStatus,
      isLicensed: licenseStatus === MangaLicenseStatus.APPROVED,
    };
  }

  async getAllBasic() {
    const mangas = await this.mangaModel
      .find({ isDeleted: false, isPublish: true })
      .select('_id title')
      .sort({ title: 1 })
      .lean();
    return mangas;
  }

  async getAuthorByMangaIdForCommentChapter(id: string | Types.ObjectId) {
    return this.mangaModel.findById(id).populate('authorId').exec();
  }

  // ====================== DASHBOARD / STATS ======================

  async adminSummary() {
    const [totals, byMonth] = await Promise.all([
      this.mangaModel.countDocuments({ isDeleted: false }),
      this.mangaModel.aggregate([
        {
          $match: {
            createdAt: { $gte: startOfMonth(subMonths(new Date(), 1)) },
            isDeleted: { $ne: true },
          },
        },
        {
          $group: {
            _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } },
            cnt: { $sum: 1 },
          },
        },
        { $sort: { '_id.y': 1, '_id.m': 1 } },
      ]),
    ]);

    const now = new Date();
    const curY = now.getFullYear();
    const curM = now.getMonth() + 1;

    let cur = 0;
    let prev = 0;

    for (const row of byMonth) {
      const { y, m } = row._id;
      if (y === curY && m === curM) cur = row.cnt;

      const prevDate = subMonths(new Date(curY, curM - 1, 1), 1);
      if (y === prevDate.getFullYear() && m === prevDate.getMonth() + 1) {
        prev = row.cnt;
      }
    }

    const deltaPctMoM =
      prev === 0 ? (cur > 0 ? 100 : 0) : ((cur - prev) / prev) * 100;

    const [published, statusAgg] = await Promise.all([
      this.mangaModel.countDocuments({ isDeleted: false, isPublish: true }),
      this.mangaModel.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        { $group: { _id: '$status', cnt: { $sum: 1 } } },
      ]),
    ]);

    const byStatus = statusAgg.reduce((acc: any, r) => {
      acc[r._id || 'unknown'] = r.cnt;
      return acc;
    }, {});

    return {
      total: totals,
      deltaPctMoM,
      published,
      byStatus,
    };
  }

  async monthlyGrowth(months = 6) {
    const from = startOfMonth(subMonths(new Date(), months - 1));
    const rows = await this.mangaModel.aggregate([
      { $match: { createdAt: { $gte: from }, isDeleted: { $ne: true } } },
      {
        $group: {
          _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } },
          stories: { $sum: 1 },
        },
      },
      { $sort: { '_id.y': 1, '_id.m': 1 } },
    ]);

    const out: { month: string; stories: number }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const key = rows.find((r) => r._id.y === y && r._id.m === m);
      out.push({
        month: `${y}-${String(m).padStart(2, '0')}`,
        stories: key?.stories || 0,
      });
    }

    return out;
  }

  async topStories(limit = 5, by: 'views' | 'recent' = 'views') {
    const sortField = by === 'recent' ? 'createdAt' : 'views';
    const sortObj: Record<string, 1 | -1> = { [sortField]: -1 };

    const items = await this.mangaModel
      .find({ isDeleted: false, isPublish: true })
      .sort(sortObj)
      .limit(limit)
      .select('title authorId views status licenseStatus')
      .populate('authorId', 'username')
      .lean();

    return items.map((m) => ({
      id: (m as any)._id,
      title: (m as any).title,
      views: (m as any).views || 0,
      author: (m as any).authorId?.username || 'Unknown',
      status: (m as any).status || 'ongoing',
      licenseStatus: (m as any).licenseStatus || MangaLicenseStatus.NONE,
      isLicensed: (m as any).licenseStatus === MangaLicenseStatus.APPROVED,
    }));
  }

  // ====================== MISC ======================

  async getRandomManga() {
    const pipeline: any[] = [
      { $match: { isDeleted: false, isPublish: true } },
      {
        $lookup: {
          from: 'chapters',
          let: { mangaId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$manga_id', '$$mangaId'] },
                    { $ne: ['$isDeleted', true] },
                    { $eq: ['$is_published', true] },
                  ],
                },
              },
            },
          ],
          as: '_chapters',
        },
      },
      { $match: { '_chapters.0': { $exists: true } } },
      { $sample: { size: 1 } },
      { $project: { _id: 1, title: 1 } },
    ];

    const [result] = await this.mangaModel
      .aggregate(pipeline)
      .allowDiskUse(true)
      .exec();

    if (result) {
      return { _id: result._id.toString(), title: result.title };
    }
    return null;
  }

  async authorStats(authorId: Types.ObjectId) {
    const mangaIds = await this.mangaModel
      .find({ authorId, isDeleted: false })
      .select('_id')
      .lean();

    const mangaIdList = mangaIds.map((m) => m._id);

    if (mangaIdList.length === 0) {
      return {
        totalStories: 0,
        publishedStories: 0,
        totalViews: 0,
        totalChapters: 0,
        avgViewsPerStory: 0,
        statusBreakdown: { ongoing: 0, completed: 0, hiatus: 0 },
      };
    }

    const [totalStories, publishedStories, totalViews, statusBreakdown] =
      await Promise.all([
        this.mangaModel.countDocuments({ authorId, isDeleted: false }),
        this.mangaModel.countDocuments({
          authorId,
          isDeleted: false,
          isPublish: true,
        }),
        this.mangaModel
          .aggregate([
            { $match: { authorId, isDeleted: false } },
            { $group: { _id: null, total: { $sum: '$views' } } },
          ])
          .then((res) => res[0]?.total || 0),
        this.mangaModel.aggregate([
          { $match: { authorId, isDeleted: false } },
          { $group: { _id: '$status', cnt: { $sum: 1 } } },
        ]),
      ]);

    const totalChapters = await this.chapterModel.countDocuments({
      manga_id: { $in: mangaIdList },
      is_published: true,
    });

    const avgViewsPerStory =
      publishedStories > 0 ? Math.round(totalViews / publishedStories) : 0;

    const statusMap: any = { ongoing: 0, completed: 0, hiatus: 0 };
    statusBreakdown.forEach((item: any) => {
      const status = item._id || 'ongoing';
      if (Object.prototype.hasOwnProperty.call(statusMap, status)) {
        statusMap[status] = item.cnt;
      }
    });

    return {
      totalStories,
      publishedStories,
      totalViews,
      totalChapters,
      avgViewsPerStory,
      statusBreakdown: statusMap,
    };
  }

  async ViewCounter(Id: Types.ObjectId) {
    try {
      if (!Id || !Types.ObjectId.isValid(Id)) {
        throw new BadRequestException('Invalid chapter ID');
      }

      const chapter = await this.chapterModel.findById(Id).exec();
      if (!chapter) {
        throw new NotFoundException('Chapter does not exist');
      }

      if (!(chapter as any).manga_id) {
        throw new BadRequestException('Chapter does not have manga_id');
      }

      const updatedManga = await this.mangaModel
        .findByIdAndUpdate(
          (chapter as any).manga_id,
          { $inc: { views: 1 } },
          { new: true },
        )
        .exec();

      if (!updatedManga) {
        throw new NotFoundException('Manga does not exist');
      }

      return updatedManga;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Unable to increment view count');
    }
  }

  // ✅ Updated recommend: include licenseStatus for badge
  async getRecommendStory(user_id: Types.ObjectId) {
    const histories = await this.historyModel
      .find({ user_id: user_id })
      .sort({ updatedAt: -1 })
      .limit(20)
      .select('story_id')
      .lean();

    if (histories.length === 0) {
      return this.getAllManga(1, 10);
    }

    const readMangaIds = histories.map((h) => h.story_id);

    const highRated = await this.ratingModel
      .find({ userId: user_id, rating: { $gte: 4 } })
      .select('mangaId')
      .lean();

    const likedIds = highRated.length ? highRated.map((r) => r.mangaId) : readMangaIds;

    const likedManga = await this.mangaModel
      .find({ _id: { $in: likedIds } })
      .select('genres styles')
      .lean();

    const genreIds = [...new Set(likedManga.flatMap((m: any) => m.genres.map(String)))];
    const styleIds = [...new Set(likedManga.flatMap((m: any) => m.styles.map(String)))];

    const pipeline: any[] = [
      {
        $match: {
          isDeleted: false,
          isPublish: true,
          _id: { $nin: readMangaIds },
          $or: [
            { genres: { $in: genreIds.map((id) => new Types.ObjectId(id)) } },
            { styles: { $in: styleIds.map((id) => new Types.ObjectId(id)) } },
          ],
        },
      },

      {
        $lookup: {
          from: 'chapters',
          let: { mangaId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$manga_id', '$$mangaId'] },
                    { $ne: ['$isDeleted', true] },
                    { $eq: ['$is_published', true] },
                  ],
                },
              },
            },
            { $sort: { createdAt: -1 } },
            { $project: { _id: 1, title: 1, order: 1, createdAt: 1 } },
          ],
          as: '_chapters',
        },
      },

      {
        $lookup: {
          from: 'styles',
          localField: 'styles',
          foreignField: '_id',
          as: 'styles',
        },
      },

      {
        $lookup: {
          from: 'genres',
          localField: 'genres',
          foreignField: '_id',
          as: 'genres',
        },
      },

      {
        $lookup: {
          from: 'ratings',
          localField: '_id',
          foreignField: 'mangaId',
          as: 'ratings',
        },
      },

      {
        $addFields: {
          chapters_count: { $size: '$_chapters' },
          latest_chapter: { $arrayElemAt: ['$_chapters', 0] },
          rating_avg: { $avg: '$ratings.rating' },
          isLicensed: { $eq: ['$licenseStatus', MangaLicenseStatus.APPROVED] },
          styles: {
            $map: {
              input: '$styles',
              as: 's',
              in: { _id: '$$s._id', name: '$$s.name' },
            },
          },
          genres: {
            $map: {
              input: '$genres',
              as: 'g',
              in: { _id: '$$g._id', name: '$$g.name' },
            },
          },
        },
      },

      {
        $project: {
          _id: 1,
          title: 1,
          slug: 1,
          authorId: 1,
          summary: 1,
          coverImage: 1,
          isPublish: 1,
          status: 1,
          views: 1,
          follows: 1,
          createdAt: 1,
          updatedAt: 1,
          styles: 1,
          genres: 1,
          rating_avg: { $ifNull: ['$rating_avg', 0] },
          chapters_count: 1,
          'latest_chapter.title': 1,
          'latest_chapter.order': 1,
          'latest_chapter.createdAt': 1,

          // ✅ for badge
          licenseStatus: 1,
          isLicensed: 1,
        },
      },

      { $sort: { rating_avg: -1, views: -1 } },

      {
        $facet: {
          data: [{ $skip: 0 }, { $limit: 10 }],
          total: [{ $count: 'count' }],
        },
      },
      {
        $project: {
          data: 1,
          total: { $ifNull: [{ $arrayElemAt: ['$total.count', 0] }, 0] },
        },
      },
    ];

    const [res] = await this.mangaModel.aggregate(pipeline).allowDiskUse(true).exec();
    return { data: res?.data ?? [], total: res?.total ?? 0 };
  }

  // ====================== MODERATION / LICENSE QUEUE ======================

  async getLicenseQueue(
    status: 'all' | 'none' | 'pending' | 'approved' | 'rejected' = 'pending',
    q = '',
    page = 1,
    limit = 20,
  ) {
    const match: any = {};
    if (status !== 'all') {
      match.licenseStatus = status;
    }
    if (q && q.trim()) {
      match.title = { $regex: q.trim(), $options: 'i' };
    }

    const skip = (page - 1) * limit;

    const [data, total, grouped] = await Promise.all([
      this.mangaModel
        .find(match)
        .select('_id title coverImage isPublish status licenseStatus licenseSubmittedAt authorId')
        .populate('authorId', 'username email')
        .sort({ licenseSubmittedAt: -1, updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.mangaModel.countDocuments(match),
      this.mangaModel.aggregate([
        {
          $group: {
            _id: '$licenseStatus',
            cnt: { $sum: 1 },
          },
        },
      ]),
    ]);

    const stats: Record<string, number> = {
      none: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
    };

    for (const row of grouped) {
      stats[row._id || 'none'] = row.cnt;
    }

    return {
      data,
      total,
      page,
      limit,
      stats,
    };
  }

  async getLicenseDetail(mangaId: string) {
    if (!Types.ObjectId.isValid(mangaId)) {
      throw new BadRequestException('Invalid mangaId');
    }

    const manga = await this.mangaModel
      .findById(mangaId)
      .select(
        'title coverImage isPublish status licenseFiles licenseNote licenseStatus licenseSubmittedAt licenseRejectReason licenseReviewedAt licenseReviewedBy authorId',
      )
      .populate('authorId', 'username email')
      .populate('licenseReviewedBy', 'username')
      .lean();

    if (!manga) {
      throw new NotFoundException('Manga not found');
    }

    return manga;
  }

  /**
   * ✅ UC-106: review license + optional publish after approve
   */
  async reviewLicense(
    mangaId: string,
    reviewerId: string,
    status: MangaLicenseStatus,
    rejectReason?: string,
    publishAfterApprove = false,
  ) {
    if (!Types.ObjectId.isValid(mangaId)) {
      throw new BadRequestException('Invalid mangaId');
    }

    if (!Types.ObjectId.isValid(reviewerId)) {
      throw new BadRequestException('Invalid reviewerId');
    }

    if (
      status !== MangaLicenseStatus.APPROVED &&
      status !== MangaLicenseStatus.REJECTED
    ) {
      throw new BadRequestException('Invalid review status');
    }

    const manga = await this.mangaModel.findById(mangaId);
    if (!manga) throw new NotFoundException('Manga not found');

    if (manga.licenseStatus !== MangaLicenseStatus.PENDING) {
      throw new BadRequestException('License is not in pending state');
    }

    manga.licenseStatus = status;
    manga.licenseReviewedAt = new Date();
    manga.licenseReviewedBy = new Types.ObjectId(reviewerId);

    if (status === MangaLicenseStatus.REJECTED) {
      if (!rejectReason || !rejectReason.trim()) {
        throw new BadRequestException('Reject reason is required');
      }
      manga.licenseRejectReason = rejectReason.trim();
    } else {
      manga.licenseRejectReason = '';

      // ✅ optional: publish right after approve (makes badge visible in public lists)
      if (publishAfterApprove) {
        manga.isPublish = true;
      }
    }

    await manga.save();

    return {
      success: true,
      mangaId,
      licenseStatus: manga.licenseStatus,
      reviewedAt: manga.licenseReviewedAt,
      isPublish: manga.isPublish,
    };
  }

  /**
   * ✅ Moderation: publish/unpublish story
   * - Publish requires license APPROVED (recommended & enforced here)
   */
  async setPublishStatus(mangaId: string, isPublish: boolean) {
    if (!Types.ObjectId.isValid(mangaId)) {
      throw new BadRequestException('Invalid mangaId');
    }

    const manga = await this.mangaModel.findById(mangaId);
    if (!manga) throw new NotFoundException('Manga not found');

    // enforce: cannot publish without approved license
    if (isPublish && manga.licenseStatus !== MangaLicenseStatus.APPROVED) {
      throw new BadRequestException('Cannot publish: license is not approved');
    }

    manga.isPublish = Boolean(isPublish);
    await manga.save();

    return {
      success: true,
      mangaId,
      isPublish: manga.isPublish,
      licenseStatus: manga.licenseStatus,
    };
  }

  async getLicenseStatus(mangaId: string) {
    if (!Types.ObjectId.isValid(mangaId)) {
      throw new BadRequestException('Invalid mangaId');
    }

    const manga = await this.mangaModel
      .findById(mangaId)
      .select(
        'licenseStatus licenseRejectReason licenseSubmittedAt licenseReviewedAt',
      )
      .lean();

    if (!manga) throw new NotFoundException('Manga not found');

    return manga;
  }
}