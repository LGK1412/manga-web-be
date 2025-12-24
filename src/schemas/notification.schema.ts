import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  sender_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  receiver_id: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  body: string;

  @Prop({ type: Boolean, default: false })
  is_read: boolean;

  @Prop({ type: Boolean, default: false })
  is_save: boolean;

  // TTL field
  @Prop({ type: Date, default: null, required: false })
  expireAt: Date;
}

export type NotificationDocument = HydratedDocument<Notification>;
export const NotificationSchema = SchemaFactory.createForClass(Notification);

// 👉 TTL index
NotificationSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });
