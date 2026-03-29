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

export enum StoryOriginType {
  ORIGINAL = 'original',
  TRANSLATED = 'translated',
  ADAPTED = 'adapted',
  REPOST = 'repost',
  CC_LICENSED = 'cc_licensed',
  PUBLIC_DOMAIN = 'public_domain',
  UNKNOWN = 'unknown',
}

export enum StoryMonetizationType {
  FREE = 'free',
  PAID = 'paid',
}

export enum RightsBasis {
  SELF_DECLARATION = 'self_declaration',
  OWNER_AUTHORIZATION = 'owner_authorization',
  PUBLISHER_CONTRACT = 'publisher_contract',
  OPEN_LICENSE = 'open_license',
  PUBLIC_DOMAIN = 'public_domain',
  UNKNOWN = 'unknown',
}

export enum RightsReviewStatus {
  NOT_REQUIRED = 'not_required',
  DECLARED = 'declared',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  UNDER_CLAIM = 'under_claim',
}

export enum CopyrightClaimStatus {
  NONE = 'none',
  OPEN = 'open',
  RESOLVED = 'resolved',
}

@Schema({ _id: false })
export class MangaRights {
  @Prop({
    type: String,
    enum: Object.values(StoryOriginType),
    default: StoryOriginType.UNKNOWN,
  })
  originType: StoryOriginType;

  @Prop({
    type: String,
    enum: Object.values(StoryMonetizationType),
    default: StoryMonetizationType.FREE,
  })
  monetizationType: StoryMonetizationType;

  @Prop({
    type: String,
    enum: Object.values(RightsBasis),
    default: RightsBasis.UNKNOWN,
  })
  basis: RightsBasis;

  @Prop({ type: Boolean, default: false })
  declarationAccepted: boolean;

  @Prop({ type: Date, default: null })
  declarationAcceptedAt?: Date | null;

  @Prop({ type: String, default: 'v1' })
  declarationVersion: string;

  @Prop({ type: String, default: '' })
  sourceTitle: string;

  @Prop({ type: String, default: '' })
  sourceUrl: string;

  @Prop({ type: String, default: '' })
  licenseName: string;

  @Prop({ type: String, default: '' })
  licenseUrl: string;

  @Prop({ type: [String], default: [] })
  proofFiles: string[];

  @Prop({ type: String, default: '' })
  proofNote: string;

  @Prop({
    type: String,
    enum: Object.values(RightsReviewStatus),
    default: RightsReviewStatus.NOT_REQUIRED,
  })
  reviewStatus: RightsReviewStatus;

  @Prop({ type: Date, default: null })
  reviewedAt?: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  reviewedBy?: Types.ObjectId | null;

  @Prop({ type: String, default: '' })
  rejectReason: string;

  @Prop({
    type: String,
    enum: Object.values(CopyrightClaimStatus),
    default: CopyrightClaimStatus.NONE,
  })
  claimStatus: CopyrightClaimStatus;

  @Prop({ type: Date, default: null })
  claimOpenedAt?: Date | null;

  @Prop({ type: Date, default: null })
  claimResolvedAt?: Date | null;
}

export const MangaRightsSchema = SchemaFactory.createForClass(MangaRights);

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

  // ====== LEGACY LICENSE ======
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

  @Prop({ type: [String], default: [] })
  licenseRejectReasons: string[];

  // ====== RIGHTS (NEW) ======
  @Prop({ type: MangaRightsSchema, default: {} })
  rights: MangaRights;

  @Prop({ type: Boolean, default: false })
  verifiedBadge: boolean;

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
