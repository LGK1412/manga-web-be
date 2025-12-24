import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { PoliciesService } from './policies.service';
import { CreatePoliciesDto } from './dto/create-policies.dto';
import { UpdatePoliciesDto } from './dto/update-policies.dto';

@Controller('api/policies')
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  // 🟢 Create new policy
  @Post()
  create(@Body() dto: CreatePoliciesDto) {
    return this.policiesService.create(dto);
  }

  // 🟡 Get all or filter by mainType (e.g. ?mainType=TERMS)
  @Get()
  async findAll(@Query('mainType') mainType?: string) {
    if (mainType) {
      return this.policiesService.findByMainType(mainType);
    }
    return this.policiesService.findAll();
  }

  // 🟢 Get all active policies
  @Get('active')
  findActive() {
    return this.policiesService.findActive();
  }

  // 🟢 Get all public + active policies
  @Get('public')
  findPublicActive() {
    return this.policiesService.findPublicActive();
  }

  // 🟡 Get one by ID
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.policiesService.findById(id);
  }

  // 🟢 Update
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePoliciesDto) {
    return this.policiesService.update(id, dto);
  }

  // 🔴 Delete
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.policiesService.delete(id);
  }
}
