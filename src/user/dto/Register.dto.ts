import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator"

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
    password: string
}