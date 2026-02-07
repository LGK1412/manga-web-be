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

    // Register new user
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

    // Login
    async login(loginDto: LoginDto) {
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

    // Send Verification Email code
    async sendVerificationEmail(email: string) {
        if (!email) {
            throw new BadRequestException('Invalid email');
        }

        const now = Date.now();
        const rateLimitData = this.emailRateLimitMap.get(email);

        if (rateLimitData) {
            if (now < rateLimitData.resetTime) {
                if (rateLimitData.count >= 3) {
                    const remainingSeconds = Math.ceil((rateLimitData.resetTime - now) / 1000);
                    throw new BadRequestException(
                        `Too many emails sent. Please try again in ${remainingSeconds} seconds.`
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
                subject: 'Verify your email',
                template: './verifyEmail',
                context: { verifyUrl },
            });

            try {
                await this.userService.updateVerifyEmailCode(code, email);
            } catch (err) {
                throw new InternalServerErrorException(
                    `Unable to send verification email`,
                );
            }

            return {
                success: true,
                message: 'Verification email sent successfully',
            };
        } catch (error) {
            throw new InternalServerErrorException(
                `Unable to send verification email`,
            );
        }
    }

    // verification Email code
    async verificationEmail(token: string) {
        if (!token) {
            throw new BadRequestException('Missing verification token');
        }

        let payload: any;
        try {
            payload = this.jwtService.verify(token);
        } catch {
            throw new BadRequestException('Invalid or expired token');
        }

        if (payload.action !== 'verify_email' || !payload.email) {
            throw new BadRequestException('Invalid token');
        }

        const existingUser = await this.userService.findByEmail(payload.email);

        if (!existingUser || existingUser.status === 'ban') {
            throw new BadRequestException('User does not exist or has been banned');
        }

        if (existingUser.verified) {
            throw new BadRequestException('User has already been verified');
        }

        if (existingUser.verify_email_code !== token) {
            throw new BadRequestException('Invalid code. Please request a new verification link');
        }

        try {
            await this.userService.updateVerify(existingUser._id);
            await this.userService.updateVerifyEmailCode("", payload.email);
            return { success: true, message: 'Email verified successfully' };
        } catch {
            throw new BadRequestException('Unable to update verification status');
        }
    }

    // Login và register dùng google
    async loginWithGoogle(idToken: string) {
        const ticket = await this.googleClient.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        }).catch(() => {
            throw new UnauthorizedException('Invalid Google token');
        });

        const payload = ticket.getPayload();

        if (!payload?.email || !payload.email_verified) {
            throw new UnauthorizedException('Google email is not verified');
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
                throw new InternalServerErrorException('Unable to create or find user');
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
            throw new InternalServerErrorException('System error');
        }
    }

    // Gửi code Verification Forgot Password
    async sendVerificationForgotPassword(email: string) {
        if (!email) {
            throw new BadRequestException('Invalid email');
        }

        const existingUser = await this.userService.findByEmail(email)

        if (!existingUser || existingUser.status === 'ban') {
            throw new BadRequestException('Invalid email or account is not available');
        }

        if (existingUser.google_id) {
            throw new BadRequestException('Please login with Google account');
        }

        if (!existingUser.verified) {
            throw new BadRequestException('User has not been verified');
        }

        const code = this.jwtService.sign(
            { email, action: 'verify_forgot_password' },
            { expiresIn: '15m' },
        );

        const verifyUrl = `${process.env.CLIENT_URL}/reset-forgot-password?email=${email}&code=${code}`;

        try {

            await this.mailerService.sendMail({
                to: email,
                subject: 'Verify your email',
                template: './verifyForgotPassword',
                context: { verifyUrl },
            });

            try {
                await this.userService.updateVerifyForgotPasswordCode(code, email);
            } catch (err) {
                throw new InternalServerErrorException(
                    `Unable to send verification email`
                );
            }

            return {
                success: true,
                message: 'Verification email sent successfully',
            };
        } catch (error) {
            throw new InternalServerErrorException(
                `Unable to send verification email`,
            );
        }
    }

    // verification forgot password code
    async verificationForgotPassword(token: string, password: string) {
        if (!token) {
            throw new BadRequestException('Missing verification token');
        }

        let payload: any;

        try {
            payload = this.jwtService.verify(token);
        } catch {
            throw new BadRequestException('Invalid or expired token');
        }

        if (payload.action !== 'verify_forgot_password' || !payload.email) {
            throw new BadRequestException('Invalid token');
        }

        const existingUser = await this.userService.findByEmail(payload.email);

        if (!existingUser || existingUser.status === 'ban') {
            throw new BadRequestException('User does not exist or has been banned');
        }

        if (existingUser.google_id) {
            throw new BadRequestException('Please login with Google account');
        }

        if (!existingUser.verified) {
            throw new BadRequestException('User has not been verified');
        }

        if (existingUser.verify_forgot_password_code !== token) {
            throw new BadRequestException('Invalid code. Please request a new link');
        }

        const newPassword = await hashPassword(password);

        try {
            await this.userService.changePasswordForgot(newPassword, payload.email)
            return { success: true, message: 'Password updated successfully' };
        } catch {
            throw new BadRequestException('Unable to update password');
        }
    }

    // change password (khi đã đăng nhập thành công)
    async changePassword(password: string, token: string) {
        if (!token) {
            throw new BadRequestException('Missing verification token');
        }

        let payload: any;

        try {
            payload = this.jwtService.verify(token);
        } catch {
            throw new BadRequestException('Invalid or expired token');
        }

        const existingUser = await this.userService.findByEmail(payload.email);

        if (!existingUser || existingUser.status === 'ban') {
            throw new BadRequestException('User does not exist or has been banned');
        }

        if (existingUser.google_id) {
            throw new BadRequestException('Google accounts cannot change password');
        }

        if (!existingUser.verified) {
            throw new BadRequestException('User has not been verified');
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
                throw new UnauthorizedException('Invalid user information');
            }

            const userId = userPayload.user_id;

            const user = await this.userModel
                .findById(userId)
                .select('_id username email role avatar bio point author_point game_point')
                .lean();

            if (!user) {
                throw new UnauthorizedException('User does not exist');
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
            throw new InternalServerErrorException('Unable to get user information');
        }
    }
}