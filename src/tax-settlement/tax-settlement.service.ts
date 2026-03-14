import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { TaxSettlement, TaxSettlementDocument } from 'src/schemas/tax-settlement.schema';
import { WithdrawDocument } from 'src/schemas/Withdrawal.schema';
import ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

function startOfDayVN(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setHours(d.getHours() - 7);
  return d;
}

function endOfDayVN(date: Date) {
  const d = new Date(date);
  d.setHours(24, 0, 0, 0);
  d.setHours(d.getHours() - 7);
  return d;
}

@Injectable()
export class TaxSettlementService {
  constructor(
    @InjectModel('Withdraw') private withdrawModel: Model<WithdrawDocument>,
    @InjectModel('TaxSettlement') private taxSettlementModel: Model<TaxSettlementDocument>,
  ) { }

  async findById(id: string): Promise<TaxSettlement> {
    const settlement = await this.taxSettlementModel.findById(id).exec();

    if (!settlement) {
      throw new NotFoundException(`Không tìm thấy bản ghi quyết toán với ID: ${id}`);
    }

    return settlement;
  }

  async findAll(query: any) {
    const {
      page = 1,
      limit = 20,
      status,
      reportType,
      year,
      from,
      to,
    } = query;

    const filter: any = {};

    if (status) filter.status = status;
    if (reportType) filter.reportType = reportType;
    if (year) filter.year = Number(year);

    if (from || to) {
      filter.periodFrom = {};
      if (from) filter.periodFrom.$gte = new Date(from);
      if (to) filter.periodFrom.$lte = new Date(to);
    }

    const [data, total] = await Promise.all([
      this.taxSettlementModel
        .find(filter)
        .populate('items.author', 'username email taxCode')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.taxSettlementModel.countDocuments(filter),
    ]);

    return { data, total };
  }

  private ensureDir(dir: string) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private getQuarter(date: Date) {
    const m = new Date(date).getMonth() + 1;
    return Math.ceil(m / 3);
  }

  async exportTaxSettlement(periodFrom: Date, periodTo: Date, reportType: 'QUARTERLY' | 'ANNUAL', year: number) {
    const withdraws = await this.withdrawModel
      .find({
        status: 'paid',
        paidAt: { $gte: startOfDayVN(periodFrom), $lte: endOfDayVN(periodTo) },
      })
      .populate('authorId')
      .lean();

    if (!withdraws.length) {
      throw new BadRequestException('Không tìm thấy giao dịch nào cần kê khai.');
    }

    const settlement = await this.initTaxSettlementRecord(withdraws, reportType, year, periodFrom, periodTo);

    try {
      const files: { fileName: string; filePath: string }[] = [];

      // ===== File chính 05-QTT =====
      const mainFile = await this.generateExcel(settlement);
      files.push(mainFile);

      // ===== Nếu annual → tạo thêm phụ lục 05-1/BK =====
      if (reportType === 'ANNUAL') {
        const appendixFile = await this.generateAnnualAppendixExcel(settlement);
        files.push(appendixFile);
      }

      // ===== Lưu vào DB =====
      settlement.fileName = files.map(f => f.fileName);

      settlement.status = 'exported';
      await settlement.save();

      // return file đầu tiên để download ngay (tuỳ bạn)
      return {
        settlement,
        files,
      };
    } catch (error) {
      await this.taxSettlementModel.findByIdAndDelete(settlement._id);
      throw new BadRequestException('Lỗi xử lý hồ sơ: ' + error.message);
    }
  }

