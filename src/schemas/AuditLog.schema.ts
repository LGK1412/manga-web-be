import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AuditLogDocument = AuditLog & Document;

export enum AuditActorRole {
  ADMIN = 'admin',
  CONTENT_MODERATOR = 'content_moderator',
  COMMUNITY_MANAGER = 'community_manager',
  SYSTEM = 'system',
}

export enum AuditApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
}

export enum AuditTargetType {
  REPORT = 'Report',
  MANGA = 'Manga',
  CHAPTER = 'Chapter',
  COMMENT = 'Comment',
  REPLY = 'Reply',

  // ✅ NEW: log hành động lên user
  USER = 'User',
}

@Schema({ timestamps: true })
export class AuditLog {
  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  actor_id?: Types.ObjectId;

  @Prop({ type: String })
  actor_name?: string;

  @Prop({ type: String })
  actor_email?: string;

  @Prop({
    type: String,
    enum: Object.values(AuditActorRole),
    required: true,
  })
  actor_role: AuditActorRole;

  @Prop({ type: String, required: true })
  action: string;

  @Prop({
    type: String,
    enum: Object.values(AuditTargetType),
    required: true,
  })
  target_type: AuditTargetType;

  @Prop({ type: Types.ObjectId, required: true })
  target_id: Types.ObjectId;

  @Prop({ type: String })
  reportCode?: string;

  @Prop({ type: String, required: true })
  summary: string;

  @Prop({ type: String, enum: ['low', 'medium', 'high'], default: 'low' })
  risk: 'low' | 'medium' | 'high';

  @Prop({ type: Boolean, default: false })
  seen: boolean;

  @Prop({
    type: String,
    enum: Object.values(AuditApprovalStatus),
    default: AuditApprovalStatus.PENDING,
  })
  approval: AuditApprovalStatus;

  @Prop({ type: Object })
  before?: Record<string, any>;

  @Prop({ type: Object })
  after?: Record<string, any>;

  @Prop({ type: String })
  note?: string;

  @Prop({ type: [String], default: [] })
  evidenceImages?: string[];

  @Prop({ type: String })
  adminNote?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  approvedBy?: Types.ObjectId;

  @Prop({ type: Date })
  approvedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  seenBy?: Types.ObjectId;

  @Prop({ type: Date })
  seenAt?: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ actor_role: 1 });
AuditLogSchema.index({ target_type: 1, target_id: 1 });
AuditLogSchema.index({ approval: 1 });
AuditLogSchema.index({ seen: 1 });
AuditLogSchema.index({ reportCode: 1 });
