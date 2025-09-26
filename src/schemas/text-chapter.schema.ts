import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true })
export class TextChapter {
  @Prop({ type: Types.ObjectId, ref: 'Chapter', required: true })
  chapter_id: Types.ObjectId;

  @Prop({ type: String, default: '' })
  content: string;

  @Prop({ type: Boolean, default: false })
  is_completed: boolean;
}
export type TextChapterDocument = HydratedDocument<TextChapter>;
export const TextChapterSchema = SchemaFactory.createForClass(TextChapter);

// (tuỳ chọn) nếu muốn 1-1 mỗi Chapter chỉ có 1 TextChapter:
TextChapterSchema.index({ chapter_id: 1 }, { unique: true });
