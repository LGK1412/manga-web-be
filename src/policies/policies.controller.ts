import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';

import { PoliciesService } from './policies.service';
import { CreatePoliciesDto } from './dto/create-policies.dto';
import { UpdatePoliciesDto } from './dto/update-policies.dto';

import { AccessTokenGuard } from 'src/common/guards/access-token.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';

@Controller('api/policies')
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  // 🟢 Create new policy (ADMIN)
  @Post()
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN)
  create(@Body() dto: CreatePoliciesDto) {
    return this.policiesService.create(dto);
  }

  // 🟡 Public: Get all or filter by mainType (e.g. ?mainType=TERMS)
  @Get()
  async findAll(@Query('mainType') mainType?: string) {
    if (mainType) {
      return this.policiesService.findByMainType(mainType);
    }
    return this.policiesService.findAll();
  }

  // 🟢 Public: Get all active policies
  @Get('active')
  findActive() {
    return this.policiesService.findActive();
  }

  // 🟢 Public: Get all public + active policies
  @Get('public')
  findPublicActive() {
    return this.policiesService.findPublicActive();
  }

  // 🟡 Public: Get one by ID
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.policiesService.findById(id);
  }

  // 🟢 Update (ADMIN)
  @Put(':id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdatePoliciesDto) {
    return this.policiesService.update(id, dto);
  }

  // 🔴 Delete (ADMIN)
  @Delete(':id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.policiesService.delete(id);
  }
}
