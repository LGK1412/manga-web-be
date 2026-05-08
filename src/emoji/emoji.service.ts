import { Injectable, BadRequestException, InternalServerErrorException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Emoji } from "src/schemas/Emoji.schema";
import * as path from "path";
import { CloudinaryService } from "src/cloudinary/cloudinary.service";

@Injectable()
export class EmojiService {
    constructor(
        @InjectModel(Emoji.name) private emojiModel: Model<Emoji>,
        private readonly cloudinaryService: CloudinaryService,
    ) { }

    async uploadEmojis(files: Express.Multer.File[]) {
        if (!files || files.length === 0)
            throw new BadRequestException("No files uploaded");

        const uploadedUrls: string[] = [];

        try {
            const emojis: Emoji[] = []
            for (const file of files) {
                if (!file.mimetype.startsWith("image/")) {
                    throw new BadRequestException(`File "${file.originalname}" không phải ảnh`);
                }

                const ext = path.extname(file.originalname);
                const baseName = path.basename(file.originalname, ext);

                // kiểm tra emoji tồn tại chưa
                const exist = await this.emojiModel.findOne({ name: baseName });
                if (exist) throw new BadRequestException(`Emoji "${baseName}" already exists`);

                const uploaded = await this.cloudinaryService.uploadImage(
                    file,
                    "mangaword/emojis",
                );
                uploadedUrls.push(uploaded.secure_url);

                // lưu DB
                const emoji = new this.emojiModel({
                    name: baseName,
                    keywords: [baseName],
                    skins: [{ src: uploaded.secure_url }],
                });
                const res = await emoji.save();
                emojis.push(res)
            }

            return { success: true, emojis, count: files.length };
        } catch (err) {
            // rollback cloudinary file
            for (const src of uploadedUrls) {
                try {
                    await this.cloudinaryService.deleteByUrl(src, "image");
                } catch { }
            }

            // nếu lỗi là BadRequestException hoặc lỗi Nest đã có statusCode thì ném lại luôn
            if (err instanceof BadRequestException) throw err;

            throw new InternalServerErrorException(
                err.message || "Error uploading emoji"
            );
        }
    }

    async deleteEmojisByIds(ids: string[]): Promise<{ success: true; result: any[] } | void> {
        if (!ids || ids.length === 0) return;

        // Chuyển id sang ObjectId hợp lệ
        const objectIds = ids.map(id => new Types.ObjectId(id));

        // Lấy tất cả emoji cần xoá (full info)
        const emojis = await this.emojiModel.find({ _id: { $in: objectIds } });

        // Xoá file trên Cloudinary
        for (const emoji of emojis) {
            for (const skin of emoji.skins) {
                try {
                    await this.cloudinaryService.deleteByUrl(skin.src, "image");
                } catch { }
            }
        }

        // Xoá khỏi DB
        await this.emojiModel.deleteMany({ _id: { $in: objectIds } });

        // Trả về full info của các emoji vừa xoá
        return { success: true, result: emojis };
    }

}
