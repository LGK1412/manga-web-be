import { IsMongoId, IsOptional, IsString } from "class-validator";

export class MarkAllReadDto {
  @IsOptional()
  @IsString()
  @IsMongoId()
  user_id?: string; // nếu không truyền sẽ lấy từ JWT
}
