import { IsString, IsEnum, IsOptional, IsBoolean, IsDateString } from 'class-validator';

export enum MainType {
  TERM = 'TERM',
  PRIVACY = 'PRIVACY',
}

export enum StatusType {
  Draft = 'Draft',
  Active = 'Active',
  Archived = 'Archived',
}

export class CreatePoliciesDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsEnum(MainType)
  mainType: MainType;

  @IsString()
  @IsOptional()
  subCategory?: 'posting' | 'comment' | 'account' | 'general' | 'data_usage';

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  content: string;

  @IsEnum(StatusType)
  @IsOptional()
  status?: StatusType;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @IsDateString()
  @IsOptional()
  effective_from?: Date;

  @IsDateString()
  @IsOptional()
  effective_to?: Date;
}
