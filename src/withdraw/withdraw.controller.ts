import {
  Controller,
  Post,
  Body,
  Param,
  Get,
  Patch,
  Query
} from '@nestjs/common';
import { WithdrawService } from './withdraw.service';

@Controller('api/withdraw')
export class WithdrawController {
  constructor(private readonly withdrawService: WithdrawService) { }

  /**
   * Author tạo yêu cầu rút tiền
   */
  @Post()
  async createWithdraw(
    @Body('authorId') authorId: string,
    @Body('withdraw_point') withdraw_point: number,
    @Body('bankCode') bankCode: string,
    @Body('bankAccount') bankAccount: string,
    @Body('accountHolder') accountHolder: string,
  ) {
    return this.withdrawService.createWithdraw(
      authorId,
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
  async approveWithdraw(@Param('id') withdrawId: string) {
    return this.withdrawService.approveWithdraw(withdrawId);
  }

  /**
   * Admin từ chối rút tiền
   */
  @Patch(':id/reject')
  async rejectWithdraw(
    @Param('id') withdrawId: string,
    @Body('note') note?: string,
  ) {
    return this.withdrawService.rejectWithdraw(withdrawId, note);
  }

  /**
   * Lấy lịch sử rút của author (có phân trang)
   */
  @Get("author/:authorId")
  async getUserWithdraws(
    @Param("authorId") authorId: string,
    @Query("page") page = "1",
    @Query("limit") limit = "5"
  ) {
    return this.withdrawService.getUserWithdraws(
      authorId,
      parseInt(page, 10),
      parseInt(limit, 10)
    );
  }

  /**
   * Admin lấy danh sách tất cả yêu cầu rút
   */
  @Get()
  async getAllWithdraws() {
    return this.withdrawService.getAllWithdraws();
  }
}
