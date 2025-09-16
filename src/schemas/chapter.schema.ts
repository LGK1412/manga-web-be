import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Types } from 'mongoose';

@Schema({ timestamps: true })
export class Chapter {
  @Prop({ type: Types.ObjectId, ref: 'Manga', required: true })
  manga_id: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ type: Number, default: 0 })
  price: number;

  @Prop({ type: Number, required: true })
  order: number;

  @Prop({ type: Boolean, default: false })
  is_published: boolean;
}
export type ChapterDocument = HydratedDocument<Chapter>;
export const ChapterSchema = SchemaFactory.createForClass(Chapter);
