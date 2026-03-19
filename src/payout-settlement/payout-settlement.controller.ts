import { BadRequestException, Controller, Get, Param, Patch, Query, Res, Req, UseGuards, Body, UploadedFiles, UseInterceptors, NotFoundException } from '@nestjs/common';
import { PayoutSettlementService } from './payout-settlement.service';
import express from 'express';
import { AccessTokenGuard } from 'src/common/guards/access-token.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { createReadStream, existsSync, mkdirSync } from 'fs';
import { extname } from 'path';

@Controller('api/payout-settlement')
export class PayoutSettlementController {
  constructor(private readonly payoutSettlementService: PayoutSettlementService) { }

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

  // Thêm mark as pay
  @Patch('pay/:id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.FINANCIAL_MANAGER)
  @UseInterceptors(
    FilesInterceptor('bankBatchRef', 10, {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const payoutId = req.params.id;

          const uploadPath = `public/bankBatchRef/${payoutId}`;

          fs.mkdirSync(uploadPath, { recursive: true });

          cb(null, uploadPath);
        },

        filename: (req, file, cb) => {
          const unique =
            Date.now() + '-' + Math.round(Math.random() * 1e9);

          cb(null, unique + path.extname(file.originalname));
        }
      })
    })
  )
  async markAsPaid(
    @Param('id') id: string,
    @Req() req: Request,
    @Body('note') note?: string,
    @UploadedFiles() bankBatchRef?: Express.Multer.File[],
  ) {
    const paidBy = req['user'].user_id;
    return this.payoutSettlementService.markAsPaid(
      id,
      paidBy,
      note,
      bankBatchRef
    )
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

    const { fileName, filePath } = result;

    if (!existsSync(filePath)) {
      throw new NotFoundException('Error message: File has been created in the DB but not saved on the server.');
    }

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    });

    const fileStream = createReadStream(filePath);

    // Xử lý lỗi trong quá trình stream (nếu có)
    fileStream.on('error', (error) => {
      console.error('Stream error:', error);
      if (!res.headersSent) {
        res.status(500).send('Error while sending file');
      }
    });

    fileStream.pipe(res);
  }

  @Get('download/:id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.FINANCIAL_MANAGER)
  async downloadPayoutExcel(
    @Param('id') id: string,
    @Res() res: express.Response,
  ) {
    const payout = await this.payoutSettlementService.findById(id);

    if (!payout || !payout.fileName) {
      throw new NotFoundException('Thông tin file không tồn tại');
    }

    const filePath = path.join(process.cwd(), 'public', 'payout-files', id, payout.fileName);

    if (!existsSync(filePath)) {
      throw new NotFoundException('File không tồn tại trên server');
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(payout.fileName)}`);

    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    const fileStream = require('fs').createReadStream(filePath);
    fileStream.pipe(res);
  }

  @Patch('cancel/:id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.FINANCIAL_MANAGER)
  async cancel(
    @Param('id') id: string,
    @Body('note') note: string,
  ) {
    if (!note) throw new BadRequestException('Vui lòng nhập lý do hủy');
    return this.payoutSettlementService.cancelPayoutSettlement(id, note);
  }

  @Patch('update-paid/:id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.FINANCIAL_MANAGER)
  @UseInterceptors(
    FilesInterceptor('proofFiles', 10, {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const payoutId = req.params.id;
          const uploadPath = `public/bankBatchRef/${payoutId}`;
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
  async updatePayoutSettlement(
    @Param('id') id: string,
    @Body('note') note?: string,
    @Body('remainingFiles') remainingFilesRaw?: string,
    @UploadedFiles() newFiles?: Express.Multer.File[],
  ) {
    const remainingFiles = remainingFilesRaw ? JSON.parse(remainingFilesRaw) : [];

    return this.payoutSettlementService.updatePaidStatus(
      id,
      remainingFiles,
      newFiles,
      note,
    );
  }

}
