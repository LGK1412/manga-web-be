
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types } from "mongoose";

@Schema({ timestamps: true })
export class AuthorPayoutProfileHistory {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
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
    @Prop()
    taxCode: string;

    // ===== bank =====
    @Prop({ required: true })
    bankName: string;

    @Prop({ required: true })
    bankAccount: string;

    @Prop({ required: true })
    bankAccountName: string; // thường = fullName

    // ===== kyc documents =====
    @Prop([String])
    identityImages: string[]; // ảnh CCCD mặt trước/sau (S3 path)

    // ===== audit =====

    @Prop({
        enum: ['verified', 'rejected'],
    })
    kycStatus: string;


    @Prop({ required: true })
    changedAt: Date;

    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    changedBy: Types.ObjectId;

    @Prop()
    changeReason: string;

    @Prop()
    version: number;

    createdAt: Date;
    updatedAt: Date;
}

export type AuthorPayoutProfileHistoryDocument = AuthorPayoutProfileHistory & Document
export const AuthorPayoutProfileHistorySchema = SchemaFactory.createForClass(AuthorPayoutProfileHistory)