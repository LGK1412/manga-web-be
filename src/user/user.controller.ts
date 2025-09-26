import { Body, Controller, Post, Get, Patch, UsePipes, ValidationPipe, Req, BadRequestException, UseInterceptors, UploadedFile } from "@nestjs/common";
import type { Request } from "express";
import { UserService } from "./user.service";
import { RegisterDto } from "../auth/dto/Register.dto";
import { JwtService } from "@nestjs/jwt";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname } from "path";


@Controller('api/user')
export class UserController {
    constructor(
        private userService: UserService,
        private jwtService: JwtService
    ) { }

    @Get('/all')
    async getAllUsers(@Req() req: Request) {
        const token =
            req.cookies?.access_token ||
            req.headers['authorization']?.replace('Bearer ', '');

        if (!token) {
            throw new BadRequestException('Thiếu token xác minh');
        }

        return await this.userService.getAllUsers(token);
    }

    private verifyToken(req: any): Promise<string> {
        const token = req.cookies?.access_token;
        if (!token) {
            throw new BadRequestException(
                'Authentication required - no access token',
            );
        }

        try {
            const decoded = this.jwtService.verify(token);
            return decoded.user_id;
        } catch {
            throw new BadRequestException('Invalid or expired token');
        }
    }

    @Post('/update-role')
    async updateRole(@Body('role') role: string, @Req() req: Request) {
        // 1. Verify access_token trước
        const userId = await this.verifyToken(req);

        // 2. Lấy user_normal_info từ cookie
        const userNormalInfo = req.cookies?.user_normal_info;
        if (!userNormalInfo) {
            throw new BadRequestException('Thiếu thông tin user_normal_info');
        }

        // 3. Parse user_normal_info
        let userInfo;
        try {
            userInfo = JSON.parse(userNormalInfo);
        } catch {
            throw new BadRequestException('user_normal_info không hợp lệ');
        }

        // 4. Gọi service để validate và update role
        return await this.userService.updateRoleWithValidation(role, userId, userInfo);
    }

    @Get('/favourites')
    async getFavourites(@Req() req: Request) {
        await this.verifyToken(req);
        return await this.userService.getFavourites(req.cookies?.access_token);
    }

    @Post('/toggle-favourite')
    async toggleFavourite(@Body('mangaId') mangaId: string, @Req() req: Request) {
        await this.verifyToken(req);
        return await this.userService.toggleFavourite(req.cookies?.access_token, mangaId);
    }

    @Patch('/profile')
    @UseInterceptors(
        FileInterceptor('avatar', {
            storage: diskStorage({
                destination: 'public/assets/avatars',
                filename: (req, file, cb) => {
                    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
                    const ext = extname(file.originalname);
                    cb(null, `${unique}${ext}`); // Keep original extension
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
        const userId = await this.verifyToken(req);

        const updateData: any = {};
        if (body.username) updateData.username = body.username;
        if (body.bio) updateData.bio = body.bio;

        // Nếu có file upload, lưu trực tiếp
        if (file) {
            updateData.avatar = file.filename;
        }

        return await this.userService.updateProfile(req.cookies?.access_token, updateData);
    }

    // API cập nhật status chung
    @Post("/update-status")
    async updateStatus(
        @Body("userId") userId: string,
        @Body("status") status: string,
        @Req() req: Request
    ) {
        const token =
            req.cookies?.access_token ||
            req.headers["authorization"]?.replace("Bearer ", "");

        if (!token) {
            throw new BadRequestException("Thiếu token xác minh");
        }

        return await this.userService.updateStatus(userId, status, token);
    }
}