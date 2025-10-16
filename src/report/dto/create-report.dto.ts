import { IsEnum, IsMongoId, IsOptional, IsString } from 'class-validator'

export class CreateReportDto {
  /** 👤 Người gửi report */
  @IsMongoId()
  reporter_id: string

  /** 🎯 Loại nội dung bị report */
  @IsEnum(['Manga', 'Chapter', 'Comment'])
  target_type: 'Manga' | 'Chapter' | 'Comment'

  /** 🆔 ID của nội dung bị report */
  @IsMongoId()
  target_id: string

  /** ⚠️ Lý do report */
  @IsEnum(['Spam', 'Copyright', 'Inappropriate', 'Harassment', 'Other'])
  reason: 'Spam' | 'Copyright' | 'Inappropriate' | 'Harassment' | 'Other'

  /** 📝 Mô tả chi tiết (tuỳ chọn) */
  @IsOptional()
  @IsString()
  description?: string
}
