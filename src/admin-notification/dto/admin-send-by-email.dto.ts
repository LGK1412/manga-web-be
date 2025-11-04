// src/admin-notification/dto/admin-send-by-email.dto.ts
import { IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class AdminSendByEmailDto {
  @IsOptional()
  @IsString()
  receiver_id?: string;          // giữ tương thích: có thể gửi theo _id như cũ

  @IsOptional()
  @IsEmail()
  receiver_email?: string;       // mới: gửi theo email

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  body!: string;
}
