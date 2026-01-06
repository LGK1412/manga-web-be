import { IsNotEmpty, IsString, Length } from "class-validator"

export class ChangePasswordDto {
    @IsString()
    @IsNotEmpty()
    @Length(6, 20, { message: "Mật khẩu từ 6 đến 20 ký tự" })
    password: string
}


