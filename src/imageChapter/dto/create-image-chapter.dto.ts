import { IsString, IsOptional, IsNumber, IsBoolean, IsMongoId } from "class-validator"
import { Transform } from "class-transformer"

export class CreateImageChapterDto {
    @IsString()
    title: string

    @IsMongoId()
    manga_id: string

    @IsOptional()
    @IsNumber()
    @Transform(({ value }) => Number(value))
    price?: number

    @IsOptional()
    @IsNumber()
    @Transform(({ value }) => Number(value))
    order?: number

    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => value === "true" || value === true)
    is_published?: boolean

    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => value === "true" || value === true)
    is_completed?: boolean

    @IsOptional()
    @IsString()
    content?: string
}
