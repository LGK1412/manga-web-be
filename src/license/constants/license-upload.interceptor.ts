import { BadRequestException } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';

export const licenseFilesInterceptor = FilesInterceptor('files', 5, {
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype.startsWith('image/');

    if (!ok) {
      return cb(
        new BadRequestException('Only image files are allowed'),
        false,
      );
    }

    cb(null, true);
  },
});
