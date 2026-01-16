import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

export enum TaxType {
    PLATFORM = 'PLATFORM', // thuế doanh nghiệp
    AUTHOR = 'AUTHOR',     // thuế TNCN tác giả
}

export enum TaxStatus {
    DRAFT = 'DRAFT',
    DECLARED = 'DECLARED',
    PAID = 'PAID',
}

@Schema({ timestamps: true })
export class TaxSettlement {

    // Phân loại thuế
    @Prop({ type: String, enum: TaxType, required: true })
    type: TaxType;

    // Author
    @Prop({ type: Types.ObjectId, ref: 'User' })
    authorId?: Types.ObjectId;

    @Prop()
    withdrawId?: Types.ObjectId;

    @Prop()
    totalPoint?: number; // tổng điểm rút

    // Chung
    @Prop({ required: true })
    grossAmount: number; // tiền trước thuế (VND)

    @Prop({ required: true })
    taxRate: number; // 0.2 hoặc 0.015

    @Prop({ required: true })
    taxAmount: number; // số tiền thuế

    @Prop({ required: true })
    netAmount: number; // tiền sau thuế

    // Flatform
    @Prop()
    year?: number;

    // Status
    @Prop({
        type: String,
        enum: TaxStatus,
        default: TaxStatus.DRAFT,
    })
    status: TaxStatus;

    @Prop()
    paidAt?: Date;
}

export type TaxSettlementDocument = TaxSettlement & Document;
export const TaxSettlementSchema =
    SchemaFactory.createForClass(TaxSettlement);
