import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { AchievementService } from './achievement.service';
import { AccessTokenGuard } from 'src/common/guards/access-token.guard';
import { JwtPayload } from 'src/common/interfaces/jwt-payload.interface';

@Controller('api/achievements')
export class AchievementController {
  constructor(private readonly achievementService: AchievementService) {}

  @Get('me')
  @UseGuards(AccessTokenGuard)
  async getAchievementsForStudent(@Req() req: Request) {
    const payload = (req as any).user as JwtPayload;
    return this.achievementService.getAllWithProgress(payload.userId);
  }

  @Post(':id/claim')
  @UseGuards(AccessTokenGuard)
  async claimReward(@Req() req: Request, @Param('id') achievementId: string) {
    const payload = (req as any).user as JwtPayload;
    return this.achievementService.claimReward(payload.userId, achievementId);
  }

  @Post('sync')
  async syncAchievement() {
    return this.achievementService.syncAchievements();
  }
}
