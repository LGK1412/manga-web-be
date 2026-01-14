import {
  Body,
  Controller,
  Post,
  Get,
  Patch,
  Req,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { UserService } from './user.service';
import { JwtService } from '@nestjs/jwt';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

import { AccessTokenGuard } from 'src/common/guards/access-token.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';

@Controller('api/user')
export class UserController {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  // ================= ADMIN =================

  @Get('/all')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async getAllUsers(@Req() req: Request) {
    const token =
      req.cookies?.access_token ||
      req.headers['authorization']?.replace('Bearer ', '');
    return this.userService.getAllUsers(token);
  }

  @Post('/update-status')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async updateStatus(
    @Body('userId') userId: string,
    @Body('status') status: string,
    @Req() req: Request,
  ) {
    const token =
      req.cookies?.access_token ||
      req.headers['authorization']?.replace('Bearer ', '');
    return this.userService.updateStatus(userId, status, token);
  }

  @Get('/admin/summary')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async adminUsersSummary() {
    return this.userService.getUsersSummary();
  }

  @Get('/admin/charts/weekly-new')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async adminUsersWeeklyNew(@Req() req: Request) {
    const weeks = Number((req.query as any).weeks ?? 4);
    return this.userService.getUsersWeeklyNew(weeks);
  }

  @Get('/admin/recent')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async adminRecentUsers(@Req() req: Request) {
    const limit = Number((req.query as any).limit ?? 5);
    return this.userService.getRecentUsers(limit);
  }

  // ================= USER =================

  @Post('/update-role')
  @UseGuards(AccessTokenGuard)
  async updateRole(@Body('role') role: string, @Req() req: Request) {
    const user = req['user'];
    const userId = user.userId;

    const userNormalInfo = req.cookies?.user_normal_info;
    if (!userNormalInfo) {
      throw new BadRequestException('Thiếu thông tin user_normal_info');
    }

    let userInfo;
    try {
      userInfo = JSON.parse(userNormalInfo);
    } catch {
      throw new BadRequestException('user_normal_info không hợp lệ');
    }

    return this.userService.updateRoleWithValidation(role, userId, userInfo);
  }

  @Get('/favourites')
  @UseGuards(AccessTokenGuard)
  async getFavourites(@Req() req: Request) {
    const token = req.cookies?.access_token;
    return this.userService.getFavourites(token);
  }

  @Post('/toggle-favourite')
  @UseGuards(AccessTokenGuard)
  async toggleFavourite(
    @Body('mangaId') mangaId: string,
    @Req() req: Request,
  ) {
    const token = req.cookies?.access_token;
    return this.userService.toggleFavourite(token, mangaId);
  }

  @Patch('/profile')
  @UseGuards(AccessTokenGuard)
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: diskStorage({
        destination: 'public/assets/avatars',
        filename: (req, file, cb) => {
          const unique =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `${unique}${ext}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          return cb(
            new BadRequestException('File không phải ảnh'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async updateProfile(
    @Body() body: any,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    const updateData: any = {};
    if (body.username) updateData.username = body.username;
    if (body.bio) updateData.bio = body.bio;
    if (file) updateData.avatar = file.filename;

    const user = req['user'];
    return this.userService.updateProfile(user, updateData);
  }

  @Get('point')
  @UseGuards(AccessTokenGuard)
  async getPoint(@Req() req: Request) {
    const user = req['user'];
    const found = await this.userService.findUserById(user.userId);

    return {
      point: found.point,
      author_point: found.author_point,
      game_point: found.game_point,
      role: found.role,
    };
  }

  // ================= MISC =================

  @Patch('/add-device-id')
  async addDeviceId(
    @Body('device_id') deviceId: string,
    @Req() req: Request,
  ) {
    const token = req.cookies?.access_token;
    if (!token) return true;
    const payload = await this.jwtService.verify(token);
    return this.userService.addDeviceId(payload.user_id, deviceId);
  }

  @Get('/following')
  @UseGuards(AccessTokenGuard)
  async getFollowingAuthors(@Req() req: Request) {
    const token = req.cookies?.access_token;
    return this.userService.getFollowingAuthors(token);
  }

  @Post('/toggle-follow')
  @UseGuards(AccessTokenGuard)
  async toggleFollowAuthor(
    @Body('authorId') authorId: string,
    @Req() req: Request,
  ) {
    const token = req.cookies?.access_token;
    return this.userService.toggleFollowAuthor(token, authorId);
  }

  @Get('/follow-stats')
  @UseGuards(AccessTokenGuard)
  async getFollowStats(@Req() req: Request) {
    const token = req.cookies?.access_token;
    return this.userService.getFollowStats(token);
  }

  @Get('/emoji-packs-own')
  @UseGuards(AccessTokenGuard)
  async getUserEmojiPacksOwn(@Req() req: Request) {
    const user = req['user'];
    return this.userService.getEmojiPackOwn(user.userId);
  }

  @Post('/buy-emoji-pack')
  @UseGuards(AccessTokenGuard)
  async buyEmojiPack(
    @Req() req: Request,
    @Body('pack_id') pack_id: string,
    @Body('price') price: string,
  ) {
    const user = req['user'];
    return this.userService.buyEmojiPack(user.userId, pack_id, price);
  }

  // ================= AUTHOR =================

  @Get('/author-request/status')
  @UseGuards(AccessTokenGuard)
  async getAuthorRequestStatus(@Req() req: Request) {
    const user = req['user'];
    return this.userService.getAuthorRequestStatus(user.userId);
  }

  @Post('/author-request')
  @UseGuards(AccessTokenGuard)
  async requestAuthor(@Req() req: Request) {
    const user = req['user'];
    return this.userService.requestAuthor(user.userId);
  }
}
