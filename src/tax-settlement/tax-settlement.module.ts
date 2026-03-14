import { Module } from '@nestjs/common';
import { TaxSettlementService } from './tax-settlement.service';
import { TaxSettlementController } from './tax-settlement.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from 'src/schemas/User.schema';
import { Withdraw, WithdrawSchema } from 'src/schemas/Withdrawal.schema';
import { TaxSettlement, TaxSettlementSchema } from 'src/schemas/tax-settlement.schema';

@Module({
  imports: [MongooseModule.forFeature([
    { name: User.name, schema: UserSchema },
    { name: Withdraw.name, schema: WithdrawSchema },
    { name: TaxSettlement.name, schema: TaxSettlementSchema }
  ])],
  controllers: [TaxSettlementController],
  providers: [TaxSettlementService],
})
export class TaxSettlementModule { }
