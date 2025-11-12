import { Module } from '@nestjs/common';
import { EmojiPackService } from './emoji-pack.service';
import { EmojiPackController } from './emoji-pack.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { EmojiPack, EmojiPackSchema } from 'src/schemas/EmojiPack.schema';
import { Emoji, EmojiSchema } from 'src/schemas/Emoji.schema';
import { EmojiService } from 'src/emoji/emoji.service';
import { User, UserSchema } from 'src/schemas/User.schema';
import { UserModule } from 'src/user/user.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationModule } from 'src/notification-gateway/notification.module';

@Module({
  imports: [
    NotificationModule,
    MongooseModule.forFeature([
      { name: EmojiPack.name, schema: EmojiPackSchema },
      { name: Emoji.name, schema: EmojiSchema },
      { name: User.name, schema: UserSchema }
    ]),
    UserModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '10m' },
      }),
    }),
  ],
  providers: [EmojiPackService, EmojiService],
  controllers: [EmojiPackController]
})
export class EmojiPackModule { }
