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
export class AuditLogController {
  constructor(private readonly audit: AuditLogService) {}

  private getUserId(payload: any): string {
    return payload?.userId || payload?.user_id || payload?.user_id?.toString();
  }

  /**
   * ✅ Admin + Content Moderator được xem logs
   */
  @Get()
  @Roles(Role.ADMIN, Role.CONTENT_MODERATOR)
  async list(
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('action') action?: string,
    @Query('status') status?: string,
    @Query('risk') risk?: string,
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

  /**
   * ✅ Admin + Content Moderator xem detail 1 log
   */
  @Get(':id')
  @Roles(Role.ADMIN, Role.CONTENT_MODERATOR)
  async getOne(@Param('id') id: string) {
    return this.audit.findOne(id);
  }

  /**
   * ✅ Admin ONLY markSeen
   */
  @Patch(':id/seen')
  @Roles(Role.ADMIN)
  async markSeen(@Param('id') id: string, @Req() req: Request) {
    const adminId = this.getUserId(req['user']);
    return this.audit.markSeen(id, adminId);
  }

  /**
   * ✅ Admin ONLY approve
   */
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

  /**
   * ✅ Admin ONLY mark all seen
   */
  @Patch('seen-all')
  @Roles(Role.ADMIN)
  async seenAll(@Req() req: Request) {
    const adminId = this.getUserId(req['user']);
    return this.audit.markAllSeen(adminId);
  }
}
