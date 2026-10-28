/**
 * Social links (config.socials): name + URL pairs for chat / placeholders.
 */

const TWITCH_CHAT_MAX_LEN = 500;

/**
 * @param {unknown} raw
 * @returns {{ name: string, url: string }[]}
 */
function normalizeSocials(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const name = String(entry.name || '').trim();
    const url = String(entry.url || '').trim();
    if (!name || !url) continue;
    out.push({ name, url });
  }
  return out;
}

/**
 * @param {{ name: string, url: string }[]} socials
 * @param {{ separator?: string }} opts
 */
function formatSocialsLine(socials, opts = {}) {
  const list = normalizeSocials(socials);
  if (list.length === 0) return '';
  const sep = opts.separator != null ? String(opts.separator) : ' | ';
  return list.map((s) => `${s.name}: ${s.url}`).join(sep);
}

/**
 * Split text into Twitch-safe chat messages (max 500 chars each).
 * @param {string} text
 * @param {number} maxLen
 * @returns {string[]}
 */
function splitChatMessages(text, maxLen = TWITCH_CHAT_MAX_LEN) {
  const raw = String(text || '').trim();
  if (!raw) return [];
  const limit = Math.max(1, Number(maxLen) || TWITCH_CHAT_MAX_LEN);
  if (raw.length <= limit) return [raw];

  const parts = [];
  let remaining = raw;
  while (remaining.length > limit) {
    let cut = remaining.lastIndexOf(' | ', limit);
    if (cut < Math.floor(limit * 0.4)) {
      cut = remaining.lastIndexOf(' ', limit);
    }
    if (cut <= 0) {
      cut = limit;
    }
    parts.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim().replace(/^\|\s*/, '');
  }
  if (remaining) parts.push(remaining);
  return parts.filter(Boolean);
}

module.exports = {
  TWITCH_CHAT_MAX_LEN,
  normalizeSocials,
  formatSocialsLine,
  splitChatMessages,
};
