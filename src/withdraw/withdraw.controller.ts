import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { WithdrawService } from './withdraw.service';

import { AccessTokenGuard } from 'src/common/guards/access-token.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';

@Controller('api/withdraw')
export class WithdrawController {
  constructor(private readonly withdrawService: WithdrawService) { }

  @Get('preview')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.AUTHOR)
  async preview(@Query('points') points: string) {
    const numPoints = Number(points);
    if (!numPoints || numPoints <= 0) return null;
    return this.withdrawService.previewWithdraw(numPoints);
  }

  @Post()
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.AUTHOR)
  async createWithdraw(
    @Req() req: Request,
    @Body('withdraw_point') withdraw_point: number,
  ) {
    const userId = req['user'].user_id;
    return this.withdrawService.createWithdraw(userId, withdraw_point);
  }

  @Patch(':id/approve')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.FINANCIAL_MANAGER)
  async approveWithdraw(@Param('id') withdrawId: string) {
    return this.withdrawService.approveWithdraw(withdrawId);
  }

  @Patch(':id/reject')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.FINANCIAL_MANAGER)
  async rejectWithdraw(
    @Param('id') withdrawId: string,
    @Body('note') note?: string,
  ) {
    return this.withdrawService.rejectWithdraw(withdrawId, note);
  }

  /**
   * Author lấy lịch sử rút của chính mình (có phân trang)
   */
  @Get('me')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.AUTHOR)
  async getMyWithdraws(
    @Req() req: Request,
    @Query('page') page = '1',
    @Query('limit') limit = '5',
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const user = req['user'];

    return this.withdrawService.getUserWithdraws(
      user.user_id,
      parseInt(page, 10),
      parseInt(limit, 10),
      status,
      from,
      to
    );
  }

  /**
   * Admin lấy danh sách tất cả yêu cầu rút
   */
  @Get()
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.FINANCIAL_MANAGER)
  async getAllWithdraws(
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.withdrawService.getWithdraws({
      month: month ? +month : undefined,
      year: year ? +year : undefined,
      status,
      search,
    });
  }

  @Get('detail/:id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.FINANCIAL_MANAGER)
  async getDetailWithdraw(
    @Param('id') withdrawId: string,
  ) {
    return this.withdrawService.getDetailWithdraw(withdrawId);
  }

}
