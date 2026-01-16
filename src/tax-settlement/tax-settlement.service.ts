import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ChapterPurchase, ChapterPurchaseDocument } from 'src/schemas/chapter-purchase.schema';
import { Model, Types } from 'mongoose';
import { Donation, DonationDocument } from 'src/schemas/donation.shema';
import { TaxSettlement, TaxSettlementDocument } from 'src/schemas/taxSettlement.schema';

@Injectable()
export class TaxSettlementService {
  private readonly TOPUP_RATE = 183.33;   // 1 điểm = 183.33đ khi nạp
  private readonly PAYOUT_RATE = 150;    // 1 điểm = 150đ khi author nhận
  private readonly COMMISSION_PER_POINT = this.TOPUP_RATE - this.PAYOUT_RATE;
  private readonly CORPORATE_TAX_RATE = 0.2;
  private readonly AUTHOR_TAX_RATE = 0.015;

  constructor(
    @InjectModel(TaxSettlement.name)
    private readonly taxSettlementModel: Model<TaxSettlementDocument>,

    @InjectModel(Donation.name)
    private readonly donationModel: Model<DonationDocument>,

    @InjectModel(ChapterPurchase.name)
    private readonly chapterPurchaseModel: Model<ChapterPurchaseDocument>
  ) { }

  // async settleMonthlyTax(month: number, year: number) {

  //   if (month < 1 || month > 12) {
  //     throw new BadRequestException('Tháng không hợp lệ')
  //   }

  //   const startDate = new Date(year, month - 1, 1);
  //   const endDate = new Date(year, month, 1);

  //   // tổng điểm đã mua
  //   const chapterResult = await this.chapterPurchaseModel.aggregate([
  //     {
  //       $match: {
  //         createdAt: { $gte: startDate, $lt: endDate }
  //       }
  //     },
  //     {
  //       $group: {
  //         _id: null,
  //         totalPoints: { $sum: '$price' }
  //       }
  //     }
  //   ]);

  //   const donationResult = await this.donationModel.aggregate([
  //     {
  //       $match: {
  //         createdAt: { $gte: startDate, $lt: endDate }
  //       }
  //     },
  //     {
  //       $group: {
  //         _id: null,
  //         totalPoints: { $sum: '$totalPrice' }
  //       }
  //     }
  //   ]);

  //   const chapterPoints = chapterResult[0]?.totalPoints || 0;
  //   const donationPoints = donationResult[0]?.totalPoints || 0;

  //   const totalUsedPoints = chapterPoints + donationPoints;

  //   // Tổng doanh thu
  //   const totalRevenue = totalUsedPoints * COMMISSION_PER_POINT;

  //   // Thuế TNDN (20%)
  //   const corporateTax = totalRevenue * CORPORATE_TAX_RATE;

  //   // Lưu doc
  //   return this.taxSettlementModel.create({
  //     month,
  //     year,
  //     totalRevenue,
  //     corporateTax,
  //     status: 'DECLARED'
  //   })
  // }

  async createAuthorTaxSettlement(authorId: string, withdrawId: string, totalPoint: number) {
    const grossAmount = totalPoint * this.PAYOUT_RATE;
    const taxAmount = Math.round(grossAmount * this.AUTHOR_TAX_RATE);
    const netAmount = grossAmount - taxAmount;

    return this.taxSettlementModel.create({
      type: 'AUTHOR',
      authorId: new Types.ObjectId(authorId),
      withdrawId: new Types.ObjectId(withdrawId),
      totalPoint: totalPoint,
      grossAmount,
      taxRate: this.AUTHOR_TAX_RATE,
      taxAmount,
      netAmount,
      status: 'PAID',
      paidAt: new Date()
    })
  }
}
