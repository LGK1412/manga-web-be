import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { User, UserDocument, UserStatus } from "src/schemas/User.schema";
import { RegisterDto } from "../auth/dto/Register.dto";
import { CreateUserGoogleDto } from "src/auth/dto/CreateUserGoogle.dto";
import { JwtService } from '@nestjs/jwt'
import { NotificationClient } from "src/notification-gateway/notification.client";
import { sendNotificationDto } from "src/comment/dto/sendNoti.dto";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Emoji } from "src/schemas/Emoji.schema";


@Injectable()
export class UserService {
  constructor(
    private readonly notificationClient: NotificationClient,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private readonly eventEmitter: EventEmitter2,
  ) { }
  // ---------------- Của auth -------------------- //

  async checkUserLegit(id: string) {
    const existingUser = await this.userModel.findOne({ _id: id });
    if (!existingUser) {
      throw new BadRequestException('Người dùng không tồn tại');
    }

    if (existingUser.role != "user" && existingUser.role != "author") {
      throw new BadRequestException('Người dùng không có quyền');
    }

    if (existingUser.status == "ban") {
      throw new BadRequestException('Người dùng không có quyền');
    }

    return existingUser
  }

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
      // Emit
      this.eventEmitter.emit("favorite_story_count", { userId: user._id })
    }

    user.favourites = updatedFavourites;
    await user.save();

    return { favourites: user.favourites, isFavourite: !exists };
  }

  async findUserById(userId: string): Promise<User> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new NotFoundException('User not found');
    }

    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');

    return user;
  }

  async getPublicUserById(userId: string): Promise<any> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new NotFoundException('User not found');
    }
    const user = await this.userModel
      .findById(userId)
      .select('username avatar bio role')
      .lean();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getPublicFollowStats(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new NotFoundException('User not found');
    }
    const user = await this.userModel
      .findById(userId)
      .select('following_authors')
      .lean();
    if (!user) throw new NotFoundException('User not found');

    const followingCount = Array.isArray((user as any).following_authors)
      ? (user as any).following_authors.length
      : 0;

    const followersCount = await this.userModel.countDocuments({
      following_authors: new Types.ObjectId(userId),
    });

    return { followingCount, followersCount };
  }

  // Add device_id cho user
  async addDeviceId(userId: string, deviceId: string) {
    // kiểm tra đầu vào
    if (!deviceId) return { success: false };

    const result = await this.userModel.findByIdAndUpdate(
      userId,
      { $addToSet: { device_id: deviceId } }, // $addToSet để tránh thêm trùng
      { new: true } // trả về user sau khi update
    );

    if (!result) {
      return { success: false, message: 'User not found' };
    }

    return { success: true, data: result.device_id };
  }

  async removeDeviceId(userId: string, pushResult: any) {
    try {
      // nếu không có failedTokens hoặc mảng rỗng → bỏ qua
      if (!pushResult?.failedTokens?.length) {
        return { success: true, message: "No failed tokens to remove." };
      }

      // Lấy danh sách token fail
      const failedTokens = pushResult.failedTokens.map((t: any) => t.token);
      // Xoá toàn bộ token fail trong 1 lần query
      const result = await this.userModel.findByIdAndUpdate(
        userId,
        { $pull: { device_id: { $in: pushResult.failedTokens } } },
        { new: true }
      );

      if (!result) {
        return { success: false, message: "User not found" };
      }

      return {
        success: true,
        removedTokens: failedTokens,
        remainingTokens: result.device_id,
      };
    } catch (error) {
      console.error("❌ Lỗi khi xoá token fail:", error);
      return { success: false, error };
    }
  }

  async getUserById(id) {
    return await this.userModel.findById(id)
  }

  async getAllNotiForUser(id: string) {
    return await this.notificationClient.sendGetNotiForUser(id)
  }

  async markNotiAsRead(id: string, payload: any) {
    const existingUser = await this.userModel.findById({ _id: payload });

    if (!existingUser) {
      throw new BadRequestException('Người dùng không tồn tại');
    }

    if (existingUser.status === 'ban') {
      throw new BadRequestException('Người dùng bị ban');
    }

    if (existingUser.role !== "user" && existingUser.role !== "author") {
      throw new BadRequestException("Bạn Không có quyền comment")
    }

    // Truyền user_id đúng cú pháp
    return await this.notificationClient.sendMarkAsRead(id, existingUser._id.toString());
  }

  async markAllNotiAsRead(payload: any) {
    const existingUser = await this.userModel.findById({ _id: payload });

    if (!existingUser) {
      throw new BadRequestException('Người dùng không tồn tại');
    }

    if (existingUser.status === 'ban') {
      throw new BadRequestException('Người dùng bị ban');
    }

    if (existingUser.role !== "user" && existingUser.role !== "author") {
      throw new BadRequestException("Bạn Không có quyền comment")
    }

    // Truyền user_id đúng cú pháp
    return await this.notificationClient.sendAllMarkAsRead(existingUser._id.toString());
  }

  async deleteNoti(id: string, payload: any) {

    const existingUser = await this.userModel.findById({ _id: payload });

    if (!existingUser) {
      throw new BadRequestException('Người dùng không tồn tại');
    }

    if (existingUser.status === 'ban') {
      throw new BadRequestException('Người dùng bị ban');
    }

    if (existingUser.role !== "user" && existingUser.role !== "author") {
      throw new BadRequestException("Bạn Không có quyền comment")
    }

    // Truyền user_id đúng cú pháp
    return await this.notificationClient.deleteNoti(id, existingUser._id.toString());
  }

  async saveNoti(id: string, payload: any) {
    const existingUser = await this.userModel.findById({ _id: payload });

    if (!existingUser) {
      throw new BadRequestException('Người dùng không tồn tại');
    }

    if (existingUser.status === 'ban') {
      throw new BadRequestException('Người dùng bị ban');
    }

    if (existingUser.role !== "user" && existingUser.role !== "author") {
      throw new BadRequestException("Bạn Không có quyền comment")
    }

    // Truyền user_id đúng cú pháp
    return await this.notificationClient.sendSaveNoti(id, existingUser._id.toString());
  }

  async getFollowingAuthors(token: string) {
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
      .select('following_authors')
      .populate('following_authors');


    if (!user) {
      throw new BadRequestException('Người dùng không tồn tại');
    }

    return { following: user.following_authors || [] };
  }

  async toggleFollowAuthor(token: string, authorId: string) {
    if (!token) {
      throw new BadRequestException('Thiếu token xác minh');
    }

    let decoded: any;
    try {
      decoded = this.jwtService.verify(token);
    } catch {
      throw new BadRequestException('Token không hợp lệ hoặc đã hết hạn');
    }

    const authorObjectId = new Types.ObjectId(authorId);

    const user = await this.userModel
      .findById(decoded.user_id)
      .select('following_authors')
      .populate('following_authors');

    if (!user) {
      throw new BadRequestException('Người dùng không tồn tại');
    }

    let updatedFollowing: Types.ObjectId[];
    const exists = user.following_authors.some((m: any) => m._id.equals(authorObjectId));
    if (exists) {
      // UNFOLLOW - Không gửi notification
      updatedFollowing = user.following_authors.filter((m: any) => !m._id.equals(authorObjectId));
      // Emit
      this.eventEmitter.emit("follow_count_decrease", { userId: user._id.toString() });
      this.eventEmitter.emit("follower_count_decrease", { userId: authorId });
    } else {
      // FOLLOW MỚI - Gửi notification cho author
      updatedFollowing = [...user.following_authors, authorObjectId];

      try {
        const follower = await this.userModel.findById(decoded.user_id).select('username');
        const author = await this.userModel.findById(authorId).select('device_id');

        if (follower && author) {
          const notificationDto: sendNotificationDto = {
            title: "Bạn có người theo dõi mới",
            body: `${follower.username} đã theo dõi bạn`,
            deviceId: author.device_id ?? [],
            receiver_id: authorId,
            sender_id: decoded.user_id
          };

          // Gửi notification
          const sendNotiResult = await this.notificationClient.sendNotification(notificationDto);

          // Xóa các device token lỗi
          await this.removeDeviceId(authorId, sendNotiResult);
        }
      } catch (error) {
        console.error('Lỗi gửi notification follow:', error);
      }
      // Emit
      this.eventEmitter.emit("follow_count_increase", { userId: user._id.toString() });
      this.eventEmitter.emit("follower_count_increase", { userId: authorId });
    }

    user.following_authors = updatedFollowing;
    await user.save();
    return { following: user.following_authors, isFollowing: !exists };

  }

  async getFollowStats(token: string) {
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
      .select('following_authors');

    if (!user) {
      throw new BadRequestException('Người dùng không tồn tại');
    }

    const followingCount = Array.isArray((user as any).following_authors)
      ? (user as any).following_authors.length
      : 0;

    const followersCount = await this.userModel.countDocuments({
      following_authors: new Types.ObjectId(decoded.user_id),
    });

    return { followingCount, followersCount };
  }


  // ===== Dashboard: User Summary (total + MoM) =====
  async getUsersSummary(): Promise<{ total: number; deltaPctMoM: number }> {
    const now = new Date();
    const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [total, thisMonth, lastMonth] = await Promise.all([
      this.userModel.estimatedDocumentCount(), // nhanh hơn countDocuments()
      this.userModel.countDocuments({ createdAt: { $gte: startThisMonth, $lt: startNextMonth } }),
      this.userModel.countDocuments({ createdAt: { $gte: startLastMonth, $lt: startThisMonth } }),
    ]);

    const deltaPctMoM =
      lastMonth === 0 ? (thisMonth > 0 ? 100 : 0) : Number((((thisMonth - lastMonth) / lastMonth) * 100).toFixed(2));

    return { total, deltaPctMoM };
  }

  // ===== Dashboard: Weekly new users =====
  // user.service.ts
  async getUsersWeeklyNew(weeks = 4) {
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - weeks * 7);

    return this.userModel.aggregate([
      { $match: { createdAt: { $gte: from, $lte: now } } },
      {
        $group: {
          _id: {
            y: { $isoWeekYear: "$createdAt" },
            w: { $isoWeek: "$createdAt" },
          },
          cnt: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          week: {
            $concat: [
              { $toString: "$_id.y" },
              "-W",
              {
                // pad 2 digits cho tuần
                $cond: [
                  { $lt: ["$_id.w", 10] },
                  { $concat: ["0", { $toString: "$_id.w" }] },
                  { $toString: "$_id.w" },
                ],
              },
            ],
          },
          new: "$cnt",
        },
      },
      { $sort: { week: 1 } },
    ]);
  }


  // ===== Dashboard: Recent users =====
  async getRecentUsers(limit = 5): Promise<Array<{ id: string; name: string; email: string; role: string; joinDate: string }>> {
    const docs = await this.userModel
      .find({}, { username: 1, email: 1, role: 1, createdAt: 1 })
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 50))
      .lean();

    return docs.map((u: any) => ({
      id: u._id.toString(),
      name: u.username,
      email: u.email,
      role: u.role,
      joinDate: u.createdAt?.toISOString()?.slice(0, 10) ?? "",
    }));
  }

  async getEmojiPackOwn(id: string) {
    const user = await this.userModel
      .findById(id)
      .select("emoji_packs")
      .populate({
        path: "emoji_packs",
        populate: { path: "emojis", model: Emoji.name },
      });
    // console.log(JSON.stringify(user, null, 2));
    return user?.emoji_packs || [];
  }

  // Nhiều pack
  async checkEmojiPacskOwn(id: string, emoji_ids: string[]) {
    const user = await this.userModel.findById(id).select("emoji_packs");
    if (!user) return false;

    const ownedIds = user.emoji_packs.map((e: Types.ObjectId) => e.toString());
    const hasAll = emoji_ids.every((id) => ownedIds.includes(id));

    return hasAll;
  }

  // 1 pack duy nhất
  async checkEmojiPackOwn(id: string, emoji_id: string) {
    const user = await this.userModel.findById(id).select("emoji_packs");
    if (!user) return false;
    return user.emoji_packs.some(
      (e: Types.ObjectId) => e.toString() === emoji_id
    );
  }

  async buyEmojiPack(user_id: string, pack_id: string, price: string) {
    const existingUser = await this.checkUserLegit(user_id)
    if (existingUser.emoji_packs.includes(new Types.ObjectId(pack_id))) {
      throw new BadRequestException("Đã mua Emoji Pack này rồi")
    }
    existingUser.emoji_packs.push(new Types.ObjectId(pack_id))
    existingUser.point -= Number(price);
    existingUser.save()
    return { success: true }
  }
}



