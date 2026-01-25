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
} from '@nestjs/common';

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

  // ✅ Content Moderator handles update status (NOT admin)
  @Put(':id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.CONTENT_MODERATOR)
  update(@Param('id') id: string, @Body() dto: UpdateReportDto) {
    return this.reportsService.updateByModerator(id, dto);
  }

  // ❌ Optional: disable delete (or keep admin only)
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
