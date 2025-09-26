import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { StylesService } from './style.service';
import { Styles } from '../schemas/Styles.schema';
import { CreateStyleDto } from './dto/CreateStyle.Schema';
import { UpdateStyleDto } from './dto/UpdateStyle.Schema';

@Controller('api/style')
export class StylesController {
  constructor(private readonly stylesService: StylesService) {}

  @Get()
  async findAll(): Promise<Styles[]> {
    return this.stylesService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Styles> {
    return this.stylesService.findOne(id);
  }

  @Post()
  async create(@Body() dto: CreateStyleDto): Promise<Styles> {
    return this.stylesService.create(dto);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateStyleDto): Promise<Styles> {
    return this.stylesService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<Styles> {
    return this.stylesService.remove(id);
  }
}
