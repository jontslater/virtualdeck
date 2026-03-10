export type Team = 'A' | 'B';

export type BattleSnapshot = {
  id: string;
  roomId: string;
  status: 'active' | 'ended';
  hpA: number;
  hpB: number;
  teamAName?: string;
  teamBName?: string;
  endsAt?: string | null;
  lastAction?: { text: string; amount: number; team: Team } | null;
};

export type BattleUpdate = {
  hpA: number;
  hpB: number;
  lastAction: { text: string; amount: number; team: Team } | null;
  ts: string;
};

export type SupportEvent = {
  type: 'bits' | 'sub' | 'gift_sub';
  amount?: number;
  twitch_event_id?: string;
  from_user?: string | null;
};

