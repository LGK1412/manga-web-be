import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import fs from 'fs';
import { join } from 'path';

import {
  Manga,
  MangaDocument,
  MangaLicenseStatus,
  MangaRights,
  RightsBasis,
  RightsReviewStatus,
  StoryOriginType,
} from 'src/schemas/Manga.schema';

import { UpdateStoryRightsDto } from './dto/update-story-rights.dto';
import { AcceptRightsDeclarationDto } from './dto/accept-rights-declaration.dto';
import {
  appendLicenseRejectReason,
  canManageStoryRights,
  clearCurrentLicenseRejectReason,
  derivePassiveReviewStatus,
  evaluatePublishEligibility,
  genFileName,
  getLicenseRejectReasonHistory,
  getMergedRights,
  isStrictReviewCase,
  normalizeAssetPath,
  normalizeCoverImage,
  resolveEnforcementStatus,
  serializeStoryRights,
  syncLegacyLicenseFromRights,
  toAbsFromRel,
  unlinkSafe,
} from './helpers/license-rights.helper';

@Injectable()
export class LicenseService {
  constructor(
    @InjectModel(Manga.name) private readonly mangaModel: Model<MangaDocument>,
  ) {}

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
        'authorId isPublish licenseFiles licenseStatus licenseNote licenseSubmittedAt licenseRejectReason licenseRejectReasons licenseReviewedAt licenseReviewedBy rights verifiedBadge',
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

