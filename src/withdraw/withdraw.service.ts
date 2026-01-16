import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Withdraw, WithdrawDocument } from 'src/schemas/Withdrawal.schema';
import { User, UserDocument } from 'src/schemas/User.schema';
import { TaxSettlementService } from 'src/tax-settlement/tax-settlement.service';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class WithdrawService {
  constructor(
    @InjectModel(Withdraw.name)
    private readonly withdrawModel: Model<WithdrawDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly taxSettlementService: TaxSettlementService,
    private readonly mailerService: MailerService
  ) { }

  private readonly RATE = 150; // 1 point = 150 VND

  /**
   * Tạo yêu cầu rút tiền
   */
  async createWithdraw(
    authorId: string,
    withdraw_point: number,
    bankCode: string,
    bankAccount: string,
    accountHolder: string,
  ) {
    const author = await this.userModel.findById(authorId);
    if (!author) throw new NotFoundException('author not found');

    if (withdraw_point <= 0) {
      throw new BadRequestException('Withdrawal points must be greater than 0');
    }

    if (author.author_point < withdraw_point) {
      throw new BadRequestException('Insufficient points to withdraw');
    }

    // Tính tổng điểm đang pending
    const pendingSum = await this.withdrawModel.aggregate([
      { $match: { authorId: new Types.ObjectId(authorId), status: "pending" } },
      { $group: { _id: null, total: { $sum: "$withdraw_point" } } }
    ]);

    const pendingTotal = pendingSum.length > 0 ? pendingSum[0].total : 0;

    // Check available points
    const availablePoints = author.author_point - pendingTotal;
    if (availablePoints < withdraw_point) {
      throw new BadRequestException(
        `Insufficient available points. You currently have ${availablePoints} available points.`
      );
    }

    const amount = withdraw_point * this.RATE;

    // Tạo yêu cầu rút
    const withdraw = new this.withdrawModel({
      authorId: author._id,
      withdraw_point,
      amount,
      bankCode,
      bankAccount,
      accountHolder,
      status: 'pending',
    });

    await withdraw.save();

    return withdraw;
  }

  /**
   * Admin duyệt rút tiền
   */
  async approveWithdraw(withdrawId: string) {
    const withdraw = await this.withdrawModel.findById(withdrawId).populate('authorId');
    if (!withdraw) throw new NotFoundException('Withdraw request not found');

    if (withdraw.status !== 'pending') {
      throw new BadRequestException('This request has already been processed');
    }

    const author = await this.userModel.findById(withdraw.authorId._id);
    if (!author) throw new NotFoundException('author not found');

    if (author.author_point < withdraw.withdraw_point) {
      throw new BadRequestException('Author does not have enough points to approve withdrawal');
    }

    // Trừ điểm
    author.author_point -= withdraw.withdraw_point;
    await author.save();

    // Cập nhật trạng thái
    withdraw.status = 'completed';
    await withdraw.save();

    const taxSettlement = await this.taxSettlementService.createAuthorTaxSettlement(
      author._id.toString(), withdrawId, withdraw.withdraw_point,
    )

    try {
      await this.sendWithdrawReceiptEmail(withdraw, taxSettlement)
    } catch (err) {
      throw new BadRequestException(
        `Unable to send email to user: ${err.message}`,
      );
    }

    return withdraw;
  }

  /**
   * Admin từ chối rút tiền
   */
  async rejectWithdraw(withdrawId: string, note?: string) {
    const withdraw = await this.withdrawModel.findById(withdrawId);
    if (!withdraw) throw new NotFoundException('Withdraw request not found');

    if (withdraw.status !== 'pending') {
      throw new BadRequestException('This request has already been processed');
    }

    withdraw.status = 'rejected';
    if (note) withdraw['note'] = note;

    await withdraw.save();

    return withdraw;
  }

  /**
   * Lấy lịch sử rút của author (có phân trang)
   */
  async getUserWithdraws(authorId: string, page = 1, limit = 5) {
    const skip = (page - 1) * limit;

    const matchStage = {
      $match: {
        authorId: new Types.ObjectId(authorId),
      },
    };

    const lookupTaxStage = {
      $lookup: {
        from: 'taxsettlements',
        localField: '_id',
        foreignField: 'withdrawId',
        as: 'tax',
      },
    };

    const unwindTaxStage = {
      $unwind: {
        path: '$tax',
        preserveNullAndEmptyArrays: true, // phòng trường hợp pending
      },
    };

    const projectStage = {
      $project: {
        authorId: 1,
        withdraw_point: 1,
        bankCode: 1,
        bankAccount: 1,
        accountHolder: 1,
        status: 1,
        note: 1,
        createdAt: 1,

        // tax fields
        taxAmount: '$tax.taxAmount',
        netAmount: '$tax.netAmount',
        grossAmount: '$tax.grossAmount',
        taxRate: '$tax.taxRate',
      },
    };

    const [docs, totalDocs] = await Promise.all([
      this.withdrawModel.aggregate([
        matchStage,
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        lookupTaxStage,
        unwindTaxStage,
        projectStage,
      ]),
      this.withdrawModel.countDocuments(matchStage.$match),
    ]);

    return {
      docs,
      totalDocs,
      page,
      limit,
      totalPages: Math.ceil(totalDocs / limit),
    };
  }

  /**
   * Lấy danh sách tất cả yêu cầu rút (cho admin)
   */
  async getAllWithdraws() {
    return this.withdrawModel.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'authorId',
          foreignField: '_id',
          as: 'author',
        },
      },
      { $unwind: '$author' },

      {
        $lookup: {
          from: 'taxsettlements',
          localField: '_id',
          foreignField: 'withdrawId',
          as: 'tax',
        },
      },
      {
        $unwind: {
          path: '$tax',
          preserveNullAndEmptyArrays: true,
        },
      },

      {
        $project: {
          withdraw_point: 1,
          amount: 1,
          bankCode: 1,
          bankAccount: 1,
          accountHolder: 1,
          status: 1,
          note: 1,
          createdAt: 1,

          author: {
            _id: '$author._id',
            username: '$author.username',
            email: '$author.email',
          },

          taxAmount: '$tax.taxAmount',
          netAmount: '$tax.netAmount',
          grossAmount: '$tax.grossAmount',
          taxRate: '$tax.taxRate',
        },
      },

      { $sort: { createdAt: -1 } },
    ]);
  }

  private async sendWithdrawReceiptEmail(
    withdraw: WithdrawDocument,
    taxSettlement: any,
  ) {
    const author = await this.userModel.findById(withdraw.authorId);
    if (!author || !author.email) return;

    const last4Digits = withdraw.bankAccount.slice(-4);

    await this.mailerService.sendMail({
      to: author.email,
      subject: 'Withdrawal Receipt',
      template: './withdrawalReceipt', // file .hbs
      context: {
        authorName: author.username,
        withdrawId: withdraw._id,
        date: new Date().toLocaleString('vi-VN'),

        points: withdraw.withdraw_point,
        gross: taxSettlement.grossAmount.toLocaleString(),
        tax: taxSettlement.taxAmount.toLocaleString(),
        net: taxSettlement.netAmount.toLocaleString(),

        bankCode: withdraw.bankCode,
        last4Digits,
        accountHolder: withdraw.accountHolder,

        PlatformName: 'MangaWord',
      },
    });
  }

}
