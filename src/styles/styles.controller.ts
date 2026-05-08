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

import { StylesService } from './styles.service';

import { AccessTokenGuard } from 'src/common/guards/access-token.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';

@Controller('api/styles')

export class StylesController {
  constructor(private readonly stylesService: StylesService) {}

  @Post()
  @UseGuards(AccessTokenGuard, RolesGuard)
@Roles(Role.CONTENT_MODERATOR, Role.AUTHOR, Role.USER)
  create(@Body() createStylesDto: any) {
    return this.stylesService.create(createStylesDto);
  }

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: 'asc' | 'desc',
  ) {
    return this.stylesService.findAllPaginated({
      page: Number(page || 1),
      limit: Number(limit || 10),
      search,
      status,
      sortBy,
      sortDir,
    });
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
  @UseGuards(AccessTokenGuard, RolesGuard)
@Roles(Role.CONTENT_MODERATOR, Role.AUTHOR, Role.USER)
  update(@Param('id') id: string, @Body() updateStylesDto: any) {
    return this.stylesService.update(id, updateStylesDto);
  }

  @Delete(':id')
  @UseGuards(AccessTokenGuard, RolesGuard)
@Roles(Role.CONTENT_MODERATOR, Role.AUTHOR, Role.USER)
  remove(@Param('id') id: string) {
    return this.stylesService.delete(id);
  }
}