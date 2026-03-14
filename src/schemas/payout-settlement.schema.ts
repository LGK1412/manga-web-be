import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';


@Schema({ _id: false })
class PayoutItem {

    @Prop({
        type: Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    })
    author: Types.ObjectId;

    @Prop({ required: true })
    bankName: string;

    @Prop({ required: true })
    bankAccount: string;

    @Prop({ required: true })
    bankAccountName: string;

    @Prop({ type: Number, required: true })
    totalNet: number;

    @Prop({
        type: [Types.ObjectId],
        ref: 'Withdraw',
        default: [],
    })
    withdrawIds: Types.ObjectId[];
}

const PayoutItemSchema = SchemaFactory.createForClass(PayoutItem);

@Schema({ timestamps: true })
export class PayoutSettlement {

    @Prop({ type: Date, required: true })
    periodFrom: Date;

    @Prop({ type: Date, required: true })
    periodTo: Date;

    @Prop({ type: Number, required: true })
    year: number;

    @Prop({ type: [PayoutItemSchema], default: [] })
    items: PayoutItem[];

    @Prop({ type: Number, required: true })
    totalNet: number

    @Prop({ type: Number, required: true })
    withdrawCount: number

    @Prop({
        default: 'draft',
        enum: ['draft', 'exported', 'processing', 'paid', 'failed', 'cancelled'],
    })
    status: string;

    @Prop({ type: String, required: true })
    fileName: string //Tên file excel khi xuất

    @Prop({ type: [String] })
    bankBatchRef?: string[]

    @Prop({ type: Date })
    paidAt?: Date

    @Prop({ type: Types.ObjectId, ref: 'User' })
    paidBy?: Types.ObjectId

    @Prop()
    note?: string;

}
export type PayoutSettlementDocument = HydratedDocument<PayoutSettlement>;
export const PayoutSettlementSchema = SchemaFactory.createForClass(PayoutSettlement)

PayoutSettlementSchema.index(
    { periodFrom: 1, periodTo: 1 },
    { unique: true }
);