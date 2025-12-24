import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { UserService } from "./user.service";

@Injectable()
export class AuthorApprovalEventListener {
  private readonly logger = new Logger(AuthorApprovalEventListener.name);

  constructor(private readonly userService: UserService) {}

  @OnEvent("chapter_published")
  async handleChapterPublished(payload: { userId: string }) {
    try {
      await this.userService.reEvaluateAuthorRequest(payload.userId);
    } catch (error) {
      this.logger.error(`Lỗi re-evaluate author request cho user ${payload.userId}:`, error);
    }
  }

  @OnEvent("follower_count_increase")
  async handleFollowerIncrease(payload: { userId: string }) {
    try {
      await this.userService.reEvaluateAuthorRequest(payload.userId);
    } catch (error) {
      this.logger.error(`Lỗi re-evaluate author request cho user ${payload.userId}:`, error);
    }
  }

  @OnEvent("chapter_completed")
  async handleChapterCompleted(payload: { userId: string }) {
    try {
      await this.userService.reEvaluateAuthorRequest(payload.userId);
    } catch (error) {
      this.logger.error(`Lỗi re-evaluate author request cho user ${payload.userId}:`, error);
    }
  }
}


