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
  constructor(private readonly chapterPurchaseService: ChapterPurchaseService) { }

  @Post(':chapterId')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
  async buyChapter(
    @Req() req: Request,
    @Param('chapterId') chapterId: string) {
    const userId = req['user'].user_id;
    return this.chapterPurchaseService.buyChapter(userId, chapterId);
  }

  @Get('history')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
  async getPurchaseHistory(@Req() req: Request) {
    const userId = req['user'].user_id;
    return this.chapterPurchaseService.getPurchaseHistory(userId);
  }
}
