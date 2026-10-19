const PRESENCE_TTL_MS = 60_000;

const online = new Map<string, { lastSeen: number; battlesEnabled: boolean }>();

export function heartbeat(twitchLogin: string, battlesEnabled: boolean) {
  const key = String(twitchLogin).toLowerCase().trim();
  if (!key) return;
  online.set(key, { lastSeen: Date.now(), battlesEnabled });
}

export function getOnlineUsers(): { login: string; lastSeen: number }[] {
  const now = Date.now();
  const result: { login: string; lastSeen: number }[] = [];
  for (const [login, data] of online.entries()) {
    if (data.battlesEnabled && now - data.lastSeen < PRESENCE_TTL_MS) {
      result.push({ login, lastSeen: data.lastSeen });
    }
  }
  return result.sort((a, b) => b.lastSeen - a.lastSeen);
}