  private async generateExcel(settlement: TaxSettlementDocument) {
    const isAnnual = settlement.reportType === 'ANNUAL';
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('To Khai 05');

    // Thiết lập cột
    sheet.columns = [
      { key: 'stt', width: 8 },
      { key: 'target', width: 70 },
      { key: 'targetCode', width: 15 },
      { key: 'unit', width: 12 },
      { key: 'value', width: 25 },
    ];

    // Tiêu đề phần I
    const mainTitleRow = sheet.addRow(['I. NGHĨA VỤ KHẤU TRỪ THUẾ (tính chung cho các cá nhân trả thu nhập)']);
    mainTitleRow.getCell(1).font = { bold: true };

    // Header bảng
    const headerRow = sheet.addRow(['STT', 'Chỉ tiêu', 'Mã chỉ tiêu', 'Đơn vị tính', 'Số người/Số tiền']);
    this.applyHeaderStyle(headerRow);

    // Vẽ bảng chính
    const rowsData = this.prepareTaxRows(settlement, isAnnual);
    rowsData.forEach(r => this.renderDataRow(sheet, r));

    // --- NẾU LÀ ANNUAL: VẼ TIẾP BẢNG II (ẢNH 2) ---
    if (isAnnual) {
      sheet.addRow([]); // Dòng trống cách quãng
      const subTitleRow = sheet.addRow(['II. NGHĨA VỤ QUYẾT TOÁN THAY CHO CÁ NHÂN']);
      subTitleRow.getCell(1).font = { bold: true };

      const subHeaderRow = sheet.addRow(['STT', 'Chỉ tiêu', 'Mã chỉ tiêu', 'Đơn vị tính', 'Số người/Số tiền']);
      this.applyHeaderStyle(subHeaderRow);

      const subRows = [
        { stt: 1, target: 'Tổng số cá nhân uỷ quyền cho tổ chức, cá nhân trả thu nhập quyết toán thay', code: 35, unit: 'Người', value: 0 },
        { stt: 2, target: 'Tổng số thuế thu nhập cá nhân đã khấu trừ', code: 36, unit: 'VNĐ', value: settlement.totalTax },
        { stt: null, target: 'Trong đó: Số thuế TNCN đã khấu trừ tại tổ chức trước khi điều chuyển (trường hợp có đánh đấu vào chỉ tiêu [04])', code: 37, unit: 'VNĐ', value: 0 },
        { stt: 3, target: 'Tổng số thuế thu nhập cá nhân phải nộp', code: 38, unit: 'VNĐ', value: settlement.totalTax },
        { stt: 4, target: 'Tổng số thuế TNCN được miễn do cá nhân có số thuế còn phải nộp sau uỷ quyền từ 50.000đ trở xuống', code: 39, unit: 'VNĐ', value: 0 },
        { stt: 5, target: 'Tổng số thuế thu nhập cá nhân còn phải nộp [40] = ([38] – [36] – [39]) > 0', code: 40, unit: 'VNĐ', value: 0 },
        { stt: 6, target: 'Tổng số thuế thu nhập cá nhân đã nộp thừa [41] = ([38] – [36] – [39]) < 0', code: 41, unit: 'VNĐ', value: 0 },
      ];

      subRows.forEach(r => this.renderDataRow(sheet, r));
    }

    // Logic lưu file...
    const fileName = isAnnual ? `05-QTT-${settlement.year}.xlsx` : `05-KK-TNCN-Q${this.getQuarter(settlement.periodFrom)}-${settlement.year}.xlsx`;
    const baseDir = isAnnual ? path.join(process.cwd(), 'public', 'tax-file', `${settlement.year}`, 'ANNUAL') : path.join(process.cwd(), 'public', 'tax-file', `${settlement.year}`, `Q${this.getQuarter(settlement.periodFrom)}`);
    this.ensureDir(baseDir);
    const filePath = path.join(baseDir, fileName);
    await workbook.xlsx.writeFile(filePath);
    return { fileName, filePath };
  }

  // Hàm bổ trợ để tái sử dụng style dòng dữ liệu
  private renderDataRow(sheet: ExcelJS.Worksheet, r: any) {
    const row = sheet.addRow({
      stt: r.stt,
      target: r.target,
      targetCode: r.code,
      unit: r.unit,
      value: r.value,
    });

    row.eachCell((cell, colNumber) => {
      cell.border = this.getThinBorder();

      // Format Mã chỉ tiêu [XX] là Number nhưng hiển thị có ngoặc để không bị Warning
      if (colNumber === 3 && typeof r.code === 'number') {
        cell.numFmt = '"["0"]"';
        cell.alignment = { horizontal: 'center' };
      }
      // Format STT
      else if (colNumber === 1) {
        cell.alignment = { horizontal: 'center' };
        if (typeof r.stt === 'number') cell.numFmt = Number.isInteger(r.stt) ? '0' : '0.0';
      }
      // Format Giá trị tiền/người
      else if (colNumber === 5) {
        cell.alignment = { horizontal: 'right' };
        cell.numFmt = r.unit === 'VNĐ' ? '#,##0' : '0';
      }
      else if (colNumber === 4) {
        cell.alignment = { horizontal: 'center' };
      }

      // Bold các dòng tiêu đề chính (số nguyên)
      if (r.stt && Number.isInteger(r.stt)) {
        cell.font = { bold: true };
      }
    });
  }

