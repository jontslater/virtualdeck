const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LICENSE_FILENAME = 'license.dat';
const LICENSE_BACKUP_FILENAME = 'license.dat.bak';

function isPackagedApp() {
  try {
    const { app } = require('electron');
    return !!(app && app.isPackaged);
  } catch {
    return false;
  }
}

/**
 * Persist license payload encrypted with Electron safeStorage when available (dev),
 * or AES-GCM keyed to the store path (packaged — reliable across restarts on Windows).
 */
class LicenseSecureStore {
  constructor(userDataPath, safeStorageApi) {
    this.userDataPath = userDataPath;
    this.filePath = path.join(userDataPath, LICENSE_FILENAME);
    this.backupPath = path.join(userDataPath, LICENSE_BACKUP_FILENAME);
    this.safeStorage = safeStorageApi;
  }

  static licenseFilePath(userDataPath) {
    return path.join(userDataPath, LICENSE_FILENAME);
  }

  isEncryptionAvailable() {
    try {
      return this.safeStorage && this.safeStorage.isEncryptionAvailable();
    } catch {
      return false;
    }
  }

  _usePortableEncoding() {
    return isPackagedApp() || !this.isEncryptionAvailable();
  }

  _aesGcmEncode(json) {
    const key = crypto.createHash('sha256').update(this.filePath).digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      v: 1,
      enc: 'aes-gcm-fallback',
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      data: enc.toString('base64'),
    };
  }

  _aesGcmDecode(wrapper) {
    if (!wrapper || wrapper.enc !== 'aes-gcm-fallback') return null;
    if (!wrapper.data || !wrapper.iv || !wrapper.tag) return null;
    const key = crypto.createHash('sha256').update(this.filePath).digest();
    const iv = Buffer.from(wrapper.iv, 'base64');
    const tag = Buffer.from(wrapper.tag, 'base64');
    const data = Buffer.from(wrapper.data, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const json = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    return JSON.parse(json);
  }

  _encodePayload(obj) {
    const json = JSON.stringify(obj);
    if (this._usePortableEncoding()) {
      return this._aesGcmEncode(json);
    }
    const encrypted = this.safeStorage.encryptString(json);
    return { v: 1, enc: 'safeStorage', data: encrypted.toString('base64') };
  }

  _decodePayload(wrapper) {
    if (!wrapper || typeof wrapper !== 'object') return null;
    if (wrapper.enc === 'safeStorage' && wrapper.data) {
      if (!this.isEncryptionAvailable()) {
        throw new Error('safeStorage ciphertext but encryption unavailable');
      }
      const buf = Buffer.from(wrapper.data, 'base64');
      const json = this.safeStorage.decryptString(buf);
      return JSON.parse(json);
    }
    if (wrapper.enc === 'aes-gcm-fallback') {
      return this._aesGcmDecode(wrapper);
    }
    return null;
  }

  _readWrapper(filePath) {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  _tryDecodeFile(filePath) {
    const wrapper = this._readWrapper(filePath);
    if (!wrapper) return null;
    return this._decodePayload(wrapper);
  }

  load() {
    try {
      let state = this._tryDecodeFile(this.filePath);
      if (state) return state;
      state = this._tryDecodeFile(this.backupPath);
      if (state) {
        console.log('[License] Restored license from backup store');
        try {
          this.save(state);
        } catch (e) {
          console.warn('[License] Could not rewrite primary license store:', e && e.message);
        }
        return state;
      }
      return null;
    } catch (err) {
      console.warn('[License] Failed to load license store:', err && err.message);
      try {
        const fromBackup = this._tryDecodeFile(this.backupPath);
        if (fromBackup) {
          console.log('[License] Recovered license from backup after primary load error');
          return fromBackup;
        }
      } catch (e2) {
        console.warn('[License] Backup load failed:', e2 && e2.message);
      }
      return null;
    }
  }

  save(state) {
    fs.mkdirSync(this.userDataPath, { recursive: true });
    const portable = this._aesGcmEncode(JSON.stringify(state));
    fs.writeFileSync(this.backupPath, JSON.stringify(portable), { mode: 0o600 });
    const primary = this._encodePayload(state);
    fs.writeFileSync(this.filePath, JSON.stringify(primary), { mode: 0o600 });
  }

  clear() {
    try {
      if (fs.existsSync(this.filePath)) fs.unlinkSync(this.filePath);
      if (fs.existsSync(this.backupPath)) fs.unlinkSync(this.backupPath);
    } catch (err) {
      console.warn('[License] Failed to clear license store:', err && err.message);
    }
  }
}

module.exports = { LicenseSecureStore, LICENSE_FILENAME, LICENSE_BACKUP_FILENAME };
