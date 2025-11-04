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
    // lấy device_id người nhận (nếu cần), ở đây NotificationClient phía bạn chỉ cần receiver_id
    const dto = {
      title,
      body,
      deviceId: [],           // microservice có thể tự lấy tokens bằng user_id
      receiver_id,
      sender_id,
    };
    const result = await this.noti.sendNotification(dto);

    // dọn token die nếu có
    await this.users.removeDeviceId(receiver_id, result);
    return { success: true };
  }
}
