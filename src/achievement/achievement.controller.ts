import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { AchievementService } from './achievement.service';
import { AccessTokenGuard } from 'src/common/guards/access-token.guard';
import { JwtPayload } from 'src/common/interfaces/jwt-payload.interface';

@Controller('api/achievements')
export class AchievementController {
  constructor(private readonly achievementService: AchievementService) { }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  async getAchievementsForStudent(@Req() req: Request) {
    const user = req['user'];
    return this.achievementService.getAllWithProgress(user.user_id);
  }

  @Post(':id/claim')
  @UseGuards(AccessTokenGuard)
  async claimReward(@Req() req: Request, @Param('id') achievementId: string) {
    const user = req['user'];
    return this.achievementService.claimReward(user.user_id, achievementId);
  }

  @Post('sync')
  async syncAchievement() {
    return this.achievementService.syncAchievements();
  }
}
