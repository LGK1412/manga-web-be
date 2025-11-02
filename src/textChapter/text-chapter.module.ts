import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Chapter, ChapterSchema } from '../schemas/chapter.schema';
import { TextChapter, TextChapterSchema } from '../schemas/text-chapter.schema';
import { ChapterService } from './text-chapter.service';
import { ChapterController } from './text-chapter.controller';
import { Manga, MangaSchema } from 'src/schemas/Manga.schema';
import { AchievementEventModule } from 'src/achievement/achievement.event.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Chapter.name, schema: ChapterSchema },
      { name: TextChapter.name, schema: TextChapterSchema },
      { name: Manga.name, schema: MangaSchema }
    ]),
    AchievementEventModule
  ],
  controllers: [ChapterController],
  providers: [ChapterService],
})
export class ChapterModule { }
