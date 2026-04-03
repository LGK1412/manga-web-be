import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

export const REPORT_TARGET_TYPES = ['Manga', 'Chapter', 'Comment', 'Reply'] as const
export const REPORT_REASONS = [
  'Spam',
  'Copyright',
  'Inappropriate',
  'Harassment',
  'Offense',
  'Other',
] as const
export const REPORT_STATUSES = ['new', 'in-progress', 'resolved', 'rejected'] as const
export const REPORT_RESOLUTION_ACTIONS = [
  'none',
  'warning_sent',
  'user_banned',
  'user_muted',
] as const
export const REPORT_TIMELINE_TYPES = [
  'report_created',
  'note_added',
  'status_changed',
  'warning_sent',
  'user_banned',
  'user_muted',
  'report_rejected',
] as const

export type ReportDocument = Report & Document

@Schema({ _id: false })
export class ReportTimelineEntry {
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  actor_id?: Types.ObjectId | null

  @Prop({ type: String, default: '' })
  actor_name?: string

  @Prop({ type: String, default: '' })
  actor_email?: string

  @Prop({ type: String, default: '' })
  actor_role?: string

  @Prop({
    type: String,
    enum: REPORT_TIMELINE_TYPES,
    required: true,
  })
  type: string

  @Prop({ type: String, default: '' })
  message: string

  @Prop({ type: Object, default: null })
  meta?: Record<string, any> | null

  @Prop({ type: Date, default: Date.now })
  createdAt: Date
}

export const ReportTimelineEntrySchema =
  SchemaFactory.createForClass(ReportTimelineEntry)

@Schema({ timestamps: true })
export class Report {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  reporter_id: Types.ObjectId

  @Prop({
    type: String,
    enum: REPORT_TARGET_TYPES,
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
    enum: REPORT_REASONS,
    required: true,
  })
  reason: string

  @Prop({ type: String })
  description?: string

  @Prop({
    type: String,
    enum: REPORT_STATUSES,
    default: 'new',
  })
  status: string

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  assignee_id?: Types.ObjectId | null

  @Prop({ type: Date, default: null })
  picked_at?: Date | null

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  resolver_id?: Types.ObjectId | null

  @Prop({ type: Date, default: null })
  resolved_at?: Date | null

  @Prop({
    type: String,
    enum: REPORT_RESOLUTION_ACTIONS,
    default: 'none',
  })
  resolution_action: string

  @Prop({ type: String, default: '' })
  resolution_note?: string

  @Prop({ type: [ReportTimelineEntrySchema], default: [] })
  timeline: ReportTimelineEntry[]
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
ReportSchema.index({ assignee_id: 1, status: 1 })
ReportSchema.index({ createdAt: -1 })
