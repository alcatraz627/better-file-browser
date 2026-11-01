// The header fields bfb used to ignore: an agent's notes sit in a folded Agents lane, expired notes in
// a folded Expired lane (never deleted), a note with a url shows an open and copy button, and a reminder
// can be shown, set, changed, dismissed and cleared, with a missed one staying visible.
//
//   node e2e/note-fields-walk.mjs      (generated scratch store; BFB_THEME=light for the light shots)
import { makeNotesStore } from './make-notes-store.mjs';
import { launch, shot, applyTheme } from './harness.mjs';
import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const store = join(tmpdir(), `bfb-fields-walk-${process.pid}`);
makeNotesStore(store);
const hdr = (fields, body = 'body\n') => `---\n${Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\n${body}`;
writeFileSync(join(store, 'agent-1.md'), hdr({ title: '"Agent one"', created: '2026-10-30T10:00:00Z', agent: '"claude-1"' }));
writeFileSync(join(store, 'agent-2.md'), hdr({ title: '"Agent two"', created: '2026-10-31T10:00:00Z', agent: '"claude-2"' }));
writeFileSync(join(store, 'old-news.md'), hdr({ title: '"Old news"', created: '2026-01-01T10:00:00Z', expires: '2026-02-01T00:00:00Z' }));
writeFileSync(join(store, 'rem-missed.md'), hdr({ title: '"Missed call"', created: '2026-10-01T10:00:00Z', remind_at: '2026-10-02T09:00:00Z' }));
writeFileSync(join(store, 'rem-soon.md'), hdr({ title: '"Pay rent"', created: '2026-10-01T11:00:00Z', remind_at: '2099-01-02T09:00:00Z', remind_repeat: 'weekly', remind_on: 'phone' }));
writeFileSync(join(store, 'link-note.md'), hdr({ title: '"Read later"', created: '2026-10-01T12:00:00Z', url: '"https://example.com/article"' }));
writeFileSync(join(store, 'plain-one.md'), hdr({ title: '"Plain one"', created: '2026-10-01T13:00:00Z', tags: '"keep"' }));

