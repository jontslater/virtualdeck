import { query } from './db';
import { v4 as uuidv4 } from 'uuid';

export async function createRoomDb(hostUserId: string) {
  const id = (Math.random() * 900000 + 100000).toFixed(0);
  await query(
    `INSERT INTO rooms (id, host_user_id, status) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
    [id, hostUserId, 'lobby']
  );
  return { id, hostUserId, status: 'lobby', createdAt: new Date().toISOString() };
}

export async function createRoomWithParticipantsDb(hostLogin: string, joinerLogin: string) {
  const id = uuidv4();
  await query(`INSERT INTO rooms (id, host_user_id, status) VALUES ($1, $2, $3)`, [id, hostLogin, 'lobby']);
  await query(`INSERT INTO room_participants (id, room_id, user_id, team) VALUES ($1, $2, $3, $4)`, [uuidv4(), id, hostLogin, 'A']);
  await query(`INSERT INTO room_participants (id, room_id, user_id, team) VALUES ($1, $2, $3, $4)`, [uuidv4(), id, joinerLogin, 'B']);
  return { id, hostUserId: hostLogin, status: 'lobby', createdAt: new Date().toISOString() };
}

export async function getRoomParticipantsDb(roomId: string): Promise<{ user_id: string; team: string }[]> {
  const res = await query(`SELECT user_id, team FROM room_participants WHERE room_id = $1`, [roomId]);
  return res.rows.map((r) => ({ user_id: r.user_id, team: r.team }));
}

export async function getActiveBattleByUserDb(twitchLogin: string) {
  const res = await query(
    `SELECT b.* FROM battles b
     JOIN room_participants rp ON rp.room_id = b.room_id
     WHERE rp.user_id = $1 AND b.status = 'active' LIMIT 1`,
    [twitchLogin]
  );
  if (res.rows.length === 0) return null;
  const r = res.rows[0];
  return {
    id: r.id,
    roomId: r.room_id,
    status: r.status,
    startedAt: new Date(r.started_at).getTime(),
    endsAt: new Date(r.ends_at).getTime(),
    hpA: r.hp_a,
    hpB: r.hp_b,
    lastAction: r.last_action_text ? { text: r.last_action_text, amount: r.last_action_amount, team: r.last_action_team } : null
  };
}

export async function joinRoomDb(roomId: string, userId: string, team: 'A' | 'B' = 'B') {
  const id = uuidv4();
  await query(
    `INSERT INTO room_participants (id, room_id, user_id, team) VALUES ($1, $2, $3, $4)`,
    [id, roomId, userId, team]
  );
  return { id, roomId, userId, team, joinedAt: new Date().toISOString() };
}

export async function createBattleDb(roomId: string, durationSeconds = 120, hp = 10000) {
  const id = uuidv4();
  const now = new Date();
  const endsAt = new Date(now.getTime() + durationSeconds * 1000);
  await query(
    `INSERT INTO battles (id, room_id, status, started_at, ends_at, hp_a, hp_b) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [id, roomId, 'active', now.toISOString(), endsAt.toISOString(), hp, hp]
  );
  return {
    id,
    roomId,
    status: 'active',
    startedAt: now.getTime(),
    endsAt: endsAt.getTime(),
    hpA: hp,
    hpB: hp,
    lastAction: null
  };
}

export async function getActiveBattleByRoomDb(roomId: string) {
  const res = await query(`SELECT * FROM battles WHERE room_id = $1 AND status = 'active' LIMIT 1`, [roomId]);
  if (res.rows.length === 0) return null;
  const r = res.rows[0];
  return {
    id: r.id,
    roomId: r.room_id,
    status: r.status,
    startedAt: new Date(r.started_at).getTime(),
    endsAt: new Date(r.ends_at).getTime(),
    hpA: r.hp_a,
    hpB: r.hp_b,
    lastAction: r.last_action_text ? { text: r.last_action_text, amount: r.last_action_amount, team: r.last_action_team } : null
  };
}

export async function isEventProcessedDb(twitchEventId: string) {
  const res = await query(`SELECT 1 FROM battle_events WHERE twitch_event_id = $1 LIMIT 1`, [twitchEventId]);
  return res.rows.length > 0;
}

