import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

export type ReportDocument = Report & Document

@Schema({ timestamps: true })
export class Report {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  reporter_id: Types.ObjectId

  @Prop({
    type: String,
    enum: ['Manga', 'Chapter', 'Comment', 'Reply'], // ✅ add Reply
    required: true,
  })
  target_type: string

  @Prop({
    type: Types.ObjectId,
    refPath: 'target_type',
    required: true,
  })
  target_id: Types.ObjectId

  @Prop({
    type: String,
    enum: ['Spam', 'Copyright', 'Inappropriate', 'Harassment', 'Offense', 'Other'],
    required: true,
  })
  reason: string

  @Prop({ type: String })
  description?: string

  @Prop({
    type: String,
    enum: ['new', 'in-progress', 'resolved', 'rejected'],
    default: 'new',
  })
  status: string

  @Prop({ type: Types.ObjectId, ref: 'User' })
  resolver_id?: Types.ObjectId

  @Prop({ type: String })
  resolution_note?: string
}

export const ReportSchema = SchemaFactory.createForClass(Report)

ReportSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret: any) {
    delete ret.id
    return ret
  },
})

ReportSchema.set('toObject', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret: any) {
    delete ret.id
    return ret
  },
})

ReportSchema.virtual('reportCode').get(function () {
  return 'RPT-' + this._id.toString().slice(-6).toUpperCase()
})

ReportSchema.index({ target_type: 1, target_id: 1 })
ReportSchema.index({ status: 1 })
ReportSchema.index({ reporter_id: 1 })
ReportSchema.index({ createdAt: -1 })
