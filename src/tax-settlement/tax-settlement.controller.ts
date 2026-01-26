import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { TaxSettlementService } from './tax-settlement.service';
import { Roles } from 'src/common/decorators/roles.decorator';
import { AccessTokenGuard } from 'src/common/guards/access-token.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Role } from 'src/common/enums/role.enum';

@Controller('api/tax')
export class TaxSettlementController {
  constructor(private readonly taxSettlementService: TaxSettlementService) { }

  @Get()
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.FINANCIAL_MANAGER)
  async getAllWithdraws() {
    return this.taxSettlementService.getAllAuthorTax();
  }

  @Get('summary')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.FINANCIAL_MANAGER)
  async getTaxSummary(
    @Query('month') month: number,
    @Query('year') year: number,
  ) {
    return this.taxSettlementService.getTaxSummary(
      Number(month),
      Number(year),
    );
  }

  @Get('platform')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.FINANCIAL_MANAGER)
  async getPlatformTax(
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    const m = Number(month);
    const y = Number(year);

    if (!m || !y) {
      throw new BadRequestException('Month và Year là bắt buộc');
    }

    return this.taxSettlementService.getPlatformTaxByPeriod(m, y);
  }

  @Post('declare')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.FINANCIAL_MANAGER)
  async declareTax(
    @Body('month') month: number,
    @Body('year') year: number,
  ) {
    return this.taxSettlementService.declareTaxWithPlatform(month, year);
  }

  @Patch('pay')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.FINANCIAL_MANAGER)
  async markPaid(
    @Body('month') month: number,
    @Body('year') year: number,
  ) {
    return this.taxSettlementService.markTaxAsPaid(month, year);
  }
}
