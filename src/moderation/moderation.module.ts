// src/moderation/moderation.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';
import { GeminiModerator } from './gemini.moderator';
import { Chapter, ChapterSchema } from '../schemas/chapter.schema';
import { ChapterModeration, ChapterModerationSchema } from '../schemas/chapter-moderation.schema';
import { ModerationAction, ModerationActionSchema } from '../schemas/moderation-action.schema';
import { Policies, PoliciesSchema } from '../schemas/Policies.schema';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ModerationListener } from './moderation.listeners';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    MongooseModule.forFeature([
      { name: Chapter.name, schema: ChapterSchema },
      { name: ChapterModeration.name, schema: ChapterModerationSchema },
      { name: ModerationAction.name, schema: ModerationActionSchema },
      { name: Policies.name, schema: PoliciesSchema },
    ]),
  ],
  controllers: [ModerationController],
  providers: [ModerationService, GeminiModerator, ModerationListener],
  exports: [ModerationService],
})
export class ModerationModule {}
