import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class GetMangaManagementQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(['all', 'none', 'pending', 'approved', 'rejected'])
  licenseStatus?: 'all' | 'none' | 'pending' | 'approved' | 'rejected' = 'all';

  @IsOptional()
  @IsIn(['all', 'draft', 'published', 'unpublished'])
  publicationStatus?: 'all' | 'draft' | 'published' | 'unpublished' = 'all';

  @IsOptional()
  @IsIn(['all', 'normal', 'suspended', 'banned'])
  enforcementStatus?: 'all' | 'normal' | 'suspended' | 'banned' = 'all';

  @IsOptional()
  @IsIn([
    'all',
    'original',
    'translated',
    'adapted',
    'repost',
    'cc_licensed',
    'public_domain',
    'unknown',
  ])
  originType?:
    | 'all'
    | 'original'
    | 'translated'
    | 'adapted'
    | 'repost'
    | 'cc_licensed'
    | 'public_domain'
    | 'unknown' = 'all';

  @IsOptional()
  @IsIn(['all', 'free', 'paid'])
  monetizationType?: 'all' | 'free' | 'paid' = 'all';

  @IsOptional()
  @IsIn([
    'all',
    'not_required',
    'declared',
    'pending',
    'approved',
    'rejected',
    'under_claim',
  ])
  rightsStatus?:
    | 'all'
    | 'not_required'
    | 'declared'
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'under_claim' = 'all';

  @IsOptional()
  @IsIn(['all', 'none', 'open', 'resolved'])
  claimStatus?: 'all' | 'none' | 'open' | 'resolved' = 'all';

  @IsOptional()
  @IsMongoId()
  authorId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}