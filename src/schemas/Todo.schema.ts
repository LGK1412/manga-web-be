import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

@Schema({ timestamps: true })
export class Todo {
    @Prop({ required: true })
    name: string

    @Prop({ required: false })
    content: string

    @Prop({ required: false, default: false })
    isDone: boolean
}

export const TodoSchema = SchemaFactory.createForClass(Todo)