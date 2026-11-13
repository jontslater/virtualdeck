/**
 * Vercel serverless: POST /api/feedback
 * Forwards VirtualDeck in-app feedback to FEEDBACK_TO_EMAIL via Resend.
 */

const RATINGS = new Set(['great', 'good', 'okay', 'rough']);
const IDEA_LABELS = {
  overlays: 'Better overlays & alerts',
  twitch: 'More Twitch tools',
  macros: 'Macros & automation',
  ai: 'AI assistant features',
  themes: 'Themes & skins',
  performance: 'Performance & stability',
  other: 'Something else',
};

const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX = 8;
/** @type {Map<string, number[]>} */
const hitsByIp = new Map();

function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length) return xf.split(',')[0].trim();
  if (Array.isArray(xf) && xf[0]) return String(xf[0]).trim();
  return req.socket && req.socket.remoteAddress ? String(req.socket.remoteAddress) : 'unknown';
}

function rateLimit(ip) {
  const now = Date.now();
  const list = hitsByIp.get(ip) || [];
  const recent = list.filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) {
    hitsByIp.set(ip, recent);
    return false;
  }
  recent.push(now);
  hitsByIp.set(ip, recent);
  return true;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8') || '{}';
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function clamp(s, max) {
  const t = String(s == null ? '' : s).trim();
  if (!t) return '';
  return t.length > max ? t.slice(0, max) : t;
}

function buildEmailText(body) {
  const ideas = Array.isArray(body.featureIdeas)
    ? body.featureIdeas.map((id) => IDEA_LABELS[id] || id).join(', ')
    : '';
  const lines = [
    'New VirtualDeck feedback',
    '-------------------------',
    `Rating: ${body.rating}`,
    body.ratingComment ? `Experience notes: ${body.ratingComment}` : null,
    ideas ? `Quick picks: ${ideas}` : null,
    body.featureText ? `Feature request: ${body.featureText}` : null,
    body.email ? `Reply-to: ${body.email}` : 'Reply-to: (not provided)',
    `Source: ${body.source || 'menu'}`,
    `App version: ${body.appVersion || 'unknown'}`,
    `Platform: ${body.platform || 'unknown'}`,
    `Submitted: ${body.submittedAt || new Date().toISOString()}`,
  ].filter(Boolean);
  return lines.join('\n');
}

async function sendViaResend({ apiKey, from, to, subject, text, replyTo }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
      reply_to: replyTo || undefined,
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || `Resend HTTP ${res.status}`);
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
    return;
  }

  const ip = clientIp(req);
  if (!rateLimit(ip)) {
    res.statusCode = 429;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Too many requests. Try again later.' }));
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (_) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
    return;
  }

  if (body && body.honeypot) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  const rating = clamp(body.rating, 20).toLowerCase();
  if (!RATINGS.has(rating)) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Invalid rating' }));
    return;
  }

  const featureText = clamp(body.featureText, 4000);
  const featureIdeas = Array.isArray(body.featureIdeas)
    ? body.featureIdeas.map((x) => clamp(x, 40)).filter(Boolean)
    : [];
  if (!featureText && featureIdeas.length === 0) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Missing feature request' }));
    return;
  }

  const toEmail = process.env.FEEDBACK_TO_EMAIL;
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.FEEDBACK_FROM_EMAIL;
  if (!toEmail || !resendKey || !fromEmail) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        ok: false,
        error: 'Feedback delivery is not configured on the server.',
      }),
    );
    return;
  }

  const payload = {
    rating,
    ratingComment: clamp(body.ratingComment, 2000),
    featureIdeas,
    featureText,
    email: clamp(body.email, 200) || null,
    source: body.source === 'prompt' ? 'prompt' : 'menu',
    appVersion: clamp(body.appVersion, 40),
    platform: clamp(body.platform, 40),
    submittedAt: clamp(body.submittedAt, 40) || new Date().toISOString(),
  };

  try {
    await sendViaResend({
      apiKey: resendKey,
      from: fromEmail,
      to: toEmail,
      subject: `[VirtualDeck] Feedback (${rating}) — v${payload.appVersion}`,
      text: buildEmailText(payload),
      replyTo: payload.email || undefined,
    });
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true }));
  } catch (err) {
    console.error('[feedback-ingest]', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        ok: false,
        error: 'Failed to deliver feedback email.',
      }),
    );
  }
};
