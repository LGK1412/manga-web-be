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

  async getAllWithProgress(userId: string) {
    return await this.achievementProgressModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate("achievementId")
      .lean();
  }

  async claimReward(userId: string, achievementId: string) {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid user id');
      }

      if (!Types.ObjectId.isValid(achievementId)) {
        throw new BadRequestException('Invalid achievement id');
      }

      const userObjId = new Types.ObjectId(userId);
      const achievementObjId = new Types.ObjectId(achievementId);

      const achievement = await this.achievementModel.findById(achievementObjId);

      if (!achievement?.isActive) {
        throw new NotFoundException('Achievement not found or inactive');
      }

      const progress = await this.achievementProgressModel.findOne({
        userId: userObjId,
        achievementId: achievementObjId,
      });

      if (!progress) {
        throw new NotFoundException('Achievement progress not found');
      }

      if (!progress.isCompleted) {
        throw new BadRequestException('Achievement not completed');
      }

      if (progress.rewardClaimed) {
        throw new BadRequestException('Reward already claimed');
      }

      const rewardPoint = achievement.reward?.point ?? 0;
      const rewardAuthorPoint = achievement.reward?.author_point ?? 0;

      await this.userModel.findByIdAndUpdate(userObjId, {
        $inc: {
          point: rewardPoint,
          author_point: rewardAuthorPoint,
        },
      });

      progress.rewardClaimed = true;
      await progress.save();

      return { success: true };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to claim reward');
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
