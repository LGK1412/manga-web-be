import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Todo } from "src/schemas/Todo.schema";
import { AddTodoDto } from "./dto/AddTodo.dto";

@Injectable()
export class TodoSerivce {
    constructor(@InjectModel(Todo.name) private todoModel: Model<Todo>) { }

    addTodo(addTodoDto: AddTodoDto) {
        const newTodo = new this.todoModel(addTodoDto)
        return newTodo.save()
    }

    getAllTodo(){
        return this.todoModel.find()
    }
}