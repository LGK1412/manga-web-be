import { IsEmail, IsNotEmpty, IsString } from "class-validator"

export class SendVerifyEmailDto {
    @IsString()
    @IsNotEmpty()
    @IsEmail()
    email: string
}
