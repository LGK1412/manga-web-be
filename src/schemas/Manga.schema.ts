import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MangaDocument = Manga & Document;

@Schema({ timestamps: true })
export class Manga {
  @Prop({ required: true })
  title: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  authorId: Types.ObjectId;

  @Prop({ required: false })
  summary: string;

  @Prop({ required: false })
  coverImage: string; 
  
  @Prop({ default: true })
  isPublish: boolean;

  @Prop({default: false})
  isDeleted: boolean;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Styles' }], default: [] })
  styles: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Genres' }], default: [] })
  genres: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Rating' }], default: [] })
  rating: Types.ObjectId[];

  @Prop({ enum: ['ongoing', 'completed', 'hiatus'], default: 'ongoing' })
  status: string;

  @Prop({ default: 0 })
  views: number;
}

export const MangaSchema = SchemaFactory.createForClass(Manga);