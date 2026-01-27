import { IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';

export class ModBanUserDto {
  @IsMongoId()
  userId: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class ModMuteUserDto {
  @IsMongoId()
  userId: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
