import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { TopupService } from './topup.service';
import { AccessTokenGuard } from 'src/common/guards/access-token.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';

@Controller('api/topup')
export class TopupController {
  constructor(private readonly topupService: TopupService) { }

  @Get('packages')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
  async getPackages(@Req() req: Request) {
    const userId = req['user'].user_id;
    return this.topupService.getPackagesWithBonus(userId);
  }

  @Get('bonus-status')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
  async checkBonus(@Req() req: Request) {
    const user = req['user'];
    return this.topupService.hasMonthlyBonus(user.user_id);
  }

  @Get('transactions')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
  async getUserTransactions(@Req() req: Request) {
    const userId = req['user'].user_id;
    return await this.topupService.getUserTransactions(userId);
  }
}
