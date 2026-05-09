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
    @Inject(forwardRef(() => NotificationService))
    private readonly noti: NotificationService,

    private readonly users: UserService
  ) { }

  // ================= SEND =================
  async sendToUser({ title, body, receiver_id, sender_id }: SendArgs) {
    const dto = {
      title,
      body,
      receiver_id,
      sender_id,
      deviceId: [],
    };

    // ⚠️ createNotification() trong project có thể return:
    // 1) { noti, pushResult }
    // 2) pushResult trực tiếp
    const result: any = await this.noti.createNotification(dto);

    const pushResult = result?.pushResult ?? result;
    const failedTokens: string[] = pushResult?.failedTokens ?? [];

    if (failedTokens.length) {
      await this.users.removeDeviceId(receiver_id, failedTokens);
    }

    return { success: true };
  }

  // ================= GET =================
  async getSentByAdmin(sender_id: string) {
    const rows = await this.noti.getNotiForSender(sender_id);
    return Array.isArray(rows) ? rows : [];
  }

  async listSentByAdmin(
    sender_id: string,
    query: {
      page?: number;
      limit?: number;
      q?: string;
      saved?: string;
      sort?: string;
      status?: string;
    },
  ) {
    return this.noti.listNotiForSender(sender_id, query);
  }

  async getSentStats(sender_id: string) {
    return this.noti.getSenderNotificationStats(sender_id);
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
