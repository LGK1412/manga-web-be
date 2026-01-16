import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EmojiPack } from 'src/schemas/EmojiPack.schema';
import { UserService } from 'src/user/user.service';

@Injectable()
export class EmojiPackService {
    constructor(
        @InjectModel(EmojiPack.name) private emojiPackModel: Model<EmojiPack>,
        private userService: UserService
    ) { }

    async checkAdmin(payload: any) {
        const existingUser = await this.userService.findUserById(payload.user_id)
        if (!existingUser) {
            throw new BadRequestException("User does not exist")
        }

        if (existingUser.role !== "admin") {
            throw new BadRequestException("You do not have permission to add Emoji")
        }

        return existingUser
    }

    async createEmojiPack(data: any[], name: string, price: number, payload: any) {
        await this.checkAdmin(payload)
        // kiểm tra tên pack đã tồn tại chưa
        const exist = await this.emojiPackModel.findOne({ name });
        if (exist) throw new BadRequestException(`Emoji pack "${name}" already exists`);

        // lấy ObjectId từ data emoji
        const emojiIds: Types.ObjectId[] = data.map(emoji => {
            if (!emoji._id) throw new BadRequestException(`Emoji "${emoji.name}" chưa có id`);
            return new Types.ObjectId(emoji._id);
        });

        // tạo pack mới
        const newPack = new this.emojiPackModel({
            name,
            price,
            emojis: emojiIds,
        });

        const savedPack = await newPack.save();
        return { success: true, savedPack };
    }

    async getAllPack() {
        return await this.emojiPackModel.find().populate("emojis")
    }

    async getAllFreePack() {
        return await this.emojiPackModel.find({ price: 0, is_hide: false }).populate("emojis");
    }

    async updateEmojiPack(
        id: string,
        name: string,
        price: number,
        updatedNewEmoji: any[] = [],
        deletedEmoji: any[] = []
    ) {
        const pack = await this.emojiPackModel.findById(id);
        if (!pack) throw new BadRequestException("Pack does not exist");

        // Update tên và giá
        pack.name = name;
        pack.price = price;

        // Xoá emoji bị xoá khỏi mảng emojis
        if (deletedEmoji.length > 0) {
            const deletedIdsStr = deletedEmoji.map(e => e.toString());
            pack.emojis = pack.emojis.filter(eid => !deletedIdsStr.includes(eid.toString()));
        }

        // Thêm emoji mới vào mảng
        if (updatedNewEmoji.length > 0) {
            // Lấy tất cả _id nếu mảng là object Emoji
            const newIds = updatedNewEmoji.map(e => e._id || e);
            pack.emojis.push(...newIds);
        }

        await pack.save();

        return { success: true, pack };
    }

    async deletePackById(id: string, payload: any) {
        await this.checkAdmin(payload)
        // Lấy pack hiện tại
        const pack = await this.emojiPackModel.findById(id);
        if (!pack) throw new BadRequestException("Pack does not exist");

        // Toggle is_hide
        pack.is_hide = !pack.is_hide;

        await pack.save();

        return { success: true, is_hide: pack.is_hide };
    }

    async getPackForShop(page: number, limit: number, payload: any) {
        await this.userService.checkUser(payload.user_id);
        
        const userOwnEmojiPack = await this.userService.getEmojiPackOwn(payload.user_id);

        // Lấy danh sách _id pack user đã có (convert sang string để so sánh dễ)
        const ownedIds = userOwnEmojiPack.map((pack: any) => pack._id.toString());

        const skip = (page - 1) * limit;

        // Lấy pack có giá > 0 (pack bán)
        const [packs, total] = await Promise.all([
            this.emojiPackModel
                .find({ price: { $gt: 0 } })
                .skip(skip)
                .limit(limit)
                .sort({ createdAt: -1 })
                .populate("emojis"),
            this.emojiPackModel.countDocuments({ price: { $gt: 0 } }),
        ]);

        // ✅ Lọc bỏ pack mà user đã sở hữu
        const filteredPacks = packs.filter(
            (pack) => !ownedIds.includes(pack._id.toString())
        );

        const totalPages = Math.ceil(total / limit);

        return {
            packs: filteredPacks.length > 0 ? filteredPacks : [],
            totalPages,
            currentPage: page,
            totalItems: filteredPacks.length,
        };
    }

}
