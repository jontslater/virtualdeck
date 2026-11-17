const fetch = require('node-fetch');
const { FEEDBACK_RATINGS, FEEDBACK_QUICK_IDEAS } = require('./constants');
const { getFeedbackSubmitUrl, isFeedbackEndpointConfigured } = require('./config');

const QUICK_ID_SET = new Set(FEEDBACK_QUICK_IDEAS.map((q) => q.id));
const MAX_TEXT = 4000;
const MAX_EMAIL = 200;
const MAX_COMMENT = 2000;

function clampText(value, max) {
  const s = String(value == null ? '' : value).trim();
  if (!s) return '';
  return s.length > max ? s.slice(0, max) : s;
}

function isValidEmail(value) {
  const s = String(value || '').trim();
  if (!s) return true;
  if (s.length > MAX_EMAIL) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/**
 * @param {object} body
 * @param {object} meta
 * @returns {{ ok: boolean, payload?: object, error?: string }}
 */
function sanitizeFeedbackPayload(body, meta = {}) {
  const input = body && typeof body === 'object' ? body : {};
  const rating = String(input.rating || '').trim().toLowerCase();
  if (!FEEDBACK_RATINGS.includes(rating)) {
    return { ok: false, error: 'Please choose how VirtualDeck is working for you.' };
  }
  const featureIdeas = Array.isArray(input.featureIdeas)
    ? input.featureIdeas.map((id) => String(id).trim()).filter((id) => QUICK_ID_SET.has(id))
    : [];
  const featureText = clampText(input.featureText, MAX_TEXT);
  const ratingComment = clampText(input.ratingComment, MAX_COMMENT);
  const email = clampText(input.email, MAX_EMAIL);
  if (!isValidEmail(email)) {
    return { ok: false, error: 'Please enter a valid email or leave it blank.' };
  }
  if (!featureText && featureIdeas.length === 0) {
    return { ok: false, error: 'Tell us what you would like to see next (or pick an idea).' };
  }
  const source = input.source === 'prompt' ? 'prompt' : 'menu';
  const payload = {
    rating,
    ratingComment,
    featureIdeas,
    featureText,
    email: email || null,
    source,
    appVersion: String(meta.appVersion || 'unknown'),
    platform: String(meta.platform || process.platform),
    submittedAt: new Date().toISOString(),
    honeypot: '',
  };
  return { ok: true, payload };
}

/**
 * @param {object} payload
 * @param {object} [opts]
 * @returns {Promise<{ ok: boolean, error?: string, statusCode?: number }>}
 */
async function postFeedbackPayload(payload, opts = {}) {
  if (!isFeedbackEndpointConfigured()) {
    return {
      ok: false,
      error:
        'Feedback delivery is not configured on this build. Set VD_FEEDBACK_SUBMIT_URL for development.',
    };
  }
  const url = String(opts.url || getFeedbackSubmitUrl()).trim();
  const timeoutMs = typeof opts.timeoutMs === 'number' ? opts.timeoutMs : 20000;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => {
        try {
          controller.abort();
        } catch (_) {
          /* ignore */
        }
      }, timeoutMs)
    : null;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'VirtualDeck-Feedback/1',
      },
      body: JSON.stringify(payload),
      signal: controller ? controller.signal : undefined,
    });
    const text = await res.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch (_) {
      parsed = null;
    }
    if (!res.ok) {
      const detail =
        (parsed && (parsed.error || parsed.message)) ||
        (text && text.slice(0, 200)) ||
        `HTTP ${res.status}`;
      return { ok: false, error: detail, statusCode: res.status };
    }
    return { ok: true, statusCode: res.status };
  } catch (err) {
    const msg = err && err.name === 'AbortError' ? 'Request timed out.' : err && err.message;
    return { ok: false, error: msg || 'Network error' };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

module.exports = {
  sanitizeFeedbackPayload,
  postFeedbackPayload,
  clampText,
};
