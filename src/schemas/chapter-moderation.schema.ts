import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true })
export class ChapterModeration {
  @Prop({ type: Types.ObjectId, ref: 'Chapter', required: true, unique: true })
  chapter_id: Types.ObjectId;   // 1-1 với chapter (bản hiện hành)

  @Prop({ enum: ['AI_PENDING','AI_PASSED','AI_WARN','AI_BLOCK','NEEDS_REVIEW'], required: true })
  status: 'AI_PENDING'|'AI_PASSED'|'AI_WARN'|'AI_BLOCK'|'NEEDS_REVIEW';

  @Prop({ type: Number, default: 0 })
  risk_score: number;

  @Prop({ type: [String], default: [] })
  labels: string[]; // ví dụ: ["18+","violence","spoiler"]

  @Prop({ type: String, required: true })
  policy_version: string;       // ví dụ: "1.3.0"

  @Prop({ type: String, default: null })
  ai_model: string;             // ví dụ: "classifier_v2.4"

  @Prop({ type: [{ sectionId: String, verdict: String, rationale: String, spans: [{ start: Number, end: Number }] }], default: [] })
  ai_findings: Array<{
    sectionId: string;
    verdict: 'pass'|'warn'|'block';
    rationale: string;
    spans?: { start: number; end: number }[];
  }>;

  @Prop({ type: String, required: true })
  content_hash: string;         // hash nội dung tại thời điểm FE check

  @Prop({ type: Object, default: {} })
  snapshot?: Record<string, any>; // optional meta
}
export type ChapterModerationDocument = HydratedDocument<ChapterModeration>;
export const ChapterModerationSchema = SchemaFactory.createForClass(ChapterModeration);

// indexes
ChapterModerationSchema.index({ status: 1, risk_score: -1 });
ChapterModerationSchema.index({ policy_version: 1 });
