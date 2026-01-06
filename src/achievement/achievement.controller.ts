import { Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { AchievementService } from "./achievement.service";
import { AccessTokenGuard } from "Guards/access-token.guard";

@Controller("api/achievements")
export class AchievementController {
  constructor(private readonly achievementService: AchievementService) { }

  @Get("me")
  @UseGuards(AccessTokenGuard)
  async getAchievementsForStudent(@Req() req) {
    const payload = (req as any).user;
    return this.achievementService.getAllWithProgress(payload.user_id);
  }

  @Post(":id/claim")
  @UseGuards(AccessTokenGuard)
  async claimReward(@Req() req, @Param('id') achievementId: string) {
    const payload = (req as any).user;
    return this.achievementService.claimReward(payload.user_id, achievementId)
  }

  @Post("sync")
  async syncAchievement() {
    return this.achievementService.syncAchievements()
  }
}
