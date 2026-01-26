import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import { ReportService } from './report.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';

import { AccessTokenGuard } from 'src/common/guards/access-token.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import type { JwtPayload } from 'src/common/interfaces/jwt-payload.interface';

@Controller('api/reports')
export class ReportController {
  constructor(private readonly reportsService: ReportService) {}

  @Post()
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
  create(@Body() dto: CreateReportDto) {
    return this.reportsService.create(dto);
  }

  // ✅ Admin + Content Moderator + Community Manager can view (service sẽ filter theo role)
  @Get()
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.CONTENT_MODERATOR, Role.COMMUNITY_MANAGER)
  findAll(@Req() req: Request) {
    const payload = req['user'] as JwtPayload;
    return this.reportsService.findAllForRole(payload?.role);
  }

  @Get(':id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.CONTENT_MODERATOR, Role.COMMUNITY_MANAGER)
  findOne(@Param('id') id: string, @Req() req: Request) {
    const payload = req['user'] as JwtPayload;
    return this.reportsService.findOneForRole(id, payload?.role);
  }

  /**
   * ✅ Staff handles report update
   * - Content Moderator: Manga/Chapter reports
   * - Community Manager: Comment/Reply reports
   * - Admin: all
   */
  @Put(':id/moderate')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.CONTENT_MODERATOR, Role.COMMUNITY_MANAGER)
  moderateReport(
    @Param('id') id: string,
    @Body() dto: UpdateReportDto,
    @Req() req: Request,
  ) {
    const payload = req['user'] as JwtPayload;
    return this.reportsService.updateByStaff(id, dto, payload);
  }

  // legacy
  @Put(':id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.CONTENT_MODERATOR, Role.COMMUNITY_MANAGER)
  updateLegacy(
    @Param('id') id: string,
    @Body() dto: UpdateReportDto,
    @Req() req: Request,
  ) {
    const payload = req['user'] as JwtPayload;
    return this.reportsService.updateByStaff(id, dto, payload);
  }

  @Delete(':id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.reportsService.delete(id);
  }

  @Get('admin/summary')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN)
  adminSummary() {
    return this.reportsService.getAdminSummary();
  }

  @Get('admin/charts/weekly-new')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN)
  adminWeeklyNew(@Query('weeks') weeks = '4') {
    return this.reportsService.getWeeklyNew(Number(weeks));
  }
}
