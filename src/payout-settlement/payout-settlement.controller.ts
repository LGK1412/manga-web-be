import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Res,
  Req,
  UseGuards,
  Body,
  UploadedFiles,
  UseInterceptors,
  NotFoundException,
} from '@nestjs/common';
import { PayoutSettlementService } from './payout-settlement.service';
import express from 'express';
import { AccessTokenGuard } from 'src/common/guards/access-token.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import { FilesInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';

@Controller('api/payout-settlement')
export class PayoutSettlementController {
  constructor(
    private readonly payoutSettlementService: PayoutSettlementService,
    private readonly cloudinaryService: CloudinaryService,
  ) { }

  @Get()
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.FINANCIAL_MANAGER)
  async findAllPayout(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.payoutSettlementService.findAll({
      page: Number(page),
      limit: Number(limit),
      status,
      from,
      to,
    });
  }

  @Patch('pay/:id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.FINANCIAL_MANAGER)
  @UseInterceptors(
    FilesInterceptor('bankBatchRef', 10, {
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 8 * 1024 * 1024,
      },
      fileFilter: (req, file, cb) => {
        const isImage = file.mimetype.startsWith('image/');
        const isPdf = file.mimetype === 'application/pdf';

        if (!isImage && !isPdf) {
          return cb(
            new BadRequestException('Only image or PDF files are allowed'),
            false,
          );
        }

        cb(null, true);
      },
    }),
  )
  async markAsPaid(
    @Param('id') id: string,
    @Req() req: Request,
    @Body('note') note?: string,
    @UploadedFiles() bankBatchRef?: Express.Multer.File[],
  ) {
    const paidBy = req['user'].user_id;

    const uploadedFiles = await this.cloudinaryService.uploadImages(
      bankBatchRef || [],
      `mangaword/bankBatchRef/${id}`,
    );

    const fileUrls = uploadedFiles.map((file) => file.secure_url);

    return this.payoutSettlementService.markAsPaid(
      id,
      paidBy,
      note,
      fileUrls,
    );
  }

  @Get('export')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.FINANCIAL_MANAGER)
  async exportPayoutSettlement(
    @Query('from') from: string,
    @Query('to') to: string,
    @Res() res: express.Response,
  ) {
    if (!from || !to) {
      throw new BadRequestException('from and to are required (YYYY-MM-DD)');
    }

    const periodFrom = new Date(from);
    const periodTo = new Date(to);

    const result = await this.payoutSettlementService.exportPayoutSettlement(
      periodFrom,
      periodTo,
    );

    if (!result) {
      return res.status(204).send();
    }

    return res.redirect(result.fileUrl);
  }

  @Get('download/:id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.FINANCIAL_MANAGER)
  async downloadPayoutExcel(
    @Param('id') id: string,
    @Res() res: express.Response,
  ) {
    const payout = await this.payoutSettlementService.findById(id);

    if (!payout || !payout.fileUrl) {
      throw new NotFoundException('File không tồn tại');
    }

    const response = await fetch(payout.fileUrl);

    if (!response.ok) {
      throw new NotFoundException('Không thể tải file từ Cloudinary');
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(payout.fileName || 'payout.xlsx')}`,
    );

    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    return res.send(buffer);
  }

  @Patch('cancel/:id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.FINANCIAL_MANAGER)
  async cancel(
    @Param('id') id: string,
    @Body('note') note: string,
  ) {
    if (!note) throw new BadRequestException('Please enter rejected reason');

    return this.payoutSettlementService.cancelPayoutSettlement(id, note);
  }

  @Patch('update-paid/:id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.FINANCIAL_MANAGER)
  @UseInterceptors(
    FilesInterceptor('proofFiles', 10, {
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 8 * 1024 * 1024,
      },
      fileFilter: (req, file, cb) => {
        const isImage = file.mimetype.startsWith('image/');
        const isPdf = file.mimetype === 'application/pdf';

        if (!isImage && !isPdf) {
          return cb(
            new BadRequestException('Only image or PDF files are allowed'),
            false,
          );
        }

        cb(null, true);
      },
    }),
  )
  async updatePayoutSettlement(
    @Param('id') id: string,
    @Body('note') note?: string,
    @Body('remainingFiles') remainingFilesRaw?: string,
    @UploadedFiles() newFiles?: Express.Multer.File[],
  ) {
    let remainingFiles: string[] = [];

    try {
      remainingFiles = remainingFilesRaw ? JSON.parse(remainingFilesRaw) : [];
    } catch {
      remainingFiles = [];
    }

    const uploadedFiles = await this.cloudinaryService.uploadImages(
      newFiles || [],
      `mangaword/bankBatchRef/${id}`,
    );

    const newFileUrls = uploadedFiles.map((file) => file.secure_url);

    return this.payoutSettlementService.updatePaidStatus(
      id,
      remainingFiles,
      newFileUrls,
      note,
    );
  }
}