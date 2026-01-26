import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { TopupService } from './topup.service';
import { AccessTokenGuard } from 'src/common/guards/access-token.guard';

@Controller('api/topup')
export class TopupController {
  constructor(private readonly topupService: TopupService) { }

  @Get('packages')
  @UseGuards(AccessTokenGuard)
  async getPackages(@Req() req: Request) {
    const user = req['user'];
    return this.topupService.getPackagesWithBonus(user.user_id);
  }

  @Get('bonus-status')
  @UseGuards(AccessTokenGuard)
  async checkBonus(@Req() req: Request) {
    const user = req['user'];
    return this.topupService.hasMonthlyBonus(user.user_id);
  }

  /**
   * Logged-in: Lấy lịch sử giao dịch nạp của user hiện tại
   */
  @Get('transactions')
  @UseGuards(AccessTokenGuard)
  async getUserTransactions(@Req() req: Request) {
    const user = req['user'];
    return await this.topupService.getUserTransactions(user.user_id);
  }
}
