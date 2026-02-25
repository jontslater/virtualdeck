import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as IOServer } from 'socket.io';
import { supportEventToDamage } from './lib/support';
import {
  createRoomDb,
  joinRoomDb,
  createBattleDb,
  getActiveBattleByRoomDb,
  getActiveBattleByUserDb,
  getRoomParticipantsDb,
  applyDamageDb,
  isEventProcessedDb,
  markEventProcessedDb,
  createInviteDb,
  getPendingInvitesForUserDb,
  acceptInviteDb,
  declineInviteDb,
  createRoomWithParticipantsDb
} from './store_db';
import { heartbeat, getOnlineUsers } from './presence';
import { initDb } from './db/init';

const app = express();
app.use(cors());

// capture raw body for EventSub signature verification
app.use((req, _res, next) => {
  let data = '';
  req.on('data', (chunk) => {
    data += chunk;
  });
  req.on('end', () => {
    // attach raw body string; express.json can still parse afterwards
    (req as any).rawBody = data;
    next();
  });
});
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

// Overlay status snapshot (channel = twitch login or room id)
app.get('/overlay/status', async (req, res) => {
  const channel = String(req.query.channel || '');
  let battle = await getActiveBattleByUserDb(channel);
  if (!battle) battle = await getActiveBattleByRoomDb(channel);
  if (!battle) {
    return res.json({ active: false, roomId: null, battle: null, channel });
  }
  return res.json({
    active: true,
    roomId: battle.roomId,
    battle: {
      id: battle.id,
      hpA: battle.hpA,
      hpB: battle.hpB,
      teamAName: battle.teamAName,
      teamBName: battle.teamBName,
      endsAt: new Date(battle.endsAt).toISOString(),
      lastAction: battle.lastAction
    },
    channel
  });
});

// Rooms endpoints (simple)
app.post('/rooms', async (req, res) => {
  const hostUserId = String(req.body.hostUserId || 'host1');
  const room = await createRoomDb(hostUserId);
  res.json(room);
});

app.post('/rooms/:id/join', async (req, res) => {
  const roomId = String(req.params.id);
  const userId = String(req.body.userId || 'guest');
  const participant = await joinRoomDb(roomId, userId, 'B');
  res.json(participant);
});

app.post('/rooms/:id/start', async (req, res) => {
  const roomId = String(req.params.id);
  const duration = Number(req.body.duration || 120);
  const battle = await createBattleDb(roomId, duration, 10000);
  const payload = {
    active: true,
    roomId: battle.roomId,
    battle: {
      hpA: battle.hpA,
      hpB: battle.hpB,
      teamAName: battle.teamAName,
      teamBName: battle.teamBName,
      endsAt: new Date(battle.endsAt).toISOString(),
      lastAction: null
    }
  };
  await emitBattleStatusToRoom(roomId, payload);
  setTimeout(async () => {
    const { endBattleDb } = await import('./store_db');
    await endBattleDb(roomId);
    await emitBattleStatusToRoom(roomId, { active: false, roomId, battle: null });
  }, duration * 1000);
  res.json(battle);
});

app.post('/rooms/:id/end', async (req, res) => {
  const roomId = String(req.params.id);
  const { endBattleDb } = await import('./store_db');
  const battle = await endBattleDb(roomId);
  if (!battle) return res.status(404).json({ error: 'no active battle' });
  await emitBattleStatusToRoom(roomId, { active: false, roomId, battle: null });
  res.json(battle);
});

// Battles: presence + invites (TikTok-style)
app.post('/battles/heartbeat', (req, res) => {
  const twitchLogin = String(req.body.twitch_login || req.body.twitchLogin || '').trim();
  const battlesEnabled = Boolean(req.body.battles_enabled ?? req.body.battlesEnabled ?? true);
  if (!twitchLogin) return res.status(400).json({ error: 'twitch_login required' });
  heartbeat(twitchLogin, battlesEnabled);
  res.json({ ok: true });
});

app.get('/battles/online', (_req, res) => {
  res.json(getOnlineUsers());
});

