import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserTransactionDocument = UserTransaction & Document;

@Schema({ timestamps: true })
export class UserTransaction {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    userId: Types.ObjectId;

    @Prop({ type: Number, required: true })
    packageId: number;

    @Prop({ type: Number, required: true })
    price: number;

    @Prop({ type: Number, required: true })
    pointReceived: number;

    @Prop({ type: String, enum: ['pending', 'success', 'failed'], default: 'pending' })
    status: string;

    @Prop()
    paymentUrl?: string;

    @Prop({ type: String, required: true, unique: true, index: true })
    txnRef: string;
}

export const UserTransactionSchema = SchemaFactory.createForClass(UserTransaction);
