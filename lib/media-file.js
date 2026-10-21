/**
 * Read a saved media file (alert sounds, walk-on sounds, images, videos) from userData as a data: URL.
 * The renderer plays saved alert/walk-on sounds from this. A leftover reference to an undefined
 * \`fullPath\` (from the #72 sanitizePath rename) made every call throw, so no saved alert sound played.
 */
const path = require('path');

const EXT_TO_MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
};

function mimeForPath(filePath) {
  return EXT_TO_MIME[path.extname(String(filePath || '')).toLowerCase()] || 'application/octet-stream';
}

function readMediaFileAsDataUrl({ userDataPath, relativePath, securityManager, fsImpl = require('fs') }) {
  try {
    const sanitizedPath = securityManager.sanitizePath(userDataPath, relativePath);
    if (!fsImpl.existsSync(sanitizedPath)) {
      return { success: false, error: 'File not found' };
    }
    const base64Data = fsImpl.readFileSync(sanitizedPath).toString('base64');
    const mimeType = mimeForPath(sanitizedPath);
    return { success: true, data: `data:${mimeType};base64,${base64Data}`, mimeType };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = { readMediaFileAsDataUrl, mimeForPath, EXT_TO_MIME };
