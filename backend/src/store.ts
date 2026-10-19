import { v4 as uuidv4 } from 'uuid';
import type { BattleSnapshot, Team } from '../../shared/types';
import { loadProcessedEventIds, appendProcessedEventId } from './persistence';

type Room = {
  id: string;
  hostUserId: string;
  status: 'lobby' | 'active' | 'ended';
  createdAt: string;
};

type Participant = {
  id: string;
  roomId: string;
  userId: string;
  team: Team;
  joinedAt: string;
};

type Battle = {
  id: string;
  roomId: string;
  status: 'active' | 'ended';
  startedAt: number;
  endsAt: number;
  winnerTeam: Team | null;
  hpA: number;
  hpB: number;
  teamAName?: string;
  teamBName?: string;
  lastAction?: { text: string; amount: number; team: Team } | null;
  timeoutId?: NodeJS.Timeout;
};

const rooms = new Map<string, Room>();
const participants = new Map<string, Participant>();
const battles = new Map<string, Battle>();
let processedEventIds = new Set<string>();

// Initialize processedEventIds from disk (best-effort)
loadProcessedEventIds()
  .then((s) => {
    processedEventIds = s;
  })
  .catch(() => {
    // ignore
  });

export function createRoom(hostUserId: string) {
  const id = (Math.random() * 900000 + 100000).toFixed(0); // simple numeric code
  const room: Room = {
    id,
    hostUserId,
    status: 'lobby',
    createdAt: new Date().toISOString()
  };
  rooms.set(id, room);
  return room;
}

export function joinRoom(roomId: string, userId: string, team: Team = 'B') {
  const id = uuidv4();
  const p: Participant = {
    id,
    roomId,
    userId,
    team,
    joinedAt: new Date().toISOString()
  };
  participants.set(id, p);
  return p;
}

export function createBattle(roomId: string, durationSeconds = 120, hp = 10000) {
  const id = uuidv4();
  const now = Date.now();
  const battle: Battle = {
    id,
    roomId,
    status: 'active',
    startedAt: now,
    endsAt: now + durationSeconds * 1000,
    winnerTeam: null,
    hpA: hp,
    hpB: hp,
    lastAction: null
  };
  battles.set(id, battle);
  return battle;
}

export function getBattleByRoom(roomId: string): Battle | undefined {
  for (const b of battles.values()) {
    if (b.roomId === roomId && b.status === 'active') return b;
  }
  return undefined;
}

export function applyDamageToBattle(battle: Battle, team: Team, amount: number) {
  // team indicates which team DEALS the damage; subtract from the opposing team
  if (battle.status !== 'active') return battle;
  if (amount <= 0) return battle;
  if (team === 'A') {
    battle.hpB = Math.max(0, battle.hpB - amount);
    battle.lastAction = { text: `Damage ${amount}`, amount, team: 'A' };
  } else {
    battle.hpA = Math.max(0, battle.hpA - amount);
    battle.lastAction = { text: `Damage ${amount}`, amount, team: 'B' };
  }
  if (battle.hpA <= 0 || battle.hpB <= 0) {
    battle.status = 'ended';
    battle.winnerTeam = battle.hpA > battle.hpB ? 'A' : 'B';
  }
  return battle;
}

export function endBattle(battle: Battle) {
  battle.status = 'ended';
  battle.winnerTeam = battle.hpA > battle.hpB ? 'A' : 'B';
  return battle;
}

export function markEventProcessed(id: string) {
  processedEventIds.add(id);
  // persist best-effort
  appendProcessedEventId(id).catch(() => {});
}

export function isEventProcessed(id: string) {
  return processedEventIds.has(id);
}

export function listActiveBattles(): Battle[] {
  return Array.from(battles.values()).filter((b) => b.status === 'active');
}

