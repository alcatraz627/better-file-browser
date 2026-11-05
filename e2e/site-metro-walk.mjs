// The metro overlay, loaded by the real manifest onto a page at a real host.
//
// The page, Google's map and OpenStreetMap's servers are stand-ins served by
// request interception; the rail data is a trimmed real answer. It does not draw
// tiles or exercise Google's code, and it cannot notice a site moving its map out
// of React or a real server's slowness; those need a look at the live sites.
import { readFileSync } from 'node:fs';
import { launch, shot } from './harness.mjs';

const OVERPASS = readFileSync(new URL('./fixtures/overpass-tokyo.json', import.meta.url), 'utf8');

const STAND_IN = `<!doctype html><title>stand-in</title><style>body{margin:0}</style>
<div id="outer" style="width:900px;height:600px"><div id="map" style="position:relative;width:900px;height:600px;background:#e8eaed;overflow:hidden"><div class="gm-style" style="width:900px;height:600px"></div><div id="pane" style="position:absolute;inset:0"></div></div></div>
<div id="thumbWrap" style="width:150px;height:100px"><div id="thumb"><div class="gm-style" style="width:150px;height:100px"></div></div></div>
<script>
  const VIEW = { south: 35.65, north: 35.7, west: 139.75, east: 139.83 };
  const px = p => ({ x: (p.lng() - VIEW.west) / (VIEW.east - VIEW.west) * 900, y: (VIEW.north - p.lat()) / (VIEW.north - VIEW.south) * 600 });
  window.walk = { layerMap: null, overlayOn: false, shapes: 0, drawn: 0, cursor: null, px, VIEW };
  class LatLng { constructor(a, b) { this.a = a; this.b = b; } lat() { return this.a; } lng() { return this.b; } }
  function makeMap(div) {
    const listeners = {};
    return {
      getBounds: () => ({ toJSON: () => VIEW }), getZoom: () => window.walk.zoom ?? 14, getDiv: () => div,
      getCenter: () => new LatLng(35.675, 139.79),
      addListener(ev, fn) { (listeners[ev] ||= []).push(fn); },
      fire(ev, e) { (listeners[ev] || []).forEach(fn => fn(e)); },
      setOptions(o) { window.walk.cursor = o.draggableCursor; },
      controls: { 1: { push: el => div.prepend(el) } },
    };
  }
  class OverlayView {
    setMap(m) {
      if (m && !this.added) { this.added = true; this.onAdd(); window.walk.overlayOn = true; window.walk.overlay = this; this.draw(); }
      if (!m && this.added) { this.added = false; this.onRemove(); window.walk.overlayOn = false; }
    }
    getPanes() { return { overlayMouseTarget: document.getElementById('pane') }; }
    getProjection() { return { fromLatLngToDivPixel: px, fromLatLngToContainerPixel: px }; }
    static preventMapHitsAndGesturesFrom() {}
  }
  window.google = { maps: {
    ControlPosition: { TOP_LEFT: 1 }, LatLng, OverlayView,
    TransitLayer: class { setMap(m) { window.walk.layerMap = m; } },
    Circle: class { constructor(o) { this.o = o; } setMap(m) { window.walk.patches = (window.walk.patches ?? 0) + (m ? 1 : -1); window.walk.patchClickable = this.o.clickable; } },
    Polyline: class { constructor(o) { this.o = o; } setMap(m) { window.walk.shapes += m ? 1 : -1; if (m) window.walk.colour = this.o.strokeColor; } },
  } };
  for (const [id, holder] of [['map', 'outer'], ['thumb', 'thumbWrap']]) {
    const map = makeMap(document.getElementById(id));
    if (id === 'map') window.walk.map = map;
    document.getElementById(holder).__reactFiber$walk = { memoizedProps: {}, memoizedState: { impl: { map } }, return: null };
  }
  window.walk.at = (lat, lng) => {
    const latLng = new LatLng(lat, lng);
    const p = px(latLng);
    const r = document.getElementById('map').getBoundingClientRect();
    return { latLng, domEvent: { clientX: r.left + p.x, clientY: r.top + p.y } };
  };
</script>`;

