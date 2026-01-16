import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';

import { FilesInterceptor } from '@nestjs/platform-express';

import { EmojiPackService } from './emoji-pack.service';
import { EmojiService } from 'src/emoji/emoji.service';

import { AccessTokenGuard } from 'src/common/guards/access-token.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import type { JwtPayload } from 'src/common/interfaces/jwt-payload.interface';

@Controller('api/emoji-pack')
export class EmojiPackController {
  constructor(
    private readonly emojiPackService: EmojiPackService,
    private readonly emojiService: EmojiService,
  ) {}

  /**
   * ADMIN: tạo emoji pack
   */
  @Post('/create-emoji-pack')
  @UseInterceptors(FilesInterceptor('emojis'))
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async createEmojiPack(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: any,
    @Req() req: Request,
  ) {
    const payload = (req as any).user as JwtPayload;

    const uploadRes = await this.emojiService.uploadEmojis(files);
    if (!uploadRes?.success) return { success: false };

    await this.emojiPackService.createEmojiPack(
      uploadRes.emojis,
      body.name,
      body.price,
      payload,
    );

    return { success: true };
  }

  /**
   * Public: lấy tất cả pack
   */
  @Get('/')
  async getAllPack() {
    return this.emojiPackService.getAllPack();
  }

  /**
   * Public: lấy pack free
   */
  @Get('/free-emoji-pack')
  async getAllFreePack() {
    return this.emojiPackService.getAllFreePack();
  }

  /**
   * Logged-in: lấy pack cho shop (có thể kèm trạng thái đã mua)
   */
  @Get('/get-pack-for-shop')
  @UseGuards(AccessTokenGuard)
  async getPackForShop(
    @Query('page') page = 1,
    @Query('limit') limit = 12,
    @Req() req: Request,
  ) {
    const payload = (req as any).user as JwtPayload;
    return this.emojiPackService.getPackForShop(+page, +limit, payload);
  }

  /**
   * ADMIN: edit pack + upload emoji mới + xoá emoji cũ
   */
  @Patch('/edit/:id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @UseInterceptors(FilesInterceptor('newEmojis'))
  async editEmojiPack(
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: Request,
  ) {
    const payload = (req as any).user as JwtPayload;

    // Nếu service có checkAdmin theo payload role thì vẫn gọi
    await this.emojiPackService.checkAdmin(payload);

    let deletedEmojisArray: string[] = [];
    let deletedEmoji: string[] = [];
    let updatedNewEmoji: string[] = [];

    if (body?.deletedEmojis) {
      if (typeof body.deletedEmojis === 'string') {
        try {
          deletedEmojisArray = JSON.parse(body.deletedEmojis);
        } catch {
          deletedEmojisArray = body.deletedEmojis
            .replace(/^\[|\]$/g, '')
            .split(',')
            .map((s: string) => s.replace(/['"]/g, '').trim())
            .filter(Boolean);
        }
      } else if (Array.isArray(body.deletedEmojis)) {
        deletedEmojisArray = body.deletedEmojis;
      }
    }

    // Xoá emoji nếu có
    if (deletedEmojisArray.length > 0) {
      const delRes = await this.emojiService.deleteEmojisByIds(deletedEmojisArray);

      if (delRes && typeof delRes === 'object' && 'result' in delRes) {
        // @ts-ignore
        deletedEmoji = (delRes as any).result.map((e: any) => e._id);
      } else {
        deletedEmoji = deletedEmojisArray;
      }
    }

    // Upload emoji mới nếu có
    if (files && files.length > 0) {
      const upRes = await this.emojiService.uploadEmojis(files);
      updatedNewEmoji = (upRes.emojis || []).map((emoji: any) => emoji._id || emoji.id);
    }

    await this.emojiPackService.updateEmojiPack(
      id,
      body.name,
      body.price as number,
      updatedNewEmoji,
      deletedEmoji,
    );

    return { success: true };
  }

  /**
   * ADMIN: xoá pack
   */
  @Delete('/delete-pack/:id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async deletePackById(@Param('id') id: string, @Req() req: Request) {
    const payload = (req as any).user as JwtPayload;
    return this.emojiPackService.deletePackById(id, payload);
  }
}
