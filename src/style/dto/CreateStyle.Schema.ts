import { IsString, IsOptional } from 'class-validator';

export class CreateStyleDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;
}
