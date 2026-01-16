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
export class StylesController {
  constructor(private readonly stylesService: StylesService) {}

  /**
   * ADMIN: tạo style
   */
  @Post()
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN)
  create(@Body() createStylesDto: any) {
    return this.stylesService.create(createStylesDto);
  }

  /**
   * Public: lấy tất cả styles
   */
  @Get()
  findAll() {
    return this.stylesService.findAll();
  }

  /**
   * Public: lấy styles đang active
   */
  @Get('active')
  findActive() {
    return this.stylesService.findActive();
  }

  /**
   * Public: lấy style theo id
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.stylesService.findById(id);
  }

  /**
   * ADMIN: update style
   */
  @Put(':id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() updateStylesDto: any) {
    return this.stylesService.update(id, updateStylesDto);
  }

  /**
   * ADMIN: xoá style
   */
  @Delete(':id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.stylesService.delete(id);
  }
}
