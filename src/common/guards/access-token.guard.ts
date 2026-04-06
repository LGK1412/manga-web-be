import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Connection, Types } from 'mongoose';
import { Request } from 'express';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { UserStatus } from 'src/schemas/User.schema';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @InjectConnection()
    private readonly connection: Connection,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = request.cookies?.['access_token'];

    if (!token) {
      throw new UnauthorizedException('Please log in first');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: process.env.JWT_SECRET,
      });

      const userId = String(payload?.user_id || payload?.userId || '').trim();
      if (!userId || !Types.ObjectId.isValid(userId)) {
        throw new UnauthorizedException('Token invalid or expired');
      }

      const user = await this.connection.collection('users').findOne(
        { _id: new Types.ObjectId(userId) },
        {
          projection: {
            _id: 1,
            username: 1,
            email: 1,
            role: 1,
            status: 1,
            avatar: 1,
            bio: 1,
            point: 1,
            author_point: 1,
            locked_point: 1,
            game_point: 1,
            lastBonus: 1,
          },
        },
      );

      if (!user || user.status === UserStatus.BAN) {
        throw new UnauthorizedException('This account is no longer authorized');
      }

      request['user'] = {
        ...payload,
        user_id: user._id.toString(),
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
        username: user.username,
        avatar: user.avatar,
        bio: user.bio || '',
        point: user.point || 0,
        author_point: user.author_point || 0,
        locked_point: user.locked_point || 0,
        game_point: user.game_point || 0,
        lastBonus: user.lastBonus ?? null,
      };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Token invalid or expired');
    }
  }
}
