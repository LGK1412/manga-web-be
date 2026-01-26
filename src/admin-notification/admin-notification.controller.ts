// src/admin-notification/admin-notification.controller.ts
import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Query,
  Param,
  Req,
  BadRequestException,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";

import { AdminNotificationService } from "./admin-notification.service";
import { AdminSendByEmailDto } from "./dto/admin-send-by-email.dto";
import { UserService } from "src/user/user.service";

import { AccessTokenGuard } from "src/common/guards/access-token.guard";
import { RolesGuard } from "src/common/guards/roles.guard";
import { Roles } from "src/common/decorators/roles.decorator";
import { Role } from "src/common/enums/role.enum";

@Controller("/api/admin/notifications")
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminNotificationController {
  constructor(
    private readonly svc: AdminNotificationService,
    private readonly users: UserService
  ) {}

  // ✅ helper: support both "userId" and "user_id"
  private getUserId(payload: any): string {
    return payload?.userId || payload?.user_id || payload?.user_id?.toString();
  }

  // ================= SEND =================
  @Post("send")
  async send(@Body() body: AdminSendByEmailDto, @Req() req: Request) {
    const user = req["user"];

    const senderId = this.getUserId(user);
    if (!senderId) {
      throw new BadRequestException("Missing sender_id in token payload");
    }

    let receiverId = body.receiver_id;

    if (!receiverId && body.receiver_email) {
      const userFound = await this.users.findByEmail(body.receiver_email);
      if (!userFound) throw new BadRequestException("Receiver email does not exist");
      receiverId = userFound._id.toString();
    }

    if (!receiverId) {
      throw new BadRequestException("Missing receiver_id or receiver_email");
    }

    return this.svc.sendToUser({
      title: body.title,
      body: body.body,
      receiver_id: receiverId,
      sender_id: senderId,
    });
  }

  // ================= LIST =================
  @Get("sent")
  async sent(
    @Req() req: Request,
    @Query("status") status?: "Read" | "Unread",
    @Query("q") q?: string
  ) {
    const user = req["user"];
    const senderId = this.getUserId(user);

    if (!senderId) {
      throw new BadRequestException("Missing sender_id in token payload");
    }

    let rows = await this.svc.getSentByAdmin(senderId);

    if (status === "Read") rows = rows.filter((r) => r.is_read);
    if (status === "Unread") rows = rows.filter((r) => !r.is_read);

    if (q) {
      const s = q.toLowerCase();
      rows = rows.filter(
        (r) =>
          `${r.title ?? ""}`.toLowerCase().includes(s) ||
          `${r.body ?? ""}`.toLowerCase().includes(s)
      );
    }

    rows.sort(
      (a: any, b: any) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return rows;
  }

  @Get("stats")
  async stats(@Req() req: Request) {
    const user = req["user"];
    const senderId = this.getUserId(user);

    if (!senderId) {
      throw new BadRequestException("Missing sender_id in token payload");
    }

    return this.svc.getSentStats(senderId);
  }

  // ================= ACTIONS =================
  @Patch(":id/mark-as-read")
  async markAsRead(
    @Param("id") id: string,
    @Body("receiver_id") receiver_id: string
  ) {
    if (!receiver_id) throw new BadRequestException("Missing receiver_id");
    return this.svc.markAsReadForReceiver(id, receiver_id);
  }

  @Delete(":id")
  async delete(
    @Param("id") id: string,
    @Body("receiver_id") receiver_id: string
  ) {
    if (!receiver_id) throw new BadRequestException("Missing receiver_id");
    return this.svc.deleteForReceiver(id, receiver_id);
  }

  @Patch(":id/toggle-save")
  async toggleSave(
    @Param("id") id: string,
    @Body("receiver_id") receiver_id: string
  ) {
    if (!receiver_id) throw new BadRequestException("Missing receiver_id");
    return this.svc.saveToggleForReceiver(id, receiver_id);
  }
}
