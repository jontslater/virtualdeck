/**
 * Read UTF-8 text and strip a leading BOM (PowerShell / Notepad UTF-8).
 * Bundled with the app (package.json build.files includes lib/).
 */
const fs = require('fs');

function stripBom(text) {
  if (!text || text.charCodeAt(0) !== 0xfeff) {
    return text;
  }
  return text.slice(1);
}

function readFileUtf8(filePath) {
  return stripBom(fs.readFileSync(filePath, 'utf8'));
}

module.exports = {
  stripBom,
  readFileUtf8,
};
