import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

export type RatingDocument = Rating & Document

@Schema({ timestamps: true })
export class Rating {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'Manga', required: true })
  mangaId: Types.ObjectId

  @Prop({ type: Number, min: 1, max: 5, required: true })
  rating: number

  @Prop({ type: String, required: true })
  comment: string

  @Prop({ type: Number, required: false, default: 0 })
  likeCount: number
}

export const RatingSchema = SchemaFactory.createForClass(Rating)

RatingSchema.index({ userId: 1, mangaId: 1 }, { unique: true })


