// import {
//   Body,
//   Controller,
//   Delete,
//   Get,
//   Patch,
//   Query,
//   Req,
//   UsePipes,
//   ValidationPipe,
// } from "@nestjs/common";
// import type { Request } from "express";
// import { JwtService } from "@nestjs/jwt";
// import { NotificationClient } from "src/notification-gateway/notification.client";
// import { MarkReadDto } from "./dto/mark-read.dto";
// import { MarkAllReadDto } from "./dto/mark-all-read.dto";
// import { IdWithUserDto } from "./dto/id-with-user.dto";

// @Controller("/api/notifications")
// @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
// export class NotificationsHttpController {
//   constructor(
//     private readonly client: NotificationClient,
//     private readonly jwtService: JwtService
//   ) {}

//   // ---- LIST ----

//   // FE tiện nhất: lấy list theo "chính user hiện tại" (từ cookie JWT)
//   @Get("me")
//   async getMine(@Req() req: Request) {
//     const payload: any = this.jwtService.verify(req.cookies?.access_token);
//     const user_id = payload?.user_id;
//     const list = await this.client.sendGetNotiForUser(user_id);
//     // ĐẢM BẢO TRẢ MẢNG
//     return Array.isArray(list) ? list : (list?.data ?? list?.items ?? []);
//   }

//   // Lấy theo user_id (ví dụ xem inbox của ai đó)
//   @Get("get-all-for-user")
//   async getAllForUser(@Query("user_id") user_id: string) {
//     const list = await this.client.sendGetNotiForUser(user_id);
//     return Array.isArray(list) ? list : (list?.data ?? list?.items ?? []);
//   }

//   // Lấy theo sender (admin đã gửi đi)
//   @Get("get-all-for-sender")
//   async getAllForSender(@Query("user_id") user_id: string) {
//     const list = await this.client.sendGetNotiForSender(user_id);
//     return Array.isArray(list) ? list : (list?.data ?? list?.items ?? []);
//   }

//   // ---- ACTIONS ----

//   @Patch("mark-as-read")
//   async markAsRead(@Body() dto: MarkReadDto, @Req() req: Request) {
//     const payload: any = this.jwtService.verify(req.cookies?.access_token);
//     const user_id = dto.user_id ?? payload?.user_id;
//     return await this.client.sendMarkAsRead(dto.id, user_id);
//   }

//   @Patch("mark-all-as-read")
//   async markAllAsRead(@Body() dto: MarkAllReadDto, @Req() req: Request) {
//     const payload: any = this.jwtService.verify(req.cookies?.access_token);
//     const user_id = dto.user_id ?? payload?.user_id;
//     return await this.client.sendAllMarkAsRead(user_id);
//   }

//   @Patch("save")
//   async toggleSave(@Body() dto: IdWithUserDto, @Req() req: Request) {
//     const payload: any = this.jwtService.verify(req.cookies?.access_token);
//     const user_id = dto.user_id ?? payload?.user_id;
//     return await this.client.sendSaveNoti(dto.id, user_id);
//   }

//   @Delete()
//   async delete(@Body() dto: IdWithUserDto, @Req() req: Request) {
//     const payload: any = this.jwtService.verify(req.cookies?.access_token);
//     const user_id = dto.user_id ?? payload?.user_id;
//     return await this.client.deleteNoti(dto.id, user_id);
//   }
// }
