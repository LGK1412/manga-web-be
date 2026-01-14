import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

import type { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class OptionalAccessTokenGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = request.cookies?.['access_token'];

    if (!token) return true; // không đăng nhập vẫn cho xem

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: process.env.JWT_SECRET,
      });
      request['user'] = payload; // có thì gắn user
    } catch {
      // token sai/hết hạn: vẫn cho xem, không gắn user
      request['user'] = null;
    }

    return true;
  }
}
