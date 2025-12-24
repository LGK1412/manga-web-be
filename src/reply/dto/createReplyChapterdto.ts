import { IsArray, IsNotEmpty, IsString } from "class-validator";

export class CreateReplyChapterDTO {
    @IsString()
    @IsNotEmpty()
    comment_id: string;

    @IsString()
    @IsNotEmpty()
    chapter_id: string;

    @IsString()
    @IsNotEmpty()
    content: string;

    @IsString()
    @IsNotEmpty()
    receiver_id: string;
}