import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PayoutSettlement, PayoutSettlementDocument } from 'src/schemas/payout-settlement.schema';
import { WithdrawDocument } from 'src/schemas/Withdrawal.schema';
import { Types } from 'mongoose';
import ExcelJS from 'exceljs';
import { UserDocument } from 'src/schemas/User.schema';
import * as path from 'path';
import { existsSync, unlinkSync } from 'fs';

function startOfDayVN(date: Date) {
  return new Date(Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    0 - 7, 0, 0, 0
  ));
}

function endOfDayVN(date: Date) {
  return new Date(Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23 - 7, 59, 59, 999
  ));
}

@Injectable()
export class PayoutSettlementService {
  constructor(
    @InjectModel('User')
    private userModel: Model<UserDocument>,
    @InjectModel('Withdraw')
    private withdrawModel: Model<WithdrawDocument>,
    @InjectModel('PayoutSettlement')
    private payoutSettlementModel: Model<PayoutSettlementDocument>,
  ) { }

  private formatDate(d: Date) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private async fetchWithdraws(filter: any): Promise<any[]> {
    return this.withdrawModel
      .find(filter)
      .populate('authorId')
      .lean();
  }

  async findById(id: string): Promise<PayoutSettlement> {
    const settlement = await this.payoutSettlementModel.findById(id).exec();

    if (!settlement) {
      throw new NotFoundException(`Không tìm thấy bản ghi payout với ID: ${id}`);
    }

    return settlement;
  }

  async findAll(query: any) {
    const { page, limit, status, from, to } = query;

    const filter: any = {};

    if (from || to) {
      filter.$and = [];

      if (from) {
        filter.$and.push({ periodFrom: { $gte: startOfDayVN(new Date(from)) } });
      }

      if (to) {
        filter.$and.push({ periodTo: { $lte: endOfDayVN(new Date(to)) } });
      }
    }

    const [data, total] = await Promise.all([
      this.payoutSettlementModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),

      this.payoutSettlementModel.countDocuments(filter),
    ]);

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async markAsPaid(
    id: string,
    userId: string,
    note?: string,
    bankBatchRef?: Express.Multer.File[]
  ) {
    const settlement = await this.payoutSettlementModel.findById(id);

    if (!settlement) throw new NotFoundException('Settlement not found');

    if (settlement.status !== 'exported')
      throw new BadRequestException('Settlement already processed');

    const paidAt = new Date();

    const withdrawIds = settlement.items.flatMap(i => i.withdrawIds);

    if (!withdrawIds.length)
      throw new BadRequestException('No withdraws in settlement');

    // Group theo author
    const groups = settlement.items.map(i => ({
      _id: i.author,
      total: i.totalNet
    }));

    // Update điểm
    if (groups.length) {
      await this.userModel.bulkWrite(
        groups.map(g => ({
          updateOne: {
            filter: { _id: g._id },
            update: {
              $inc: {
                locked_point: -g.total,
                author_point: -g.total
              }
            }
          }
        }))
      );
    }

    // Update withdraw
    await this.withdrawModel.updateMany(
      {
        _id: { $in: withdrawIds },
        status: 'settled'
      },
      {
        $set: {
          status: 'paid',
          paidAt
        }
      }
    );

    // Update settlement
    settlement.status = 'paid';
    settlement.paidAt = paidAt;
    settlement.paidBy = new Types.ObjectId(userId);
    settlement.note = note;
    settlement.bankBatchRef = bankBatchRef?.map(f => f.filename);

    await settlement.save();

    return { success: true };
  }

