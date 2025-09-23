import {
    IsString,
    IsBoolean,
    IsNumber,
    IsNotEmpty,
    IsOptional,
    IsMongoId,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateImageChapterDto {
    @IsNotEmpty()
    @IsString()
    title: string;

    @IsNotEmpty()
    @IsMongoId()
    manga_id: string;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    price?: number = 0;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    order?: number = 1;

    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => value === 'true' || value === true)
    is_published?: boolean = false;

    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => value === 'true' || value === true)
    is_completed?: boolean = false;
}
