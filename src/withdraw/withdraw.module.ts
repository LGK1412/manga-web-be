import { Module } from '@nestjs/common';
import { WithdrawService } from './withdraw.service';
import { WithdrawController } from './withdraw.controller';
import { UserModule } from 'src/user/user.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Withdraw, WithdrawSchema } from 'src/schemas/Withdrawal.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Withdraw.name, schema: WithdrawSchema },
    ]),
    UserModule
  ],
  controllers: [WithdrawController],
  providers: [WithdrawService],
})
export class WithdrawModule { }
