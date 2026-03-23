import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadLicenseDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
