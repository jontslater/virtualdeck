/** Twitch channel login validation (display name / login). */
const TWITCH_LOGIN_PATTERN = /^[a-zA-Z0-9_]{3,25}$/;

function normalizeTwitchLogin(login) {
  if (login == null) return '';
  return String(login).trim().toLowerCase();
}

function isValidTwitchLogin(login) {
  const normalized = normalizeTwitchLogin(login);
  return TWITCH_LOGIN_PATTERN.test(normalized);
}

module.exports = {
  TWITCH_LOGIN_PATTERN,
  normalizeTwitchLogin,
  isValidTwitchLogin,
};
