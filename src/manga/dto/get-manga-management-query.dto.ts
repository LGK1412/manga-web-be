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