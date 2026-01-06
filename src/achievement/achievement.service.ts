import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { AchievementProgress, AchievementProgressDocument } from "src/schemas/achievement-progress.schema";
import { Achievement, AchievementDocument } from "src/schemas/achievement.schema";
import { User, UserDocument } from "src/schemas/User.schema";


@Injectable()
export class AchievementService {
  constructor(
    @InjectModel(Achievement.name)
    private readonly achievementModel: Model<AchievementDocument>,

    @InjectModel(AchievementProgress.name)
    private readonly achievementProgressModel: Model<AchievementProgressDocument>,

    @InjectModel(User.name) private readonly userModel: Model<UserDocument>
  ) { }

  private async checkUser(id: string) {
    const existingUser = await this.userModel.findOne({ _id: id });
    if (!existingUser) {
      throw new BadRequestException('Người dùng không tồn tại');
    }
    if (existingUser.role != "user" && existingUser.role != "author") {
      throw new BadRequestException('Người dùng không có quyền');
    }
    if (existingUser.status == "ban") {
      throw new BadRequestException('Người dùng không có quyền');
    }
    return existingUser;
  }

  async getAllWithProgress(userId: string) {
    await this.checkUser(userId);
    return await this.achievementProgressModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate("achievementId")
      .lean();
  }

  async claimReward(userId: string, achievementId: string) {
    try {
      // Validate userId format
      if (!userId || !Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('ID người dùng không hợp lệ');
      }

      // Validate achievementId format
      if (!achievementId || !Types.ObjectId.isValid(achievementId)) {
        throw new BadRequestException('ID thành tựu không hợp lệ');
      }

      await this.checkUser(userId);
      const userObjId = new Types.ObjectId(userId);
      const achievementObjId = new Types.ObjectId(achievementId);

      // Check achievement exists and is active
      const achievement = await this.achievementModel.findById(achievementObjId);
      if (!achievement) {
        throw new NotFoundException('Thành tựu không tồn tại');
      }
      if (!achievement.isActive) {
        throw new BadRequestException('Thành tựu này đã bị vô hiệu hóa');
      }

      const achievementProgress = await this.achievementProgressModel.findOne({
        userId: userObjId,
        achievementId: achievementObjId,
      });

      if (!achievementProgress) {
        throw new NotFoundException('Tiến độ thành tựu không tồn tại');
      }

      if (!achievementProgress.isCompleted) {
        throw new BadRequestException('Thành tựu chưa hoàn thành');
      }

      if (achievementProgress.rewardClaimed) {
        throw new BadRequestException('Phần thưởng đã được nhận trước đó');
      }

      const rewardPoint = achievement.reward?.point || 0;
      const rewardAuthorPoint = achievement.reward?.author_point || 0;

      // Cộng điểm và exp cho user
      await this.userModel.findByIdAndUpdate(userObjId, {
        $inc: { point: rewardPoint, author_point: rewardAuthorPoint },
      });

      achievementProgress.rewardClaimed = true;
      await achievementProgress.save();

      return {
        success: true,
        message: 'Nhận thưởng thành công!',
        reward: { point: rewardPoint, author_point: rewardAuthorPoint },
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Không thể nhận thưởng thành tựu');
    }
  }

  async syncUserAchievements(userId: string) {
    // Lấy toàn bộ thành tựu đang hoạt động
    const achievements = await this.achievementModel.find({ isActive: true }).lean();

    // Lấy toàn bộ progress hiện tại của user
    const existingProgress = await this.achievementProgressModel
      .find({ userId: new Types.ObjectId(userId) })
      .select("achievementId")
      .lean();

    const existingIds = new Set(
      existingProgress.map((p) => p.achievementId.toString())
    );

    // Tìm những achievement mà user chưa có progress
    const missingAchievements = achievements.filter(
      (a) => !existingIds.has(a._id.toString())
    );

    if (missingAchievements.length > 0) {
      const newProgresses = missingAchievements.map((a) => ({
        userId: new Types.ObjectId(userId),
        achievementId: a._id,
        progressCount: 0,
        isCompleted: false,
        rewardClaimed: false,
      }));

      await this.achievementProgressModel.insertMany(newProgresses);
    }

    return { synced: missingAchievements.length };
  }

  async syncAchievements() {
    const users = await this.userModel.find({
      role: { $in: ['user', 'author'] },
    });

    for (const user of users) {
      await this.syncUserAchievements(user._id.toString());
    }

    return { synced: users.length };
  }

}
