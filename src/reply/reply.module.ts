import { Module } from '@nestjs/common';
import { ReplyService } from './reply.service';
import { ReplyController } from './reply.controller';
import { ChapterServiceOnlyNormalChapterInforModule } from 'src/chapter/chapter.module';
import { NotificationModule } from 'src/notification-gateway/notification.module';
import { MangaModule } from 'src/manga/manga.module';
import { ChapterModule } from 'src/textChapter/text-chapter.module';
import { MongooseModule } from '@nestjs/mongoose';
import { CommentSchema } from 'src/schemas/comment.schema';
import { User, UserSchema } from 'src/schemas/User.schema';
import { Styles, StylesSchema } from 'src/schemas/Styles.schema';
import { Genres, GenresSchema } from 'src/schemas/Genres.schema';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserService } from 'src/user/user.service';
import { StylesService } from 'src/styles/styles.service';
import { GenreService } from 'src/genre/genre.service';
import { Reply, ReplySchema } from 'src/schemas/Reply.schema';
import { VoteReply, VoteReplySchema } from 'src/schemas/VoteReply.schema';

@Module({
  imports: [
    ChapterServiceOnlyNormalChapterInforModule,
    NotificationModule,
    MangaModule,
    ChapterModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Styles.name, schema: StylesSchema },
      { name: Genres.name, schema: GenresSchema },
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
    UserService,
    StylesService,
    GenreService,
  ],
  controllers: [ReplyController],
  exports: [ReplyService]
})
export class ReplyModule { }
