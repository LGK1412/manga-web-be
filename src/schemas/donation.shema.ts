import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Donation {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    senderId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    receiverId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'DonationItem', required: true })
    itemId: Types.ObjectId;

    @Prop({ type: Number, required: true, min: 1 })
    quantity: number;

    @Prop({ type: Number, required: true })
    totalPrice: number;

    @Prop({ type: Boolean, default: false })
    isRead: boolean;

    // Tin nhắn/ghi chú khi tặng (tùy chọn)
    @Prop({ type: String, maxlength: 200 })
    message?: string;

    @Prop({ type: Date, default: Date.now() })
    createdAt: Date;
}

export type DonationDocument = Donation & Document;
export const DonationSchema = SchemaFactory.createForClass(Donation);