app.post('/battles/invite', async (req, res) => {
  const fromUser = String(req.body.from || req.body.from_user || '').trim().toLowerCase();
  const toUser = String(req.body.to || req.body.to_user || '').trim().toLowerCase();
  if (!fromUser || !toUser) return res.status(400).json({ error: 'from and to required' });
  if (fromUser === toUser) return res.status(400).json({ error: 'cannot invite yourself' });
  const invite = await createInviteDb(fromUser, toUser);
  if (!invite) return res.status(409).json({ error: 'invite already pending' });
  io.to(`dashboard:${toUser}`).emit('battle:invite', { id: invite.id, from_user: invite.from_user, to_user: invite.to_user, created_at: invite.created_at });
  res.json(invite);
});

app.get('/battles/invites/pending', async (req, res) => {
  const user = String(req.query.user || '').trim().toLowerCase();
  if (!user) return res.status(400).json({ error: 'user required' });
  const invites = await getPendingInvitesForUserDb(user);
  res.json(invites);
});

app.post('/battles/invite/:id/accept', async (req, res) => {
  const inviteId = req.params.id;
  const result = await acceptInviteDb(inviteId);
  if (!result) return res.status(404).json({ error: 'invite not found or already handled' });
  const { room, battle } = result;
  const participants = await getRoomParticipantsDb(room.id);
  const battlePayload = {
    active: true,
    roomId: room.id,
    battle: { hpA: battle.hpA, hpB: battle.hpB, teamAName: null, teamBName: null, endsAt: new Date(battle.endsAt).toISOString(), lastAction: null }
  };
  for (const p of participants) {
    io.to(`channel:${p.user_id}`).emit('battle:status', battlePayload);
  }
  io.to(`dashboard:${result.invite.from_user}`).emit('battle:accepted', { roomId: room.id, from: result.invite.to_user });
  io.to(`dashboard:${result.invite.to_user}`).emit('battle:accepted', { roomId: room.id, from: result.invite.from_user });
  setTimeout(async () => {
    const { endBattleDb } = await import('./store_db');
    await endBattleDb(room.id);
    for (const p of participants) {
      io.to(`channel:${p.user_id}`).emit('battle:status', { active: false, roomId: room.id, battle: null });
    }
  }, 120 * 1000);
  res.json({ room, battle });
});

app.post('/battles/invite/:id/decline', async (req, res) => {
  const declined = await declineInviteDb(req.params.id);
  if (!declined) return res.status(404).json({ error: 'invite not found or already handled' });
  res.json({ ok: true });
});

