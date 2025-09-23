import { IsOptional, IsArray, ValidateNested, IsString, IsNumber, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

class ExistingImageDto {
    @IsString()
    url: string;

    @IsNumber()
    order: number;
}

export class UpdateImageChapterDto {
    @IsOptional()
    @IsString()
    title?: string;

    @IsOptional()
    @IsNumber()
    price?: number;

    @IsOptional()
    @IsNumber()
    order?: number;

    @IsOptional()
    @IsBoolean()
    is_published?: boolean;

    @IsOptional()
    @IsBoolean()
    is_completed?: boolean;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ExistingImageDto)
    existing_images?: ExistingImageDto[];
}
