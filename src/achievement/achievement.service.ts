import { BadRequestException, Injectable } from "@nestjs/common";
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
    const userObjId = new Types.ObjectId(userId);
    const achievementObjId = new Types.ObjectId(achievementId);

    const achievementProgress = await this.achievementProgressModel.findOne({
      userId: userObjId,
      achievementId: achievementObjId,
    });

    if (!achievementProgress)
      throw new BadRequestException("Thành tựu không tồn tại.");

    if (!achievementProgress.isCompleted)
      throw new BadRequestException("Thành tựu chưa hoàn thành.");

    if (achievementProgress.rewardClaimed)
      throw new BadRequestException("Phần thưởng đã được nhận trước đó.");

    const achievement = await this.achievementModel.findById(achievementObjId);
    const rewardPoint = achievement?.reward.point || 0;
    const rewardAuthorPoint = achievement?.reward.author_point || 0;

    // Cộng điểm và exp cho user
    await this.userModel.findByIdAndUpdate(userObjId, {
      $inc: { point: rewardPoint, author_point: rewardAuthorPoint },
    });

    achievementProgress.rewardClaimed = true;
    await achievementProgress.save();

    return {
      message: "Nhận thưởng thành công!",
      reward: { point: rewardPoint, author_point: rewardAuthorPoint },
    };
  }
}
