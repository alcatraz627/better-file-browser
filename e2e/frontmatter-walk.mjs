// Front matter that a strict YAML reader rejects still shows every value it
// can, with the complaint inside the front-matter box; list values show as
// items; a value naming a file links to it when the file is found; the raw
// view's problem line explains itself on hover. One theme per run.
//   node e2e/frontmatter-walk.mjs   → e2e/shots/frontmatter-*.png
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, shot, applyTheme } from './harness.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const h = await launch();
let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failed++; };
try {
  const dir = join(h.fixture, 'features');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'llm-mini.md'), '# Mini\n');
  const doc = join(dir, 'local-models.md');
  writeFileSync(doc, [
    '---',
    'name: local-models',
    'brief: Local models: run lm for vision',
    'related: [features/llm-mini.md, missing/nope.md]',
    'tags:',
    '  - ai',
    '  - local',
    '---',
    '# Local models', '', 'Body.', '',
  ].join('\n'));
  const page = await h.open();
  await page.setViewport({ width: 1400, height: 900 });
  await applyTheme(page);
  await page.goto('file://' + doc, { waitUntil: 'load' });
  await page.waitForSelector('.fe-md-fm'); await sleep(1200);

  const fm = await page.$eval('.fe-md-fm', box => ({
    keys: [...box.querySelectorAll('dt')].map(d => d.textContent),
    brief: box.querySelectorAll('dd')[1]?.textContent,
    tags: [...box.querySelectorAll('dd')[3]?.querySelectorAll('.fe-fm-item') ?? []].map(i => i.textContent),
    link: box.querySelector('a.fe-fm-path')?.getAttribute('href') ?? null,
    plain: [...box.querySelectorAll('span.fe-fm-path')].map(s => s.textContent),
    warn: [...box.querySelectorAll('.fe-md-fm-warn .fe-diag-row')].map(r => r.dataset.line),
  }));
  const strip = await page.$$eval('#fe-page > .fe-diag', d => d.length);
  check(fm.keys.join() === 'name,brief,related,tags' && fm.brief === 'Local models: run lm for vision', `every value reads, a colon inside a value included: ${JSON.stringify(fm.keys)} "${fm.brief}"`);
  check(fm.tags.join() === 'ai,local', `a list under a key shows as items: ${JSON.stringify(fm.tags)}`);
  check(!!fm.link && fm.link.endsWith('/features/llm-mini.md') && !fm.link.includes('features/features') && fm.plain.join() === 'missing/nope.md',
    `a related path found one folder up links; a missing one stays text: ${JSON.stringify({ link: fm.link, plain: fm.plain })}`);
  check(fm.warn.join() === '3' && strip === 0, `the YAML complaint sits inside the box, not in a card above: ${JSON.stringify({ warn: fm.warn, strip })}`);
  await page.screenshot({ path: await shot(page, 'frontmatter-box'), clip: { x: 280, y: 80, width: 1120, height: 320 } });

  // The raw view marks line 3; resting on it explains the problem.
  await page.click('.fe-md-fm-warn .fe-diag-row'); await sleep(500);
  const row = await page.$eval('.fe-cl:nth-child(3)', r => { r.scrollIntoView({ block: 'center' }); const b = r.getBoundingClientRect(); return { x: b.left + 60, y: b.top + b.height / 2, cls: r.className, tip: r.dataset.tip }; }).catch(() => null);
  check(!!row && /warn|err/.test(row.cls) && row.tip === 'problem', `line 3 is marked in the source: ${JSON.stringify(row)}`);
  if (row) {
    await page.mouse.move(row.x, row.y); await sleep(700);
    const tip = await page.$eval('#fe-hint', t => ({ on: t.classList.contains('on'), cls: t.className, text: t.innerText }));
    check(tip.on && /problem warn/.test(tip.cls) && /^Warning/.test(tip.text) && /line 3/.test(tip.text) && /mapping/i.test(tip.text), `the marked line explains itself: ${JSON.stringify(tip)}`);
    await page.screenshot({ path: await shot(page, 'frontmatter-tip'), clip: { x: 280, y: Math.max(0, row.y - 120), width: 1120, height: 260 } });
  }
} finally { await h.close(); }
console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
process.exitCode = failed ? 1 : 0;
