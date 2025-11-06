import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Manga, MangaDocument } from '../schemas/Manga.schema';
import { CreateMangaDto } from './dto/CreateManga.dto';
import { UpdateMangaDto } from './dto/UpdateManga.dto';
import { StylesService } from '../styles/styles.service';
import { GenreService } from '../genre/genre.service';
import { Chapter, ChapterDocument } from 'src/schemas/chapter.schema';
import {
  ChapterPurchase,
  ChapterPurchaseDocument,
} from 'src/schemas/chapter-purchase.schema';
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
  ) {}

  // ====================== CRUD ======================

  async createManga(createMangaDto: CreateMangaDto, authorId: Types.ObjectId) {
    try {
      // Validate styles
      if (createMangaDto.styles?.length) {
        for (const styleId of createMangaDto.styles) {
          const style = await this.stylesService.findById(styleId.toString());
          if (!style) {
            throw new BadRequestException(`Style với ID ${styleId} không tồn tại`);
          }
          if (style.status === 'hide') {
            throw new BadRequestException(
              `Style "${style.name}" đã bị ẩn, không thể tạo truyện với style này`,
            );
          }
        }
      }

      // Validate genres
      if (createMangaDto.genres?.length) {
        for (const genreId of createMangaDto.genres) {
          const genre = await this.genreService.getGenreById(genreId.toString());
          if (!genre) {
            throw new BadRequestException(`Genre với ID ${genreId} không tồn tại`);
          }
          if (genre.status === 'hide') {
            throw new BadRequestException(
              `Genre "${genre.name}" đã bị ẩn, không thể tạo truyện với genre này`,
            );
          }
        }
      }

      const newManga = new this.mangaModel({
        ...createMangaDto,
        authorId,
      });

      // Emit thống kê khi tạo truyện
      this.eventEmitter.emit('story_create_count', { userId: authorId });

      return await newManga.save();
    } catch (error) {
      console.error('Error creating manga:', error);
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Không thể tạo manga mới');
    }
  }

  async updateManga(
    id: string,
    updateMangaDto: UpdateMangaDto,
    authorId: Types.ObjectId,
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID manga không hợp lệ');
    }

    // Validate styles nếu có
    if (updateMangaDto.styles?.length) {
      for (const styleId of updateMangaDto.styles) {
        const style = await this.stylesService.findById(styleId.toString());
        if (!style) {
          throw new BadRequestException(`Style với ID ${styleId} không tồn tại`);
        }
        if (style.status === 'hide') {
          throw new BadRequestException(
            `Style "${style.name}" đã bị ẩn, không thể cập nhật truyện với style này`,
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
        'Không thể cập nhật manga hoặc manga không tồn tại',
      );
    }

    return this.mangaModel
      .findById(id)
      .populate('genres', 'name')
      .populate('styles', 'name');
  }

  async deleteManga(id: string, authorId: Types.ObjectId) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID manga không hợp lệ');
    }

    const result = await this.mangaModel.deleteOne({ _id: id, authorId });
    if (result.deletedCount === 0) {
      throw new BadRequestException(
        'Không thể xóa manga hoặc manga không tồn tại',
      );
    }

    return { success: true, message: 'Xóa manga thành công' };
  }

  async toggleDelete(id: string, authorId: Types.ObjectId) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID manga không hợp lệ');
    }

    const manga = await this.mangaModel.findOne({ _id: id, authorId });
    if (!manga) {
      throw new BadRequestException(
        'Manga không tồn tại hoặc không thuộc quyền sở hữu',
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

  async getAllManga(page = 1, limit = 24) {
    const skip = (page - 1) * limit;

    const matchStage = {
      isDeleted: false,
      isPublish: true,
    };

    const pipeline: any[] = [
      { $match: matchStage },

      // Chapters public gần nhất (theo schema chapter: manga_id, is_published, isDeleted)
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

      // Styles
      {
        $lookup: {
          from: 'styles',
          localField: 'styles',
          foreignField: '_id',
          as: 'styles',
        },
      },

      // Genres
      {
        $lookup: {
          from: 'genres',
          localField: 'genres',
          foreignField: '_id',
          as: 'genres',
        },
      },

      // Ratings (Rating schema dùng mangaId)
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

    const [res] = await this.mangaModel.aggregate(pipeline).allowDiskUse(true).exec();
    return { data: res?.data ?? [], total: res?.total ?? 0 };
  }

  async findMangaDetail(mangaId: string, userId: string): Promise<any> {
    if (!Types.ObjectId.isValid(mangaId)) {
      throw new NotFoundException('Manga not found');
    }

    const manga = await this.mangaModel
      .findById(mangaId)
      .populate('authorId', 'username avatar')
      .lean();

    if (!manga) throw new NotFoundException('Manga not found');

    // Chapters đã publish
    const chapters = await this.chapterModel
      .find({ manga_id: new Types.ObjectId(mangaId), is_published: true })
      .sort({ order: 1 })
      .select('_id title order price')
      .lean();

    // Các chapter user đã mua
    let purchasedChapterIds: string[] = [];
    if (userId) {
      const purchases = await this.chapterPurchaseModel
        .find({ userId: new Types.ObjectId(userId) })
        .select('chapterId');
      purchasedChapterIds = purchases.map((p) => p.chapterId.toString());
    }

    const chaptersWithPurchase = chapters.map((c) => {
      const purchased = purchasedChapterIds.includes(c._id.toString());
      const isFree = c.price === 0;
      return {
        ...c,
        purchased,
        locked: !isFree && !purchased,
      };
    });

    // Summary rating
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

    return {
      _id: manga._id.toString(),
      title: manga.title,
      summary: manga.summary,
      coverImage: manga.coverImage,
      author: manga.authorId,
      views: manga.views,
      status: manga.status,
      chapters: chaptersWithPurchase,
      ratingSummary,
    };
  }

  // FE cần list cơ bản (id + title)
  async getAllBasic() {
    const mangas = await this.mangaModel
      .find({ isDeleted: false, isPublish: true })
      .select('_id title')
      .sort({ title: 1 })
      .lean();
    return mangas;
  }

  // Lấy thông tin manga + author cho luồng comment chapter
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
            createdAt: {
              $gte: startOfMonth(subMonths(new Date(), 1)),
            },
            isDeleted: { $ne: true },
          },
        },
        {
          $group: {
            _id: {
              y: { $year: '$createdAt' },
              m: { $month: '$createdAt' },
            },
            cnt: { $sum: 1 },
          },
        },
        { $sort: { '_id.y': 1, '_id.m': 1 } },
      ]),
    ]);

    const now = new Date();
    const curY = now.getFullYear();
    const curM = now.getMonth() + 1;

    let cur = 0,
      prev = 0;
    for (const row of byMonth) {
      const { y, m } = row._id;
      if (y === curY && m === curM) cur = row.cnt;

      const prevDate = subMonths(new Date(curY, curM - 1, 1), 1);
      if (y === prevDate.getFullYear() && m === prevDate.getMonth() + 1) prev = row.cnt;
    }

    const deltaPctMoM = prev === 0 ? (cur > 0 ? 100 : 0) : ((cur - prev) / prev) * 100;

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
      byStatus, // { ongoing: n, completed: n, hiatus: n }
    };
  }

  async monthlyGrowth(months = 6) {
    const from = startOfMonth(subMonths(new Date(), months - 1));
    const rows = await this.mangaModel.aggregate([
      {
        $match: {
          createdAt: { $gte: from },
          isDeleted: { $ne: true },
        },
      },
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
      .select('title authorId views status')
      .populate('authorId', 'username')
      .lean();

    return items.map((m) => ({
      id: m._id,
      title: m.title,
      views: m.views || 0,
      author: (m as any).authorId?.username || 'Unknown',
      status: m.status || 'ongoing',
    }));
  }

  // ====================== MISC ======================

  async getRandomManga() {
    const pipeline: any[] = [
      {
        $match: {
          isDeleted: false,
          isPublish: true,
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
          ],
          as: '_chapters',
        },
      },
      {
        $match: {
          '_chapters.0': { $exists: true },
        },
      },
      { $sample: { size: 1 } },
      { $project: { _id: 1, title: 1 } },
    ];

    const [result] = await this.mangaModel.aggregate(pipeline).allowDiskUse(true).exec();
    if (result) {
      return {
        _id: result._id.toString(),
        title: result.title,
      };
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
        statusBreakdown: {
          ongoing: 0,
          completed: 0,
          hiatus: 0,
        },
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

    const statusMap: any = {
      ongoing: 0,
      completed: 0,
      hiatus: 0,
    };

    statusBreakdown.forEach((item) => {
      const status = item._id || 'ongoing';
      if (statusMap.hasOwnProperty(status)) {
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
    const chapter = await this.chapterModel.findById(Id).exec();
    if (!chapter) {
      throw new Error('Chapter not found');
    }
    return this.mangaModel
      .findByIdAndUpdate(
        chapter.manga_id,
        { $inc: { views: 1 } },
        { new: true },
      )
      .exec();
  }
}
