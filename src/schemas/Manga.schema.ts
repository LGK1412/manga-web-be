import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MangaDocument = Manga & Document;

export enum MangaLicenseStatus {
  NONE = 'none',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
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

  @Prop({ default: true })
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

  // ====== NEW LICENSE FIELDS ======
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

  // (để UC-106 dùng sau)
  @Prop({ type: Types.ObjectId, ref: 'User' })
  licenseReviewedBy?: Types.ObjectId;

  @Prop({ type: Date })
  licenseReviewedAt?: Date;

  @Prop({ type: String, default: '' })
  licenseRejectReason?: string;
}

export const MangaSchema = SchemaFactory.createForClass(Manga);
