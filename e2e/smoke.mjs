// Smoke run: the explorer renders the fixture, a preview opens and closes,
// and screenshots land in e2e/shots/. Run with `npm run e2e`.
import { launch, shot, applyTheme } from './harness.mjs';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

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

  // Select readme.md by clicking its row off the anchor (an anchor click
  // navigates), then open the preview with Space.
  const row = await page.$('#fe-tbody tr[data-idx]:has(a[href$="readme.md"]) td:last-child');
  check(!!row, 'readme.md row present');
  await row.click();
  await page.keyboard.press('Space');
  await page.waitForSelector('#fe-ql-body h1', { timeout: 5_000 }).catch(() => null);
  const h1 = await page.$eval('#fe-ql-body h1', el => el.textContent).catch(() => null);
  check(h1 === 'Fixture', `markdown preview rendered h1 "${h1}"`);
  await shot(page, 'preview-md');

  const hdr = await page.evaluate(() => {
    const n = document.getElementById('fe-ql-name');
    const o = document.getElementById('fe-ql-open');
    const links = [...document.querySelectorAll('#fe-ql-body a[href]')];
    return {
      nameHref: n.getAttribute('href'), nameTarget: n.target,
      openTarget: o.target,
      bodyLinks: links.length, bodyBlank: links.every(a => a.target === '_blank'),
    };
  });
  check(/readme\.md$/.test(hdr.nameHref) && hdr.nameTarget === '_blank', `header name links to file in new tab: ${hdr.nameHref}`);
  check(hdr.openTarget === '_blank', 'open raw targets a new tab');
  check(hdr.bodyLinks === 1 && hdr.bodyBlank, `markdown links (${hdr.bodyLinks}) target a new tab`);

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
  await page.keyboard.press('Space');
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
  await shot(page, 'saved-sidebar');

  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe');
  const savedAfter = await page.evaluate(() => ({
    labels: [...document.querySelectorAll('#fe-sv-list .fe-pl-label')].map(e => e.textContent),
    heads: [...document.querySelectorAll('#fe-sv-list .fe-sv-tag')].map(h => h.textContent.trim()),
    dot: document.querySelector('#fe-sv-list .fe-sv-dot')?.style.background,
  }));
  check(savedAfter.labels.length === 3 && savedAfter.heads.join() === 'work' && savedAfter.dot === c2, `saved state persists: ${JSON.stringify(savedAfter)}`);

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
  await page.keyboard.down('Meta'); await page.keyboard.press('s'); await page.keyboard.up('Meta');
  await page.waitForFunction(() => /saved \d/.test(document.getElementById('fe-ql-meta').textContent), { timeout: 8_000 }).catch(() => null);

  await page.keyboard.press('Escape');
  const edClosed = await page.$eval('#fe-qlook', el => el.style.display === 'none');
  check(edClosed, 'Esc closes the editor');
  await page.waitForFunction(() => document.querySelectorAll('#fe-nt-list .fe-nt-item').length === 2, { timeout: 8_000 }).catch(() => null);
  const listAfter = await page.$$eval('#fe-nt-list .fe-nt-label', els => els.map(e => e.textContent));
  check(listAfter[0] === 'grocery list' && listAfter.length === 2, `sidebar lists the new note first: ${JSON.stringify(listAfter)}`);

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

  // Tabs: t keeps this folder, a second window sees it, ] and w navigate.
  const tabLabels = p => p.$$eval('#fe-tabs .fe-tab', els => els.map(e => (e.classList.contains('temp') ? '~' : '') + e.querySelector('.fe-tab-lbl').textContent));
  await page.bringToFront();
  await page.keyboard.press('Escape');
  let tabsA = await tabLabels(page);
  check(tabsA.length === 1 && tabsA[0].startsWith('~'), `fresh strip shows a temporary tab: ${JSON.stringify(tabsA)}`);
  await page.keyboard.press('t');
  await page.waitForFunction(() => document.querySelector('#fe-tabs .fe-tab.on:not(.temp)'), { timeout: 3_000 }).catch(() => null);
  tabsA = await tabLabels(page);
  check(tabsA.length === 1 && !tabsA[0].startsWith('~'), `t keeps the folder: ${JSON.stringify(tabsA)}`);

  const pageB = await h.open(h.fixture + '/nested');
  let tabsB = await tabLabels(pageB);
  check(tabsB.length === 2 && tabsB[1] === '~nested', `second window shows the shared tab plus its own temporary one: ${JSON.stringify(tabsB)}`);
  await pageB.bringToFront();
  await pageB.keyboard.press('t');
  await page.waitForFunction(() => document.querySelectorAll('#fe-tabs .fe-tab:not(.temp)').length === 2, { timeout: 5_000 }).catch(() => null);
  tabsA = await tabLabels(page);
  check(tabsA.length === 2 && tabsA[1] === 'nested', `first window picked up the new tab through storage.onChanged: ${JSON.stringify(tabsA)}`);
  await shot(pageB, 'tabs');
  await pageB.close();

  await page.bringToFront();
  await page.keyboard.press(']');
  await page.waitForFunction(() => location.pathname.endsWith('/nested/'), { timeout: 5_000 }).catch(() => null);
  await page.waitForSelector('#fe');
  check(page.url().endsWith('/nested/'), `] navigates to the next tab: ${page.url()}`);
  await page.waitForFunction(() => document.querySelector('#fe-tabs .fe-tab.on'), { timeout: 3_000 }).catch(() => null);
  await page.keyboard.press('w');
  await page.waitForFunction(() => !location.pathname.endsWith('/nested/'), { timeout: 5_000 }).catch(() => null);
  await page.waitForSelector('#fe');
  tabsA = await tabLabels(page);
  check(!page.url().endsWith('/nested/') && tabsA.length === 1, `w closes the tab and returns to the remaining one: ${JSON.stringify(tabsA)}`);

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
