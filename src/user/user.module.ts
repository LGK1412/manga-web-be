import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { User, UserSchema } from "src/schemas/User.schema";
import { UserService } from "./user.service";
import { UserController } from "./user.controller";
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationModule } from "src/notification-gateway/notification.module";
import { AchievementEventModule } from "src/achievement/achievement.event.module";

@Module({
    imports: [
        NotificationModule,
        MongooseModule.forFeature([
            {
                name: User.name,
                schema: UserSchema
            }
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
    providers: [UserService],
    controllers: [UserController],
    exports: [MongooseModule, UserService]
})
export class UserModule { }