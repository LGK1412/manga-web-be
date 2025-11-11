// src/admin-notification/admin-notification.controller.ts
import { Body, Controller, Get, Patch, Post, Delete, Query, Param, Req, BadRequestException } from "@nestjs/common";
import type { Request } from "express";
import { JwtService } from "@nestjs/jwt";
import { AdminNotificationService } from "./admin-notification.service";
import { AdminSendByEmailDto } from "./dto/admin-send-by-email.dto";
import { UserService } from "src/user/user.service";

@Controller("/api/admin/notifications")
export class AdminNotificationController {
  constructor(
    private readonly svc: AdminNotificationService,
    private readonly jwt: JwtService,
    private readonly users: UserService,
  ) {}

  private getAdminPayload(req: Request) {
    const token = req.cookies?.access_token || req.headers["authorization"]?.replace("Bearer ", "");
    if (!token) throw new BadRequestException("Thiếu token");
    const decoded: any = this.jwt.verify(token);
    if (decoded.role !== "admin") throw new BadRequestException("Chỉ admin");
    return decoded;
  }

  // ===== SEND (giữ như bạn đang có) =====
  @Post("send")
  async send(@Body() body: AdminSendByEmailDto, @Req() req: Request) {
    const decoded = this.getAdminPayload(req);

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

  // ===== LIST các noti admin đã gửi =====
  @Get("sent")
  async sent(@Req() req: Request, @Query("status") status?: "Read"|"Unread", @Query("q") q?: string) {
    const decoded = this.getAdminPayload(req);
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

  // ===== Stats nhanh =====
  @Get("stats")
  async stats(@Req() req: Request) {
    const decoded = this.getAdminPayload(req);
    return this.svc.getSentStats(decoded.user_id);
  }

  // ===== Hỗ trợ thao tác hộ (QA/moderation) =====
  @Patch(":id/mark-as-read")
  async markAsRead(@Param("id") id: string, @Body("receiver_id") receiver_id: string, @Req() req: Request) {
    this.getAdminPayload(req);
    if (!receiver_id) throw new BadRequestException("Thiếu receiver_id");
    return this.svc.markAsReadForReceiver(id, receiver_id);
  }

  @Delete(":id")
  async delete(@Param("id") id: string, @Body("receiver_id") receiver_id: string, @Req() req: Request) {
    this.getAdminPayload(req);
    if (!receiver_id) throw new BadRequestException("Thiếu receiver_id");
    return this.svc.deleteForReceiver(id, receiver_id);
  }

  @Patch(":id/toggle-save")
  async toggleSave(@Param("id") id: string, @Body("receiver_id") receiver_id: string, @Req() req: Request) {
    this.getAdminPayload(req);
    if (!receiver_id) throw new BadRequestException("Thiếu receiver_id");
    return this.svc.saveToggleForReceiver(id, receiver_id);
  }
}
