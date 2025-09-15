import { IsString, IsArray, IsOptional, IsBoolean, IsEnum, IsMongoId } from 'class-validator';
import { Types } from 'mongoose';

export class CreateMangaDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsArray()
  @IsMongoId({ each: true })
  genres: Types.ObjectId[];

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