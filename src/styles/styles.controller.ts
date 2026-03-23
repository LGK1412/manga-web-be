import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';

import { StylesService } from './styles.service';

import { AccessTokenGuard } from 'src/common/guards/access-token.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';

@Controller('api/styles')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(Role.CONTENT_MODERATOR, Role.AUTHOR, Role.USER)
export class StylesController {
  constructor(private readonly stylesService: StylesService) {}

  @Post()
  create(@Body() createStylesDto: any) {
    return this.stylesService.create(createStylesDto);
  }

  @Get()
  findAll() {
    return this.stylesService.findAll();
  }

  @Get('all')
  findAllAlias() {
    return this.stylesService.findAll();
  }

  @Get('active')
  findActive() {
    return this.stylesService.findActive();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.stylesService.findById(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateStylesDto: any) {
    return this.stylesService.update(id, updateStylesDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.stylesService.delete(id);
  }
}