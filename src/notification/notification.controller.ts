import { Body, Controller, Delete, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { AccessTokenGuard } from 'Guards/access-token.guard';

@Controller('/api/notification')
export class NotificationController {
    constructor(private readonly notificationService: NotificationService) { }

    @Get('/get-all-noti-for-user/:id')
    async getAllNotiForUser(@Param('id') id: string, @Req() req: Request) {
        const payload = (req as any).user
        return await this.notificationService.getAllNotiForUser(id, payload)
    }

    @Patch('/mark-noti-as-read/:id')
    @UseGuards(AccessTokenGuard)
    async markNotiAsRead(@Param('id') id: string, @Req() req: Request) {
        const payload = (req as any).user
        return await this.notificationService.markAsRead(id, payload)
    }

    @Patch('/mark-all-noti-as-read')
    @UseGuards(AccessTokenGuard)
    async markAllNotiAsRead(@Req() req: Request) {
        const payload = (req as any).user
        return await this.notificationService.markAllAsRead(payload)
    }

    @Delete('/delete-noti/:id')
    @UseGuards(AccessTokenGuard)
    async deleteNoti(@Param('id') id: string, @Req() req: Request) {
        const payload = (req as any).user
        return await this.notificationService.deleteNoti(id, payload)
    }

    @Patch('/save-noti/:id')
    @UseGuards(AccessTokenGuard)
    async saveNoti(@Param('id') id: string, @Req() req: Request) {
        const payload = (req as any).user
        return await this.notificationService.saveNoti(id, payload)
    }
}
