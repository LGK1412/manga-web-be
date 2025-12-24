import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ReadChapterGateway } from './read-chapter-gateway';

@Module({
  imports: [ConfigModule.forRoot()],
  providers: [ReadChapterGateway],
})
export class ReadChapterModule {}
