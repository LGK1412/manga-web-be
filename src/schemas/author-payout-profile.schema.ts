
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types } from "mongoose";

@Schema({ timestamps: true })
export class AuthorPayoutProfile {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
    userId: Types.ObjectId;

    @Prop({ required: true })
    fullName: string; // theo CCCD

    @Prop({ required: true })
    citizenId: string; // CCCD/CMND

    @Prop({ required: true })
    dateOfBirth: Date; // CCCD

    @Prop({ required: true })
    address: string; //CCCD

    // ===== tax =====
    @Prop({ type: String })
    taxCode?: string;

    // ===== bank =====
    @Prop({ required: true })
    bankName: string;

    @Prop({ required: true })
    bankAccount: string;

    @Prop({ required: true })
    bankAccountName: string; // thường = fullName

    // ===== kyc documents =====
    @Prop([String])
    identityImages: string[]; // ảnh CCCD mặt trước/sau 

    // ===== verification workflow =====
    @Prop({
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending'
    })
    kycStatus: string;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    verifiedBy: Types.ObjectId;

    @Prop()
    verifiedAt: Date;

    @Prop()
    rejectReason: string;

    // ===== audit =====
    @Prop({ default: true })
    isActive: boolean; // khóa payout nếu sai info

    createdAt: Date;
    updatedAt: Date;
}

export type AuthorPayoutProfileDocument = AuthorPayoutProfile & Document
export const AuthorPayoutProfileSchema = SchemaFactory.createForClass(AuthorPayoutProfile)