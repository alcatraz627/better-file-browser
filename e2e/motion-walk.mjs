// Motion: the sidebar slides, a tag group eases open and shut, a lens slides
// in, menus and dialogs rise in; with reduced motion asked for, all of it snaps.
import { launch } from './harness.mjs';

const h = await launch();
const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
try {
  await h.store.set('bfb-saved-v1', [
    { path: h.fixture + '/', label: 'One', tags: ['work'] },
    { path: h.fixture + '/nested/', label: 'Two', tags: ['work'] },
    { path: h.fixture + '/readme.md', label: 'Three', tags: ['work'] },
  ]);
  const page = await h.open();
  await page.click('#fe-rail-notes');
  await sleep(20);
  const lensAnim = await page.$eval('#fe-lens-notes', e => e.getAnimations().map(a => a.animationName));
  check(lensAnim.includes('fe-lens-in'), `the picked lens slides in: ${lensAnim}`);
  await sleep(300);

  const grp = '#fe-sv-list details.fe-grp[data-tag="work"]';
  const full = await page.$eval(grp, d => d.getBoundingClientRect().height);
  await page.click(`${grp} > summary`);
  await sleep(70);
  const mid = await page.$eval(grp, d => d.getBoundingClientRect().height);
  await sleep(300);
  const shut = await page.$eval(grp, d => d.getBoundingClientRect().height);
  check(mid < full - 4 && mid > shut + 4, `a group eases shut: ${Math.round(full)} → ${Math.round(mid)} → ${Math.round(shut)}px`);
  await page.click(`${grp} > summary`);
  await sleep(300);

  await page.click('.fe-crumb-dd');
  await page.waitForSelector('#fe-crumb-menu .fe-dd-item');
  const menuAnim = await page.$eval('#fe-crumb-menu', e => getComputedStyle(e).animationName);
  check(menuAnim === 'fe-rise', `the path menu rises in: ${menuAnim}`);
  await page.keyboard.press('Escape');

  await page.keyboard.press(',');
  await page.waitForSelector('#fe-settings-modal .fe-dlg-box');
  const dlgAnim = await page.$eval('#fe-settings-modal .fe-dlg-box', e => getComputedStyle(e).animationName);
  check(dlgAnim === 'fe-rise', `Settings rises in: ${dlgAnim}`);
  await page.keyboard.press('Escape');
  await sleep(200);

  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.click('#fe-side-toggle');
  const goneNow = await page.$eval('#fe-side', e => getComputedStyle(e).display === 'none');
  check(goneNow, 'with reduced motion the sidebar hides at once');
  await page.click('#fe-side-toggle');
  await sleep(50);
  await page.click(`${grp} > summary`);
  await sleep(20);
  const snapped = await page.$eval(grp, d => d.getBoundingClientRect().height);
  check(Math.abs(snapped - shut) < 2, `with reduced motion a group folds at once: ${Math.round(snapped)}px`);
} finally {
  console.log(results.join('\n'));
  await h.close();
}
