import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';

import { NotificationService } from './notification.service';

import { AccessTokenGuard } from 'src/common/guards/access-token.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import type { JwtPayload } from 'src/common/interfaces/jwt-payload.interface';

@Controller('/api/notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  // ✅ helper: lấy đúng userId từ payload (support cả userId và user_id)
  private getUserId(payload: any): string {
    return payload?.userId || payload?.user_id || payload?.user_id?.toString();
  }

  /**
   * ✅ Endpoint mới (khuyên dùng): lấy tất cả noti của user hiện tại
   */
  @Get('/me')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
  async getMyNotifications(@Req() req: Request) {
    const payload = (req as any).user as JwtPayload;

    const uid = this.getUserId(payload);
    if (!uid) {
      throw new BadRequestException('Missing userId in token payload');
    }

    return this.notificationService.getAllNotiForUser(uid, payload);
  }

  /**
   * ⚠️ Giữ endpoint cũ để khỏi sửa FE, nhưng check mismatch
   */
  @Get('/get-all-noti-for-user/:id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
  async getAllNotiForUser(@Param('id') id: string, @Req() req: Request) {
    const payload = (req as any).user as JwtPayload;

    const uid = this.getUserId(payload);
    if (!uid) {
      throw new BadRequestException('Missing userId in token payload');
    }

    // ✅ so sánh đúng
    if (id !== uid) {
      throw new BadRequestException('User ID mismatch');
    }

    return this.notificationService.getAllNotiForUser(id, payload);
  }

  @Patch('/mark-noti-as-read/:id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
  async markNotiAsRead(@Param('id') id: string, @Req() req: Request) {
    const payload = (req as any).user as JwtPayload;
    return this.notificationService.markAsRead(id, payload);
  }

  @Patch('/mark-all-noti-as-read')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
  async markAllNotiAsRead(@Req() req: Request) {
    const payload = (req as any).user as JwtPayload;
    return this.notificationService.markAllAsRead(payload);
  }

  @Delete('/delete-noti/:id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
  async deleteNoti(@Param('id') id: string, @Req() req: Request) {
    const payload = (req as any).user as JwtPayload;
    return this.notificationService.deleteNoti(id, payload);
  }

  @Patch('/save-noti/:id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
  async saveNoti(@Param('id') id: string, @Req() req: Request) {
    const payload = (req as any).user as JwtPayload;
    return this.notificationService.saveNoti(id, payload);
  }
}