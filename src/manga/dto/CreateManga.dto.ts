import { IsString, IsArray, IsOptional, IsBoolean, IsEnum, IsMongoId } from 'class-validator';
import { Transform } from 'class-transformer';
import { Types } from 'mongoose';

export class CreateMangaDto {
  @IsString()
  title: string;

  @IsString()
  summary: string;

  @IsArray()
  @IsMongoId({ each: true })
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
      return [value];
    }
    return value;
  })
  genres: Types.ObjectId[];

  @IsEnum(['ongoing', 'completed', 'hiatus'])
  @IsOptional()
  status?: string;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === 1 || value === '1')
  isPublish?: boolean;

  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
      return [value];
    }
    return value;
  })
  styles?: Types.ObjectId[];

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === 1 || value === '1')
  isDraft?: boolean;

  @IsString()
  @IsOptional()
  coverImage?: string;
}