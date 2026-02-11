import { IsOptional, IsString, MaxLength } from "class-validator";

export class UploadMangaLicenseDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
