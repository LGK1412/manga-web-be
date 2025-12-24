import { Controller, Post, Body } from '@nestjs/common';
import { SpellCheckService } from './spellcheck.service';
import { CheckSpellDto, CheckSpellResponseDto } from './dto/check-spell.dto';

@Controller('api/spellcheck')
export class SpellCheckController {
  constructor(private readonly spellCheckService: SpellCheckService) {}

  @Post('check')
  async check(@Body() dto: CheckSpellDto): Promise<CheckSpellResponseDto> {
    return this.spellCheckService.checkText(dto);
  }
}