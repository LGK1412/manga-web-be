import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MangaService } from './manga.service';
import { MangaController } from './manga.controller';
import { Manga, MangaSchema } from '../schemas/Manga.schema';
import { Genres, GenresSchema } from '../schemas/Genres.schema';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Manga.name, schema: MangaSchema },
      { name: Genres.name, schema: GenresSchema }
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
  controllers: [MangaController],
  providers: [MangaService],
  exports: [MangaService],
})
export class MangaModule {}