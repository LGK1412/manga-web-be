import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class BulkUserActionDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsMongoId({ each: true })
  userIds: string[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
