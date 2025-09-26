import { IsString, IsOptional, IsEnum } from 'class-validator';

export class UpdateGenreDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['normal', 'hide'])
  @IsOptional()
  status?: 'normal' | 'hide';
}
