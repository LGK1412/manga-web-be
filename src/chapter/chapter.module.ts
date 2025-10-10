import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Chapter, ChapterSchema } from 'src/schemas/chapter.schema';
import { ChapterServiceOnlyNormalChapterInfor } from './chapter.service';

@Module({
    imports: [
        MongooseModule.forFeature([
            {
                name: Chapter.name,
                schema: ChapterSchema
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
    controllers: [],
    providers: [ChapterServiceOnlyNormalChapterInfor],
    exports: [ChapterServiceOnlyNormalChapterInfor]
})
export class ChapterServiceOnlyNormalChapterInforModule { }
