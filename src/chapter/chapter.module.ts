import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { Chapter, ChapterSchema } from 'src/schemas/chapter.schema';
import { UserChapterProgress, UserChapterProgressSchema } from 'src/schemas/UserChapterProgress.schema';
import { UserStoryHistory, UserStoryHistorySchema } from 'src/schemas/UserStoryHistory.schema';

import { ChapterServiceOnlyNormalChapterInfor } from './chapter.service';
import { ChapterController } from './chapter.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Chapter.name, schema: ChapterSchema },
      { name: UserChapterProgress.name, schema: UserChapterProgressSchema },
      { name: UserStoryHistory.name, schema: UserStoryHistorySchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '10m' },
      }),
    }),
  ],
  controllers: [ChapterController],
  providers: [ChapterServiceOnlyNormalChapterInfor],
  exports: [ChapterServiceOnlyNormalChapterInfor],
})
export class ChapterServiceOnlyNormalChapterInforModule {}
