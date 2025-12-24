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

@Controller('api/chapter-purchase')
export class ChapterPurchaseController {
  constructor(
    private readonly chapterPurchaseService: ChapterPurchaseService,
    private readonly jwtService: JwtService,
  ) { }

  @Post(':chapterId')
  async buyChapter(@Req() req, @Param('chapterId') chapterId: string) {
    // Lấy token từ cookie
    const token = req.cookies['access_token'];
    if (!token) {
      throw new Error('Authentication required - No access token');
    }

    // Giải mã token để lấy userId
    const payload: any = this.jwtService.verify(token);
    const userId = payload.user_id;

    // Gọi service
    return await this.chapterPurchaseService.buyChapter(userId, chapterId);
  }

  @Get('history')
  async getPurchaseHistory(@Req() req) {
    // Lấy token từ cookie
    const token = req.cookies['access_token'];
    if (!token) {
      throw new Error('Authentication required - No access token');
    }

    // Giải mã token để lấy userId
    const payload: any = this.jwtService.verify(token);
    const userId = payload.user_id;

    return this.chapterPurchaseService.getPurchaseHistory(userId);
  }
}
