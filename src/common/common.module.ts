import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AccessTokenGuard } from './guards/access-token.guard';
import { RolesGuard } from './guards/roles.guard';

@Global()
@Module({
  imports: [
    ConfigModule, // nếu AppModule đã isGlobal thì dòng này vẫn OK
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  providers: [AccessTokenGuard, RolesGuard],
  exports: [
    JwtModule, // ✅ quan trọng để JwtService available ở module khác
    AccessTokenGuard,
    RolesGuard,
  ],
})
export class CommonModule {}
