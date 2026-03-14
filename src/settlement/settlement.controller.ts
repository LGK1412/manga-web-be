// import { Controller, Get, Patch, Param, Query, UseInterceptors, UseGuards, UploadedFiles, Req, Body } from '@nestjs/common';
// import { SettlementService } from './settlement.service';
// import { FilesInterceptor } from '@nestjs/platform-express';
// import { Roles } from 'src/common/decorators/roles.decorator';
// import { AccessTokenGuard } from 'src/common/guards/access-token.guard';
// import { RolesGuard } from 'src/common/guards/roles.guard';
// import { Role } from 'src/common/enums/role.enum';

// @Controller('api/settlement')
// export class SettlementController {
//   constructor(private readonly settlementService: SettlementService) { }

//   // ====== Thanh toán withdraw ======
//   @Get('payout')
//   async findAllPayout(
//     @Query('page') page = 1,
//     @Query('limit') limit = 10,
//     @Query('status') status?: string,
//     @Query('from') from?: string,
//     @Query('to') to?: string,
//   ) {
//     return this.settlementService.findAllPayout({
//       page: Number(page),
//       limit: Number(limit),
//       status,
//       from,
//       to,
//     });
//   }

//   @Patch('payout/:id/pay')
//   async markPayoutAsPaid(
//     @Param('id') id: string
//   ) {
//     return this.settlementService.markAsPaid(id);
//   }
//   // Thêm cancel + thêm xác minh cho pay


//   // ====== Thanh toán thuế (tháng) ======
//   @Get('tax')
//   async getMonthlyTax(
//     @Query('page') page = 1,
//     @Query('limit') limit = 10,
//     @Query('status') status?: string,
//     @Query('month') month?: string,
//     @Query('year') year?: string,
//   ) {
//     return this.settlementService.findAllTax({
//       page: Number(page),
//       limit: Number(limit),
//       status,
//       month,
//       year
//     });
//   }

//   @Patch('tax/:id/confirm-pay')
//   @UseGuards(AccessTokenGuard, RolesGuard)
//   @Roles(Role.ADMIN)
//   @UseInterceptors(FilesInterceptor('proofFiles'))
//   async confirmTax(
//     @Req() req: Request,
//     @Param('id') id: string,
//     @Body('receiptNumber') receiptNumber: string,
//     @UploadedFiles() files: Express.Multer.File[],
//   ) {
//     const financialId = req['user'].user_id;
//     return this.settlementService.confirmTaxPaid(
//       id,
//       financialId,
//       receiptNumber,
//       files,
//     );
//   }
// }
