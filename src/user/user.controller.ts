import { Body, Controller, Post, UsePipes, ValidationPipe, Req } from "@nestjs/common";
import type { Request } from "express";
import { UserService } from "./user.service";
import { RegisterDto } from "../auth/dto/Register.dto";


@Controller('api/user')
export class UserController {
    constructor(private userService: UserService) { }

    @Post('/update-role')
    async updateRole(@Body('role') role: string, @Req() req: Request) {
        return await this.userService.updateRole(role, req.cookies?.access_token);
    }
}