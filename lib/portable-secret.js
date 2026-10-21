const crypto = require('crypto');

function isPackagedApp() {
  try {
    const { app } = require('electron');
    return !!(app && app.isPackaged);
  } catch {
    return false;
  }
}

function shouldUsePortableSecrets(safeStorageApi) {
  if (isPackagedApp()) return true;
  try {
    return !(safeStorageApi && safeStorageApi.isEncryptionAvailable());
  } catch {
    return true;
  }
}

function deriveKey(keyMaterial) {
  return crypto.createHash('sha256').update(String(keyMaterial)).digest();
}

function aesGcmEncode(keyMaterial, plain) {
  const key = deriveKey(keyMaterial);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: 1,
    enc: 'aes-gcm-fallback',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: enc.toString('base64'),
  };
}

function aesGcmDecode(keyMaterial, wrapper) {
  if (!wrapper || wrapper.enc !== 'aes-gcm-fallback') return null;
  if (!wrapper.data || !wrapper.iv || !wrapper.tag) return null;
  const key = deriveKey(keyMaterial);
  const iv = Buffer.from(wrapper.iv, 'base64');
  const tag = Buffer.from(wrapper.tag, 'base64');
  const data = Buffer.from(wrapper.data, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const json = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  return json;
}

function encodeField(keyMaterial, plain, safeStorageApi) {
  if (!plain) return null;
  if (shouldUsePortableSecrets(safeStorageApi)) {
    return aesGcmEncode(keyMaterial, plain);
  }
  try {
    const encrypted = safeStorageApi.encryptString(String(plain));
    return { v: 1, enc: 'safeStorage', data: encrypted.toString('base64') };
  } catch {
    return aesGcmEncode(keyMaterial, plain);
  }
}

function decodeField(keyMaterial, wrapper, safeStorageApi) {
  if (!wrapper) return null;
  if (wrapper.enc === 'aes-gcm-fallback') {
    return aesGcmDecode(keyMaterial, wrapper);
  }
  if (wrapper.enc === 'safeStorage' && wrapper.data && safeStorageApi) {
    try {
      return safeStorageApi.decryptString(Buffer.from(wrapper.data, 'base64'));
    } catch {
      return null;
    }
  }
  return null;
}

module.exports = {
  isPackagedApp,
  shouldUsePortableSecrets,
  encodeField,
  decodeField,
};
