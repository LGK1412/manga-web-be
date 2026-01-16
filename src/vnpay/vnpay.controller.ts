import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Query,
  Param,
  BadRequestException,
  UsePipes,
  ValidationPipe,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Types } from 'mongoose';

import { VnpayService, CreatePaymentBody } from './vnpay.service';
import { TopupService } from '../topup/topup.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

import { AccessTokenGuard } from 'src/common/guards/access-token.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import type { JwtPayload } from 'src/common/interfaces/jwt-payload.interface';

@Controller('api/vnpay')
export class VnpayController {
  constructor(
    private readonly vnpayService: VnpayService,
    private readonly topupService: TopupService,
  ) {}

  /**
   * Tạo payment url
   * NOTE: vẫn giữ :id để khỏi sửa FE, nhưng userId thật lấy từ JWT và check mismatch.
   */
  @Post('create-payment-url/:id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
  @UsePipes(new ValidationPipe({ transform: true }))
  async createPaymentUrl(
    @Body() body: CreatePaymentDto,
    @Req() req: Request,
    @Param('id') userId: string,
  ) {
    const payload = (req as any).user as JwtPayload;
    const userIdFromToken = payload.userId;

    if (userId !== userIdFromToken) {
      throw new BadRequestException('User ID mismatch');
    }

    const ipAddr =
      (req.headers['x-forwarded-for'] as string) ||
      req.socket.remoteAddress ||
      '127.0.0.1';

    const { points, isDouble } = await this.topupService.getEffectivePoints(
      userIdFromToken,
      body.packageId,
    );

    const paymentBody: CreatePaymentBody = {
      amount: body.amount,
      ipAddr,
      extra: {
        packageId: body.packageId,
        points,
        isDouble,
      },
    };

    // tạo txnRef bên trong service (và nhận về luôn)
    const { paymentUrl, txnRef } = await this.vnpayService.createPaymentUrl(
      paymentBody,
      userIdFromToken,
    );

    // Lưu transaction với txnRef vừa nhận
    await this.topupService.createTransaction(
      userIdFromToken, // userId string
      body.packageId,
      body.amount,
      points,
      paymentUrl,
      txnRef,
    );

    return { paymentUrl, txnRef };
  }

  /**
   * VNPay redirect về server
   * Endpoint này thường public (VNPay gọi về) nên KHÔNG gắn guard.
   */
  @Get('return')
  async handleVnpayReturn(
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ) {
    const result = this.vnpayService.verifyReturn(query);

    if (!result.txnRef) {
      return res.redirect(`${process.env.CLIENT_URL}/?payment=failed`);
    }

    // Tìm transaction theo txnRef
    const transaction = await this.topupService.findByTxnRef(result.txnRef);

    if (!transaction) {
      return res.redirect(`${process.env.CLIENT_URL}/?payment=failed`);
    }

    const transactionId = (transaction._id as Types.ObjectId).toString();

    // Nếu giao dịch thất bại
    if (!result.isValid || !result.isSuccess) {
      await this.topupService.updateStatus(transactionId, 'failed');
      return res.redirect(`${process.env.CLIENT_URL}/?payment=failed`);
    }

    // Giao dịch thành công: cập nhật status + cộng điểm
    await this.topupService.handlePaymentSuccess(result.txnRef);

    return res.redirect(
      `${process.env.CLIENT_URL}/?payment=success&txn=${result.txnRef}`,
    );
  }
}
