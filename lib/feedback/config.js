const fs = require('fs');
const path = require('path');

const DEFAULT_SUBMIT_URL = 'https://virtualdeck.app/api/feedback';

let cachedPackaged = null;

function readPackagedEndpointFile() {
  if (cachedPackaged !== null) return cachedPackaged;
  const filePath = path.join(__dirname, 'packaged-endpoint.json');
  try {
    if (fs.existsSync(filePath)) {
      cachedPackaged = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return cachedPackaged;
    }
  } catch (err) {
    console.warn('[Feedback] Failed to read packaged endpoint:', err && err.message);
  }
  cachedPackaged = {};
  return cachedPackaged;
}

/**
 * Public ingest URL for feedback POSTs (no secrets). Override via env or prepare-build.
 * @returns {string}
 */
function getFeedbackSubmitUrl() {
  const fromEnv = String(process.env.VD_FEEDBACK_SUBMIT_URL || '').trim();
  if (fromEnv) return fromEnv;
  const packaged = readPackagedEndpointFile();
  const fromPackaged = String(packaged.VD_FEEDBACK_SUBMIT_URL || '').trim();
  if (fromPackaged) return fromPackaged;
  return DEFAULT_SUBMIT_URL;
}

function isFeedbackEndpointConfigured() {
  return Boolean(getFeedbackSubmitUrl());
}

module.exports = {
  DEFAULT_SUBMIT_URL,
  getFeedbackSubmitUrl,
  isFeedbackEndpointConfigured,
};
