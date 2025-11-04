import { IsMongoId, IsOptional, IsString } from "class-validator";

export class IdWithUserDto {
  @IsString()
  @IsMongoId()
  id!: string;

  @IsOptional()
  @IsString()
  @IsMongoId()
  user_id?: string; // nếu không truyền sẽ lấy từ JWT
}
