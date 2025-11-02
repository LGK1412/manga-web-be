import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types, Document } from "mongoose";

@Schema({ timestamps: true })
export class AchievementProgress {
    @Prop({ type: Types.ObjectId, ref: "User", required: true })
    userId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: "Achievement", required: true })
    achievementId: Types.ObjectId;

    @Prop({ type: Number, default: 0 })
    progressCount: number;

    // Đã hoàn thành chưa
    @Prop({ type: Boolean, default: false })
    isCompleted: boolean;

    // Ngày hoàn thành (nếu có)
    @Prop({ type: Date })
    completedAt: Date;

    @Prop({ type: Boolean, default: false })
    rewardClaimed: boolean
}

export type AchievementProgressDocument = AchievementProgress & Document;
export const AchievementProgressSchema =
    SchemaFactory.createForClass(AchievementProgress);

AchievementProgressSchema.index({ userId: 1, achievementId: 1 }, { unique: true });