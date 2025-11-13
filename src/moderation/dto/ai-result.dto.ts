import { IsArray, IsIn, IsMongoId, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class FindingDto {
  @IsString() sectionId: string;
  @IsIn(['pass','warn','block']) verdict: 'pass'|'warn'|'block';
  @IsString() rationale: string;
  @IsOptional() spans?: { start: number; end: number }[];
}

export class AiResultDto {
  @IsMongoId() chapterId: string;
  @IsIn(['AI_PASSED','AI_WARN','AI_BLOCK']) status: 'AI_PASSED'|'AI_WARN'|'AI_BLOCK';
  @IsNumber() risk_score: number;
  @IsString() policy_version: string;
  @IsString() ai_model: string;
  @IsString() content_hash: string;
  @IsArray() labels: string[];

  @ValidateNested({ each: true }) @Type(() => FindingDto)
  ai_findings: FindingDto[];
}
