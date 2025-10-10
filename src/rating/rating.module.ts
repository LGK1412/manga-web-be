import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { Rating, RatingSchema } from '../schemas/Rating.schema'
import { RatingService } from './rating.service'
import { RatingController } from './rating.controller'
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule, ConfigService } from '@nestjs/config'

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Rating.name, schema: RatingSchema }]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '360d' },
      }),
    }),
  ],
  providers: [RatingService],
  controllers: [RatingController],
  exports: [RatingService],
})
export class RatingModule {}




