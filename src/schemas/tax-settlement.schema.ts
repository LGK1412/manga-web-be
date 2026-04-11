import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Document } from 'mongoose';

@Schema()
class TaxItem {

    @Prop({
        type: Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    })
    author: Types.ObjectId;

    @Prop({ required: true })
    authorName: string;

    @Prop({ type: String })
    taxCode: string;

    @Prop({ type: String, required: true })
    citizenId: string;

    @Prop({ type: Number, required: true })
    totalGross: number;

    @Prop({ type: Number, required: true })
    totalTax: number;

    @Prop({ type: Number, required: true })
    totalNet: number;

    @Prop({
        type: [Types.ObjectId],
        ref: 'Withdraw',
        default: [],
    })
    withdrawIds: Types.ObjectId[];

    @Prop({ type: [String], default: [] })
    proofFiles: string[];
}

const TaxItemSchema = SchemaFactory.createForClass(TaxItem);

// Main document
@Schema({ timestamps: true })
export class TaxSettlement {

    @Prop({
        enum: ['QUARTERLY', 'ANNUAL'],
        required: true,
        index: true
    })
    reportType: string;

    @Prop({ type: Date, required: true })
    periodFrom: Date;

    @Prop({ type: Date, required: true })
    periodTo: Date;

    @Prop({ required: true })
    year: number;

    @Prop({ type: [TaxItemSchema], default: [] })
    items: TaxItem[];

    // ----- Cho doanh nghiệp -----
    @Prop({ type: Number, required: true })
    totalGross: number;

    @Prop({ type: Number, required: true })
    totalTax: number;

    @Prop({ type: Number, required: true })
    totalNet: number;
    // ----------------------------

    @Prop({ required: true })
    withdrawCount: number;

    @Prop({ required: true })
    authorCount: number;

    @Prop({
        enum: ['draft', 'exported', 'paid', 'cancelled'],
        default: 'draft',
    })
    status: string;

    @Prop({ type: [String] })
    fileName: string[];

    @Prop()
    receiptNumber?: string;

    @Prop()
    paidAt?: Date;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    paidBy?: Types.ObjectId;

    @Prop()
    note?: string;
}

export type TaxSettlementDocument = TaxSettlement & Document;
export const TaxSettlementSchema =
    SchemaFactory.createForClass(TaxSettlement);