import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MangaDocument = Manga & Document;

export enum MangaLicenseStatus {
  NONE = 'none',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum MangaEnforcementStatus {
  NORMAL = 'normal',
  SUSPENDED = 'suspended',
  BANNED = 'banned',
}

@Schema({ timestamps: true })
export class Manga {
  @Prop({ required: true })
  title: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  authorId: Types.ObjectId;

  @Prop({ required: false })
  summary: string;

  @Prop({ required: false })
  coverImage: string;

  // đổi default thành false để đúng flow staff/mod quản lý publish
  @Prop({ default: false })
  isPublish: boolean;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Styles' }], default: [] })
  styles: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Genres' }], default: [] })
  genres: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Rating' }], default: [] })
  rating: Types.ObjectId[];

  @Prop({ enum: ['ongoing', 'completed', 'hiatus'], default: 'ongoing' })
  status: string;

  @Prop({ default: 0 })
  views: number;

  // ====== LICENSE ======
  @Prop({
    type: String,
    enum: Object.values(MangaLicenseStatus),
    default: MangaLicenseStatus.NONE,
  })
  licenseStatus: MangaLicenseStatus;

  @Prop({ type: [String], default: [] })
  licenseFiles: string[];

  @Prop({ type: String, default: '' })
  licenseNote: string;

  @Prop({ type: Date })
  licenseSubmittedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  licenseReviewedBy?: Types.ObjectId;

  @Prop({ type: Date })
  licenseReviewedAt?: Date;

  @Prop({ type: String, default: '' })
  licenseRejectReason?: string;

  // ====== ENFORCEMENT ======
  @Prop({
    type: String,
    enum: Object.values(MangaEnforcementStatus),
    default: MangaEnforcementStatus.NORMAL,
  })
  enforcementStatus: MangaEnforcementStatus;

  @Prop({ type: String, default: '' })
  enforcementReason: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  enforcementUpdatedBy?: Types.ObjectId;

  @Prop({ type: Date })
  enforcementUpdatedAt?: Date;
}

export const MangaSchema = SchemaFactory.createForClass(Manga);