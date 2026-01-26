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
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import type { JwtPayload } from 'src/common/interfaces/jwt-payload.interface';

@Controller('api/checkin')
export class CheckinController {
  constructor(private readonly checkinService: CheckinService) { }

  @Post('today')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
  async checkinToday(@Req() req: Request) {
    const user = req['user'];
    return this.checkinService.checkinToday(user.user_id, user.role);
  }

  @Get('status')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
  async getStatus(@Req() req: Request) {
    const user = req['user'];
    return this.checkinService.getCheckinStatus(user.user_id);
  }
}
