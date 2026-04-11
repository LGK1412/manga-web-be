import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  Manga,
  MangaDocument,
  MangaEnforcementStatus,
  MangaLicenseStatus,
  MangaRights,
  RightsBasis,
  RightsReviewStatus,
  StoryMonetizationType,
  StoryOriginType,
  CopyrightClaimStatus,
} from 'src/schemas/Manga.schema';
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
import { GetMangaManagementQueryDto } from './dto/get-manga-management-query.dto';

import { Role } from 'src/common/enums/role.enum';
import { getLicenseRejectReasonHistory } from 'src/license/helpers/license-rights.helper';

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

  ) { }

  // =========================================================
  // helpers
  // =========================================================

  private getDefaultRights(): MangaRights {
    return {
      originType: StoryOriginType.UNKNOWN,
      monetizationType: StoryMonetizationType.FREE,
      basis: RightsBasis.UNKNOWN,
      declarationAccepted: false,
      declarationAcceptedAt: null,
      declarationVersion: 'v1',
      sourceTitle: '',
      sourceUrl: '',
      licenseName: '',
      licenseUrl: '',
      proofFiles: [],
      proofNote: '',
      reviewStatus: RightsReviewStatus.NOT_REQUIRED,
      reviewedAt: null,
      reviewedBy: null,
      rejectReason: '',
      claimStatus: CopyrightClaimStatus.NONE,
      claimOpenedAt: null,
      claimResolvedAt: null,
    };
  }

  private getMergedRights(manga: MangaDocument | any): MangaRights {
    return {
      ...this.getDefaultRights(),
      ...(((manga as any)?.rights ?? {}) as Partial<MangaRights>),
    };
  }

  private canManageStoryRights(
    manga: MangaDocument | any,
    actorId: string,
    actorRole?: string,
  ) {
    return (
      actorRole === Role.ADMIN ||
      String((manga as any).authorId) === String(actorId)
    );
  }

  private isStrictReviewCase(rights: MangaRights) {
    return (
      rights.originType === StoryOriginType.TRANSLATED ||
      rights.originType === StoryOriginType.ADAPTED ||
      rights.originType === StoryOriginType.REPOST ||
      rights.basis === RightsBasis.OWNER_AUTHORIZATION ||
      rights.basis === RightsBasis.PUBLISHER_CONTRACT
    );
  }



  private evaluatePublishEligibility(manga: MangaDocument) {
    const rights = this.getMergedRights(manga);
    const enforcementStatus = this.resolveEnforcementStatus(
      (manga as any).enforcementStatus,
    );

    if (enforcementStatus !== MangaEnforcementStatus.NORMAL) {
      return {
        canPublish: false,
        requiresReview: false,
        reason: 'Cannot publish: manga is suspended or banned',
      };
    }

    if (
      rights.claimStatus === CopyrightClaimStatus.OPEN ||
      rights.reviewStatus === RightsReviewStatus.UNDER_CLAIM
    ) {
      return {
        canPublish: false,
        requiresReview: true,
        reason: 'Cannot publish: story is under copyright claim',
      };
    }

    return {
      canPublish: true,
      requiresReview: false,
      reason: null,
    };
  }





  private normalizeCoverImage(path?: string | null) {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('/')) {
      return path;
    }
    return `/assets/coverImages/${path}`;
  }

  private normalizeAssetPath(path?: string | null) {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('/')) {
      return path;
    }
    return `/${path.replace(/^\/+/, '')}`;
  }

  private resolvePublicationStatus(
    isPublish: boolean,
    licenseStatus?: MangaLicenseStatus | string | null,
  ): 'draft' | 'published' | 'unpublished' {
    if (isPublish) return 'published';
    if (
      !licenseStatus ||
      licenseStatus === MangaLicenseStatus.NONE ||
      licenseStatus === MangaLicenseStatus.PENDING
    ) {
      return 'draft';
    }
    return 'unpublished';
  }

  private resolveEnforcementStatus(
    status?: MangaEnforcementStatus | string | null,
  ): MangaEnforcementStatus {
    if (
      status === MangaEnforcementStatus.SUSPENDED ||
      status === MangaEnforcementStatus.BANNED
    ) {
      return status;
    }
    return MangaEnforcementStatus.NORMAL;
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

      const nextIsPublish = Boolean(createMangaDto.isPublish);

      const newManga = new this.mangaModel({
        ...createMangaDto,
        authorId,
        isPublish: nextIsPublish,
        licenseStatus: MangaLicenseStatus.NONE,
        enforcementStatus: MangaEnforcementStatus.NORMAL,
        rights: this.getDefaultRights(),
        verifiedBadge: false,
      });

      this.eventEmitter.emit('story_create_count', { userId: authorId });

      return await newManga.save();
    } catch (error) {
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

    const existingManga = await this.mangaModel.findOne({ _id: id, authorId });
    if (!existingManga) {
      throw new BadRequestException(
        'Unable to update manga or manga does not exist',
      );
    }

    const nextState = {
      ...existingManga.toObject(),
      ...updateMangaDto,
    };

    if (nextState.isPublish) {
      const eligibility = this.evaluatePublishEligibility(nextState as any);
      if (!eligibility.canPublish) {
        throw new BadRequestException(
          eligibility.reason || 'Story cannot be published under the current backend policy',
        );
      }
    }

    Object.assign(existingManga, updateMangaDto);
    await existingManga.save();

    return this.mangaModel
      .findById(existingManga._id)
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

  async getAllManga(page = 1, limit = 24) {
    const skip = (page - 1) * limit;

    const matchStage = {
      isDeleted: false,
      isPublish: true,
      $or: [
        { enforcementStatus: { $exists: false } },
        { enforcementStatus: MangaEnforcementStatus.NORMAL },
      ],
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
          isLicensed: {
            $or: [
              { $eq: ['$licenseStatus', MangaLicenseStatus.APPROVED] },
              { $eq: [{ $ifNull: ['$verifiedBadge', false] }, true] },
            ],
          },
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

    const mapped = (res?.data ?? []).map((item: any) => ({
      ...item,
      coverImage: this.normalizeCoverImage(item.coverImage),
    }));

    return { data: mapped, total: res?.total ?? 0 };
  }

  async findMangaDetail(mangaId: string, userId: string): Promise<any> {
    if (!Types.ObjectId.isValid(mangaId)) {
      throw new NotFoundException('Manga not found');
    }

    const manga = await this.mangaModel
      .findOne({
        _id: new Types.ObjectId(mangaId),
        isDeleted: false,
        isPublish: true,
        $or: [
          { enforcementStatus: { $exists: false } },
          { enforcementStatus: MangaEnforcementStatus.NORMAL },
        ],
      })
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
      coverImage: this.normalizeCoverImage((manga as any).coverImage),
      author: (manga as any).authorId,
      views: (manga as any).views,
      status: (manga as any).status,
      chapters: chaptersWithPurchase,
      ratingSummary,
      licenseStatus,
      isLicensed: licenseStatus === MangaLicenseStatus.APPROVED,
    };
  }

  async getAllBasic() {
    const mangas = await this.mangaModel
      .find({
        isDeleted: false,
        isPublish: true,
        $or: [
          { enforcementStatus: { $exists: false } },
          { enforcementStatus: MangaEnforcementStatus.NORMAL },
        ],
      })
      .select('_id title')
      .sort({ title: 1 })
      .lean();
    return mangas;
  }

  async getAuthorByMangaIdForCommentChapter(id: string | Types.ObjectId) {
    return this.mangaModel.findById(id).populate('authorId').exec();
  }

  // ====================== MANAGEMENT ======================

  async getManagementList(query: GetMangaManagementQueryDto) {
    const {
      q = '',
      licenseStatus = 'all',
      publicationStatus = 'all',
      enforcementStatus = 'all',
      authorId,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
    } = query;

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const skip = (safePage - 1) * safeLimit;

    const pipeline: any[] = [
      {
        $match: {
          isDeleted: { $ne: true },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'authorId',
          foreignField: '_id',
          as: 'author',
        },
      },
      {
        $unwind: {
          path: '$author',
          preserveNullAndEmptyArrays: true,
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
                  ],
                },
              },
            },
            { $count: 'count' },
          ],
          as: '_chapterCount',
        },
      },
      {
        $addFields: {
          authorName: { $ifNull: ['$author.username', 'Unknown'] },
          chaptersCount: {
            $ifNull: [{ $arrayElemAt: ['$_chapterCount.count', 0] }, 0],
          },
          enforcementStatus: {
            $ifNull: ['$enforcementStatus', MangaEnforcementStatus.NORMAL],
          },
          publicationStatus: {
            $cond: [
              '$isPublish',
              'published',
              {
                $cond: [
                  {
                    $in: [
                      '$licenseStatus',
                      [MangaLicenseStatus.NONE, MangaLicenseStatus.PENDING],
                    ],
                  },
                  'draft',
                  'unpublished',
                ],
              },
            ],
          },
        },
      },
      {
        $addFields: {
          licenseSortOrder: {
            $switch: {
              branches: [
                { case: { $eq: ['$licenseStatus', MangaLicenseStatus.PENDING] }, then: 0 },
                { case: { $eq: ['$licenseStatus', MangaLicenseStatus.REJECTED] }, then: 1 },
                { case: { $eq: ['$licenseStatus', MangaLicenseStatus.NONE] }, then: 2 },
                { case: { $eq: ['$licenseStatus', MangaLicenseStatus.APPROVED] }, then: 3 },
              ],
              default: 4,
            },
          },
          publicationSortOrder: {
            $switch: {
              branches: [
                { case: { $eq: ['$publicationStatus', 'draft'] }, then: 0 },
                { case: { $eq: ['$publicationStatus', 'unpublished'] }, then: 1 },
                { case: { $eq: ['$publicationStatus', 'published'] }, then: 2 },
              ],
              default: 3,
            },
          },
          enforcementSortOrder: {
            $switch: {
              branches: [
                { case: { $eq: ['$enforcementStatus', MangaEnforcementStatus.BANNED] }, then: 0 },
                { case: { $eq: ['$enforcementStatus', MangaEnforcementStatus.SUSPENDED] }, then: 1 },
                { case: { $eq: ['$enforcementStatus', MangaEnforcementStatus.NORMAL] }, then: 2 },
              ],
              default: 3,
            },
          },
        },
      },
    ];

    const matchAfterComputed: any = {};

    if (licenseStatus !== 'all') {
      matchAfterComputed.licenseStatus = licenseStatus;
    }

    if (publicationStatus !== 'all') {
      matchAfterComputed.publicationStatus = publicationStatus;
    }

    if (enforcementStatus !== 'all') {
      matchAfterComputed.enforcementStatus = enforcementStatus;
    }

    if (authorId && Types.ObjectId.isValid(authorId)) {
      matchAfterComputed.authorId = new Types.ObjectId(authorId);
    }

    if (q.trim()) {
      matchAfterComputed.$or = [
        { title: { $regex: q.trim(), $options: 'i' } },
        { authorName: { $regex: q.trim(), $options: 'i' } },
      ];
    }

    if (Object.keys(matchAfterComputed).length > 0) {
      pipeline.push({ $match: matchAfterComputed });
    }

    const normalizedSortOrder: 1 | -1 = sortOrder === 'asc' ? 1 : -1;
    const sortStage: Record<string, 1 | -1> = { updatedAt: -1, createdAt: -1 };

    switch (sortBy) {
      case 'title':
        sortStage.title = normalizedSortOrder;
        sortStage.updatedAt = -1;
        break;
      case 'licenseStatus':
        sortStage.licenseSortOrder = normalizedSortOrder;
        break;
      case 'publicationStatus':
        sortStage.publicationSortOrder = normalizedSortOrder;
        break;
      case 'enforcementStatus':
        sortStage.enforcementSortOrder = normalizedSortOrder;
        break;
      case 'chaptersCount':
        sortStage.chaptersCount = normalizedSortOrder;
        break;
      default:
        sortStage.updatedAt = normalizedSortOrder;
        break;
    }

    pipeline.push(
      { $sort: sortStage },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: safeLimit },
            {
              $project: {
                _id: 1,
                title: 1,
                summary: 1,
                coverImage: 1,
                authorId: 1,
                author: '$authorName',
                licenseStatus: 1,
                publicationStatus: 1,
                enforcementStatus: 1,
                enforcementReason: {
                  $ifNull: ['$enforcementReason', ''],
                },
                status: 1,
                views: 1,
                chaptersCount: 1,
                updatedAt: 1,
                licenseSubmittedAt: 1,
                licenseReviewedAt: 1,
                isPublish: 1,
              },
            },
          ],
          total: [{ $count: 'count' }],
        },
      },
      {
        $project: {
          data: 1,
          total: { $ifNull: [{ $arrayElemAt: ['$total.count', 0] }, 0] },
        },
      },
    );

    const [result, statsAgg] = await Promise.all([
      this.mangaModel.aggregate(pipeline).allowDiskUse(true).exec(),
      this.mangaModel.aggregate([
        {
          $match: {
            isDeleted: { $ne: true },
          },
        },
        {
          $addFields: {
            enforcementStatus: {
              $ifNull: ['$enforcementStatus', MangaEnforcementStatus.NORMAL],
            },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            pendingLicense: {
              $sum: {
                $cond: [{ $eq: ['$licenseStatus', MangaLicenseStatus.PENDING] }, 1, 0],
              },
            },
            published: {
              $sum: {
                $cond: [{ $eq: ['$isPublish', true] }, 1, 0],
              },
            },
            enforcementIssues: {
              $sum: {
                $cond: [
                  { $ne: ['$enforcementStatus', MangaEnforcementStatus.NORMAL] },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
    ]);

    const rows = result?.[0]?.data ?? [];
    const total = result?.[0]?.total ?? 0;
    const statsRow = statsAgg?.[0] || {
      total: 0,
      pendingLicense: 0,
      published: 0,
      enforcementIssues: 0,
    };

    return {
      data: rows.map((item: any) => ({
        ...item,
        id: item._id.toString(),
        coverImage: this.normalizeCoverImage(item.coverImage),
      })),
      total,
      page: safePage,
      limit: safeLimit,
      stats: {
        total: statsRow.total,
        pendingLicense: statsRow.pendingLicense,
        published: statsRow.published,
        enforcementIssues: statsRow.enforcementIssues,
      },
    };
  }

  async getManagementDetail(mangaId: string) {
    if (!Types.ObjectId.isValid(mangaId)) {
      throw new BadRequestException('Invalid mangaId');
    }

    const manga = await this.mangaModel
      .findById(mangaId)
      .populate('authorId', 'username email avatar')
      .populate('styles', 'name')
      .populate('genres', 'name')
      .populate('licenseReviewedBy', 'username email')
      .populate('enforcementUpdatedBy', 'username email')
      .lean();

    if (!manga) {
      throw new NotFoundException('Manga not found');
    }

    const [chaptersCount, ratingAgg] = await Promise.all([
      this.chapterModel.countDocuments({
        manga_id: new Types.ObjectId(mangaId),
        isDeleted: { $ne: true },
      }),
      this.ratingModel.aggregate([
        { $match: { mangaId: new Types.ObjectId(mangaId) } },
        {
          $group: {
            _id: '$mangaId',
            avgRating: { $avg: '$rating' },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const ratingSummary = ratingAgg[0]
      ? { avgRating: ratingAgg[0].avgRating, count: ratingAgg[0].count }
      : { avgRating: 0, count: 0 };

    const licenseStatus =
      (manga as any).licenseStatus || MangaLicenseStatus.NONE;
    const enforcementStatus = this.resolveEnforcementStatus(
      (manga as any).enforcementStatus,
    );

    return {
      id: (manga as any)._id.toString(),
      title: (manga as any).title,
      summary: (manga as any).summary || '',
      coverImage: this.normalizeCoverImage((manga as any).coverImage),
      author: (manga as any).authorId
        ? {
          _id: (manga as any).authorId._id?.toString?.() || '',
          username: (manga as any).authorId.username || 'Unknown',
          email: (manga as any).authorId.email || '',
          avatar: (manga as any).authorId.avatar || '',
        }
        : null,
      styles: Array.isArray((manga as any).styles)
        ? (manga as any).styles.map((s: any) => ({
          _id: s._id?.toString?.() || '',
          name: s.name,
        }))
        : [],
      genres: Array.isArray((manga as any).genres)
        ? (manga as any).genres.map((g: any) => ({
          _id: g._id?.toString?.() || '',
          name: g.name,
        }))
        : [],
      views: (manga as any).views || 0,
      status: (manga as any).status || 'ongoing',
      chaptersCount,
      ratingSummary,
      updatedAt: (manga as any).updatedAt,
      createdAt: (manga as any).createdAt,

      licenseStatus,
      licenseFiles: Array.isArray((manga as any).licenseFiles)
        ? (manga as any).licenseFiles.map((f: string) => this.normalizeAssetPath(f))
        : [],
      licenseNote: (manga as any).licenseNote || '',
      licenseSubmittedAt: (manga as any).licenseSubmittedAt || null,
      licenseReviewedAt: (manga as any).licenseReviewedAt || null,
      licenseReviewedBy: (manga as any).licenseReviewedBy
        ? {
          _id: (manga as any).licenseReviewedBy._id?.toString?.() || '',
          username: (manga as any).licenseReviewedBy.username || 'Unknown',
          email: (manga as any).licenseReviewedBy.email || '',
        }
        : null,
      licenseRejectReason: (manga as any).licenseRejectReason || '',
      licenseRejectReasons: getLicenseRejectReasonHistory(manga),

      isPublish: Boolean((manga as any).isPublish),
      publicationStatus: this.resolvePublicationStatus(
        Boolean((manga as any).isPublish),
        licenseStatus,
      ),

      enforcementStatus,
      enforcementReason: (manga as any).enforcementReason || '',
      enforcementUpdatedAt: (manga as any).enforcementUpdatedAt || null,
      enforcementUpdatedBy: (manga as any).enforcementUpdatedBy
        ? {
          _id: (manga as any).enforcementUpdatedBy._id?.toString?.() || '',
          username: (manga as any).enforcementUpdatedBy.username || 'Unknown',
          email: (manga as any).enforcementUpdatedBy.email || '',
        }
        : null,
    };
  }

  async setEnforcementStatus(
    mangaId: string,
    actorId: string,
    status: MangaEnforcementStatus,
    reason?: string,
  ) {
    if (!Types.ObjectId.isValid(mangaId)) {
      throw new BadRequestException('Invalid mangaId');
    }

    if (!Types.ObjectId.isValid(actorId)) {
      throw new BadRequestException('Invalid actorId');
    }

    const manga = await this.mangaModel.findById(mangaId);
    if (!manga) throw new NotFoundException('Manga not found');

    if (
      (status === MangaEnforcementStatus.SUSPENDED ||
        status === MangaEnforcementStatus.BANNED) &&
      !reason?.trim()
    ) {
      throw new BadRequestException('Reason is required');
    }

    manga.enforcementStatus = status;
    manga.enforcementReason =
      status === MangaEnforcementStatus.NORMAL ? '' : reason?.trim() || '';
    manga.enforcementUpdatedBy = new Types.ObjectId(actorId);
    manga.enforcementUpdatedAt = new Date();

    if (status !== MangaEnforcementStatus.NORMAL) {
      manga.isPublish = false;
    }

    await manga.save();

    return {
      success: true,
      mangaId,
      enforcementStatus: manga.enforcementStatus,
      enforcementReason: manga.enforcementReason,
      isPublish: manga.isPublish,
    };
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
      .find({
        isDeleted: false,
        isPublish: true,
        $or: [
          { enforcementStatus: { $exists: false } },
          { enforcementStatus: MangaEnforcementStatus.NORMAL },
        ],
      })
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
      {
        $match: {
          isDeleted: false,
          isPublish: true,
          $or: [
            { enforcementStatus: { $exists: false } },
            { enforcementStatus: MangaEnforcementStatus.NORMAL },
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
      const mangaId = (chapter as any).manga_id;
      if (!mangaId) {
        throw new BadRequestException('Chapter does not have manga_id');
      }
      const updatedManga = await this.mangaModel
        .findByIdAndUpdate(
          mangaId,
          { $inc: { views: 1 } },
          { new: true, timestamps: false }
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
            { enforcementStatus: { $exists: false } },
            { enforcementStatus: MangaEnforcementStatus.NORMAL },
          ],
          $and: [
            {
              $or: [
                { genres: { $in: genreIds.map((id) => new Types.ObjectId(id)) } },
                { styles: { $in: styleIds.map((id) => new Types.ObjectId(id)) } },
              ],
            },
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
          isLicensed: {
            $or: [
              { $eq: ['$licenseStatus', MangaLicenseStatus.APPROVED] },
              { $eq: [{ $ifNull: ['$verifiedBadge', false] }, true] },
            ],
          },
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
    const mapped = (res?.data ?? []).map((item: any) => ({
      ...item,
      coverImage: this.normalizeCoverImage(item.coverImage),
    }));
    return { data: mapped, total: res?.total ?? 0 };
  }





  async setPublishStatus(mangaId: string, isPublish: boolean) {
    if (!Types.ObjectId.isValid(mangaId)) {
      throw new BadRequestException('Invalid mangaId');
    }

    const manga = await this.mangaModel.findById(mangaId);
    if (!manga) throw new NotFoundException('Manga not found');

    if (isPublish) {
      const eligibility = this.evaluatePublishEligibility(manga);
      if (!eligibility.canPublish) {
        throw new BadRequestException(
          eligibility.reason || 'Story cannot be published under the current backend policy',
        );
      }
    }

    manga.isPublish = Boolean(isPublish);
    await manga.save();

    return {
      success: true,
      mangaId,
      isPublish: manga.isPublish,
      publicationStatus: this.resolvePublicationStatus(
        manga.isPublish,
        manga.licenseStatus,
      ),
      licenseStatus: manga.licenseStatus,
      enforcementStatus: this.resolveEnforcementStatus(manga.enforcementStatus),
      rightsStatus: this.getMergedRights(manga).reviewStatus,
      verifiedBadge: Boolean((manga as any).verifiedBadge),
    };
  }





  async getAuthorStoryDetail(
    mangaId: string,
    actorId: string,
    actorRole?: string,
  ) {
    if (!Types.ObjectId.isValid(mangaId)) {
      throw new BadRequestException('Invalid mangaId');
    }

    if (!Types.ObjectId.isValid(actorId)) {
      throw new BadRequestException('Invalid actorId');
    }

    const manga = await this.mangaModel
      .findById(mangaId)
      .populate('genres', 'name')
      .populate('styles', 'name')
      .lean();

    if (!manga) {
      throw new NotFoundException('Manga not found');
    }

    if (!this.canManageStoryRights(manga, actorId, actorRole)) {
      throw new BadRequestException('You do not have permission to view this story');
    }

    return {
      ...manga,
      _id: String((manga as any)._id),
      authorId: String((manga as any).authorId),
      coverImage: this.normalizeCoverImage((manga as any).coverImage),
      enforcementStatus: this.resolveEnforcementStatus(
        (manga as any).enforcementStatus,
      ),
      publicationStatus: this.resolvePublicationStatus(
        Boolean((manga as any).isPublish),
        (manga as any).licenseStatus,
      ),
    };
  }
}