const fails = [];
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails.push(msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const read = f => readFileSync(join(store, f), 'utf8');

const h = await launch();
try {
  const page = await h.open();
  await h.store.set('bfb-lens-v1', 'notes');
  await h.store.edit('bfb-settings-v1', s => ({ ...s, showSidebar: true, tooltips: true, notesRoot: store }));
  await applyTheme(page);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe-nt-list .fe-nt-item', { timeout: 10_000 });
  await sleep(400);

  // 1. Lanes
  const lanes = () => page.$$eval('#fe-nt-list .fe-nt-grp', gs => gs.map(g => ({ key: g.dataset.grp, open: g.getAttribute('aria-expanded') === 'true', n: g.querySelector('.fe-grp-n')?.textContent, rels: [...g.nextElementSibling.querySelectorAll('.fe-nt-item')].map(i => i.dataset.rel) })));
  let ls = await lanes();
  const agents = ls.find(l => l.key === 'agents'), expired = ls.find(l => l.key === 'expired'), all = ls.find(l => l.key === 'all');
  check(agents && !agents.open && agents.n === '2' && agents.rels.sort().join() === 'agent-1.md,agent-2.md', `agents have their own lane, folded: ${JSON.stringify(agents)}`);
  check(expired && !expired.open && expired.rels.join() === 'old-news.md', `an expired note is under Expired, folded: ${JSON.stringify(expired)}`);
  check(all && !all.rels.some(r => /agent|old-news/.test(r)), 'neither shows in All notes');
  check(read('old-news.md').includes('expires: 2026-02-01'), 'the expired note is still on disk, untouched');
  await shot(page, 'fields-lanes-folded');
  await page.click('#fe-nt-list .fe-nt-grp[data-grp="agents"]');
  await sleep(500);
  check((await lanes()).find(l => l.key === 'agents').open && await page.$eval('#fe-nt-list .fe-nt-item[data-rel="agent-1.md"] .fe-nt-mark.agent', e => e.textContent.includes('claude-1')), 'opening the lane shows its notes, each marked with the agent');
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('#fe-nt-list .fe-nt-item');
  check((await lanes()).find(l => l.key === 'agents').open, 'an opened lane stays open after a reload');

  // 2. Row marks: reminders, missed, link
  const marks = rel => page.$$eval(`#fe-nt-list .fe-nt-item[data-rel="${rel}"] .fe-nt-mark`, ms => ms.map(m => m.className + ':' + m.textContent));
  const miss = await marks('rem-missed.md'), soon = await marks('rem-soon.md'), link = await marks('link-note.md');
  check(miss.some(m => /missed/.test(m) && /Missed/.test(m)), `a reminder that passed shows as missed: ${miss}`);
  check(soon.some(m => /rem/.test(m) && /Jan 2/.test(m)), `an upcoming reminder shows its time: ${soon}`);
  check(link.some(m => /url/.test(m)), 'a note with a url shows a link mark');
  await page.click('#fe-nt-list .fe-nt-grp[data-grp="agents"]');
  await shot(page, 'fields-rows');

  // 3. Editor: url chip with open and copy
  await page.click('#fe-nt-list .fe-nt-item[data-rel="link-note.md"] .fe-si-link');
  await page.waitForSelector('#fe-meta-title', { timeout: 8000 });
  await sleep(400);
  check(await page.$eval('.fe-chip-url .fe-chip-url-t', e => e.textContent) === 'example.com/article', 'the url shows as a chip');
  check(!!(await page.$('.fe-chip-url [data-m="url-open"]')) && !!(await page.$('.fe-chip-url [data-m="url-copy"]')), 'with an open button and a copy button');
  await page.click('.fe-chip-url [data-m="url-copy"]');
  check(await page.$eval('.fe-chip-url [data-m="url-copy"]', e => e.title) === 'Copied', 'copy says it copied');
  await shot(page, 'fields-url-chip');

  // 4. Set, change, dismiss, clear a reminder from the editor
  await page.keyboard.press('Escape'); await sleep(300);
  await page.click('#fe-nt-list .fe-nt-item[data-rel="plain-one.md"] .fe-si-link');
  await page.waitForSelector('#fe-meta-title', { timeout: 8000 }); await sleep(400);
  const before = read('plain-one.md');
  await page.click('.fe-chip-rem');
  await page.waitForSelector('#fe-rem-at');
  await page.$eval('#fe-rem-at', e => { e.value = '2030-01-02T09:00'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.select('#fe-rem-repeat', 'weekly');
  await page.select('#fe-rem-on', 'phone');
  await page.click('#fe-rem-persist');
  await shot(page, 'fields-reminder-popover');
  await page.click('.fe-rem-form button[type="submit"]');
  await sleep(2500);
  const iso = new Date('2030-01-02T09:00').toISOString().replace(/\.\d{3}Z$/, 'Z');
  const set = read('plain-one.md');
  check(set.includes(`remind_at: ${iso}\nremind_repeat: weekly\nremind_on: phone\nremind_persist: true\n`), `setting a reminder writes the four keys in spec order: ${JSON.stringify(set.split('---')[1])}`);
  check(set.replace(/^updated: .*\n/m, '').replace(/remind_[a-z]+: .*\n/g, '') === before.replace(/^updated: .*\n/m, ''), 'and changes nothing else in the file');
  check((await page.$eval('.fe-chip-rem span', e => e.textContent)).includes('Jan 2') && (await page.$eval('.fe-chip-rem span', e => e.textContent)).includes('on phone'), 'the chip then shows when, how often and where');
  await page.click('.fe-chip-rem'); await page.waitForSelector('[data-rem="dismiss"]');
  await page.click('[data-rem="dismiss"]'); await sleep(2500);
  const moved = read('plain-one.md').match(/remind_at: (.*)/)?.[1];
  check(moved && Date.parse(moved) - Date.parse(iso) === 7 * 86400_000, `dismissing a weekly reminder moves it a week on: ${moved}`);
  await page.click('.fe-chip-rem'); await page.waitForSelector('[data-rem="clear"]');
  await page.click('[data-rem="clear"]'); await sleep(2500);
  check(!/remind_/.test(read('plain-one.md')), 'clearing removes every remind key');

  // 5. Expiry: set from the editor, written alone, removed; and set together with a reminder
  const bx = read('plain-one.md');
  check(await page.$eval('.fe-chip-exp span', e => e.textContent) === 'Expiry', 'a note with no expiry offers an Expiry chip');
  await page.click('.fe-chip-exp');
  await page.waitForSelector('#fe-exp-at');
  await page.$eval('#fe-exp-at', e => { e.value = '2031-03-04T10:30'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await shot(page, 'fields-expiry-popover');
  await page.click('.fe-exp .fe-rem-form button[type="submit"]');
  await sleep(2500);
  const isoE = new Date('2031-03-04T10:30').toISOString().replace(/\.\d{3}Z$/, 'Z');
  const withE = read('plain-one.md');
  check(withE.includes(`expires: ${isoE}\n`), `setting an expiry writes the expires line: ${JSON.stringify(withE.split('---')[1])}`);
  check(withE.replace(/^updated: .*\n/m, '').replace(/^expires: .*\n/m, '') === bx.replace(/^updated: .*\n/m, ''), 'and changes nothing else in the file');
  check((await page.$eval('.fe-chip-exp span', e => e.textContent)).includes('Mar 4'), 'the chip then shows the date');
  await page.click('[data-m="expires-clear"]'); await sleep(2500);
  check(!/^expires:/m.test(read('plain-one.md')), 'the remove button takes the expires line out');
  await page.click('.fe-chip-rem'); await page.waitForSelector('#fe-rem-at');
  await page.$eval('#fe-rem-at', e => { e.value = '2030-01-02T09:00'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.click('#fe-rem-expire');
  await page.click('.fe-rem-form button[type="submit"]'); await sleep(2500);
  const both = read('plain-one.md');
  check(both.includes(`remind_at: ${iso}\n`) && both.includes(`expires: ${iso}\n`), 'a reminder set with "also expire" writes both at the same time');
  await page.click('.fe-chip-rem'); await page.waitForSelector('[data-rem="clear"]');
  await page.click('[data-rem="clear"]'); await sleep(2500);
  check(/^expires:/m.test(read('plain-one.md')), 'clearing the reminder leaves the expiry alone');
  check(!(await page.$eval('#fe-ql-meta', e => e.textContent)).includes('not saved'), 'no "not saved" warning came up');
} finally {
  await h.close();
}
if (fails.length) { console.error(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log('\nall checks passed');
