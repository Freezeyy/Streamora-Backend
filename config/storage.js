const fs = require('fs');
const os = require('os');
const path = require('path');

function stripQuotes(value) {
  return (value || '').trim().replace(/^['"]|['"]$/g, '');
}

function resolveStorageRoot() {
  const configured = stripQuotes(process.env.STORAGE_ABSOLUTE_PATH);
  if (configured) {
    return path.isAbsolute(configured)
      ? configured
      : path.resolve(process.cwd(), configured);
  }

  return path.join(os.homedir(), '.snow', 'uploads');
}

const STORAGE_ROOT = resolveStorageRoot();

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function postsDir() {
  const dir = path.join(STORAGE_ROOT, 'posts');
  ensureDir(dir);
  return dir;
}

function storiesDir() {
  const dir = path.join(STORAGE_ROOT, 'stories');
  ensureDir(dir);
  return dir;
}

function postMediaUrl(filename) {
  return path.posix.join('/uploads/posts', filename);
}

function storyMediaUrl(filename) {
  return path.posix.join('/uploads/stories', filename);
}

function resolveDiskPath(mediaPath) {
  if (!mediaPath || !mediaPath.startsWith('/uploads/')) return null;
  const relative = mediaPath.slice('/uploads/'.length);
  return path.join(STORAGE_ROOT, ...relative.split('/'));
}

module.exports = {
  STORAGE_ROOT,
  postsDir,
  storiesDir,
  postMediaUrl,
  storyMediaUrl,
  resolveDiskPath,
};
