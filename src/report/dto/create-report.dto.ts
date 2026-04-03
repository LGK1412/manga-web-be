import { IsEnum, IsMongoId, IsOptional, IsString } from 'class-validator'

export class CreateReportDto {
  @IsEnum(['Manga', 'Chapter', 'Comment', 'Reply'])
  target_type: 'Manga' | 'Chapter' | 'Comment' | 'Reply'

  @IsMongoId()
  target_id: string

  @IsEnum(['Spam', 'Copyright', 'Inappropriate', 'Harassment', 'Offense', 'Other'])
  reason: 'Spam' | 'Copyright' | 'Inappropriate' | 'Harassment' | 'Offense' | 'Other'

  @IsOptional()
  @IsString()
  description?: string
}
