import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';
import * as http from 'http';
import * as https from 'https';

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

    async deleteByUrl(
        fileUrl: string,
        resourceType: 'image' | 'raw' | 'video' = 'image',
    ) {
        const publicId = this.extractPublicIdFromUrl(fileUrl);
        if (!publicId) {
            throw new BadRequestException('Không thể xác định public_id từ URL Cloudinary');
        }

        return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    }

    private extractPublicIdFromUrl(fileUrl: string): string | null {
        try {
            const parsed = new URL(fileUrl);
            const marker = '/upload/';
            const idx = parsed.pathname.indexOf(marker);

            if (idx === -1) {
                return null;
            }

            let assetPath = parsed.pathname.slice(idx + marker.length);
            assetPath = assetPath.replace(/^v\d+\//, '');

            const dotIndex = assetPath.lastIndexOf('.');
            if (dotIndex > 0) {
                assetPath = assetPath.slice(0, dotIndex);
            }

            return decodeURIComponent(assetPath);
        } catch {
            return null;
        }
    }

    async fetchRemoteStream(url: string): Promise<Readable> {
        const parsedUrl = new URL(url);
        const client = parsedUrl.protocol === 'http:' ? http : https;

        return new Promise((resolve, reject) => {
            const request = client.get(parsedUrl, (response) => {
                if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                    this.fetchRemoteStream(response.headers.location)
                        .then(resolve)
                        .catch(reject);
                    return;
                }

                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to fetch remote file: ${url} (${response.statusCode})`));
                    return;
                }

                resolve(response);
            });

            request.on('error', reject);
        });
    }

    getFileNameFromUrl(url: string): string {
        try {
            const pathname = new URL(url).pathname;
            return pathname.split('/').pop() || 'file';
        } catch {
            return 'file';
        }
    }
}