// EventSub webhook receiver (with HMAC signature validation)
app.post('/webhooks/eventsub', async (req, res) => {
  const secret = process.env.TWITCH_EVENTSUB_SECRET;
  const raw = (req as any).rawBody || '';
  const msgId = String(req.headers['twitch-eventsub-message-id'] || '');
  const msgTs = String(req.headers['twitch-eventsub-message-timestamp'] || '');
  const signatureHeader = String(req.headers['twitch-eventsub-message-signature'] || '');

  if (secret) {
    const crypto = require('crypto');
    const expected = crypto
      .createHmac('sha256', secret)
      .update(msgId + msgTs + raw)
      .digest('hex');
    const prefix = 'sha256=';
    const sig = signatureHeader.startsWith(prefix) ? signatureHeader.slice(prefix.length) : signatureHeader;
    const expectedBuf = Buffer.from(expected, 'hex');
    const sigBuf = Buffer.from(sig, 'hex');
    if (!sig || sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return res.status(401).json({ ok: false, error: 'invalid signature' });
    }
  }

  const body = req.body as any;
  const twitchEventId = body?.id || body?.subscription?.id || body?.event?.id || null;
  if (twitchEventId && (await isEventProcessedDb(twitchEventId))) {
    return res.status(200).json({ ok: true, skipped: true });
  }

  // Simplified mapping: expect {type, amount, broadcaster_user_login}
  const event = body?.event || body;
  const channel = String(event?.broadcaster_user_login || req.query.channel || '').toLowerCase();
  const damage = supportEventToDamage({ type: event?.type || 'bits', amount: Number(event?.amount || 0) });
  let battle = await getActiveBattleByUserDb(channel);
  if (!battle) battle = await getActiveBattleByRoomDb(channel);
  if (battle) {
    const participants = await getRoomParticipantsDb(battle.roomId);
    const team = participants.find((p) => p.user_id.toLowerCase() === channel)?.team === 'A' ? ('A' as const) : ('B' as const);
    const updated = await applyDamageDb(battle.roomId, team, damage);
    const updatePayload = { hpA: updated.hpA, hpB: updated.hpB, lastAction: updated.lastAction, ts: new Date().toISOString() };
    if (participants.length > 0) {
      for (const p of participants) {
        io.to(`channel:${p.user_id}`).emit('battle:update', updatePayload);
      }
      if (updated.status === 'ended') {
        for (const p of participants) {
          io.to(`channel:${p.user_id}`).emit('battle:status', { active: false, roomId: battle!.roomId, battle: null });
        }
      }
    } else {
      io.to(`channel:${battle.roomId}`).emit('battle:update', updatePayload);
      if (updated.status === 'ended') {
        io.to(`channel:${battle.roomId}`).emit('battle:status', { active: false, roomId: battle!.roomId, battle: null });
      }
    }
    if (twitchEventId) await markEventProcessedDb(battle.id, twitchEventId, event?.type || 'bits', Number(event?.amount || 0), event?.user || null, team);
  } else {
    if (twitchEventId) await markEventProcessedDb(null, twitchEventId, event?.type || 'bits', Number(event?.amount || 0), event?.user || null, team);
  }
  res.json({ ok: true });
});

const port = Number(process.env.PORT || 4000);
const server = http.createServer(app);
const io = new IOServer(server, { cors: { origin: '*' } });

async function emitBattleStatusToRoom(roomId: string, payload: any) {
  const participants = await getRoomParticipantsDb(roomId);
  if (participants.length > 0) {
    for (const p of participants) {
      io.to(`channel:${p.user_id}`).emit('battle:status', payload);
    }
  } else {
    io.to(`channel:${roomId}`).emit('battle:status', payload);
  }
}

io.on('connection', (socket) => {
  socket.on('dashboard:hello', (payload: { twitch_login: string }) => {
    const login = String(payload?.twitch_login || '').trim().toLowerCase();
    if (login) socket.join(`dashboard:${login}`);
  });

  socket.on('overlay:join', async (payload: { channel: string }) => {
    const ch = String(payload?.channel || '');
    socket.join(`channel:${ch}`);
    let battle = await getActiveBattleByUserDb(ch);
    if (!battle) battle = await getActiveBattleByRoomDb(ch);
    if (!battle) {
      socket.emit('battle:status', { active: false, roomId: null, battle: null });
    } else {
      socket.emit('battle:status', {
        active: true,
        roomId: battle.roomId,
        battle: {
          id: battle.id,
          hpA: battle.hpA,
          hpB: battle.hpB,
          teamAName: battle.teamAName,
          teamBName: battle.teamBName,
          endsAt: new Date(battle.endsAt).toISOString(),
          lastAction: battle.lastAction
        }
      });
    }
  });
});

async function start() {
  const maxAttempts = 5;
  const delayMs = 2000;
  let dbReady = false;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await initDb();
      console.log('Database initialized');
      dbReady = true;
      break;
    } catch (err) {
      console.error(`Database init failed (attempt ${attempt}/${maxAttempts}):`, err instanceof Error ? err.message : err);
      if (attempt < maxAttempts) {
        console.log(`Retrying in ${delayMs / 1000}s...`);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  if (!dbReady) {
    console.error('Database initialization failed after all retries. Exiting.');
    process.exit(1);
  }
  server.listen(port, () => {
    console.log(`Backend listening on ${port}`);
  });
}
start();

export default app;
