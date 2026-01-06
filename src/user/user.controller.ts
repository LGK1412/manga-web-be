import { Body, Controller, Post, Get, Patch, UsePipes, ValidationPipe, Req, BadRequestException, UseInterceptors, UploadedFile, Param, Delete, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { UserService } from "./user.service";
import { RegisterDto } from "../auth/dto/Register.dto";
import { JwtService } from "@nestjs/jwt";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname } from "path";
import { AccessTokenGuard } from "Guards/access-token.guard";
import { AccessTokenAdminGuard } from "Guards/access-token-admin.guard";

@Controller('api/user')
export class UserController {
    constructor(
        private userService: UserService,
        private jwtService: JwtService
    ) { }

    @Get('/all')
    @UseGuards(AccessTokenAdminGuard)
    async getAllUsers(@Req() req: Request) {
        const payload = (req as any).admin;
        const token = req.cookies?.access_token || req.headers['authorization']?.replace('Bearer ', '');
        return await this.userService.getAllUsers(token);
    }

    @Post('/update-role')
    @UseGuards(AccessTokenGuard)
    async updateRole(@Body('role') role: string, @Req() req: Request) {
        const payload = (req as any).user;
        const userId = payload.user_id;

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

        return await this.userService.updateRoleWithValidation(role, userId, userInfo);
    }

    @Get('/favourites')
    @UseGuards(AccessTokenGuard)
    async getFavourites(@Req() req: Request) {
        const token = req.cookies?.access_token;
        return await this.userService.getFavourites(token);
    }

    @Post('/toggle-favourite')
    @UseGuards(AccessTokenGuard)
    async toggleFavourite(@Body('mangaId') mangaId: string, @Req() req: Request) {
        const token = req.cookies?.access_token;
        return await this.userService.toggleFavourite(token, mangaId);
    }

    @Patch('/profile')
    @UseGuards(AccessTokenGuard)
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
                    return cb(new BadRequestException('File không phải ảnh'), false);
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

        if (file) {
            updateData.avatar = file.filename;
        }

        const userPayload = (req as any).user;
        return await this.userService.updateProfile(userPayload, updateData);
    }

    @Get('point')
    @UseGuards(AccessTokenGuard)
    async getPoint(@Req() req: any) {
        const payload = (req as any).user;
        const user = await this.userService.findUserById(payload.user_id);
        return {
            point: user.point,
            author_point: user.author_point,
            game_point: user.game_point,
            role: user.role,
        };
    }

    @Post("/update-status")
    @UseGuards(AccessTokenAdminGuard)
    async updateStatus(
        @Body("userId") userId: string,
        @Body("status") status: string,
        @Req() req: Request
    ) {
        const token = req.cookies?.access_token || req.headers["authorization"]?.replace("Bearer ", "");
        return await this.userService.updateStatus(userId, status, token);
    }

    // 👉 thêm 1 deviceId mới cho user
    @Patch('/add-device-id')
    async addDeviceId(@Body('device_id') deviceId: string, @Req() req: Request) {
        const token = req.cookies?.access_token
        if (!token) return true
        const payload = await this.jwtService.verify(token)
        return this.userService.addDeviceId(payload.user_id, deviceId);
    }

    @Get('/get-all-noti-for-user/:id')
    async getAllNotiForUser(@Param('id') id: string) {
        return await this.userService.getAllNotiForUser(id)
    }

    @Get('/public/:id')
    async getPublicUser(@Param('id') id: string) {
        return await this.userService.getPublicUserById(id)
    }

    @Get('/public-follow-stats/:id')
    async getPublicFollowStats(@Param('id') id: string) {
        return await this.userService.getPublicFollowStats(id)
    }

    @Patch('/mark-noti-as-read/:id')
    @UseGuards(AccessTokenGuard)
    async markNotiAsRead(@Param('id') id: string, @Req() req: Request) {
        const payload = (req as any).user;
        return await this.userService.markNotiAsRead(id, payload.user_id)
    }

    @Patch('/mark-all-noti-as-read')
    @UseGuards(AccessTokenGuard)
    async markAllNotiAsRead(@Req() req: Request) {
        const payload = (req as any).user;
        return await this.userService.markAllNotiAsRead(payload.user_id)
    }

    @Delete('/delete-noti/:id')
    @UseGuards(AccessTokenGuard)
    async deleteNoti(@Param('id') id: string, @Req() req: Request) {
        const payload = (req as any).user;
        return await this.userService.deleteNoti(id, payload.user_id)
    }

    @Patch('/save-noti/:id')
    @UseGuards(AccessTokenGuard)
    async saveNoti(@Param('id') id: string, @Req() req: Request) {
        const payload = (req as any).user;
        return await this.userService.saveNoti(id, payload.user_id)
    }

    @Get("/following")
    @UseGuards(AccessTokenGuard)
    async getFollowingAuthors(@Req() req: Request) {
        const token = req.cookies?.access_token;
        return await this.userService.getFollowingAuthors(token);
    }

    @Post("/toggle-follow")
    @UseGuards(AccessTokenGuard)
    async toggleFollowAuthor(@Body('authorId') authorId: string, @Req() req: Request) {
        const token = req.cookies?.access_token;
        return await this.userService.toggleFollowAuthor(token, authorId);
    }

    @Get('/follow-stats')
    @UseGuards(AccessTokenGuard)
    async getFollowStats(@Req() req: Request) {
        const token = req.cookies?.access_token;
        return await this.userService.getFollowStats(token);
    }

    @Get('/admin/summary')
    @UseGuards(AccessTokenAdminGuard)
    async adminUsersSummary(@Req() req: Request) {
        return await this.userService.getUsersSummary();
    }

    @Get('/admin/charts/weekly-new')
    @UseGuards(AccessTokenAdminGuard)
    async adminUsersWeeklyNew(@Req() req: Request) {
        const weeks = Number((req.query as any).weeks ?? 4);
        return await this.userService.getUsersWeeklyNew(weeks);
    }

    @Get('/admin/recent')
    @UseGuards(AccessTokenAdminGuard)
    async adminRecentUsers(@Req() req: Request) {
        const limit = Number((req.query as any).limit ?? 5);
        return await this.userService.getRecentUsers(limit);
    }

    @Get("/emoji-packs-own")
    @UseGuards(AccessTokenGuard)
    async getUserEmojiPacksOwn(@Req() req: Request) {
        const payload = (req as any).user;
        return await this.userService.getEmojiPackOwn(payload.user_id)
    }

    @Post("/buy-emoji-pack")
    @UseGuards(AccessTokenGuard)
    async buyEmojiPack(@Req() req: Request, @Body("pack_id") pack_id: string,@Body("price") price: string){
        const payload = (req as any).user;
        return await this.userService.buyEmojiPack(payload.user_id, pack_id, price)
    }

    // ==================== Author Approval ====================

    @Get("/author-request/status")
    @UseGuards(AccessTokenGuard)
    async getAuthorRequestStatus(@Req() req: Request) {
        const payload = (req as any).user;
        return await this.userService.getAuthorRequestStatus(payload.user_id);
    }

    @Post("/author-request")
    @UseGuards(AccessTokenGuard)
    async requestAuthor(@Req() req: Request) {
        const payload = (req as any).user;
        return await this.userService.requestAuthor(payload.user_id);
    }
}