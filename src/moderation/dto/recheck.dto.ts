import { IsMongoId, IsOptional, IsString } from 'class-validator';

export class RecheckDto {
  @IsMongoId() chapterId: string;
  @IsOptional() @IsString() policyVersion?: string;
  @IsOptional() @IsString() contentHash?: string;
}
