import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types, Document } from "mongoose";

@Schema({ timestamps: true })
export class Checkin {
    @Prop({ type: Types.ObjectId, ref: "User", required: true })
    userId: Types.ObjectId;

    @Prop({ type: Date, required: true })
    weekStart: Date;

    @Prop({
        type: [Boolean],
        default: [false, false, false, false, false, false, false],
    })
    checkins: boolean[];
}

export type CheckinDocument = Checkin & Document;
export const CheckinSchema = SchemaFactory.createForClass(Checkin);

CheckinSchema.index({ userId: 1, weekStart: 1 }, { unique: true });
