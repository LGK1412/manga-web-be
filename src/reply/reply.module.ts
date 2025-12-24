import { Module } from '@nestjs/common';
import { ReplyService } from './reply.service';
import { ReplyController } from './reply.controller';
import { ChapterServiceOnlyNormalChapterInforModule } from 'src/chapter/chapter.module';
import { NotificationModule } from 'src/notification-gateway/notification.module';
import { MangaModule } from 'src/manga/manga.module';
import { ChapterModule } from 'src/textChapter/text-chapter.module';
import { UserModule } from 'src/user/user.module';
import { StylesModule } from 'src/styles/styles.module';
import { GenreModule } from 'src/genre/genre.module';
import { MongooseModule } from '@nestjs/mongoose';
import { CommentSchema } from 'src/schemas/comment.schema';
import { Reply, ReplySchema } from 'src/schemas/Reply.schema';
import { VoteReply, VoteReplySchema } from 'src/schemas/VoteReply.schema';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ChapterServiceOnlyNormalChapterInforModule,
    NotificationModule,
    MangaModule,
    ChapterModule,
    UserModule,
    StylesModule,
    GenreModule,
    MongooseModule.forFeature([
      { name: Reply.name, schema: ReplySchema },
      { name: VoteReply.name, schema: VoteReplySchema }
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
  providers: [
    ReplyService,
  ],
  controllers: [ReplyController],
  exports: [ReplyService]
})
export class ReplyModule { }
