#!/usr/bin/env node
const assert = require('assert');
const {
  RAVEN_AI_AUDIO_OVERLAY,
  buildRavenPlayAudioMessage,
} = require('./lib/ai-audio-overlay');
const { resolveSpeakTtsText, executeSpeakTts, checkAiLicense } = require('./lib/raven-speak-tts');
const { isJarvisMacroToolAllowed } = require('./lib/jarvis-macro-allowlist');
const { getDeckButtonAction } = require('./lib/deck-button-actions');
const { registry } = require('./jarvis-tools');

let passed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log('  ok', name);
  } catch (err) {
    console.error('  FAIL', name, '\n', err);
    process.exitCode = 1;
  }
}

(async () => {
  console.log('speak_tts macro + deck wiring');

  await test('speak_tts is allowlisted for macro steps', async () => {
    assert.ok(isJarvisMacroToolAllowed('speak_tts'));
  });

  await test('deck button action registry includes speak-tts', async () => {
    const action = getDeckButtonAction('speak-tts');
    assert.ok(action);
    assert.strictEqual(action.ipc, 'speak-tts-deck');
    assert.ok(action.configFields.includes('speakText'));
  });

  await test('placeholder substitution resolves {user} and {username}', async () => {
    const context = { twitchUserName: 'streamer', config: { socials: {} } };
    const out = resolveSpeakTtsText('Hello {user}, aka {username}!', context, {
      user: 'ViewerOne',
      username: 'ViewerOne',
      display_name: 'Viewer One',
    });
    assert.strictEqual(out, 'Hello ViewerOne, aka ViewerOne!');
  });

  await test('license gate blocks speak when Pro AI is not allowed', async () => {
    const gate = checkAiLicense(() => ({ allowed: false, message: 'Pro required' }));
    assert.strictEqual(gate.allowed, false);
    const result = await executeSpeakTts(
      {
        licenseGate: () => ({ allowed: false, message: 'Pro required' }),
        isRavenRunning: () => true,
        speakDeps: {},
        log: { warn() {} },
        context: {},
      },
      { text: 'hi', source: 'test' },
    );
    assert.strictEqual(result.success, false);
    assert.match(result.error, /Pro required/);
  });

  await test('optional=true skips when Raven is not running (logged warning path)', async () => {
    const warnings = [];
    const result = await executeSpeakTts(
      {
        licenseGate: () => ({ allowed: true }),
        isRavenRunning: () => false,
        speakDeps: {},
        log: { warn: (m) => warnings.push(m) },
        context: {},
      },
      { text: 'hello', optional: true, source: 'test' },
    );
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.skipped, true);
    assert.ok(warnings.some((w) => /Raven is not running/.test(w)));
  });

  await test('overlay-only routing uses aiAudio via routeRavenTtsPlayback hook', async () => {
    const broadcasts = [];
    const playback = {
      audioUrl: 'http://localhost:8080/media/tts/sample.mp3',
      volume: 0.9,
    };
    const routeRavenTtsPlayback = (p) => {
      broadcasts.push({
        overlay: RAVEN_AI_AUDIO_OVERLAY,
        message: buildRavenPlayAudioMessage(p.audioUrl, p.volume),
      });
    };
    let speakText = '';
    const result = await executeSpeakTts(
      {
        licenseGate: () => ({ allowed: true }),
        isRavenRunning: () => true,
        speakDeps: { routeRavenTtsPlayback },
        speakViaDevApi: async (_deps, text) => {
          speakText = text;
          routeRavenTtsPlayback(playback);
          return { ok: true, via: 'response' };
        },
        log: { warn() {} },
        context: { twitchUserName: 'host' },
      },
      { text: 'On air now', source: 'test' },
    );
    assert.strictEqual(result.success, true);
    assert.strictEqual(speakText, 'On air now');
    assert.strictEqual(broadcasts.length, 1);
    assert.strictEqual(broadcasts[0].overlay, 'aiAudio');
    assert.strictEqual(broadcasts[0].message.type, 'play-audio');
    assert.strictEqual(broadcasts[0].message.ravenTts, true);
    assert.ok(!broadcasts.some((b) => b.overlay !== 'aiAudio'));
  });

  await test('jarvis speak_tts tool delegates to executeSpeakTtsFn', async () => {
    const calls = [];
    registry.setContext({
      executeSpeakTtsFn: async (opts) => {
        calls.push(opts);
        return { success: true, text: opts.text };
      },
    });
    const out = await registry.invoke('speak_tts', { text: 'macro line', optional: true });
    assert.strictEqual(out.success, true);
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].text, 'macro line');
    assert.strictEqual(calls[0].optional, true);
  });

  console.log(`\n${passed} passed`);
})();
