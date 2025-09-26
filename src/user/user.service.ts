import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { User, UserStatus } from "src/schemas/User.schema";
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
    return await this.userModel
      .findOne({ email })
      .select("+password +google_id");
  }

  async findByEmailAndUsername(email: string, username: string) {
    return await this.userModel
      .findOne({
        $or: [{ email }, { username }],
      })
      .select("+password +google_id");
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
      throw new BadRequestException(
        "Không thể cập nhật verify_email_code cho user"
      );
    }

    return { success: true };
  }

  async updateVerifyForgotPasswordCode(code: string, email: string) {
    const result = await this.userModel.updateOne(
      { email },
      { $set: { verify_forgot_password_code: code } }
    );

    if (result.modifiedCount === 0) {
      throw new BadRequestException(
        "Không thể cập nhật verify_forgot_password_code cho user"
      );
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
  // Lấy tất cả user (chỉ admin)
  async getAllUsers(token: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new BadRequestException("Token không hợp lệ hoặc đã hết hạn");
    }

    if (payload.role !== "admin") {
      throw new BadRequestException(
        "Chỉ admin mới được phép lấy danh sách user"
      );
    }

    // Trả về tất cả user, bỏ password và google_id
    return await this.userModel.find().select("-password -google_id");
  }

  // Cập nhật status user
  async updateStatus(userId: string, status: string, token: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new BadRequestException("Token không hợp lệ hoặc đã hết hạn");
    }

    if (payload.role !== "admin") {
      throw new BadRequestException(
        "Chỉ admin mới được phép cập nhật status user"
      );
    }

    // Validate status
    if (!Object.values(UserStatus).includes(status as UserStatus)) {
      throw new BadRequestException("Status không hợp lệ");
    }

    const existingUser = await this.userModel.findById(userId);
    if (!existingUser) {
      throw new BadRequestException("Người dùng không tồn tại");
    }

    const result = await this.userModel.updateOne(
      { _id: userId },
      { $set: { status } }
    );

    if (result.modifiedCount === 0) {
      throw new BadRequestException("Không thể cập nhật status cho user");
    }

    return { success: true, message: "Cập nhật status thành công" };
  }

  async updateRoleWithValidation(role: string, userId: string, userInfo: any) {
    // 1. Lấy thông tin user từ database
    const user = await this.userModel.findById(userId).select('email username avatar bio');

    if (!user) {
      throw new BadRequestException('Người dùng không tồn tại');
    }

    // 2. So sánh thông tin từ cookie với database
    const isEmailMatch = user.email === userInfo.email;
    const isUsernameMatch = user.username === userInfo.username;
    const isAvatarMatch = user.avatar === userInfo.avatar;
    const isBioMatch = user.bio === userInfo.bio;

    // 3. Nếu không khớp thì từ chối
    if (!isEmailMatch || !isUsernameMatch || !isAvatarMatch || !isBioMatch) {
      throw new BadRequestException('Thông tin người dùng không khớp với dữ liệu trong hệ thống. Vui lòng đăng nhập lại.');
    }

    // 4. Nếu khớp thì cho phép update role
    const result = await this.userModel.updateOne(
      { _id: userId },
      { $set: { role: role } }
    );

    if (result.modifiedCount === 0) {
      throw new BadRequestException('Không thể cập nhật role cho user');
    }

    return { success: true, message: 'Cập nhật role thành công' };
  }

  async updateProfile(token: string, payload: any) {
    if (!token) {
      throw new BadRequestException('Thiếu token xác minh');
    }

    let decoded: any
    try {
      decoded = this.jwtService.verify(token)
    } catch {
      throw new BadRequestException('Token không hợp lệ hoặc đã hết hạn')
    }

    const updates: any = {}
    if (payload.username !== undefined) updates.username = payload.username
    if (payload.avatar !== undefined) updates.avatar = payload.avatar
    if (payload.bio !== undefined) updates.bio = payload.bio

    if (Object.keys(updates).length === 0) {
      return { success: true, message: 'Không có thay đổi' }
    }

    const user = await this.userModel.findByIdAndUpdate(
      decoded.user_id,
      { $set: updates },
      { new: true, runValidators: true, select: "-password -google_id" }
    );

    if (!user) {
      throw new BadRequestException('Không thể cập nhật hồ sơ người dùng');
    }

    return { success: true, user };
  }

  async getFavourites(token: string) {
    if (!token) {
      throw new BadRequestException('Thiếu token xác minh');
    }

    let decoded: any;
    try {
      decoded = this.jwtService.verify(token);
    } catch {
      throw new BadRequestException('Token không hợp lệ hoặc đã hết hạn');
    }
    const user = await this.userModel
      .findById(decoded.user_id)
      .select('favourites')
      .populate({
        path: 'favourites',
        populate: {
          path: 'styles',
          select: 'name'
        }
      });

    if (!user) {
      throw new BadRequestException('Người dùng không tồn tại');
    }

    return { favourites: user.favourites || [] };
  }

  async toggleFavourite(token: string, mangaId: string) {
    if (!token) {
      throw new BadRequestException('Thiếu token xác minh');
    }

    let decoded: any;
    try {
      decoded = this.jwtService.verify(token);
    } catch {
      throw new BadRequestException('Token không hợp lệ hoặc đã hết hạn');
    }

    const mangaObjectId = new Types.ObjectId(mangaId);

    const user = await this.userModel
      .findById(decoded.user_id)
      .select('favourites')
      .populate('favourites');

    if (!user) {
      throw new BadRequestException('Người dùng không tồn tại');
    }

    let updatedFavourites: Types.ObjectId[];
    const exists = user.favourites.some((m: any) => m._id.equals(mangaObjectId));

    if (exists) {
      // Remove manga khỏi favourites
      updatedFavourites = user.favourites.filter((m: any) => !m._id.equals(mangaObjectId));
    } else {
      // Add manga vào favourites
      updatedFavourites = [...user.favourites, mangaObjectId];
    }

    user.favourites = updatedFavourites;
    await user.save();

    return { favourites: user.favourites, isFavourite: !exists };
  }
}
