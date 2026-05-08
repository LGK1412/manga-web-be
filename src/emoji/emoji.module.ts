import { Module } from '@nestjs/common';
import { EmojiService } from './emoji.service';
import { EmojiController } from './emoji.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Emoji, EmojiSchema } from 'src/schemas/Emoji.schema';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';

@Module({
  imports: [
    CloudinaryModule,
    MongooseModule.forFeature([
      { name: Emoji.name, schema: EmojiSchema }
    ])
  ],
  providers: [EmojiService],
  controllers: [EmojiController],
  exports: [EmojiService]
})
export class EmojiModule { }
