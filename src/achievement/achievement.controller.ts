import { Controller, Get, Param, Post, Req } from "@nestjs/common";
import { AchievementService } from "./achievement.service";
import { JwtService } from "@nestjs/jwt";

@Controller("api/achievements")
export class AchievementController {
  constructor(private readonly achievementService: AchievementService,
    private readonly jwtService: JwtService
  ) { }

  @Get("me")
  async getAchievementsForStudent(@Req() req) {
    const token = req.cookies['access_token'];
    if (!token) {
      throw new Error('Authentication required - No access token');
    }

    const payload: any = this.jwtService.verify(token);
    const userId = payload.user_id;
    return this.achievementService.getAllWithProgress(userId);
  }

  @Post(":id/claim")
  async claimReward(@Req() req, @Param('id') achievementId: string) {
    const token = req.cookies['access_token'];
    if (!token) {
      throw new Error('Authentication required - No access token');
    }

    const payload: any = this.jwtService.verify(token);
    const userId = payload.user_id;
    return this.achievementService.claimReward(userId, achievementId)
  }

  @Post("sync")
  async syncAchievement(@Req() req) {
    const token = req.cookies['access_token'];
    if (!token) {
      throw new Error('Authentication required - No access token');
    }

    const payload: any = this.jwtService.verify(token);
    const userId = payload.user_id;
    return this.achievementService.syncUserAchievements(userId)
  }
}
