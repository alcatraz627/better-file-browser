// Smoke run: the explorer renders the fixture, a preview opens and closes,
// and screenshots land in e2e/shots/. Run with `npm run e2e`.
import { launch, shot } from './harness.mjs';

const failures = [];
function check(cond, msg) {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) failures.push(msg);
}

const h = await launch({ headless: process.env.BFB_HEADED ? false : true });
try {
  const page = await h.open();

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
