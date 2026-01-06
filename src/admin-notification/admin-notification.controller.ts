// src/admin-notification/admin-notification.controller.ts
import { Body, Controller, Get, Patch, Post, Delete, Query, Param, Req, BadRequestException, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { JwtService } from "@nestjs/jwt";
import { AdminNotificationService } from "./admin-notification.service";
import { AdminSendByEmailDto } from "./dto/admin-send-by-email.dto";
import { UserService } from "src/user/user.service";
import { AccessTokenAdminGuard } from "Guards/access-token-admin.guard";

@Controller("/api/admin/notifications")
export class AdminNotificationController {
  constructor(
    private readonly svc: AdminNotificationService,
    private readonly jwt: JwtService,
    private readonly users: UserService,
  ) {}

  @Post("send")
  @UseGuards(AccessTokenAdminGuard)
  async send(@Body() body: AdminSendByEmailDto, @Req() req: Request) {
    const decoded = (req as any).admin;

    // Ưu tiên email nếu có
    let receiverId = body.receiver_id;
    if (!receiverId && body.receiver_email) {
      const user = await this.users.findByEmail(body.receiver_email);
      if (!user) throw new BadRequestException("Email người nhận không tồn tại");
      receiverId = user._id.toString();
    }
    if (!receiverId) throw new BadRequestException("Thiếu receiver_id hoặc receiver_email");

    return this.svc.sendToUser({
      title: body.title,
      body: body.body,
      receiver_id: receiverId,
      sender_id: decoded.user_id,
    });
  }

  @Get("sent")
  @UseGuards(AccessTokenAdminGuard)
  async sent(@Req() req: Request, @Query("status") status?: "Read"|"Unread", @Query("q") q?: string) {
    const decoded = (req as any).admin;
    let rows = await this.svc.getSentByAdmin(decoded.user_id);

    // Lọc theo trạng thái
    if (status === "Read") rows = rows.filter((r: any) => r.is_read);
    if (status === "Unread") rows = rows.filter((r: any) => !r.is_read);

    // Search theo title/body
    if (q) {
      const s = q.toLowerCase();
      rows = rows.filter((r: any) =>
        `${r.title ?? ""}`.toLowerCase().includes(s) ||
        `${r.body ?? ""}`.toLowerCase().includes(s)
      );
    }

    // Sắp xếp mới nhất trước
    rows.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return rows;
  }

  @Get("stats")
  @UseGuards(AccessTokenAdminGuard)
  async stats(@Req() req: Request) {
    const decoded = (req as any).admin;
    return this.svc.getSentStats(decoded.user_id);
  }

  @Patch(":id/mark-as-read")
  @UseGuards(AccessTokenAdminGuard)
  async markAsRead(@Param("id") id: string, @Body("receiver_id") receiver_id: string, @Req() req: Request) {
    if (!receiver_id) throw new BadRequestException("Thiếu receiver_id");
    return this.svc.markAsReadForReceiver(id, receiver_id);
  }

  @Delete(":id")
  @UseGuards(AccessTokenAdminGuard)
  async delete(@Param("id") id: string, @Body("receiver_id") receiver_id: string, @Req() req: Request) {
    if (!receiver_id) throw new BadRequestException("Thiếu receiver_id");
    return this.svc.deleteForReceiver(id, receiver_id);
  }

  @Patch(":id/toggle-save")
  @UseGuards(AccessTokenAdminGuard)
  async toggleSave(@Param("id") id: string, @Body("receiver_id") receiver_id: string, @Req() req: Request) {
    if (!receiver_id) throw new BadRequestException("Thiếu receiver_id");
    return this.svc.saveToggleForReceiver(id, receiver_id);
  }
}
