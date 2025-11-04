import { IsMongoId, IsOptional, IsString } from "class-validator";

export class MarkReadDto {
  @IsString()
  @IsMongoId()
  id!: string; // notification _id

  @IsOptional()
  @IsString()
  @IsMongoId()
  user_id?: string; // nếu không truyền sẽ lấy từ JWT
}
