import { Body, Controller, Get, Post, UsePipes, ValidationPipe } from "@nestjs/common";
import { TodoSerivce } from "./todo.service";
import { AddTodoDto } from "./dto/AddTodo.dto";

@Controller('api/todo')
export class TodoController {
    constructor(private todoService: TodoSerivce) { }

    @Post()
    @UsePipes(new ValidationPipe())
    async addTodo(@Body() addTodoDto: AddTodoDto) {
        return await this.todoService.addTodo(addTodoDto)
    }

    @Get()
    async getAllTodo() {
        return await this.todoService.getAllTodo()
    }
}