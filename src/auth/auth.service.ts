import { BadRequestException, Injectable, InternalServerErrorException, Req, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from 'src/schemas/User.schema';
import { RegisterDto } from './dto/Register.dto';
import { comparePassword, hashPassword } from 'utils/hashingBcrypt';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/Login.dto';
import { UserService } from 'src/user/user.service';
import { MailerService } from '@nestjs-modules/mailer';
import { OAuth2Client } from 'google-auth-library';
import { randomBytes } from 'crypto';
import { Achievement, AchievementDocument } from 'src/schemas/achievement.schema';
import { AchievementProgress, AchievementProgressDocument } from 'src/schemas/achievement-progress.schema';

@Injectable()
export class AuthService {
    private emailRateLimitMap = new Map<string, { count: number; resetTime: number }>();
    private loginRateLimitMap = new Map<string, { count: number; resetTime: number }>();
    private forgotPasswordRateLimitMap = new Map<string, { count: number; resetTime: number }>();

    constructor(
        private userService: UserService,
        private jwtService: JwtService,
        private mailerService: MailerService,
        private googleClient: OAuth2Client,
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
        @InjectModel(Achievement.name) private readonly achievementModel: Model<AchievementDocument>,
        @InjectModel(AchievementProgress.name) private readonly achievementProgressModel: Model<AchievementProgressDocument>,
    ) {
        this.googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    }

    // Đăng ký người dùng mới
    async register(registerDto: RegisterDto) {
        const existingUserByEmail = await this.userService.findByEmail(registerDto.email);
        const existingUserByUsername = await this.userService.findByUsername(registerDto.username);

        if (existingUserByEmail) {
            throw new BadRequestException('Email already exists');
        }

        if (existingUserByUsername) {
            throw new BadRequestException('Username already exists');
        }

        const passHash = await hashPassword(registerDto.password);

        const newUserData = {
            ...registerDto,
            password: passHash,
        };

        const user = await this.userService.createUser(newUserData);

        const achievements = await this.achievementModel.find({ isActive: true });

        if (achievements.length > 0) {
            const achievementProgresses = achievements.map(a => ({
                userId: user._id,
                achievementId: a._id,
                progressCount: 0,
                isCompleted: false,
                rewardClaimed: false,
            }));

            await this.achievementProgressModel.insertMany(achievementProgresses);
        }

        return { "success": true };
    }

    // Đăng nhập
    async login(loginDto: LoginDto) {
        const now = Date.now();
        const rateLimitKey = `${loginDto.email}_${loginDto.password.substring(0, 3)}`;
        const rateLimitData = this.loginRateLimitMap.get(rateLimitKey);

        if (rateLimitData) {
            if (now < rateLimitData.resetTime) {
                if (rateLimitData.count >= 5) {
                    const remainingSeconds = Math.ceil((rateLimitData.resetTime - now) / 1000);
                    throw new BadRequestException(
                        `Too many login attempts. Please try again in ${remainingSeconds} seconds.`
                    );
                }
                rateLimitData.count += 1;
            } else {
                this.loginRateLimitMap.set(rateLimitKey, { count: 1, resetTime: now + 60 * 1000 });
            }
        } else {
            this.loginRateLimitMap.set(rateLimitKey, { count: 1, resetTime: now + 60 * 1000 });
        }

        const existingUser = await this.userService.findByEmail(loginDto.email);

        if (!existingUser) {
            throw new BadRequestException('Invalid email or password');
        }

        if (!existingUser.verified) {
            throw new BadRequestException('This account has not been verified yet');
        }

        if (existingUser.status === 'ban') {
            throw new BadRequestException('This account has been banned');
        }

        if (existingUser.google_id) {
            throw new BadRequestException(
                'This account was registered with Google. Please use Google login instead.'
            );
        }

        const compare = await comparePassword(loginDto.password, existingUser.password)

        if (!compare) {
            throw new BadRequestException('Invalid email or password');
        }

        const tokenPayload = {
            user_id: existingUser._id,
            email: existingUser.email,
            username: existingUser.username,
            role: existingUser.role,
            avatar: existingUser.avatar,
            bio: existingUser.bio,
            point: existingUser.point,
            author_point: existingUser.author_point,
            game_point: existingUser.game_point,
            lastBonus: existingUser.lastBonus
        }

        const accessToken = this.jwtService.sign(tokenPayload, { expiresIn: '360d' })

        return { accessToken, tokenPayload };
    }

    // Cho client kiểmtra coi có login = refreshToken ko
    async checkLogin(accessToken: string) {
        if (!accessToken) {
            return { isLogin: false }
        }

        let decodedRefresh;

        try {
            decodedRefresh = this.jwtService.verify(accessToken);
        } catch (err) {
            return { isLogin: false }
        }

        return { isLogin: true }
    }

    // Gửi code Verification Email
    async sendVerificationEmail(email: string) {
        if (!email) {
            throw new BadRequestException('Email không hợp lệ');
        }

        const now = Date.now();
        const rateLimitData = this.emailRateLimitMap.get(email);

        if (rateLimitData) {
            if (now < rateLimitData.resetTime) {
                if (rateLimitData.count >= 3) {
                    const remainingSeconds = Math.ceil((rateLimitData.resetTime - now) / 1000);
                    throw new BadRequestException(
                        `Bạn đã gửi quá nhiều email. Vui lòng thử lại sau ${remainingSeconds} giây.`
                    );
                }
                rateLimitData.count += 1;
            } else {
                this.emailRateLimitMap.set(email, { count: 1, resetTime: now + 60 * 1000 });
            }
        } else {
            this.emailRateLimitMap.set(email, { count: 1, resetTime: now + 60 * 1000 });
        }

        const code = this.jwtService.sign(
            { email, action: 'verify_email' },
            { expiresIn: '15m' },
        );

        const verifyUrl = `${process.env.CLIENT_URL}/verify-email?token=${code}`;

        try {

            await this.mailerService.sendMail({
                to: email,
                subject: 'Xác minh email của bạn',
                template: './verifyEmail',
                context: { verifyUrl },
            });

            try {
                await this.userService.updateVerifyEmailCode(code, email);
            } catch (err) {
                throw new InternalServerErrorException(
                    `Không thể cập nhật verify_email_code cho user: ${err.message}`,
                );
            }

            return {
                success: true,
                message: 'Email xác minh đã được gửi thành công',
            };
        } catch (error) {
            throw new InternalServerErrorException(
                `Không gửi được email xác minh: ${error.message}`,
            );
        }
    }

    // verification Email code
    async verificationEmail(token: string) {
        if (!token) {
            throw new BadRequestException('Thiếu token xác minh');
        }

        let payload: any;
        try {
            payload = this.jwtService.verify(token);
        } catch {
            throw new BadRequestException('Token không hợp lệ hoặc đã hết hạn');
        }

        if (payload.action !== 'verify_email' || !payload.email) {
            throw new BadRequestException('Token không hợp lệ');
        }

        const existingUser = await this.userService.findByEmail(payload.email);

        if (!existingUser || existingUser.status === 'ban') {
            throw new BadRequestException('Người dùng không tồn tại hoặc đã bị khóa');
        }

        if (existingUser.verified) {
            throw new BadRequestException('Người dùng đã được xác thực');
        }

        if (existingUser.verify_email_code !== token) {
            throw new BadRequestException('Code sai vui lòng đăng nhập lại');
        }

        try {
            await this.userService.updateVerify(existingUser._id);
            await this.userService.updateVerifyEmailCode("", payload.email);
            return { success: true, message: 'Xác minh email thành công' };
        } catch {
            throw new BadRequestException('Không thể cập nhật trạng thái xác minh');
        }
    }

    // Login và register dùng google
    async loginWithGoogle(idToken: string) {
        const ticket = await this.googleClient.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        }).catch(() => {
            throw new UnauthorizedException('Mã thông báo Google không hợp lệ');
        });

        const payload = ticket.getPayload();

        if (!payload?.email || !payload.email_verified) {
            throw new UnauthorizedException('Email Google chưa được xác minh');
        }

        try {
            let user = await this.userService.findByEmail(payload.email);

            if (!user) {
                const randomName = "user_" + randomBytes(4).toString("hex");
                const newUser = await this.userService.createUserGoogle({
                    username: payload.name ?? randomName,
                    email: payload.email,
                    verified: true,
                    google_id: payload.sub,
                    avatar: payload.picture ?? "avatar-default.webp",
                });

                user = newUser;

                if (newUser) {
                    const achievements = await this.achievementModel.find({ isActive: true });

                    if (achievements.length > 0) {
                        const achievementProgresses = achievements.map(a => ({
                            userId: newUser._id,
                            achievementId: a._id,
                            progressCount: 0,
                            isCompleted: false,
                            rewardClaimed: false,
                        }));

                        await this.achievementProgressModel.insertMany(achievementProgresses);
                    }
                }
            }

            if (!user) {
                throw new InternalServerErrorException('Không thể tạo hoặc tìm thấy người dùng');
            }

            const tokenPayload = {
                user_id: user._id,
                email: user.email,
                username: user.username,
                role: user.role,
                avatar: user.avatar,
                bio: user.bio
            }

            const accessToken = this.jwtService.sign(tokenPayload, { expiresIn: '360d', })

            return { accessToken, tokenPayload };
        } catch (e) {
            throw new InternalServerErrorException('Lỗi hệ thống');
        }
    }

    // Gửi code Verification Forgot Password
    async sendVerificationForgotPassword(email: string) {
        if (!email) {
            throw new BadRequestException('Email không hợp lệ');
        }

        const now = Date.now();
        const rateLimitData = this.forgotPasswordRateLimitMap.get(email);

        if (rateLimitData) {
            if (now < rateLimitData.resetTime) {
                if (rateLimitData.count >= 3) {
                    const remainingSeconds = Math.ceil((rateLimitData.resetTime - now) / 1000);
                    throw new BadRequestException(
                        `Bạn đã gửi quá nhiều email. Vui lòng thử lại sau ${remainingSeconds} giây.`
                    );
                }
                rateLimitData.count += 1;
            } else {
                this.forgotPasswordRateLimitMap.set(email, { count: 1, resetTime: now + 60 * 1000 });
            }
        } else {
            this.forgotPasswordRateLimitMap.set(email, { count: 1, resetTime: now + 60 * 1000 });
        }

        const existingUser = await this.userService.findByEmail(email)

        if (!existingUser || existingUser.status === 'ban') {
            throw new BadRequestException('Email không hợp lệ hoặc tài khoản không khả dụng');
        }

        if (existingUser.google_id) {
            throw new BadRequestException('Vui lòng đăng nhập bằng tài khoản google');
        }

        if (!existingUser.verified) {
            throw new BadRequestException('Người dùng chưa được xác thực');
        }

        const code = this.jwtService.sign(
            { email, action: 'verify_forgot_password' },
            { expiresIn: '15m' },
        );

        const verifyUrl = `${process.env.CLIENT_URL}/reset-forgot-password?email=${email}&code=${code}`;

        try {

            await this.mailerService.sendMail({
                to: email,
                subject: 'Xác minh email của bạn',
                template: './verifyForgotPassword',
                context: { verifyUrl },
            });

            try {
                await this.userService.updateVerifyForgotPasswordCode(code, email);
            } catch (err) {
                throw new InternalServerErrorException(
                    `Không thể cập nhật verify_forgot_password_code cho user: ${err.message}`,
                );
            }

            return {
                success: true,
                message: 'Email xác minh đã được gửi thành công',
            };
        } catch (error) {
            throw new InternalServerErrorException(
                `Không gửi được email xác minh: ${error.message}`,
            );
        }
    }

    // verification forgot password code
    async verificationForgotPassword(token: string, password: string) {
        if (!token) {
            throw new BadRequestException('Thiếu token xác minh');
        }

        let payload: any;

        try {
            payload = this.jwtService.verify(token);
        } catch {
            throw new BadRequestException('Token không hợp lệ hoặc đã hết hạn');
        }

        if (payload.action !== 'verify_forgot_password' || !payload.email) {
            throw new BadRequestException('Token không hợp lệ');
        }

        const existingUser = await this.userService.findByEmail(payload.email);

        if (!existingUser || existingUser.status === 'ban') {
            throw new BadRequestException('Người dùng không tồn tại hoặc đã bị khóa');
        }

        if (existingUser.google_id) {
            throw new BadRequestException('Vui lòng đăng nhập bằng tài khoản google');
        }

        if (!existingUser.verified) {
            throw new BadRequestException('Người dùng chưa được xác thực');
        }

        if (existingUser.verify_forgot_password_code !== token) {
            throw new BadRequestException('Code sai vui lòng gửi lại link');
        }

        const newPassword = await hashPassword(password);

        try {
            await this.userService.changePasswordForgot(newPassword, payload.email)
            return { success: true, message: 'Cập nhật mật khẩu thành công' };
        } catch {
            throw new BadRequestException('Không thể cập nhật trạng thái xác minh');
        }
    }

    // change password (khi đã đăng nhập thành công)
    async changePassword(password: string, token: string) {
        if (!token) {
            throw new BadRequestException('Thiếu token xác minh');
        }

        let payload: any;

        try {
            payload = this.jwtService.verify(token);
        } catch {
            throw new BadRequestException('Token không hợp lệ hoặc đã hết hạn');
        }

        const existingUser = await this.userService.findByEmail(payload.email);

        if (!existingUser || existingUser.status === 'ban') {
            throw new BadRequestException('Người dùng không tồn tại hoặc đã bị khóa');
        }

        if (existingUser.google_id) {
            throw new BadRequestException('Tài khoản Google không thể đổi mật khẩu');
        }

        if (!existingUser.verified) {
            throw new BadRequestException('Người dùng chưa được xác thực');
        }

        const isSamePassword = await comparePassword(password, existingUser.password);
        if (isSamePassword) {
            throw new BadRequestException('New password must be different from the old password');
        }

        const newPassword = await hashPassword(password);

        try {
            await this.userService.changePassword(newPassword, payload.email)
            return { success: true, message: 'Password updated successfully' };
        } catch (error) {
            throw new BadRequestException('Unable to update password');
        }
    }

    async getMe(req: any) {
        try {
            const userPayload = req.user;
            if (!userPayload || !userPayload.user_id) {
                throw new UnauthorizedException('Thông tin người dùng không hợp lệ');
            }

            const userId = userPayload.user_id;

            const user = await this.userModel
                .findById(userId)
                .select('_id username email role avatar bio point author_point game_point')
                .lean();

            if (!user) {
                throw new UnauthorizedException('Người dùng không tồn tại');
            }

            return {
                user_id: user._id,
                username: user.username,
                role: user.role,
                avatar: user.avatar,
                email: user.email,
                bio: user.bio || '',
                point: user.point || 0,
                author_point: user.author_point || 0,
                game_point: user.game_point || 0,
            };
        } catch (error) {
            if (error instanceof UnauthorizedException) {
                throw error;
            }
            throw new InternalServerErrorException('Không thể lấy thông tin người dùng');
        }
    }
}