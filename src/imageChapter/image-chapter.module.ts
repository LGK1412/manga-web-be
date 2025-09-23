import { Module } from '@nestjs/common';
import { ImageChapterService } from './image-chapter.service';
import { ImageChapterController } from './image-chapter.controller';
import { Chapter, ChapterSchema } from 'src/schemas/chapter.schema';
import { ImageChapter, ImageChapterSchema } from 'src/schemas/Image-chapter';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Chapter.name, schema: ChapterSchema },
      { name: ImageChapter.name, schema: ImageChapterSchema },
    ]),
  ],
  controllers: [ImageChapterController],
  providers: [ImageChapterService],
})
export class ImageChapterModule { }
