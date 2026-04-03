import { IsEnum, IsOptional, IsString } from 'class-validator'

export class UpdateReportDto {
  @IsOptional()
  @IsEnum(['in-progress', 'resolved', 'rejected'])
  status?: 'in-progress' | 'resolved' | 'rejected'

  @IsOptional()
  @IsString()
  note?: string

  @IsOptional()
  @IsString()
  resolution_note?: string

  @IsOptional()
  @IsEnum(['none', 'warning_sent', 'user_banned', 'user_muted'])
  resolution_action?: 'none' | 'warning_sent' | 'user_banned' | 'user_muted'
}
