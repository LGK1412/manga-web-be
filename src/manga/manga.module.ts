
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MangaService } from './manga.service';
import { MangaController } from './manga.controller';
import { Manga, MangaSchema } from '../schemas/Manga.schema';
import { Genres, GenresSchema } from '../schemas/Genres.schema';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StylesModule } from '../styles/styles.module';
import { GenreModule } from '../genre/genre.module';
import { Chapter, ChapterSchema } from 'src/schemas/chapter.schema';
import { ChapterPurchase, ChapterPurchaseSchema } from 'src/schemas/chapter-purchase.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Manga.name, schema: MangaSchema },
      { name: Genres.name, schema: GenresSchema },
      { name: Chapter.name, schema: ChapterSchema },
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
    StylesModule,
    GenreModule,
  ],
  controllers: [MangaController],
  providers: [MangaService],
  exports: [MangaService, MongooseModule],
})
export class MangaModule { }

