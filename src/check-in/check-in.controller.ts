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
  constructor(private readonly checkinService: CheckinService) { }

  @Post('today')
  @UseGuards(AccessTokenGuard)
  async checkinToday(@Req() req: Request) {
    const user = req['user'];
    return this.checkinService.checkinToday(user.user_id, user.role);
  }

  @Get('status')
  @UseGuards(AccessTokenGuard)
  async getStatus(@Req() req: Request) {
    const user = req['user'];
    return this.checkinService.getCheckinStatus(user.user_id);
  }
}
