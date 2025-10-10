import { Module } from '@nestjs/common';
import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Comment, CommentSchema } from 'src/schemas/comment.schema';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserService } from 'src/user/user.service';
import { User, UserSchema } from 'src/schemas/User.schema';
import { StylesService } from 'src/styles/styles.service';
import { Styles, StylesSchema } from 'src/schemas/Styles.schema';
import { GenreService } from 'src/genre/genre.service';
import { Genres, GenresSchema } from 'src/schemas/Genres.schema';
import { NotificationModule } from 'src/notification-gateway/notification.module';
import { MangaModule } from 'src/manga/manga.module';
import { ChapterModule } from 'src/textChapter/text-chapter.module';
import { ChapterServiceOnlyNormalChapterInforModule } from 'src/chapter/chapter.module';

@Module({
    imports: [
        ChapterServiceOnlyNormalChapterInforModule,
        NotificationModule,
        MangaModule,
        ChapterModule,
        MongooseModule.forFeature([
            { name: Comment.name, schema: CommentSchema },
            { name: User.name, schema: UserSchema },
            { name: Styles.name, schema: StylesSchema },
            { name: Genres.name, schema: GenresSchema },
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
    controllers: [CommentController],
    providers: [
        CommentService,
        UserService,
        StylesService,
        GenreService,
    ],
})
export class CommentModule { }
