/**
 * Deck icon catalog (loaded from bundled JSON).
 */
(function (global) {
  let icons = null;

  async function loadIcons() {
    if (icons) return icons;
    const res = await fetch('data/deck-icons.json');
    if (!res.ok) throw new Error('Could not load icon catalog');
    icons = await res.json();
    return icons;
  }

  function svgToDataUrl(svg, background) {
    const wrapped = background
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="${background}"/>${String(svg).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</svg>`
      : svg;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(wrapped)}`;
  }

  function iconDataUrlFromRecord(icon) {
    if (!icon) return null;
    if (icon.brand) return svgToDataUrl(icon.svg);
    const inner = String(icon.svg)
      .replace('stroke="currentColor"', 'stroke="#e8e8e8"')
      .replace('fill="currentColor"', 'fill="#e8e8e8"');
    return svgToDataUrl(inner, '#2a2a2e');
  }

  async function listIcons() {
    const list = await loadIcons();
    return list.map(({ id, name, tags, category, brand }) => ({
      id,
      name,
      tags,
      category,
      brand: !!brand,
    }));
  }

  async function getIconById(id) {
    const list = await loadIcons();
    return list.find((i) => i.id === id) || null;
  }

  async function iconDataUrl(id) {
    const icon = await getIconById(id);
    return iconDataUrlFromRecord(icon);
  }

  async function searchIcons(query) {
    const q = String(query || '').trim().toLowerCase();
    const all = await listIcons();
    if (!q) return all;
    return all.filter((i) => {
      if (i.name.toLowerCase().includes(q)) return true;
      return (i.tags || []).some((t) => t.includes(q));
    });
  }

  function resolveDeckIconSync(deckIcon, cacheById) {
    if (!deckIcon || deckIcon.source === 'auto') return null;
    if (deckIcon.source === 'upload' && deckIcon.dataUrl) return deckIcon.dataUrl;
    if (deckIcon.source === 'library' && deckIcon.id && cacheById && cacheById[deckIcon.id]) {
      return cacheById[deckIcon.id];
    }
    return null;
  }

  global.vdDeckIconCatalog = {
    loadIcons,
    listIcons,
    getIconById,
    iconDataUrl,
    iconDataUrlFromRecord,
    searchIcons,
    resolveDeckIconSync,
  };
})(window);
