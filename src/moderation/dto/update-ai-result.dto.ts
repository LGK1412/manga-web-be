import { IsBoolean, IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateAiResultDto {
  @IsIn(['PASSED', 'WARN', 'BLOCK'])
  verdict: 'PASSED' | 'WARN' | 'BLOCK';

  @IsOptional()
  @IsNumber()
  risk_score?: number; // 0..100 (tuỳ FE)

  @IsOptional()
  @IsString()
  policy_version?: string; // ví dụ 'tos-2025.11'

  @IsOptional()
  @IsString()
  last_content_hash?: string; // FE băm nội dung để chống lệch phiên bản

  // Cho phép auto-unpublish nếu BLOCK (tùy chọn)
  @IsOptional()
  @IsBoolean()
  force_unpublish_if_block?: boolean;
}
