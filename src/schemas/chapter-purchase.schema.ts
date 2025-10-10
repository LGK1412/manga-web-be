import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true })
export class ChapterPurchase {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Chapter', required: true })
  chapterId: Types.ObjectId;

  @Prop({ type: Number, required: true })
  price: number; // lưu lại giá tại thời điểm mua
}

export type ChapterPurchaseDocument = HydratedDocument<ChapterPurchase>;
export const ChapterPurchaseSchema =
  SchemaFactory.createForClass(ChapterPurchase);
