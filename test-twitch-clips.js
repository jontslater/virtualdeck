#!/usr/bin/env node
/**
 * Unit tests for Twitch clip polling, Helix flow (mocked), macro vars, and Discord toggle.
 */

const assert = require('assert');
const {
  isTwitchClipReady,
  pollTwitchClipUntilReady,
  shouldPostClipsToDiscord,
  applyMacroTemplateVars,
  mergeClipResultIntoMacroVars,
  executeTwitchClipHelixFlow,
  announceTwitchClipReady,
  TWITCH_CLIP_POLL_INTERVAL_MS,
  TWITCH_CLIP_COOLDOWN_MS,
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

function mockHelixFetch({ clipId = 'ClipMock1', readyOnPoll = 2 } = {}) {
  let pollCount = 0;
  return async (url, opts = {}) => {
    if (opts.method === 'POST') {
      return {
        ok: true,
        json: async () => ({ data: [{ id: clipId }] }),
      };
    }
    pollCount += 1;
    if (pollCount < readyOnPoll) {
      return {
        ok: true,
        json: async () => ({ data: [{ id: clipId, url: '' }] }),
      };
    }
    return {
      ok: true,
      json: async () => ({
        data: [{ id: clipId, url: `https://clips.twitch.tv/${clipId}` }],
      }),
    };
  };
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

  await test('executeTwitchClipHelixFlow: mocked create, poll, and chat announce', async () => {
    const chat = [];
    const discord = [];
    const fetchImpl = mockHelixFetch({ clipId: 'FlowClip' });
    const r = await executeTwitchClipHelixFlow({
      broadcasterId: '12345',
      clientId: 'cid',
      token: 'tok',
      fetchImpl,
      requestedBy: 'viewer42',
      lastClipAt: 0,
      sayInChat: (line) => chat.push(line),
      discordConfig: { webhookUrl: 'https://discord.com/api/webhooks/x' },
      postClipToDiscord: (url, title) => discord.push({ url, title }),
      pollOptions: { intervalMs: 2, maxWaitMs: 100 },
    });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.url, 'https://clips.twitch.tv/FlowClip');
    assert.strictEqual(chat.length, 1);
    assert.ok(chat[0].includes('viewer42'));
    assert.ok(chat[0].includes('https://clips.twitch.tv/FlowClip'));
    assert.strictEqual(discord.length, 1);
    assert.strictEqual(discord[0].url, 'https://clips.twitch.tv/FlowClip');
  });

  await test('executeTwitchClipHelixFlow: Discord toggle off skips webhook post', async () => {
    const discord = [];
    const r = await executeTwitchClipHelixFlow({
      broadcasterId: '12345',
      clientId: 'cid',
      token: 'tok',
      fetchImpl: mockHelixFetch({ clipId: 'NoDiscord' }),
      requestedBy: 'viewer',
      lastClipAt: 0,
      sayInChat: () => {},
      discordConfig: {
        webhookUrl: 'https://discord.com/api/webhooks/x',
        postClipsToDiscord: false,
      },
      postClipToDiscord: (url, title) => discord.push({ url, title }),
      pollOptions: { intervalMs: 2, maxWaitMs: 100 },
    });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(discord.length, 0);
  });

  await test(`executeTwitchClipHelixFlow: enforces ~${TWITCH_CLIP_COOLDOWN_MS / 1000}s cooldown`, async () => {
    const chat = [];
    const r = await executeTwitchClipHelixFlow({
      broadcasterId: '12345',
      clientId: 'cid',
      token: 'tok',
      fetchImpl: mockHelixFetch(),
      lastClipAt: Date.now(),
      sayInChat: (line) => chat.push(line),
    });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.reason, 'cooldown');
    assert.ok(chat[0].includes('cooldown'));
  });

  await test('runMacroSteps passes {{clipUrl}} from twitch_create_clip to discord_post_clip', async () => {
    const clipUrl = 'https://clips.twitch.tv/macro-step';
    const prevCreate = registry.context.createTwitchClip;
    const discordTool = registry.tools.get('discord_post_clip');
    const prevDiscordHandler = discordTool.handler;
    let capturedDiscordArgs = null;

    registry.setContext({
      ...registry.context,
      createTwitchClip: async () => ({ ok: true, url: clipUrl, id: 'macro-step' }),
    });
    discordTool.handler = async (args) => {
      capturedDiscordArgs = args;
      return { success: true };
    };

    const macroResult = await registry.runMacroSteps({
      name: 'Clip macro',
      steps: [
        { tool: 'twitch_create_clip', arguments: { requestedBy: 'Test' } },
        {
          tool: 'discord_post_clip',
          arguments: { clipUrl: '{{clipUrl}}', title: 'From macro' },
        },
      ],
    });

    discordTool.handler = prevDiscordHandler;
    registry.setContext({ ...registry.context, createTwitchClip: prevCreate });

    assert.strictEqual(macroResult.success, true);
    assert.strictEqual(capturedDiscordArgs.clipUrl, clipUrl);
    assert.strictEqual(capturedDiscordArgs.title, 'From macro');
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

  await test('announceTwitchClipReady respects Discord toggle independently', async () => {
    const posts = [];
    await announceTwitchClipReady({
      url: 'https://clips.twitch.tv/u',
      requestedBy: 'u',
      discordConfig: { webhookUrl: 'https://discord.com/api/webhooks/x' },
      sayInChat: () => {},
      postClipToDiscord: (url) => posts.push(url),
    });
    assert.strictEqual(posts.length, 1);
    posts.length = 0;
    await announceTwitchClipReady({
      url: 'https://clips.twitch.tv/u',
      requestedBy: 'u',
      discordConfig: { webhookUrl: 'https://discord.com/api/webhooks/x', postClipsToDiscord: false },
      sayInChat: () => {},
      postClipToDiscord: (url) => posts.push(url),
    });
    assert.strictEqual(posts.length, 0);
  });

  console.log(`\n${passed} twitch-clip tests passed${process.exitCode ? ' (with failures)' : ''}`);
  console.log(`Default poll interval: ${TWITCH_CLIP_POLL_INTERVAL_MS}ms, cooldown: ${TWITCH_CLIP_COOLDOWN_MS}ms`);
})();
