import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import * as firebase from "firebase-admin";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Notification } from "src/schemas/notification.schema";
import { User } from "src/schemas/User.schema";

@Injectable()
export class NotificationService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<Notification>,
    @InjectModel(User.name)
    private readonly userModel: Model<User>
  ) {}

  private getUserId(payload: any): string {
    const uid = payload?.userId ?? payload?.user_id ?? payload?.sub;
    if (!uid) {
      throw new BadRequestException("Missing userId in token payload");
    }
    return String(uid);
  }

  // ===================== USER CHECK =====================
  async checkUser(id: string) {
    if (!id || typeof id !== "string" || id.trim() === "") {
      throw new BadRequestException("Invalid user ID");
    }

    const user = await this.userModel.findById(id);
    if (!user) throw new BadRequestException("User does not exist");

    const role = String(user.role ?? "")
      .trim()
      .toLowerCase();

    // ✅ Tất cả role đều được, riêng admin thì không
    if (role === "admin") {
      throw new BadRequestException("Admin does not have permission");
    }

    if (user.status === "ban") {
      throw new BadRequestException("User is banned");
    }

    return user;
  }

  // ===================== FIREBASE PUSH =====================
  async sendNotification(notification: any) {
    const tokens = Array.isArray(notification.deviceId)
      ? notification.deviceId
      : [notification.deviceId];

    if (!tokens.length) {
      return { successTokens: [], failedTokens: [] };
    }

    const response = await firebase.messaging().sendEachForMulticast({
      tokens,
      notification: {
        title: notification.title,
        body: notification.body,
      },
    });

    const successTokens: string[] = [];
    const failedTokens: string[] = [];

    response.responses.forEach((res, i) => {
      res.success ? successTokens.push(tokens[i]) : failedTokens.push(tokens[i]);
    });

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
      successTokens,
      failedTokens,
    };
  }

  // ===================== CREATE =====================
  async createNotification(notification: any) {
    const noti = new this.notificationModel({
      title: notification.title,
      body: notification.body,
      sender_id: notification.sender_id,
      receiver_id: notification.receiver_id,
    });

    await noti.save();
    return this.sendNotification(notification);
  }

  // ===================== USER APIs =====================
  async getAllNotiForUser(receiver_id: string, payload: any) {
    const uid = this.getUserId(payload);
    await this.checkUser(uid);

    return this.notificationModel.find({ receiver_id }).sort({ createdAt: -1 });
  }

  private escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private toObjectId(value: string) {
    return Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : value;
  }

  private buildNotificationFilter({
    ownerField,
    ownerId,
    q,
    saved,
    status,
  }: {
    ownerField: "receiver_id" | "sender_id";
    ownerId: string;
    q?: string;
    saved?: string;
    status?: string;
  }) {
    const filter: Record<string, any> = {
      [ownerField]: this.toObjectId(ownerId),
    };
    const normalizedStatus = String(status || "").trim().toLowerCase();
    const normalizedSaved = String(saved || "").trim().toLowerCase();
    const search = String(q || "").trim();

    if (normalizedStatus === "read") filter.is_read = true;
    if (normalizedStatus === "unread") filter.is_read = false;
    if (normalizedSaved === "saved" || normalizedSaved === "true") {
      filter.is_save = true;
    }
    if (normalizedSaved === "unsaved" || normalizedSaved === "false") {
      filter.is_save = false;
    }
    if (search) {
      const safeSearch = this.escapeRegex(search);
      filter.$or = [
        { title: { $regex: safeSearch, $options: "i" } },
        { body: { $regex: safeSearch, $options: "i" } },
      ];
    }

    return filter;
  }

  async listNotiForUser(
    receiver_id: string,
    payload: any,
    query: {
      page?: number;
      limit?: number;
      q?: string;
      saved?: string;
      status?: string;
    },
  ) {
    const uid = this.getUserId(payload);
    await this.checkUser(uid);

    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(Math.max(Number(query.limit ?? 10), 1), 100);
    const skip = (page - 1) * limit;
    const filter = this.buildNotificationFilter({
      ownerField: "receiver_id",
      ownerId: receiver_id,
      q: query.q,
      saved: query.saved,
      status: query.status,
    });

    const [items, total] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.notificationModel.countDocuments(filter),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getUserNotificationStats(receiver_id: string, payload: any) {
    const uid = this.getUserId(payload);
    await this.checkUser(uid);

    const ownerId = this.toObjectId(receiver_id);
    const [total, read, saved] = await Promise.all([
      this.notificationModel.countDocuments({ receiver_id: ownerId }),
      this.notificationModel.countDocuments({ receiver_id: ownerId, is_read: true }),
      this.notificationModel.countDocuments({ receiver_id: ownerId, is_save: true }),
    ]);

    return {
      total,
      read,
      unread: total - read,
      saved,
    };
  }

  async markAsRead(id: string, payload: any) {
    const uid = this.getUserId(payload);
    await this.checkUser(uid);

    const noti = await this.notificationModel.findOne({
      _id: id,
      receiver_id: uid,
    });

    if (!noti) throw new NotFoundException("Notification not found");

    noti.is_read = true;
    noti.expireAt = new Date(Date.now() + 14 * 86400000);
    return noti.save();
  }

  async markAllAsRead(payload: any) {
    const uid = this.getUserId(payload);
    await this.checkUser(uid);

    return this.notificationModel.updateMany(
      { receiver_id: uid, is_read: false },
      { $set: { is_read: true } }
    );
  }

  async saveNoti(id: string, payload: any) {
    const uid = this.getUserId(payload);
    await this.checkUser(uid);

    const noti = await this.notificationModel.findOne({
      _id: id,
      receiver_id: uid,
    });

    if (!noti) throw new NotFoundException("Notification not found");

    noti.is_save = !noti.is_save;
    noti.is_read = true;
    noti.expireAt = new Date(Date.now() + 7 * 86400000);

    return noti.save();
  }

  async deleteNoti(id: string, payload: any) {
    const uid = this.getUserId(payload);
    await this.checkUser(uid);

    return this.notificationModel.findOneAndDelete({
      _id: id,
      receiver_id: uid,
    });
  }

  // ===================== ADMIN APIs =====================
  async getNotiForSender(sender_id: string) {
    return this.notificationModel.find({ sender_id }).sort({ createdAt: -1 });
  }

  async listNotiForSender(
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
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(Math.max(Number(query.limit ?? 10), 1), 100);
    const skip = (page - 1) * limit;
    const filter = this.buildNotificationFilter({
      ownerField: "sender_id",
      ownerId: sender_id,
      q: query.q,
      saved: query.saved,
      status: query.status,
    });
    const sortLabel = String(query.sort || "Newest");
    const sort: Record<string, 1 | -1> =
      sortLabel === "Oldest"
        ? { createdAt: 1 }
        : sortLabel === "Title A-Z"
          ? { title: 1, createdAt: -1 }
          : sortLabel === "Title Z-A"
            ? { title: -1, createdAt: -1 }
            : { createdAt: -1 };

    const [items, total] = await Promise.all([
      this.notificationModel.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      this.notificationModel.countDocuments(filter),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getSenderNotificationStats(sender_id: string) {
    const ownerId = this.toObjectId(sender_id);
    const [total, read, saved] = await Promise.all([
      this.notificationModel.countDocuments({ sender_id: ownerId }),
      this.notificationModel.countDocuments({ sender_id: ownerId, is_read: true }),
      this.notificationModel.countDocuments({ sender_id: ownerId, is_save: true }),
    ]);

    return {
      total,
      read,
      unread: total - read,
      saved,
    };
  }

  async markAsReadByAdmin(noti_id: string, receiver_id: string) {
    const noti = await this.notificationModel.findOne({
      _id: noti_id,
      receiver_id,
    });

    if (!noti) throw new NotFoundException("Notification not found");

    noti.is_read = true;
    return noti.save();
  }

  async deleteByAdmin(noti_id: string, receiver_id: string) {
    return this.notificationModel.findOneAndDelete({
      _id: noti_id,
      receiver_id,
    });
  }

  async saveToggleByAdmin(noti_id: string, receiver_id: string) {
    const noti = await this.notificationModel.findOne({
      _id: noti_id,
      receiver_id,
    });

    if (!noti) throw new NotFoundException("Notification not found");

    noti.is_save = !noti.is_save;
    return noti.save();
  }
}
