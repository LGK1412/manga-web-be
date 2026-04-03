import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'

import { ReportController } from './report.controller'
import { ReportService } from './report.service'

import { Report, ReportSchema } from '../schemas/Report.schema'
import { User, UserSchema } from '../schemas/User.schema'
import { Manga, MangaSchema } from '../schemas/Manga.schema'
import { Chapter, ChapterSchema } from '../schemas/chapter.schema'
import { Comment, CommentSchema } from '../schemas/comment.schema'
import { Reply, ReplySchema } from '../schemas/Reply.schema'
import { UserModule } from '../user/user.module'
import { NotificationModule } from '../notification/notification.module'
import { AuditLogModule } from '../audit-log/audit-log.module'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Report.name, schema: ReportSchema },
      { name: User.name, schema: UserSchema },
      { name: Manga.name, schema: MangaSchema },
      { name: Chapter.name, schema: ChapterSchema },
      { name: Comment.name, schema: CommentSchema },
      { name: Reply.name, schema: ReplySchema },
    ]),
    UserModule,
    NotificationModule,
    AuditLogModule,
  ],
  controllers: [ReportController],
  providers: [ReportService],
  exports: [ReportService],
})
export class ReportModule {}
