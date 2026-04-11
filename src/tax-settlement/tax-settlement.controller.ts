import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Query,
  Res,
  BadRequestException,
  NotFoundException,
  Param,
  Patch,
  Req,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { TaxSettlementService } from './tax-settlement.service';
import express from 'express';
import { AccessTokenGuard } from 'src/common/guards/access-token.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import { extname, join } from 'path';
import { createReadStream, existsSync, mkdirSync } from 'fs';
import archiver from 'archiver';
import { AnyFilesInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';

@Controller('api/tax-settlement')
export class TaxSettlementController {
  constructor(private readonly taxSettlementService: TaxSettlementService) { }

  private getQuarter(date: Date) {
    const m = new Date(date).getMonth() + 1;
    return Math.ceil(m / 3);
  }

  @Get()
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.FINANCIAL_MANAGER)
  async findAllTax(@Query() query: any) {
    return this.taxSettlementService.findAll(query);
  }

  @Post('export')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.FINANCIAL_MANAGER)
  async exportAndDownload(
    @Body('from') from: string,
    @Body('to') to: string,
    @Body('reportType') reportType: 'QUARTERLY' | 'ANNUAL',
    @Body('year') year: number,
    @Res() res: express.Response,
  ) {
    if (!from || !to || !reportType || !year) {
      throw new BadRequestException('Vui lòng cung cấp đầy đủ: from, to, reportType, year');
    }

    const { files } = await this.taxSettlementService.exportTaxSettlement(
      new Date(from),
      new Date(to),
      reportType,
      year,
    );

    if (!files.length) {
      throw new NotFoundException('Không có file để tải');
    }

    // ===== TRƯỜNG HỢP ANNUAL: ZIP NHIỀU FILE =====
    if (reportType === 'ANNUAL') {

      const zipName = `tax-settlement-annual-${year}.zip`;

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${zipName}"`
      );

      const archive = archiver('zip', {
        zlib: { level: 9 }
      });

      archive.pipe(res);

      for (const file of files) {
        if (existsSync(file.filePath)) {
          archive.file(file.filePath, {
            name: file.fileName
          });
        }
      }

      await new Promise<void>((resolve, reject) => {

        archive.on('error', reject);

        res.on('close', resolve);
        res.on('finish', resolve);

        archive.finalize();

      });

      return;
    }

    // ===== TRƯỜNG HỢP QUARTERLY: FILE ĐƠN =====
    const file = files[0];
    if (!existsSync(file.filePath)) throw new NotFoundException('File không tồn tại');

    // Case Quarterly (File đơn)
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=${encodeURIComponent(file.fileName)}`,
    });

    const fileStream = createReadStream(file.filePath);
    fileStream.pipe(res);
  }

  // 3. Download lại từ lịch sử
  @Get('download/:id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.FINANCIAL_MANAGER)
  async downloadAgain(
    @Param('id') id: string,
    @Res() res: express.Response,
  ) {

    const settlement = await this.taxSettlementService.findById(id);

    if (!settlement.fileName || !settlement.fileName.length) {
      throw new NotFoundException('Không có file');
    }

    const baseDir =
      settlement.reportType === 'ANNUAL'
        ? join(process.cwd(), 'public', 'tax-file', `${settlement.year}`, 'ANNUAL')
        : join(
          process.cwd(),
          'public',
          'tax-file',
          `${settlement.year}`,
          `Q${this.getQuarter(settlement.periodFrom)}`,
        );

    const files = settlement.fileName.map((name) => ({
      fileName: name,
      filePath: join(baseDir, name),
    }));

    if (settlement.reportType === 'ANNUAL') {

      const zipName = `tax-settlement-annual-${settlement.year}.zip`;

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(zipName)}`
      );

      const archive = archiver('zip', { zlib: { level: 9 } });

      archive.pipe(res);

      archive.on('error', (err) => {
        throw new BadRequestException(err.message);
      });

      for (const file of files) {
        if (existsSync(file.filePath)) {
          archive.file(file.filePath, { name: file.fileName });
        }
      }

      archive.finalize();

      return;
    }

    const file = files[0];

    if (!existsSync(file.filePath)) {
      throw new NotFoundException('File không tồn tại');
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`
    );

    createReadStream(file.filePath).pipe(res);
  }

  @Patch('pay/:id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.FINANCIAL_MANAGER)
  @UseInterceptors(
    AnyFilesInterceptor({
      storage: diskStorage({
        destination: (req, file, cb) => {
          const taxId = req.params.id;

          const authorId = file.fieldname.split('_')[1];

          const uploadPath = `public/proofFiles/${taxId}/${authorId}`;

          mkdirSync(uploadPath, { recursive: true });

          cb(null, uploadPath);
        },

        filename: (req, file, cb) => {
          const unique =
            Date.now() + '-' + Math.round(Math.random() * 1e9);

          cb(null, unique + extname(file.originalname));
        },
      }),
    }),
  )
  async markAsPaid(
    @Param('id') id: string,
    @Req() req: Request,
    @Body('receiptNumber') receiptNumber?: string,
    @UploadedFiles() files?: Express.Multer.File[],
    @Body('note') note?: string
  ) {
    const paidBy = req['user'].user_id;


    if (!files || files.length === 0) {
      throw new BadRequestException('Vui lòng upload file cho từng author');
    }

    const itemFilesMap = new Map<
      string,
      { authorId: string; files: Express.Multer.File[] }
    >();

    files.forEach((file) => {
      const authorId = file.fieldname.split('_')[1];

      if (!authorId) {
        throw new BadRequestException('File không hợp lệ');
      }

      if (!itemFilesMap.has(authorId)) {
        itemFilesMap.set(authorId, {
          authorId,
          files: [],
        });
      }

      const entry = itemFilesMap.get(authorId);

      if (!entry) {
        throw new BadRequestException('Lỗi xử lý file upload');
      }

      entry.files.push(file);
    });

    const itemFiles = Array.from(itemFilesMap.values());

    const tax = await this.taxSettlementService.findById(id);

    if (tax.status === 'paid') {
      throw new BadRequestException('This settlement already paid');
    }

    const authorsWithoutFiles = tax.items.filter(
      (item) =>
        !itemFiles.some(
          (f) => f.authorId === item.author.toString()
        )
    );

    if (authorsWithoutFiles.length > 0) {
      throw new BadRequestException(
        'Please upload documents for all authors'
      );
    }

    const invalidAuthors = itemFiles.filter(
      (f) => !tax.items.some(
        (item) => item.author.toString() === f.authorId
      )
    );

    if (invalidAuthors.length > 0) {
      throw new BadRequestException('Invalid author upload');
    }

    return this.taxSettlementService.markAsPaid(
      id,
      paidBy,
      receiptNumber,
      itemFiles,
      note
    );
  }

  @Patch('cancel/:id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.FINANCIAL_MANAGER)
  async cancel(
    @Param('id') id: string,
    @Body('note') note: string,
  ) {
    if (!note) throw new BadRequestException('Vui lòng nhập lý do hủy');
    return this.taxSettlementService.cancelSettlement(id, note);
  }

  @Patch('update-paid/:id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.FINANCIAL_MANAGER)
  @UseInterceptors(
    // Sử dụng AnyFilesInterceptor để bắt được các field name động như proofFiles_authorId
    AnyFilesInterceptor({
      storage: diskStorage({
        destination: (req, file, cb) => {
          const taxId = req.params.id;
          // Lấy authorId từ fieldname (ví dụ: proofFiles_65f123...)
          const authorId = file.fieldname.split('_')[1];
          const uploadPath = `public/proofFiles/${taxId}/${authorId}`;

          mkdirSync(uploadPath, { recursive: true });
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, unique + extname(file.originalname));
        },
      }),
    }),
  )
  async updateTaxSettlement(
    @Param('id') id: string,
    @Body('receiptNumber') receiptNumber?: string,
    @Body('note') note?: string,
    @Body('itemFiles') itemFilesRaw?: string,
    @UploadedFiles() allFiles?: Express.Multer.File[],
  ) {
    const parsedItemFiles = itemFilesRaw ? JSON.parse(itemFilesRaw) : [];

    const itemFilesWithFiles = parsedItemFiles.map((item: any) => {
      return {
        authorId: item.authorId,
        remainingFiles: item.remainingFiles || [],
        newFiles: allFiles?.filter(f => f.fieldname === `proofFiles_${item.authorId}`) || []
      };
    });

    return this.taxSettlementService.updatePaidStatus(
      id,
      receiptNumber,
      itemFilesWithFiles,
      note,
    );
  }

  @Get('export/me')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.AUTHOR)
  async exportAuthorProofFiles(
    @Req() req: Request,
    @Res() res: express.Response
  ) {
    const authorId = req['user'].user_id;
    return this.taxSettlementService.downloadAuthorProofFiles(authorId, res);
  }
}