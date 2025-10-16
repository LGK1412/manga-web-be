import { IsString, IsEnum, IsOptional, IsBoolean, IsDateString } from 'class-validator';

export class CreatePoliciesDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional() // ✅ Cho phép không gửi slug
  slug?: string;

  @IsEnum(['Policy', 'Terms', 'Guidelines', 'Internal'])
  type: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  content: string;

  @IsEnum(['Draft', 'Active', 'Archived'])
  @IsOptional()
  status?: 'Draft' | 'Active' | 'Archived';

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
