import { Module } from '@nestjs/common';
import { AchievementService } from './achievement.service';
import { AchievementController } from './achievement.controller';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { Achievement, AchievementSchema } from 'src/schemas/achievement.schema';
import { AchievementProgress, AchievementProgressSchema } from 'src/schemas/achievement-progress.schema';
import { User, UserSchema } from 'src/schemas/User.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Achievement.name, schema: AchievementSchema },
      { name: AchievementProgress.name, schema: AchievementProgressSchema },
      { name: User.name, schema: UserSchema }
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '360d' },
      }),
    }),
  ],
  controllers: [AchievementController],
  providers: [AchievementService],
})
export class AchievementModule { }
