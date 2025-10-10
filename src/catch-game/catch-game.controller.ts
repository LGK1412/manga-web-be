// src/game/catch-game.controller.ts
import { Controller, Post, Body, Req, Get, BadRequestException } from '@nestjs/common';
import { CatchGameService } from './catch-game.service';
import { JwtService } from '@nestjs/jwt';

@Controller('api/catch-game')
export class CatchGameController {
  constructor(
    private readonly gameService: CatchGameService,
    private readonly jwtService: JwtService,
  ) { }

  @Post('submit-score')
  async submitScore(@Req() req, @Body() body) {
    const { score } = body;
    const token = req.cookies['access_token'];
    if (!token) throw new BadRequestException('Thiếu token');

    const payload: any = this.jwtService.verify(token);
    await this.gameService.saveScore(payload.user_id, score);
    return { message: 'Lưu điểm thành công', score };
  }

  @Get('history')
  async getHistory(@Req() req) {
    const token = req.cookies['access_token'];
    const payload: any = this.jwtService.verify(token);
    return this.gameService.getHistory(payload.user_id);
  }

  @Get('leaderboard')
  async getLeaderboard() {
    const leaderboard = await this.gameService.getLeaderboard(10);
    return { leaderboard };
  }

  @Post('transfer-point')
  async transferPoint(@Req() req, @Body() body) {
    const { transferGamePoint } = body;
    if (!transferGamePoint || transferGamePoint % 1000 !== 0) {
      throw new BadRequestException('Số điểm phải chia hết cho 1000');
    }

    const token = req.cookies['access_token'];
    const payload: any = this.jwtService.verify(token);

    return this.gameService.transferPoint(payload.user_id, transferGamePoint);
  }


}
