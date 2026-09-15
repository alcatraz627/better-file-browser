// Smoke run: the explorer renders the fixture, a preview opens and closes,
// and screenshots land in e2e/shots/. Run with `npm run e2e`.
import { launch, shot, applyTheme } from './harness.mjs';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const failures = [];
function check(cond, msg) {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) failures.push(msg);
}

const h = await launch({ headless: process.env.BFB_HEADED ? false : true });
try {
  const page = await h.open();
  await applyTheme(page);

  const rows = await page.$$eval('#fe-tbody tr[data-idx]', els => els.length);
  // 7 visible files + nested dir + parent row; .hidden is off by default
  check(rows === 9, `renders ${rows} rows (expected 9)`);

  const count = await page.$eval('#fe-count', el => el.textContent);
  check(/1 folder, 7 files/.test(count), `status count reads "${count}"`);
  await shot(page, 'listing');

  // A plain click on a file row opens the panel.
  const row = await page.$('#fe-tbody tr[data-idx]:has(a[href$="readme.md"]) td:last-child');
  check(!!row, 'readme.md row present');
  await row.click();
  await page.waitForSelector('#fe-ql-body h1', { timeout: 5_000 }).catch(() => null);
  const h1 = await page.$eval('#fe-ql-body h1', el => el.textContent).catch(() => null);
  check(h1 === 'Fixture', `markdown preview rendered h1 "${h1}"`);
  await shot(page, 'preview-md');

  const hdr = await page.evaluate(() => {
    const n = document.getElementById('fe-ql-name');
    const o = document.getElementById('fe-ql-open');
    const links = [...document.querySelectorAll('#fe-ql-body a[href]:not(.fe-md-anchor)')];
    return {
      nameHref: n.getAttribute('href'), nameTarget: n.target,
      openTarget: o.target,
      bodyLinks: links.length, bodyBlank: links.every(a => a.target === '_blank'),
    };
  });
  check(/readme\.md$/.test(hdr.nameHref) && hdr.nameTarget === '_blank', `header name links to file in new tab: ${hdr.nameHref}`);
  check(hdr.openTarget === '_blank', 'open raw targets a new tab');
  check(hdr.bodyLinks === 1 && hdr.bodyBlank, `markdown links (${hdr.bodyLinks}) target a new tab`);
  // Arrows step between previewable files while the panel is open.
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => document.getElementById('fe-ql-name').textContent === 'rows.tsv', { timeout: 3_000 }).catch(() => null);
  const stepped = await page.$eval('#fe-ql-name', el => el.textContent);
  await page.keyboard.press('ArrowUp');
  await page.waitForFunction(() => document.getElementById('fe-ql-name').textContent === 'readme.md', { timeout: 3_000 }).catch(() => null);
  check(stepped === 'rows.tsv' && await page.$eval('#fe-ql-name', el => el.textContent) === 'readme.md', `↓ and ↑ step the preview between files: ${stepped}`);

  // Resize the floating window by its corner grip.
  const dragBy = async (sel, dx, dy) => {
    const b = await (await page.$(sel)).boundingBox();
    const x = b.x + b.width / 2, y = b.y + b.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 6 });
    await page.mouse.up();
  };
  const dlgBox = () => page.$eval('#fe-ql-dialog', el => ({ w: el.offsetWidth, h: el.offsetHeight }));
  const dlgBefore = await dlgBox();
  await dragBy('#fe-ql-rz', -300, -200);
  const afterDrag = await dlgBox();
  check(afterDrag.w < dlgBefore.w - 250 && afterDrag.h < dlgBefore.h - 150, `corner drag shrank modal ${dlgBefore.w}x${dlgBefore.h} → ${afterDrag.w}x${afterDrag.h}`);
  await shot(page, 'preview-modal-resized');

  // Dock to the side: the overlay becomes a flex sibling of the listing.
  const mainBefore = await page.$eval('#fe-main', el => el.offsetWidth);
  await page.click('#fe-ql-dock');
  const docked = await page.evaluate(() => ({
    side: document.getElementById('fe-qlook').classList.contains('side'),
    parent: document.getElementById('fe-qlook').parentElement.id,
    main: document.getElementById('fe-main').offsetWidth,
  }));
  check(docked.side && docked.parent === 'fe-body' && docked.main < mainBefore - 300, `docked: ${JSON.stringify(docked)}`);

  // In side mode a row click previews that file.
  await (await page.$('#fe-tbody tr[data-idx]:has(a[href$="notes.txt"]) td:last-child')).click();
  await page.waitForFunction(() => document.getElementById('fe-ql-name').textContent === 'notes.txt', { timeout: 3_000 }).catch(() => null);
  const followed = await page.$eval('#fe-ql-name', el => el.textContent);
  check(followed === 'notes.txt', `docked preview follows row click: ${followed}`);

  const sideBefore = await page.$eval('#fe-qlook', el => el.offsetWidth);
  await dragBy('#fe-ql-rz-side', -150, 0);
  const sideAfter = await page.$eval('#fe-qlook', el => el.offsetWidth);
  check(sideAfter > sideBefore + 100, `edge drag widened panel ${sideBefore} → ${sideAfter}`);
  await shot(page, 'preview-docked');

  // Mode and sizes survive a reload.
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe');
  await (await page.$('#fe-tbody tr[data-idx]:has(a[href$="readme.md"]) td:last-child')).click();
  await page.waitForSelector('#fe-ql-body h1', { timeout: 5_000 }).catch(() => null);
  const persisted = await page.evaluate(() => ({
    side: document.getElementById('fe-qlook').classList.contains('side'),
    w: document.getElementById('fe-qlook').offsetWidth,
  }));
  check(persisted.side && Math.abs(persisted.w - sideAfter) <= 2, `docked layout persisted: ${JSON.stringify(persisted)}`);

  await page.click('#fe-ql-dock');
  const floated = await page.evaluate(() => ({
    side: document.getElementById('fe-qlook').classList.contains('side'),
    parent: document.getElementById('fe-qlook').parentElement.id,
    w: document.getElementById('fe-ql-dialog').offsetWidth,
    h: document.getElementById('fe-ql-dialog').offsetHeight,
  }));
  check(!floated.side && floated.parent === 'fe' && Math.abs(floated.w - afterDrag.w) <= 2 && Math.abs(floated.h - afterDrag.h) <= 2,
    `floated again with remembered size: ${JSON.stringify(floated)}`);

  await page.keyboard.press('Escape');
  const stillOpen = await page.$eval('#fe-qlook', el => el.style.display !== 'none');
  check(!stillOpen, 'Escape closes preview');

  // Middle-click on a row name reaches the browser and opens a new tab.
  const before = (await h.browser.pages()).length;
  const notesLink = await page.$('#fe-tbody a[href$="notes.txt"]');
  await notesLink.click({ button: 'middle' });
  await new Promise(r => setTimeout(r, 800));
  const after = (await h.browser.pages()).length;
  check(after === before + 1, `middle-click opened a new tab (${before} → ${after})`);
  check(page.url().endsWith('/'), 'explorer tab stayed on the listing');
  await (await page.$('#fe-tbody tr[data-idx]:has(a[href$="data.json"]) td:last-child')).click({ button: 'middle' });
  await new Promise(r => setTimeout(r, 800));
  const afterRow = (await h.browser.pages()).length;
  check(afterRow === after + 1 && page.url().endsWith('/'), `middle-click on row whitespace also opens a new tab (${after} → ${afterRow})`);

  // Click model: a plain click on a file looks and leaves the URL alone,
  // ⇧ toggles rows, ⌥ keeps a background strip tab, a double-click goes.
  const urlHere = page.url();
  const stripLabels = () => page.$$eval('#fe-tabs .fe-tab', els => els.map(e => (e.classList.contains('temp') ? '~' : '') + e.querySelector('.fe-tab-lbl').textContent));
  await (await page.$('#fe-tbody a[href$="readme.md"]')).click();
  await page.waitForFunction(() => document.getElementById('fe-qlook').style.display !== 'none' && document.getElementById('fe-ql-name').textContent === 'readme.md', { timeout: 3_000 }).catch(() => null);
  const looked = { name: await page.$eval('#fe-ql-name', el => el.textContent), url: page.url() };
  check(looked.name === 'readme.md' && looked.url === urlHere, `plain click on a file name looks in the panel, URL unchanged: ${JSON.stringify(looked)}`);
  await page.keyboard.press('Escape');
  await page.keyboard.down('Shift');
  await (await page.$('#fe-tbody tr[data-idx]:has(a[href$="notes.txt"]) td:last-child')).click();
  await (await page.$('#fe-tbody tr[data-idx]:has(a[href$="data.json"]) td:last-child')).click();
  await page.keyboard.up('Shift');
  const toggled = await page.$$eval('#fe-tbody tr.selected .fe-nm', els => els.map(e => e.textContent).sort());
  check(toggled.join() === 'data.json,notes.txt,readme.md' && page.url() === urlHere, `⇧ click toggles rows into the selection: ${JSON.stringify(toggled)}`);
  await page.keyboard.down('Shift'); await page.keyboard.down('Meta');
  await (await page.$('#fe-tbody tr[data-idx]:has(a[href$="script.sh"]) td:last-child')).click();
  await page.keyboard.up('Meta'); await page.keyboard.up('Shift');
  const ranged = await page.$$eval('#fe-tbody tr.selected .fe-nm', els => els.map(e => e.textContent));
  check(ranged.join() === 'data.json,notes.txt,readme.md,rows.tsv,script.sh' && page.url() === urlHere, `⇧⌘ click selects the range from the anchor: ${JSON.stringify(ranged)}`);
  await page.keyboard.down('Alt');
  await (await page.$('#fe-tbody a[href$="/nested/"]')).click();
  await page.keyboard.up('Alt');
  await page.waitForFunction(() => document.querySelectorAll('#fe-tabs .fe-tab:not(.temp)').length === 1, { timeout: 3_000 }).catch(() => null);
  const bgTab = { tabs: await stripLabels(), url: page.url() };
  check(bgTab.tabs.join('|') === 'nested|~' + h.fixture.split('/').pop() && bgTab.url === urlHere, `⌥ click keeps a background strip tab, URL unchanged: ${JSON.stringify(bgTab)}`);
  await page.click('#fe-tabs .fe-tab[data-id] .fe-tab-x');
  await page.waitForFunction(() => document.querySelectorAll('#fe-tabs .fe-tab:not(.temp)').length === 0, { timeout: 3_000 }).catch(() => null);
  // A double-click needs explicit press counts; ElementHandle.click({clickCount: 2}) arrives as detail 1.
  const dbl = await (await page.$('#fe-tbody a[href$="readme.md"]')).boundingBox();
  await page.mouse.move(dbl.x + 5, dbl.y + dbl.height / 2);
  await page.mouse.down({ clickCount: 1 }); await page.mouse.up({ clickCount: 1 });
  await page.mouse.down({ clickCount: 2 }); await page.mouse.up({ clickCount: 2 });
  await page.waitForSelector('#fe.fe-file-page', { timeout: 5_000 }).catch(() => null);
  check(page.url().endsWith('/readme.md'), `double-click goes to the file page: ${page.url()}`);
  await page.goto(urlHere, { waitUntil: 'load' });
  await page.waitForSelector('#fe');

  // Saved folders: legacy keys merge once; star, name, tag, colour, persist.
  await page.evaluate(fx => {
    localStorage.removeItem('bfb-saved-v1'); localStorage.removeItem('bfb-tags-v1');
    localStorage.setItem('bfb-bookmarks-v2', JSON.stringify([{ path: fx + '/nested/', label: 'nested' }, { path: '/tmp/', label: 'tmp' }]));
    localStorage.setItem('bfb-places-v1', JSON.stringify([{ path: fx + '/nested/', label: 'Nested (named)' }]));
  }, h.fixture);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe');
  const savedLabels = () => page.$$eval('#fe-sv-list .fe-pl-label', els => els.map(e => e.textContent));
  let labels = await savedLabels();
  check(labels.length === 2 && labels[0] === 'Nested (named)' && labels[1] === 'tmp', `legacy merged into Saved: ${JSON.stringify(labels)}`);
  const sections = await page.$$eval('#fe-side .fe-sh', els => els.map(e => e.textContent.trim().split('\n')[0].trim()));
  check(!sections.some(s => /Bookmarks|My Places/.test(s)) && sections.some(s => s.startsWith('Saved')), `sidebar sections: ${JSON.stringify(sections)}`);

  await page.click('#fe-bm-btn');
  labels = await savedLabels();
  const starOn = await page.$eval('#fe-bm-btn', el => el.classList.contains('on'));
  check(labels.length === 3 && starOn, `star saved the current folder: ${JSON.stringify(labels)}`);
  // Drag reorders: the tmp row dropped on the first row moves to the front.
  const dragTo = (srcSel, dstSel) => page.evaluate((s, d) => {
    const src = document.querySelector(s), dst = document.querySelector(d);
    const dt = new DataTransfer();
    src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
    dst.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
    dst.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    src.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
  }, srcSel, dstSel);
  await dragTo('#fe-sv-list .fe-pl-item[data-path="/tmp/"]', '#fe-sv-list .fe-pl-item:first-child');
  labels = await savedLabels();
  check(labels[0] === 'tmp' && labels.length === 3, `drag reorders the Saved list: ${JSON.stringify(labels)}`);

  const tagBtn = await page.$('#fe-sv-list .fe-pl-item[data-path$="/nested/"] .fe-tag-btn');
  await tagBtn.evaluate(el => el.click());
  await page.keyboard.type('Work, code');
  await page.keyboard.press('Enter');
  const tagState = await page.evaluate(() => ({
    heads: [...document.querySelectorAll('#fe-sv-list .fe-sv-tag')].map(h => h.textContent.trim()),
    dotColor: document.querySelector('#fe-sv-list .fe-sv-dot')?.style.background,
    minis: document.querySelectorAll('#fe-sv-list .fe-pl-item[data-path$="/nested/"] .fe-sv-mini').length,
    stored: JSON.parse(localStorage.getItem('bfb-saved-v1')).find(p => p.path.endsWith('/nested/')).tags,
  }));
  check(tagState.heads.join() === 'work' && tagState.minis === 2 && JSON.stringify(tagState.stored) === '["work","code"]',
    `tags applied and grouped: ${JSON.stringify(tagState)}`);
  const c1 = tagState.dotColor;
  await page.click('#fe-sv-list .fe-sv-dot');
  const c2 = await page.$eval('#fe-sv-list .fe-sv-dot', el => el.style.background);
  check(c1 && c2 && c1 !== c2, `tag colour cycles ${c1} → ${c2}`);

  // The filter box narrows the list to matches; a tag name leaves only its group.
  await page.click('#fe-sv-filter');
  await page.type('#fe-sv-filter', 'work');
  const narrowed = await page.evaluate(() => ({
    labels: [...document.querySelectorAll('#fe-sv-list .fe-pl-label')].map(e => e.textContent),
    heads: [...document.querySelectorAll('#fe-sv-list .fe-sv-tag')].map(h => h.textContent.trim()),
  }));
  check(narrowed.labels.join() === 'Nested (named)' && narrowed.heads.join() === 'work', `typing a tag name shows only that group: ${JSON.stringify(narrowed)}`);
  await shot(page, 'saved-filtered');
  await page.keyboard.press('Escape');
  const widened = await savedLabels();
  check(widened.length === 3 && await page.$eval('#fe-sv-filter', el => el.value) === '', `Escape clears the box and the full list returns: ${JSON.stringify(widened)}`);
  await shot(page, 'saved-sidebar');

  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe');
  const savedAfter = await page.evaluate(() => ({
    labels: [...document.querySelectorAll('#fe-sv-list .fe-pl-label')].map(e => e.textContent),
    heads: [...document.querySelectorAll('#fe-sv-list .fe-sv-tag')].map(h => h.textContent.trim()),
    dot: document.querySelector('#fe-sv-list .fe-sv-dot')?.style.background,
  }));
  check(savedAfter.labels.length === 3 && savedAfter.heads.join() === 'work' && savedAfter.dot === c2, `saved state persists: ${JSON.stringify(savedAfter)}`);

  // Sidebar rows are bookmarks: a click switches to the strip tab that holds
  // the place, or keeps a new one, and goes there; alt keeps a background tab.
  await page.evaluate(fx => {
    const l = JSON.parse(localStorage.getItem('bfb-saved-v1') || '[]');
    l.push({ path: fx + '/readme.md', label: 'Readme file' });
    localStorage.setItem('bfb-saved-v1', JSON.stringify(l));
  }, h.fixture);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe');
  const urlSide = page.url();
  await page.keyboard.down('Alt');
  await page.click('#fe-sv-list .fe-pl-item[data-path$="/nested/"] .fe-si-link');
  await page.keyboard.up('Alt');
  await page.waitForFunction(() => document.querySelectorAll('#fe-tabs .fe-tab:not(.temp)').length === 1, { timeout: 3_000 }).catch(() => null);
  await page.keyboard.down('Alt');
  await page.click('#fe-bc .fe-crumb');
  await page.keyboard.up('Alt');
  await page.waitForFunction(() => document.querySelectorAll('#fe-tabs .fe-tab:not(.temp)').length === 2, { timeout: 3_000 }).catch(() => null);
  let sideTabs = await stripLabels();
  check(sideTabs.join('|') === 'nested|/|~' + h.fixture.split('/').pop() && page.url() === urlSide, `alt-click on a saved row and on a crumb keep background tabs, URL unchanged: ${JSON.stringify(sideTabs)}`);
  const dds = await page.$$('#fe-bc .fe-crumb-dd');
  await dds[dds.length - 1].click();
  await page.waitForSelector('#fe-crumb-menu .fe-dd-item', { timeout: 5_000 }).catch(() => null);
  await page.keyboard.down('Alt');
  await page.click('#fe-crumb-menu .fe-dd-item[href$="code.py"]');
  await page.keyboard.up('Alt');
  await page.waitForFunction(() => document.querySelectorAll('#fe-tabs .fe-tab:not(.temp)').length === 3, { timeout: 3_000 }).catch(() => null);
  await page.keyboard.press('Escape');
  sideTabs = await stripLabels();
  check(sideTabs.join('|') === 'nested|/|code.py|~' + h.fixture.split('/').pop() && page.url() === urlSide, `alt-click on a crumb-dropdown item keeps a background tab, URL unchanged: ${JSON.stringify(sideTabs)}`);
  await page.click('#fe-sv-list .fe-pl-item[data-path$="/nested/"] .fe-si-link');
  await page.waitForFunction(() => location.pathname.endsWith('/nested/'), { timeout: 5_000 }).catch(() => null);
  await page.waitForSelector('#fe');
  sideTabs = await stripLabels();
  const onLabel = () => page.$eval('#fe-tabs .fe-tab.on .fe-tab-lbl', el => el.textContent);
  check(page.url().endsWith('/nested/') && sideTabs.join('|') === 'nested|/|code.py' && await onLabel() === 'nested', `click on a saved folder switches to its open tab, no duplicate: ${JSON.stringify(sideTabs)}`);
  await page.click('#fe-sv-list .fe-pl-item[data-path$="/readme.md"] .fe-si-link');
  await page.waitForSelector('#fe.fe-file-page', { timeout: 5_000 }).catch(() => null);
  sideTabs = await stripLabels();
  check(page.url().endsWith('/readme.md') && sideTabs.join('|') === 'nested|readme.md|/|code.py' && await onLabel() === 'readme.md', `click on a saved file opens it as a new kept tab and goes there: ${JSON.stringify(sideTabs)}`);
  await page.evaluate(() => {
    const l = JSON.parse(localStorage.getItem('bfb-saved-v1') || '[]').filter(p => !p.path.endsWith('/readme.md'));
    localStorage.setItem('bfb-saved-v1', JSON.stringify(l));
  });
  await page.goto(urlSide, { waitUntil: 'load' });
  await page.waitForSelector('#fe');
  for (let i = 4; i > 0; i--) {
    await page.click('#fe-tabs .fe-tab[data-id] .fe-tab-x');
    await page.waitForFunction(n => document.querySelectorAll('#fe-tabs .fe-tab:not(.temp)').length === n, { timeout: 3_000 }, i - 1).catch(() => null);
  }

  // Notes: the folder from Settings lists, a new note saves to disk under its
  // title, rename and delete reach the folder, the panel closes on Esc.
  await page.evaluate(dir => {
    const s = JSON.parse(localStorage.getItem('bfb-settings-v1') || '{}');
    s.notesRoot = dir; localStorage.setItem('bfb-settings-v1', JSON.stringify(s));
  }, h.notesDir);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe');
  await page.waitForSelector('#fe-nt-list .fe-nt-item', { timeout: 8_000 }).catch(() => null);
  const noteRows = await page.$$eval('#fe-nt-list .fe-nt-label', els => els.map(e => e.textContent));
  check(noteRows.length === 1 && noteRows[0] === 'existing note', `Notes section lists the folder: ${JSON.stringify(noteRows)}`);

  await page.keyboard.press('n');
  await page.waitForSelector('#fe-ed-src', { timeout: 8_000 }).catch(() => null);
  const editorUp = await page.$('#fe-ed-src');
  check(!!editorUp, 'n opens a new note in the editor');
  await page.evaluate(() => {
    const ta = document.getElementById('fe-ed-src');
    ta.value = '# Grocery list\n\n- eggs\n- milk\n';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForFunction(() => document.querySelectorAll('#fe-ed-view li').length === 2, { timeout: 3_000 }).catch(() => null);
  const previewLi = await page.$$eval('#fe-ed-view li', els => els.map(e => e.textContent));
  check(previewLi.join() === 'eggs,milk', `live render beside the textarea: ${JSON.stringify(previewLi)}`);
  await page.keyboard.down('Meta'); await page.keyboard.press('s'); await page.keyboard.up('Meta');
  await page.waitForFunction(() => /saved \d/.test(document.getElementById('fe-ql-meta').textContent), { timeout: 8_000 }).catch(() => null);
  const savedMeta = await page.$eval('#fe-ql-meta', el => el.textContent);
  const onDisk = existsSync(join(h.notesDir, 'grocery-list.md')) ? readFileSync(join(h.notesDir, 'grocery-list.md'), 'utf8') : null;
  check(/grocery-list\.md · saved/.test(savedMeta) && onDisk && onDisk.includes('- milk') && !/untitled/.test(onDisk.split('\n')[1] || ''),
    `Cmd+S wrote grocery-list.md from the title: meta "${savedMeta}", disk ${onDisk ? onDisk.length + ' bytes' : 'missing'}`);
  await shot(page, 'notes-editor');

  // Editor ergonomics: line move, list continuation, table insert, image paste.
  const setCaret = (line, col = 0) => page.evaluate((l, c) => {
    const ta = document.getElementById('fe-ed-src');
    const lines = ta.value.split('\n');
    const pos = lines.slice(0, l).reduce((n, s) => n + s.length + 1, 0) + c;
    ta.setSelectionRange(pos, pos); ta.focus();
  }, line, col);
  await setCaret(2);   // "- eggs"
  await page.keyboard.down('Alt'); await page.keyboard.press('ArrowDown'); await page.keyboard.up('Alt');
  let src = await page.$eval('#fe-ed-src', el => el.value);
  check(src.split('\n').slice(2, 4).join('|') === '- milk|- eggs', `Alt+Down moved the line: ${JSON.stringify(src.split('\n').slice(2, 4))}`);
  await setCaret(3, 6);   // end of "- eggs"
  await page.keyboard.press('Enter');
  await page.keyboard.type('bread');
  src = await page.$eval('#fe-ed-src', el => el.value);
  check(src.includes('- eggs\n- bread'), `Enter continued the bullet list: ${JSON.stringify(src.split('\n').slice(2, 5))}`);
  await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
  await page.evaluate(() => document.querySelector('#fe-ed-bar [data-act="table"]').dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
  await page.waitForFunction(() => document.querySelectorAll('#fe-ed-view table').length === 1, { timeout: 3_000 }).catch(() => null);
  const tableCells = await page.$$eval('#fe-ed-view table th', els => els.map(e => e.textContent));
  check(tableCells.join() === 'Column 1,Column 2', `table inserted and rendered: ${JSON.stringify(tableCells)}`);
  await page.evaluate(() => {
    const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));
    const file = new File([bytes], 'dot.png', { type: 'image/png' });
    const dt = new DataTransfer(); dt.items.add(file);
    document.getElementById('fe-ed-src').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await page.waitForFunction(() => /!\[dot\]\(attachments\//.test(document.getElementById('fe-ed-src').value), { timeout: 8_000 }).catch(() => null);
  src = await page.$eval('#fe-ed-src', el => el.value);
  const attDir = join(h.notesDir, 'attachments');
  const attFiles = existsSync(attDir) ? readdirSync(attDir) : [];
  await page.waitForFunction(() => !!document.querySelector('#fe-ed-view img'), { timeout: 3_000 }).catch(() => null);
  const imgShown = await page.$eval('#fe-ed-view img', el => el.getAttribute('src')).catch(() => null);
  check(/!\[dot\]\(attachments\/grocery-list-[a-z0-9]+\.png\)/.test(src) && attFiles.length === 1 && attFiles[0].endsWith('.png') && !!imgShown,
    `pasted image saved to attachments and rendered: ${JSON.stringify(attFiles)} src=${imgShown}`);
  await shot(page, 'notes-editor-rich');
  // Editor keys: ⌘B wraps the selection, ⌘Z undoes it, Tab and ⇧Tab indent a line.
  await page.evaluate(() => {
    const ta = document.getElementById('fe-ed-src');
    const i = ta.value.indexOf('milk');
    ta.setSelectionRange(i, i + 4); ta.focus();
  });
  await page.keyboard.down('Meta'); await page.keyboard.press('b'); await page.keyboard.up('Meta');
  const bolded = await page.$eval('#fe-ed-src', el => el.value.includes('**milk**'));
  await page.keyboard.down('Meta'); await page.keyboard.press('z'); await page.keyboard.up('Meta');
  const unbolded = await page.$eval('#fe-ed-src', el => !el.value.includes('**milk**') && el.value.includes('milk'));
  check(bolded && unbolded, `⌘B wraps the selection in ** and ⌘Z undoes it: bold=${bolded} undo=${unbolded}`);
  await setCaret(2, 0);
  await page.keyboard.press('Tab');
  const indented = await page.$eval('#fe-ed-src', el => el.value.split('\n')[2]);
  await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift');
  const outdented = await page.$eval('#fe-ed-src', el => el.value.split('\n')[2]);
  check(indented === '  - milk' && outdented === '- milk', `Tab indents the line and ⇧Tab outdents: ${JSON.stringify([indented, outdented])}`);
  await page.keyboard.down('Meta'); await page.keyboard.press('s'); await page.keyboard.up('Meta');
  await page.waitForFunction(() => /saved \d/.test(document.getElementById('fe-ql-meta').textContent), { timeout: 8_000 }).catch(() => null);

  // Another program changes the file on disk: the next save shows the conflict
  // banner instead of overwriting, and Reload from disk takes the disk text.
  await new Promise(r => setTimeout(r, 60));
  writeFileSync(join(h.notesDir, 'grocery-list.md'), '# Grocery list\n\n- changed elsewhere\n');
  await page.evaluate(() => {
    const ta = document.getElementById('fe-ed-src');
    ta.value += '\n- butter\n';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.keyboard.down('Meta'); await page.keyboard.press('s'); await page.keyboard.up('Meta');
  await page.waitForSelector('#fe-ed-conflict', { timeout: 8_000 }).catch(() => null);
  const bannerUp = !!(await page.$('#fe-ed-conflict'));
  const stillOnDisk = readFileSync(join(h.notesDir, 'grocery-list.md'), 'utf8');
  check(bannerUp && stillOnDisk.includes('changed elsewhere') && !stillOnDisk.includes('butter'), `a note changed on disk shows the conflict banner and is not overwritten: banner=${bannerUp}`);
  await page.click('#fe-ed-reload');
  await page.waitForFunction(() => !document.getElementById('fe-ed-conflict') && document.getElementById('fe-ed-src').value.includes('changed elsewhere'), { timeout: 8_000 }).catch(() => null);
  const afterReload = await page.$eval('#fe-ed-src', el => el.value);
  check(afterReload.includes('changed elsewhere') && !afterReload.includes('butter') && !(await page.$('#fe-ed-conflict')), `Reload from disk replaces the editor text and clears the banner`);

  await page.keyboard.press('Escape');
  const edClosed = await page.$eval('#fe-qlook', el => el.style.display === 'none');
  check(edClosed, 'Esc closes the editor');
  await page.waitForFunction(() => document.querySelectorAll('#fe-nt-list .fe-nt-item').length === 2, { timeout: 8_000 }).catch(() => null);
  const listAfter = await page.$$eval('#fe-nt-list .fe-nt-label', els => els.map(e => e.textContent));
  check(listAfter[0] === 'grocery list' && listAfter.length === 2, `sidebar lists the new note first: ${JSON.stringify(listAfter)}`);
  await page.keyboard.down('Alt');
  await page.click('#fe-nt-list .fe-nt-item[data-rel="grocery-list.md"] .fe-si-link');
  await page.keyboard.up('Alt');
  await page.waitForFunction(() => document.querySelectorAll('#fe-tabs .fe-tab:not(.temp)').length === 1, { timeout: 3_000 }).catch(() => null);
  const noteTab = await stripLabels();
  check(noteTab[0] === 'grocery-list.md' && await page.$eval('#fe-qlook', el => el.style.display === 'none'), `alt-click on a note keeps a background tab without opening the editor: ${JSON.stringify(noteTab)}`);
  await page.click('#fe-tabs .fe-tab[data-id] .fe-tab-x');
  await page.waitForFunction(() => document.querySelectorAll('#fe-tabs .fe-tab:not(.temp)').length === 0, { timeout: 3_000 }).catch(() => null);

  await (await page.$('#fe-nt-list .fe-nt-item[data-rel="grocery-list.md"] .fe-rm-btn')).evaluate(el => el.click());
  await page.waitForFunction(() => document.querySelectorAll('#fe-nt-list .fe-nt-item').length === 1, { timeout: 8_000 }).catch(() => null);
  const trashed = existsSync(join(h.notesDir, '.trash')) ? readdirSync(join(h.notesDir, '.trash')) : [];
  check(trashed.length === 1 && trashed[0].endsWith('grocery-list.md') && !existsSync(join(h.notesDir, 'grocery-list.md')), `delete moved the note to .trash: ${JSON.stringify(trashed)}`);
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('bfb-settings-v1') || '{}');
    delete s.notesRoot; localStorage.setItem('bfb-settings-v1', JSON.stringify(s));
  });

  // File pages: a file opened directly renders with our shell, ToC, raw
  // toggle, and re-renders when the file changes on disk.
  const fpage = await h.browser.newPage();
  fpage.on('pageerror', e => console.error('[pageerror]', e.message));
  await fpage.goto('file://' + h.fixture + '/readme.md', { waitUntil: 'load' });
  await fpage.waitForSelector('#fe.fe-file-page', { timeout: 8_000 }).catch(() => null);
  const fp = await fpage.evaluate(() => ({
    shell: !!document.querySelector('#fe.fe-file-page'),
    h1: document.querySelector('#fe-page .fe-md h1')?.textContent,
    h1id: document.querySelector('#fe-page .fe-md h1')?.id,
    toc: getComputedStyle(document.getElementById('fe-toc')).display,
    crumb: document.querySelector('#fe-bc .fe-crumb-file')?.textContent,
    title: document.title,
  }));
  check(fp.shell && fp.h1 === 'Fixture' && fp.h1id === 'fixture' && fp.crumb === 'readme.md', `file page renders markdown: ${JSON.stringify(fp)}`);
  // One shell: the bar, the sidebar and the strip sit exactly where the listing puts them.
  const shellOf = p => p.evaluate(() => {
    const r = id => { const b = document.getElementById(id).getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; };
    return { bar: r('fe-bar'), side: r('fe-side'), tabs: r('fe-tabs'), status: r('fe-statusbar') };
  });
  const shellListing = await shellOf(page);
  const shellFile = await shellOf(fpage);
  check(JSON.stringify(shellListing) === JSON.stringify(shellFile), `file page keeps the listing's shell in place: listing ${JSON.stringify(shellListing)} file ${JSON.stringify(shellFile)}`);
  const width = await fpage.evaluate(() => {
    const md = document.querySelector('#fe-page .fe-md').getBoundingClientRect();
    const pane = document.getElementById('fe-page').getBoundingClientRect();
    return { md: Math.round(md.right), pane: Math.round(pane.right), strip: !!document.querySelector('#fe-tabs .fe-tab.temp') };
  });
  check(width.md >= width.pane - 1 && width.strip, `file page fills the pane width and shows the strip: ${JSON.stringify(width)}`);
  // Markdown viewer: front matter block, task boxes, code chip with copy,
  // table in a scroll wrap, heading anchors, the reading column toggle.
  const mdBits = await fpage.evaluate(() => ({
    fm: [...document.querySelectorAll('#fe-page .fe-md-fm dt')].map(d => d.textContent),
    tasks: [...document.querySelectorAll('#fe-page li.fe-task input')].map(i => i.checked),
    chip: document.querySelector('#fe-page .fe-md-lang')?.textContent,
    copy: !!document.querySelector('#fe-page .fe-md-copy'),
    wrap: !!document.querySelector('#fe-page .fe-md-tablewrap table'),
    anchor: document.querySelector('#fe-page h1 .fe-md-anchor')?.getAttribute('href'),
    size: getComputedStyle(document.querySelector('#fe-page .fe-md')).fontSize,
  }));
  check(mdBits.fm.join() === 'title,tags' && mdBits.tasks.join() === 'true,false' && mdBits.chip === 'js' && mdBits.copy && mdBits.wrap && mdBits.anchor === '#fixture' && mdBits.size === '15px',
    `markdown viewer renders front matter, tasks, code chip, table wrap, anchors at 15px: ${JSON.stringify(mdBits)}`);
  await fpage.click('#fe-fp-column');
  const widths = () => fpage.evaluate(() => ({
    md: Math.round(document.querySelector('#fe-page .fe-md').getBoundingClientRect().width),
    page: Math.round(document.getElementById('fe-page').getBoundingClientRect().width),
    on: document.getElementById('fe-fp-column').classList.contains('on'),
  }));
  const colOn = await widths();
  await fpage.reload({ waitUntil: 'load' });
  await fpage.waitForSelector('#fe.fe-file-page', { timeout: 8_000 }).catch(() => null);
  const colKept = await widths();
  await fpage.click('#fe-fp-column');
  const colOff = await widths();
  check(colOn.md < colOn.page - 100 && colKept.on && colKept.md === colOn.md && !colOff.on && colOff.md === colOff.page,
    `reading column narrows the text, survives a reload, and toggles back to full width: ${JSON.stringify({ colOn, colKept, colOff })}`);
  const longMd = ['---', 'title: Long', '---', ...Array.from({ length: 30 }, (_, i) => `## Section ${i + 1}\n\n${'lorem ipsum '.repeat(40)}\n`)].join('\n');
  const longPath = join(tmpdir(), `bfb-long-${process.pid}.md`);   // outside the fixture, so listing counts hold
  writeFileSync(longPath, longMd);
  await fpage.goto('file://' + longPath, { waitUntil: 'load' });
  await fpage.waitForSelector('#fe.fe-file-page', { timeout: 8_000 }).catch(() => null);
  const spied = await fpage.evaluate(() => {
    const page = document.getElementById('fe-page');
    const h = document.getElementById('section-12');
    page.scrollTop = h.offsetTop - page.offsetTop + 10;
    page.dispatchEvent(new Event('scroll'));
    return { on: document.querySelector('#fe-toc a.on')?.dataset.id, rows: document.querySelectorAll('#fe-toc a').length, tocShown: getComputedStyle(document.getElementById('fe-toc')).display !== 'none' };
  });
  check(spied.on === 'section-12' && spied.rows === 30 && spied.tocShown, `ToC follows the scroll: ${JSON.stringify(spied)}`);
  await fpage.click('#fe-fp-toc');
  const tocHidden = await fpage.evaluate(() => getComputedStyle(document.getElementById('fe-toc')).display === 'none');
  await fpage.click('#fe-fp-toc');
  check(tocHidden, 'the toc button hides the rail');
  await shot(fpage, 'file-page-long');
  await fpage.goto('file://' + h.fixture + '/readme.md', { waitUntil: 'load' });
  await fpage.waitForSelector('#fe.fe-file-page', { timeout: 8_000 }).catch(() => null);
  await fpage.setViewport({ width: 1800, height: 900 });
  const wide = await fpage.evaluate(() => {
    const r = document.getElementById('fe').getBoundingClientRect();
    return { html: getComputedStyle(document.documentElement).backgroundColor, body: getComputedStyle(document.body).backgroundColor,
      fe: getComputedStyle(document.getElementById('fe')).backgroundColor, covers: r.width === innerWidth && r.height === innerHeight };
  });
  check(wide.covers && wide.html === wide.fe && wide.body === wide.fe, `at 1800 wide the page background is the theme's and #fe covers the viewport: ${JSON.stringify(wide)}`);
  await shot(fpage, 'file-page-wide');
  await fpage.setViewport({ width: 1400, height: 900 });
  await fpage.click('#fe-fp-raw');
  const rawOn = await fpage.evaluate(() => !!document.querySelector('#fe-page .fe-code') && document.querySelector('#fe-page .fe-code').textContent.includes('# Fixture'));
  check(rawOn, 'raw toggle shows the source');
  await fpage.keyboard.press('r');
  writeFileSync(join(h.fixture, 'readme.md'), '# Fixture\n\n## Added later\n\nnew paragraph\n');
  await fpage.waitForFunction(() => !!document.querySelector('#fe-page .fe-md h2'), { timeout: 6_000 }).catch(() => null);
  const reloaded = await fpage.evaluate(() => ({
    h2: document.querySelector('#fe-page .fe-md h2')?.textContent,
    tocLinks: [...document.querySelectorAll('#fe-toc a')].map(a => a.textContent),
    tocShown: getComputedStyle(document.getElementById('fe-toc')).display !== 'none',
    status: document.getElementById('fe-fp-reload').textContent,
  }));
  check(reloaded.h2 === 'Added later' && reloaded.tocShown && reloaded.tocLinks.join() === 'Fixture,Added later' && /reloaded/.test(reloaded.status),
    `autoreload re-rendered with a ToC: ${JSON.stringify(reloaded)}`);
  await shot(fpage, 'file-page-md');
  await fpage.goto('file://' + h.fixture + '/code.py', { waitUntil: 'load' });
  await fpage.waitForSelector('#fe.fe-file-page', { timeout: 8_000 }).catch(() => null);
  const codePage = await fpage.evaluate(() => ({
    gutter: document.querySelector('#fe-page .fe-code-gut')?.textContent.trim().split('\n').length,
    kw: !!document.querySelector('#fe-page .fe-code span'),
  }));
  check(codePage.gutter === 3 && codePage.kw, `code page has a gutter and highlighting: ${JSON.stringify(codePage)}`);
  await shot(fpage, 'file-page-code');
  await fpage.close();
  await page.bringToFront();

  // Dialogs: Help and Settings share one chrome. A title row with a mark and
  // a subtitle, a tab strip, one pane shown at a time; the chrome holds still
  // while a pane scrolls; Esc closes.
  for (const [btn, id, count, shotName] of [['#fe-help-btn', 'fe-help-modal', 4, 'help-dialog'], ['#fe-settings-btn', 'fe-settings-modal', 5, 'settings-dialog']]) {
    await page.click(btn);
    await page.waitForFunction(i => document.getElementById(i).style.display !== 'none', { timeout: 3_000 }, id).catch(() => null);
    const d = await page.evaluate(i => {
      const root = document.getElementById(i);
      return {
        open: root.style.display !== 'none', title: root.querySelector('.fe-dlg-tx b')?.textContent,
        subtitle: !!root.querySelector('.fe-dlg-tx i')?.textContent, mark: !!root.querySelector('.fe-dlg-mark svg'),
        tabs: [...root.querySelectorAll('.fe-dlg-tab b')].map(b => b.textContent),
        shown: [...root.querySelectorAll('.fe-dlg-pane')].filter(p => getComputedStyle(p).display !== 'none').length,
      };
    }, id);
    check(d.open && d.mark && d.subtitle && d.tabs.length === count && d.shown === 1, `${d.title} dialog opens with a mark, a subtitle, ${count} tabs and one pane: ${JSON.stringify(d.tabs)}`);
    await page.click(`#${id} .fe-dlg-tab:nth-child(2)`);
    const sw = await page.evaluate(i => {
      const root = document.getElementById(i);
      const on = [...root.querySelectorAll('.fe-dlg-pane.on')];
      return { tab: root.querySelector('.fe-dlg-tab.on')?.dataset.tab, index: [...root.querySelectorAll('.fe-dlg-tab')].findIndex(t => t.classList.contains('on')), pane: on[0]?.dataset.tab, count: on.length };
    }, id);
    check(sw.index === 1 && sw.pane === sw.tab && sw.count === 1, `${d.title}: the second tab shows its pane alone: ${JSON.stringify(sw)}`);
    if (id === 'fe-settings-modal') await page.setViewport({ width: 1400, height: 520 });   // short enough that a Settings pane overflows
    const scrolled = await page.evaluate(i => {
      const root = document.getElementById(i);
      const tabs = [...root.querySelectorAll('.fe-dlg-tab')];
      for (const t of tabs) {
        t.click();
        const pane = root.querySelector('.fe-dlg-pane.on');
        if (pane.scrollHeight > pane.clientHeight + 4) {
          const title = root.querySelector('.fe-dlg-title').getBoundingClientRect().top;
          const strip = root.querySelector('.fe-dlg-tabs').getBoundingClientRect().top;
          pane.scrollTop = 300;
          const after = { title: root.querySelector('.fe-dlg-title').getBoundingClientRect().top, strip: root.querySelector('.fe-dlg-tabs').getBoundingClientRect().top };
          return { tab: t.dataset.tab, scrollTop: pane.scrollTop, held: title === after.title && strip === after.strip };
        }
      }
      return null;
    }, id);
    check(scrolled && scrolled.scrollTop > 0 && scrolled.held, `${d.title}: the chrome holds still while the ${scrolled?.tab} pane scrolls: ${JSON.stringify(scrolled)}`);
    await page.setViewport({ width: 1400, height: 900 });
    await page.click(`#${id} .fe-dlg-tab:nth-child(2)`);
    await new Promise(r => setTimeout(r, 250));   // let the tab transition settle before the shot
    await shot(page, shotName);
    await page.keyboard.press('Escape');
    const closed = await page.evaluate(i => document.getElementById(i).style.display === 'none', id);
    check(closed, `${d.title}: Esc closes`);
  }

  // Tooltips: every control on every surface carries a title. Rows and tiles
  // use the custom hover tip instead, menu items are their own label.
  const SWEEP = 'button, a[href], input:not([type="hidden"]), select, [role="tab"], th[data-sort], .fe-crumb-dd, .fe-sv-dot';
  const sweep = surface => page.evaluate((sel, surface) => {
    const out = [];
    const seen = new Set();
    for (const el of document.querySelectorAll(sel)) {
      if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') continue;
      if (el.matches('.fe-lnk, .fe-tile, .fe-ctx-item') || el.closest('.fe-md, [data-tip]')) continue;
      if (el.title || el.getAttribute('aria-label')) continue;
      const key = el.id ? '#' + el.id : el.tagName.toLowerCase() + '.' + [...el.classList].join('.');
      if (!seen.has(key)) { seen.add(key); out.push(`${surface}: ${key}`); }
    }
    return out;
  }, SWEEP, surface);
  const missing = [];
  missing.push(...await sweep('listing'));
  for (const v of ['list', 'tiles', 'icons']) { await page.evaluate(v => document.querySelector(`.fe-view-btn[data-view="${v}"]`).click(), v); missing.push(...await sweep(`view ${v}`)); }
  await page.evaluate(() => document.querySelector('.fe-view-btn[data-view="details"]').click());
  await page.click('#fe-sg-btn'); missing.push(...await sweep('sort panel')); await page.click('#fe-sg-btn');
  await page.click('#fe-filter-btn'); missing.push(...await sweep('filter panel')); await page.click('#fe-filter-btn');
  await page.click('#fe-tbody a[href$="readme.md"]');
  await page.waitForSelector('#fe-ql-body h1', { timeout: 5_000 }).catch(() => null);
  missing.push(...await sweep('preview'));
  await page.keyboard.press('Escape');
  await page.click('#fe-bc .fe-crumb-dd'); await new Promise(r => setTimeout(r, 400)); missing.push(...await sweep('crumb dropdown')); await page.keyboard.press('Escape');
  await page.click('#fe-help-btn'); missing.push(...await sweep('help')); await page.keyboard.press('Escape');
  await page.click('#fe-settings-btn');
  for (let i = 1; i <= 5; i++) { await page.click(`#fe-settings-modal .fe-dlg-tab:nth-child(${i})`); missing.push(...await sweep(`settings ${i}`)); }
  await page.keyboard.press('Escape');
  const fpage2 = await h.browser.newPage();
  await fpage2.goto('file://' + h.fixture + '/readme.md', { waitUntil: 'load' });
  await fpage2.waitForSelector('#fe.fe-file-page', { timeout: 8_000 }).catch(() => null);
  missing.push(...await fpage2.evaluate((sel) => {
    const out = [];
    for (const el of document.querySelectorAll(sel)) if (el.offsetParent && !el.closest('.fe-md') && !el.title) out.push('file page: ' + (el.id ? '#' + el.id : el.className));
    return out;
  }, SWEEP));
  await fpage2.close();
  await page.bringToFront();
  check(missing.length === 0, `every control carries a title (${missing.length} missing)${missing.length ? ': ' + missing.join(', ') : ''}`);

  // Tabs: state lives with this Chrome tab and survives a refresh, a file is
  // a tab too, p pins, the hover menu closes others, and the address bar is
  // the active tab's URL after every action. A closed Chrome tab's strip
  // comes back in a fresh one with an undo.
  const tabLabels = p => p.$$eval('#fe-tabs .fe-tab', els => els.map(e =>
    (e.classList.contains('temp') ? '~' : '') + (e.classList.contains('pinned') ? '*' : '') + e.querySelector('.fe-tab-lbl').textContent));
  const keptCount = n => `document.querySelectorAll('#fe-tabs .fe-tab:not(.temp)').length === ${n}`;
  const barIsActiveTab = p => p.evaluate(() => {
    const on = document.querySelector('#fe-tabs .fe-tab.on');
    return !!on && decodeURIComponent(new URL(on.href).pathname) === decodeURIComponent(location.pathname);
  });
  await page.bringToFront();
  await page.keyboard.press('Escape');
  let tabsA = await tabLabels(page);
  check(tabsA.length === 1 && tabsA[0].startsWith('~'), `fresh strip shows a temporary tab: ${JSON.stringify(tabsA)}`);
  await page.keyboard.press('t');
  await page.waitForFunction(keptCount(1), { timeout: 3_000 }).catch(() => null);
  tabsA = await tabLabels(page);
  check(tabsA.length === 1 && !tabsA[0].startsWith('~'), `t keeps the folder: ${JSON.stringify(tabsA)}`);

  await page.goto('file://' + h.fixture + '/nested/', { waitUntil: 'load' });
  await page.waitForSelector('#fe');
  await page.keyboard.press('t');
  await page.waitForFunction(keptCount(2), { timeout: 3_000 }).catch(() => null);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe');
  tabsA = await tabLabels(page);
  check(tabsA.length === 2 && tabsA[1] === 'nested' && await barIsActiveTab(page), `two tabs survive a refresh of this Chrome tab: ${JSON.stringify(tabsA)}`);
  // Drag reorders the strip; ⌘-click on a tab is Chrome's own new tab.
  await dragTo('#fe-tabs .fe-tab:nth-child(2)', '#fe-tabs .fe-tab:nth-child(1)');
  tabsA = await tabLabels(page);
  check(tabsA.join('|') === 'nested|' + h.fixture.split('/').pop(), `drag reorders the strip: ${JSON.stringify(tabsA)}`);
  const pagesPreCmd = (await h.browser.pages()).length;
  await page.keyboard.down('Meta');
  await page.click('#fe-tabs .fe-tab:nth-child(2)');
  await page.keyboard.up('Meta');
  await new Promise(r => setTimeout(r, 800));
  const pagesPostCmd = (await h.browser.pages()).length;
  check(pagesPostCmd === pagesPreCmd + 1 && page.url().endsWith('/nested/'), `⌘-click on a tab opens a Chrome tab and leaves this one (${pagesPreCmd} → ${pagesPostCmd})`);
  await page.bringToFront();
  await dragTo('#fe-tabs .fe-tab:nth-child(2)', '#fe-tabs .fe-tab:nth-child(1)');   // back to the original order for the steps below

  await page.goto('file://' + h.fixture + '/readme.md', { waitUntil: 'load' });
  await page.waitForSelector('#fe.fe-file-page');
  tabsA = await tabLabels(page);
  check(tabsA.length === 3 && tabsA[2] === '~readme.md', `the file page carries the strip with a temporary file tab: ${JSON.stringify(tabsA)}`);
  await page.keyboard.press('t');
  await page.waitForFunction(keptCount(3), { timeout: 3_000 }).catch(() => null);
  const fileTab = await page.evaluate(() => {
    const t = document.querySelector('#fe-tabs .fe-tab.on');
    return { icon: !!t.querySelector('.fe-tab-ico svg'), label: t.querySelector('.fe-tab-lbl').textContent, bar: true };
  });
  check(fileTab.icon && fileTab.label === 'readme.md' && await barIsActiveTab(page), `t keeps the file as a tab with the file icon: ${JSON.stringify(fileTab)}`);

  await page.keyboard.press('p');
  await page.waitForSelector('#fe-tabs .fe-tab.pinned', { timeout: 3_000 }).catch(() => null);
  const pinned = await page.evaluate(() => {
    const t = document.querySelector('#fe-tabs .fe-tab.pinned');
    return t && { first: document.querySelector('#fe-tabs .fe-tab') === t, closeBtn: !!t.querySelector('.fe-tab-x'), label: t.querySelector('.fe-tab-lbl').textContent };
  });
  check(pinned && pinned.first && !pinned.closeBtn && pinned.label === 'readme.md', `p pins the tab: first in the strip, no close button: ${JSON.stringify(pinned)}`);
  await shot(page, 'tabs');

  await page.keyboard.press('[');
  await page.waitForFunction(() => location.pathname.endsWith('/nested/'), { timeout: 5_000 }).catch(() => null);
  await page.waitForSelector('#fe');
  check(page.url().endsWith('/nested/') && await barIsActiveTab(page), `[ wraps to the last tab by real navigation: ${page.url()}`);

  await page.hover('#fe-tabs .fe-tab:nth-child(2)');
  await page.click('#fe-tabs .fe-tab:nth-child(2) .fe-tab-more');
  await page.waitForSelector('.fe-tab-menu[style*="block"]', { timeout: 3_000 }).catch(() => null);
  const menuItems = await page.$$eval('.fe-tab-menu .fe-ctx-item', els => els.map(e => e.firstChild.textContent));
  const rootSaved = await page.evaluate(fx => JSON.parse(localStorage.getItem('bfb-saved-v1') || '[]').some(p => p.path === fx + '/'), h.fixture);
  check(menuItems.join('|') === `Copy path|${rootSaved ? 'Unsave' : 'Save'}|Pin|Close|Close others`, `hover menu lists the tab actions and agrees with the star: ${JSON.stringify(menuItems)}`);
  await page.click('.fe-tab-menu [data-act="others"]');
  await page.waitForFunction(keptCount(2), { timeout: 3_000 }).catch(() => null);
  tabsA = await tabLabels(page);
  check(tabsA.length === 3 && tabsA[0] === '*readme.md' && tabsA[2] === '~nested' && page.url().endsWith('/nested/'),
    `close others keeps the pinned tab and the one picked; this folder is temporary again, URL unchanged: ${JSON.stringify(tabsA)}`);

  // Middle click closes a kept tab but never a pinned one; a double-click on
  // the current tab is not two switches.
  await page.keyboard.press('t');
  await page.waitForFunction(keptCount(3), { timeout: 3_000 }).catch(() => null);
  const pagesBefore = (await h.browser.pages()).length;
  await (await page.$('#fe-tabs .fe-tab:nth-child(1)')).click({ button: 'middle' });
  await new Promise(r => setTimeout(r, 300));
  tabsA = await tabLabels(page);
  check(tabsA.length === 3 && tabsA[0] === '*readme.md' && (await h.browser.pages()).length === pagesBefore, `middle click leaves a pinned tab alone and opens no Chrome tab: ${JSON.stringify(tabsA)}`);
  const onTab = await (await page.$('#fe-tabs .fe-tab.on')).boundingBox();
  await page.mouse.move(onTab.x + 20, onTab.y + onTab.height / 2);
  await page.mouse.down({ clickCount: 1 }); await page.mouse.up({ clickCount: 1 });
  await page.mouse.down({ clickCount: 2 }); await page.mouse.up({ clickCount: 2 });
  await new Promise(r => setTimeout(r, 300));
  tabsA = await tabLabels(page);
  check(page.url().endsWith('/nested/') && tabsA.length === 3 && (await h.browser.pages()).length === pagesBefore, `double-click on the current tab changes nothing: ${JSON.stringify(tabsA)} ${page.url()}`);
  await (await page.$('#fe-tabs .fe-tab:nth-child(2)')).click({ button: 'middle' });
  await page.waitForFunction(keptCount(2), { timeout: 3_000 }).catch(() => null);
  tabsA = await tabLabels(page);
  check(tabsA.join('|') === '*readme.md|nested' && page.url().endsWith('/nested/') && (await h.browser.pages()).length === pagesBefore, `middle click closes a kept tab, URL unchanged, no Chrome tab: ${JSON.stringify(tabsA)}`);

  await page.keyboard.press('w');
  await page.waitForFunction(() => !location.pathname.endsWith('/nested/'), { timeout: 5_000 }).catch(() => null);
  await page.waitForSelector('#fe');
  tabsA = await tabLabels(page);
  check(page.url().endsWith('/readme.md') && tabsA.length === 1 && await barIsActiveTab(page), `w closes the tab and navigates to its neighbour: ${JSON.stringify(tabsA)} ${page.url()}`);
  await page.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
  await page.waitForSelector('#fe');

  const pageB = await h.open(h.fixture + '/nested');
  await pageB.keyboard.press('t');
  await pageB.goto('file://' + h.fixture + '/nested/deeper/', { waitUntil: 'load' });
  await pageB.waitForSelector('#fe');
  await pageB.keyboard.press('t');
  await pageB.waitForFunction(keptCount(2), { timeout: 3_000 }).catch(() => null);
  await pageB.close();
  const pageC = await h.open(h.fixture + '/nested/deeper');
  await pageC.waitForFunction(keptCount(2), { timeout: 5_000 }).catch(() => null);
  const restored = { tabs: await tabLabels(pageC), toast: await pageC.$eval('#fe-toast', el => el.textContent), bar: await barIsActiveTab(pageC) };
  check(restored.tabs.join('|') === 'nested|deeper' && /Restored 2 tabs/.test(restored.toast) && restored.bar, `a closed Chrome tab's strip comes back in a fresh one: ${JSON.stringify(restored)}`);
  await shot(pageC, 'tabs-restored');
  await pageC.click('#fe-toast .fe-toast-act');
  await pageC.waitForFunction(keptCount(0), { timeout: 3_000 }).catch(() => null);
  const undone = await tabLabels(pageC);
  check(undone.length === 1 && undone[0] === '~deeper', `undo drops the restored strip: ${JSON.stringify(undone)}`);
  await pageC.close();
  await page.bringToFront();

  // Find: text inside files, held until re-run, saved as a view, reopened by hash.
  const rowNames = () => page.$$eval('#fe-tbody tr[data-idx]:not(.par) .fe-nm', els => els.map(e => e.textContent));
  await page.click('#fe-filter-btn');
  await page.click('#fe-find-text');
  await page.type('#fe-find-text', 'second');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => /^\d+ of \d+ files/.test(document.getElementById('fe-find-status').textContent), { timeout: 10_000 }).catch(() => null);
  let found = { status: await page.$eval('#fe-find-status', el => el.textContent), rows: await rowNames(), count: await page.$eval('#fe-count', el => el.textContent) };
  check(found.rows.join() === 'notes.txt' && /^1 of \d+ files$/.test(found.status) && /1 file containing "second"/.test(found.count), `text search narrows to the file containing it: ${JSON.stringify(found)}`);
  await page.click('#fe-find-save');
  const viewRow = await page.$eval('#fe-sv-list .fe-pl-item.fe-view .fe-pl-label', el => el.textContent).catch(() => null);
  check(viewRow === '"second"', `saved view row appears in Saved: ${viewRow}`);
  await shot(page, 'find-saved-view');
  await page.click('#fe-find-text');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelectorAll('#fe-tbody tr[data-idx]').length === 9, { timeout: 3_000 }).catch(() => null);
  check((await rowNames()).length === 8, 'Escape in the text field clears the held results');
  await page.click('#fe-sv-list .fe-pl-item.fe-view .fe-si-link');
  await page.waitForFunction(() => /^\d+ of \d+ files/.test(document.getElementById('fe-find-status').textContent) && document.querySelectorAll('#fe-tbody tr[data-idx]').length === 2, { timeout: 10_000 }).catch(() => null);
  found = { hash: await page.evaluate(() => location.hash.slice(0, 6)), rows: await rowNames() };
  check(found.hash === '#find=' && found.rows.join() === 'notes.txt', `saved view reopens through the hash: ${JSON.stringify(found)}`);
  await page.evaluate(() => { history.replaceState(null, '', location.pathname); });
  await page.click('#fe-find-text');
  await page.keyboard.press('Escape');
  await page.click('#fe-deep-btn');
  await page.waitForFunction(() => /items in \d+ folders/.test(document.getElementById('fe-count').textContent), { timeout: 10_000 }).catch(() => null);
  await page.click('#fe-find-text');
  await page.type('#fe-find-text', 'deep');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => /^\d+ of \d+ files/.test(document.getElementById('fe-find-status').textContent), { timeout: 10_000 }).catch(() => null);
  found = { rows: await rowNames(), status: await page.$eval('#fe-find-status', el => el.textContent) };
  check(found.rows.join() === 'nested/deeper/deepest.md', `deep text search reaches subfolders: ${JSON.stringify(found)}`);
  await page.click('#fe-find-text');
  await page.keyboard.press('Escape');
  await page.click('#fe-deep-btn');
  await page.click('#fe-filter-btn');

  // Deep search: the crawl adds subfolder entries with relative names.
  await page.click('#fe-deep-btn');
  await page.waitForFunction(() => /items in \d+ folders/.test(document.getElementById('fe-count').textContent), { timeout: 10_000 }).catch(() => null);
  const deepCount = await page.$eval('#fe-count', el => el.textContent);
  check(/^11 of 11 items in 3 folders$/.test(deepCount), `deep crawl status "${deepCount}"`);
  await page.type('#fe-search', 'deep');
  const deepRows = await page.$$eval('#fe-tbody tr[data-idx]:not(.par) .fe-nm', els => els.map(e => e.textContent));
  check(deepRows.length === 2 && deepRows.includes('nested/deeper/deepest.md') && deepRows.includes('nested/deeper'),
    `deep filter rows: ${JSON.stringify(deepRows)}`);
  await shot(page, 'deep-search');
  await (await page.$('#fe-tbody tr[data-idx]:has(a[href$="deepest.md"]) td:last-child')).click();
  await page.keyboard.press('Space');
  await page.waitForSelector('#fe-ql-body h1', { timeout: 5_000 }).catch(() => null);
  const deepH1 = await page.$eval('#fe-ql-body h1', el => el.textContent).catch(() => null);
  check(deepH1 === 'deep', `deep result previews: h1 "${deepH1}"`);
  await page.keyboard.press('Escape');
  await page.click('#fe-deep-btn');
  await page.$eval('#fe-search', el => { el.value = ''; el.dispatchEvent(new Event('input')); });
  const shallowRows = await page.$$eval('#fe-tbody tr[data-idx]', els => els.length);
  check(shallowRows === 9, `deep off restores ${shallowRows} rows`);

  // Tile views: no stretch under icons; the page background follows the theme.
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.querySelector('.fe-view-btn[data-view="icons"]').click());
  const tileRows = await page.$$eval('#fe-tiles .fe-tile', all => {
    const els = all.filter(e => e.offsetHeight > 0);   // hidden dotfile tiles are display:none
    const tops = [...new Set(els.map(e => e.offsetTop))];
    const hs = els.map(e => e.offsetHeight);
    return { rows: tops.length, maxH: Math.max(...hs), minH: Math.min(...hs) };
  });
  check(tileRows.maxH - tileRows.minH <= 40, `icon tiles keep their own height (rows=${tileRows.rows}, heights ${tileRows.minH}-${tileRows.maxH})`);
  await shot(page, 'view-icons');
  await page.evaluate(() => document.querySelector('.fe-view-btn[data-view="tiles"]').click());
  await shot(page, 'view-tiles');

  // Many long names: rows stay one tile tall with a tight gap, names clamp
  // to two lines, in both tile views at 1400 and 1735 wide.
  const many = join(h.fixture, 'many');
  mkdirSync(many, { recursive: true });
  for (let i = 0; i < 25; i++) writeFileSync(join(many, `a-rather-long-file-name-number-${i}-${'x'.repeat(i % 5 * 6)}.txt`), 'x');
  await page.goto('file://' + many + '/', { waitUntil: 'load' });
  await page.waitForSelector('#fe');
  for (const view of ['tiles', 'icons']) {
    for (const width of [1400, 1735]) {
      await page.setViewport({ width, height: 900 });
      await page.evaluate(v => document.querySelector(`.fe-view-btn[data-view="${v}"]`).click(), view);
      const m = await page.$$eval('#fe-tiles .fe-tile', all => {
        const els = all.filter(e => e.offsetHeight > 0);
        const tops = [...new Set(els.map(e => e.offsetTop))].sort((a, b) => a - b);
        const nm = els.map(e => e.querySelector('.fe-tile-nm').offsetHeight);
        return { rows: tops.length, pitch: tops[1] - tops[0], tileH: Math.max(...els.map(e => e.offsetHeight)), nameH: Math.max(...nm), lineH: parseFloat(getComputedStyle(els[0].querySelector('.fe-tile-nm')).lineHeight) };
      });
      check(m.pitch - m.tileH <= 6 && m.nameH <= m.lineH * 2 + 1, `${view} at ${width}: ${m.rows} rows, pitch ${m.pitch} for tiles ${m.tileH} tall, names ≤ 2 lines (${m.nameH})`);
      await shot(page, `view-${view}-${width}`);
    }
  }
  await page.setViewport({ width: 1400, height: 900 });
  await page.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
  await page.waitForSelector('#fe');
  await page.evaluate(() => document.querySelector('.fe-view-btn[data-view="tiles"]').click());
  const htmlBg = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
  const feBg = await page.$eval('#fe', el => getComputedStyle(el).backgroundColor);
  check(htmlBg === feBg, `html background matches the theme (${htmlBg} vs ${feBg})`);
  await page.evaluate(() => document.querySelector('.fe-view-btn[data-view="details"]').click());

  // Sort + view persist across a folder change and a reload.
  await page.click('th[data-sort="size"]');
  await page.click('th[data-sort="size"]');
  await page.click('.fe-view-btn[data-view="tiles"]');
  const readState = () => page.evaluate(() => ({
    view: document.getElementById('fe').dataset.view,
    sorted: document.querySelector('th.sorted')?.dataset.sort,
    arrow: document.querySelector('th.sorted .si')?.textContent,
    first: document.querySelector('#fe-tbody tr[data-idx]:not(:first-child) a')?.textContent.trim(),
  }));
  let st = await readState();
  check(st.sorted === 'size' && st.arrow === '↓' && st.view === 'tiles', `set size desc + tiles: ${JSON.stringify(st)}`);

  await page.goto('file://' + h.fixture + '/nested/', { waitUntil: 'load' });
  await page.waitForSelector('#fe');
  st = await readState();
  check(st.sorted === 'size' && st.arrow === '↓' && st.view === 'tiles', `after dir change: ${JSON.stringify(st)}`);

  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe');
  st = await readState();
  check(st.sorted === 'size' && st.arrow === '↓' && st.view === 'tiles', `after reload: ${JSON.stringify(st)}`);
  await shot(page, 'persisted-sort-view');

  // Reloading the extension orphans this page's content script. The preview
  // must say so and offer a refresh instead of a bare "Could not read file".
  await page.click('.fe-view-btn[data-view="details"]');
  const sw = await h.browser.waitForTarget(t => t.type() === 'service_worker', { timeout: 5_000 });
  const worker = await sw.worker();
  await worker.evaluate(() => chrome.runtime.reload());
  await new Promise(r => setTimeout(r, 1000));
  const innerRow = await page.$('#fe-tbody tr[data-idx]:has(a[href$="inner.txt"]) td:last-child');
  await innerRow.click();
  await page.keyboard.press('Space');
  await page.waitForSelector('#fe-ql-retry', { timeout: 5_000 }).catch(() => null);
  const staleMsg = await page.$eval('#fe-ql-body .fe-ql-note', el => el.textContent).catch(() => null);
  const staleBtn = await page.$eval('#fe-ql-retry', el => el.textContent).catch(() => null);
  check(/reloaded/.test(staleMsg || '') && staleBtn === 'Refresh page', `stale context explained: "${staleMsg}" [${staleBtn}]`);
  await shot(page, 'preview-stale-context');


} finally {
  await h.close();
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\nall checks passed');
