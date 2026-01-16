import { BadRequestException, Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { TopupService } from './topup.service';

import { AccessTokenGuard } from 'src/common/guards/access-token.guard';
import type { JwtPayload } from 'src/common/interfaces/jwt-payload.interface';

@Controller('api/topup')
export class TopupController {
  constructor(private readonly topupService: TopupService) {}

  /**
   * Logged-in: Lấy danh sách package + bonus info theo user hiện tại
   */
  @Get('packages')
  @UseGuards(AccessTokenGuard)
  async getPackages(@Req() req: Request) {
    const user = (req as any).user as JwtPayload;

    if (!user?.userId) {
      return { packages: [], bonus: { hasBonus: false, lastBonus: null } };
    }

    return this.topupService.getPackagesWithBonus(user.userId);
  }

  /**
   * Logged-in: Kiểm tra trạng thái bonus theo user hiện tại
   */
  @Get('bonus-status')
  @UseGuards(AccessTokenGuard)
  async checkBonus(@Req() req: Request) {
    const user = (req as any).user as JwtPayload;

    if (!user?.userId) return { hasBonus: false, lastBonus: null };

    return this.topupService.hasMonthlyBonus(user.userId);
  }

  /**
   * Logged-in: Lấy lịch sử giao dịch nạp của user hiện tại
   */
  @Get('transactions')
  @UseGuards(AccessTokenGuard)
  async getUserTransactions(@Req() req: Request) {
    const user = (req as any).user as JwtPayload;

    if (!user?.userId) {
      throw new BadRequestException('Thiếu userId');
    }

    const transactions = await this.topupService.getUserTransactions(user.userId);
    return { transactions };
  }
}
