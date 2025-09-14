import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { User } from "src/schemas/User.schema";
import { RegisterDto } from "../auth/dto/Register.dto";
import { CreateUserGoogleDto } from "src/auth/dto/CreateUserGoogle.dto";
import { JwtService } from '@nestjs/jwt'

@Injectable()
export class UserService {
    constructor(@InjectModel(User.name) private userModel: Model<User>,
    private jwtService: JwtService
   ) { }
    // ---------------- Của auth -------------------- //
    async createUserGoogle(createUserGoogleDto: CreateUserGoogleDto) {
        try {
            const newUser = new this.userModel(createUserGoogleDto);
            return await newUser.save();
        } catch (error) {
            if (error.code === 11000 && error.keyPattern?.email) {
                throw new Error("Email đã tồn tại");
            }
            throw error;
        }
    }

    async createUser(registerDto: RegisterDto) {
        try {
            const newUser = new this.userModel(registerDto);
            return await newUser.save();
        } catch (error) {
            if (error.code === 11000 && error.keyPattern?.email) {
                throw new Error("Email đã tồn tại");
            }
            throw error;
        }
    }

    async findByEmail(email: string) {
        return await this.userModel.findOne({ email }).select('+password +google_id');
    }

    async findByEmailAndUsername(email: string, username: string) {
        return await this.userModel.findOne({
            $or: [
                { email },
                { username }
            ]
        }).select('+password +google_id');
    }

    async updateVerify(id: Types.ObjectId) {
        const result = await this.userModel.updateOne(
            { _id: id },
            { $set: { verified: true } }
        );

        if (result.modifiedCount === 0) {
            throw new BadRequestException("Không thể cập nhật verified cho user");
        }

        return { success: true };
    }

    async updateVerifyEmailCode(code: string, email: string) {
        const result = await this.userModel.updateOne(
            { email },
            { $set: { verify_email_code: code } }
        );

        if (result.modifiedCount === 0) {
            throw new BadRequestException("Không thể cập nhật verify_email_code cho user");
        }

        return { success: true };
    }

    async updateVerifyForgotPasswordCode(code: string, email: string) {
        const result = await this.userModel.updateOne(
            { email },
            { $set: { verify_forgot_password_code: code } }
        );

        if (result.modifiedCount === 0) {
            throw new BadRequestException("Không thể cập nhật verify_forgot_password_code cho user");
        }

        return { success: true };
    }

    async changePasswordForgot(newPassword: string, email: string) {
        const result = await this.userModel.updateOne(
            { email },
            { $set: { verify_forgot_password_code: "", password: newPassword } }
        );

        if (result.modifiedCount === 0) {
            throw new BadRequestException("Không thể cập nhật mật khẩu mới cho user");
        }

        return { success: true };
    }
    // ---------------- Của auth -------------------- //
 // user.service.ts
async updateRole(role: string, token: string) {
    if (!token) {
        throw new BadRequestException('Thiếu token xác minh');
    }

    let payload: any;
    try {
        payload = this.jwtService.verify(token);
    } catch {
        throw new BadRequestException('Token không hợp lệ hoặc đã hết hạn');
    }

    const existingUser = await this.userModel.findOne({ email: payload.email });
    if (!existingUser) {
        throw new BadRequestException('Người dùng không tồn tại');
    }

    const result = await this.userModel.updateOne(
        { email: payload.email },
        { $set: { role: role } }
    );

    if (result.modifiedCount === 0) {
        throw new BadRequestException('Không thể cập nhật role cho user');
    }

    return { success: true, message: 'Cập nhật role thành công' };
}
}
