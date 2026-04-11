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
    @Transform(({ value }) => {
        if (typeof value === "string") {
            try {
                return JSON.parse(value)
            } catch {
                return []
            }
        }
        return value || []
    })
    kept_images?: string[]
}
