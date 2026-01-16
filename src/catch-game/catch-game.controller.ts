import {
  Controller,
  Post,
  Body,
  Req,
  Get,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { CatchGameService } from './catch-game.service';
import { AccessTokenGuard } from 'src/common/guards/access-token.guard';
import { JwtPayload } from 'src/common/interfaces/jwt-payload.interface';

@Controller('api/catch-game')
export class CatchGameController {
  constructor(private readonly gameService: CatchGameService) {}

  @Post('submit-score')
  @UseGuards(AccessTokenGuard)
  async submitScore(@Req() req: Request, @Body() body: { score: number }) {
    const { score } = body;
    const payload = (req as any).user as JwtPayload;

    await this.gameService.saveScore(payload.userId, score);
    return { message: 'Lưu điểm thành công', score };
  }

  @Get('history')
  @UseGuards(AccessTokenGuard)
  async getHistory(@Req() req: Request) {
    const payload = (req as any).user as JwtPayload;
    return this.gameService.getHistory(payload.userId);
  }

  @Get('leaderboard')
  async getLeaderboard() {
    const leaderboard = await this.gameService.getLeaderboard(10);
    return { leaderboard };
  }

  @Post('transfer-point')
  @UseGuards(AccessTokenGuard)
  async transferPoint(
    @Req() req: Request,
    @Body() body: { transferGamePoint: number },
  ) {
    const { transferGamePoint } = body;

    if (!transferGamePoint || transferGamePoint % 1000 !== 0) {
      throw new BadRequestException('Số điểm phải chia hết cho 1000');
    }

    const payload = (req as any).user as JwtPayload;
    return this.gameService.transferPoint(payload.userId, transferGamePoint);
  }
}
