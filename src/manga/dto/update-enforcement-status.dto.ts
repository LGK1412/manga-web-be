import { IsEnum, IsOptional, IsString } from 'class-validator';
import { MangaEnforcementStatus } from 'src/schemas/Manga.schema';

export class UpdateEnforcementStatusDto {
  @IsEnum(MangaEnforcementStatus)
  status: MangaEnforcementStatus;

  @IsOptional()
  @IsString()
  reason?: string;
}