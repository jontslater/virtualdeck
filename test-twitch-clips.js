#!/usr/bin/env node
/**
 * Unit tests for Twitch clip polling, macro vars, mod gate, and Discord toggle.
 */

const assert = require('assert');
const {
  isTwitchClipReady,
  pollTwitchClipUntilReady,
  shouldPostClipsToDiscord,
  applyMacroTemplateVars,
  mergeClipResultIntoMacroVars,
  isTwitchClipCommandAuthorized,
  TWITCH_CLIP_POLL_INTERVAL_MS,
} = require('./lib/twitch-clips');
const { isJarvisMacroToolAllowed } = require('./lib/jarvis-macro-allowlist');
const { registry } = require('./jarvis-tools');

let passed = 0;
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed += 1;
      console.log(`✅ ${name}`);
    })
    .catch((err) => {
      console.error(`❌ ${name}:`, err.message || err);
      process.exitCode = 1;
    });
}

(async () => {
  console.log('🧪 Twitch clip tests\n');

  await test('isTwitchClipReady accepts url or edit_url', () => {
    assert.strictEqual(isTwitchClipReady({}), false);
    assert.strictEqual(isTwitchClipReady({ url: 'https://clips.twitch.tv/x' }), true);
    assert.strictEqual(isTwitchClipReady({ edit_url: 'https://clips.twitch.tv/y' }), true);
  });

  await test('pollTwitchClipUntilReady resolves when Helix returns a url', async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      if (calls < 2) {
        return { ok: true, json: async () => ({ data: [{ id: 'abc', url: '' }] }) };
      }
      return {
        ok: true,
        json: async () => ({ data: [{ id: 'abc', url: 'https://clips.twitch.tv/abc' }] }),
      };
    };
    const r = await pollTwitchClipUntilReady({
      clipId: 'abc',
      fetchImpl,
      clientId: 'cid',
      token: 'tok',
      intervalMs: 5,
      maxWaitMs: 200,
    });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.url, 'https://clips.twitch.tv/abc');
    assert.ok(calls >= 2);
  });

  await test('pollTwitchClipUntilReady times out when clip never becomes ready', async () => {
    const fetchImpl = async () => ({
      ok: true,
      json: async () => ({ data: [{ id: 'slow' }] }),
    });
    const r = await pollTwitchClipUntilReady({
      clipId: 'slow',
      fetchImpl,
      clientId: 'cid',
      token: 'tok',
      intervalMs: 5,
      maxWaitMs: 25,
    });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.reason, 'timeout');
  });

  await test('shouldPostClipsToDiscord defaults on when webhook is set', () => {
    assert.strictEqual(shouldPostClipsToDiscord({ webhookUrl: 'https://discord.com/api/webhooks/x' }), true);
    assert.strictEqual(
      shouldPostClipsToDiscord({ webhookUrl: 'https://discord.com/api/webhooks/x', postClipsToDiscord: true }),
      true,
    );
    assert.strictEqual(
      shouldPostClipsToDiscord({ webhookUrl: 'https://discord.com/api/webhooks/x', postClipsToDiscord: false }),
      false,
    );
    assert.strictEqual(shouldPostClipsToDiscord({}), false);
  });

  await test('applyMacroTemplateVars substitutes clipUrl in nested args', () => {
    const out = applyMacroTemplateVars(
      { clipUrl: '{{clipUrl}}', title: 'Hi {{clipId}}' },
      { clipUrl: 'https://clips.twitch.tv/z', clipId: 'z' },
    );
    assert.deepStrictEqual(out, { clipUrl: 'https://clips.twitch.tv/z', title: 'Hi z' });
  });

  await test('mergeClipResultIntoMacroVars maps url/id to clipUrl/clipId', () => {
    const vars = mergeClipResultIntoMacroVars({}, { url: 'https://clips.twitch.tv/a', id: 'a' });
    assert.deepStrictEqual(vars, { clipUrl: 'https://clips.twitch.tv/a', clipId: 'a' });
  });

  await test('isTwitchClipCommandAuthorized allows broadcaster channel and mods only', () => {
    assert.strictEqual(isTwitchClipCommandAuthorized('streamer', { mod: false }, 'streamer'), true);
    assert.strictEqual(isTwitchClipCommandAuthorized('moduser', { mod: true }, 'streamer'), true);
    assert.strictEqual(
      isTwitchClipCommandAuthorized('moduser', { badges: { moderator: '1' } }, 'streamer'),
      true,
    );
    assert.strictEqual(isTwitchClipCommandAuthorized('viewer', { mod: false }, 'streamer'), false);
  });

  await test('macro allowlist includes twitch_create_clip and meld_record_clip', () => {
    assert.strictEqual(isJarvisMacroToolAllowed('twitch_create_clip'), true);
    assert.strictEqual(isJarvisMacroToolAllowed('meld_record_clip'), true);
  });

  await test('JARVIS registry exposes twitch_create_clip and meld_record_clip schemas', () => {
    const twitch = registry.get('twitch_create_clip');
    const meld = registry.get('meld_record_clip');
    assert.ok(twitch, 'twitch_create_clip missing');
    assert.ok(meld, 'meld_record_clip missing');
    assert.ok(Array.isArray(twitch.parameters.required) === false || twitch.parameters.type === 'object');
  });

  console.log(`\n${passed} twitch-clip tests passed${process.exitCode ? ' (with failures)' : ''}`);
  console.log(`Default poll interval: ${TWITCH_CLIP_POLL_INTERVAL_MS}ms`);
})();
