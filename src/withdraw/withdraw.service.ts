import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Withdraw, WithdrawDocument } from 'src/schemas/Withdrawal.schema';
import { User, UserDocument } from 'src/schemas/User.schema';
import { TaxRule, TaxRuleDocument } from 'src/schemas/tax-rule.schema';
import { AuthorPayoutProfileDocument } from 'src/schemas/author-payout-profile.schema';

@Injectable()
export class WithdrawService {
  constructor(
    @InjectModel(Withdraw.name)
    private readonly withdrawModel: Model<WithdrawDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(TaxRule.name)
    private readonly taxRuleModel: Model<TaxRuleDocument>,
    @InjectModel('AuthorPayoutProfile')
    private profileModel: Model<AuthorPayoutProfileDocument>,
  ) { }

  private readonly RATE = 150; // 1 point = 150 VND

  private async calculateTax(grossAmount: number) {
    const now = new Date();
    const rule = await this.taxRuleModel
      .findOne({
        subject: 'AUTHOR',
        isActive: true,
        effectiveFrom: { $lte: now },
        $or: [{ effectiveTo: null }, { effectiveTo: { $gte: now } }],
        minPayout: { $lte: grossAmount },
      })
      .sort({ minPayout: -1 });

    const taxRate = rule?.rate ?? 0;
    const taxAmount = Math.floor(grossAmount * taxRate);

    return {
      taxRuleId: rule?._id,
      taxRate,
      taxAmount,
      taxLegalRef: rule?.legalRef ?? 'No tax',
    };
  }

  async previewWithdraw(withdraw_point: number) {
    const grossAmount = withdraw_point * this.RATE;
    const taxData = await this.calculateTax(grossAmount);

    return {
      withdraw_point,
      grossAmount,
      ...taxData,
      netAmount: grossAmount - taxData.taxAmount,
    };
  }

  // 3. Hàm Create đã được rút gọn logic tính thuế
  async createWithdraw(authorId: string, withdraw_point: number) {
    const author = await this.userModel.findById(authorId);
    if (!author) throw new NotFoundException('Author not found');

    const available = author.author_point - author.locked_point;
    if (available < withdraw_point)
      throw new BadRequestException(`Available points: ${available}`);

    const profile = await this.profileModel.findOne({
      userId: new Types.ObjectId(authorId),
      kycStatus: 'verified',
      isActive: true,
    });
    if (!profile) throw new ForbiddenException('KYC not approved');

    // Tính toán tiền và thuế bằng hàm chung
    const grossAmount = withdraw_point * this.RATE;
    const taxData = await this.calculateTax(grossAmount);

    // Lock point
    author.locked_point += withdraw_point;
    await author.save();

    return this.withdrawModel.create({
      authorId: author._id,
      withdraw_point,
      fullName: profile.fullName,
      citizenId: profile.citizenId,
      dateOfBirth: profile.dateOfBirth,
      address: profile.address,
      taxCode: profile.taxCode,
      bankName: profile.bankName,
      bankAccount: profile.bankAccount,
      bankAccountName: profile.bankAccountName,
      identityImages: profile.identityImages,
      ...taxData,
      grossAmount,
      netAmount: grossAmount - taxData.taxAmount,
      status: 'pending',
    });
  }

  async approveWithdraw(withdrawId: string) {
    const withdraw = await this.withdrawModel.findById(withdrawId);
    if (!withdraw) throw new NotFoundException('Withdraw request not found');

    if (withdraw.status !== 'pending')
      throw new BadRequestException('Already processed');

    withdraw.status = 'approved';
    withdraw.approvedAt = new Date();

    await withdraw.save();

    // await this.withdrawReportService.sendWithdrawReceiptEmail(withdraw, 'approved');

    return withdraw;
  }

  /**
   * Admin từ chối rút tiền
   */
  async rejectWithdraw(withdrawId: string, note?: string) {
    const withdraw = await this.withdrawModel.findById(withdrawId);
    if (!withdraw) throw new NotFoundException('Withdraw request not found');

    if (withdraw.status !== 'pending')
      throw new BadRequestException('Already processed');

    const author = await this.userModel.findById(withdraw.authorId);
    if (!author) throw new NotFoundException('author not found');
    author.locked_point -= withdraw.withdraw_point;
    await author.save();

    withdraw.status = 'rejected';
    if (note) withdraw['note'] = note;

    await withdraw.save();

    return withdraw;
  }

  /**
   * Lấy lịch sử rút của author (có phân trang)
   */
  async getUserWithdraws(
    authorId: string,
    page = 1,
    limit = 5,
    status?: string,
    from?: string,
    to?: string
  ) {
    const skip = (page - 1) * limit;

    const filters: any = {
      authorId: new Types.ObjectId(authorId)
    };

    if (status) {
      filters.status = status;
    }
    if (from || to) {
      filters.createdAt = {};
      if (from) {
        filters.createdAt['$gte'] = new Date(from);
      }
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        filters.createdAt['$lte'] = toDate;
      }
    }
    const [docs, totalDocs] = await Promise.all([
      this.withdrawModel
        .find(filters)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.withdrawModel.countDocuments(filters),
    ]);

    return {
      docs,
      totalDocs,
      page,
      limit,
      totalPages: Math.ceil(totalDocs / limit),
    };
  }

  async getWithdraws(filter: {
    month?: number;
    year?: number;
    status?: string;
    search?: string;
  }) {
    const { month, year, status, search } = filter;

    const query: any = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (month || year) {
      const now = new Date();
      const y = year ?? now.getFullYear();

      const from = new Date(y, month ? month - 1 : 0, 1);
      const to = month
        ? new Date(y, month, 1)
        : new Date(y + 1, 0, 1);

      query.createdAt = { $gte: from, $lt: to };
    }

    if (search) {
      const authors = await this.userModel
        .find({
          $or: [
            { username: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
          ],
        })
        .select('_id')
        .lean();

      query.authorId = { $in: authors.map(a => a._id) };
    }

    return this.withdrawModel
      .find(query)
      .select(`
      authorId
      withdraw_point
      taxRate
      bankName
      bankAccount
      bankAccountName
      grossAmount
      taxAmount
      netAmount
      status
      note
      createdAt
      approvedAt
      settledAt
      paidAt
    `)
      .populate({
        path: 'authorId',
        select: 'username email fullName',
        options: { lean: true },
      })
      .lean()
      .sort({ createdAt: -1 });
  }

  async getDetailWithdraw(withdrawId: string) {
    return this.withdrawModel
      .findById(withdrawId)

      .populate({
        path: 'authorId',
        select: 'username email fullName',
        options: { lean: true },
      })
      .lean();
  }
}
