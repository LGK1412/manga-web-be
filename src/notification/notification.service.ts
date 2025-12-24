import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as firebase from "firebase-admin"
import { Notification } from 'src/schemas/notification.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from 'src/schemas/User.schema';

@Injectable()
export class NotificationService {

    constructor(
        @InjectModel(Notification.name) private notificationModel: Model<Notification>,
        @InjectModel(User.name) private userModel: Model<User>
    ) { }

    async checkUser(id: string) {
        const existingUser = await this.userModel.findOne({ _id: id });
        if (!existingUser) {
            throw new BadRequestException('User does not exist');
        }

        if (existingUser.role != "user" && existingUser.role != "author") {
            throw new BadRequestException('User does not have permission');
        }

        if (existingUser.status == "ban") {
            throw new BadRequestException('User does not have permission');
        }

        return existingUser
    }

    async sendNotification(notification: any) {
        try {
            const tokens = Array.isArray(notification.deviceId)
                ? notification.deviceId
                : [notification.deviceId];

            const response = await firebase.messaging().sendEachForMulticast({
                tokens,
                notification: {
                    title: notification.title,
                    body: notification.body,
                },
                data: {}, // custom payload nếu cần
                android: {
                    priority: "high",
                    notification: {
                        sound: "default",
                        channelId: "default",
                    },
                },
                apns: {
                    headers: { "apns-priority": "10" },
                    payload: {
                        aps: {
                            contentAvailable: true,
                            sound: "default",
                        },
                    },
                },
            });

            const successTokens: string[] = [];
            const failedTokens: string[] = [];

            response.responses.forEach((res, i) => {
                const token = tokens[i];
                if (res.success) {
                    console.log(`✅ Token ${token}, msgId: ${res.messageId}`);
                    successTokens.push(token);
                } else {
                    console.error(`❌ Token ${token} failed:`, res.error);
                    failedTokens.push(token);
                    // 👉 Có thể xóa token lỗi khỏi DB ở đây
                }
            });

            return {
                successCount: response.successCount,
                failureCount: response.failureCount,
                successTokens,
                failedTokens,
            };
        } catch (error) {
            console.error("❌ Error sending multicast:", error);
            return { success: false, error };
        }
    }

    async createNotification(notification: any) {
        const newNoti = new this.notificationModel({
            title: notification.title,
            body: notification.body,
            sender_id: notification.sender_id,
            receiver_id: notification.receiver_id,
        })
        // console.log(notification);
        const result = await newNoti.save()
        if (result._id) {
            return this.sendNotification(notification)
        } else {
            throw new BadRequestException("Error creating notification")
        }
    }

    async getAllNotiForUser(id: string, payload: any) {
        await this.checkUser(payload.user_id)
        return this.notificationModel.find({ receiver_id: id })
    }

    async markAsRead(id: string, payload: any) {
        await this.checkUser(payload.user_id)

        const existingNoti = await this.notificationModel.findOne({ _id: id, receiver_id: payload.user_id });

        if (!existingNoti) {
            throw new BadRequestException('Notification does not exist')
        }

        const expireAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
        const updated = await this.notificationModel.findByIdAndUpdate(
            id,
            { is_read: true, expireAt },
            { new: true } // trả về bản cập nhật mới
        );

        if (!updated) {
            throw new NotFoundException(`Could not mark as read`);
        }

        return updated;
    }

    async deleteNoti(id: string, payload: any) {
        await this.checkUser(payload.user_id)
        const existingNoti = await this.notificationModel.findOne({ _id: id, receiver_id: payload.user_id });

        if (!existingNoti) {
            throw new BadRequestException('Notification does not exist')
        }

        return this.notificationModel.findByIdAndDelete(id)
    }

    async markAllAsRead(payload: any) {
        await this.checkUser(payload.user_id)
        // Tạo expireAt = 7 ngày từ bây giờ
        const expireAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        // Cập nhật tất cả notifications của user
        const result = await this.notificationModel.updateMany(
            { receiver_id: payload.user_id }, // filter
            { $set: { is_read: true, expireAt } } // update
        );

        if (result.matchedCount === 0) {
            throw new BadRequestException('No notifications to update');
        }

        return {
            message: `Updated ${result.modifiedCount} notifications`,
            matchedCount: result.matchedCount,
            modifiedCount: result.modifiedCount,
        };
    }

    async saveNoti(id: string, payload: any) {
        await this.checkUser(payload.user_id)
        // Tìm notification theo id và receiver
        const existingNoti = await this.notificationModel.findOne({ _id: id, receiver_id: payload.user_id });

        if (!existingNoti) {
            throw new BadRequestException('Notification does not exist');
        }

        let updatedFields: any = {};

        if (existingNoti.is_save) {
            // Nếu đang saved, bỏ save và set expire 7 ngày sau
            updatedFields.is_save = false;
            updatedFields.expireAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        } else {
            // Nếu chưa saved, set saved và expireAt = null
            updatedFields.is_save = true;
            updatedFields.expireAt = null;
        }

        // Luôn đánh dấu đã đọc
        updatedFields.is_read = true;

        const updated = await this.notificationModel.findByIdAndUpdate(
            id,
            { $set: updatedFields },
            { new: true } // trả về document đã update
        );

        if (!updated) {
            throw new NotFoundException('Could not update notification');
        }

        return updated;
    }

}
