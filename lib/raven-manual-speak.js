const DEV_SPEAK_PATH = '/api/dev/speak';
const DEFAULT_DEV_BASES = ['http://localhost:3003', 'http://localhost:3013'];

function isOverlayDevPort(url) {
  return /:3002(\/|$)/.test(String(url || ''));
}

function buildDevApiCandidates(storedUrl) {
  const candidates = [];
  if (storedUrl && !isOverlayDevPort(storedUrl)) {
    candidates.push(String(storedUrl).replace(/\/+$/, ''));
  }
  for (const url of DEFAULT_DEV_BASES) {
    if (!candidates.includes(url)) candidates.push(url);
  }
  return candidates;
}

function formatSpeakNetworkError(rawMessage) {
  const raw = String(rawMessage || '');
  const offline = /Failed to fetch|NetworkError|Load failed|ECONNREFUSED|aborted/i.test(raw);
  if (offline) {
    return 'Raven is not answering yet. Wait a few seconds after launch, or use Tools → Raven AI → Start Raven AI, then try again.';
  }
  return `Speak failed: ${raw || 'unknown error'}`;
}

module.exports = {
  DEV_SPEAK_PATH,
  DEFAULT_DEV_BASES,
  isOverlayDevPort,
  buildDevApiCandidates,
  formatSpeakNetworkError,
};
