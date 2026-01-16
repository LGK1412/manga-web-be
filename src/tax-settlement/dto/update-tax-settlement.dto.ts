import { PartialType } from '@nestjs/mapped-types';
import { CreateTaxSettlementDto } from './create-tax-settlement.dto';

export class UpdateTaxSettlementDto extends PartialType(CreateTaxSettlementDto) {}
