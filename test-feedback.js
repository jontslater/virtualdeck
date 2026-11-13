#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  recordFeedbackSession,
  shouldShowFeedbackPrompt,
  patchFeedbackInPreferences,
  FEEDBACK_STATE_VERSION,
} = require('./lib/feedback/state');
const { sanitizeFeedbackPayload } = require('./lib/feedback/submit');
const { getFeedbackSubmitUrl } = require('./lib/feedback/config');

const html = fs.readFileSync(path.join(__dirname, 'public/index.html'), 'utf8');
const pre = fs.readFileSync(path.join(__dirname, 'preload.js'), 'utf8');

assert.ok(html.includes('id="feedback-modal"'), 'feedback modal in HTML');
assert.ok(html.includes('menu-help-feedback'), 'help menu feedback entry');
assert.ok(html.includes('preferences-feedback-btn'), 'preferences feedback button');
assert.ok(html.includes('feedback-ui.js'), 'feedback-ui script tag');
assert.ok(pre.includes('feedbackSubmit'), 'preload feedback IPC');

assert.strictEqual(FEEDBACK_STATE_VERSION, 1);

let prefs = {};
({ preferences: prefs } = recordFeedbackSession(prefs, Date.now()));
assert.strictEqual(prefs.feedback.sessionCount, 1);
assert.ok(prefs.feedback.firstLaunchAt);

({ preferences: prefs } = recordFeedbackSession(prefs, Date.now()));
assert.strictEqual(prefs.feedback.sessionCount, 2);

const oldFirst = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
prefs = patchFeedbackInPreferences(prefs, {
  firstLaunchAt: oldFirst,
  sessionCount: 4,
  promptStatus: 'pending',
});
assert.strictEqual(shouldShowFeedbackPrompt(prefs.feedback), true);

prefs = patchFeedbackInPreferences(prefs, { promptStatus: 'never' });
assert.strictEqual(shouldShowFeedbackPrompt(prefs.feedback), false);

const bad = sanitizeFeedbackPayload({ rating: 'nope', featureText: 'x' }, { appVersion: '1.0.0' });
assert.strictEqual(bad.ok, false);

const good = sanitizeFeedbackPayload(
  {
    rating: 'good',
    featureIdeas: ['macros'],
    featureText: '',
    email: 'a@b.co',
    source: 'prompt',
  },
  { appVersion: '1.2.2', platform: 'win32' },
);
assert.strictEqual(good.ok, true);
assert.deepStrictEqual(good.payload.featureIdeas, ['macros']);

const url = getFeedbackSubmitUrl();
assert.ok(/^https:\/\//.test(url), url);

console.log('✅ test-feedback.js passed');
