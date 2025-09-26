import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { MangaModule } from './manga/manga.module';
import { GenreModule } from './genre/genre.module';
import { StyleModule } from './style/style.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { join } from 'path';
import { ImageChapterModule } from './imageChapter/image-chapter.module';
import { ChapterModule } from './textChapter/text-chapter.module';
import { StylesModule } from './styles/styles.module';

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
  ],
})
export class AppModule {}
