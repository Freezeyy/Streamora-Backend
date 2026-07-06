const multer = require('multer');
const path = require('path');
const fileStorage = require('../config/storage');

const VIDEO_EXTENSIONS = new Set([
  '.mp4', '.mov', '.webm', '.m4v', '.avi', '.mkv', '.mpeg', '.mpg', '.3gp', '.3gpp',
]);

const IMAGE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif',
]);

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, fileStorage.storiesDir());
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, uniqueSuffix + path.extname(file.originalname).toLowerCase());
  },
});

const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const { mimetype } = file;

  if (mimetype.startsWith('image/') || mimetype.startsWith('video/')) {
    cb(null, true);
    return;
  }

  if (VIDEO_EXTENSIONS.has(ext) || IMAGE_EXTENSIONS.has(ext)) {
    cb(null, true);
    return;
  }

  cb(new Error(`File type not allowed for stories (${mimetype || ext || 'unknown'})`), false);
};

const uploadStory = multer({
  storage: diskStorage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 },
});

function handleSingleUpload(req, res, next) {
  uploadStory.single('media')(req, res, (err) => {
    if (err) {
      let message = err.message;
      if (err.code === 'LIMIT_FILE_SIZE') {
        message = 'Story file is too large (max 50MB)';
      }
      return res.status(400).json({ error: message });
    }
    return next();
  });
}

module.exports = uploadStory;
module.exports.handleSingleUpload = handleSingleUpload;
