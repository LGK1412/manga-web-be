import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Chapter {
  @Prop({ type: Types.ObjectId, ref: 'Manga', required: true })
  manga_id: Types.ObjectId;

  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: Number, default: 0 })
  price: number;

  @Prop({ type: Number, required: true })
  order: number;

  @Prop({ type: Boolean, default: false })
  is_published: boolean;

  // --- cờ moderation nhẹ ---
  @Prop({ type: Boolean, default: false })
  ai_checked: boolean;

  // ❗ Quan trọng: chỉ định type String + enum, KHÔNG đưa null vào enum
  @Prop({
    type: String,
    enum: ['PASSED', 'WARN', 'BLOCK'],
    default: null, // vẫn cho phép null qua default
  })
  ai_verdict: 'PASSED' | 'WARN' | 'BLOCK' | null;

  @Prop({ type: Number, default: null })
  risk_score: number | null;

  @Prop({ type: String, default: null })
  policy_version: string | null;

  // dùng để invalid kết quả khi author sửa nội dung
  @Prop({ type: String, default: null })
  last_content_hash: string | null;
}

export type ChapterDocument = HydratedDocument<Chapter>;
export const ChapterSchema = SchemaFactory.createForClass(Chapter);

// indexes
ChapterSchema.index({ manga_id: 1, order: 1 }, { unique: true });
ChapterSchema.index({ ai_checked: 1, ai_verdict: 1, risk_score: -1 });
