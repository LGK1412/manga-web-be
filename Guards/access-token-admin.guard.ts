import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class AccessTokenAdminGuard implements CanActivate {
    constructor(private readonly jwtService: JwtService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request>();

        const token = request.cookies?.['access_token'];

        if (!token) throw new UnauthorizedException('Please log in first');

        try {
            const payload = await this.jwtService.verifyAsync(token, {
                secret: process.env.JWT_SECRET, // nhớ set env
            });

            if(payload.role !== 'admin'){
                throw new UnauthorizedException('Admin access required')
            }

            // gắn info user vào request
            request['admin'] = payload;

            return true;
        } catch (err) {
            throw new UnauthorizedException('Token invalid or expired');
        }
    }
}
