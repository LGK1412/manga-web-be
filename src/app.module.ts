import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { MangaModule } from './manga/manga.module';
import { GenreModule } from './genre/genre.module';

import { MailerModule } from '@nestjs-modules/mailer';
import { join } from 'path';
import { ImageChapterModule } from './imageChapter/image-chapter.module';
import { ChapterModule } from './textChapter/text-chapter.module';
import { StylesModule } from './styles/styles.module';
import { VnpayModule } from './vnpay/vnpay.module';
import { TopupModule } from './topup/topup.module';
import { CommentModule } from './comment/comment.module';
import { ChapterServiceOnlyNormalChapterInforModule } from './chapter/chapter.module';
import { NotificationModule } from './notification-gateway/notification.module';
import { WithdrawModule } from './withdraw/withdraw.module';
import { CatchGameModule } from './catch-game/catch-game.module';
import { ChapterPurchaseModule } from './chapter-purchase/chapter-purchase.module';
import { RatingModule } from './rating/rating.module';
import { RatingLikeModule } from './ratingLike/rating-like.module';
import { ReplyModule } from './reply/reply.module';
import { ReadChapterModule } from './socket-gateway/read-chapter/read-chapter-gateway.module';
import { EmojiPackModule } from './emoji-pack/emoji-pack.module';
import { EmojiModule } from './emoji/emoji.module';
import { PoliciesModule } from './policies/policies.module';
import { ReportModule } from './report/report.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('DATABASE_URL'),
      }),
    }),

    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        transport: {
          host: 'smtp.gmail.com',
          port: 587,
          secure: false,
          auth: {
            user: config.get<string>('SMTP_USER'),
            pass: config.get<string>('SMTP_PASS'),
          },
        },
        defaults: {
          from: '"Mangaword" <no-reply@mangaword.com>',
        },
        template: {
          dir: join(__dirname, 'templates-mail-send'),
          adapter:
            new (require('@nestjs-modules/mailer/dist/adapters/handlebars.adapter').HandlebarsAdapter)(),
          options: { strict: true },
        },
      }),
    }),

    UserModule,
    AuthModule,
    MangaModule,
    GenreModule,
    StylesModule,
    ChapterModule,
    ImageChapterModule,
    VnpayModule,
    TopupModule,
    CommentModule,
    ChapterServiceOnlyNormalChapterInforModule,
    NotificationModule,
    WithdrawModule,
    CatchGameModule,
    ChapterPurchaseModule,
    RatingModule,
    RatingLikeModule,
    ReplyModule,
    ReadChapterModule,
    EmojiPackModule,
    EmojiModule,
    PoliciesModule,
    ReportModule,
  ],
  providers: [],
})
export class AppModule { }
