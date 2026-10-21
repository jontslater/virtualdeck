/**
 * Recursive directory copy safe for Electron app.asar sources.
 * fs-extra copySync uses opendir, which asar does not support; this uses
 * readdirSync(withFileTypes) + copyFileSync instead.
 */
const fs = require('fs');
const path = require('path');

function copyFileSyncSafe(srcFile, destFile) {
  fs.mkdirSync(path.dirname(destFile), { recursive: true });
  fs.copyFileSync(srcFile, destFile);
}

function copyTreeSync(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      copyTreeSync(path.join(src, entry.name), path.join(dest, entry.name));
    }
    return;
  }
  copyFileSyncSafe(src, dest);
}

module.exports = {
  copyTreeSync,
  copyFileSyncSafe,
};
