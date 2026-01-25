import {
  Controller,
  Get,
  Patch,
  Query,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { AuditLogService } from './audit-log.service';
import { AccessTokenGuard } from 'src/common/guards/access-token.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';

@Controller('api/audit-logs')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AuditLogController {
  constructor(private readonly audit: AuditLogService) {}

  private getUserId(payload: any): string {
    return payload?.userId || payload?.user_id || payload?._id;
  }

  @Get()
  async list(
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('action') action?: string,
    @Query('status') status?: string, // unseen/seen/pending/approved
    @Query('risk') risk?: string, // low/medium/high
    @Query('limit') limit = '20',
    @Query('page') page = '1',
  ) {
    return this.audit.findAll({
      search,
      role,
      action,
      status,
      risk,
      limit: Number(limit),
      page: Number(page),
    });
  }

  @Patch(':id/seen')
  async markSeen(@Param('id') id: string, @Req() req: Request) {
    const adminId = this.getUserId(req['user']);
    return this.audit.markSeen(id, adminId);
  }

  @Patch('seen-all')
  async markAllSeen(@Req() req: Request) {
    const adminId = this.getUserId(req['user']);
    return this.audit.markAllSeen(adminId);
  }

  @Patch(':id/approve')
  async approve(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: Request,
  ) {
    const adminId = this.getUserId(req['user']);

    // ✅ accept both adminNote & admin_note
    const adminNote = body?.adminNote ?? body?.admin_note ?? body?.adminNote?.trim();

    return this.audit.approve(id, adminId, adminNote);
  }
}
