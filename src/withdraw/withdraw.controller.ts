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
import type { JwtPayload } from 'src/common/interfaces/jwt-payload.interface';

@Controller('api/withdraw')
export class WithdrawController {
  constructor(private readonly withdrawService: WithdrawService) {}

  /**
   * Author tạo yêu cầu rút tiền (CHỈ AUTHOR)
   * Lấy author/user từ token, KHÔNG nhận authorId từ body.
   */
  @Post()
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.AUTHOR)
  async createWithdraw(
    @Req() req: Request,
    @Body('withdraw_point') withdraw_point: number,
    @Body('bankCode') bankCode: string,
    @Body('bankAccount') bankAccount: string,
    @Body('accountHolder') accountHolder: string,
  ) {
    const user = (req as any).user as JwtPayload;

    return this.withdrawService.createWithdraw(
      user.userId, // <-- dùng userId từ JWT
      withdraw_point,
      bankCode,
      bankAccount,
      accountHolder,
    );
  }

  /**
   * Admin duyệt rút tiền
   */
  @Patch(':id/approve')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async approveWithdraw(@Param('id') withdrawId: string) {
    return this.withdrawService.approveWithdraw(withdrawId);
  }

  /**
   * Admin từ chối rút tiền
   */
  @Patch(':id/reject')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN)
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
  ) {
    const user = (req as any).user as JwtPayload;

    return this.withdrawService.getUserWithdraws(
      user.userId, // <-- lấy từ JWT
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  /**
   * Admin lấy lịch sử rút của 1 author bất kỳ (có phân trang)
   * Nếu bạn không cần endpoint này thì có thể xoá.
   */
  @Get('author/:authorId')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async getUserWithdraws(
    @Param('authorId') authorId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '5',
  ) {
    return this.withdrawService.getUserWithdraws(
      authorId,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  /**
   * Admin lấy danh sách tất cả yêu cầu rút
   */
  @Get()
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async getAllWithdraws() {
    return this.withdrawService.getAllWithdraws();
  }
}
