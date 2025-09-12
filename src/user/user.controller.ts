import { Body, Controller, Post, UsePipes, ValidationPipe } from "@nestjs/common";
import { UserService } from "./user.service";
import { RegisterDto } from "../auth/dto/Register.dto";

@Controller('api/user')
export class UserController {
    constructor(private userService: UserService) { }

   
}