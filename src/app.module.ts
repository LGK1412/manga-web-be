import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MailerModule } from '@nestjs-modules/mailer';
import { join } from 'path';

// === Core modules ===
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { MangaModule } from './manga/manga.module';
import { GenreModule } from './genre/genre.module';
import { StylesModule } from './styles/styles.module';
import { ChapterModule } from './textChapter/text-chapter.module';
import { ImageChapterModule } from './imageChapter/image-chapter.module';
import { ChapterServiceOnlyNormalChapterInforModule } from './chapter/chapter.module';

// === Business feature modules ===
import { VnpayModule } from './vnpay/vnpay.module';
import { TopupModule } from './topup/topup.module';
import { CommentModule } from './comment/comment.module';
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
import { DonationModule } from './donation/donation.module';
import { AchievementModule } from './achievement/achievement.module';
import { SpellCheckModule } from './spellcheck/spellcheck.module';
import { AdminNotificationModule } from './admin-notification/admin-notification.module';

// === Event Emitter ===
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    // ===== Global Config =====
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // ===== MongoDB =====
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('DATABASE_URL'),
      }),
    }),

    // ===== Mailer =====
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
          adapter: new (
            require('@nestjs-modules/mailer/dist/adapters/handlebars.adapter')
              .HandlebarsAdapter
          )(),
          options: { strict: true },
        },
      }),
    }),

    // ===== Event Emitter (for Comment/Notification) =====
    EventEmitterModule.forRoot(),

    // ===== Main Application Modules =====
    UserModule,
    AuthModule,
    MangaModule,
    GenreModule,
    StylesModule,
    ChapterModule,
    ImageChapterModule,
    ChapterServiceOnlyNormalChapterInforModule,

    // ===== Features =====
    VnpayModule,
    TopupModule,
    CommentModule,
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
    DonationModule,
    AchievementModule,
    SpellCheckModule,
    AdminNotificationModule,
  ],
  providers: [],
})
export class AppModule {}
