import { Transform } from "class-transformer"
import { IsEmail, IsNotEmpty, IsString, Length, Matches, MinLength, MaxLength } from "class-validator"

export class RegisterDto {
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @IsString()
    @IsNotEmpty({ message: "Tên người dùng không được để trống" })
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
    @Length(6, 20, { message: "Mật khẩu từ 6 đến 20 ký tự" })
    password: string

}