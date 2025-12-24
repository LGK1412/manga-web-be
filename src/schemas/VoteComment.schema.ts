import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types } from "mongoose";

@Schema({ timestamps: true })
export class VoteComment {
    @Prop({ type: Types.ObjectId, ref: 'Comment', required: true })
    comment_id: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    user_id: Types.ObjectId;

    @Prop({ type: Boolean, required: false })
    is_up: boolean
}

export const VoteCommentSchema = SchemaFactory.createForClass(VoteComment);