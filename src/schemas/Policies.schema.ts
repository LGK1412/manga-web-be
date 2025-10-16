import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PoliciesDocument = Policies & Document;

@Schema({ timestamps: true })
export class Policies {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true, unique: true })
  slug: string;

  @Prop({
    enum: ['Policy', 'Terms', 'Guidelines', 'Internal'],
    default: 'Policy',
  })
  type: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  content: string;

  @Prop({
    enum: ['Draft', 'Active', 'Archived'],
    default: 'Draft',
  })
  status: string;

  @Prop({ default: false })
  isPublic: boolean;

  @Prop({ type: Date })
  effective_from?: Date;

  @Prop({ type: Date })
  effective_to?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  created_by?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updated_by?: Types.ObjectId;
}

export const PoliciesSchema = SchemaFactory.createForClass(Policies);

// ❌ Xóa index trùng
// PoliciesSchema.index({ slug: 1 }, { unique: true });

// ✅ Giữ lại index phụ
PoliciesSchema.index({ status: 1 });
PoliciesSchema.index({ isPublic: 1 });
