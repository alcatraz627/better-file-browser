// Editing a text file in place: the Edit button saves through the notes host
// inside an allowed folder, keeps the reading view in step, refuses outside
// one, and shows the on-disk-change banner instead of overwriting. (.yaml is
// left out: Chrome downloads it instead of opening a page, tracked in the plan.)
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { launch, SHOTS } from './harness.mjs';

const h = await launch();
const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
try {
  const md = join(h.fixture, 'edit-me.md');
  const txt = join(h.fixture, 'plain.txt');
  writeFileSync(md, '# Title\n\nfirst\n');
  writeFileSync(txt, 'a: 1\n');
  const page = await h.browser.newPage();
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  let dialogs = 0;
  page.on('dialog', d => { dialogs++; void d.accept(); });

  // Not allowed yet: the button explains instead of opening an editor.
  await page.goto('file://' + md, { waitUntil: 'load' });
  await page.waitForSelector('#fe-fp-edit');
  await page.click('#fe-fp-edit');
  const refused = await page.$eval('#fe-status-text', el => el.textContent);
  check(/Editable folders/.test(refused) && await page.$eval('#fe-fe', el => el.style.display === 'none'), `outside an allowed folder, Edit explains: "${refused}"`);

  await h.store.edit('bfb-settings-v1', s => { s.editableFolders = [h.fixture]; });
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe-fp-edit');
  await page.keyboard.press('e');
  await page.waitForSelector('#fe-ed-src', { timeout: 5000 });
  await page.focus('#fe-ed-src');
  await page.keyboard.down('Meta'); await page.keyboard.press('ArrowDown'); await page.keyboard.up('Meta');
  await page.keyboard.type('second line\n');
  const live = await page.$eval('#fe-ed-view', el => el.textContent);
  check(/second line/.test(live), 'markdown edits render live beside the source');
  check(await page.$eval('#fe-fe-state', el => el.textContent) === '● unsaved', 'typing marks the file unsaved');
  await page.keyboard.down('Meta'); await page.keyboard.press('s'); await page.keyboard.up('Meta');
  await page.waitForFunction(() => document.getElementById('fe-fe-state').textContent === 'saved', { timeout: 5000 }).catch(() => null);
  check(readFileSync(md, 'utf8').endsWith('second line\n'), `Cmd+S wrote the file: ${JSON.stringify(readFileSync(md, 'utf8'))}`);
  await page.screenshot({ path: join(SHOTS, 'edit-md-dark.png') });

  // A change on disk while unsaved shows the banner and is not overwritten.
  await page.keyboard.type('mine\n');
  writeFileSync(md, '# Title\n\nchanged elsewhere\n');
  const later = new Date(Date.now() + 5000); utimesSync(md, later, later);
  await page.waitForFunction(() => document.getElementById('fe-fe-banner').style.display !== 'none', { timeout: 6000 }).catch(() => null);
  check(await page.$eval('#fe-fe-banner', el => el.style.display !== 'none') && readFileSync(md, 'utf8').includes('changed elsewhere'), 'an on-disk change while unsaved shows the banner, file untouched');
  await page.click('#fe-fe-banner [data-act="reload"]');
  await page.waitForFunction(() => document.getElementById('fe-ed-src').value.includes('changed elsewhere'), { timeout: 5000 }).catch(() => null);
  check(await page.$eval('#fe-ed-src', el => el.value.includes('changed elsewhere')), 'Load from disk replaces the editor text');
  await page.click('#fe-fe-bar [data-act="done"]');
  const back = await page.$eval('#fe-page', el => el.style.display !== 'none' && el.textContent.includes('changed elsewhere'));
  check(back && dialogs === 0, `Done returns to the reading view with the current text, no discard prompt (${dialogs})`);

  // A non-markdown file edits as source alone.
  await page.goto('file://' + txt, { waitUntil: 'load' });
  await page.waitForSelector('#fe-fp-edit');
  await page.click('#fe-fp-edit');
  await page.waitForSelector('#fe-ed-src');
  check(!(await page.$('#fe-ed-view')), 'a .txt file edits as source alone');

  // A .yaml file, which Chrome downloads, opens in its folder's view: coloured and editable.
  const yaml = join(h.fixture, 'conf.yaml');
  writeFileSync(yaml, 'name: demo\nsteps:\n  - run: make\n');
  await page.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
  await page.waitForSelector('#fe-tbody');
  const row = await page.$('#fe-tbody tr[data-idx]:has(a[href$="conf.yaml"]) td.c-nm');
  await Promise.all([page.waitForNavigation({ waitUntil: 'load' }).catch(() => null), row.click({ count: 2 })]);
  await page.waitForSelector('#fe-page .tok-key', { timeout: 5000 }).catch(() => null);
  const yv = { url: page.url(), keys: await page.$$eval('#fe-page .tok-key', s => s.map(x => x.textContent)), crumb: await page.title() };
  check(yv.url.endsWith('/#view=conf.yaml') && yv.keys.includes('name') && /conf\.yaml/.test(yv.crumb), `a .yaml opens in its folder view, coloured: ${JSON.stringify(yv)}`);
  await page.screenshot({ path: join(SHOTS, 'view-yaml-dark.png') });
  await page.keyboard.press('e');
  await page.waitForSelector('#fe-ed-src');
  await page.focus('#fe-ed-src');
  await page.keyboard.down('Meta'); await page.keyboard.press('ArrowDown'); await page.keyboard.up('Meta');
  await page.keyboard.type('done: true\n');
  await page.keyboard.down('Meta'); await page.keyboard.press('s'); await page.keyboard.up('Meta');
  await page.waitForFunction(() => document.getElementById('fe-fe-state').textContent === 'saved', { timeout: 5000 }).catch(() => null);
  check(readFileSync(yaml, 'utf8').endsWith('done: true\n'), 'the .yaml saves from its view');
} finally {
  console.log(results.join('\n'));
  await h.close();
}
assert.ok(results.every(r => !r.startsWith('FAIL')), 'edit walk passes');
