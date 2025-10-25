import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ timestamps: true })
export class EmojiPack {
    @Prop({ type: String, required: true })
    name: string;

    // chứa ObjectId của Emoji, không nhét toàn bộ emoji vào đây
    @Prop({ type: [{ type: Types.ObjectId, ref: 'Emoji' }], default: [] })
    emojis: Types.ObjectId[];

    @Prop({ type: Number, default: 0 })
    price:  number

    @Prop({type: Boolean, default: false})
    is_hide: boolean
}

export const EmojiPackSchema = SchemaFactory.createForClass(EmojiPack);
