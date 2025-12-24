import { IsOptional, IsString, IsNumber, IsBoolean } from 'class-validator';

export interface EligibilityCriteria {
  id: string;
  label: string;
  required: number;
  actual: number;
  met: boolean;
}

export interface AuthorRequestStatusResponse {
  status: 'none' | 'pending' | 'approved';
  requestedAt?: string;
  approvedAt?: string;
  autoApproved?: boolean;
  criteria: EligibilityCriteria[];
  canRequest: boolean;
  message?: string;
}





