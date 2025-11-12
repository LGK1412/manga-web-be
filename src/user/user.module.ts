    import { Module } from "@nestjs/common";
    import { MongooseModule } from "@nestjs/mongoose";
    import { User, UserSchema } from "src/schemas/User.schema";
    import { UserService } from "./user.service";
    import { UserController } from "./user.controller";
    import { JwtModule } from '@nestjs/jwt';
    import { ConfigModule, ConfigService } from '@nestjs/config';
    import { NotificationModule } from "src/notification-gateway/notification.module";
    import { AchievementEventModule } from "src/achievement/achievement.event.module";
    import { Emoji, EmojiSchema } from "src/schemas/Emoji.schema";
    import { Manga, MangaSchema } from "src/schemas/Manga.schema";
    import { Chapter, ChapterSchema } from "src/schemas/chapter.schema";
    import { UserChapterProgress, UserChapterProgressSchema } from "src/schemas/UserChapterProgress.schema";
    import { AuthorApprovalEventListener } from "./author-approval.event.listener";

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
        providers: [UserService, AuthorApprovalEventListener],
        controllers: [UserController],
        exports: [MongooseModule, UserService]
    })
    export class UserModule { }