import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import * as firebase from "firebase-admin";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
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

  // ===================== USER CHECK =====================
  async checkUser(id: string) {
    const user = await this.userModel.findById(id);
    if (!user) throw new BadRequestException("User does not exist");

    if (user.role !== "user" && user.role !== "author") {
      throw new BadRequestException("User does not have permission");
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
    await this.checkUser(payload.user_id);
    return this.notificationModel
      .find({ receiver_id })
      .sort({ createdAt: -1 });
  }

  async markAsRead(id: string, payload: any) {
    await this.checkUser(payload.user_id);

    const noti = await this.notificationModel.findOne({
      _id: id,
      receiver_id: payload.user_id,
    });
    if (!noti) throw new NotFoundException("Notification not found");

    noti.is_read = true;
    noti.expireAt = new Date(Date.now() + 14 * 86400000);
    return noti.save();
  }

  async markAllAsRead(payload: any) {
    await this.checkUser(payload.user_id);

    return this.notificationModel.updateMany(
      { receiver_id: payload.user_id, is_read: false },
      { $set: { is_read: true } }
    );
  }

  async saveNoti(id: string, payload: any) {
    await this.checkUser(payload.user_id);

    const noti = await this.notificationModel.findOne({
      _id: id,
      receiver_id: payload.user_id,
    });
    if (!noti) throw new NotFoundException("Notification not found");

    noti.is_save = !noti.is_save;
    noti.is_read = true;
    noti.expireAt = new Date(Date.now() + 7 * 86400000);

    return noti.save();
  }

  async deleteNoti(id: string, payload: any) {
    await this.checkUser(payload.user_id);
    return this.notificationModel.findOneAndDelete({
      _id: id,
      receiver_id: payload.user_id,
    });
  }

  // ===================== ADMIN APIs =====================
  async getNotiForSender(sender_id: string) {
    return this.notificationModel
      .find({ sender_id })
      .sort({ createdAt: -1 });
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
