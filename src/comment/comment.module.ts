import { Module } from '@nestjs/common';
import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Comment, CommentSchema } from 'src/schemas/comment.schema';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserModule } from 'src/user/user.module';
import { StylesModule } from 'src/styles/styles.module';
import { GenreModule } from 'src/genre/genre.module';
import { ReplyModule } from 'src/reply/reply.module';
import { NotificationModule } from 'src/notification-gateway/notification.module';
import { MangaModule } from 'src/manga/manga.module';
import { ChapterModule } from 'src/textChapter/text-chapter.module';
import { ChapterServiceOnlyNormalChapterInforModule } from 'src/chapter/chapter.module';
import { VoteComment, VoteCommentSchema } from 'src/schemas/VoteComment.schema';
import { VoteReply, VoteReplySchema } from 'src/schemas/VoteReply.schema';
import { AchievementEventModule } from 'src/achievement/achievement.event.module';

@Module({
    imports: [
        ChapterServiceOnlyNormalChapterInforModule,
        NotificationModule,
        MangaModule,
        ChapterModule,
        UserModule,
        StylesModule,
        GenreModule,
        ReplyModule,
        MongooseModule.forFeature([
            { name: Comment.name, schema: CommentSchema },
            { name: VoteComment.name, schema: VoteCommentSchema },
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
        AchievementEventModule
    ],
    controllers: [CommentController],
    providers: [
        CommentService,
    ],
})
export class CommentModule { }
