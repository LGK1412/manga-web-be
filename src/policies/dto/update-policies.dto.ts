
import { PartialType } from '@nestjs/mapped-types';
import { CreatePoliciesDto } from './create-policies.dto';

export class UpdatePoliciesDto extends PartialType(CreatePoliciesDto) {}
