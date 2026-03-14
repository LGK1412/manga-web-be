// withdraw-request.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Withdraw {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    authorId: Types.ObjectId;

    @Prop({ required: true })
    withdraw_point: number;

    // ==== TTCN ====
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

    @Prop({ type: Types.ObjectId, ref: 'TaxRule' })
    taxRuleId: Types.ObjectId;

    @Prop()
    taxRate: number;

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

    @Prop([String])
    taxDocuments: string[]; // file MST, hợp đồng, chứng từ khác

    @Prop()
    contractFile: string; // hợp đồng cộng tác (pdf)

    // ==== Quy đổi thành tiền ====
    @Prop({ required: true })
    grossAmount: number;

    @Prop({ required: true })
    taxAmount: number;

    @Prop({ required: true })
    netAmount: number;

    @Prop()
    taxLegalRef: string;

    @Prop({ default: 'pending', enum: ['pending', 'rejected', 'approved', 'settled', 'paid'] })
    status: string;

    @Prop({ required: false })
    note: string;

    @Prop()
    approvedAt?: Date;

    @Prop()
    settledAt?: Date;

    @Prop()
    paidAt?: Date;

    createdAt: Date;
    updatedAt: Date;
}

export type WithdrawDocument = Withdraw & Document;
export const WithdrawSchema = SchemaFactory.createForClass(Withdraw);
WithdrawSchema.index({ status: 1, createdAt: -1 });
WithdrawSchema.index({ authorId: 1 });
