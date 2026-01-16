// src/admin-notification/admin-notification.service.ts
import { Injectable, Inject, forwardRef } from "@nestjs/common";
import { NotificationService } from "src/notification/notification.service";
import { UserService } from "src/user/user.service";

type SendArgs = {
  title: string;
  body: string;
  receiver_id: string;
  sender_id: string;
};

@Injectable()
export class AdminNotificationService {
  constructor(
    // ⚠️ BẮT BUỘC forwardRef vì circular
    @Inject(forwardRef(() => NotificationService))
    private readonly noti: NotificationService,

    private readonly users: UserService
  ) {}

  // ================= SEND =================
  async sendToUser({ title, body, receiver_id, sender_id }: SendArgs) {
    const dto = {
      title,
      body,
      receiver_id,
      sender_id,
      deviceId: [],
    };

    const result = await this.noti.createNotification(dto);

    // xoá token lỗi (firebase)
    if (result?.failedTokens?.length) {
      await this.users.removeDeviceId(receiver_id, result.failedTokens);
    }

    return { success: true };
  }

  // ================= GET =================
  async getSentByAdmin(sender_id: string) {
    const rows = await this.noti.getNotiForSender(sender_id);
    return Array.isArray(rows) ? rows : [];
  }

  async getSentStats(sender_id: string) {
    const rows = await this.getSentByAdmin(sender_id);
    const total = rows.length;
    const read = rows.filter((r: any) => r.is_read).length;
    const unread = total - read;
    return { total, read, unread };
  }

  // ================= ADMIN ACTIONS =================
  async markAsReadForReceiver(noti_id: string, receiver_id: string) {
    return this.noti.markAsReadByAdmin(noti_id, receiver_id);
  }

  async deleteForReceiver(noti_id: string, receiver_id: string) {
    return this.noti.deleteByAdmin(noti_id, receiver_id);
  }

  async saveToggleForReceiver(noti_id: string, receiver_id: string) {
    return this.noti.saveToggleByAdmin(noti_id, receiver_id);
  }
}
