import { Module } from '@nestjs/common';
import { ChapterPurchaseService } from './chapter-purchase.service';
import { ChapterPurchaseController } from './chapter-purchase.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Chapter, ChapterSchema } from 'src/schemas/chapter.schema';
import { ChapterPurchase, ChapterPurchaseSchema } from 'src/schemas/chapter-purchase.schema';
import { User, UserSchema } from 'src/schemas/User.schema';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Chapter.name, schema: ChapterSchema },
      { name: User.name, schema: UserSchema },
      { name: ChapterPurchase.name, schema: ChapterPurchaseSchema }
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
  controllers: [ChapterPurchaseController],
  providers: [ChapterPurchaseService],
})
export class ChapterPurchaseModule { }
