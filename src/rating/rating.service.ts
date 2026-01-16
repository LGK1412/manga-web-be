import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { Rating, RatingDocument } from '../schemas/Rating.schema'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { User, UserDocument } from 'src/schemas/User.schema'

interface UpsertRatingInput {
  userId: Types.ObjectId
  mangaId: Types.ObjectId
  rating: number
  comment: string
}

@Injectable()
export class RatingService {
  constructor(
    @InjectModel(Rating.name) private readonly ratingModel: Model<RatingDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private eventEmitter: EventEmitter2
  ) { }

  private async checkUser(id: string) {
    const existingUser = await this.userModel.findOne({ _id: id });
    if (!existingUser) {
      throw new BadRequestException('User does not exist');
    }
    if (existingUser.role != "user" && existingUser.role != "author") {
      throw new BadRequestException('User does not have permission');
    }
    if (existingUser.status == "ban") {
      throw new BadRequestException('User does not have permission');
    }
    return existingUser;
  }

  async upsertRating(input: UpsertRatingInput) {
    const { userId, mangaId, rating, comment } = input
    await this.checkUser(userId.toString());
    
    if (rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5')
    }

    const doc = await this.ratingModel.findOneAndUpdate(
      { userId, mangaId },
      { $set: { rating, comment } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    )
    // Emit
    this.eventEmitter.emit("rating_count", { userId: userId });
    return doc
  }

  async getMyRating(userId: Types.ObjectId, mangaId: Types.ObjectId) {
    await this.checkUser(userId.toString());
    return this.ratingModel.findOne({ userId, mangaId })
  }

  async listByManga(mangaId: Types.ObjectId, page = 1, limit = 10) {
    const skip = (page - 1) * limit
    const [items, total] = await Promise.all([
      this.ratingModel
        .find({ mangaId })
        .populate('userId', 'username avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .then((docs) =>
          docs.map((d: any) => ({
            _id: d._id,
            rating: d.rating,
            comment: d.comment,
            createdAt: d.createdAt,
            user: d.userId ? { _id: d.userId._id, username: d.userId.username, avatar: d.userId.avatar } : undefined,
          }))
        ),
      this.ratingModel.countDocuments({ mangaId }),
    ])
    return { items, total, page, limit }
  }

  async listAllByManga(mangaId: Types.ObjectId) {
    const items = await this.ratingModel
      .find({ mangaId })
      .populate('userId', 'username avatar')
      .sort({ createdAt: -1 })
      .lean()
      .then((docs) =>
        docs.map((d: any) => ({
          _id: d._id,
          rating: d.rating,
          comment: d.comment,
          createdAt: d.createdAt,
          user: d.userId ? { _id: d.userId._id, username: d.userId.username, avatar: d.userId.avatar } : undefined,
        }))
      )
    return { items, total: items.length }
  }

}


