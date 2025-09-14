import { IsString, IsArray, IsOptional, IsBoolean, IsEnum } from 'class-validator';

export class CreateMangaDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsArray()
  @IsString({ each: true })
  genres: string[];

  @IsEnum(['ongoing', 'completed', 'hiatus'])
  @IsOptional()
  status?: string;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @IsEnum(['text', 'image'])
  type: 'text' | 'image';

  @IsBoolean()
  @IsOptional()
  isDraft?: boolean;
}