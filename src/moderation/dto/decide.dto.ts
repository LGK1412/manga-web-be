import { IsIn, IsMongoId, IsOptional, IsString } from 'class-validator';

export class DecideDto {
  @IsMongoId() chapterId: string;
  @IsIn(['approve','reject']) action: 'approve'|'reject';
  @IsOptional() @IsString() note?: string;
}
