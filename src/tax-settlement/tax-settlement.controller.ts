import { Controller, Get, Param, Query } from '@nestjs/common';
import { TaxSettlementService } from './tax-settlement.service';

@Controller('api/tax')
export class TaxSettlementController {
  constructor(private readonly taxSettlementService: TaxSettlementService) { }

}
