import { IsString, IsOptional } from 'class-validator';

export class CreateGenreDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;
}
