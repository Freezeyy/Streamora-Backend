const multer = require('multer');
const path = require('path');
const fileStorage = require('../config/storage');

const ALLOWED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif',
  '.mp4', '.mov', '.avi', '.webm',
  '.pdf',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.csv', '.txt', '.rtf',
]);

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/webm',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/csv',
  'text/plain',
  'application/rtf',
  'text/rtf',
]);

const diskStorage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, fileStorage.postsDir());
  },
  filename(req, file, cb) {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, uniqueSuffix + path.extname(file.originalname).toLowerCase());
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();

  if (ALLOWED_MIME_TYPES.has(mime) || ALLOWED_EXTENSIONS.has(ext)) {
    cb(null, true);
    return;
  }

  cb(new Error('Only images, videos, and document files (PDF, Word, Excel, PowerPoint, CSV, TXT) are allowed'), false);
};

const upload = multer({ storage: diskStorage, fileFilter });

const handlePostMediaUpload = (req, res, next) => {
  upload.array('media', 10)(req, res, (err) => {
    if (!err) {
      next();
      return;
    }

    if (err instanceof multer.MulterError) {
      res.status(400).json({ error: err.message });
      return;
    }

    res.status(400).json({ error: err.message || 'Upload failed' });
  });
};

module.exports = upload;
module.exports.handlePostMediaUpload = handlePostMediaUpload;
