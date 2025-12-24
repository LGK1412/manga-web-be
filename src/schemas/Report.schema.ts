import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

export type ReportDocument = Report & Document

@Schema({ timestamps: true })
export class Report {
  /** 👤 Người gửi report */
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  reporter_id: Types.ObjectId

  /** 🎯 Loại nội dung bị báo cáo */
  @Prop({
    type: String,
    enum: ['Manga', 'Chapter', 'Comment'], // chỉ 3 loại chính
    required: true,
  })
  target_type: string

  /** 🆔 ID nội dung bị báo cáo (ref động dựa vào target_type) */
  @Prop({
    type: Types.ObjectId,
    refPath: 'target_type',
    required: true,
  })
  target_id: Types.ObjectId

  /** ⚠️ Lý do báo cáo */
  @Prop({
    type: String,
     enum: ['Spam', 'Copyright', 'Inappropriate', 'Harassment', 'Offense', 'Other'],
    required: true,
  })
  reason: string

  /** 📝 Mô tả chi tiết */
  @Prop({ type: String })
  description?: string

  /** 🔄 Trạng thái xử lý */
  @Prop({
    type: String,
    enum: ['new', 'in-progress', 'resolved', 'rejected'],
    default: 'new',
  })
  status: string

  /** 👮‍♂️ Admin xử lý (nếu có) */
  @Prop({ type: Types.ObjectId, ref: 'User' })
  resolver_id?: Types.ObjectId

  /** 📄 Ghi chú xử lý */
  @Prop({ type: String })
  resolution_note?: string
}

export const ReportSchema = SchemaFactory.createForClass(Report)

ReportSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret: any) {
    delete ret.id; // ✅ không lỗi nữa
    return ret;
  },
});

ReportSchema.set('toObject', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret: any) {
    delete ret.id;
    return ret;
  },
});


/** 🧩 Virtual field: hiển thị mã report (RPT-XXXXXX) */
ReportSchema.virtual('reportCode').get(function () {
  return 'RPT-' + this._id.toString().slice(-6).toUpperCase()
})

/** ⚙️ Index tối ưu truy vấn */
ReportSchema.index({ target_type: 1, target_id: 1 })
ReportSchema.index({ status: 1 })
ReportSchema.index({ reporter_id: 1 })
ReportSchema.index({ createdAt: -1 })
