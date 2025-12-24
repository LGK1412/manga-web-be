import { IsString, IsOptional, IsNumber, IsBoolean, IsArray } from "class-validator"
import { Transform } from "class-transformer"

export class UpdateImageChapterDto {
    @IsOptional()
    @IsString()
    title?: string

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

    @IsOptional()
    @IsArray()
    existing_images?: Array<{ url: string; order: number }>
<<<<<<< HEAD

    @IsOptional()
    @IsArray()
    new_images_meta?: Array<{ originalname: string; order: number }>
=======
>>>>>>> 3f8d1601729612b33900753c573783070fc330f5
}
