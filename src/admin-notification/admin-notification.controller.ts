// src/admin-notification/admin-notification.controller.ts
import { Body, Controller, Post, Req, BadRequestException } from "@nestjs/common";
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

  @Post("send")
  async send(@Body() body: AdminSendByEmailDto, @Req() req: Request) {
    const token =
      req.cookies?.access_token ||
      req.headers["authorization"]?.replace("Bearer ", "");
    if (!token) throw new BadRequestException("Thiếu token");

    const decoded: any = this.jwt.verify(token);
    if (decoded.role !== "admin") throw new BadRequestException("Chỉ admin");

    // Ưu tiên email nếu có
    let receiverId = body.receiver_id;
    if (!receiverId && body.receiver_email) {
      const user = await this.users.findByEmail(body.receiver_email);
      if (!user) throw new BadRequestException("Email người nhận không tồn tại");
      receiverId = user._id.toString();
    }
    if (!receiverId) {
      throw new BadRequestException("Thiếu receiver_id hoặc receiver_email");
    }

    return this.svc.sendToUser({
      title: body.title,
      body: body.body,
      receiver_id: receiverId,
      sender_id: decoded.user_id,
    });
  }
}
