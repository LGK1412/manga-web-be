import { IsMongoId, IsOptional, IsString, MaxLength } from "class-validator";

export class AdminResetUserStatusDto {
  @IsMongoId()
  userId: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
