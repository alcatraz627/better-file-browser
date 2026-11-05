// Fetches rail data for the metro overlay, which runs in the page and cannot.
//
// The overlay has to live in the page to reach the site's map, but a site's own
// security policy can block its network calls and it has no extension storage.
// This script sits outside the page: it answers the overlay's requests from the
// worker's cache, or from OpenStreetMap, and hands back only public map data.
//
// The fetch runs here and not in the worker because Chrome stops a worker whose
// fetch takes over 30 seconds, and these answers often do.

import { overpassQuery, simplifyArea, STAGES, TILE_DEGREES, type Stage, type Tile } from './site-transit-data';

// In the order that answered fastest when measured. Other public servers were left
// out: they hung, returned 504 at once, or had an expired certificate.
const SERVERS = [
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
];
const SERVER_WAIT_MS = 60_000;

async function ask(tile: Tile, stage: Stage): Promise<string> {
  const body = new URLSearchParams({ data: overpassQuery(tile, stage) });
  let last = 'no server tried';
  for (const url of SERVERS) {
    const stop = new AbortController();
    const timer = setTimeout(() => stop.abort(), SERVER_WAIT_MS);
    try {
      const res = await fetch(url, { method: 'POST', body, signal: stop.signal });
      if (res.ok) return JSON.stringify(simplifyArea(await res.json()));
      last = `HTTP ${res.status}`;
    } catch (err) {
      last = String(err);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(last);
}

// A page can post anything, so only a square of the fixed grid is accepted.
function validTile(t: Partial<Tile> | undefined): t is Tile {
  if (!t || typeof t.key !== 'string' || t.key.length > 20) return false;
  const nums = [t.s, t.w, t.n, t.e];
  if (!nums.every(v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 360)) return false;
  return Math.abs(t.n! - t.s! - TILE_DEGREES) < 1e-6 && Math.abs(t.e! - t.w! - TILE_DEGREES) < 1e-6;
}

window.addEventListener('message', async (event: MessageEvent) => {
  if (event.source !== window || event.data?.bfbTransit !== 'ask') return;
  const { id, tile, stage } = event.data;
  const reply = (fields: object) => window.postMessage({ bfbTransit: 'answer', id, ...fields }, location.origin);
  if (!validTile(tile) || !STAGES.includes(stage)) { reply({ error: 'bad request' }); return; }
  const key = `${tile.key}|${stage}`;
  try {
    const cached = await chrome.runtime.sendMessage({ type: 'bfb-transit-get', key });
    if (cached?.text) { reply({ text: cached.text }); return; }
    const text = await ask(tile, stage);
    void chrome.runtime.sendMessage({ type: 'bfb-transit-put', key, text });
    reply({ text });
  } catch (err) {
    reply({ error: String(err) });
  }
});
