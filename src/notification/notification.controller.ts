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
import type { JwtPayload } from 'src/common/interfaces/jwt-payload.interface';

@Controller('/api/notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * ✅ Endpoint mới (khuyên dùng): lấy tất cả noti của user hiện tại
   */
  @Get('/me')
  @UseGuards(AccessTokenGuard)
  async getMyNotifications(@Req() req: Request) {
    const payload = (req as any).user as JwtPayload;
    return this.notificationService.getAllNotiForUser(payload.userId, payload);
  }

  /**
   * ⚠️ Giữ endpoint cũ để khỏi sửa FE, nhưng check mismatch
   */
  @Get('/get-all-noti-for-user/:id')
  @UseGuards(AccessTokenGuard)
  async getAllNotiForUser(@Param('id') id: string, @Req() req: Request) {
    const payload = (req as any).user as JwtPayload;

    if (id !== payload.userId) {
      throw new BadRequestException('User ID mismatch');
    }

    return this.notificationService.getAllNotiForUser(id, payload);
  }

  @Patch('/mark-noti-as-read/:id')
  @UseGuards(AccessTokenGuard)
  async markNotiAsRead(@Param('id') id: string, @Req() req: Request) {
    const payload = (req as any).user as JwtPayload;
    return this.notificationService.markAsRead(id, payload);
  }

  @Patch('/mark-all-noti-as-read')
  @UseGuards(AccessTokenGuard)
  async markAllNotiAsRead(@Req() req: Request) {
    const payload = (req as any).user as JwtPayload;
    return this.notificationService.markAllAsRead(payload);
  }

  @Delete('/delete-noti/:id')
  @UseGuards(AccessTokenGuard)
  async deleteNoti(@Param('id') id: string, @Req() req: Request) {
    const payload = (req as any).user as JwtPayload;
    return this.notificationService.deleteNoti(id, payload);
  }

  @Patch('/save-noti/:id')
  @UseGuards(AccessTokenGuard)
  async saveNoti(@Param('id') id: string, @Req() req: Request) {
    const payload = (req as any).user as JwtPayload;
    return this.notificationService.saveNoti(id, payload);
  }
}
