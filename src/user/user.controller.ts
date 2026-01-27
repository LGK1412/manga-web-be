import {
  Body,
  Controller,
  Post,
  Get,
  Patch,
  Req,
  Param,
  BadRequestException,
  UseGuards,
  UsePipes,
  ValidationPipe,

  // ✅ THÊM
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import type { Request } from 'express';

// ✅ THÊM
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

import { UserService } from './user.service';
import { JwtService } from '@nestjs/jwt';

import { AccessTokenGuard } from 'src/common/guards/access-token.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';

import { AdminSetRoleDto } from './dto/admin-set-role.dto';
import { ModBanUserDto, ModMuteUserDto } from './dto/moderate-user.dto';
import { AdminResetUserStatusDto } from "./dto/admin-reset-user-status.dto";

@Controller('api/user')
export class UserController {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  // ================= ADMIN =================

  @Get('/all')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.CONTENT_MODERATOR, Role.COMMUNITY_MANAGER)
  async getAllUsers(@Req() req: Request) {
    return this.userService.getAllUsers();
  }

  /**
   * ✅ Admin: chỉ ban/mute cho CONTENT_MODERATOR & COMMUNITY_MANAGER (kỷ luật staff)
   */
  @Post('/update-status')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async updateStatus(
    @Body('userId') userId: string,
    @Body('status') status: string,
    @Req() req: Request,
  ) {
    const admin = (req as any).user;
    const adminId = admin?.userId || admin?.user_id;
    return this.userService.adminUpdateStaffStatus(adminId, userId, status);
  }

  @Patch('/admin/set-role')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async adminSetRole(@Body() dto: AdminSetRoleDto, @Req() req: Request) {
    const admin = (req as any).user;
    const adminId = admin?.userId || admin?.user_id; // ✅ fix nhỏ cho chắc
    return this.userService.adminSetRole(adminId, dto.userId, dto.role);
  }

  // ================= MODERATION =================

  /**
   * ✅ Content Moderator: BAN user/author + log cho admin
   */
  @Patch('/moderation/ban')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.CONTENT_MODERATOR)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async modBan(@Body() dto: ModBanUserDto, @Req() req: Request) {
    const actor = (req as any).user;
    const actorId = actor?.userId || actor?.user_id;
    return this.userService.moderatorBanUser(actorId, dto.userId, dto.reason);
  }

  /**
   * ✅ Community Manager: MUTE user/author + log cho admin
   */
  @Patch('/moderation/mute')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.COMMUNITY_MANAGER)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async modMute(@Body() dto: ModMuteUserDto, @Req() req: Request) {
    const actor = (req as any).user;
    const actorId = actor?.userId || actor?.user_id;
    return this.userService.communityMuteUser(actorId, dto.userId, dto.reason);
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
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
  async updateRole(@Body('role') role: string, @Req() req: Request) {
    const user = (req as any).user;
    const userId = (user as any).user_id || (user as any).userId;

    const userNormalInfo = req.cookies?.user_normal_info;
    if (!userNormalInfo) {
      throw new BadRequestException('Missing user_normal_info');
    }

    let userInfo: any;
    try {
      userInfo = JSON.parse(userNormalInfo);
    } catch {
      throw new BadRequestException('Invalid user_normal_info');
    }

    return this.userService.updateRoleWithValidation(role, userId, userInfo);
  }

  @Get('/favourites')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
  async getFavourites(@Req() req: Request) {
    const token = req.cookies?.access_token;
    return this.userService.getFavourites(token);
  }

  @Post('/toggle-favourite')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
  async toggleFavourite(
    @Body('mangaId') mangaId: string,
    @Req() req: Request,
  ) {
    const token = req.cookies?.access_token;
    return this.userService.toggleFavourite(token, mangaId);
  }

  @Patch('/profile')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: diskStorage({
        destination: 'public/assets/avatars',
        filename: (req, file, cb) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `${unique}${ext}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          return cb(new BadRequestException('File is not an image'), false);
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

  @Get('/point')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
  async getPoint(@Req() req: Request) {
    const user = req['user'];
    return {
      point: user.point,
      author_point: user.author_point,
      game_point: user.game_point,
      role: user.role,
    };
  }

  // ================= MISC =================

  @Patch('/add-device-id')
  async addDeviceId(@Body('device_id') deviceId: string, @Req() req: Request) {
    const token = req.cookies?.access_token;
    if (!token) return true;
    const payload = await this.jwtService.verify(token);
    return this.userService.addDeviceId(payload.user_id, deviceId);
  }

  @Get('/following')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
  async getFollowingAuthors(@Req() req: Request) {
    const token = req.cookies?.access_token;
    return this.userService.getFollowingAuthors(token);
  }

  @Post('/toggle-follow')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
  async toggleFollowAuthor(@Body('authorId') authorId: string, @Req() req: Request) {
    const token = req.cookies?.access_token;
    return this.userService.toggleFollowAuthor(token, authorId);
  }

  @Get('/follow-stats')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
  async getFollowStats(@Req() req: Request) {
    const token = req.cookies?.access_token;
    return this.userService.getFollowStats(token);
  }

  @Get('/emoji-packs-own')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
  async getUserEmojiPacksOwn(@Req() req: Request) {
    const user = req['user'];
    const userId = (user as any).user_id || (user as any).userId;
    return this.userService.getEmojiPackOwn(userId);
  }

  @Post('/buy-emoji-pack')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
  async buyEmojiPack(
    @Req() req: Request,
    @Body('pack_id') pack_id: string,
    @Body('price') price: string,
  ) {
    const user = req['user'];
    const userId = (user as any).user_id || (user as any).userId;
    return this.userService.buyEmojiPack(userId, pack_id, price);
  }

  // ================= AUTHOR =================

  @Get('/author-request/status')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
  async getAuthorRequestStatus(@Req() req: Request) {
    const user = req['user'];
    const userId = (user as any).user_id || (user as any).userId;
    return this.userService.getAuthorRequestStatus(userId);
  }

  @Post('/author-request')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.USER, Role.AUTHOR)
  async requestAuthor(@Req() req: Request) {
    const user = req['user'];
    const userId = (user as any).user_id || (user as any).userId;
    return this.userService.requestAuthor(userId);
  }

  // ================= PUBLIC =================

  @Get('/public/:id')
  async getPublicUser(@Param('id') id: string) {
    return this.userService.getPublicUserById(id);
  }

  @Get('/public-follow-stats/:id')
  async getPublicFollowStats(@Param('id') id: string) {
    return this.userService.getPublicFollowStats(id);
  }

  @Patch("/admin/reset-user-status")
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(Role.ADMIN)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
async adminResetUserStatus(@Body() dto: AdminResetUserStatusDto, @Req() req: Request) {
  const admin = (req as any).user;
  const adminId = admin?.userId || admin?.user_id;
  return this.userService.adminResetUserStatus(adminId, dto.userId, dto.reason);
}

}
