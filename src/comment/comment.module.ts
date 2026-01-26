import { Module, forwardRef } from '@nestjs/common';
import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';
import { MongooseModule } from '@nestjs/mongoose';

import { Comment, CommentSchema } from 'src/schemas/comment.schema';
import { VoteComment, VoteCommentSchema } from 'src/schemas/VoteComment.schema';
import { VoteReply, VoteReplySchema } from 'src/schemas/VoteReply.schema';

import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { UserModule } from 'src/user/user.module';
import { StylesModule } from 'src/styles/styles.module';
import { GenreModule } from 'src/genre/genre.module';
import { NotificationModule } from 'src/notification/notification.module';
import { MangaModule } from 'src/manga/manga.module';
import { ChapterModule } from 'src/textChapter/text-chapter.module';
import { ChapterServiceOnlyNormalChapterInforModule } from 'src/chapter/chapter.module';
import { ReplyModule } from 'src/reply/reply.module';
import { AchievementEventModule } from 'src/achievement/achievement.event.module';

// ✅ THÊM: AuditLogModule để inject được AuditLogService trong CommentService
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    ChapterServiceOnlyNormalChapterInforModule,
    NotificationModule,
    MangaModule,
    ChapterModule,
    UserModule,
    StylesModule,
    GenreModule,

    // ✅ an toàn nếu có circular (Comment -> Reply, và có thể Reply -> Comment trong tương lai)
    forwardRef(() => ReplyModule),

    // ✅ QUAN TRỌNG: resolve AuditLogService
    AuditLogModule,

    MongooseModule.forFeature([
      { name: Comment.name, schema: CommentSchema },
      { name: VoteComment.name, schema: VoteCommentSchema },
      { name: VoteReply.name, schema: VoteReplySchema },
    ]),

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '10m' },
      }),
    }),

    AchievementEventModule,
  ],
  controllers: [CommentController],
  providers: [CommentService],
  exports: [CommentService], // ✅ nên export nếu module khác cần dùng CommentService
})
export class CommentModule {}
