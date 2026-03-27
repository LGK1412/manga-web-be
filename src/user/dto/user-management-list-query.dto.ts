import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export class UserManagementListQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  role?: string = "all";

  @IsOptional()
  @IsString()
  status?: string = "all";

  @IsOptional()
  @IsIn(["all", "staff", "new-7d"])
  preset?: "all" | "staff" | "new-7d" = "all";

  @IsOptional()
  @IsIn(["name", "email", "role", "status", "joinDate", "lastActivityAt"])
  sortBy?:
    | "name"
    | "email"
    | "role"
    | "status"
    | "joinDate"
    | "lastActivityAt" = "role";

  @IsOptional()
  @IsIn(["asc", "desc"])
  sortDir?: "asc" | "desc" = "asc";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
