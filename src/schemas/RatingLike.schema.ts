import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

export type RatingLikeDocument = RatingLike & Document

@Schema({ timestamps: true })
export class RatingLike {
  @Prop({ type: Types.ObjectId, ref: 'Rating', required: true })
  ratingId: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId
}

export const RatingLikeSchema = SchemaFactory.createForClass(RatingLike)

RatingLikeSchema.index({ ratingId: 1, userId: 1 }, { unique: true })


