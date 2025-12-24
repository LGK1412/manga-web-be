import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Types } from 'mongoose'
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })
export class ImageChapter {
    @Prop({ type: Types.ObjectId, ref: 'Chapter', required: true })
    chapter_id: Types.ObjectId;

    @Prop({ type: [String], required: true })
    images: string[]

    @Prop({ default: false })
    is_completed: boolean

}
export type ImageChapterDocument = HydratedDocument<ImageChapter>;
export const ImageChapterSchema = SchemaFactory.createForClass(ImageChapter)
