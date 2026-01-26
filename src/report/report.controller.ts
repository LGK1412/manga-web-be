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

@Controller('api/reports')
export class ReportController {
  constructor(private readonly reportsService: ReportService) {}

  /** ✅ normalize user id từ JwtPayload */
  private getUserId(payload: any): string | undefined {
    return (
      payload?.userId ||
      payload?.user_id ||
      payload?.sub ||
      payload?.id ||
      undefined
    );
  }

  // USER/AUTHOR create report
  @Post()
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
  create(@Body() dto: CreateReportDto) {
    return this.reportsService.create(dto);
  }

  // ✅ Admin + Content Moderator can view
  @Get()
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.CONTENT_MODERATOR)
  findAll() {
    return this.reportsService.findAll();
  }

  @Get(':id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.CONTENT_MODERATOR)
  findOne(@Param('id') id: string) {
    return this.reportsService.findOne(id);
  }

  /**
   * ✅ Content Moderator handles report update (create audit log)
   * PUT /api/reports/:id/moderate
   */
  @Put(':id/moderate')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.CONTENT_MODERATOR)
  moderateReport(
    @Param('id') id: string,
    @Body() dto: UpdateReportDto,
    @Req() req: Request,
  ) {
    const moderatorId = this.getUserId(req['user']);
    return this.reportsService.updateByModerator(id, dto, moderatorId);
  }

  // ❌ Optional: keep legacy route if old FE still calls PUT /api/reports/:id
  @Put(':id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.CONTENT_MODERATOR)
  updateLegacy(
    @Param('id') id: string,
    @Body() dto: UpdateReportDto,
    @Req() req: Request,
  ) {
    const moderatorId = this.getUserId(req['user']);
    return this.reportsService.updateByModerator(id, dto, moderatorId);
  }

  // Admin delete
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
