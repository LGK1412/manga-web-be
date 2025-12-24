import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types } from "mongoose";

@Schema({ timestamps: true })
export class VoteReply {
    @Prop({ type: Types.ObjectId, ref: 'Reply', required: true })
    reply_id: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    user_id: Types.ObjectId;

    @Prop({ type: Boolean, required: false })
    is_up: boolean
}

export const VoteReplySchema = SchemaFactory.createForClass(VoteReply);