// src/game/catch-game.controller.ts
import { Controller, Post, Body, Req, Get, BadRequestException, UseGuards } from '@nestjs/common';
import { CatchGameService } from './catch-game.service';
import { JwtService } from '@nestjs/jwt';
import { AccessTokenGuard } from 'Guards/access-token.guard';

@Controller('api/catch-game')
export class CatchGameController {
  constructor(
    private readonly gameService: CatchGameService,
    private readonly jwtService: JwtService,
  ) { }

  @Post('submit-score')
  @UseGuards(AccessTokenGuard)
  async submitScore(@Req() req, @Body() body) {
    const { score } = body;
    const payload = (req as any).user;
    await this.gameService.saveScore(payload.user_id, score);
    return { message: 'Lưu điểm thành công', score };
  }

  @Get('history')
  @UseGuards(AccessTokenGuard)
  async getHistory(@Req() req) {
    const payload = (req as any).user;
    return this.gameService.getHistory(payload.user_id);
  }

  @Get('leaderboard')
  async getLeaderboard() {
    const leaderboard = await this.gameService.getLeaderboard(10);
    return { leaderboard };
  }

  @Post('transfer-point')
  @UseGuards(AccessTokenGuard)
  async transferPoint(@Req() req, @Body() body) {
    const { transferGamePoint } = body;
    if (!transferGamePoint || transferGamePoint % 1000 !== 0) {
      throw new BadRequestException('Số điểm phải chia hết cho 1000');
    }

    const payload = (req as any).user;
    return this.gameService.transferPoint(payload.user_id, transferGamePoint);
  }


}
