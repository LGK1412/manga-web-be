import { Injectable, BadRequestException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import * as moment from "moment-timezone";
import { Checkin, CheckinDocument } from "src/schemas/check-in.schema";
import { DAILY_REWARD_CONFIG } from "utils/config/reward.config";
import { User, UserDocument } from "src/schemas/User.schema";

@Injectable()
export class CheckinService {
  constructor(
    @InjectModel(Checkin.name) private checkinModel: Model<CheckinDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>
  ) { }

  private getWeekStart(timezone = "Asia/Ho_Chi_Minh") {
    return moment.tz(timezone).startOf("week").add(1, "day").toDate();
  }

  private async getOrCreateRecord(userId: string) {
    const timezone = "Asia/Ho_Chi_Minh";
    const weekStart = this.getWeekStart(timezone);

    const record = await this.checkinModel.findOneAndUpdate(
      { userId, weekStart },
      { $setOnInsert: { userId, weekStart, checkins: [false, false, false, false, false, false, false] } },
      { new: true, upsert: true }
    );

    return record;
  }

  async checkinToday(userId: string, role: "user" | "author") {
    const timezone = "Asia/Ho_Chi_Minh";
    const todayIndex = moment.tz(timezone).day() - 1; // 0-6

    const record = await this.getOrCreateRecord(userId);

    if (record.checkins[todayIndex]) {
      throw new BadRequestException("Hôm nay đã điểm danh rồi!");
    }

    // Đánh dấu điểm danh
    record.checkins[todayIndex] = true;

    // Tự động nhận thưởng
    const reward = DAILY_REWARD_CONFIG[role][todayIndex];

    const user = await this.userModel.findById(new Types.ObjectId(userId));
    if (!user) throw new BadRequestException("Người dùng không tồn tại");

    if (role === "user" && reward.points) {
      user.point = (user.point || 0) + reward.points;
    } else if (role === "author" && reward.authorPoints) {
      user.author_point = (user.author_point || 0) + reward.authorPoints;
    }

    await Promise.all([record.save(), user.save()]);

    return {
      message: "Điểm danh và nhận quà thành công!",
      checkins: record.checkins,
      reward,
      userPoints: role === "user" ? user.point : user.author_point,
    };
  }

  async getCheckinStatus(userId: string) {
    const timezone = "Asia/Ho_Chi_Minh";
    const today = moment.tz(timezone).day();

    const record = await this.getOrCreateRecord(userId);

    return {
      weekStart: record.weekStart,
      checkins: record.checkins,
      canCheckin: !record.checkins[today - 1],
    };
  }
}
