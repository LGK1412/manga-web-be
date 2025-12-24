import { PartialType } from '@nestjs/mapped-types'
import { CreateReportDto } from './create-report.dto'
import { IsEnum, IsOptional, IsString, IsMongoId } from 'class-validator'

export class UpdateReportDto extends PartialType(CreateReportDto) {
  @IsOptional()
  @IsEnum(['new', 'in-progress', 'resolved', 'rejected'])
  status?: 'new' | 'in-progress' | 'resolved' | 'rejected'

  @IsOptional()
  @IsMongoId()
  resolver_id?: string

  @IsOptional()
  @IsString()
  resolution_note?: string
}
