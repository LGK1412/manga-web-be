import { BadRequestException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from 'src/schemas/User.schema';
import { RegisterDto } from './dto/Register.dto';
import { comparePassword, hashPassword } from 'utils/hashingBcrypt';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/Login.dto';
import { UserService } from 'src/user/user.service';
import { MailerService } from '@nestjs-modules/mailer';
import { OAuth2Client } from 'google-auth-library';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
    constructor(
        @InjectModel(User.name) private userModel: Model<User>,
        private userService: UserService,
        private jwtService: JwtService,
        private mailerService: MailerService,
        private googleClient: OAuth2Client
    ) {
        this.googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    }

    // Đăng ký người dùng mới
    async register(registerDto: RegisterDto) {

        const existingUser = await this.userService.findByEmailAndUsername(registerDto.email, registerDto.username);

        if (existingUser) {
            throw new BadRequestException('Người dùng có email hoặc tên người dùng này đã tồn tại');
        }

        const passHash = await hashPassword(registerDto.password);

        const newUserData = {
            ...registerDto,
            password: passHash,
        };

        await this.userService.createUser(newUserData);

        return { "success": true };
    }

    // Đăng nhập
    async login(loginDto: LoginDto) {
        const existingUser = await this.userService.findByEmail(loginDto.email);

        if (!existingUser) {
            throw new BadRequestException('Email này không tồn tại');
        }

        if (!existingUser.verified) {
            throw new BadRequestException('Tài khoản này chưa được xác minh');
        }

        if (existingUser.status === 'ban') {
            throw new BadRequestException('Tài khoản này đã bị cấm');
        }

        if (existingUser.google_id) {
            throw new BadRequestException('Tài khoản này đã được đăng ký với Google. Vui lòng sử dụng thông tin đăng nhập Google.');
        }

        const compare = await comparePassword(loginDto.password, existingUser.password)

        if (!compare) {
            throw new BadRequestException('Mật khẩu không hợp lệ');
        }

        const tokenPayload = {
            user_id: existingUser._id,
            email: existingUser.email,
            username: existingUser.username,
            role: existingUser.role,
            avatar: existingUser.avatar
        }

        const accessToken = this.jwtService.sign(tokenPayload, { expiresIn: '360d' })

        return { accessToken, tokenPayload };
    }

    // Lấy access_token mới khi hết hạn
    async getNewAccessToken(refreshToken: string) {

        if (!refreshToken) {
            throw new BadRequestException('Refresh token die');
        }

        let decodedRefresh;

        try {
            decodedRefresh = this.jwtService.verify(refreshToken); // giải mã và check hợp lệ
        } catch (err) {
            throw new BadRequestException('Refresh token die');
        }

        // Lấy thông tin user từ payload của refresh token
        const existingUser = await this.userService.findByEmail(decodedRefresh.email);
        if (!existingUser) {
            throw new BadRequestException('Không tìm thấy người dùng');
        }

        // Kiểm tra trạng thái user

        if (existingUser.status === 'ban') {
            throw new BadRequestException('Tài khoản này đã bị cấm');
        }

        const tokenPayload = {
            user_id: existingUser._id,
            email: existingUser.email,
            username: existingUser.username,
            role: existingUser.role,
        }

        // Tạo access token mới
        const newAccessToken = this.jwtService.sign(tokenPayload);

        return { accessToken: newAccessToken };
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

        const code = this.jwtService.sign(
            { email, action: 'verify_email' },
            { expiresIn: '3m' },
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
                user = await this.userService.createUserGoogle({
                    username: payload.name ?? randomName,
                    email: payload.email,
                    verified: true,
                    google_id: payload.sub,
                    avatar: payload.picture ?? "avatar-default.webp",
                });
            }


            const tokenPayload = {
                user_id: user._id,
                email: user.email,
                username: user.username,
                role: user.role,
                avatar: user.avatar
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

        const existingUser = await this.userService.findByEmail(email)

        if (!existingUser || existingUser.status === 'ban') {
            throw new BadRequestException('Người dùng không tồn tại hoặc đã bị khóa');
        }

        if (existingUser.google_id) {
            throw new BadRequestException('Vui lòng đăng nhập bằng tài khoản google');
        }

        if (!existingUser.verified) {
            throw new BadRequestException('Người dùng chưa được xác thực');
        }

        const code = this.jwtService.sign(
            { email, action: 'verify_forgot_password' },
            { expiresIn: '3m' },
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

        if (!existingUser.verified) {
            throw new BadRequestException('Người dùng chưa được xác thực');
        }

        const newPassword = await hashPassword(password);

        try {
            await this.userService.changePasswordForgot(newPassword, payload.email)
            return { success: true, message: 'Cập nhật mật khẩu thành công' };
        } catch {
            throw new BadRequestException('Không thể cập nhật trạng thái xác minh');
        }
    }
}