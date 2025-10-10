import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Withdraw, WithdrawDocument } from 'src/schemas/Withdrawal.schema';
import { User, UserDocument } from 'src/schemas/User.schema';

@Injectable()
export class WithdrawService {
  constructor(
    @InjectModel(Withdraw.name)
    private readonly withdrawModel: Model<WithdrawDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
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
      throw new BadRequestException('Số điểm rút phải lớn hơn 0');
    }

    if (author.author_point < withdraw_point) {
      throw new BadRequestException('Không đủ điểm để rút');
    }

    // Tính tổng điểm đang pending
    const pendingSum = await this.withdrawModel.aggregate([
      { $match: { authorId: new Types.ObjectId(authorId), status: "pending" } },
      { $group: { _id: null, total: { $sum: "$withdraw_point" } } }
    ]);

    const pendingTotal = pendingSum.length > 0 ? pendingSum[0].total : 0;

    // Check số điểm khả dụng
    const availablePoints = author.author_point - pendingTotal;
    if (availablePoints < withdraw_point) {
      throw new BadRequestException(
        `Không đủ điểm khả dụng. Bạn hiện còn ${availablePoints} điểm khả dụng.`
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
      throw new BadRequestException('Yêu cầu này đã được xử lý');
    }

    const author = await this.userModel.findById(withdraw.authorId._id);
    if (!author) throw new NotFoundException('author not found');

    if (author.author_point < withdraw.withdraw_point) {
      throw new BadRequestException('author không đủ điểm để duyệt rút');
    }

    // Trừ điểm
    author.author_point -= withdraw.withdraw_point;
    await author.save();

    // Cập nhật trạng thái
    withdraw.status = 'completed';
    await withdraw.save();

    return withdraw;
  }

  /**
   * Admin từ chối rút tiền
   */
  async rejectWithdraw(withdrawId: string, note?: string) {
    const withdraw = await this.withdrawModel.findById(withdrawId);
    if (!withdraw) throw new NotFoundException('Withdraw request not found');

    if (withdraw.status !== 'pending') {
      throw new BadRequestException('Yêu cầu này đã được xử lý');
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

    const [docs, totalDocs] = await Promise.all([
      this.withdrawModel
        .find({ authorId: new Types.ObjectId(authorId) })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.withdrawModel.countDocuments({ authorId: new Types.ObjectId(authorId) }),
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
    return this.withdrawModel.find().populate('authorId').sort({ createdAt: -1 });
  }
}
