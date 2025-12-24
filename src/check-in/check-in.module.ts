import { Module } from '@nestjs/common';
import { CheckinService } from './check-in.service';
import { CheckinController } from './check-in.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Checkin, CheckinSchema } from 'src/schemas/check-in.schema';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User, UserSchema } from 'src/schemas/User.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Checkin.name, schema: CheckinSchema },
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
  controllers: [CheckinController],
  providers: [CheckinService],
})
export class CheckInModule { }
