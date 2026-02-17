import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

type Status = { active: boolean };
type Snapshot = {
  hpA: number;
  hpB: number;
  lastAction?: { text: string; amount: number; team: 'A' | 'B' } | null;
};

export default function useBattleSocket(channel: string) {
  const [status, setStatus] = useState<Status>({ active: false });
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  useEffect(() => {
    if (!channel) return;
    const backendOrigin =
      typeof import.meta.env.VITE_BATTLE_BACKEND_URL === 'string' && import.meta.env.VITE_BATTLE_BACKEND_URL
        ? import.meta.env.VITE_BATTLE_BACKEND_URL
        : `${window.location.protocol}//${window.location.hostname}:4000`;
    const socket: Socket = io(backendOrigin);
    socket.on('connect', () => {
      socket.emit('overlay:join', { channel });
    });
    socket.on('battle:status', (payload: any) => {
      setStatus({ active: !!payload.active });
      if (payload.battle) {
        setSnapshot({
          hpA: payload.battle.hpA,
          hpB: payload.battle.hpB,
          lastAction: payload.battle.lastAction || null
        });
      } else {
        setSnapshot(null);
      }
    });
    socket.on('battle:update', (u: any) => {
      setSnapshot({ hpA: u.hpA, hpB: u.hpB, lastAction: u.lastAction || null });
    });
    return () => {
      socket.disconnect();
    };
  }, [channel]);
  return { status, snapshot };
}

