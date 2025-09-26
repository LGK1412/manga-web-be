import { IsString, IsOptional, IsEnum } from 'class-validator';

export class UpdateStyleDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['active', 'inactive'])
  @IsOptional()
  status?: 'active' | 'inactive';
}
