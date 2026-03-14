import { Module } from '@nestjs/common';
import { PayoutSettlementService } from './payout-settlement.service';
import { PayoutSettlementController } from './payout-settlement.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Withdraw, WithdrawSchema } from 'src/schemas/Withdrawal.schema';
import { PayoutSettlement, PayoutSettlementSchema } from 'src/schemas/payout-settlement.schema';
import { User, UserSchema } from 'src/schemas/User.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Withdraw.name, schema: WithdrawSchema },
      { name: PayoutSettlement.name, schema: PayoutSettlementSchema }
    ])
  ],
  controllers: [PayoutSettlementController],
  providers: [PayoutSettlementService],
})
export class PayoutSettlementModule { }
