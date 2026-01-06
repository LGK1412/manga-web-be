import { IsEmail, IsNotEmpty, IsOptional, IsString, Length, Matches, MinLength, MaxLength } from "class-validator"

export class RegisterDto {
    @IsString()
    @IsNotEmpty()
    @MinLength(3, { message: "Tên người dùng phải có ít nhất 3 ký tự" })
    @MaxLength(30, { message: "Tên người dùng không được vượt quá 30 ký tự" })
    @Matches(/^[a-zA-Z0-9_]+$/, { message: "Tên người dùng chỉ được chứa chữ cái, số và dấu gạch dưới" })
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