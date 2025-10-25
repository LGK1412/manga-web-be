import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { EmojiPackService } from './emoji-pack.service';
import type { Request } from 'express';
import { FilesInterceptor } from '@nestjs/platform-express';
import { EmojiService } from 'src/emoji/emoji.service';
import { JwtService } from '@nestjs/jwt';

@Controller('api/emoji-pack')
export class EmojiPackController {
    constructor(
        private emojiPackService: EmojiPackService,
        private emojiService: EmojiService,
        private jwtService: JwtService
    ) { }

    @Post("/create-emoji-pack")
    @UseInterceptors(FilesInterceptor("emojis"))
    async createEmojiPack(@UploadedFiles() files: Express.Multer.File[], @Body() body: any, @Req() req: Request) {
        // console.log("Body:", body);
        // console.log("Files:", files.map(f => ({
        //     originalname: f.originalname,
        //     mimetype: f.mimetype,
        //     size: f.size,
        // })));
        const payload = this.jwtService.verify(req.cookies?.access_token)
        const result = await this.emojiService.uploadEmojis(files)
        if (result.success) {
            const res2 = await this.emojiPackService.createEmojiPack(result.emojis, body.name, body.price, payload)
            // console.log(res2);
        }
        return true;
    }

    @Get()
    async getAllPack() {
        return await this.emojiPackService.getAllPack()
    }

    @Get("/free-emoji-pack")
    async getAllFreePack() {
        return await this.emojiPackService.getAllFreePack()
    }

    @Patch("/edit/:id")
    @UseInterceptors(FilesInterceptor("newEmojis")) // phải trùng tên field frontend append
    async editEmojiPack(
        @Param("id") id: string,
        @Body() body: any,
        @UploadedFiles() files: Express.Multer.File[],
        @Req() req: Request
    ) {
        // console.log("ID param:", id);
        // console.log("Body:", body);
        // console.log("Uploaded files:", files);
        // cập nhật tên và price cho emojiPackerService (viết code cho nó)
        // Nếu có emoji bị xoá thì gọi emojiService truyền array id vào xoá nó (viết lun code cho emojiService). Đầu tiên là thông tin của emoji theo id sau đó lấy skins {src: "/public/link tới folder xoá file"} xoá dc cái file r sau đó xoá trong database
        // Xoá xong thì lại gọi emojiService để add emoji server và database
        // Cập nhật thông tin của pack        

        // Parse trả về array cho id Emoji đã xoá
        let deletedEmojisArray: string[] = [];
        let deletedEmoji: string[] = []
        let updatedNewEmoji: string[] = []

        const payload = this.jwtService.verify(req.cookies?.access_token)
        await this.emojiPackService.checkAdmin(payload)
        
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
    async deletePackById(@Param("id") id: string, @Req() req: Request) {
        const payload = this.jwtService.verify(req.cookies?.access_token)
        return await this.emojiPackService.deletePackById(id, payload)
    }
}
