import { IsMongoId, IsOptional, IsString } from 'class-validator';

export class SubmitDto {
  @IsMongoId() chapterId: string;
  @IsOptional() @IsString() policyVersion?: string; // FE có thể gửi version active
  @IsOptional() @IsString() contentHash?: string;   // hash trước khi FE chạy AI
}
