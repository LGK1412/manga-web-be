import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Achievement, AchievementDocument } from "src/schemas/achievement.schema";
import { AchievementProgress, AchievementProgressDocument } from "src/schemas/achievement-progress.schema";
import { OnEvent } from "@nestjs/event-emitter";

@Injectable()
export class AchievementEventListener {
    private readonly logger = new Logger(AchievementEventListener.name);
    constructor(
        @InjectModel(Achievement.name)
        private readonly achievementModel: Model<AchievementDocument>,

        @InjectModel(AchievementProgress.name)
        private readonly achievementProgressModel: Model<AchievementProgressDocument>,
    ) { }

    @OnEvent("follow_count_increase")
    async handleFollowIncrease(payload: { userId: string }) {
        await this.updateProgress(payload.userId, "follow_count", 1);
    }

    @OnEvent("follow_count_decrease")
    async handleFollowDecrease(payload: { userId: string }) {
        await this.updateProgress(payload.userId, "follow_count", -1);
    }

    @OnEvent("follower_count_increase")
    async handleFollowerFollowed(payload: { userId: string }) {
        await this.updateProgress(payload.userId, "follower_count", 1);
    }

    @OnEvent("follower_count_decrease")
    async handleFollowerRemoved(payload: { userId: string }) {
        await this.updateProgress(payload.userId, "follower_count", -1);
    }

    @OnEvent("comment_count")
    async handleComment(payload: { userId: string }) {
        await this.updateProgress(payload.userId, "comment_count", 1);
    }

    @OnEvent("rating_count")
    async handleRating(payload: { userId: string }) {
        await this.updateProgress(payload.userId, "rating_count", 1)
    }

    @OnEvent("favorite_story_count")
    async handleFavoriteStory(payload: { userId: string }) {
        await this.updateProgress(payload.userId, "favorite_story_count", 1)
    }

    @OnEvent("story_create_count")
    async handleStoryCreate(payload: { userId: string }) {
        await this.updateProgress(payload.userId, "story_create_count", 1)
    }

    @OnEvent("chapter_create_count")
    async handleChaterCreate(payload: { userId: string }) {
        await this.updateProgress(payload.userId, "chapter_create_count", 1)
    }

    @OnEvent("donation_spend_count")
    async handleDonationSpend(payload: { userId: string, amount: number }) {
        await this.updateProgress(payload.userId, "donation_spend_count", payload.amount)
    }

    private async updateProgress(userId: string, type: string, increment = 1) {
        this.logger.log(`[${type}] for user ${userId}`);
        const achievements = await this.achievementModel
            .find({ type })
            .lean();

        if (!achievements.length) return;

        for (const achievement of achievements) {
            const ap = await this.achievementProgressModel.findOne({
                userId: new Types.ObjectId(userId),
                achievementId: achievement._id
            });

            if (!ap) continue;

            if (!ap.isCompleted) {
                ap.progressCount += increment;

                if (ap.progressCount >= achievement.threshold) {
                    ap.isCompleted = true;
                    ap.completedAt = new Date()
                }
                await ap.save();
            }
        }
    }
}