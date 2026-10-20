const AUDIO_EXTS = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'];
const APP_EXTS = ['exe', 'bat', 'cmd', 'lnk', 'app', 'sh', 'desktop'];

const APP_KEYWORDS = [
  'spotify', 'chrome', 'firefox', 'edge', 'steam', 'discord', 'slack', 'teams',
  'zoom', 'postman', 'vscode', 'notepad', 'calculator', 'paint', 'word', 'excel', 'powerpoint',
];

function extensionOf(fileName) {
  const parts = String(fileName || '').split('.');
  if (parts.length < 2) return '';
  return parts.pop().toLowerCase();
}

function labelFromFileName(fileName) {
  return String(fileName || '').replace(/\.[^/.]+$/, '');
}

/**
 * @returns {'audio'|'app'}
 */
function classifyDroppedFileName(fileName) {
  const ext = extensionOf(fileName);
  if (APP_EXTS.includes(ext)) return 'app';
  if (AUDIO_EXTS.includes(ext)) return 'audio';
  const fileNameLower = String(fileName || '').toLowerCase();
  if (APP_KEYWORDS.some((keyword) => fileNameLower.includes(keyword))) {
    return 'app';
  }
  return 'audio';
}

module.exports = {
  AUDIO_EXTS,
  APP_EXTS,
  extensionOf,
  labelFromFileName,
  classifyDroppedFileName,
};
