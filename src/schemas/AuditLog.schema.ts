
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AuditLogDocument = AuditLog & Document;

export enum AuditActorRole {
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
}

@Schema({ timestamps: true })
export class AuditLog {
  /** 🧑 actor (CM/Community/System) */
  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  actor_id?: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(AuditActorRole),
    required: true,
  })
  actor_role: AuditActorRole;

  /** action: approve/reject/hide_content/... */
  @Prop({ type: String, required: true })
  action: string;

  /** target */
  @Prop({
    type: String,
    enum: Object.values(AuditTargetType),
    required: true,
  })
  target_type: AuditTargetType;

  @Prop({ type: Types.ObjectId, required: true })
  target_id: Types.ObjectId;

  /** optional reportCode for quick search UI */
  @Prop({ type: String })
  reportCode?: string;

  /** summary for table */
  @Prop({ type: String, required: true })
  summary: string;

  /** risk for highlighting */
  @Prop({ type: String, enum: ['low', 'medium', 'high'], default: 'low' })
  risk: 'low' | 'medium' | 'high';

  /** admin review */
  @Prop({ type: Boolean, default: false })
  seen: boolean;

  @Prop({
    type: String,
    enum: Object.values(AuditApprovalStatus),
    default: AuditApprovalStatus.PENDING,
  })
  approval: AuditApprovalStatus;

  /** diff */
  @Prop({ type: Object })
  before?: Record<string, any>;

  @Prop({ type: Object })
  after?: Record<string, any>;

  /** moderator note */
  @Prop({ type: String })
  note?: string;

  /** evidence images (urls) */
  @Prop({ type: [String], default: [] })
  evidenceImages?: string[];

  /** admin note */
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
