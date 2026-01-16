import {
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';

import { CheckinService } from './check-in.service';

import { AccessTokenGuard } from 'src/common/guards/access-token.guard';
import type { JwtPayload } from 'src/common/interfaces/jwt-payload.interface';
import { Role } from 'src/common/enums/role.enum';

@Controller('api/checkin')
export class CheckinController {
  constructor(private readonly checkinService: CheckinService) {}

  private toCheckinRole(role: Role): 'user' | 'author' {
    // Nếu là AUTHOR => author, còn lại coi như user
    // (ADMIN / MODERATOR / MANAGER vẫn check-in như user)
    return role === Role.AUTHOR ? 'author' : 'user';
  }

  @Post('today')
  @UseGuards(AccessTokenGuard)
  async checkinToday(@Req() req: Request) {
    const payload = (req as any).user as JwtPayload;

    if (!payload?.userId) {
      throw new BadRequestException('Authentication required');
    }

    const checkinRole = this.toCheckinRole(payload.role);

    return this.checkinService.checkinToday(payload.userId, checkinRole);
  }

  @Get('status')
  @UseGuards(AccessTokenGuard)
  async getStatus(@Req() req: Request) {
    const payload = (req as any).user as JwtPayload;

    if (!payload?.userId) {
      throw new BadRequestException('Authentication required');
    }

    return this.checkinService.getCheckinStatus(payload.userId);
  }
}
