import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ timestamps: true })
export class Comment {
  @Prop({ type: Types.ObjectId, ref: 'Chapter', required: true })
  chapter_id: Types.ObjectId;

   @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user_id: Types.ObjectId;

  @Prop({type: String})
  content: string

  @Prop({ type: Boolean, default: false })
  is_delete: boolean;

}
export const CommentSchema = SchemaFactory.createForClass(Comment);
