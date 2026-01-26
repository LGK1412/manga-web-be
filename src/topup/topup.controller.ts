import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { TopupService } from './topup.service';
import { AccessTokenGuard } from 'src/common/guards/access-token.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import type { JwtPayload } from 'src/common/interfaces/jwt-payload.interface';

@Controller('api/topup')
export class TopupController {
  constructor(private readonly topupService: TopupService) { }

  @Get('packages')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
  async getPackages(@Req() req: Request) {
    const user = req['user'];
    return this.topupService.getPackagesWithBonus(user.user_id);
  }

  @Get('bonus-status')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
  async checkBonus(@Req() req: Request) {
    const user = req['user'];
    return this.topupService.hasMonthlyBonus(user.user_id);
  }

  /**
   * Logged-in: Lấy lịch sử giao dịch nạp của user hiện tại
   */
  @Get('transactions')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
  async getUserTransactions(@Req() req: Request) {
    const user = req['user'];
    return await this.topupService.getUserTransactions(user.user_id);
  }
}
