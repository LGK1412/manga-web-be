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
    Res
} from '@nestjs/common';
import { VnpayService, CreatePaymentBody } from './vnpay.service';
import { TopupService } from '../topup/topup.service';
import { JwtService } from '@nestjs/jwt';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { Types } from 'mongoose';

@Controller('api/vnpay')
export class VnpayController {
    constructor(
        private readonly vnpayService: VnpayService,
        private readonly topupService: TopupService,
        private readonly jwtService: JwtService,
    ) { }

    private verifyToken(req: any): string {
        const token = req.cookies?.access_token;
        console.log('TOKEN FROM COOKIE:', token);
        if (!token) throw new BadRequestException('Authentication required');

        try {
            const decoded = this.jwtService.verify(token);
            console.log('DECODED TOKEN:', decoded);
            return decoded.user_id;
        } catch (err) {
            console.error('JWT VERIFY FAILED:', err.message);
            throw new BadRequestException('Invalid or expired token');
        }
    }

    @Post('create-payment-url/:id')
    @UsePipes(new ValidationPipe({ transform: true }))
    async createPaymentUrl(
        @Body() body: CreatePaymentDto,
        @Req() req: any,
        @Param('id') userId: string,
    ) {
        const userIdFromToken = this.verifyToken(req);
        if (userId !== userIdFromToken)
            throw new BadRequestException('User ID mismatch');

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
            userIdFromToken,      // đã là ObjectId string
            body.packageId,
            body.amount,
            points,
            paymentUrl,
            txnRef,
        );

        return { paymentUrl, txnRef };
    }

    @Get('return')
    async handleVnpayReturn(@Query() query: Record<string, string>, @Res() res) {
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

        // Giao dịch thành công: dùng handlePaymentSuccess để cập nhật status + cộng điểm
        await this.topupService.handlePaymentSuccess(result.txnRef);

        return res.redirect(
            `${process.env.CLIENT_URL}/?payment=success&txn=${result.txnRef}`,
        );
    }

}
