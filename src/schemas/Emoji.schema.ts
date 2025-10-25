import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ timestamps: true })
export class Emoji {
    @Prop({ type: String, required: true, unique: true })
    name: string;

    @Prop({ type: [String], default: [] })
    keywords: string[];

    @Prop({ type: [{ src: String }], default: [], _id: false })
    skins: { src: string }[];
}

export const EmojiSchema = SchemaFactory.createForClass(Emoji);
