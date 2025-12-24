import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserStoryHistoryDocument = HydratedDocument<UserStoryHistory>;

@Schema({ timestamps: true, collection: 'user_story_history', autoCreate: true })
export class UserStoryHistory {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Story', required: true, index: true })
  story_id: Types.ObjectId;

  // Chương người dùng dừng gần nhất (để "continue reading")
  @Prop({ type: Types.ObjectId, ref: 'Chapter', default: null })
  last_read_chapter: Types.ObjectId | null;

  // Lần gần nhất chạm vào truyện (để sort “Gần đây”)
  @Prop({ type: Date, default: null })
  last_read_at: Date | null;

  // Tùy chọn: phần trăm hoàn thành toàn truyện (materialized, tính lại khi cập nhật chapter)
  @Prop({ type: Number, default: 0, min: 0, max: 100 })
  overall_progress: number;
}

export const UserStoryHistorySchema =
  SchemaFactory.createForClass(UserStoryHistory);

UserStoryHistorySchema.index({ user_id: 1, story_id: 1 }, { unique: true });