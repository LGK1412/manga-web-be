import { IsArray, IsNotEmpty, IsString } from "class-validator";

export class CreateCommentDTO {
    @IsString()
    @IsNotEmpty()
    chapter_id: string;

    @IsString()
    @IsNotEmpty()
    content: string;
}