export async function markEventProcessedDb(battleId: string | null, twitchEventId: string, type: string, amount: number, fromUser: string | null, team: 'A' | 'B' | null) {
  await query(
    `INSERT INTO battle_events (battle_id, type, twitch_event_id, from_user, amount, team) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (twitch_event_id) DO NOTHING`,
    [battleId, type, twitchEventId, fromUser, amount, team]
  );
}

export async function applyDamageDb(roomId: string, team: 'A' | 'B', amount: number) {
  // apply damage by subtracting from opposing team
  const battle = await getActiveBattleByRoomDb(roomId);
  if (!battle) return null;
  let hpA = battle.hpA;
  let hpB = battle.hpB;
  if (team === 'A') {
    hpB = Math.max(0, hpB - amount);
    await query(`UPDATE battles SET hp_b = $1, last_action_text = $2, last_action_amount = $3, last_action_team = $4 WHERE id = $5`, [
      hpB,
      `Damage ${amount}`,
      amount,
      'A',
      battle.id
    ]);
  } else {
    hpA = Math.max(0, hpA - amount);
    await query(`UPDATE battles SET hp_a = $1, last_action_text = $2, last_action_amount = $3, last_action_team = $4 WHERE id = $5`, [
      hpA,
      `Damage ${amount}`,
      amount,
      'B',
      battle.id
    ]);
  }
  const lastAction = { text: `Damage ${amount}`, amount, team: team === 'A' ? ('A' as const) : ('B' as const) };
  let status: string = 'active';
  let winner: 'A' | 'B' | null = null;
  if (hpA <= 0 || hpB <= 0) {
    status = 'ended';
    winner = hpA > hpB ? 'A' : 'B';
    await query(`UPDATE battles SET status = $1, winner_team = $2, last_action_text = $3, last_action_amount = $4, last_action_team = $5 WHERE id = $6`, [
      status,
      winner,
      lastAction.text,
      lastAction.amount,
      lastAction.team,
      battle.id
    ]);
  }
  return { id: battle.id, roomId, status, hpA, hpB, lastAction };
}

export async function endBattleDb(roomId: string) {
  const battle = await getActiveBattleByRoomDb(roomId);
  if (!battle) return null;
  const winner = battle.hpA > battle.hpB ? 'A' : 'B';
  await query(`UPDATE battles SET status = $1, winner_team = $2 WHERE id = $3`, ['ended', winner, battle.id]);
  return { ...battle, status: 'ended', winnerTeam: winner };
}

export async function createInviteDb(fromUser: string, toUser: string) {
  const existing = await query(
    `SELECT id FROM battle_invites WHERE from_user = $1 AND to_user = $2 AND status = 'pending' LIMIT 1`,
    [fromUser, toUser]
  );
  if (existing.rows.length > 0) return null;
  const res = await query(
    `INSERT INTO battle_invites (from_user, to_user, status) VALUES ($1, $2, 'pending') RETURNING id, from_user, to_user, status, created_at`,
    [fromUser, toUser]
  );
  return res.rows[0];
}

export async function getPendingInvitesForUserDb(toUser: string) {
  const res = await query(
    `SELECT id, from_user, to_user, status, created_at FROM battle_invites WHERE to_user = $1 AND status = 'pending' ORDER BY created_at DESC`,
    [toUser]
  );
  return res.rows;
}

export async function getInviteByIdDb(inviteId: string) {
  const res = await query(`SELECT * FROM battle_invites WHERE id = $1 LIMIT 1`, [inviteId]);
  return res.rows[0] || null;
}

export async function acceptInviteDb(inviteId: string) {
  const invite = await getInviteByIdDb(inviteId);
  if (!invite || invite.status !== 'pending') return null;
  const room = await createRoomWithParticipantsDb(invite.from_user, invite.to_user);
  const battle = await createBattleDb(room.id, 120, 10000);
  await query(`UPDATE battle_invites SET status = 'accepted', room_id = $1 WHERE id = $2`, [room.id, inviteId]);
  return { invite, room, battle };
}

export async function declineInviteDb(inviteId: string) {
  const res = await query(`UPDATE battle_invites SET status = 'declined' WHERE id = $1 AND status = 'pending' RETURNING id`, [inviteId]);
  return res.rows.length > 0;
}

