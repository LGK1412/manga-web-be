import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { MangaLicenseStatus } from '../../schemas/Manga.schema';

export class ReviewLicenseDto {
  @IsIn([MangaLicenseStatus.APPROVED, MangaLicenseStatus.REJECTED])
  status: MangaLicenseStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectReason?: string;

  // ✅ New: approve xong có publish luôn để user thấy badge + truyện public
  @IsOptional()
  @IsBoolean()
  publishAfterApprove?: boolean;
}