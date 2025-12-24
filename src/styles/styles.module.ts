import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StylesService } from './styles.service';
import { StylesController } from './styles.controller';
import { Styles, StylesSchema } from '../schemas/Styles.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Styles.name, schema: StylesSchema }
    ])
  ],
  controllers: [StylesController],
  providers: [StylesService],
  exports: [StylesService],
})
export class StylesModule {}
