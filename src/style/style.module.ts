import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StylesService } from './style.service';
import { StylesController } from './style.controller';
import { Styles, StylesSchema } from '../schemas/Styles.schema';
import { Manga, MangaSchema } from '../schemas/Manga.schema'; 

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Styles.name, schema: StylesSchema },
      { name: Manga.name, schema: MangaSchema }, 
    ]),
  ],
  controllers: [StylesController],
  providers: [StylesService],
  exports: [StylesService],
})
export class StyleModule {}
