import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PoliciesDocument = Policies & Document;

@Schema({ timestamps: true })
export class Policies {
  // 🧩 Tiêu đề chính sách
  @Prop({ required: true })
  title: string;

  // 🧩 Slug duy nhất (vd: "privacy-data-usage")
  @Prop({ required: true, unique: true })
  slug: string;

  // 🧩 Loại chính: TERM hoặc PRIVACY
  @Prop({
    enum: ['TERM', 'PRIVACY'],
    required: true,
  })
  mainType: string;

  // 🧩 Thể loại con (subcategory)
  // ví dụ: ["posting", "data_usage", "comment"]
  @Prop({
    enum: ['posting', 'data_usage', 'comment', 'account', 'general'],
    default: 'general',
  })
  subCategory: string;

  // 🧩 Mô tả ngắn
  @Prop()
  description?: string;

  // 🧩 Nội dung chi tiết
  @Prop({ required: true })
  content: string;

  // 🧩 Trạng thái
  @Prop({
    enum: ['Draft', 'Active', 'Archived'],
    default: 'Draft',
  })
  status: string;

  // 🧩 Công khai hay chỉ nội bộ
  @Prop({ default: false })
  isPublic: boolean;

  // 🧩 Hiệu lực
  @Prop({ type: Date })
  effective_from?: Date;

  @Prop({ type: Date })
  effective_to?: Date;

  // 🧩 Người tạo / cập nhật
  @Prop({ type: Types.ObjectId, ref: 'User' })
  created_by?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updated_by?: Types.ObjectId;
}

export const PoliciesSchema = SchemaFactory.createForClass(Policies);

// ✅ Index đề xuất
PoliciesSchema.index({ mainType: 1, subCategory: 1 });
PoliciesSchema.index({ status: 1 });
PoliciesSchema.index({ isPublic: 1 });
