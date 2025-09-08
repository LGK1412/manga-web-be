import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Todo, TodoSchema } from "src/schemas/Todo.schema";
import { TodoSerivce } from "./todo.service";
import { TodoController } from "./todo.controller";

@Module({
    imports: [
        MongooseModule.forFeature([
            {
                name: Todo.name,
                schema: TodoSchema
            }
        ])
    ],
    providers: [TodoSerivce],
    controllers: [TodoController],
})

export class TodoModule { }