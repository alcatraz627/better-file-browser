// Editing gets the room: the sidebar folds away while the tab editor is open
// and comes back on Done, and Split gives the rendered side 40%. While the
// sidebar is hidden, the left edge glows as the pointer nears and opens the
// sidebar over the page; it stays while hovered, closes half a second after the
// pointer leaves, closes on Esc and on a click away, and stays while you type in it.
//
//   node e2e/peek-walk.mjs      (BFB_THEME=light for the light theme)
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, shot, applyTheme, THEME } from './harness.mjs';

const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const h = await launch();
try {
  const md = join(h.fixture, 'peek.md');
  writeFileSync(md, '# Peek\n\n' + 'Some words to edit. '.repeat(40) + '\n');
  await h.store.set('bfb-theme', THEME);
  await h.store.set('bfb-settings-v1', { showSidebar: true, editableFolders: [h.fixture] });
  const page = await h.browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  await page.goto('file://' + md, { waitUntil: 'load' });
  await applyTheme(page);
  await page.waitForSelector('#fe-edge', { timeout: 8000 });
  const state = () => page.evaluate(() => {
    const s = document.getElementById('fe-side'), e = document.getElementById('fe-edge');
    return { shown: s.style.display !== 'none', peek: s.classList.contains('peek'), edge: !e.hidden, near: e.classList.contains('near') };
  });
  check((await state()).shown && !(await state()).edge, 'the sidebar shows and the edge is idle while it does');

  await page.click('#fe-fp-edit');
  await page.waitForSelector('#fe-fe-ta', { timeout: 5000 });
  await sleep(400);
  const editing = await state();
  check(!editing.shown && editing.edge, `opening the editor folds the sidebar and readies the edge: ${JSON.stringify(editing)}`);
  await page.click('#fe-fe-pill [data-mode="split"]');
  await sleep(200);
  const split = await page.$eval('#fe-fe-col', c => { const [a, b] = [...c.children].filter(x => x.offsetWidth).map(x => x.getBoundingClientRect().width); return b / (a + b); });
  check(split > 0.37 && split < 0.43, `Split gives the rendered side 40%: ${(split * 100).toFixed(1)}%`);

  await page.mouse.move(700, 400);
  await page.mouse.move(30, 400, { steps: 4 });
  check((await state()).near, 'the edge glows as the pointer nears it');
  await page.mouse.move(4, 400, { steps: 2 });
  await sleep(250);
  check((await state()).peek, 'reaching the edge opens the sidebar over the page');
  await shot(page, 'peek-open');
  await page.mouse.move(120, 300, { steps: 3 });
  await sleep(900);
  check((await state()).peek, 'it stays while the pointer is on it');
  await page.mouse.move(800, 400, { steps: 3 });
  await sleep(250);
  const soon = (await state()).peek;
  await sleep(500);
  check(soon && !(await state()).peek, `it closes half a second after the pointer leaves (open at 250 ms: ${soon})`);

  await page.mouse.move(4, 400, { steps: 3 });
  await sleep(200);
  await page.mouse.move(120, 300, { steps: 2 });
  await page.keyboard.press('Escape');
  await sleep(150);
  check(!(await state()).peek, 'Esc closes it');

  await page.mouse.move(4, 400, { steps: 3 });
  await sleep(200);
  const box = await page.evaluate(() => {
    const i = [...document.querySelectorAll('#fe-side input[type="text"]')].find(x => x.checkVisibility());
    if (!i) return null;
    const r = i.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (box) {
    await page.mouse.click(box.x, box.y);
    await page.mouse.move(800, 400, { steps: 3 });
    await sleep(900);
    check((await state()).peek, 'typing in one of its fields keeps it open');
    await page.mouse.click(800, 400);
    await sleep(200);
    check(!(await state()).peek, 'a click on the page closes it');
  } else check(false, 'the sidebar has a text field to type in');

  await page.click('#fe-fe-pill [data-act="done"]');
  await sleep(500);
  const after = await state();
  check(after.shown && !after.edge, `Done brings the sidebar back: ${JSON.stringify(after)}`);
} finally {
  console.log(results.join('\n'));
  await h.close();
}
