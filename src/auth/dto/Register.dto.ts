import { IsEmail, IsNotEmpty, IsOptional, IsString, Length } from "class-validator"

export class RegisterDto {
    @IsString()
    @IsNotEmpty()
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