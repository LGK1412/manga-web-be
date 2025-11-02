import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { RatingLike, RatingLikeSchema } from '../schemas/RatingLike.schema'
import { Rating, RatingSchema } from '../schemas/Rating.schema'
import { RatingLikeService } from 'src/ratingLike/rating-like.service'
import { RatingLikeController } from 'src/ratingLike/rating-like.controller'
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule, ConfigService } from '@nestjs/config'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RatingLike.name, schema: RatingLikeSchema },
      { name: Rating.name, schema: RatingSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '360d' },
      }),
    }),
  ],
  providers: [RatingLikeService],
  controllers: [RatingLikeController],
  exports: [RatingLikeService],
})
export class RatingLikeModule { }


