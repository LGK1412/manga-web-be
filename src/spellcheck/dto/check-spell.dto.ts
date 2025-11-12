import { IsString, IsOptional } from 'class-validator';

export class CheckSpellDto {
  @IsString()
  text: string;

  @IsOptional()
  @IsString()
  language?: string;
}

export interface SpellError {
  word: string;
  offset: number;
  length: number;
  suggestions: string[];
}

export class CheckSpellResponseDto {
  original: string;
  errors: SpellError[];
}










