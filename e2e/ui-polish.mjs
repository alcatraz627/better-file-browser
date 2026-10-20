import assert from 'node:assert/strict';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { launch } from './harness.mjs';

const h = await launch();
try {
  const sample = join(h.fixture, 'gfm-cases.md');
  writeFileSync(sample, '# Markdown\n\n  ```yaml\n  title: Weekly plan\n  ```\n\nA <kbd>key</kbd> and <sup>2</sup>.\n\n- First\n- Second\n\nA paragraph.\n');
  const page = await h.open();
  for (const theme of ['dark', 'light']) {
    await h.store.set('bfb-theme', theme);
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('#fe');
    const favicon = await page.evaluate(async () => {
      const href = document.querySelector('link[rel="icon"]')?.href;
      if (!href) return { href: '', status: 0, loaded: false };
      const status = (await fetch(href)).status;
      const loaded = await new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve(img.naturalWidth > 0 && img.naturalHeight > 0);
        img.onerror = () => resolve(false);
        img.src = href;
      });
      return { href, status, loaded };
    });
    assert.ok(favicon.href.endsWith('/assets/favicon.svg') && favicon.status === 200 && favicon.loaded,
      `${theme} favicon ${JSON.stringify(favicon)}`);
    await page.keyboard.press('t');
    await page.goto('file://' + join(h.fixture, 'nested') + '/', { waitUntil: 'load' });
    await page.waitForSelector('#fe');
    await page.keyboard.press('t');
    await page.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
    await page.waitForSelector('#fe');
    await page.screenshot({ path: join(process.cwd(), '.claude', 'output', '20260922-adversarial-ui', `folder-tabs-${theme}.png`) });
    const searchBg = await page.evaluate(() => ({ app: getComputedStyle(document.getElementById('fe')).backgroundColor,
      main: getComputedStyle(document.querySelector('#fe-search')).backgroundColor,
      quick: getComputedStyle(document.querySelector('#fe-filter-q')).backgroundColor }));
    assert.equal(searchBg.main, searchBg.app, `${theme} app search background`);
    assert.equal(searchBg.quick, searchBg.app, `${theme} quick filter background`);
    if (!await page.$('#fe-tabs .fe-tab.on.pinned')) await page.keyboard.press('p');
    const pinned = await page.evaluate(() => {
      const tab = document.querySelector('#fe-tabs .fe-tab.pinned');
      return { first: tab === document.querySelector('#fe-tabs .fe-tab'), close: !!tab?.querySelector('.fe-tab-x'), width: tab?.getBoundingClientRect().width };
    });
    assert.ok(pinned.first && !pinned.close && pinned.width <= 40, `${theme} pinned tab ${JSON.stringify(pinned)}`);
    await page.click('#fe-settings-btn');
    const settings = await page.evaluate(() => {
      const modal = document.querySelector('#fe-settings-modal');
      const tabs = modal.querySelector('.fe-dlg-tabs');
      const icons = [...tabs.querySelectorAll('.fe-dlg-tab svg')].length;
      const hints = [...tabs.querySelectorAll('.fe-dlg-tab i')].map(el => el.textContent.trim());
      const buttons = [...modal.querySelectorAll('button.fe-pbn')].filter(el => el.offsetParent);
      const input = modal.querySelector('#fe-st-notes-root');
      return { scroll: tabs.scrollWidth - tabs.clientWidth, icons, hints, buttons: buttons.every(el => !!el.querySelector('svg')),
        bg: getComputedStyle(input).backgroundColor, appBg: getComputedStyle(document.getElementById('fe')).backgroundColor };
    });
    assert.equal(settings.scroll, 0, `${theme} settings tabs overflow`);
    assert.equal(settings.icons, 8);
    assert.ok(settings.hints.every(h => /^[A-Z]/.test(h)));
    assert.equal(settings.buttons, true);
    assert.equal(settings.bg, settings.appBg, `${theme} input looks disabled`);
    for (const tab of ['appearance', 'preview', 'files', 'exclusions', 'notes', 'terminal', 'data', 'ai']) {
      await page.click(`#fe-settings-modal .fe-dlg-tab[data-tab="${tab}"]`);
      const missing = await page.evaluate(() => [...document.querySelectorAll('#fe-settings-modal button')]
        .filter(el => el.getClientRects().length && !el.querySelector('svg'))
        .map(el => el.id || el.className));
      assert.deepEqual(missing, [], `${theme} ${tab} settings buttons missing icons`);
    }
    await page.click('#fe-settings-modal .fe-dlg-tab[data-tab="appearance"]');
    await page.screenshot({ path: join(process.cwd(), '.claude', 'output', '20260922-adversarial-ui', `settings-${theme}.png`) });
    await page.click('#fe-settings-modal .fe-dlg-tab[data-tab="appearance"]');
    await page.select('#fe-st-rd-size', '15');
    const before = await page.evaluate(() => ({ side: getComputedStyle(document.querySelector('.fe-sl')).fontSize,
      nav: getComputedStyle(document.querySelector('.fe-crumb')).fontSize,
      settings: getComputedStyle(document.querySelector('.fe-dlg-tab b')).fontSize }));
    await page.select('#fe-st-rd-size', '17');
    const after = await page.evaluate(() => ({ side: getComputedStyle(document.querySelector('.fe-sl')).fontSize,
      nav: getComputedStyle(document.querySelector('.fe-crumb')).fontSize,
      settings: getComputedStyle(document.querySelector('.fe-dlg-tab b')).fontSize }));
    assert.ok(Object.keys(before).every(key => parseFloat(after[key]) > parseFloat(before[key])), `${theme} global text scale ${JSON.stringify({before,after})}`);
    await page.keyboard.press('Escape');
    await page.goto('file://' + sample, { waitUntil: 'load' });
    await page.waitForSelector('#fe.fe-file-page');
    assert.ok((await page.$eval('link[rel="icon"]', link => link.href)).endsWith('/assets/favicon.svg'));
    const markdown = await page.evaluate(() => ({ code: document.querySelector('#fe-page .fe-md-pre')?.textContent,
      kbd: document.querySelector('#fe-page kbd')?.textContent,
      sup: document.querySelector('#fe-page sup')?.textContent,
      inlineCode: document.querySelectorAll('#fe-page p code').length }));
    assert.ok(markdown.code?.includes('title: Weekly plan'), JSON.stringify(markdown));
    assert.equal(markdown.kbd, 'key');
    assert.equal(markdown.sup, '2');
    assert.equal(markdown.inlineCode, 0);
    const rhythm = await page.evaluate(() => {
      const list = document.querySelector('#fe-page .fe-md ul');
      const items = list.querySelectorAll('li');
      const para = list.nextElementSibling;
      return { betweenItems: items[1].getBoundingClientRect().top - items[0].getBoundingClientRect().bottom,
        afterList: para.getBoundingClientRect().top - list.getBoundingClientRect().bottom };
    });
    assert.ok(Math.abs(rhythm.betweenItems - rhythm.afterList) <= 2, `${theme} list spacing ${JSON.stringify(rhythm)}`);
    await page.setViewport({ width: 2200, height: 900 });
    const measureWidth = () => page.evaluate(() => Math.round(document.querySelector('#fe-page .fe-md').getBoundingClientRect().width));
    const full = await measureWidth();
    await page.click('#fe-fp-column'); const xl = await measureWidth();
    await page.click('#fe-fp-column'); const lg = await measureWidth();
    await page.click('#fe-fp-column'); const md = await measureWidth();
    await page.click('#fe-fp-column'); const fullAgain = await measureWidth();
    assert.ok(full > xl && xl > lg && lg > md && fullAgain === full,
      `${theme} reading widths ${JSON.stringify({ full, xl, lg, md, fullAgain })}`);
    console.log(`${theme} widths at 2200px viewport: full=${full}px XL=${xl}px LG=${lg}px MD=${md}px`);
    await page.setViewport({ width: 620, height: 850 });
    const narrow = await page.evaluate(() => ({ content: document.querySelector('#fe-page .fe-md').getBoundingClientRect().width,
      page: document.querySelector('#fe-page').getBoundingClientRect().width,
      scroll: document.documentElement.scrollWidth - window.innerWidth }));
    assert.ok(narrow.content > 400 && narrow.scroll === 0, `${theme} narrow Markdown ${JSON.stringify(narrow)}`);
    await page.screenshot({ path: join(process.cwd(), '.claude', 'output', '20260922-adversarial-ui', `narrow-fixed-${theme}.png`) });
    console.log(`${theme}: settings tabs/icons, global text size, fenced code, inline HTML, and 620px layout passed`);
  }
  await page.goto('file://' + join(process.cwd(), 'docs', 'notes-contract.md'), { waitUntil: 'load' });
  await page.waitForSelector('#fe.fe-file-page');
  const contract = await page.evaluate(() => ({ blocks: [...document.querySelectorAll('#fe-page .fe-md-code .fe-md-pre')].map(el => el.textContent), inline: [...document.querySelectorAll('#fe-page p code')].map(el => el.textContent) }));
  assert.ok(contract.blocks.some(block => block.includes('title: Weekly plan') && block.includes('updated: 2026-09-15')),
    `notes contract YAML fence rendered as a block: ${JSON.stringify(contract)}`);
  console.log('notes-contract.md YAML fence rendered as one code block');
  for (const theme of ['dark', 'light']) {
    await h.store.set('bfb-theme', theme);
    await page.goto('file:///Users/alcatraz627/Code/local-models/docs/STATE.md', { waitUntil: 'load' });
    await page.waitForSelector('#fe.fe-file-page');
    const rows = await page.evaluate(() => [...document.querySelectorAll('#fe-page .fe-md-table tr')]
      .filter(row => /Command|review <pr|warm on/.test(row.textContent))
      .map(row => ({ cells: row.children.length, text: row.textContent })));
    assert.ok(rows.length >= 3 && rows.every(row => row.cells === 3), `${theme} STATE.md command table: ${JSON.stringify(rows)}`);
    console.log(`${theme}: STATE.md Command table rows stayed in three columns`);
  }
} finally { await h.close(); }
