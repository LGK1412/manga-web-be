import {
  Controller,
  Get,
  Patch,
  Query,
  Param,
  Body,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { AuditLogService } from './audit-log.service';
import { AccessTokenGuard } from 'src/common/guards/access-token.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';

@Controller('api/audit-logs')
@UseGuards(AccessTokenGuard, RolesGuard)
export class AuditLogController {
  constructor(private readonly audit: AuditLogService) {}

  private getUserId(payload: any): string {
    return payload?.userId || payload?.user_id || payload?.user_id?.toString();
  }

  @Get()
  @Roles(Role.ADMIN)
  async list(
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('action') action?: string,
    @Query('status') status?: string,
    @Query('risk') risk?: string,
    @Query('dateRange') dateRange?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit = '20',
    @Query('page') page = '1',
  ) {
    return this.audit.findAll({
      search,
      role,
      action,
      status,
      risk,
      dateRange,
      from,
      to,
      limit: Number(limit),
      page: Number(page),
    });
  }

  @Get('export')
  @Roles(Role.ADMIN)
  async exportRows(
    @Res() res: Response,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('action') action?: string,
    @Query('status') status?: string,
    @Query('risk') risk?: string,
    @Query('dateRange') dateRange?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const { filename, stream } = await this.audit.exportCsv({
      search,
      role,
      action,
      status,
      risk,
      dateRange,
      from,
      to,
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');

    await new Promise<void>((resolve, reject) => {
      stream.on('error', reject);
      stream.on('end', resolve);
      stream.pipe(res);
    });
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  async getOne(@Param('id') id: string) {
    return this.audit.findOne(id);
  }

  @Patch(':id/seen')
  @Roles(Role.ADMIN)
  async markSeen(@Param('id') id: string, @Req() req: Request) {
    const adminId = this.getUserId(req['user']);
    return this.audit.markSeen(id, adminId);
  }

  @Patch(':id/approve')
  @Roles(Role.ADMIN)
  async approve(
    @Param('id') id: string,
    @Body('adminNote') adminNote: string,
    @Req() req: Request,
  ) {
    const adminId = this.getUserId(req['user']);
    return this.audit.approve(id, adminId, adminNote);
  }

  @Patch('seen-all')
  @Roles(Role.ADMIN)
  async seenAll(
    @Req() req: Request,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('action') action?: string,
    @Query('status') status?: string,
    @Query('risk') risk?: string,
    @Query('dateRange') dateRange?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const adminId = this.getUserId(req['user']);
    return this.audit.markAllSeen(adminId, {
      search,
      role,
      action,
      status,
      risk,
      dateRange,
      from,
      to,
    });
  }
}
