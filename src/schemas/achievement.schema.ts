
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types } from "mongoose";
import { AchievementType } from "utils/enums/achievementType.enum";

@Schema({ timestamps: true })
export class Achievement {
    @Prop({ type: String, required: true })
    name: string

    @Prop({ type: String })
    description: string

    @Prop({ type: String, enum: AchievementType, required: true })
    type: string;

    @Prop({ type: Number, required: true })
    threshold: number;

    @Prop({
        type: {
            point: { type: Number, default: 0 },
            author_point: { type: Number, default: 0 },
        },
        default: {},
    })
    reward: {
        point?: number;
        author_point?: number;
    };
    @Prop({ type: Boolean, default: true })
    isActive: boolean
}

export type AchievementDocument = Document & Achievement;
export const AchievementSchema = SchemaFactory.createForClass(Achievement)