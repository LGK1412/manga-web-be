import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { PoliciesService } from './policies.service';
import { CreatePoliciesDto } from './dto/create-policies.dto';
import { UpdatePoliciesDto } from './dto/update-policies.dto';

@Controller('api/policies')
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  @Post()
  create(@Body() dto: CreatePoliciesDto) {
    return this.policiesService.create(dto);
  }

  @Get()
  findAll() {
    return this.policiesService.findAll();
  }

  @Get('active')
  findActive() {
    return this.policiesService.findActive();
  }

  @Get('public')
  findPublicActive() {
    return this.policiesService.findPublicActive();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.policiesService.findById(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePoliciesDto) {
    return this.policiesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.policiesService.delete(id);
  }
}
