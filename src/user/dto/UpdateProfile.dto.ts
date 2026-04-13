import { Transform } from "class-transformer"
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator"

export class UpdateProfileDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(3, { message: "Tên người dùng phải có ít nhất 3 ký tự" })
  @MaxLength(50, { message: "Tên người dùng không được vượt quá 50 ký tự" })
  username?: string

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  bio?: string;
}
