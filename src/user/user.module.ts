import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { User, UserSchema } from "src/schemas/User.schema";
import { UserService } from "./user.service";
import { UserController } from "./user.controller";
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AchievementEventModule } from "src/achievement/achievement.event.module";
import { Emoji, EmojiSchema } from "src/schemas/Emoji.schema";
import { Manga, MangaSchema } from "src/schemas/Manga.schema";
import { Chapter, ChapterSchema } from "src/schemas/chapter.schema";
import { UserChapterProgress, UserChapterProgressSchema } from "src/schemas/UserChapterProgress.schema";
import { AuthorApprovalEventListener } from "./author-approval.event.listener";
import { NotificationModule } from "src/notification/notification.module";
import { NotificationService } from "src/notification/notification.service";
import { Notification, NotificationSchema } from "src/schemas/notification.schema";

@Module({
    imports: [
        NotificationModule,
        MongooseModule.forFeature([
            {
                name: User.name,
                schema: UserSchema
            },
            { name: Emoji.name, schema: EmojiSchema },
            { name: Manga.name, schema: MangaSchema },
            { name: Chapter.name, schema: ChapterSchema },
            { name: UserChapterProgress.name, schema: UserChapterProgressSchema },
            { name: Notification.name, schema: NotificationSchema }
        ]),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                secret: configService.get<string>('JWT_SECRET'),
                signOptions: { expiresIn: '360d' },
            }),
        }),
        AchievementEventModule
    ],
    providers: [UserService, NotificationService, AuthorApprovalEventListener],
    controllers: [UserController],
    exports: [MongooseModule, UserService]
})
export class UserModule { }