import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ timestamps: true })
export class Reply {
    @Prop({ type: Types.ObjectId, ref: 'Comment', required: true })
    comment_id: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Manga', required: true })
    chapter_id: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    user_id: Types.ObjectId;

    @Prop({ type: String })
    content: string
}
export const ReplySchema = SchemaFactory.createForClass(Reply);
