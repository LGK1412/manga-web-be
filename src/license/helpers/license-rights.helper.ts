import fs from 'fs';
import crypto from 'crypto';
import { extname, join } from 'path';

import {
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
import { Role } from 'src/common/enums/role.enum';

export function getDefaultRights(): MangaRights {
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

export function getMergedRights(manga: MangaDocument | any): MangaRights {
  return {
    ...getDefaultRights(),
    ...(((manga as any)?.rights ?? {}) as Partial<MangaRights>),
  };
}

export function canManageStoryRights(
  manga: MangaDocument | any,
  actorId: string,
  actorRole?: string,
) {
  return (
    actorRole === Role.ADMIN ||
    String((manga as any).authorId) === String(actorId)
  );
}

export function isStrictReviewCase(rights: MangaRights) {
  return (
    rights.originType === StoryOriginType.TRANSLATED ||
    rights.originType === StoryOriginType.ADAPTED ||
    rights.originType === StoryOriginType.REPOST ||
    rights.basis === RightsBasis.OWNER_AUTHORIZATION ||
    rights.basis === RightsBasis.PUBLISHER_CONTRACT
  );
}

export function derivePassiveReviewStatus(
  rights: MangaRights,
): RightsReviewStatus {
  if (rights.claimStatus === CopyrightClaimStatus.OPEN) {
    return RightsReviewStatus.UNDER_CLAIM;
  }

  if (
    rights.basis === RightsBasis.SELF_DECLARATION &&
    rights.declarationAccepted
  ) {
    return RightsReviewStatus.DECLARED;
  }

  if (
    rights.originType === StoryOriginType.CC_LICENSED &&
    rights.sourceUrl &&
    rights.licenseUrl
  ) {
    return RightsReviewStatus.DECLARED;
  }

  if (
    rights.originType === StoryOriginType.PUBLIC_DOMAIN &&
    rights.sourceUrl
  ) {
    return RightsReviewStatus.DECLARED;
  }

  return RightsReviewStatus.NOT_REQUIRED;
}

export function syncLegacyLicenseFromRights(manga: MangaDocument | any) {
  const rights = getMergedRights(manga);

  switch (rights.reviewStatus) {
    case RightsReviewStatus.PENDING:
    case RightsReviewStatus.UNDER_CLAIM:
      (manga as any).licenseStatus = MangaLicenseStatus.PENDING;
      break;

    case RightsReviewStatus.APPROVED:
      (manga as any).licenseStatus = MangaLicenseStatus.APPROVED;
      break;

    case RightsReviewStatus.REJECTED:
      (manga as any).licenseStatus = MangaLicenseStatus.REJECTED;
      break;

    default:
      if ((manga as any).licenseStatus !== MangaLicenseStatus.APPROVED) {
        (manga as any).licenseStatus = MangaLicenseStatus.NONE;
      }
      break;
  }
}

export function resolveEnforcementStatus(
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

export function evaluatePublishEligibility(manga: MangaDocument | any) {
  const rights = getMergedRights(manga);
  const enforcementStatus = resolveEnforcementStatus(
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

  if ((manga as any).licenseStatus === MangaLicenseStatus.APPROVED) {
    return {
      canPublish: true,
      requiresReview: false,
      reason: null,
    };
  }

  if (
    rights.originType === StoryOriginType.ORIGINAL &&
    rights.basis === RightsBasis.SELF_DECLARATION &&
    rights.declarationAccepted
  ) {
    return {
      canPublish: true,
      requiresReview: false,
      reason: null,
    };
  }

  if (isStrictReviewCase(rights)) {
    return {
      canPublish: rights.reviewStatus === RightsReviewStatus.APPROVED,
      requiresReview: true,
      reason:
        rights.reviewStatus === RightsReviewStatus.APPROVED
          ? null
          : 'Proof of rights must be approved before publishing',
    };
  }

  if (rights.originType === StoryOriginType.CC_LICENSED) {
    const ok =
      !!rights.sourceUrl &&
      !!rights.licenseUrl &&
      (rights.reviewStatus === RightsReviewStatus.DECLARED ||
        rights.reviewStatus === RightsReviewStatus.APPROVED);

    return {
      canPublish: ok,
      requiresReview: false,
      reason: ok ? null : 'Source URL and license URL are required',
    };
  }

  if (rights.originType === StoryOriginType.PUBLIC_DOMAIN) {
    const ok =
      !!rights.sourceUrl &&
      (rights.reviewStatus === RightsReviewStatus.DECLARED ||
        rights.reviewStatus === RightsReviewStatus.APPROVED ||
        rights.reviewStatus === RightsReviewStatus.NOT_REQUIRED);

    return {
      canPublish: ok,
      requiresReview: false,
      reason: ok ? null : 'Source reference is required',
    };
  }

  return {
    canPublish: false,
    requiresReview: false,
    reason: 'Story rights information is incomplete',
  };
}

export function serializeStoryRights(manga: MangaDocument | any) {
  const rights = getMergedRights(manga);
  const eligibility = evaluatePublishEligibility(manga);

  return {
    _id: (manga as any)._id,
    title: (manga as any).title,
    authorId: (manga as any).authorId,
    isPublish: Boolean((manga as any).isPublish),
    verifiedBadge: Boolean((manga as any).verifiedBadge),
    enforcementStatus: resolveEnforcementStatus(
      (manga as any).enforcementStatus,
    ),
    licenseStatus: (manga as any).licenseStatus,
    licenseRejectReason: (manga as any).licenseRejectReason ?? '',
    licenseSubmittedAt: (manga as any).licenseSubmittedAt ?? null,
    licenseReviewedAt: (manga as any).licenseReviewedAt ?? null,
    rights,
    rightsStatus: rights.reviewStatus,
    publishEligibility: eligibility,
  };
}

export function genFileName(originalName: string) {
  const ext = extname(originalName || '').toLowerCase();
  const safeExt = ext && ext.length <= 8 ? ext : '';
  return `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${safeExt}`;
}

export async function unlinkSafe(absPath: string) {
  await fs.promises.unlink(absPath).catch(() => {});
}

export function toAbsFromRel(rel: string) {
  return join('public', rel.replace(/^\/?/, ''));
}

export function normalizeCoverImage(path?: string | null) {
  if (!path) return '';
  if (
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('/')
  ) {
    return path;
  }
  return `/assets/coverImages/${path}`;
}

export function normalizeAssetPath(path?: string | null) {
  if (!path) return '';
  if (
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('/')
  ) {
    return path;
  }
  return `/${path.replace(/^\/+/, '')}`;
}