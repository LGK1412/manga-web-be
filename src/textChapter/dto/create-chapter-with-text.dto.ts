import {
  IsString,
  IsBoolean,
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsMongoId,
} from 'class-validator';

export class CreateChapterWithTextDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsMongoId()
  manga_id: string;

  @IsOptional()
  @IsNumber()
  price?: number = 0;

  @IsOptional()
  @IsNumber()
  order?: number = 1;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean = false;

  @IsNotEmpty()
  @IsString()
  content: string;

  @IsOptional()
  @IsBoolean()
  is_completed?: boolean = false;
}
