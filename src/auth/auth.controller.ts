import { BadRequestException, Body, Controller, Get, NotImplementedException, Post, Req, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/Register.dto';
import { LoginDto } from './dto/Login.dto';
import type { Request, Response } from 'express';

@Controller('api/auth')
export class AuthController {
    jwtService: any;
    userService: any;
    constructor(private authService: AuthService) { }

    @Post('/register')
    async register(@Body() registerDto: RegisterDto) {
        return this.authService.register(registerDto)
    }

    @Post('/login')
    async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response, @Req() req: Request) {
        const { accessToken, tokenPayload } = await this.authService.login(loginDto);

        res.cookie('access_token', accessToken, {
            httpOnly: true,
            maxAge: 360 * 24 * 60 * 60 * 1000,
            secure: false,
            sameSite: "strict",
        });

        return { accessToken, tokenPayload };
    }

    @Get("/check-login")
    async checkLogin(@Res({ passthrough: true }) res: Response, @Req() req: Request) {
        return this.authService.checkLogin(req.cookies?.access_token);
    }

    @Post('/send-verify-email')
    async sendVerifyEmail(@Body('email') email: string) {
        return await this.authService.sendVerificationEmail(email);
    }

    @Post('/verify-email')
    async verificationEmail(@Body('code') code: string) {
        return await this.authService.verificationEmail(code);
    }

    @Post('/google')
    async loginWithGoogle(@Body('idToken') idToken: string, @Res({ passthrough: true }) res: Response,) {
        const { accessToken, tokenPayload } = await this.authService.loginWithGoogle(idToken)

        res.cookie('access_token', accessToken, {
            httpOnly: true,
            maxAge: 360 * 24 * 60 * 60 * 1000,
            secure: false,
            sameSite: "strict",
        });

        return { accessToken, tokenPayload };
    }

    @Post('/send-forgot-password')
    async sendVerificationForgotPassword(@Body('email') email: string) {
        return await this.authService.sendVerificationForgotPassword(email);
    }

    @Post('/verify-forgot-password')
    async verificationForgotPassword(
        @Body('code') code: string,
        @Body('password') password: string
    ) {
        return await this.authService.verificationForgotPassword(code, password);
    }

    @Get('/logout')
    logout(@Res({ passthrough: true }) res: Response, @Req() req: Request) {
        res.cookie('access_token', '', {
            httpOnly: true,
            secure: false,
            sameSite: 'strict',
            maxAge: 0,
        })

        return { success: true }
    }

    @Post('/change-password')
    async changePassword(@Body('password') password: string, @Req() req: Request) {
        return await this.authService.changePassword(password, req.cookies?.access_token);
    }

    @Get('me')
    async getMe(@Req() req) {
        return this.authService.getMe(req);
    }

}
