// Puts the page into the states the style snapshot never visits (a collapsed
// section, hidden dotfiles, densities, tooltips off, a narrow lens, broken
// images, an alert block) and asserts each state's rule still wins there.
//
//   node e2e/state-rules-probe.mjs
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch } from './harness.mjs';

const out = [];
const check = (ok, msg) => { out.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const h = await launch();
try {
  writeFileSync(join(h.fixture, "pic.png"), "not really a png");
  writeFileSync(join(h.fixture, "alert.md"), '# A\n\n> [!NOTE]\n> hello there\n');
  writeFileSync(join(h.notesDir, 'pinned.md'), '---\ntitle: "Pinned one"\npinned: true\n---\nbody\n');
  await h.store.set('bfb-settings-v1', { showSidebar: true, notesRoot: h.notesDir });
  const page = await h.open();
  await page.setViewport({ width: 1400, height: 900 });
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe-tbody tr');

  const all = (sel, prop) => page.$$eval(sel, (els, p) => els.map(e => getComputedStyle(e)[p]), prop);

  // Collapsed sidebar sections hide everything but their heading.
  await page.evaluate(() => document.querySelectorAll('.fe-sec').forEach(s => s.classList.add('fe-collapsed')));
  const coll = await all('.fe-sec.fe-collapsed>:not(.fe-sh)', 'display');
  check(coll.length > 0 && coll.every(d => d === 'none'), `collapsed section children hidden: ${coll.length} ${[...new Set(coll)]}`);
  const sh = await all('#fe-side .fe-sh', 'justifyContent');
  check(sh.length > 0 && sh.every(v => v === 'flex-start'), `section headings start-aligned: ${[...new Set(sh)]}`);
  await page.evaluate(() => document.querySelectorAll('.fe-sec').forEach(s => s.classList.remove('fe-collapsed')));

  const proxy = await all('.fe-proxy-filter', 'display');
  check(proxy.length > 0 && proxy.every(d => d === 'none'), `proxy filters hidden: ${proxy}`);

  await page.evaluate(() => { const p = document.getElementById('fe-filter-bar'); if (p) p.style.display = ''; });
  const nm = await all('.fe-in-name input[type="text"]', 'paddingRight');
  const tx = await all('.fe-in-text input[type="text"]', 'paddingRight');
  check(nm.length > 0 && nm.every(v => v === '40px'), `name box padding: ${nm}`);
  check(tx.length > 0 && tx.every(v => v === '68px'), `text box padding: ${tx}`);

  // Tree view without hidden files shows no dotfile rows.
  await page.click('#fe-view-group [data-v="tree"]').catch(() => {});
  await sleep(500);
  await page.evaluate(() => document.getElementById('fe').classList.remove('show-hidden'));
  const dots = await all('.fe-tree-row.dotfile', 'display');
  check(dots.every(d => d === 'none'), `dotfile tree rows hidden (${dots.length} rows): ${[...new Set(dots)]}`);

  for (const [view, margin] of [["tiles", "8px"], ["icons", "8px"]]) {
    await page.click(`#fe-view-group [data-v="${view}"]`).catch(() => {});
    await sleep(500);
    await page.evaluate(() => document.querySelectorAll(".fe-tile-img-wrap").forEach(w => w.classList.add("err")));
    for (const d of ["1", "2", "5"]) {
      await page.evaluate(v => { document.getElementById("fe").dataset.density = v; }, d);
      const e = await page.$$eval(".fe-tile-img-wrap.err svg", els => els.map(x => getComputedStyle(x).transform + " " + getComputedStyle(x).marginTop));
      check(e.length > 0 && e.every(v => v === "none " + margin), `${view} density ${d}: a broken image's icon is unscaled with ${margin} margin: ${e.length} ${[...new Set(e)]}`);
    }
    const t = await page.$$eval('.fe-tile-img-wrap svg', els => els.map(e => [getComputedStyle(e).transform, getComputedStyle(e).marginTop]));
    check(t.length > 0 && t.every(([tr, m]) => tr === 'none' && m === margin), `${view} tile icons untransformed with ${margin} margin: ${t.length} ${JSON.stringify([...new Set(t.map(String))])}`);
    for (const d of ['4', '5']) {
      await page.evaluate(v => { document.getElementById('fe').dataset.density = v; }, d);
      const tags = await all('.fe-tile-tags', 'display');
      check(tags.length > 0 && tags.every(x => d === '4' ? x === 'none' : x === 'flex'), `${view} density ${d} tag line ${d === '4' ? 'hidden' : 'shown'}: ${[...new Set(tags)]}`);
    }
  }

  // Tooltips off: the tip never shows.
  await page.click('#fe-view-group [data-v="details"]').catch(() => {});
  await sleep(400);
  await page.evaluate(() => { document.getElementById('fe').classList.add('fe-notips'); const t = document.getElementById('fe-tip'); t?.classList.add('show'); });
  check(await page.$eval('#fe-tip', e => getComputedStyle(e).display) === 'none', 'tooltips off hides the tip even while shown');
  await page.evaluate(() => document.getElementById('fe').classList.remove('fe-notips'));

  // A spacer row in the virtual table never paints, hovered or selected.
  await page.evaluate(() => { const tb = document.getElementById('fe-tbody'); const tr = document.createElement('tr'); tr.className = 'fe-spacer selected kb'; tr.id = 'probe-spacer'; tr.innerHTML = '<td colspan="6" style="height:40px"></td>'; tb.prepend(tr); });
  await page.hover('#probe-spacer td');
  const sp = await page.$eval('#probe-spacer td', e => getComputedStyle(e).backgroundColor);
  check(sp === 'rgba(0, 0, 0, 0)', `spacer row has no background when hovered and selected: ${sp}`);

  // Places and Notes icons.
  await page.click('[data-lens="places"]').catch(() => {});
  await sleep(300);
  const pl = await page.$$eval('.fe-pl-meta svg', els => els.map(e => getComputedStyle(e).width + 'x' + getComputedStyle(e).height));
  check(pl.every(v => v === '11px x11px'.replace(' ', '')), `places meta icons 11px: ${pl.length} ${[...new Set(pl)]}`);
  await page.click('[data-lens="notes"], #fe-rail [data-lens="notes"]').catch(() => {});
  await page.waitForSelector('.fe-nt-item', { timeout: 5000 }).catch(() => {});
  const pin = await page.$$eval('.fe-nt-item .fe-nt-pin svg', els => els.map(e => getComputedStyle(e).width + 'x' + getComputedStyle(e).height));
  check(pin.length > 0 && pin.every(v => v === '12pxx12px'), `notes pin icons 12px: ${pin}`);
  // A narrow lens drops the props and tab buttons.
  await page.evaluate(() => { const s = document.getElementById('fe-side'); s.style.width = '190px'; });
  await sleep(300);
  const narrow = await all('.fe-nt-props, .fe-nt-tab', 'display');
  check(narrow.length > 0 && narrow.every(d => d === 'none'), `narrow lens hides props and tab: ${narrow.length} ${[...new Set(narrow)]}`);
  await page.evaluate(() => { document.getElementById('fe-side').style.width = ''; });

  // An alert title in a rendered page.
  await page.goto('file://' + join(h.fixture, 'alert.md'), { waitUntil: 'load' });
  await page.waitForSelector('.fe-md-alert-title', { timeout: 8000 }).catch(() => {});
  const al = await page.$$eval('.fe-md-alert-title', els => els.map(e => getComputedStyle(e).margin));
  check(al.length > 0 && al.every(m => m === '0px 0px 4px'), `alert title margin: ${al}`);

  // The file page hides the listing's own bars.
  const hid = await page.$$eval('#fe-toolbar,#fe-sg-panel,#fe-filter-bar,#fe-scroll', els => els.map(e => e.id + ':' + getComputedStyle(e).display));
  check(hid.every(x => x.endsWith(':none')), `file page hides listing bars: ${hid}`);
} finally {
  console.log(out.join('\n'));
  await h.close();
}
