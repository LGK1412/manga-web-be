import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { LicenseController } from './license.controller';
import { LicenseService } from './license.service';
import { Manga, MangaSchema } from '../schemas/Manga.schema';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Manga.name, schema: MangaSchema }]),
  ],
  controllers: [LicenseController],
  providers: [LicenseService, CloudinaryService],
  exports: [LicenseService],
})
export class LicenseModule {}
