import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from 'src/schemas/User.schema';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserModule } from 'src/user/user.module';
import { OAuth2Client } from 'google-auth-library';
import { NotificationModule } from 'src/notification-gateway/notification.module';
import { Achievement, AchievementSchema } from 'src/schemas/achievement.schema';
import { AchievementProgress, AchievementProgressSchema } from 'src/schemas/achievement-progress.schema';
import { AchievementEventModule } from 'src/achievement/achievement.event.module';

@Module({
  imports: [
    NotificationModule,
    UserModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Achievement.name, schema: AchievementSchema },
      { name: AchievementProgress.name, schema: AchievementProgressSchema },
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
  providers: [
    AuthService,
    {
      provide: OAuth2Client,
      useFactory: () => {
        return new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
      },
    },
  ],
  controllers: [AuthController],
  exports: [JwtModule]
})
export class AuthModule { }
