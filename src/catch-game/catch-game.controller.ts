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
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import { JwtPayload } from 'src/common/interfaces/jwt-payload.interface';

function jwtUserId(payload: JwtPayload): string {
  const userId = String(payload?.user_id || payload?.userId || '').trim();
  if (!userId) {
    throw new BadRequestException('Invalid user information');
  }
  return userId;
}

@Controller('api/catch-game')
export class CatchGameController {
  constructor(private readonly gameService: CatchGameService) {}

  @Post('submit-score')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
  async submitScore(@Req() req: Request, @Body() body: { score: number }) {
    const { score } = body;
    const payload = (req as any).user as JwtPayload;

    await this.gameService.saveScore(jwtUserId(payload), score);
    return { message: 'Score saved successfully', score };
  }

  @Get('history')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
  async getHistory(@Req() req: Request) {
    const payload = (req as any).user as JwtPayload;
    return this.gameService.getHistory(jwtUserId(payload));
  }

  @Get('leaderboard')
  async getLeaderboard() {
    const leaderboard = await this.gameService.getLeaderboard(10);
    return { leaderboard };
  }

  @Post('transfer-point')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
  async transferPoint(
    @Req() req: Request,
    @Body() body: { transferGamePoint: number },
  ) {
    const { transferGamePoint } = body;

    if (!transferGamePoint || transferGamePoint % 1000 !== 0) {
      throw new BadRequestException('Points must be divisible by 1000');
    }

    const payload = (req as any).user as JwtPayload;
    return this.gameService.transferPoint(
      jwtUserId(payload),
      transferGamePoint,
    );
  }
}
