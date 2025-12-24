import { IsIn, IsMongoId, IsOptional, IsString } from 'class-validator';

export class DecideDto {
  @IsMongoId() chapterId: string;
  @IsIn(['approve','reject','request_changes']) action: 'approve'|'reject'|'request_changes';
  @IsOptional() @IsString() note?: string;
}
