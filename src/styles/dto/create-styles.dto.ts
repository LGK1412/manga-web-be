import { IsString, IsOptional, IsEnum } from 'class-validator';

export class CreateStylesDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['normal', 'hide'])
  @IsOptional()
  status?: 'normal' | 'hide';
}







