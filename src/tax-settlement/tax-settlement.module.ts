import { Module } from '@nestjs/common';
import { TaxSettlementService } from './tax-settlement.service';
import { TaxSettlementController } from './tax-settlement.controller';
import { TaxSettlement, TaxSettlementSchema } from 'src/schemas/taxSettlement.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { Donation, DonationSchema } from 'src/schemas/donation.shema';
import { ChapterPurchase, ChapterPurchaseSchema } from 'src/schemas/chapter-purchase.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TaxSettlement.name, schema: TaxSettlementSchema },
      { name: Donation.name, schema: DonationSchema },
      { name: ChapterPurchase.name, schema: ChapterPurchaseSchema }
    ]),
  ],
  controllers: [TaxSettlementController],
  providers: [TaxSettlementService],
  exports: [TaxSettlementService]
})
export class TaxSettlementModule { }
