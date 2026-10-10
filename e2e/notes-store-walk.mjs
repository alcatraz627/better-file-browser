// Walks the Notes surface on a copy of a real shared notes store (Switchboard's
// ~/Notes: id-named files, Switchboard frontmatter, git history, an agent note,
// a note holding both sides of a clash). The smoke test's notes folder is made
// up; this one checks bfb against the store the owner actually uses.
//
//   BFB_NOTES_SRC=/path/to/Notes node e2e/notes-store-walk.mjs   (default ~/Notes)
//
// The source folder is copied, never written. Each check names what a person
// would see go wrong, so a FAIL line reads as the defect.
import { launch, shot } from './harness.mjs';
import { cpSync, rmSync, readdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { execFileSync } from 'node:child_process';

const SRC = process.env.BFB_NOTES_SRC || join(homedir(), 'Notes');
const store = join(tmpdir(), `bfb-store-walk-${process.pid}`);
rmSync(store, { recursive: true, force: true });
cpSync(SRC, store, { recursive: true });

const fails = [];
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails.push(msg); };
const read = rel => readFileSync(join(store, rel), 'utf8');
const front = text => {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  const out = {};
  if (m) for (const line of m[1].split('\n')) { const i = line.indexOf(':'); if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim(); }
  return out;
};
// What a person would call the note: the title field, else the first line.
const expectedTitle = text => {
  const t = front(text).title;
  if (t) return t.replace(/^"|"$/g, '');
  const body = text.replace(/^---\n[\s\S]*?\n---\n?/, '');
  return (body.split('\n').map(l => l.trim()).find(Boolean) || '').replace(/^#+\s*/, '');
};
const mdFiles = readdirSync(store).filter(f => f.endsWith('.md')).sort();

const h = await launch();
try {
  const page = await h.open();
  await page.evaluate(nd => localStorage.setItem('bfb-settings-v1',
    JSON.stringify({ showSidebar: true, tooltips: true, notesRoot: nd })), store);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe-nt-list .fe-nt-item', { timeout: 10_000 }).catch(() => null);

  // 1. The list: every note, by the name a person gave it.
  const rows = await page.$$eval('#fe-nt-list .fe-nt-item', els => els.map(e => ({
    rel: e.getAttribute('data-rel'), label: e.querySelector('.fe-nt-label')?.textContent })));
  check(rows.length === mdFiles.length, `the sidebar lists every note in the store: ${rows.length} of ${mdFiles.length}`);
  const wrongNames = rows.filter(r => existsSync(join(store, r.rel)) && r.label !== expectedTitle(read(r.rel)));
  check(wrongNames.length === 0, `each row shows the note's title, not its file name: ${JSON.stringify(wrongNames.slice(0, 4))}`);
  const filenameLabels = rows.filter(r => /^\d{8}-\d{6}/.test(r.label || ''));
  check(filenameLabels.length === 0, `no row is labelled with a raw id: ${JSON.stringify(filenameLabels.slice(0, 4))}`);
  await shot(page, 'store-walk-list');

  // 2. Open a coloured, pinned Switchboard note and read what the editor shows.
  const target = mdFiles.find(f => { const fm = front(read(f)); return fm.color && fm.pinned === 'true'; }) || mdFiles[0];
  const before = read(target);
  await page.click(`#fe-nt-list .fe-nt-item[data-rel="${target}"] .fe-si-link`);
  await page.waitForSelector('#fe-ed-src', { timeout: 8_000 }).catch(() => null);
  await new Promise(r => setTimeout(r, 400));
  const opened = await page.evaluate(() => ({
    src: document.getElementById('fe-ed-src')?.value ?? null,
    viewText: document.getElementById('fe-ed-view')?.innerText ?? '',
  }));
  check(opened.src !== null, `${target} opens in the editor`);
  check(!/^(title|created|pinned|color):/m.test(opened.viewText), `the rendered side does not print the frontmatter as text: ${JSON.stringify(opened.viewText.slice(0, 120))}`);
  await shot(page, 'store-walk-open');

  // 3. Edit and save: every frontmatter field Switchboard wrote survives.
  await page.evaluate(() => {
    const ta = document.getElementById('fe-ed-src');
    ta.value = ta.value.replace(/\s*$/, '\n\nAdded by the store walk.\n');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.keyboard.down('Meta'); await page.keyboard.press('s'); await page.keyboard.up('Meta');
  await page.waitForFunction(() => /saved \d/.test(document.getElementById('fe-ql-meta').textContent), { timeout: 8_000 }).catch(() => null);
  const afterSave = existsSync(join(store, target)) ? read(target) : '';
  const lost = Object.keys(front(before)).filter(k => !(k in front(afterSave)));
  check(afterSave.includes('Added by the store walk.'), `the edit reached the file on disk`);
  check(lost.length === 0, `saving keeps every frontmatter field: lost ${JSON.stringify(lost)}`);
  check(existsSync(join(store, target)), `saving does not rename a Switchboard note (its id is its file name)`);

  // 4. Versions read from the store's git history.
  await page.evaluate(() => document.querySelector('#fe-ed-bar [data-act="versions"], [data-act="versions"]')?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
  await page.evaluate(() => document.querySelector('[data-act="versions"]')?.click());
  await page.waitForFunction(() => !/reading versions/.test(document.body.innerText), { timeout: 8_000 }).catch(() => null);
  const gitCount = Number(execFileSync('git', ['-C', store, 'rev-list', '--count', 'HEAD', '--', target]).toString().trim());
  const histText = await page.evaluate(() => document.querySelector('#fe-ed-hist, .fe-ed-hist, [id*="hist"]')?.innerText ?? '');
  check(gitCount > 0 && histText.length > 0 && !/failed|No versions yet/.test(histText), `versions list the note's git history (${gitCount} commits): ${JSON.stringify(histText.slice(0, 100))}`);
  await shot(page, 'store-walk-versions');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  // 5. Rename from the sidebar: the title changes, the id (file name) does not.
  const renameTarget = mdFiles.find(f => f !== target && /^\d{8}-\d{6}/.test(f)) || mdFiles[1];
  const renameBefore = read(renameTarget);
  const label = await page.$(`#fe-nt-list .fe-nt-item[data-rel="${renameTarget}"] .fe-nt-label`);
  if (label) {
    await label.evaluate(el => el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true })));
    await page.waitForFunction(rel => document.querySelector(`#fe-nt-list .fe-nt-item[data-rel="${rel}"] .fe-nt-label`)?.isContentEditable,
      { timeout: 3_000 }, renameTarget).catch(() => null);
    const editState = await page.evaluate(rel => {
      const l = document.querySelector(`#fe-nt-list .fe-nt-item[data-rel="${rel}"] .fe-nt-label`);
      return { editable: l?.isContentEditable, focused: document.activeElement === l };
    }, renameTarget);
    check(editState.editable && editState.focused, `double-clicking a note's name opens it for typing: ${JSON.stringify(editState)}`);
    // A toast fades in seconds; keep every text it shows on a data attribute.
    await page.evaluate(() => {
      const t = document.getElementById('fe-toast');
      if (t) new MutationObserver(() => { t.dataset.seen = (t.dataset.seen || '') + ' | ' + t.textContent; })
        .observe(t, { childList: true, characterData: true, subtree: true });
    });
    await page.keyboard.type('Renamed by the walk');   // the label's text is selected, so typing replaces it
    await page.keyboard.press('Enter');
    // The edited label already reads the new name, so wait on the file, not the DOM.
    for (let i = 0; i < 40 && existsSync(join(store, renameTarget)) && expectedTitle(read(renameTarget)) !== 'Renamed by the walk'; i++)
      await new Promise(r => setTimeout(r, 200));
    const seen = await page.evaluate(() => document.getElementById('fe-toast')?.dataset.seen);
    if (seen) console.log('info toasts during rename', JSON.stringify(seen));
  }
  const stillThere = existsSync(join(store, renameTarget));
  check(stillThere, `rename keeps the file name ${renameTarget}, so Switchboard's order and the note's history stay attached`);
  const renamedTitle = stillThere ? expectedTitle(read(renameTarget)) : null;
  check(renamedTitle === 'Renamed by the walk', `rename sets the title: ${JSON.stringify(renamedTitle)}`);
  check(!stillThere || Object.keys(front(renameBefore)).every(k => k in front(read(renameTarget))), `rename keeps the other frontmatter fields`);

  // 6. The note holding both sides of a clash shows both sides and the markers.
  const clash = mdFiles.find(f => existsSync(join(store, f)) && /^<{7} /m.test(read(f)));
  if (clash) {
    await page.click(`#fe-nt-list .fe-nt-item[data-rel="${clash}"] .fe-si-link`);
    // The hidden editor keeps the last note's text, so wait for this note's own markers.
    await page.waitForFunction(() => /^<{7} /m.test(document.getElementById('fe-ed-src')?.value || ''), { timeout: 8_000 }).catch(() => null);
    const clashSrc = await page.$eval('#fe-ed-src', el => el.value).catch(() => '');
    check(/^<{7} /m.test(clashSrc) && /^>{7} /m.test(clashSrc), `the clashed note ${clash} shows both sides with their markers`);
    await shot(page, 'store-walk-clash');
    await page.keyboard.press('Escape');
  } else console.log('skip no clashed note in this store');

  // 7. New note: lands in the store with a title Switchboard and the Pi read the same way.
  await page.keyboard.press('n');
  await page.waitForSelector('#fe-ed-src', { timeout: 8_000 }).catch(() => null);
  await page.evaluate(() => {
    const ta = document.getElementById('fe-ed-src');
    ta.value = '# Walk new note\n\nmade in bfb\n';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.keyboard.down('Meta'); await page.keyboard.press('s'); await page.keyboard.up('Meta');
  await new Promise(r => setTimeout(r, 1500));
  const made = readdirSync(store).filter(f => f.endsWith('.md') && !mdFiles.includes(f));
  check(made.length === 1, `a new note is one new file in the store: ${JSON.stringify(made)}`);
  const madeText = made[0] ? read(made[0]) : '';
  // bfb never adds front matter; Switchboard and the Pi take the first line as the title.
  check(expectedTitle(madeText) === 'Walk new note', `the new note reads as "Walk new note" in every app: ${JSON.stringify(madeText.slice(0, 80))}`);
  await page.keyboard.press('Escape');

  // 8. Delete: the note leaves the list and does not get committed as a .trash file.
  const delTarget = made[0];
  if (delTarget) {
    await page.waitForSelector(`#fe-nt-list .fe-nt-item[data-rel="${delTarget}"] .fe-rm-btn`, { timeout: 8_000 }).catch(() => null);
    const btn = await page.$(`#fe-nt-list .fe-nt-item[data-rel="${delTarget}"] .fe-rm-btn`);
    if (btn) await btn.evaluate(el => el.click());
    await new Promise(r => setTimeout(r, 1200));
    check(!existsSync(join(store, delTarget)), `delete removes ${delTarget} from the store`);
    const ignored = (() => { try { execFileSync('git', ['-C', store, 'check-ignore', '-q', '.trash/x.md']); return true; } catch { return false; } })();
    check(ignored, `the store's git ignores .trash, so a deleted note is not synced to the Pi as a file`);
  }
  await shot(page, 'store-walk-end');
} finally {
  await h.close();
  rmSync(store, { recursive: true, force: true });
}
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall checks passed');
process.exit(fails.length ? 1 : 0);
