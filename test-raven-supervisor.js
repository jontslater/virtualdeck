'use strict';
const assert = require('assert');
const net = require('net');
const fs = require('fs');
const os = require('os');
const path = require('path');
const s = require('./lib/raven-supervisor');

(async () => {
  // backoff
  assert.strictEqual(s.backoffMs(1), 2000);
  assert.strictEqual(s.backoffMs(3), 15000);
  assert.strictEqual(s.backoffMs(9), 15000);

  const now = 1_000_000;
  assert.strictEqual(s.decideOnExit({ stopRequested: true }, 1, now).action, 'none');
  assert.strictEqual(s.decideOnExit({}, 0, now).action, 'none');
  let st = { restarts: [], startedAt: now - 1000 };
  const d1 = s.decideOnExit(st, 1, now);
  assert.strictEqual(d1.action, 'restart');
  assert.strictEqual(d1.attempt, 1);
  st = { restarts: [now - 3000, now - 2000, now - 1000], startedAt: now - 500 };
  assert.strictEqual(s.decideOnExit(st, 1, now).action, 'give_up');
  // stable run resets budget
  st = { restarts: [now - 3000, now - 2000, now - 1000], startedAt: now - 120000 };
  assert.strictEqual(s.decideOnExit(st, 1, now).action, 'restart');
  // old restarts expire
  st = { restarts: [now - 10 * 60000, now - 9 * 60000, now - 8 * 60000], startedAt: now - 10 };
  assert.strictEqual(s.decideOnExit(st, 1, now).action, 'restart');

  assert.ok(s.logShowsPortConflict('Error: listen EADDRINUSE: address already in use :::3004'));
  assert.ok(!s.logShowsPortConflict('started ok'));

  const tmp = path.join(os.tmpdir(), `raven-log-${process.pid}.log`);
  fs.writeFileSync(tmp, 'a\n\nb\nkey sk-abcdefghijklmnop\nc\n');
  const tail = s.tailLog(tmp, 2);
  assert.ok(!tail.includes('abcdefghijklmnop'), 'redacts keys');
  assert.ok(tail.endsWith('c'));
  fs.unlinkSync(tmp);

  const srv = net.createServer().listen(0, '127.0.0.1');
  await new Promise((r) => srv.once('listening', r));
  const port = srv.address().port;
  assert.strictEqual(await s.isPortInUse(port), true);
  assert.deepStrictEqual(await s.findBusyPorts([port]), [port]);
  await new Promise((r) => srv.close(r));
  assert.strictEqual(await s.isPortInUse(port), false);

  console.log('test-raven-supervisor: ok');
})().catch((e) => { console.error(e); process.exit(1); });
