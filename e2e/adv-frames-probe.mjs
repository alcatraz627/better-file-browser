// Adversarial probe: films page moves with the DevTools screencast and counts
// frames that show a near-empty page (a blank cover) between two drawn pages.
//
//   node e2e/adv-frames-probe.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch } from './harness.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const h = await launch({ lmStub: true });
const out = [];
const log = s => { out.push(s); console.log(s); };
const DIR = '/tmp/adv-jank/frames';
mkdirSync(DIR, { recursive: true });

try {
  const notesStore = join(h.fixture, 'nav-notes');
  mkdirSync(notesStore, { recursive: true });
  for (let i = 0; i < 6; i++) writeFileSync(join(notesStore, `n${i}.md`), `---\ntitle: "Note ${i}"\n---\nbody ${i}\n`);
  await h.store.set('bfb-settings-v1', { showSidebar: true, notesRoot: notesStore });
  const F = 'file://' + h.fixture;
  const page = await h.browser.newPage();
  await page.setViewport({ width: 1000, height: 640 });
  const analyser = await h.browser.newPage();
  await analyser.goto('about:blank');
  await page.bringToFront();
  const cdp = await page.createCDPSession();

  // Per frame: share of pixels within 6 levels of the frame's most common colour.
  async function stats(b64) {
    return analyser.evaluate(async src => {
      const img = new Image(); img.src = 'data:image/jpeg;base64,' + src; await img.decode();
      const c = new OffscreenCanvas(img.width, img.height); const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, img.width, img.height).data;
      const counts = new Map();
      for (let i = 0; i < d.length; i += 16) { const k = (d[i] >> 3) << 10 | (d[i + 1] >> 3) << 5 | (d[i + 2] >> 3); counts.set(k, (counts.get(k) || 0) + 1); }
      let top = 0, tk = 0; for (const [k, v] of counts) if (v > top) { top = v; tk = k; }
      const n = d.length / 16;
      const rgb = [(tk >> 10) << 3, ((tk >> 5) & 31) << 3, (tk & 31) << 3];
      let sumL = 0; for (let i = 0; i < d.length; i += 16) sumL += (d[i] + d[i + 1] + d[i + 2]) / 3;
      return { uniform: +(top / n).toFixed(3), rgb, lum: Math.round(sumL / n) };
    }, b64);
  }

  async function film(label, action, ms = 1500) {
    const frames = [];
    const onFrame = async f => { frames.push({ t: f.metadata.timestamp, data: f.data }); try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch { /* gone */ } };
    cdp.on('Page.screencastFrame', onFrame);
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 60, maxWidth: 500, everyNthFrame: 1 });
    await sleep(300);
    const t0 = Date.now() / 1000;
    await action();
    await sleep(ms);
    await cdp.send('Page.stopScreencast');
    cdp.off('Page.screencastFrame', onFrame);
    const rows = [];
    for (const [i, f] of frames.entries()) {
      const s = await stats(f.data);
      rows.push({ i, dt: Math.round((f.t - t0) * 1000), ...s });
      writeFileSync(join(DIR, `${label.replace(/\W+/g, '_')}-${String(i).padStart(2, '0')}.jpg`), Buffer.from(f.data, 'base64'));
    }
    const blank = rows.filter(r => r.uniform > 0.97);
    log(`## ${label}: ${rows.length} frames, blank(>97% one colour)=${blank.length}`);
    log('  ' + rows.map(r => `${r.dt}ms u=${r.uniform} lum=${r.lum}`).join(' | '));
  }

  for (const theme of ['dark', 'light']) {
    await h.store.set('bfb-theme', theme);
    await page.goto(F + '/', { waitUntil: 'load' });
    await sleep(800);
    await film(`${theme} folder->folder by click`, async () => {
      await page.evaluate(() => [...document.querySelectorAll('#fe-tbody tr a, #fe-tbody tr')].find(e => /nested/.test(e.textContent))?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
      await page.evaluate(() => { const a = [...document.querySelectorAll('a')].find(a => /\/nested\/?$/.test(a.getAttribute('href') || '')); if (a) a.click(); });
    });
    await film(`${theme} folder->md by goto`, () => page.goto(F + '/readme.md', { waitUntil: 'load' }));
    await film(`${theme} back`, () => page.goBack({ waitUntil: 'load' }));
    await film(`${theme} theme toggle button`, () => page.click('#fe-theme-btn'), 800);
    await film(`${theme} sidebar toggle button`, () => page.click('#fe-side-toggle'), 800);
    await film(`${theme} sidebar toggle back`, () => page.click('#fe-side-toggle'), 800);
  }
} finally {
  writeFileSync('/tmp/adv-jank/frames.txt', out.join('\n'));
  await h.close();
}
