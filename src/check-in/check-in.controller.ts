import { Controller, Get, Post, Param, Req, UnauthorizedException, UseGuards } from "@nestjs/common";
import { CheckinService } from "./check-in.service";
import { JwtService } from "@nestjs/jwt";
import { AccessTokenGuard } from "Guards/access-token.guard";

@Controller("api/checkin")
export class CheckinController {
  constructor(
    private readonly checkinService: CheckinService,
    private readonly jwtService: JwtService
  ) { }

  @Post("today")
  @UseGuards(AccessTokenGuard)
  async checkinToday(@Req() req) {
    const payload = (req as any).user;
    return this.checkinService.checkinToday(payload.user_id, payload.role);
  }

  @Get("status")
  @UseGuards(AccessTokenGuard)
  async getStatus(@Req() req) {
    const payload = (req as any).user;
    return this.checkinService.getCheckinStatus(payload.user_id);
  }
}
