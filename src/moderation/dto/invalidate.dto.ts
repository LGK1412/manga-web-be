import { IsMongoId, IsString } from 'class-validator';

export class InvalidateDto {
  @IsMongoId() chapterId: string;
  @IsString() contentHash: string; // hash mới sau khi sửa
}
