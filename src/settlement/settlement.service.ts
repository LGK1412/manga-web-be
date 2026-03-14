// import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
// import { InjectModel } from '@nestjs/mongoose';
// import { Model } from 'mongoose';
// import { PayoutSettlementDocument } from 'src/schemas/payout-settlement.schema';
// import { WithdrawDocument } from 'src/schemas/Withdrawal.schema';
// import { Types } from 'mongoose';
// import { UserDocument } from 'src/schemas/User.schema';
// import { WithdrawReportService } from 'src/withdraw-report/withdraw-report.service';
// import { TaxSettlementDocument } from 'src/schemas/tax-settlement.schema';
// import * as fs from 'fs';
// import path from 'path';
// import { MailerService } from '@nestjs-modules/mailer';

// @Injectable()
// export class SettlementService {
//   constructor(
//     @InjectModel('User')
//     private userModel: Model<UserDocument>,
//     @InjectModel('Withdraw')
//     private withdrawModel: Model<WithdrawDocument>,
//     @InjectModel('PayoutSettlement')
//     private payoutSettlementModel: Model<PayoutSettlementDocument>,
//     @InjectModel('TaxSettlement')
//     private taxSettlementModel: Model<TaxSettlementDocument>,
//     private mailerService: MailerService
//   ) { }

//   // ===== Thanh toán payout ======
//   async findAllPayout(query: any) {
//     const { page, limit, status, from, to } = query;

//     const filter: any = {};

//     if (status) filter.status = status;

//     if (from || to) {
//       filter.periodFrom = {};
//       if (from) filter.periodFrom.$gte = new Date(from);
//       if (to) filter.periodFrom.$lte = new Date(to);
//     }

//     const [data, total] = await Promise.all([
//       this.payoutSettlementModel
//         .find(filter)
//         .sort({ createdAt: -1 })
//         .skip((page - 1) * limit)
//         .limit(limit),

//       this.payoutSettlementModel.countDocuments(filter),
//     ]);

//     return {
//       data,
//       total,
//       page,
//       limit,
//     };
//   }

//   async markAsPaid(id: string) {
//     const settlement = await this.payoutSettlementModel.findById(id);
//     if (!settlement) throw new NotFoundException('Settlement not found');
//     if (settlement.status !== 'exported')
//       throw new BadRequestException('Settlement already processed');

//     const paidAt = new Date();

//     // 1. group theo author
//     const groups = await this.withdrawModel.aggregate([
//       {
//         $match: {
//           _id: { $in: settlement.withdrawIds },
//           status: 'settled'
//         }
//       },
//       {
//         $group: {
//           _id: '$authorId',
//           total: { $sum: '$withdraw_point' }
//         }
//       }
//     ]);

//     // 2. bulk update user
//     if (groups.length) {
//       await this.userModel.bulkWrite(
//         groups.map(g => ({
//           updateOne: {
//             filter: { _id: g._id },
//             update: {
//               $inc: {
//                 locked_point: -g.total,
//                 author_point: -g.total
//               }
//             }
//           }
//         }))
//       );
//     }

//     // 3. update withdraw
//     await this.withdrawModel.updateMany(
//       {
//         _id: { $in: settlement.withdrawIds },
//         status: 'settled'
//       },
//       {
//         $set: { status: 'paid', paidAt }
//       }
//     );

//     // 4. update settlement
//     settlement.status = 'paid';
//     settlement.paidAt = paidAt;
//     await settlement.save();

//     const paidWithdraws = await this.withdrawModel.find({
//       _id: { $in: settlement.withdrawIds },
//     });

//     // for (const w of paidWithdraws) {
//     //   await this.withdrawReportService.sendWithdrawReceiptEmail(w, 'paid');
//     // }

//     return { success: true };
//   }

//   // ===== Thanh toán thuế =====
//   async findAllTax(query: any) {
//     const { page = 1, limit = 20, status, month, year } = query;

//     const filter: any = {};

//     if (status) filter.status = status;
//     if (month) filter.month = Number(month);
//     if (year) filter.year = Number(year);

//     const [data, total] = await Promise.all([
//       this.taxSettlementModel
//         .find(filter)
//         .sort({ createdAt: -1 })
//         .skip((page - 1) * limit)
//         .limit(limit)
//         .populate('items.author', 'username email'),

//       this.taxSettlementModel.countDocuments(filter),
//     ]);

//     return {
//       data,
//       total,
//       page,
//       limit,
//     };
//   }

//   async confirmTaxPaid(
//     id: string,
//     financialId: string,
//     receiptNumber: string,
//     files?: Express.Multer.File[],
//   ) {
//     const taxSettlement = await this.taxSettlementModel.findById(id);

//     if (!taxSettlement) {
//       throw new NotFoundException('Tax Settlement not found');
//     }

//     if (taxSettlement.status === 'paid') {
//       throw new BadRequestException('Tax already confirmed');
//     }

//     if (!receiptNumber) {
//       throw new BadRequestException('Receipt number required');
//     }

//     const proofFiles = await this.saveProofFiles(id, files);

//     taxSettlement.status = 'paid';
//     taxSettlement.receiptNumber = receiptNumber;
//     taxSettlement.proofFiles = proofFiles ?? [];
//     taxSettlement.paidAt = new Date();
//     taxSettlement.paidBy = new Types.ObjectId(financialId);

//     await taxSettlement.save();

//     // GỬI MAIL
//     await this.sendTaxSettlementEmailToAdmins(
//       taxSettlement,
//       proofFiles,
//     );

//     return { success: true };
//   }

//   private async saveProofFiles(
//     taxId: string,
//     files?: Express.Multer.File[],
//   ) {
//     if (!files?.length) return [];

//     const basePath = path.join('public', 'proof-files', taxId);

//     await fs.promises.mkdir(basePath, { recursive: true });

//     const savedPaths: string[] = [];

//     for (const file of files) {
//       const filename = `${Date.now()}-${file.originalname}`;
//       const fullPath = path.join(basePath, filename);

//       await fs.promises.writeFile(fullPath, file.buffer);

//       savedPaths.push(`proof-files/${taxId}/${filename}`);
//     }

//     return savedPaths;
//   }

//   private async sendTaxSettlementEmailToAdmins(
//     taxSettlement: any,
//     attachments: string[],
//   ) {
//     const admins = await this.userModel.find({
//       role: 'admin',
//       email: { $exists: true },
//     });

//     if (!admins.length) return;

//     const emails = admins.map(a => a.email);

//     await this.mailerService.sendMail({
//       to: emails,
//       subject: `Tax Settlement Completed - ${taxSettlement._id}`,
//       template: './taxSettlementReceipt',
//       attachments: attachments.map(path => ({
//         filename: path.split('/').pop(),
//         path: `public/${path}`, // nodemailer đọc file local
//       })),
//       context: {
//         settlementId: taxSettlement._id,
//         receiptNumber: taxSettlement.receiptNumber,
//         paidAt: taxSettlement.paidAt.toLocaleString('vi-VN'),
//         totalTax: taxSettlement.totalTax.toLocaleString(),
//         withdrawCount: taxSettlement.withdrawCount,
//         authorCount: taxSettlement.authorCount,
//         platformName: 'MangaWord',
//       },
//     });
//   }
// }