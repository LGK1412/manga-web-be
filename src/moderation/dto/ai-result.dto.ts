import { IsArray, IsIn, IsMongoId, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ModeratorAdviceDto {
  @IsIn(['approve', 'request_changes', 'reject', 'escalate'])
  nextStep: 'approve' | 'request_changes' | 'reject' | 'escalate';

  @IsString()
  reason: string;

  @IsArray()
  checks: string[];
}

class AuthorAdviceDto {
  @IsString()
  revisionGoal: string;

  @IsArray()
  revisionSteps: string[];

  @IsOptional()
  @IsString()
  noteDraft?: string;
}

class FindingAdviceDto {
  @ValidateNested()
  @Type(() => ModeratorAdviceDto)
  moderator: ModeratorAdviceDto;

  @ValidateNested()
  @Type(() => AuthorAdviceDto)
  author: AuthorAdviceDto;
}

class FindingDto {
  @IsString() sectionId: string;
  @IsIn(['pass','warn','block']) verdict: 'pass'|'warn'|'block';
  @IsString() rationale: string;
  @IsOptional() @IsString() policySlug?: string;
  @IsOptional() @IsString() policyTitle?: string;
  @IsOptional() @IsIn(['low','medium','high']) severity?: 'low'|'medium'|'high';
  @IsOptional() @ValidateNested() @Type(() => FindingAdviceDto) advice?: FindingAdviceDto;
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