  private async createPayoutSettlement(
    withdraws: any[],
    periodFrom: Date,
    periodTo: Date,
    fileName: string,
  ) {
    const authorGroups = new Map<string, {
      totalNet: number;
      withdrawIds: Types.ObjectId[];
      bankName: string;
      bankAccount: string;
      bankAccountName: string;
    }>();

    for (const w of withdraws) {
      const authorId = w.authorId._id;
      let current = authorGroups.get(authorId);

      if (!current) {
        current = {
          totalNet: 0,
          withdrawIds: [],
          bankName: w.bankName,
          bankAccount: w.bankAccount,
          bankAccountName: w.bankAccountName,
        };
        authorGroups.set(authorId, current);
      }

      current.totalNet += w.netAmount;
      current.withdrawIds.push(w._id);
      current.bankName = w.bankName;
      current.bankAccount = w.bankAccount;
      current.bankAccountName = w.bankAccountName;
    }

    const items = Array.from(authorGroups.entries()).map(([authorId, data]) => ({
      author: authorId,
      bankName: data.bankName,
      bankAccount: data.bankAccount,
      bankAccountName: data.bankAccountName,
      totalNet: data.totalNet,
      withdrawIds: data.withdrawIds,
    }));

    const totalNet = withdraws.reduce((s, w) => s + w.netAmount, 0);

    const [settlement] = await this.payoutSettlementModel.create([{
      periodFrom,
      periodTo,
      year: periodFrom.getFullYear(),
      items: items,
      totalNet,
      withdrawCount: withdraws.length,
      authorCount: items.length,
      fileName,
      status: 'exported',
    }]);

    await this.withdrawModel.updateMany(
      { _id: { $in: withdraws.map(w => w._id) } },
      {
        status: 'settled',
        settledAt: new Date(),
        settlementId: settlement._id
      }
    );

    return await settlement.save();
  }

  private async buildWorkbook(
    withdraws: any[],
    settlement: PayoutSettlementDocument,
    fileName: string,
  ): Promise<string> {
    const workbook = new ExcelJS.Workbook();

    const bankSheet = workbook.addWorksheet('BANK_TRANSFER');
    bankSheet.columns = [
      { header: 'STT', key: 'stt', width: 5 },
      { header: 'TÊN TÀI KHOẢN', key: 'bankAccountName', width: 30 },
      { header: 'SỐ TÀI KHOẢN', key: 'bankAccount', width: 25 },
      { header: 'NGÂN HÀNG', key: 'bankName', width: 25 },
      { header: 'SỐ TIỀN CHUYỂN (NET)', key: 'amount', width: 20 },
      { header: 'NỘI DUNG', key: 'note', width: 40 },
    ];

    settlement.items.forEach((item, index) => {
      bankSheet.addRow({
        stt: index + 1,
        bankAccountName: item.bankAccountName.toUpperCase(),
        bankAccount: item.bankAccount,
        bankName: item.bankName,
        amount: item.totalNet,
        note: `THANH TOAN NHUAN BUT KY ${this.formatDate(settlement.periodFrom)} - ${this.formatDate(settlement.periodTo)}`,
      });
    });

    const detailSheet = workbook.addWorksheet('WITHDRAW_DETAILS');
    detailSheet.columns = [
      { header: 'Mã rút tiền', key: 'id', width: 25 },
      { header: 'Tác giả', key: 'author', width: 20 },
      { header: 'MST', key: 'taxCode', width: 15 },
      { header: 'Gross (Nhuận bút)', key: 'gross', width: 15 },
      { header: 'Tax (10%)', key: 'tax', width: 15 },
      { header: 'Net (Thực nhận)', key: 'net', width: 15 },
      { header: 'Ngày duyệt', key: 'date', width: 20 },
    ];

    withdraws.forEach(w => {
      detailSheet.addRow({
        id: w._id.toString(),
        author: w.authorId?.username || 'N/A',
        taxCode: w.taxCode || 'N/A',
        gross: w.grossAmount,
        tax: w.taxAmount,
        net: w.netAmount,
        date: this.formatDate(w.approvedAt),
      });
    });

    [bankSheet, detailSheet].forEach(sheet => {
      sheet.getRow(1).font = { bold: true };
      const moneyCols = ['amount', 'gross', 'tax', 'net'];
      sheet.columns.forEach(col => {
        if (moneyCols.includes(col.key as string)) {
          col.numFmt = '#,##0';
        }
      });
    });

    const baseDir = path.join(process.cwd(), 'public', 'payout-files', settlement.id);

    if (!existsSync(baseDir)) {
      require('fs').mkdirSync(baseDir, { recursive: true });
    }

    const filePath = path.join(baseDir, fileName);
    await workbook.xlsx.writeFile(filePath);

    return filePath;
  }

  async exportPayoutSettlement(periodFrom: Date, periodTo: Date) {
    const withdraws = await this.fetchWithdraws({
      status: 'approved',
      approvedAt: { $gte: startOfDayVN(periodFrom), $lte: endOfDayVN(periodTo) },
    });

    if (!withdraws.length) return null;

    const fileName = `payout-settlement_${this.formatDate(periodFrom)}_${this.formatDate(periodTo)}.xlsx`;
    const settlement = await this.createPayoutSettlement(withdraws, periodFrom, periodTo, fileName);
    const filePath = await this.buildWorkbook(withdraws, settlement, fileName);
    return { settlement, fileName, filePath };
  }

