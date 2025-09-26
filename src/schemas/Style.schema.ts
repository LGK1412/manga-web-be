// import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
// import { Document } from 'mongoose';

// export type StyleDocument = Style & Document;

// @Schema({ timestamps: true })
// export class Style {
//   @Prop({ required: true, unique: true, trim: true })
//   name: string;

//   @Prop({ default: '' })
//   description: string;

//   @Prop({ enum: ['active', 'inactive'], default: 'active' })
//   status: 'active' | 'inactive';
// }

// export const StyleSchema = SchemaFactory.createForClass(Style);
