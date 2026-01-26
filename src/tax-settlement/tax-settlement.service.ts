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
  ) { }

  async createAuthorTaxSettlement(authorId: string, withdrawId: string, totalPoint: number) {
    const now = new Date();
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
      status: 'Draft',
      month: now.getMonth() + 1,
      year: now.getFullYear()
    })
  }

  async getAllAuthorTax() {
    return this.taxSettlementModel
      .find({ type: 'AUTHOR' })
      .populate('authorId', 'username email')
      .populate('withdrawId', 'bankCode bankAccount accountHolder')
      .sort({ createdAt: -1 });
  }

  async getTaxSummary(month: number, year: number) {
    const result = await this.taxSettlementModel.aggregate([
      {
        $match: {
          type: 'AUTHOR',
          month,
          year,
          status: 'Declared',
        },
      },
      {
        $group: {
          _id: null,
          totalPoint: { $sum: '$totalPoint' },
          gross: { $sum: '$grossAmount' },
          tax: { $sum: '$taxAmount' },
          net: { $sum: '$netAmount' },
        },
      },
    ]);

    return result[0] || {
      totalPoint: 0,
      gross: 0,
      tax: 0,
      net: 0,
    };
  }

  async getPlatformTaxByPeriod(month: number, year: number) {
    if (!month || !year) {
      throw new BadRequestException('Month và Year là bắt buộc');
    }

    const platformRecord = await this.taxSettlementModel.findOne({
      type: 'PLATFORM',
      month,
      year,
    });

    return platformRecord; // có thể là null
  }


  async declareTaxWithPlatform(month: number, year: number) {
    // 1. Lấy toàn bộ AUTHOR Draft trong kỳ
    const authorRecords = await this.taxSettlementModel.find({
      type: 'AUTHOR',
      month,
      year,
      status: 'Draft',
    });

    if (authorRecords.length === 0) {
      throw new BadRequestException(
        'Không có bản ghi AUTHOR Draft để khai thuế',
      );
    }

    // 2. Chặn tạo trùng PLATFORM cho cùng kỳ
    const existedPlatform = await this.taxSettlementModel.findOne({
      type: 'PLATFORM',
      month,
      year,
    });

    if (existedPlatform) {
      throw new BadRequestException(
        'Kỳ thuế này đã được chốt sổ!',
      );
    }

    // 3. Update AUTHOR: Draft → Declared
    await this.taxSettlementModel.updateMany(
      {
        type: 'AUTHOR',
        month,
        year,
        status: 'Draft',
      },
      {
        $set: { status: 'Declared' },
      },
    );

    // 4. Tính tổng số liệu từ AUTHOR
    const totalPoint = authorRecords.reduce(
      (sum, r) => sum + (r.totalPoint || 0),
      0,
    );

    const totalAuthorGross = authorRecords.reduce(
      (sum, r) => sum + r.grossAmount,
      0,
    );

    const totalAuthorTax = authorRecords.reduce(
      (sum, r) => sum + r.taxAmount,
      0,
    );

    const totalNetToAuthors = authorRecords.reduce(
      (sum, r) => sum + r.netAmount,
      0,
    );

    // 5. Tính doanh thu commission của platform
    const totalCommission = Math.round(
      totalPoint * this.COMMISSION_PER_POINT,
    );

    const corporateTax = Math.round(
      totalCommission * this.CORPORATE_TAX_RATE,
    );

    const platformNet = totalCommission - corporateTax;

    // 6. Tạo bản ghi PLATFORM
    const platformSettlement =
      await this.taxSettlementModel.create({
        type: 'PLATFORM',

        month,
        year,

        grossAmount: totalCommission,       // doanh thu commission
        taxRate: this.CORPORATE_TAX_RATE,    // 20%
        taxAmount: corporateTax,
        netAmount: platformNet,

        status: 'Declared',
      });

    return {
      message: 'Declared tax & created platform settlement successfully',

      authorCount: authorRecords.length,

      totalPoint,
      totalAuthorGross,
      totalAuthorTax,
      totalNetToAuthors,

      totalCommission,
      corporateTax,
      platformNet,

      platformSettlementId: platformSettlement._id,
    };
  }

  async markTaxAsPaid(month: number, year: number) {
    const authorRecords = await this.taxSettlementModel.find({
      type: 'AUTHOR',
      month,
      year,
      status: 'Declared',
    });

    if (authorRecords.length === 0) {
      throw new BadRequestException(
        'Không có bản ghi AUTHOR Declared',
      );
    }

    const platformRecord = await this.taxSettlementModel.findOne({
      type: 'PLATFORM',
      month,
      year,
      status: 'Declared',
    });

    if (!platformRecord) {
      throw new BadRequestException(
        'Không tìm thấy bản ghi PLATFORM Declared cho kỳ này',
      );
    }

    const paidAt = new Date();

    // AUTHOR → Paid
    await this.taxSettlementModel.updateMany(
      { type: 'AUTHOR', month, year, status: 'Declared' },
      { status: 'Paid', paidAt },
    );

    // PLATFORM → Paid
    await this.taxSettlementModel.updateOne(
      { type: 'PLATFORM', month, year, status: 'Declared' },
      { status: 'Paid', paidAt },
    );

    return { message: 'Tax period marked as paid successfully' };
  }

}


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
