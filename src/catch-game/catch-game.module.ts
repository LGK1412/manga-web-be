import { Module } from '@nestjs/common';
import { CatchGameService } from './catch-game.service';
import { CatchGameController } from './catch-game.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { CatchGameHistory, CatchGameHistorySchema } from 'src/schemas/catch-game-history.schema';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { User, UserSchema } from 'src/schemas/User.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CatchGameHistory.name, schema: CatchGameHistorySchema },
    ]),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '10m' },
      }),
    }),],
  controllers: [CatchGameController],
  providers: [CatchGameService],
})
export class CatchGameModule { }
