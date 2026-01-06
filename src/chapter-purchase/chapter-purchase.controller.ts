import {
  Controller,
  Post,
  Req,
  Param,
  UseGuards,
  Get,
} from '@nestjs/common';
import { ChapterPurchaseService } from './chapter-purchase.service';
import { JwtService } from '@nestjs/jwt';
import { AccessTokenGuard } from 'Guards/access-token.guard';

@Controller('api/chapter-purchase')
export class ChapterPurchaseController {
  constructor(
    private readonly chapterPurchaseService: ChapterPurchaseService,
    private readonly jwtService: JwtService,
  ) { }

  @Post(':chapterId')
  @UseGuards(AccessTokenGuard)
  async buyChapter(@Req() req, @Param('chapterId') chapterId: string) {
    const payload = (req as any).user;
    return await this.chapterPurchaseService.buyChapter(payload.user_id, chapterId);
  }

  @Get('history')
  @UseGuards(AccessTokenGuard)
  async getPurchaseHistory(@Req() req) {
    const payload = (req as any).user;
    return this.chapterPurchaseService.getPurchaseHistory(payload.user_id);
  }
}
