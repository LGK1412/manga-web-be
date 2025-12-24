import { IsArray, IsNotEmpty, IsString } from "class-validator";

export class sendNotificationDto {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsNotEmpty()
    body: string;

    @IsArray()
    @IsNotEmpty()
    deviceId: string[]

    @IsString()
    @IsNotEmpty()
    receiver_id: string

    @IsString()
    @IsNotEmpty()
    sender_id: string
}