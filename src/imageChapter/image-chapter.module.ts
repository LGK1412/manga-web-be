import { Module } from '@nestjs/common';
import { ImageChapterService } from './image-chapter.service';
import { ImageChapterController } from './image-chapter.controller';
import { Chapter, ChapterSchema } from 'src/schemas/chapter.schema';
import { ImageChapter, ImageChapterSchema } from 'src/schemas/Image-chapter';
import { MongooseModule } from '@nestjs/mongoose';
import { Manga, MangaSchema } from 'src/schemas/Manga.schema';
import { AchievementEventModule } from 'src/achievement/achievement.event.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Chapter.name, schema: ChapterSchema },
      { name: ImageChapter.name, schema: ImageChapterSchema },
      { name: Manga.name, schema: MangaSchema }
    ]),
    AchievementEventModule
  ],
  controllers: [ImageChapterController],
  providers: [ImageChapterService],
})
export class ImageChapterModule { }
