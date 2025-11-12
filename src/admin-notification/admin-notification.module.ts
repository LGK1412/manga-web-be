// src/admin-notification/admin-notification.module.ts
import { Module } from "@nestjs/common";
import { AdminNotificationController } from "./admin-notification.controller";
import { AdminNotificationService } from "./admin-notification.service";
import { NotificationModule } from "src/notification-gateway/notification.module";
import { UserModule } from "src/user/user.module";
import { MongooseModule } from "@nestjs/mongoose";
import { User, UserSchema } from "src/schemas/User.schema";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";

@Module({
  imports: [
    // Đảm bảo ConfigModule khả dụng (AppModule có thể đã isGlobal:true)
    ConfigModule, 
    NotificationModule, // để dùng NotificationClient (TCP tới notifications microservice)
    UserModule,
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),

    // ✅ Đăng ký JwtModule với secret từ env
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get<string>("JWT_SECRET"),        // bắt buộc phải có
        signOptions: { expiresIn: "10m" },            // optional
      }),
    }),
  ],
  controllers: [AdminNotificationController],
  providers: [AdminNotificationService],
})
export class AdminNotificationModule {}
