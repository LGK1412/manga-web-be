import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { User } from "src/schemas/User.schema";
import { RegisterDto } from "../auth/dto/Register.dto";
import { CreateUserGoogleDto } from "src/auth/dto/CreateUserGoogle.dto";

@Injectable()
export class UserService {
    constructor(@InjectModel(User.name) private userModel: Model<User>) { }
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
}
