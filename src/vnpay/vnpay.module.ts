import { Module } from '@nestjs/common';
import { VnpayController } from './vnpay.controller';
import { VnpayService } from './vnpay.service';
import { TopupModule } from './topup/topup.module';
import { AuthModule } from 'src/auth/auth.module'; // 👈 import AuthModule

@Module({
    imports: [
        TopupModule,
        AuthModule,
    ],
    controllers: [VnpayController],
    providers: [VnpayService],
})
export class VnpayModule { }
