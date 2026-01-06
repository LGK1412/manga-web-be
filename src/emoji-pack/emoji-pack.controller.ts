import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { EmojiPackService } from './emoji-pack.service';
import type { Request } from 'express';
import { FilesInterceptor } from '@nestjs/platform-express';
import { EmojiService } from 'src/emoji/emoji.service';
import { JwtService } from '@nestjs/jwt';
import { AccessTokenAdminGuard } from 'Guards/access-token-admin.guard';
import { AccessTokenGuard } from 'Guards/access-token.guard';

@Controller('api/emoji-pack')
export class EmojiPackController {
    constructor(
        private emojiPackService: EmojiPackService,
        private emojiService: EmojiService,
        private jwtService: JwtService
    ) { }

    @Post("/create-emoji-pack")
    @UseInterceptors(FilesInterceptor("emojis"))
    @UseGuards(AccessTokenAdminGuard)
    async createEmojiPack(@UploadedFiles() files: Express.Multer.File[], @Body() body: any, @Req() req: Request) {
        const payload = (req as any).admin
        const result = await this.emojiService.uploadEmojis(files)
        if (result.success) {
            const res2 = await this.emojiPackService.createEmojiPack(result.emojis, body.name, body.price, payload)
        }
        return true;
    }

    @Get("/")
    async getAllPack() {
        return await this.emojiPackService.getAllPack()
    }

    @Get("/free-emoji-pack")
    async getAllFreePack() {
        return await this.emojiPackService.getAllFreePack()
    }

    @Get("/get-pack-for-shop")
    @UseGuards(AccessTokenGuard)
    async getPackForShop(@Query("page") page = 1, @Query("limit") limit = 12, @Req() req: Request) {
        const payload = (req as any).user;
        return this.emojiPackService.getPackForShop(+page, +limit, payload);
    }

    @Patch("/edit/:id")
    @UseGuards(AccessTokenAdminGuard)
    @UseInterceptors(FilesInterceptor("newEmojis"))
    async editEmojiPack(
        @Param("id") id: string,
        @Body() body: any,
        @UploadedFiles() files: Express.Multer.File[],
        @Req() req: Request
    ) {
        const payload = (req as any).admin;
        await this.emojiPackService.checkAdmin(payload)

        let deletedEmojisArray: string[] = [];
        let deletedEmoji: string[] = []
        let updatedNewEmoji: string[] = []

        if (body?.deletedEmojis) {
            if (typeof body.deletedEmojis === 'string') {
                try {
                    deletedEmojisArray = JSON.parse(body.deletedEmojis);
                } catch {
                    // Nếu JSON.parse fail, fallback: tách kiểu chuỗi
                    deletedEmojisArray = body.deletedEmojis
                        .replace(/^\[|\]$/g, '') // remove [ ]
                        .split(',')
                        .map(s => s.replace(/['"]/g, '').trim());
                }
            } else if (Array.isArray(body.deletedEmojis)) {
                deletedEmojisArray = body.deletedEmojis;
            }
        }

        // Xoá emoji nếu có
        if (deletedEmojisArray.length > 0) {
            const res2 = await this.emojiService.deleteEmojisByIds(deletedEmojisArray);
            // trả về array các id đã xoá
            if (res2 && typeof res2 === 'object' && 'result' in res2) {
                deletedEmoji = res2.result.map((e) => e._id);
            } else {
                deletedEmoji = deletedEmojisArray; // fallback
            }
        }

        // Upload emoji mới nếu có
        if (files && files.length > 0) {
            const res3 = await this.emojiService.uploadEmojis(files);
            // console.log(res3);
            updatedNewEmoji = res3.emojis.map((emoji: any) => emoji._id || emoji.id);
        }

        // Gọi updateEmojiPack 1 lần duy nhất, gộp tất cả
        const res1 = await this.emojiPackService.updateEmojiPack(
            id,
            body.name,
            body.price as number,
            updatedNewEmoji,
            deletedEmoji
        );

        return { success: true };
    }

    @Delete("/delete-pack/:id")
    @UseGuards(AccessTokenAdminGuard)
    async deletePackById(@Param("id") id: string, @Req() req: Request) {
        const payload = (req as any).admin;
        return await this.emojiPackService.deletePackById(id, payload)
    }
}
