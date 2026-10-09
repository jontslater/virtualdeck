const fs = require('fs');
const path = require('path');
const { normalizeTwitchLogin, isValidTwitchLogin } = require('./twitch-login');

const DEFAULT_DATA = { favorites: [], history: [] };

class RaidFavoritesStore {
  constructor(userDataPath, fileName = 'raid-favorites.json') {
    this.filePath = path.join(userDataPath, fileName);
    this.data = { ...DEFAULT_DATA };
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
        this.data = {
          favorites: Array.isArray(raw.favorites) ? raw.favorites : [],
          history: Array.isArray(raw.history) ? raw.history : [],
        };
      }
    } catch (err) {
      console.error('[RaidFavorites] Failed to load store:', err);
      this.data = { ...DEFAULT_DATA };
    }
  }

  save() {
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  listFavorites() {
    return this.data.favorites.map((f) => ({ ...f }));
  }

  listHistory() {
    return this.data.history.map((h) => ({ ...h }));
  }

  getFavorite(login) {
    const key = normalizeTwitchLogin(login);
    return this.data.favorites.find((f) => normalizeTwitchLogin(f.login) === key) || null;
  }

  addFavorite({ login, note = '' }) {
    const normalized = normalizeTwitchLogin(login);
    if (!isValidTwitchLogin(normalized)) {
      throw new Error('Invalid Twitch login');
    }
    if (this.getFavorite(normalized)) {
      throw new Error('Channel is already in favorites');
    }
    const entry = {
      login: normalized,
      note: typeof note === 'string' ? note.trim() : '',
      addedAt: new Date().toISOString(),
    };
    this.data.favorites.push(entry);
    this.save();
    return entry;
  }

  removeFavorite(login) {
    const key = normalizeTwitchLogin(login);
    const before = this.data.favorites.length;
    this.data.favorites = this.data.favorites.filter(
      (f) => normalizeTwitchLogin(f.login) !== key,
    );
    if (this.data.favorites.length === before) {
      return false;
    }
    this.save();
    return true;
  }

  reorderFavorites(orderedLogins) {
    if (!Array.isArray(orderedLogins)) {
      throw new Error('orderedLogins must be an array');
    }
    const keys = orderedLogins.map((l) => normalizeTwitchLogin(l));
    const byLogin = new Map(
      this.data.favorites.map((f) => [normalizeTwitchLogin(f.login), f]),
    );
    if (keys.length !== byLogin.size || keys.some((k) => !byLogin.has(k))) {
      throw new Error('orderedLogins must match current favorites exactly');
    }
    this.data.favorites = keys.map((k) => byLogin.get(k));
    this.save();
    return this.listFavorites();
  }

  updateFavoriteNote(login, note) {
    const fav = this.getFavorite(login);
    if (!fav) return false;
    fav.note = typeof note === 'string' ? note.trim() : '';
    this.save();
    return true;
  }

  recordRaid({ login, displayName }) {
    const normalized = normalizeTwitchLogin(login);
    if (!isValidTwitchLogin(normalized)) {
      return null;
    }
    const entry = {
      login: normalized,
      displayName: displayName ? String(displayName) : normalized,
      raidedAt: new Date().toISOString(),
    };
    this.data.history = this.data.history.filter(
      (h) => normalizeTwitchLogin(h.login) !== normalized,
    );
    this.data.history.unshift(entry);
    if (this.data.history.length > 100) {
      this.data.history = this.data.history.slice(0, 100);
    }
    this.save();
    return entry;
  }

  isAllowedRaidTarget(login) {
    const key = normalizeTwitchLogin(login);
    if (!isValidTwitchLogin(key)) return false;
    const inFavorites = this.data.favorites.some((f) => normalizeTwitchLogin(f.login) === key);
    const inHistory = this.data.history.some((h) => normalizeTwitchLogin(h.login) === key);
    return inFavorites || inHistory;
  }
}

module.exports = RaidFavoritesStore;
