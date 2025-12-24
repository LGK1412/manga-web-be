// src/admin-notification/admin-notification.service.ts
import { Injectable } from "@nestjs/common";
import { NotificationClient } from "src/notification-gateway/notification.client";
import { UserService } from "src/user/user.service";

type SendArgs = { title: string; body: string; receiver_id: string; sender_id: string };

@Injectable()
export class AdminNotificationService {
  constructor(
    private readonly noti: NotificationClient,
    private readonly users: UserService
  ) {}

  async sendToUser({ title, body, receiver_id, sender_id }: SendArgs) {
    const dto = { title, body, deviceId: [], receiver_id, sender_id };
    const result = await this.noti.sendNotification(dto);
    await this.users.removeDeviceId(receiver_id, result);
    return { success: true };
  }

  // ✅ Lấy tất cả thông báo mà admin (sender) đã gửi
  async getSentByAdmin(sender_id: string) {
    const rows = await this.noti.sendGetNotiForSender(sender_id);
    // Đảm bảo trả về mảng
    return Array.isArray(rows) ? rows : [];
  }

  // ✅ Thống kê nhanh
  async getSentStats(sender_id: string) {
    const rows = await this.getSentByAdmin(sender_id);
    const total = rows.length;
    const read = rows.filter((r: any) => r.is_read).length;
    const unread = total - read;
    return { total, read, unread };
  }

  // ✅ Mark-as-read thay mặt user (dùng cho QA/moderation)
  async markAsReadForReceiver(noti_id: string, receiver_id: string) {
    return this.noti.sendMarkAsRead(noti_id, receiver_id);
  }

  // ✅ Delete noti thay mặt user (cần receiver_id để xác thực microservice)
  async deleteForReceiver(noti_id: string, receiver_id: string) {
    return this.noti.deleteNoti(noti_id, receiver_id);
  }

  // ✅ Save/Unsave noti thay mặt user (cần receiver_id)
  async saveToggleForReceiver(noti_id: string, receiver_id: string) {
    return this.noti.sendSaveNoti(noti_id, receiver_id);
  }
}
