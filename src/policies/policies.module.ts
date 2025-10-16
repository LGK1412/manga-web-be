import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PoliciesController } from './policies.controller';
import { PoliciesService } from './policies.service';
import { Policies, PoliciesSchema } from '../schemas/Policies.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Policies.name, schema: PoliciesSchema }]),
  ],
  controllers: [PoliciesController],
  providers: [PoliciesService],
  exports: [PoliciesService],
})
export class PoliciesModule {}
