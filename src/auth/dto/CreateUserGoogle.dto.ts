import { Transform } from "class-transformer"
import { IsBoolean, IsEmail, IsNotEmpty, IsString, Length, Matches, MinLength, MaxLength } from "class-validator"

export class CreateUserGoogleDto {
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @IsString()
    @IsNotEmpty()
    @MinLength(3, { message: "Tên người dùng phải có ít nhất 3 ký tự" })
    @MaxLength(50, { message: "Tên người dùng không được vượt quá 50 ký tự" })
    @Matches(/^[^\r\n]*$/, { message: "Tên người dùng không được chứa xuống dòng" })
    username: string

    @IsString()
    @IsNotEmpty()
    @IsEmail()
    email: string

    @IsString()
    @IsNotEmpty()
    avatar: string

    @IsBoolean()
    @IsNotEmpty()
    verified: boolean

    @IsString()
    @IsNotEmpty()
    google_id: string
}