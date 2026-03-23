import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import {
  RightsBasis,
  StoryMonetizationType,
  StoryOriginType,
} from '../../schemas/Manga.schema';

const trimOrUndefined = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

export class UpdateStoryRightsDto {
  @IsEnum(StoryOriginType)
  originType: StoryOriginType;

  @IsEnum(StoryMonetizationType)
  monetizationType: StoryMonetizationType;

  @IsEnum(RightsBasis)
  basis: RightsBasis;

  @IsOptional()
  @Transform(trimOrUndefined)
  @IsString()
  @MaxLength(255)
  sourceTitle?: string;

  @IsOptional()
  @Transform(trimOrUndefined)
  @IsUrl(
    { require_protocol: true },
    { message: 'sourceUrl must be a URL address' },
  )
  sourceUrl?: string;

  @IsOptional()
  @Transform(trimOrUndefined)
  @IsString()
  @MaxLength(255)
  licenseName?: string;

  @IsOptional()
  @Transform(trimOrUndefined)
  @IsUrl(
    { require_protocol: true },
    { message: 'licenseUrl must be a URL address' },
  )
  licenseUrl?: string;
}