  private async generateAnnualAppendixExcel(settlement: TaxSettlementDocument) {
    const workbook = new ExcelJS.Workbook();

    const templatePath = path.join(
      process.cwd(),
      'src',
      'templates',
      '05-1-BK-QTT-TNCN.xlsx',
    );

    await workbook.xlsx.readFile(templatePath);

    const sheet = workbook.worksheets[0]; // sheet đầu tiên

    const START_ROW = 3;

    const items = [...settlement.items].sort((a, b) =>
      a.authorName.localeCompare(b.authorName),
    );

    // Chèn thêm hàng
    if (items.length > 1) {
      // Chèn thêm (n-1) dòng tính từ dòng START_ROW + 1
      sheet.spliceRows(START_ROW + 1, 0, ...new Array(items.length - 1).fill([]));
    }

    items.forEach((item, index) => {
      const row = sheet.getRow(START_ROW + index);

      row.getCell(1).value = index + 1;
      row.getCell(2).value = item.authorName;
      row.getCell(3).value = item.taxCode || '';
      row.getCell(4).value = item.taxCode ? '' : item.citizenId;
      row.getCell(5).value = 'x';
      // Không có cá nhân nước ngoài ủy quyền nên bỏ qua 6
      row.getCell(7).value = item.totalGross;
      row.getCell(8).value = item.totalGross;
      row.getCell(9).value = 0;
      row.getCell(10).value = 0;
      row.getCell(11).value = 0; // Không có người phụ thuộc
      row.getCell(12).value = 0;
      row.getCell(13).value = 0;
      row.getCell(14).value = 0;
      row.getCell(15).value = 0;
      row.getCell(16).value = item.totalGross; // sau khi giảm trừ
      row.getCell(17).value = item.totalTax;
      row.getCell(18).value = item.totalTax;
      row.getCell(19).value = item.totalTax;
      row.getCell(20).value = 0; // Cần tính lại cái này
      row.getCell(21).value = item.totalTax;
      // Số thuế được miểm bỏ 22

      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = this.getThinBorder();
        cell.alignment = { vertical: 'middle', wrapText: true };
      });

      [7, 8, 16, 17, 18, 19, 21].forEach(colIndex => {
        row.getCell(colIndex).numFmt = '#,##0';
        row.getCell(colIndex).alignment = { horizontal: 'right', vertical: 'middle' };
      });

      row.commit();
    });

    // ===== Dòng tổng =====
    const totalRowNumber = START_ROW + items.length;
    const totalRow = sheet.getRow(totalRowNumber);

    totalRow.getCell(6).value = 0;
    totalRow.getCell(7).value = settlement.totalGross;
    totalRow.getCell(8).value = settlement.totalGross;
    totalRow.getCell(9).value = 0;
    totalRow.getCell(10).value = 0;
    totalRow.getCell(11).value = 0;
    totalRow.getCell(12).value = 0;
    totalRow.getCell(13).value = 0;
    totalRow.getCell(14).value = 0;
    totalRow.getCell(15).value = 0;
    totalRow.getCell(16).value = settlement.totalGross;
    totalRow.getCell(17).value = settlement.totalTax;
    totalRow.getCell(18).value = settlement.totalTax;
    totalRow.getCell(19).value = settlement.totalTax;
    totalRow.getCell(20).value = 0;
    totalRow.getCell(21).value = settlement.totalTax;
    totalRow.getCell(22).value = 0;

    [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22].forEach(colIndex => {
      totalRow.getCell(colIndex).font = { bold: true };
      totalRow.getCell(colIndex).numFmt = '#,##0';
    });

    // ===== Lưu =====
    const baseDir = path.join(
      process.cwd(),
      'public',
      'tax-file',
      `${settlement.year}`,
      'ANNUAL',
    );

    this.ensureDir(baseDir);

    const fileName = `05-1-BK-QTT-${settlement.year}.xlsx`;
    const filePath = path.join(baseDir, fileName);

    await workbook.xlsx.writeFile(filePath);

    return { fileName, filePath };
  }

  private applyHeaderStyle(row: ExcelJS.Row) {
    row.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F2F2F2' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = this.getThinBorder();
    });
  }

  private getThinBorder(): Partial<ExcelJS.Borders> {
    return {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  }

  private prepareTaxRows(settlement: any, isAnnual: boolean) {
    // Bảng chính (Phần I)
    const mainRows = [
      { stt: 1, target: 'Tổng số người lao động:', code: 16, unit: 'Người', value: settlement.authorCount },
      { stt: null, target: 'Trong đó: Cá nhân cư trú có hợp đồng lao động', code: 17, unit: 'Người', value: 0 },
      { stt: 2, target: 'Tổng số cá nhân đã khấu trừ thuế [18]=[19]+[20]', code: 18, unit: 'Người', value: settlement.authorCount },
      { stt: 2.1, target: 'Cá nhân cư trú', code: 19, unit: 'Người', value: settlement.authorCount },
      { stt: 2.2, target: 'Cá nhân không cư trú', code: 20, unit: 'Người', value: 0 },
    ];

    if (isAnnual) {
      // Các chỉ tiêu chỉ có ở báo cáo NĂM
      mainRows.push(
        { stt: 3, target: 'Tổng số cá nhân thuộc diện được miễn, giảm thuế theo Hiệp định...', code: 21, unit: 'Người', value: 0 },
        { stt: 4, target: 'Tổng số cá nhân giảm trừ gia cảnh', code: 22, unit: 'Người', value: 0 },
        { stt: 5, target: 'Tổng thu nhập chịu thuế trả cho cá nhân [23]=[24]+[25]', code: 23, unit: 'VNĐ', value: settlement.totalGross },
        { stt: 5.1, target: 'Cá nhân cư trú', code: 24, unit: 'VNĐ', value: settlement.totalGross },
        { stt: 5.2, target: 'Cá nhân không cư trú', code: 25, unit: 'VNĐ', value: 0 },
        { stt: 5.3, target: 'Trong đó: Tổng TNCT từ phí bảo hiểm nhân thọ, bảo hiểm không bắt buộc khác của doanh nghiệp bảo hiểm không thành lập tại Việt Nam cho người lao động', code: 26, unit: 'VNĐ', value: 0 },
        { stt: 6, target: 'Trong đó tổng thu nhập chịu thuế được miễn theo quy định của Hợp đồng dầu khí', code: 27, unit: 'VNĐ', value: 0 },
        { stt: 7, target: 'Tổng thu nhập chịu thuế trả cho cá nhân thuộc diện phải khấu trừ thuế [28]=[29]+[30]', code: 28, unit: 'VNĐ', value: settlement.totalGross },
        { stt: 7.1, target: 'Cá nhân cư trú', code: 29, unit: 'VNĐ', value: settlement.totalGross },
        { stt: 7.2, target: 'Cá nhân không cư trú', code: 30, unit: 'VNĐ', value: 0 },
        { stt: 8, target: 'Tổng số thuế thu nhập cá nhân đã khấu trừ [31]=[32]+[33]', code: 31, unit: 'VNĐ', value: settlement.totalTax },
        { stt: 8.1, target: 'Cá nhân cư trú', code: 32, unit: 'VNĐ', value: settlement.totalTax },
        { stt: 8.2, target: 'Cá nhân không cư trú', code: 33, unit: 'VNĐ', value: 0 },
        { stt: 8.3, target: 'Trong đó: Tổng số thuế TNCN đã khấu trừ trên tiền phí mua bảo hiểm nhân thọ, bảo hiểm không bắt buộc khác của doanh nghiệp bảo hiểm không thành lập tại Việt Nam cho người lao động', code: 34, unit: 'VNĐ', value: 0 }
      );
    } else {
      // Các chỉ tiêu cho QUÝ
      mainRows.push(
        { stt: 3, target: 'Tổng thu nhập chịu thuế trả cho cá nhân [21]=[22]+[23]', code: 21, unit: 'VNĐ', value: settlement.totalGross },
        { stt: 3.1, target: 'Cá nhân cư trú', code: 22, unit: 'VNĐ', value: settlement.totalGross },
        { stt: 3.2, target: 'Cá nhân không cư trú', code: 23, unit: 'VNĐ', value: 0 },
        { stt: 3.3, target: 'Trong đó: Tổng TNCT từ phí bảo hiểm nhân thọ, bảo hiểm không bắt buộc khác của doanh nghiệp bảo hiểm không thành lập tại Việt Nam cho người lao động', code: 24, unit: 'VNĐ', value: 0 },
        { stt: 4, target: 'Trong đó tổng thu nhập chịu thuế được miễn theo Hiệp định dầu khí', code: 25, unit: 'VNĐ', value: 0 },
        { stt: 5, target: 'Tổng thu nhập chịu thuế trả cho cá nhân thuộc diện phải khấu trừ thuế [26]=[27]+[28]', code: 26, unit: 'VNĐ', value: settlement.totalGross },
        { stt: 5.1, target: 'Cá nhân cư trú', code: 27, unit: 'VNĐ', value: settlement.totalGross },
        { stt: 6, target: 'Tổng số thuế thu nhập cá nhân đã khấu trừ [29]=[30]+[31]', code: 29, unit: 'VNĐ', value: settlement.totalTax },
        { stt: 6.1, target: 'Cá nhân cư trú', code: 30, unit: 'VNĐ', value: settlement.totalTax }
      );
    }

    return mainRows;
  }

  private async initTaxSettlementRecord(withdraws: any[], reportType: string, year: number, from: Date, to: Date) {
    const map = new Map<string, any>();
    for (const w of withdraws) {
      const authorId = w.authorId._id.toString();
      if (!map.has(authorId)) {
        map.set(authorId, {
          author: w.authorId._id,
          authorName: w.fullName,
          taxCode: w.taxCode || '',
          citizenId: w.citizenId,
          totalGross: 0, totalTax: 0, totalNet: 0, withdrawIds: [],
        });
      }
      const item = map.get(authorId);
      item.totalGross += w.grossAmount;
      item.totalTax += w.taxAmount;
      item.totalNet += w.netAmount;
      item.withdrawIds.push(w._id);
    }

    const items = Array.from(map.values());
    return await this.taxSettlementModel.create({
      reportType, year, periodFrom: from, periodTo: to,
      items,
      totalGross: items.reduce((s, i) => s + i.totalGross, 0),
      totalTax: items.reduce((s, i) => s + i.totalTax, 0),
      totalNet: items.reduce((s, i) => s + i.totalNet, 0),
      withdrawCount: withdraws.length,
      authorCount: items.length,
      status: 'draft',
      proofFiles: [],
    });
  }

  async markAsPaid(
    id: string,
    userId: string,
    receiptNumber?: string,
    proofFiles: Express.Multer.File[] = [],
    note?: string
  ) {
    const tax = await this.taxSettlementModel.findById(id);
    if (!tax) throw new NotFoundException('Không tìm thấy bản ghi quyết toán');

    tax.status = 'paid';
    tax.paidAt = new Date();
    tax.paidBy = new Types.ObjectId(userId);
    tax.receiptNumber = receiptNumber;
    tax.proofFiles = proofFiles?.map(f => f.filename);
    tax.note = note;

    await tax.save();
    return { success: true }
  }

  async cancelSettlement(id: string, note: string) {
    const tax = await this.taxSettlementModel.findById(id);
    if (!tax) throw new NotFoundException('Không tìm thấy bản ghi');

    tax.status = 'cancelled';
    tax.note = note; // Lưu lý do hủy vào trường note

    await tax.save();
    return { success: true };
  }

  async updatePaidStatus(
    id: string,
    receiptNumber?: string,
    remainingFiles: string[] = [], // Danh sách file cũ Admin giữ lại
    newProofFiles: Express.Multer.File[] = [],
    note?: string,
  ) {
    const tax = await this.taxSettlementModel.findById(id);
    if (!tax) throw new NotFoundException('Không tìm thấy bản ghi');

    const filesToDelete = (tax.proofFiles || []).filter(
      (oldFile) => !remainingFiles.includes(oldFile),
    );

    const uploadDir = path.join(process.cwd(), 'public', 'proofFiles', id);

    filesToDelete.forEach((fileName) => {
      const filePath = path.join(uploadDir, fileName);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath); // Xóa file thực tế khỏi ổ cứng
        }
      } catch (err) {
        console.error(`Lỗi khi xóa file ${fileName}:`, err);
      }
    });

    if (receiptNumber !== undefined) tax.receiptNumber = receiptNumber;
    if (note !== undefined) tax.note = note;

    const newFileNames = newProofFiles.map((f) => f.filename);

    tax.proofFiles = [...remainingFiles, ...newFileNames];

    await tax.save();
    return {
      success: true,
      data: tax
    };
  }
}