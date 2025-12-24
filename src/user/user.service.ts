import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { User, UserDocument, UserStatus, AuthorRequestStatus } from "src/schemas/User.schema";
import { RegisterDto } from "../auth/dto/Register.dto";
import { CreateUserGoogleDto } from "src/auth/dto/CreateUserGoogle.dto";
import { JwtService } from '@nestjs/jwt'
import { sendNotificationDto } from "src/comment/dto/sendNoti.dto";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Emoji } from "src/schemas/Emoji.schema";
import { Manga, MangaDocument } from "src/schemas/Manga.schema";
import { Chapter, ChapterDocument } from "src/schemas/chapter.schema";
import { UserChapterProgress, UserChapterProgressDocument } from "src/schemas/UserChapterProgress.schema";
import { AuthorRequestStatusResponse, EligibilityCriteria } from "./dto/author-request.dto";
import { NotificationService } from "src/notification/notification.service";


@Injectable()
export class UserService {
  constructor(
    private readonly notificationService: NotificationService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Manga.name) private mangaModel: Model<MangaDocument>,
    @InjectModel(Chapter.name) private chapterModel: Model<ChapterDocument>,
    @InjectModel(UserChapterProgress.name) private chapterProgressModel: Model<UserChapterProgressDocument>,
    private jwtService: JwtService,
    private readonly eventEmitter: EventEmitter2,
  ) { }
  // ---------------- Của auth -------------------- //

  async checkUserLegit(id: string) {
    const existingUser = await this.userModel.findOne({ _id: id });
    if (!existingUser) {
      throw new BadRequestException('User does not exist');
    }

    if (existingUser.role != "user" && existingUser.role != "author") {
      throw new BadRequestException('User does not have permission');
    }

    if (existingUser.status == "ban") {
      throw new BadRequestException('User does not have permission');
    }

    return existingUser
  }

  async createUserGoogle(createUserGoogleDto: CreateUserGoogleDto) {
    try {
      const newUser = new this.userModel(createUserGoogleDto);
      return await newUser.save();
    } catch (error) {
      if (error.code === 11000 && error.keyPattern?.email) {
        throw new Error("Email already exists");
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
        throw new Error("Email already exists");
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
      throw new BadRequestException("Could not update verified status for user");
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
        "Could not update email verification code for user"
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
        "Could not update forgot password verification code for user"
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
      throw new BadRequestException("Could not update new password for user");
    }

    return { success: true };
  }
  // ---------------- Của auth -------------------- //
  // user.service.ts
  async updateRole(role: string, token: string) {
    if (!token) {
      throw new BadRequestException('Missing verification token');
    }

    let payload: any;
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new BadRequestException('Invalid or expired token');
    }

    const existingUser = await this.userModel.findOne({ email: payload.email });
    if (!existingUser) {
      throw new BadRequestException('User does not exist');
    }

    // Chặn downgrade từ author về user
    if (existingUser.role === 'author' && role === 'user') {
      throw new BadRequestException('Cannot change from author to regular user');
    }

    const result = await this.userModel.updateOne(
      { email: payload.email },
      { $set: { role: role } }
    );

    if (result.modifiedCount === 0) {
      throw new BadRequestException('Could not update role for user');
    }

    return { success: true, message: 'Role updated successfully' };
  }
  // Lấy tất cả user (chỉ admin)
  async getAllUsers(token: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new BadRequestException("Invalid or expired token");
    }

    if (payload.role !== "admin") {
      throw new BadRequestException(
        "Only admins are allowed to get user list"
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
      throw new BadRequestException("Invalid or expired token");
    }

    if (payload.role !== "admin") {
      throw new BadRequestException(
        "Only admins are allowed to update user status"
      );
    }

    // Validate status
    if (!Object.values(UserStatus).includes(status as UserStatus)) {
      throw new BadRequestException("Invalid status");
    }

    const existingUser = await this.userModel.findById(userId);
    if (!existingUser) {
      throw new BadRequestException("User does not exist");
    }

    const result = await this.userModel.updateOne(
      { _id: userId },
      { $set: { status } }
    );

    if (result.modifiedCount === 0) {
      throw new BadRequestException("Could not update status for user");
    }

    return { success: true, message: "Status updated successfully" };
  }

  async updateRoleWithValidation(role: string, userId: string, userInfo: any) {
    // 1. Lấy thông tin user từ database
    const user = await this.userModel.findById(userId).select('email username avatar bio role');

    if (!user) {
      throw new BadRequestException('User does not exist');
    }

    // 2. Chặn downgrade từ author về user
    if (user.role === 'author' && role === 'user') {
      throw new BadRequestException('Cannot change from author to regular user');
    }

    // 3. So sánh thông tin từ cookie với database
    const isEmailMatch = user.email === userInfo.email;
    const isUsernameMatch = user.username === userInfo.username;
    const isAvatarMatch = user.avatar === userInfo.avatar;
    const isBioMatch = user.bio === userInfo.bio;

    // 4. Nếu không khớp thì từ chối
    if (!isEmailMatch || !isUsernameMatch || !isAvatarMatch || !isBioMatch) {
      throw new BadRequestException('User information does not match our records. Please log in again.');
    }

    // 5. Nếu khớp thì cho phép update role
    const result = await this.userModel.updateOne(
      { _id: userId },
      { $set: { role: role } }
    );

    if (result.modifiedCount === 0) {
      throw new BadRequestException('Could not update role for user');
    }

    return { success: true, message: 'Role updated successfully' };
  }

  async updateProfile(token: string, payload: any) {
    if (!token) {
      throw new BadRequestException('Missing verification token');
    }

    let decoded: any
    try {
      decoded = this.jwtService.verify(token)
    } catch {
      throw new BadRequestException('Invalid or expired token')
    }

    const updates: any = {}
    if (payload.username !== undefined) updates.username = payload.username
    if (payload.avatar !== undefined) updates.avatar = payload.avatar
    if (payload.bio !== undefined) updates.bio = payload.bio

    if (Object.keys(updates).length === 0) {
      return { success: true, message: 'No changes detected' }
    }

    const user = await this.userModel.findByIdAndUpdate(
      decoded.user_id,
      { $set: updates },
      { new: true, runValidators: true, select: "-password -google_id" }
    );

    if (!user) {
      throw new BadRequestException('Could not update user profile');
    }

    return { success: true, user };
  }

  async getFavourites(token: string) {
    if (!token) {
      throw new BadRequestException('Missing verification token');
    }

    let decoded: any;
    try {
      decoded = this.jwtService.verify(token);
    } catch {
      throw new BadRequestException('Invalid or expired token');
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
      throw new BadRequestException('User does not exist');
    }

    return { favourites: user.favourites || [] };
  }

  async toggleFavourite(token: string, mangaId: string) {
    if (!token) {
      throw new BadRequestException('Missing verification token');
    }

    let decoded: any;
    try {
      decoded = this.jwtService.verify(token);
    } catch {
      throw new BadRequestException('Invalid or expired token');
    }

    const mangaObjectId = new Types.ObjectId(mangaId);

    const user = await this.userModel
      .findById(decoded.user_id)
      .select('favourites')
      .populate('favourites');

    if (!user) {
      throw new BadRequestException('User does not exist');
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

  async getFollowingAuthors(token: string) {
    if (!token) {
      throw new BadRequestException('Missing verification token');
    }

    let decoded: any;
    try {
      decoded = this.jwtService.verify(token);
    } catch {
      throw new BadRequestException('Invalid or expired token');
    }
    const user = await this.userModel
      .findById(decoded.user_id)
      .select('following_authors')
      .populate('following_authors');


    if (!user) {
      throw new BadRequestException('User does not exist');
    }

    return { following: user.following_authors || [] };
  }

  async toggleFollowAuthor(token: string, authorId: string) {
    if (!token) {
      throw new BadRequestException('Missing verification token');
    }

    let decoded: any;
    try {
      decoded = this.jwtService.verify(token);
    } catch {
      throw new BadRequestException('Invalid or expired token');
    }

    const authorObjectId = new Types.ObjectId(authorId);

    const user = await this.userModel
      .findById(decoded.user_id)
      .select('following_authors')
      .populate('following_authors');

    if (!user) {
      throw new BadRequestException('User does not exist');
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
            title: "You have a new follower",
            body: `${follower.username} has followed you`,
            deviceId: author.device_id ?? [],
            receiver_id: authorId,
            sender_id: decoded.user_id
          };

          // Gửi notification
          const sendNotiResult = await this.notificationService.createNotification(notificationDto);

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
      throw new BadRequestException('Missing verification token');
    }

    let decoded: any;
    try {
      decoded = this.jwtService.verify(token);
    } catch {
      throw new BadRequestException('Invalid or expired token');
    }

    const user = await this.userModel
      .findById(decoded.user_id)
      .select('following_authors');

    if (!user) {
      throw new BadRequestException('User does not exist');
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
      throw new BadRequestException("Emoji Pack already purchased")
    }
    existingUser.emoji_packs.push(new Types.ObjectId(pack_id))
    existingUser.point -= Number(price);
    existingUser.save()
    return { success: true }
  }

  // ==================== Author Approval ====================

  /**
   * Đánh giá điều kiện trở thành tác giả
   * Tiêu chí:
   * - Email phải được xác minh
   * - Có ít nhất 5 người theo dõi
   * - Đọc ít nhất 20 chương truyện
   */
  async evaluateAuthorEligibility(userId: string): Promise<EligibilityCriteria[]> {
    const userObjectId = new Types.ObjectId(userId);

    // Lấy thông tin user để kiểm tra email verification
    const user = await this.userModel.findById(userId).select('verified');
    const isEmailVerified = user?.verified === true;

    // 1️⃣ Followers count
    const followersCount = await this.userModel.countDocuments({
      following_authors: userObjectId,
    });

    // 2️⃣ Đếm số chương đã đọc (is_completed === true)
    const chaptersReadCount = await this.chapterProgressModel.countDocuments({
      user_id: userObjectId,
      is_completed: true,
    });

    const criteria: EligibilityCriteria[] = [
      {
        id: 'email_verified',
        label: 'Email verified',
        required: 1,
        actual: isEmailVerified ? 1 : 0,
        met: isEmailVerified,
      },
      {
        id: 'followers',
        label: 'Follower count',
        required: 5,
        actual: followersCount,
        met: followersCount >= 5,
      },
      {
        id: 'chapters_read',
        label: 'Chapters read count',
        required: 20,
        actual: chaptersReadCount,
        met: chaptersReadCount >= 20,
      },
    ];

    return criteria;
  }


  /**
   * Lấy trạng thái yêu cầu trở thành tác giả
   */
  async getAuthorRequestStatus(userId: string): Promise<AuthorRequestStatusResponse> {
    const user = await this.userModel.findById(userId).select('role authorRequestStatus authorRequestedAt authorApprovedAt authorAutoApproved');

    if (!user) {
      throw new NotFoundException('User does not exist');
    }

    // Nếu đã là author, trả về approved
    if (user.role === 'author') {
      const criteria = await this.evaluateAuthorEligibility(userId);
      return {
        status: 'approved',
        approvedAt: user.authorApprovedAt?.toISOString(),
        autoApproved: user.authorAutoApproved,
        criteria,
        canRequest: false,
        message: 'You are already an author',
      };
    }

    // Đánh giá điều kiện
    const criteria = await this.evaluateAuthorEligibility(userId);
    const allCriteriaMet = criteria.every((c) => c.met);

    // Nếu chưa có request
    if (!user.authorRequestStatus || user.authorRequestStatus === AuthorRequestStatus.NONE) {
      return {
        status: 'none',
        criteria,
        canRequest: true,
        message: allCriteriaMet
          ? 'You are eligible to become an author'
          : 'You are not yet eligible to become an author',
      };
    }

    // Nếu đang pending
    if (user.authorRequestStatus === AuthorRequestStatus.PENDING) {
      return {
        status: 'pending',
        requestedAt: user.authorRequestedAt?.toISOString(),
        criteria,
        canRequest: false,
        message: allCriteriaMet
          ? 'Your request is being processed. The system will automatically approve it once you meet all criteria.'
          : 'Your request is pending. Please improve the missing criteria.',
      };
    }

    // Nếu đã approved (nhưng role chưa được update - trường hợp edge case)
    return {
      status: 'approved',
      approvedAt: user.authorApprovedAt?.toISOString(),
      autoApproved: user.authorAutoApproved,
      criteria,
      canRequest: false,
      message: 'You have been approved',
    };
  }

  /**
   * Gửi yêu cầu trở thành tác giả
   * Tự động approve nếu đủ điều kiện
   */
  async requestAuthor(userId: string): Promise<{ success: boolean; message: string; autoApproved?: boolean }> {
    const user = await this.userModel.findById(userId).select('role authorRequestStatus');

    if (!user) {
      throw new NotFoundException('User does not exist');
    }

    // Nếu đã là author
    if (user.role === 'author') {
      throw new BadRequestException('You are already an author');
    }

    // Nếu đã approved
    if (user.authorRequestStatus === AuthorRequestStatus.APPROVED) {
      throw new BadRequestException('Your request has been approved');
    }

    // Đánh giá điều kiện
    const criteria = await this.evaluateAuthorEligibility(userId);
    const allCriteriaMet = criteria.every((c) => c.met);

    // Nếu đủ điều kiện → auto approve
    if (allCriteriaMet) {
      const now = new Date();
      await this.userModel.updateOne(
        { _id: userId },
        {
          $set: {
            role: 'author',
            authorRequestStatus: AuthorRequestStatus.APPROVED,
            authorRequestedAt: now,
            authorApprovedAt: now,
            authorAutoApproved: true,
          },
        }
      );

      // Gửi notification
      try {
        const userWithDevice = await this.userModel.findById(userId).select('device_id username');
        if (userWithDevice && userWithDevice.device_id?.length > 0) {
          const notificationDto: sendNotificationDto = {
            title: 'Congratulations! You have become an author',
            body: 'Your author request has been automatically approved',
            deviceId: userWithDevice.device_id,
            receiver_id: userId,
            sender_id: userId,
          };
          await this.notificationService.createNotification(notificationDto);
        }
      } catch (error) {
        console.error('Lỗi gửi notification author approval:', error);
      }

      return {
        success: true,
        message: 'Congratulations! You have become an author',
        autoApproved: true,
      };
    }

    // Nếu chưa đủ điều kiện → set pending
    await this.userModel.updateOne(
      { _id: userId },
      {
        $set: {
          authorRequestStatus: AuthorRequestStatus.PENDING,
          authorRequestedAt: new Date(),
        },
      }
    );

    return {
      success: true,
      message: 'Your request has been sent. The system will automatically approve it once you meet all criteria.',
      autoApproved: false,
    };
  }

  /**
   * Re-evaluate author request (gọi khi có chapter mới được publish)
   * Tự động approve nếu đủ điều kiện
   */
  async reEvaluateAuthorRequest(userId: string): Promise<void> {
    const user = await this.userModel.findById(userId).select('role authorRequestStatus');

    if (!user || user.role === 'author' || user.authorRequestStatus !== AuthorRequestStatus.PENDING) {
      return; // Không cần re-evaluate
    }

    const criteria = await this.evaluateAuthorEligibility(userId);
    const allCriteriaMet = criteria.every((c) => c.met);

    if (allCriteriaMet) {
      const now = new Date();
      await this.userModel.updateOne(
        { _id: userId },
        {
          $set: {
            role: 'author',
            authorRequestStatus: AuthorRequestStatus.APPROVED,
            authorApprovedAt: now,
            authorAutoApproved: true,
          },
        }
      );

      // Gửi notification
      try {
        const userWithDevice = await this.userModel.findById(userId).select('device_id username');
        if (userWithDevice && userWithDevice.device_id?.length > 0) {
          const notificationDto: sendNotificationDto = {
            title: 'Congratulations! You have become an author',
            body: 'Your author request has been automatically approved',
            deviceId: userWithDevice.device_id,
            receiver_id: userId,
            sender_id: userId,
          };
          await this.notificationService.createNotification(notificationDto);
        }
      } catch (error) {
        console.error('Lỗi gửi notification author approval:', error);
      }
    }
  }
}



