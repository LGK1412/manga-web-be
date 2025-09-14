import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MangaDocument = Manga & Document;

@Schema({ timestamps: true })
export class Manga {
  @Prop({ required: true })
  title: string;

  @Prop({ required: false })
  description: string;

  @Prop({ type: [String], default: [] })
  genres: string[];

  @Prop({ enum: ['ongoing', 'completed'], default: 'ongoing' })
  status: string;

  @Prop({ default: true })
  isPublic: boolean;

  @Prop({ enum: ['text', 'image'], required: true })
  type: 'text' | 'image';

  @Prop({ default: 0 })
  viewCount: number;

  @Prop({ default: true })
  isDraft: boolean;

  @Prop({ required: true })
  authorId: string;
}

export const MangaSchema = SchemaFactory.createForClass(Manga);