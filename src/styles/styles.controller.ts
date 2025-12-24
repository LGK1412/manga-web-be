import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { StylesService } from './styles.service';

@Controller('api/styles')
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