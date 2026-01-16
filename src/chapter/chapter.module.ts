import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Chapter, ChapterSchema } from 'src/schemas/chapter.schema';
import {
  UserChapterProgress,
  UserChapterProgressSchema,
} from 'src/schemas/UserChapterProgress.schema';
import {
  UserStoryHistory,
  UserStoryHistorySchema,
} from 'src/schemas/UserStoryHistory.schema';

import { ChapterServiceOnlyNormalChapterInfor } from './chapter.service';
import { ChapterController } from './chapter.controller';

import { CommonModule } from 'src/common/common.module';

@Module({
  imports: [
    CommonModule,
    MongooseModule.forFeature([
      { name: Chapter.name, schema: ChapterSchema },
      { name: UserChapterProgress.name, schema: UserChapterProgressSchema },
      { name: UserStoryHistory.name, schema: UserStoryHistorySchema },
    ]),
  ],
  controllers: [ChapterController],
  providers: [ChapterServiceOnlyNormalChapterInfor],
  exports: [ChapterServiceOnlyNormalChapterInfor],
})
export class ChapterServiceOnlyNormalChapterInforModule {}
