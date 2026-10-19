const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Persist license payload encrypted with Electron safeStorage when available.
 */
class LicenseSecureStore {
  constructor(userDataPath, safeStorageApi) {
    this.filePath = path.join(userDataPath, 'license.dat');
    this.safeStorage = safeStorageApi;
  }

  isEncryptionAvailable() {
    try {
      return this.safeStorage && this.safeStorage.isEncryptionAvailable();
    } catch {
      return false;
    }
  }

  _encodePayload(obj) {
    const json = JSON.stringify(obj);
    if (this.isEncryptionAvailable()) {
      const encrypted = this.safeStorage.encryptString(json);
      return { v: 1, enc: 'safeStorage', data: encrypted.toString('base64') };
    }
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

  _decodePayload(wrapper) {
    if (!wrapper || typeof wrapper !== 'object') return null;
    if (wrapper.enc === 'safeStorage' && wrapper.data) {
      const buf = Buffer.from(wrapper.data, 'base64');
      const json = this.safeStorage.decryptString(buf);
      return JSON.parse(json);
    }
    if (wrapper.enc === 'aes-gcm-fallback' && wrapper.data && wrapper.iv && wrapper.tag) {
      const key = crypto.createHash('sha256').update(this.filePath).digest();
      const iv = Buffer.from(wrapper.iv, 'base64');
      const tag = Buffer.from(wrapper.tag, 'base64');
      const data = Buffer.from(wrapper.data, 'base64');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      const json = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
      return JSON.parse(json);
    }
    return null;
  }

  load() {
    try {
      if (!fs.existsSync(this.filePath)) return null;
      const wrapper = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      return this._decodePayload(wrapper);
    } catch (err) {
      console.warn('[License] Failed to load license store:', err && err.message);
      return null;
    }
  }

  save(state) {
    const wrapper = this._encodePayload(state);
    fs.writeFileSync(this.filePath, JSON.stringify(wrapper), { mode: 0o600 });
  }

  clear() {
    try {
      if (fs.existsSync(this.filePath)) fs.unlinkSync(this.filePath);
    } catch (err) {
      console.warn('[License] Failed to clear license store:', err && err.message);
    }
  }
}

module.exports = { LicenseSecureStore };
