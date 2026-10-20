/**
 * Offline deck icon catalog (Lucide-style MIT + simple brand marks for common apps).
 * SVG strings only — no network at runtime.
 */
const ICONS = [
  { id: 'mic', name: 'Microphone', tags: ['mic', 'audio', 'voice'], category: 'media', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>' },
  { id: 'mic-off', name: 'Mute', tags: ['mute', 'mic'], category: 'media', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="2" x2="22" y1="2" y2="22"/><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/><path d="M5 10v2a7 7 0 0 0 12 5"/><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/><line x1="12" x2="12" y1="19" y2="22"/></svg>' },
  { id: 'volume-2', name: 'Volume', tags: ['sound', 'audio'], category: 'media', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>' },
  { id: 'play', name: 'Play', tags: ['media'], category: 'media', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>' },
  { id: 'pause', name: 'Pause', tags: ['media'], category: 'media', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>' },
  { id: 'camera', name: 'Camera', tags: ['video', 'stream'], category: 'media', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>' },
  { id: 'monitor', name: 'Scene / Monitor', tags: ['obs', 'scene'], category: 'stream', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>' },
  { id: 'message-circle', name: 'Chat', tags: ['chat', 'twitch'], category: 'social', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>' },
  { id: 'globe', name: 'Browser', tags: ['web', 'browser'], category: 'apps', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>' },
  { id: 'folder', name: 'Folder', tags: ['files'], category: 'apps', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>' },
  { id: 'gamepad-2', name: 'Game', tags: ['steam', 'game'], category: 'apps', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" x2="10" y1="11" y2="11"/><line x1="8" x2="8" y1="9" y2="13"/><line x1="15" x2="15.01" y1="12" y2="12"/><line x1="18" x2="18.01" y1="10" y2="10"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"/></svg>' },
  { id: 'music', name: 'Music', tags: ['spotify', 'audio'], category: 'media', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>' },
  { id: 'brand-twitch', name: 'Twitch', tags: ['twitch', 'stream'], category: 'brand', brand: true, svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#9146FF"><path d="M11.64 5 8.4 8.24 5.16 5H2v14h5.16V12.4L10 17.24l4.84-4.84V19H22V5h-10.36zM18 14.52h-2.6V9.48H18v5.04zm-5.2 0H10.2V9.48h2.6v5.04z"/></svg>' },
  { id: 'brand-youtube', name: 'YouTube', tags: ['youtube'], category: 'brand', brand: true, svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#FF0000"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.75 15.02V8.98L15.5 12l-5.75 3.02z"/></svg>' },
  { id: 'brand-discord', name: 'Discord', tags: ['discord'], category: 'brand', brand: true, svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#5865F2"><path d="M20.32 4.37A19.8 19.8 0 0 0 15.55 3a13 13 0 0 0-.62 1.28 18.3 18.3 0 0 0-5.86 0A12.6 12.6 0 0 0 8.45 3 19.7 19.7 0 0 0 3.68 4.37 20.5 20.5 0 0 0 .1 18.2a19.9 19.9 0 0 0 6.08 3.08 14.8 14.8 0 0 0 1.28-2.08 12.9 12.9 0 0 1-2.02-.98l.49-.39a13.7 13.7 0 0 0 11.74 0l.5.39a12.8 12.8 0 0 1-2.02.98 14.7 14.7 0 0 0 1.28 2.08 19.9 19.9 0 0 0 6.1-3.08A20.4 20.4 0 0 0 23.9 18.2a20.2 20.2 0 0 0-3.58-13.83zM8.02 15.33c-1.18 0-2.14-1.08-2.14-2.41s.94-2.41 2.14-2.41c1.22 0 2.16 1.1 2.14 2.41 0 1.33-.94 2.41-2.14 2.41zm7.97 0c-1.18 0-2.14-1.08-2.14-2.41s.94-2.41 2.14-2.41c1.22 0 2.16 1.1 2.14 2.41 0 1.33-.92 2.41-2.14 2.41z"/></svg>' },
  { id: 'brand-spotify', name: 'Spotify', tags: ['spotify', 'music'], category: 'brand', brand: true, svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#1DB954"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.52 17.34c-.24.39-.74.52-1.13.28-3.09-1.89-6.98-2.31-11.57-1.26-.44.1-.9-.16-1-.6-.1-.44.16-.9.6-1 4.95-1.13 9.17-.66 12.69 1.43.39.23.52.74.28 1.13l.13.02zm1.47-3.27c-.3.49-.93.64-1.41.35-3.53-2.17-8.92-2.8-13.09-1.53-.54.16-1.11-.14-1.27-.68-.16-.54.14-1.11.68-1.27 4.8-1.46 10.76-.76 14.84 1.7.49.3.64.93.35 1.41l-.1.02zm.13-3.36C15.41 8.62 8.83 8.38 5.16 9.47c-.65.2-1.34-.17-1.54-.82-.2-.65.17-1.34.82-1.54 4.28-1.3 11.48-1.01 15.85 1.75.59.35.78 1.12.43 1.71-.35.59-1.12.78-1.71.43l.02.02z"/></svg>' },
  { id: 'brand-steam', name: 'Steam', tags: ['steam', 'game'], category: 'brand', brand: true, svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#fff"><circle cx="12" cy="12" r="11" fill="#171a21"/><path fill="#fff" d="M8.5 16.2l-1.1-.46a2.4 2.4 0 0 0 1.2-2.1 2.4 2.4 0 0 0-4.1-1.7 2.4 2.4 0 0 0-.3 3l1.1.46a3.2 3.2 0 0 1 3.1-.2zm7.2-5.1a3.6 3.6 0 1 0-3.6 3.6 3.6 3.6 0 0 0 3.6-3.6zm-3.6 2.4a2.4 2.4 0 1 1 2.4-2.4 2.4 2.4 0 0 1-2.4 2.4z"/></svg>' },
  { id: 'brand-obs', name: 'OBS', tags: ['obs', 'stream'], category: 'brand', brand: true, svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="#302E31"/><path fill="#fff" d="M6 7h12v2H6zm0 4h8v2H6zm0 4h10v2H6z"/></svg>' },
];

function listIcons() {
  return ICONS.map(({ id, name, tags, category, brand }) => ({ id, name, tags, category, brand: !!brand }));
}

function getIconById(id) {
  return ICONS.find((i) => i.id === id) || null;
}

function svgToDataUrl(svg, background) {
  const wrapped = background
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="${background}"/>${svg.replace(/^<svg[^>]*>|<\/svg>$/g, '')}</svg>`
    : svg;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(wrapped)}`;
}

function iconDataUrl(id) {
  const icon = getIconById(id);
  if (!icon) return null;
  if (icon.brand) return svgToDataUrl(icon.svg);
  const inner = icon.svg.replace('stroke="currentColor"', 'stroke="#e8e8e8"').replace('fill="currentColor"', 'fill="#e8e8e8"');
  return svgToDataUrl(inner, '#2a2a2e');
}

function searchIcons(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return listIcons();
  return listIcons().filter((i) => {
    if (i.name.toLowerCase().includes(q)) return true;
    return (i.tags || []).some((t) => t.includes(q));
  });
}

module.exports = {
  listIcons,
  getIconById,
  iconDataUrl,
  searchIcons,
};
