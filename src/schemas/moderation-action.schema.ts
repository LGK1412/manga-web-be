import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true })
export class ModerationAction {
  @Prop({ type: Types.ObjectId, ref: 'Chapter', required: true })
  chapter_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  actor_id?: Types.ObjectId; // null/undefined = AI (FE push)

  @Prop({ enum: ['ai_check','recheck','approve','reject','request_changes','redact'], required: true })
  action: 'ai_check'|'recheck'|'approve'|'reject'|'request_changes'|'redact';

  @Prop({ type: String })
  note?: string;

  @Prop({ type: String })
  policy_version?: string;

  @Prop({ type: String })
  ai_model?: string;

  @Prop({ type: Object, default: {} })
  result?: Record<string, any>;
}
export type ModerationActionDocument = HydratedDocument<ModerationAction>;
export const ModerationActionSchema = SchemaFactory.createForClass(ModerationAction);

ModerationActionSchema.index({ chapter_id: 1, createdAt: -1 });
ModerationActionSchema.index({ action: 1, createdAt: -1 });
