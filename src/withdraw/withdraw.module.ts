import { Module } from '@nestjs/common';
import { WithdrawService } from './withdraw.service';
import { WithdrawController } from './withdraw.controller';
import { UserModule } from 'src/user/user.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Withdraw, WithdrawSchema } from 'src/schemas/Withdrawal.schema';
import { TaxRule, TaxRuleSchema } from 'src/schemas/tax-rule.schema';
import { AuthorPayoutProfile, AuthorPayoutProfileSchema } from 'src/schemas/author-payout-profile.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Withdraw.name, schema: WithdrawSchema },
      { name: TaxRule.name, schema: TaxRuleSchema },
      { name: AuthorPayoutProfile.name, schema: AuthorPayoutProfileSchema }
    ]),
    UserModule,
  ],
  controllers: [WithdrawController],
  providers: [WithdrawService],
})
export class WithdrawModule { }
