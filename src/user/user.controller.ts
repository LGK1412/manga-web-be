import { Body, Controller, Post, UsePipes, ValidationPipe } from "@nestjs/common";
import { UserService } from "./user.service";
import { RegisterDto } from "./dto/Register.dto";

@Controller('api/user')
export class UserController {
    constructor(private userService: UserService) { }

    @Post('/register')
    @UsePipes(new ValidationPipe())
    async register(@Body() registerDto: RegisterDto) {
        return this.userService.register(registerDto)
    }
}