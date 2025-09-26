const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');

class FileService {
  constructor() {
    this.uploadPath = process.env.UPLOAD_PATH || './uploads';
    this.maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 5242880; // 5MB
    this.allowedTypes = (
      process.env.ALLOWED_FILE_TYPES ||
      'image/jpeg,image/png,image/gif,text/plain'
    ).split(',');

    this.initializeUploadDirectory();
    this.setupMulter();
  }

  async initializeUploadDirectory() {
    try {
      await fs.mkdir(this.uploadPath, { recursive: true });
      await fs.mkdir(path.join(this.uploadPath, 'images'), { recursive: true });
      await fs.mkdir(path.join(this.uploadPath, 'files'), { recursive: true });
      await fs.mkdir(path.join(this.uploadPath, 'thumbnails'), {
        recursive: true,
      });
      console.log('📁 Upload directories initialized');
    } catch (error) {
      console.error('❌ Error creating upload directories:', error.message);
    }
  }

  setupMulter() {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        const subdir = file.mimetype.startsWith('image/') ? 'images' : 'files';
        cb(null, path.join(this.uploadPath, subdir));
      },
      filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(
          file.originalname
        )}`;
        cb(null, uniqueName);
      },
    });

    this.upload = multer({
      storage,
      limits: {
        fileSize: this.maxFileSize,
        files: 1,
      },
      fileFilter: (req, file, cb) => {
        if (this.allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error(`File type ${file.mimetype} not allowed`), false);
        }
      },
    });
  }

  async processUpload(file, userId, roomId) {
    try {
      const fileInfo = {
        id: uuidv4(),
        originalName: file.originalname,
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size,
        uploadedBy: userId,
        roomId: roomId,
        uploadedAt: new Date().toISOString(),
        url: `/uploads/${
          file.mimetype.startsWith('image/') ? 'images' : 'files'
        }/${file.filename}`,
      };

      // Generate thumbnail for images
      if (file.mimetype.startsWith('image/')) {
        await this.generateThumbnail(file.path, file.filename);
        fileInfo.thumbnailUrl = `/uploads/thumbnails/thumb_${file.filename}`;
      }

      // Store file metadata (in a real app, you'd store this in a database)
      console.log(`📎 File uploaded: ${file.originalname} by ${userId}`);
      return fileInfo;
    } catch (error) {
      console.error('❌ Error processing upload:', error.message);
      throw error;
    }
  }

  async generateThumbnail(imagePath, filename) {
    try {
      const thumbnailPath = path.join(
        this.uploadPath,
        'thumbnails',
        `thumb_${filename}`
      );

      await sharp(imagePath)
        .resize(200, 200, {
          fit: 'cover',
          position: 'center',
        })
        .jpeg({ quality: 80 })
        .toFile(thumbnailPath);

      console.log(`🖼️ Thumbnail generated: thumb_${filename}`);
    } catch (error) {
      console.error('❌ Error generating thumbnail:', error.message);
    }
  }

  async deleteFile(filename, isImage = false) {
    try {
      const subdir = isImage ? 'images' : 'files';
      const filePath = path.join(this.uploadPath, subdir, filename);

      // Delete main file
      await fs.unlink(filePath);

      // Delete thumbnail if it exists
      if (isImage) {
        const thumbnailPath = path.join(
          this.uploadPath,
          'thumbnails',
          `thumb_${filename}`
        );
        try {
          await fs.unlink(thumbnailPath);
        } catch (error) {
          // Thumbnail might not exist, ignore error
        }
      }

      console.log(`🗑️ File deleted: ${filename}`);
      return true;
    } catch (error) {
      console.error('❌ Error deleting file:', error.message);
      return false;
    }
  }

  async getFileStats() {
    try {
      const imageDir = path.join(this.uploadPath, 'images');
      const fileDir = path.join(this.uploadPath, 'files');
      const thumbDir = path.join(this.uploadPath, 'thumbnails');

      const [imageFiles, regularFiles, thumbnails] = await Promise.all([
        fs.readdir(imageDir).catch(() => []),
        fs.readdir(fileDir).catch(() => []),
        fs.readdir(thumbDir).catch(() => []),
      ]);

      // Calculate total size
      let totalSize = 0;

      for (const file of imageFiles) {
        const stats = await fs.stat(path.join(imageDir, file));
        totalSize += stats.size;
      }

      for (const file of regularFiles) {
        const stats = await fs.stat(path.join(fileDir, file));
        totalSize += stats.size;
      }

      return {
        totalFiles: imageFiles.length + regularFiles.length,
        imageFiles: imageFiles.length,
        regularFiles: regularFiles.length,
        thumbnails: thumbnails.length,
        totalSize: totalSize,
        totalSizeFormatted: this.formatFileSize(totalSize),
      };
    } catch (error) {
      console.error('❌ Error getting file stats:', error.message);
      return null;
    }
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  validateFile(file) {
    const errors = [];

    if (!file) {
      errors.push('No file provided');
      return { isValid: false, errors };
    }

    // Check file size
    if (file.size > this.maxFileSize) {
      errors.push(
        `File size exceeds maximum limit of ${this.formatFileSize(
          this.maxFileSize
        )}`
      );
    }

    // Check file type
    if (!this.allowedTypes.includes(file.mimetype)) {
      errors.push(`File type ${file.mimetype} is not allowed`);
    }

    // Check filename
    if (!/^[a-zA-Z0-9._-\s]+$/.test(file.originalname)) {
      errors.push('Filename contains invalid characters');
    }

    // Check for potential security issues
    const dangerousExtensions = [
      '.exe',
      '.bat',
      '.cmd',
      '.scr',
      '.vbs',
      '.js',
      '.jar',
    ];
    const fileExtension = path.extname(file.originalname).toLowerCase();

    if (dangerousExtensions.includes(fileExtension)) {
      errors.push('File type is not allowed for security reasons');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // Cleanup old files periodically
  async cleanupOldFiles(daysOld = 30) {
    try {
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
      let cleanedCount = 0;

      const directories = ['images', 'files', 'thumbnails'];

      for (const dir of directories) {
        const dirPath = path.join(this.uploadPath, dir);

        try {
          const files = await fs.readdir(dirPath);

          for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stats = await fs.stat(filePath);

            if (stats.mtime < cutoffDate) {
              await fs.unlink(filePath);
              cleanedCount++;
            }
          }
        } catch (error) {
          // Directory might not exist, continue
        }
      }

      console.log(`🧹 Cleaned up ${cleanedCount} old files`);
      return cleanedCount;
    } catch (error) {
      console.error('❌ Error cleaning up old files:', error.message);
      return 0;
    }
  }

  getUploadMiddleware() {
    return this.upload.single('file');
  }

  // Virus scanning placeholder (integrate with ClamAV or similar in production)
  async scanFile(filePath) {
    try {
      // In production, implement actual virus scanning
      // For now, just basic checks
      const stats = await fs.stat(filePath);

      // Basic suspicious file checks
      if (stats.size === 0) {
        return { isClean: false, reason: 'Empty file' };
      }

      if (stats.size > this.maxFileSize * 2) {
        return { isClean: false, reason: 'File too large' };
      }

      return { isClean: true };
    } catch (error) {
      console.error('❌ Error scanning file:', error.message);
      return { isClean: false, reason: 'Scan failed' };
    }
  }
}

const fileService = new FileService();

module.exports = fileService;
