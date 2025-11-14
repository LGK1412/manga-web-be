import { Controller, Get, Post, Param, Req, UnauthorizedException } from "@nestjs/common";
import { CheckinService } from "./check-in.service";
import { JwtService } from "@nestjs/jwt";

@Controller("api/checkin")
export class CheckinController {
  constructor(
    private readonly checkinService: CheckinService,
    private readonly jwtService: JwtService
  ) { }

  private extractUser(req: any) {
    const token = req.cookies["access_token"];
    if (!token) throw new UnauthorizedException("Authentication required");

    try {
      const payload: any = this.jwtService.verify(token);
      return { userId: payload.user_id, role: payload.role };
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }

  @Post("today")
  async checkinToday(@Req() req) {
    const { userId, role } = this.extractUser(req);
    return this.checkinService.checkinToday(userId, role);
  }

  @Get("status")
  async getStatus(@Req() req) {
    const { userId } = this.extractUser(req);
    return this.checkinService.getCheckinStatus(userId);
  }
}
