// withdraw-request.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WithdrawDocument = Withdraw & Document;

@Schema({ timestamps: true })
export class Withdraw {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    authorId: Types.ObjectId; // Người rút (author)

    @Prop({ required: true })
    withdraw_point: number; // Số điểm rút ra

    @Prop({ required: true })
    amount: number; // Số tiền VND tương ứng (points * 150)

    @Prop({ required: true })
    bankCode: string; // Tên ngân hàng

    @Prop({ required: true })
    bankAccount: string; // Số tài khoản

    @Prop({ required: true })
    accountHolder: string; // Chủ tài khoản

    @Prop({ default: 'pending', enum: ['pending', 'completed', 'rejected'] })
    status: string; // Trạng thái rút

    @Prop({ required: false })
    note: string;
}

export const WithdrawSchema = SchemaFactory.createForClass(Withdraw);
