import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator"

export class AddTodoDto {
    @IsString()
    @IsNotEmpty()
    name: string

    @IsString()
    @IsOptional()
    content: string

    @IsBoolean()
    @IsOptional()
    isDone: boolean
}