import { Module } from '@nestjs/common';
import { SpellCheckController } from './spellcheck.controller';
import { SpellCheckService } from './spellcheck.service';

@Module({
  controllers: [SpellCheckController],
  providers: [SpellCheckService],
  exports: [SpellCheckService],
})
export class SpellCheckModule {}