  async cancelPayoutSettlement(id: string, note: string) {
    const payout = await this.payoutSettlementModel.findById(id);
    if (!payout) throw new NotFoundException('Cannot find payout settlement');

    const withdrawIds = payout.items.flatMap(i => i.withdrawIds);

    if (withdrawIds.length > 0) {
      await this.withdrawModel.updateMany(
        {
          _id: { $in: withdrawIds },
          status: 'settled'
        },
        {
          $set: { status: 'approved' },
          $unset: {
            settledAt: ""
          }
        }
      );
    }

    payout.status = 'cancelled';
    payout.note = note;

    await payout.save();

    return {
      success: true,
      message: `Đã hủy đợt quyết toán và giải phóng ${withdrawIds.length} yêu cầu rút tiền.`
    };
  }

  async updatePaidStatus(
    id: string,
    remainingFiles: string[] = [],
    newBankBatchRef: Express.Multer.File[] = [],
    note?: string,
  ) {
    const payout = await this.payoutSettlementModel.findById(id);
    if (!payout) throw new NotFoundException('Không tìm thấy bản ghi');

    const filesToDelete = (payout.bankBatchRef || []).filter(
      (oldFile) => !remainingFiles.includes(oldFile),
    );

    const uploadDir = path.join(process.cwd(), 'public', 'bankBatchRef', id);

    filesToDelete.forEach((fileName) => {
      const filePath = path.join(uploadDir, fileName);
      try {
        if (existsSync(filePath)) {
          unlinkSync(filePath);
        }
      } catch (err) {
        console.error(`Lỗi khi xóa file ${fileName}:`, err);
      }
    });

    if (note !== undefined) payout.note = note;

    const newFileNames = newBankBatchRef.map((f) => f.filename);

    payout.bankBatchRef = [...remainingFiles, ...newFileNames];

    await payout.save();
    return {
      success: true,
      data: payout
    };
  }

  // async sendWithdrawReceiptEmail(
  //   withdraw: WithdrawDocument,
  //   status: 'approved' | 'paid',
  //   extra?: {
  //     paidAt?: Date;
  //     referenceCode?: string;
  //   }
  // ) {
  //   const author = await this.userModel.findById(withdraw.authorId);
  //   if (!author?.email) return;

  //   const last4Digits = withdraw.bankAccount.slice(-4);

  //   // mapping trạng thái -> UI/text
  //   const statusMap = {
  //     approved: {
  //       label: 'Approved',
  //       color: '#16a34a',
  //       message: 'The funds will be transferred within 1–3 days.',
  //     },
  //     paid: {
  //       label: 'Completed',
  //       color: '#0f766e',
  //       message: 'The funds have been successfully transferred to your bank account.',
  //     },
  //   };

  //   const s = statusMap[status];

  //   await this.mailerService.sendMail({
  //     to: author.email,
  //     subject: `Withdrawal ${s.label}`,
  //     template: './withdrawalReceipt',
  //     context: {
  //       authorName: author.username,

  //       // status dynamic
  //       statusLabel: s.label,
  //       statusColor: s.color,
  //       statusMessage: s.message,

  //       withdrawId: withdraw._id,

  //       approvedAt: withdraw.approvedAt
  //         ? withdraw.approvedAt.toLocaleString('vi-VN')
  //         : undefined,

  //       paidAt: extra?.paidAt?.toLocaleString('vi-VN'),
  //       referenceCode: extra?.referenceCode,

  //       points: withdraw.withdraw_point,
  //       gross: withdraw.grossAmount.toLocaleString(),
  //       tax: withdraw.taxAmount.toLocaleString(),
  //       taxRate: withdraw.taxRate * 100,
  //       net: withdraw.netAmount.toLocaleString(),
  //       legalRef: withdraw.taxLegalRef,

  //       bankName: withdraw.bankName,
  //       last4Digits,
  //       bankAccountName: withdraw.bankAccountName,

  //       PlatformName: 'MangaWord',
  //     },
  //   });
  // }
}