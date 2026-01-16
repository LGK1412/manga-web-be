// src/admin-notification/admin-notification.module.ts
import { Module, forwardRef } from "@nestjs/common";
import { AdminNotificationController } from "./admin-notification.controller";
import { AdminNotificationService } from "./admin-notification.service";
import { UserModule } from "src/user/user.module";
import { NotificationModule } from "src/notification/notification.module";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";

@Module({
  imports: [
    ConfigModule,

    // ⚠️ circular dependency -> forwardRef
    forwardRef(() => NotificationModule),
    forwardRef(() => UserModule),

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get<string>("JWT_SECRET"),
        signOptions: { expiresIn: "10m" },
      }),
    }),
  ],
  controllers: [AdminNotificationController],
  providers: [AdminNotificationService],
})
export class AdminNotificationModule {}
