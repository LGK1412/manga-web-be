import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { SubmitDto } from './dto/submit.dto';
import { AiResultDto } from './dto/ai-result.dto';
import { DecideDto } from './dto/decide.dto';
import { RecheckDto } from './dto/recheck.dto';
import { InvalidateDto } from './dto/invalidate.dto';
import { BadRequestException, /* ... */ } from '@nestjs/common';
import { Types } from 'mongoose';


@Controller('moderation')
export class ModerationController {
  constructor(private readonly svc: ModerationService) {}

  @Post('submit')
  submit(@Body() dto: SubmitDto, @Req() req: any) {
    return this.svc.submit(dto, req?.user?._id);
  }

  @Post('ai-result')
  aiResult(@Body() dto: AiResultDto) {
    return this.svc.saveAiResult(dto);
  }

  @Post('decide')
  decide(@Body() dto: DecideDto, @Req() req: any) {
    return this.svc.decide(dto, req?.user?._id);
  }

  @Post('recheck')
  recheck(@Body() dto: RecheckDto, @Req() req: any) {
    return this.svc.recheck(dto, req?.user?._id);
  }

  @Patch('invalidate')
  invalidate(@Body() dto: InvalidateDto, @Req() req: any) {
    return this.svc.invalidate(dto, req?.user?._id);
  }

  @Get('queue')
  queue(
    @Query('status') status?: string,
    @Query('limit') limit?: number,
    @Query('page') page?: number,
    @Query('q') q?: string,
    @Query('resolutionStatus') resolutionStatus?: string,
    @Query('riskMin') riskMin?: number,
    @Query('riskMax') riskMax?: number,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: 'asc' | 'desc',
  ) {
    return this.svc.listQueue({
      status,
      limit,
      page,
      q,
      resolutionStatus,
      riskMin,
      riskMax,
      sortBy,
      sortDir,
    });
  }

  // Ép chạy kiểm duyệt AI ngay
  @Post('run-ai/:chapterId')
runAi(@Param('chapterId') chapterId: string) {
  if (!Types.ObjectId.isValid(chapterId)) {
    throw new BadRequestException('Invalid chapterId (must be a 24-hex ObjectId)');
  }
  return this.svc.runAiCheck(chapterId);
}

  @Get('record/:chapterId')
async getRecord(@Param('chapterId') chapterId: string) {
  if (!Types.ObjectId.isValid(chapterId)) {
    throw new BadRequestException('Invalid chapterId (must be a 24-hex ObjectId)');
  }
  return this.svc.getRecord(chapterId);
}
}
