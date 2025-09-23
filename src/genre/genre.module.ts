import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GenreService } from './genre.service';
import { GenreController } from './genre.controller';
import { Genres, GenresSchema } from '../schemas/Genres.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Genres.name, schema: GenresSchema }
    ])
  ],
  controllers: [GenreController],
  providers: [GenreService],
  exports: [GenreService],
})
export class GenreModule {}