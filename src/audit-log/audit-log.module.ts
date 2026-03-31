import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLog, AuditLogSchema } from '../schemas/AuditLog.schema';
import { Comment, CommentSchema } from '../schemas/comment.schema';
import { Reply, ReplySchema } from '../schemas/Reply.schema';
import { AuditLogService } from './audit-log.service';
import { AuditLogController } from './audit-log.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AuditLog.name, schema: AuditLogSchema },
      { name: Comment.name, schema: CommentSchema },
      { name: Reply.name, schema: ReplySchema },
    ]),
  ],
  controllers: [AuditLogController],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
