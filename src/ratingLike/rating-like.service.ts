import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { RatingLike, RatingLikeDocument } from '../schemas/RatingLike.schema'
import { Rating, RatingDocument } from '../schemas/Rating.schema'

@Injectable()
export class RatingLikeService {
  constructor(
    @InjectModel(RatingLike.name) private readonly ratingLikeModel: Model<RatingLikeDocument>,
    @InjectModel(Rating.name) private readonly ratingModel: Model<RatingDocument>,
  ) {}

  async toggleLike(ratingId: Types.ObjectId, userId: Types.ObjectId) {
    const existing = await this.ratingLikeModel.findOne({ ratingId, userId })
    if (existing) {
      await this.ratingLikeModel.deleteOne({ _id: existing._id })
      // decrease likeCount but not below 0
      await this.ratingModel.updateOne({ _id: ratingId }, { $inc: { likeCount: -1 } })
      const doc = await this.ratingModel.findById(ratingId).select('likeCount').lean()
      const likesCount = Math.max(0, Number(doc?.likeCount ?? 0))
      return { liked: false, likesCount }
    }
    await this.ratingLikeModel.create({ ratingId, userId })
    await this.ratingModel.updateOne({ _id: ratingId }, { $inc: { likeCount: 1 } })
    const doc = await this.ratingModel.findById(ratingId).select('likeCount').lean()
    const likesCount = Math.max(0, Number(doc?.likeCount ?? 0))
    return { liked: true, likesCount }
  }

  async count(ratingId: Types.ObjectId) {
    const likesCount = await this.ratingLikeModel.countDocuments({ ratingId })
    return { likesCount }
  }

  async mine(ratingId: Types.ObjectId, userId: Types.ObjectId) {
    const liked = !!(await this.ratingLikeModel.findOne({ ratingId, userId }).lean())
    return { liked }
  }
}


