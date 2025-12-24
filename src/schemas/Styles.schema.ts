import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type StylesDocument = Styles & Document;

@Schema({ timestamps: true })
export class Styles {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ enum: ['normal', 'hide'], default: 'normal' })
  status: string;
}

export const StylesSchema = SchemaFactory.createForClass(Styles);