        const filename = genFileName(f.originalname);
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
      await Promise.allSettled(newAbsFiles.map((p) => unlinkSafe(p)));
      if (err instanceof BadRequestException) throw err;
      throw new InternalServerErrorException('Unable to save license files');
    }

    try {
      const rights = getMergedRights(manga);

      (manga as any).licenseStatus = MangaLicenseStatus.PENDING;
      (manga as any).licenseFiles = newRelFiles;
      (manga as any).licenseNote = note ?? '';
      (manga as any).licenseSubmittedAt = new Date();
      clearCurrentLicenseRejectReason(manga);
      (manga as any).licenseReviewedAt = undefined;
      (manga as any).licenseReviewedBy = undefined;
      (manga as any).verifiedBadge = false;

      (manga as any).rights = {
        ...rights,
        proofFiles: newRelFiles,
        proofNote: note ?? '',
        reviewStatus: RightsReviewStatus.PENDING,
        reviewedAt: null,
        reviewedBy: null,
        rejectReason: '',
      };

      if (isStrictReviewCase((manga as any).rights)) {
        (manga as any).isPublish = false;
      }

      await manga.save();
    } catch {
      await Promise.allSettled(newAbsFiles.map((p) => unlinkSafe(p)));
      throw new InternalServerErrorException('Unable to update manga license');
    }

    if (oldRelFiles.length > 0) {
      await Promise.allSettled(
        oldRelFiles.map((rel) => unlinkSafe(toAbsFromRel(rel))),
      );
    }

    return {
      success: true,
      mangaId,
      licenseStatus: (manga as any).licenseStatus,
      files: ((manga as any).licenseFiles || []).map((f: string) =>
        normalizeAssetPath(f),
      ),
      submittedAt: (manga as any).licenseSubmittedAt,
      isPublish: (manga as any).isPublish,
      rightsStatus: getMergedRights(manga).reviewStatus,
    };
  }

  async getLicenseQueue(
    status: 'all' | 'none' | 'pending' | 'approved' | 'rejected' = 'pending',
    q = '',
    page = 1,
    limit = 20,
  ) {
    const match: any = {
      isDeleted: { $ne: true },
    };

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
        .select(
          '_id title coverImage isPublish status licenseStatus licenseSubmittedAt enforcementStatus authorId rights verifiedBadge',
        )
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
      data: data.map((item: any) => {
        const rights = getMergedRights(item);
        return {
          ...item,
          coverImage: normalizeCoverImage(item.coverImage),
          enforcementStatus: resolveEnforcementStatus(item.enforcementStatus),
          rightsStatus: rights.reviewStatus,
          originType: rights.originType,
          monetizationType: rights.monetizationType,
          rightsBasis: rights.basis,
          verifiedBadge: Boolean(item.verifiedBadge),
        };
      }),
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
        'title coverImage isPublish status licenseFiles licenseNote licenseStatus licenseSubmittedAt licenseRejectReason licenseRejectReasons licenseReviewedAt licenseReviewedBy authorId enforcementStatus enforcementReason rights verifiedBadge',
      )
      .populate('authorId', 'username email')
      .populate('licenseReviewedBy', 'username email')
      .lean();

    if (!manga) {
      throw new NotFoundException('Manga not found');
    }

    const rights = getMergedRights(manga);

    return {
      ...manga,
      coverImage: normalizeCoverImage((manga as any).coverImage),
      licenseFiles: Array.isArray((manga as any).licenseFiles)
        ? (manga as any).licenseFiles.map((f: string) =>
            normalizeAssetPath(f),
          )
        : [],
      licenseRejectReasons: getLicenseRejectReasonHistory(manga),
      enforcementStatus: resolveEnforcementStatus(
        (manga as any).enforcementStatus,
      ),
      rights,
      rightsStatus: rights.reviewStatus,
      originType: rights.originType,
      monetizationType: rights.monetizationType,
      rightsBasis: rights.basis,
      verifiedBadge: Boolean((manga as any).verifiedBadge),
    };
  }

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

    const rights = getMergedRights(manga);
    const normalizedRejectReason = rejectReason?.trim() || '';

    manga.licenseStatus = status;
    manga.licenseReviewedAt = new Date();
    manga.licenseReviewedBy = new Types.ObjectId(reviewerId);

    if (status === MangaLicenseStatus.REJECTED) {
      if (!normalizedRejectReason) {
        throw new BadRequestException('Reject reason is required');
      }

      appendLicenseRejectReason(manga, normalizedRejectReason);
      manga.isPublish = false;
      (manga as any).verifiedBadge = false;

      (manga as any).rights = {
        ...rights,
        reviewStatus: RightsReviewStatus.REJECTED,
        reviewedAt: new Date(),
        reviewedBy: new Types.ObjectId(reviewerId),
        rejectReason: normalizedRejectReason,
      };
    } else {
      clearCurrentLicenseRejectReason(manga);
      (manga as any).verifiedBadge = true;

      (manga as any).rights = {
        ...rights,
        reviewStatus: RightsReviewStatus.APPROVED,
        reviewedAt: new Date(),
        reviewedBy: new Types.ObjectId(reviewerId),
        rejectReason: '',
      };

      if (publishAfterApprove) {
        const eligibility = evaluatePublishEligibility(manga);
        if (!eligibility.canPublish) {
          throw new BadRequestException(
            eligibility.reason || 'Story does not meet publish policy',
          );
        }

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
      rightsStatus: getMergedRights(manga).reviewStatus,
      verifiedBadge: Boolean((manga as any).verifiedBadge),
    };
  }

  async getLicenseStatus(mangaId: string) {
    if (!Types.ObjectId.isValid(mangaId)) {
      throw new BadRequestException('Invalid mangaId');
    }

    const manga = await this.mangaModel
      .findById(mangaId)
      .select(
        'licenseStatus licenseRejectReason licenseRejectReasons licenseSubmittedAt licenseReviewedAt rights verifiedBadge enforcementStatus isPublish',
      )
      .lean();

    if (!manga) throw new NotFoundException('Manga not found');

    const rights = getMergedRights(manga);
    const eligibility = evaluatePublishEligibility(manga as any);

    return {
      licenseStatus: (manga as any).licenseStatus,
      licenseRejectReason: (manga as any).licenseRejectReason ?? '',
      licenseRejectReasons: getLicenseRejectReasonHistory(manga),
      licenseSubmittedAt: (manga as any).licenseSubmittedAt ?? null,
      licenseReviewedAt: (manga as any).licenseReviewedAt ?? null,
      verifiedBadge: Boolean((manga as any).verifiedBadge),
      rightsStatus: rights.reviewStatus,
      originType: rights.originType,
      monetizationType: rights.monetizationType,
      rightsBasis: rights.basis,
      declarationAccepted: Boolean(rights.declarationAccepted),
      canPublish: eligibility.canPublish,
      publishReason: eligibility.reason,
      isPublish: Boolean((manga as any).isPublish),
      enforcementStatus: resolveEnforcementStatus(
        (manga as any).enforcementStatus,
      ),
    };
  }

  async updateStoryRights(
    mangaId: string,
    actorId: string,
    dto: UpdateStoryRightsDto,
    actorRole?: string,
  ) {
    if (!Types.ObjectId.isValid(mangaId)) {
      throw new BadRequestException('Invalid mangaId');
    }
    if (!Types.ObjectId.isValid(actorId)) {
      throw new BadRequestException('Invalid actorId');
    }

    const manga = await this.mangaModel.findById(mangaId);
    if (!manga) throw new NotFoundException('Manga not found');

    if (!canManageStoryRights(manga, actorId, actorRole)) {
      throw new BadRequestException(
        'You do not have permission to update rights',
      );
    }

    const currentRights = getMergedRights(manga);

    const nextRights: MangaRights = {
      ...currentRights,
      originType: dto.originType,
      monetizationType: dto.monetizationType,
      basis: dto.basis,
      sourceTitle: dto.sourceTitle ?? '',
      sourceUrl: dto.sourceUrl ?? '',
      licenseName: dto.licenseName ?? '',
      licenseUrl: dto.licenseUrl ?? '',
    };

    if (isStrictReviewCase(nextRights)) {
      if (
        Array.isArray(nextRights.proofFiles) &&
        nextRights.proofFiles.length > 0
      ) {
        nextRights.reviewStatus = RightsReviewStatus.PENDING;
      } else {
        nextRights.reviewStatus = RightsReviewStatus.NOT_REQUIRED;
      }

      nextRights.reviewedAt = null;
      nextRights.reviewedBy = null;
      nextRights.rejectReason = '';
      clearCurrentLicenseRejectReason(manga);

      (manga as any).verifiedBadge = false;

      if ((manga as any).isPublish) {
        (manga as any).isPublish = false;
      }
    } else {
      nextRights.reviewStatus = derivePassiveReviewStatus(nextRights);
      nextRights.reviewedAt = null;
      nextRights.reviewedBy = null;
      nextRights.rejectReason = '';
      clearCurrentLicenseRejectReason(manga);

      (manga as any).verifiedBadge = false;
    }

    (manga as any).rights = nextRights;
    syncLegacyLicenseFromRights(manga);

    const eligibility = evaluatePublishEligibility(manga);
    if ((manga as any).isPublish && !eligibility.canPublish) {
      (manga as any).isPublish = false;
    }

    await manga.save();
    return serializeStoryRights(manga);
  }

  async acceptRightsDeclaration(
    mangaId: string,
    actorId: string,
    dto: AcceptRightsDeclarationDto,
    actorRole?: string,
  ) {
    if (!Types.ObjectId.isValid(mangaId)) {
      throw new BadRequestException('Invalid mangaId');
    }
    if (!Types.ObjectId.isValid(actorId)) {
      throw new BadRequestException('Invalid actorId');
    }

    const manga = await this.mangaModel.findById(mangaId);
    if (!manga) throw new NotFoundException('Manga not found');

    if (!canManageStoryRights(manga, actorId, actorRole)) {
      throw new BadRequestException(
        'You do not have permission to update rights',
      );
    }

    const rights = getMergedRights(manga);

    if (rights.originType === StoryOriginType.UNKNOWN) {
      rights.originType = StoryOriginType.ORIGINAL;
    }

    if (rights.basis === RightsBasis.UNKNOWN) {
      rights.basis = RightsBasis.SELF_DECLARATION;
    }

    rights.declarationAccepted = Boolean(dto.accepted);
    rights.declarationVersion = dto.declarationVersion?.trim() || 'v1';
    rights.declarationAcceptedAt = dto.accepted ? new Date() : null;

    rights.reviewStatus = derivePassiveReviewStatus(rights);

    if (rights.reviewStatus !== RightsReviewStatus.APPROVED) {
      (manga as any).verifiedBadge = false;
    }

    clearCurrentLicenseRejectReason(manga);
    (manga as any).rights = rights;
    syncLegacyLicenseFromRights(manga);

    const eligibility = evaluatePublishEligibility(manga);
    if ((manga as any).isPublish && !eligibility.canPublish) {
      (manga as any).isPublish = false;
    }

    await manga.save();
    return serializeStoryRights(manga);
  }

  async getStoryRights(
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
      .select(
        'title authorId isPublish licenseStatus licenseRejectReason licenseRejectReasons licenseSubmittedAt licenseReviewedAt rights verifiedBadge enforcementStatus',
      );

    if (!manga) throw new NotFoundException('Manga not found');

    if (!canManageStoryRights(manga, actorId, actorRole)) {
      throw new BadRequestException('You do not have permission to view rights');
    }

    return serializeStoryRights(manga);
  }
}
