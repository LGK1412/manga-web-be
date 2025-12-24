import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, Length } from "class-validator"

export class CreateUserGoogleDto {
    @IsString()
    @IsNotEmpty()
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