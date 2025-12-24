import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserChapterProgressDocument = HydratedDocument<UserChapterProgress>;

// Khuyến nghị: đặt tên collection tường minh + bật autoCreate
@Schema({ timestamps: true, collection: 'user_chapter_progress', autoCreate: true })
export class UserChapterProgress {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Chapter', required: true, index: true })
  chapter_id: Types.ObjectId;

  @Prop({ type: Number, required: true, default: 0, min: 0, max: 100 })
  progress: number;

  // Nhanh cho các truy vấn “chương đã xong”
  @Prop({ type: Boolean, default: false })
  is_completed: boolean;

  // Lần cuối người dùng có tương tác với chương này
  @Prop({ type: Date, default: () => new Date() })
  last_read_at: Date;
}

export const UserChapterProgressSchema =
  SchemaFactory.createForClass(UserChapterProgress);

// Tạo unique index để 1 user chỉ có 1 progress/1 chapter
UserChapterProgressSchema.index({ user_id: 1, chapter_id: 1 }, { unique: true });
