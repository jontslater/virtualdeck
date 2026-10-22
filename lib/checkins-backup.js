/**
 * Daily check-in file (userData/checkins.json) validation and backup helpers.
 */
const fs = require('fs');

function defaultDailyCheckinsData() {
  return {
    viewers: {},
    liveDays: [],
    config: {
      enabled: true,
      rewardName: 'Daily Check-In',
      chatResponse: "Welcome back {username}! You've checked in {total_checkins} times!",
      alreadyCheckedMessage: "You've already checked in today, {username}! Come back tomorrow!",
      showStreak: false,
      sendToChat: true,
      testMode: false,
    },
  };
}

function normalizeDailyCheckinsData(raw) {
  const defaults = defaultDailyCheckinsData();
  const viewers = raw && typeof raw.viewers === 'object' && !Array.isArray(raw.viewers) ? raw.viewers : {};
  const liveDays = Array.isArray(raw.liveDays) ? raw.liveDays.map(String) : defaults.liveDays;
  const config =
    raw && typeof raw.config === 'object' && !Array.isArray(raw.config)
      ? { ...defaults.config, ...raw.config }
      : defaults.config;
  return { viewers, liveDays, config };
}

/**
 * @param {unknown} data
 * @returns {{ ok: true, data: object } | { ok: false, error: string }}
 */
function validateDailyCheckinsData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, error: 'File must contain a JSON object with viewers, liveDays, and config.' };
  }
  if (!data.viewers || typeof data.viewers !== 'object' || Array.isArray(data.viewers)) {
    return { ok: false, error: 'Missing or invalid "viewers" object.' };
  }
  if (data.liveDays !== undefined && !Array.isArray(data.liveDays)) {
    return { ok: false, error: '"liveDays" must be an array when present.' };
  }
  if (data.config !== undefined && (typeof data.config !== 'object' || Array.isArray(data.config))) {
    return { ok: false, error: '"config" must be an object when present.' };
  }
  for (const [userId, viewer] of Object.entries(data.viewers)) {
    if (!viewer || typeof viewer !== 'object' || Array.isArray(viewer)) {
      return { ok: false, error: `Invalid viewer entry for "${userId}".` };
    }
    if (viewer.total_checkins !== undefined && typeof viewer.total_checkins !== 'number') {
      return { ok: false, error: `Viewer "${userId}" has non-numeric total_checkins.` };
    }
  }
  return { ok: true, data: normalizeDailyCheckinsData(data) };
}

function formatExportBasename(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `checkins-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`;
}

function readCheckinsJsonFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return { ok: false, error: 'File is not valid JSON.' };
  }
  return validateDailyCheckinsData(parsed);
}

function writeCheckinsJsonFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function backupCurrentCheckinsFile(checkinsPath) {
  if (!fs.existsSync(checkinsPath)) return null;
  const bakPath = `${checkinsPath}.bak`;
  fs.copyFileSync(checkinsPath, bakPath);
  return bakPath;
}

function loadCheckinsFromPath(checkinsPath) {
  if (!fs.existsSync(checkinsPath)) {
    return defaultDailyCheckinsData();
  }
  const result = readCheckinsJsonFile(checkinsPath);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.data;
}

module.exports = {
  defaultDailyCheckinsData,
  normalizeDailyCheckinsData,
  validateDailyCheckinsData,
  formatExportBasename,
  readCheckinsJsonFile,
  writeCheckinsJsonFile,
  backupCurrentCheckinsFile,
  loadCheckinsFromPath,
};
