import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { AuthService } from './auth.service';
import { RegisterDto } from './dto/Register.dto';
import { LoginDto } from './dto/Login.dto';
import { ChangePasswordDto } from './dto/ChangePassword.dto';

import { AccessTokenGuard } from 'src/common/guards/access-token.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import type { JwtPayload } from 'src/common/interfaces/jwt-payload.interface';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('/register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('/login')
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    const { accessToken, tokenPayload } = await this.authService.login(loginDto);

    res.cookie('access_token', accessToken, {
      httpOnly: true,
      maxAge: 360 * 24 * 60 * 60 * 1000,
      secure: false,
      sameSite: 'strict',
    });

    return { accessToken, tokenPayload };
  }

  @Get('/check-login')
  async checkLogin(@Req() req: Request) {
    return this.authService.checkLogin(req.cookies?.access_token);
  }

  @Post('/send-verify-email')
  async sendVerifyEmail(@Body('email') email: string) {
    return this.authService.sendVerificationEmail(email);
  }

  @Post('/verify-email')
  async verificationEmail(@Body('code') code: string) {
    return this.authService.verificationEmail(code);
  }

  @Post('/google')
  async loginWithGoogle(
    @Body('idToken') idToken: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, tokenPayload } =
      await this.authService.loginWithGoogle(idToken);

    res.cookie('access_token', accessToken, {
      httpOnly: true,
      maxAge: 360 * 24 * 60 * 60 * 1000,
      secure: false,
      sameSite: 'strict',
    });

    return { accessToken, tokenPayload };
  }

  @Post('/send-forgot-password')
  async sendVerificationForgotPassword(@Body('email') email: string) {
    return this.authService.sendVerificationForgotPassword(email);
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  async getMe(@Req() req: Request) {
     return this.authService.getMe(req);
  }

  @Post('/verify-forgot-password')
  async verificationForgotPassword(
    @Body('code') code: string,
    @Body('password') password: string,
  ) {
    return this.authService.verificationForgotPassword(code, password);
  }

  @Post('/logout')
  @UseGuards(AccessTokenGuard)
  logout(@Res({ passthrough: true }) res: Response) {
    try {
      res.cookie('access_token', '', {
        httpOnly: true,
        secure: false,
        sameSite: 'strict',
        maxAge: 0,
      });

      return { success: true, message: 'Logout successful' };
    } catch {
      throw new BadRequestException('Unable to logout. Please try again');
    }
  }

  @Post('/change-password')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
  async changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    // Giữ theo service hiện tại: đổi password dựa trên token cookie
    return this.authService.changePassword(
      changePasswordDto.password,
      req.cookies?.access_token,
    );
  }

}
