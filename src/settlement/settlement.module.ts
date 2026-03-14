// import { Module } from '@nestjs/common';
// import { SettlementService } from './settlement.service';
// import { SettlementController } from './settlement.controller';
// import { MongooseModule } from '@nestjs/mongoose';
// import { Withdraw, WithdrawSchema } from 'src/schemas/Withdrawal.schema';
// import { PayoutSettlement, PayoutSettlementSchema } from 'src/schemas/payout-settlement.schema';
// import { User, UserSchema } from 'src/schemas/User.schema';
// import { WithdrawReportModule } from 'src/withdraw-report/withdraw-report.module';
// import { TaxSettlement, TaxSettlementSchema } from 'src/schemas/tax-settlement.schema';

// @Module({
//   imports: [MongooseModule.forFeature([
//     { name: User.name, schema: UserSchema },
//     { name: Withdraw.name, schema: WithdrawSchema },
//     { name: PayoutSettlement.name, schema: PayoutSettlementSchema },
//     { name: TaxSettlement.name, schema: TaxSettlementSchema }
//   ]),
//     WithdrawReportModule],
//   controllers: [SettlementController],
//   providers: [SettlementService],
// })
// export class SettlementModule { }
