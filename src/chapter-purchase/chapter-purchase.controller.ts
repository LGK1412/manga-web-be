import { Controller, Post, Req, Param, UseGuards, Get, BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import { Types } from 'mongoose';

import { ChapterPurchaseService } from './chapter-purchase.service';

import { AccessTokenGuard } from 'src/common/guards/access-token.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import type { JwtPayload } from 'src/common/interfaces/jwt-payload.interface';

@Controller('api/chapter-purchase')
export class ChapterPurchaseController {
  constructor(private readonly chapterPurchaseService: ChapterPurchaseService) {}

  @Post(':chapterId')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
  async buyChapter(@Req() req: Request, @Param('chapterId') chapterId: string) {
    const payload = (req as any).user as JwtPayload;

    if (!payload?.userId) throw new BadRequestException('Authentication required');

    // Nếu chapterId là ObjectId thì validate (nếu chapterId của bạn không phải ObjectId thì bỏ đoạn này)
    if (!Types.ObjectId.isValid(chapterId)) {
      throw new BadRequestException('Invalid chapterId');
    }

    return this.chapterPurchaseService.buyChapter(payload.userId, chapterId);
  }

  @Get('history')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
  async getPurchaseHistory(@Req() req: Request) {
    const payload = (req as any).user as JwtPayload;

    if (!payload?.userId) throw new BadRequestException('Authentication required');

    return this.chapterPurchaseService.getPurchaseHistory(payload.userId);
  }
}
