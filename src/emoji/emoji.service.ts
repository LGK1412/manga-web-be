import { Injectable, BadRequestException, InternalServerErrorException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Emoji } from "src/schemas/Emoji.schema";
import * as fs from "fs/promises";
import * as path from "path";

@Injectable()
export class EmojiService {
    constructor(@InjectModel(Emoji.name) private emojiModel: Model<Emoji>) { }

    async uploadEmojis(files: Express.Multer.File[]) {
        if (!files || files.length === 0)
            throw new BadRequestException("No files uploaded");

        const uploadDir = path.join(process.cwd(), "public", "assets", "emoji");
        await fs.mkdir(uploadDir, { recursive: true });

        const savedFiles: string[] = [];

        try {
            const emojis: Emoji[] = []
            for (const file of files) {
                const ext = path.extname(file.originalname);
                const baseName = path.basename(file.originalname, ext);

                // kiểm tra emoji tồn tại chưa
                const exist = await this.emojiModel.findOne({ name: baseName });
                if (exist) throw new BadRequestException(`Emoji "${baseName}" already exists`);

                const uniqueName = `${baseName}${ext}`;
                const filePath = path.join(uploadDir, uniqueName);

                // lưu file
                await fs.writeFile(filePath, file.buffer);
                savedFiles.push(`/assets/emoji/${uniqueName}`);

                // lưu DB
                const emoji = new this.emojiModel({
                    name: baseName,
                    keywords: [baseName],
                    skins: [{ src: `/assets/emoji/${uniqueName}` }],
                });
                const res = await emoji.save();
                emojis.push(res)
            }

            return { success: true, emojis, count: files.length };
        } catch (err) {
            // rollback file
            for (const src of savedFiles) {
                const absPath = path.join(process.cwd(), "public", src);
                try {
                    await fs.unlink(absPath);
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

        // Xoá file trên disk
        for (const emoji of emojis) {
            for (const skin of emoji.skins) {
                const filePath = path.join(process.cwd(), 'public', skin.src);
                try { await fs.unlink(filePath); } catch { }
            }
        }

        // Xoá khỏi DB
        await this.emojiModel.deleteMany({ _id: { $in: objectIds } });

        // Trả về full info của các emoji vừa xoá
        return { success: true, result: emojis };
    }

}
