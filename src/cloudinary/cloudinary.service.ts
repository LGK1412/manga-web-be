import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';

@Injectable()
export class CloudinaryService {
    constructor(private readonly configService: ConfigService) {
        const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
        const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
        const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

        if (!cloudName || !apiKey || !apiSecret) {
            throw new Error('Missing Cloudinary environment variables');
        }

        cloudinary.config({
            cloud_name: cloudName,
            api_key: apiKey,
            api_secret: apiSecret,
            secure: true,
        });
    }

    async uploadImage(
        file: Express.Multer.File,
        folder = 'mangaword/coverImages',
    ): Promise<UploadApiResponse> {
        if (!file) {
            throw new BadRequestException('Không có file ảnh');
        }

        if (!file.mimetype.startsWith('image/')) {
            throw new BadRequestException('File không phải ảnh');
        }

        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder,
                    resource_type: 'image',
                    use_filename: true,
                    unique_filename: true,
                    overwrite: false,
                },
                (error, result) => {
                    if (error) return reject(error);

                    if (!result) {
                        return reject(new BadRequestException('Upload thất bại'));
                    }

                    resolve(result);
                },
            );

            Readable.from(file.buffer).pipe(uploadStream);
        });
    }
    async uploadImages(
        files: Express.Multer.File[],
        folder = 'mangaword/imageChapters',
    ): Promise<UploadApiResponse[]> {
        if (!files || files.length === 0) {
            return [];
        }

        return Promise.all(
            files.map((file) => this.uploadImage(file, folder)),
        );
    }
    async uploadBuffer(
        buffer: Buffer,
        folder: string,
        publicId?: string,
    ) {
        return new Promise<UploadApiResponse>((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder,
                    public_id: publicId,
                    resource_type: 'raw',
                    overwrite: true,
                },
                (error, result) => {
                    if (error) return reject(error);
                    if (!result) return reject(new BadRequestException('Upload thất bại'));
                    resolve(result);
                },
            );

            Readable.from(buffer).pipe(uploadStream);
        });
    }
}