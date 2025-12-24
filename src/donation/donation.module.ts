import { Module } from '@nestjs/common';
import { DonationService } from './donation.service';
import { DonationController } from './donation.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { DonationItem, DonationItemSchema } from 'src/schemas/donation-item.schema';
import { Donation, DonationSchema } from 'src/schemas/donation.shema';
import { User, UserSchema } from 'src/schemas/User.schema';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AchievementEventModule } from 'src/achievement/achievement.event.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DonationItem.name, schema: DonationItemSchema },
      { name: Donation.name, schema: DonationSchema },
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
    AchievementEventModule
  ],
  controllers: [DonationController],
  providers: [DonationService],
})
export class DonationModule { }
