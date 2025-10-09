import { Module } from '@nestjs/common';
import { CommentController } from './comment.controller';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { CommentService } from './comment.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Comment, CommentSchema } from 'src/schemas/comment.schema';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserService } from 'src/user/user.service';
import { User } from 'src/schemas/User.schema';
import { Chapter, ChapterSchema } from 'src/schemas/chapter.schema';
import { ChapterServiceOnlyNormalChapterInfor } from 'src/chapter/chapter.service';
import { Manga, MangaSchema } from 'src/schemas/Manga.schema';
import { MangaService } from 'src/manga/manga.service';
import { StylesService } from 'src/styles/styles.service';
import { Styles, StylesSchema } from 'src/schemas/Styles.schema';
import { GenreService } from 'src/genre/genre.service';
import { Genres, GenresSchema } from 'src/schemas/Genres.schema';
import { NotificationModule } from 'src/notification-gateway/notification.module';
import { MangaModule } from '../manga/manga.module';

@Module({
    imports: [
        NotificationModule,
        MangaModule,
        MongooseModule.forFeature([
            {
                name: Comment.name,
                schema: CommentSchema
            },
            {
                name: User.name,
                schema: CommentSchema
            },
            {
                name: Chapter.name,
                schema: ChapterSchema
            },
            {
                name: Manga.name,
                schema: MangaSchema
            },
            {
                name: Styles.name,
                schema: StylesSchema
            },
            {
                name: Genres.name,
                schema: GenresSchema
            }
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
    providers: [CommentService, UserService, ChapterServiceOnlyNormalChapterInfor]
})
export class CommentModule { }
