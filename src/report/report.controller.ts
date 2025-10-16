import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common'
import { ReportService } from './report.service'
import { CreateReportDto } from './dto/create-report.dto'
import { UpdateReportDto } from './dto/update-report.dto'
import { Query } from "@nestjs/common";

@Controller('api/reports')
export class ReportController {
  constructor(private readonly reportsService: ReportService) {}

  @Post()
  create(@Body() dto: CreateReportDto) {
    return this.reportsService.create(dto)
  }

  @Get()
  findAll() {
    return this.reportsService.findAll()
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.reportsService.findOne(id) // ✅ đổi findById → findOne
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateReportDto) {
    return this.reportsService.update(id, dto)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.reportsService.delete(id)
  }

  @Get("admin/summary")
adminSummary() {
  return this.reportsService.getAdminSummary();
}

@Get("admin/charts/weekly-new")
adminWeeklyNew(@Query("weeks") weeks = "4") {
  return this.reportsService.getWeeklyNew(Number(weeks));
}

}