const { browser, close } = await launch();
let failed = 0;
const check = (name, ok, got) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  got: ${JSON.stringify(got)}`}`);
  if (!ok) failed++;
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 700 });
  page.on('pageerror', e => { check(`no page error (${e.message})`, false); });
  await page.setRequestInterception(true);
  const server = { asked: [], stages: [], mode: 'ok', holdLines: false, release: null };
  const all = JSON.parse(OVERPASS).elements;
  const FIXTURE = {
    stations: all.filter(e => e.type === 'node'),
    metro: all.filter(e => e.type === 'relation' && e.tags.route !== 'train'),
    trains: all.filter(e => e.type === 'relation' && e.tags.route === 'train'),
  };
  page.on('request', req => {
    const url = req.url();
    if (!/interpreter/.test(url)) { req.respond({ status: 200, contentType: 'text/html', body: STAND_IN }); return; }
    server.asked.push(url);
    const cors = { 'access-control-allow-origin': '*' };
    if (server.mode === 'down') { req.respond({ status: 504, headers: cors, body: 'busy' }); return; }
    if (server.mode === 'first-down' && /openstreetmap\.fr/.test(url)) { req.respond({ status: 504, headers: cors, body: 'busy' }); return; }
    const query = new URLSearchParams(req.postData() ?? '').get('data') ?? '';
    const stage = /railway/.test(query) ? 'stations' : /subway/.test(query) ? 'metro' : 'trains';
    server.stages.push(stage);
    if (server.mode === 'lines-down' && stage !== 'stations') { req.respond({ status: 504, headers: cors, body: 'busy' }); return; }
    const answer = () => req.respond({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ elements: FIXTURE[stage] }) });
    if (server.holdLines && stage !== 'stations') server.release = answer; else answer();
  });

  const state = () => page.evaluate(() => {
    const host = document.querySelector('[data-bfb-metro]');
    const root = host?.shadowRoot;
    const layer = document.querySelector('[data-bfb-metro-layer]')?.shadowRoot;
    const dotsRoot = document.querySelector('[data-bfb-metro-dots]')?.shadowRoot;
    const pop = layer?.querySelector('.pop');
    const tip = layer?.querySelector('.tip');
    const status = root?.querySelector('.status');
    const card = pop?.querySelector('.card');
    return {
      hosts: document.querySelectorAll('[data-bfb-metro]').length,
      inThumb: !!document.querySelector('#thumb [data-bfb-metro]'),
      pressed: root?.querySelector('button')?.getAttribute('aria-pressed'),
      barLinks: root?.querySelectorAll('a').length,
      layerOn: window.walk.layerMap === window.walk.map,
      status: status && !status.hidden ? status.textContent : '',
      retry: root ? !root.querySelector('.retry').hidden : false,
      dots: dotsRoot?.querySelectorAll('.dot').length ?? 0,
      popOpen: pop ? !pop.hidden : false,
      card: card?.dataset.card,
      cardText: card?.innerText ?? '',
      mapsHref: card?.querySelector('.maps')?.href,
      backShown: pop ? !pop.querySelector('.pop-top button').hidden : false,
      tipOpen: tip ? !tip.hidden : false,
      tipText: tip?.innerText ?? '',
      shapes: window.walk.shapes,
      cursor: window.walk.cursor,
      stored: localStorage.getItem('bfbMetroOn'),
    };
  });
  const toggle = () => page.evaluate(() => document.querySelector('[data-bfb-metro]').shadowRoot.querySelector('button').click());
  const waitDots = () => page.waitForFunction(() => document.querySelector('[data-bfb-metro-dots]')?.shadowRoot?.querySelector('.dot'), { timeout: 8000 });
  const clickDot = name => page.evaluate(n => {
    const dot = [...document.querySelector('[data-bfb-metro-dots]').shadowRoot.querySelectorAll('.dot')].find(d => d.getAttribute('aria-label') === `${n} station`);
    if (!dot) return false;
    dot.click();
    return true;
  }, name);
  const dotBox = name => page.evaluate(n => {
    const dot = [...document.querySelector('[data-bfb-metro-dots]').shadowRoot.querySelectorAll('.dot')].find(d => d.getAttribute('aria-label') === `${n} station`);
    const r = dot.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, name);
  const clickRow = text => page.evaluate(t => {
    const rows = [...document.querySelector('[data-bfb-metro-layer]').shadowRoot.querySelectorAll('.row')];
    const row = rows.find(r => r.innerText.includes(t));
    if (row) row.click();
    return !!row;
  }, text);
  const fire = (ev, lat, lng) => page.evaluate((e, a, b) => window.walk.map.fire(e, window.walk.at(a, b)), ev, lat, lng);
  // A real point on the Ginza line's track, as far as possible from every other
  // line in the fixture, so a click there means that line alone.
  const GINZA = (() => {
    const routes = JSON.parse(OVERPASS).elements.filter(e => e.type === 'relation' && e.tags.ref !== 'DT;Z' && !/Nozomi/.test(e.tags['name:en'] ?? ''));
    const points = r => r.members.flatMap(m => (m.geometry ?? []).map(p => [p.lat, p.lon]));
    const others = routes.filter(r => r.tags.ref !== 'G').flatMap(points);
    const away = p => Math.min(...others.map(o => Math.hypot(o[0] - p[0], o[1] - p[1])));
    const inView = p => p[0] > 35.655 && p[0] < 35.695 && p[1] > 139.755 && p[1] < 139.825;
    const own = routes.filter(r => r.tags.ref === 'G').flatMap(points).filter(inView);
    return own.reduce((best, p) => (away(p) > away(best) ? p : best));
  })();

  await page.goto('https://www.example.com/map', { waitUntil: 'load' });
  await sleep(1300);
  check('a site outside the list gets no switch', (await state()).hosts === 0);

  await page.goto('https://www.booking.com/searchresults.html', { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('[data-bfb-metro]'), { timeout: 5000 });
  let s = await state();
  check('the map gets one switch, and a thumbnail map none', s.hosts === 1 && !s.inThumb, s);
  check('it starts off and fetches nothing', s.pressed === 'false' && !s.layerOn && server.asked.length === 0, s);
  check('the bar has no Google Maps tab', s.barLinks === 0, s);

  await page.evaluate(() => { window.walk.zoom = 9; });
  await toggle();
  await sleep(100);
  s = await state();
  check('zoomed far out it says to zoom in and fetches nothing', s.status === 'Zoom in for stations' && server.asked.length === 0, s);
  await toggle();
  await page.evaluate(() => { window.walk.zoom = 14; });

  server.mode = 'first-down';
  server.holdLines = true;
  await toggle();
  s = await state();
  check('on: Google\'s lines show straight away and it says it is loading', s.layerOn && /Loading stations/.test(s.status) && s.stored === '1', s);
  await waitDots();
  s = await state();
  check('a busy server falls through to the next one', /openstreetmap\.fr/.test(server.asked[0]) && /overpass-api\.de/.test(server.asked[1]), server.asked);
  check('stations show before any line data has arrived', s.dots > 5 && /Loading lines/.test(s.status) && server.stages.join() === 'stations,metro', { s, stages: server.stages });
  // A popup opened early fills in when the lines arrive, and the dot under a
  // pointer is the same element afterwards, so a click in progress still lands.
  await page.evaluate(() => { window.walk.keptDot = document.querySelector('[data-bfb-metro-dots]').shadowRoot.querySelector('.dot[aria-label="Monzen-nakacho station"]'); });
  await clickDot('Monzen-nakacho');
  await sleep(30);
  check('a station opened before lines arrive still shows its details', /Monzen-nakacho/.test((await state()).cardText) && !/Oedo/.test((await state()).cardText));
  server.holdLines = false;
  server.release();
  await page.waitForFunction(() => !document.querySelector('[data-bfb-metro]').shadowRoot.querySelector('.status').textContent, { timeout: 8000 });
  s = await state();
  check('metro then trains arrive and the status clears', s.status === '' && server.stages.join() === 'stations,metro,trains', { s, stages: server.stages });
  check('the open popup fills in with the lines', /Oedo Line/.test(s.cardText), s.cardText);
  check('new data keeps the same dot elements', await page.evaluate(() => window.walk.keptDot.isConnected));
  await page.keyboard.press('Escape');
  await sleep(30);
  await shot(page, 'site-metro-dots');

  // Hover on a station, with the real mouse.
  const box = await dotBox('Ginza');
  await page.mouse.move(box.x, box.y);
  await sleep(100);
  s = await state();
  check('hovering a station names it', s.tipOpen && /Ginza/.test(s.tipText), s);
  await page.mouse.move(5, 650);
  await sleep(100);
  check('the tip goes when the pointer leaves', !(await state()).tipOpen);

  // Hover on a line.
  await fire('mousemove', ...GINZA);
  await sleep(60);
  s = await state();
  check('hovering a line names it and highlights it', s.tipOpen && /Ginza/.test(s.tipText) && s.shapes > 0 && s.cursor === 'pointer', s);
  await shot(page, 'site-metro-hover');
  await fire('mousemove', 35.655, 139.825);
  await sleep(60);
  s = await state();
  check('moving off the line clears the tip, highlight and cursor', !s.tipOpen && s.shapes === 0 && s.cursor === null, s);

  // Click a station: all the detail is inline, and Google Maps is on the card.
  check('there is a dot to click', await clickDot('Monzen-nakacho'));
  await sleep(50);
  s = await state();
  check('a station click opens a popup with its details', s.popOpen && s.card === 'station' && /Monzen-nakacho/.test(s.cardText) && /Metro station/.test(s.cardText) && /Oedo Line/.test(s.cardText), s);
  check('the popup has the Google Maps link', /google\.com\/maps\/search\/Monzen-nakacho%20Station\/@/.test(s.mapsHref ?? ''), s.mapsHref);
  check('the popup credits the data', /OpenStreetMap/.test(s.cardText), s.cardText);
  await shot(page, 'site-metro-station');

  // From the station to one of its lines, and back.
  await clickRow('Oedo Line');
  await sleep(50);
  s = await state();
  check('a line row opens the line card', s.card === 'line' && /Oedo Line/.test(s.cardText) && /Metro line/.test(s.cardText) && s.backShown, s);
  check('the line is highlighted while its card is open', s.shapes > 0, s);
  await page.evaluate(() => document.querySelector('[data-bfb-metro-layer]').shadowRoot.querySelector('.pop-top button').click());
  await sleep(50);
  s = await state();
  check('Back returns to the station', s.card === 'station' && /Monzen-nakacho/.test(s.cardText), s);

  // Click a line: details inline, with its stops listed. Hover first, as a person does.
  await fire('mousemove', ...GINZA);
  await sleep(60);
  await fire('click', ...GINZA);
  await sleep(50);
  s = await state();
  check('opening a popup hides the hover tip', !s.tipOpen, s);
  check('a line click opens its details', s.popOpen && s.card === 'line' && /Ginza Line/.test(s.cardText) && /Tokyo Metro/.test(s.cardText), s);
  check('the line card lists its stops in order', s.cardText.indexOf('Nihombashi') > -1 && s.cardText.indexOf('Nihombashi') < s.cardText.indexOf('Kyobashi') && s.cardText.indexOf('Kyobashi') < s.cardText.indexOf('Shimbashi'), s.cardText);
  check('the line card links to its area on Google Maps with transit on', /google\.com\/maps\/@[\d.]+,[\d.]+,\d+z\/data=!5m1!1e2$/.test(s.mapsHref ?? '') && /See this area on Google Maps/.test(s.cardText), s.mapsHref);
  await shot(page, 'site-metro-line');
  await clickRow('Kyobashi');
  await sleep(50);
  s = await state();
  check('a stop opens that station', s.card === 'station' && /Kyobashi/.test(s.cardText), s);

  // The popup stays on the map even for a point at its edge.
  await fire('click', 35.655, 139.825);
  await sleep(30);
  check('clicking empty map closes the popup', !(await state()).popOpen);
  await clickDot('Shiomi');
  await sleep(30);
  await page.evaluate(() => window.walk.overlay.draw());
  const inside = await page.evaluate(() => {
    const r = document.querySelector('[data-bfb-metro-layer]').shadowRoot.querySelector('.pop').getBoundingClientRect();
    const m = document.getElementById('map').getBoundingClientRect();
    return r.left >= m.left && r.right <= m.right && r.top >= m.top && r.bottom <= m.bottom;
  });
  check('the popup stays inside the map', inside);
  await page.evaluate(() => { window.walk.siteEsc = 0; document.addEventListener('keydown', e => { if (e.key === 'Escape') window.walk.siteEsc++; }, true); });
  await page.keyboard.press('Escape');
  await sleep(30);
  check('Esc closes the popup, and the site does not also act on it', !(await state()).popOpen && (await page.evaluate(() => window.walk.siteEsc)) === 0);
  await page.keyboard.press('Escape');
  check('with no popup open, Esc is the site\'s again', (await page.evaluate(() => window.walk.siteEsc)) === 1);

  // A second visit needs no fetch at all.
  const before = server.asked.length;
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('[data-bfb-metro]'), { timeout: 5000 });
  await waitDots();
  s = await state();
  check('after a reload it stays on, and the data comes from the cache', s.pressed === 'true' && s.dots > 5 && server.asked.length === before, { s, asked: server.asked.length - before });

  await clickDot('Ginza');
  await sleep(30);
  await toggle();
  await sleep(30);
  s = await state();
  check('off: lines, dots, popup and highlight all go', s.pressed === 'false' && !s.layerOn && s.dots === 0 && !s.popOpen && s.shapes === 0 && s.stored === '0', s);

  // Areas: the second switch, with Metro off and nothing fetched.
  const asked = server.asked.length;
  const areas = () => page.evaluate(() => {
    const ctl = document.querySelector('[data-bfb-metro]').shadowRoot;
    const dotRoot = document.querySelector('[data-bfb-metro-dots]')?.shadowRoot;
    const layer = document.querySelector('[data-bfb-metro-layer]').shadowRoot;
    const card = layer.querySelector('.card');
    return {
      pressed: ctl.querySelector('[data-areas]').getAttribute('aria-pressed'),
      chips: ctl.querySelector('.chips').hidden ? 0 : ctl.querySelectorAll('.chip').length,
      pills: [...(dotRoot?.querySelectorAll('.pill:not([hidden])') ?? [])].map(p => p.dataset.area),
      patches: window.walk.patches ?? 0, patchClickable: window.walk.patchClickable,
      popOpen: !layer.querySelector('.pop').hidden, card: layer.querySelector('.pop').hidden ? '' : card?.dataset.card,
      cardText: card?.innerText ?? '', tip: layer.querySelector('.tip').hidden ? '' : layer.querySelector('.tip').innerText,
      stored: localStorage.getItem('bfbAreasOn'),
    };
  });
  const areasBtn = () => page.evaluate(() => document.querySelector('[data-bfb-metro]').shadowRoot.querySelector('[data-areas]').click());
  const chip = label => page.evaluate(l => [...document.querySelector('[data-bfb-metro]').shadowRoot.querySelectorAll('.chip')].find(c => c.textContent === l).click(), label);
  const pill = id => page.evaluate(i => {
    const r = document.querySelector('[data-bfb-metro-dots]').shadowRoot.querySelector(`.pill[data-area="${i}"]`).getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, id);
  await page.evaluate(() => { window.walk.zoom = 14; });
  let a = await areas();
  check('Areas starts off, with no chips and nothing on the map', a.pressed === 'false' && a.chips === 0 && a.pills.length === 0 && a.patches === 0, a);
  await areasBtn();
  await sleep(50);
  a = await areas();
  check('Areas on shows labels and patches at once, fetching nothing, with Metro still off', a.pressed === 'true' && a.pills.includes('ginza') && a.patches > 10 && a.chips === 8 && a.stored === '1' && server.asked.length === asked && !(await state()).layerOn, { a, asked: server.asked.length - asked });
  check('the patches let clicks through to the site', a.patchClickable === false, a.patchClickable);
  check('a label is never hidden under its neighbour', await page.evaluate(() => {
    const rects = [...document.querySelector('[data-bfb-metro-dots]').shadowRoot.querySelectorAll('.pill:not([hidden])')].map(p => p.getBoundingClientRect());
    return rects.every((r, i) => rects.every((o, j) => j <= i || r.right <= o.left || o.right <= r.left || r.bottom <= o.top || o.bottom <= r.top));
  }));
  await shot(page, 'site-areas');
  const spot = await pill('hibiya');
  await page.mouse.move(spot.x, spot.y);
  await sleep(100);
  a = await areas();
  check('hovering a label says what the area is like and what is on', /Hibiya/.test(a.tip) && /calm/.test(a.tip) && /3 events/.test(a.tip), a.tip);
  await page.mouse.click(spot.x, spot.y);
  await sleep(50);
  a = await areas();
  check('clicking a label opens its feel and dated events, each linking to its source', a.card === 'area' && /Hibiya/.test(a.cardText) && /Nov 12 to Feb 28/.test(a.cardText) && /Imperial Hotel/.test(a.cardText) && /On during Nov 12 to 17/.test(a.cardText), a.cardText);
  check('an event row links to its source', await page.evaluate(() => /^https:\/\/digitalpr\.jp/.test(document.querySelector('[data-bfb-metro-layer]').shadowRoot.querySelector('.event').href)));
  await shot(page, 'site-areas-card');
  await page.keyboard.press('Escape');
  await sleep(30);
  check('Esc closes an area card too', !(await areas()).popOpen);
  await page.mouse.click((await pill('ginza')).x, (await pill('ginza')).y);
  await sleep(50);
  a = await areas();
  check('an area without events says so plainly', /Nothing special found for Nov 12 to 17/.test(a.cardText), a.cardText);
  await fire('click', 35.655, 139.825);
  await sleep(30);
  check('with Metro off, clicking empty map still closes the card', !(await areas()).popOpen);
  await chip('Events');
  await sleep(30);
  a = await areas();
  check('Has events keeps only areas with something on', a.pills.includes('hibiya') && !a.pills.includes('ginza') && !a.pills.includes('tsukiji'), a.pills);
  await chip('Events');
  await chip('Food');
  await sleep(30);
  a = await areas();
  check('a kind chip narrows the map to areas with that kind', a.pills.includes('tsukiji') && !a.pills.includes('hibiya'), a.pills);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('[data-bfb-metro-dots]')?.shadowRoot?.querySelector('.pill:not([hidden])'), { timeout: 5000 });
  a = await areas();
  check('after a reload Areas and its filter stay as they were', a.pressed === 'true' && a.pills.includes('tsukiji') && !a.pills.includes('hibiya'), a);
  await chip('Food');
  // Zoomed out an area is one coloured dot; zoomed in it has its name, patch and then its feel.
  const pillLook = () => page.evaluate(() => {
    const root = document.querySelector('[data-bfb-metro-dots]').shadowRoot;
    const shown = [...root.querySelectorAll('.pill:not([hidden])')];
    const words = p => [...p.children].some(c => c.checkVisibility() && c.textContent.trim());
    return { n: shown.length, rough: shown.filter(p => p.classList.contains('rough')).length, withWords: shown.filter(words).length,
      tags: shown.filter(p => p.querySelector('.pill-tag').checkVisibility()).length, size: Math.round(shown[0]?.getBoundingClientRect().width ?? 0), patches: window.walk.patches ?? 0 };
  });
  const atZoom = async z => { await page.evaluate(v => { window.walk.zoom = v; }, z); await areasBtn(); await sleep(30); await areasBtn(); await sleep(60); return pillLook(); };
  const far = await atZoom(11);
  check('zoomed out, every area is a small coloured dot with no words and no patch', far.n > 3 && far.rough === far.n && far.withWords === 0 && far.size <= 14 && far.patches === 0, far);
  await shot(page, 'site-areas-rough');
  const mid = await atZoom(13);
  check('at zoom 13 labels and patches come back, without the feel', mid.rough === 0 && mid.withWords === mid.n && mid.n > 0 && mid.tags === 0 && mid.patches > 10, mid);
  const near = await atZoom(15);
  check('zoomed in further, labels say what the area is like', near.rough === 0 && near.tags > 0, near);
  await page.evaluate(() => { window.walk.zoom = 14; });
  await areasBtn();
  await sleep(30);
  a = await areas();
  check('off: labels, patches and chips all go', a.pressed === 'false' && a.pills.length === 0 && a.patches === 0 && a.chips === 0 && a.stored === '0', a);
  // Metro and Areas together: both show, and switching Metro off leaves Areas up.
  await areasBtn();
  await toggle();
  await waitDots();
  await sleep(50);
  let both = await areas();
  check('Metro and Areas show together', (await state()).dots > 5 && both.pills.length > 5, both);
  await page.evaluate(() => document.querySelector('[data-bfb-metro-dots]').shadowRoot.querySelector('.pill[data-area="ginza"]').click());
  await sleep(50);
  both = await areas();
  const listed = /stations? here/.test(both.cardText) && /Ginza/.test(both.cardText.split(/stations? here/)[1] ?? '');
  await clickRow('Ginza');
  await sleep(50);
  const opened = await state();
  check('with Metro on, an area card lists its stations and they open', listed && opened.card === 'station' && /Ginza/.test(opened.cardText), { text: both.cardText, card: opened.card });
  await page.keyboard.press('Escape');
  await toggle();
  await sleep(30);
  both = await areas();
  check('switching Metro off leaves Areas up', (await state()).dots === 0 && both.pills.length > 5, both);
  await areasBtn();
  await sleep(30);

  // Every server down: it says so, and Retry recovers.
  await page.goto('https://www.airbnb.co.in/s/tokyo/homes', { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('[data-bfb-metro]'), { timeout: 5000 });
  check('it loads on an Airbnb country site too', (await state()).hosts === 1);
  server.mode = 'down';
  // The first square is cached from Booking, so look somewhere new to reach the failure path.
  await page.evaluate(() => { window.walk.VIEW.south = 36.05; window.walk.VIEW.north = 36.1; });
  await toggle();
  await page.waitForFunction(() => document.querySelector('[data-bfb-metro]').shadowRoot.querySelector('.status').textContent.includes("Couldn't"), { timeout: 8000 });
  s = await state();
  check('when every server fails it says so and offers Retry', s.retry && /Couldn't load stations/.test(s.status) && s.layerOn, s);
  await shot(page, 'site-metro-failed');

  // Lines failing must not cost the stations that did load.
  server.mode = 'lines-down';
  await page.evaluate(() => document.querySelector('[data-bfb-metro]').shadowRoot.querySelector('.retry').click());
  await page.waitForFunction(() => document.querySelector('[data-bfb-metro]').shadowRoot.querySelector('.status').textContent.includes('all lines'), { timeout: 8000 });
  s = await state();
  check('when only lines fail, it says so and offers Retry', s.retry && /Couldn't load all lines/.test(s.status), s);
  server.mode = 'ok';
  await page.evaluate(() => document.querySelector('[data-bfb-metro]').shadowRoot.querySelector('.retry').click());
  await page.waitForFunction(() => !document.querySelector('[data-bfb-metro]').shadowRoot.querySelector('.status').textContent, { timeout: 8000 });
  s = await state();
  check('Retry recovers', !s.retry && s.status === '', s);
} finally {
  await close();
}

console.log(failed ? `\n${failed} check(s) failed` : '\nAll metro checks passed');
process.exit(failed ? 1 : 0);
