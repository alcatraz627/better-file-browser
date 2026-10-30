// Taking a doc out of bfb: the browser's print gives the document alone, the
// Export menu saves a web page and a Word file a real reader opens, and a
// table or code block saves as an SVG or PNG. Runs on a doc holding every
// kind of block.
//
//   node e2e/export-walk.mjs      (BFB_THEME=light for the light theme)
import { writeFileSync, readFileSync, readdirSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { launch, shot, applyTheme, THEME, SHOTS } from './harness.mjs';

const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const DOC = `---
title: Export sample
owner: bfb
status: draft
---

# Export sample

A paragraph with **bold**, *italic*, \`inline code\` and a [link](https://example.com).

## A table

| Name | State | Notes |
|---|---|---|
| Alpha | ready | The first row, with enough words to wrap across the column on a printed page. |
| Beta | waiting | Second row |

## Some code

\`\`\`ts
export function add(a: number, b: number): number {
  // A long comment line that runs past the edge of a printed page so wrapping can be checked properly here.
  return a + b;
}
\`\`\`

## A diagram

\`\`\`mermaid
flowchart LR
  A[Write] --> B[Render]
  B --> C[Print]
\`\`\`

## A list

- One
- Two
  - Two point one
1. First
2. Second

> A quote.

The last paragraph, far down the page.
`;

// Wait for a new file in the downloads folder whose name ends with `ext`.
async function download(h, ext, before) {
  for (let i = 0; i < 50; i++) {
    const got = readdirSync(h.downloads).filter(f => f.endsWith(ext) && !before.includes(f));
    if (got.length) return join(h.downloads, got[0]);
    await sleep(100);
  }
  return null;
}

const h = await launch();
try {
  const doc = join(h.fixture, 'export-sample.md');
  writeFileSync(doc, DOC);
  await h.store.set('bfb-theme', THEME);
  const page = await h.browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  await page.goto('file://' + doc, { waitUntil: 'load' });
  await applyTheme(page);
  await page.waitForSelector('#fe.fe-file-page .fe-md', { timeout: 10_000 });
  await page.waitForSelector('.fe-md-mermaid .dl-world > svg', { timeout: 10_000 });
  await sleep(400);

  // Print: only the document, its whole length, dark on white.
  await page.emulateMediaType('print');
  const printed = await page.evaluate(() => {
    const vis = sel => { const e = document.querySelector(sel); return !!e && getComputedStyle(e).display !== 'none'; };
    const md = document.querySelector('#fe-page .fe-md');
    return {
      side: vis('#fe-side'), bar: vis('#fe-fp-bar'), tabs: vis('#fe-tabbar'), page: vis('#fe-page'),
      tall: document.querySelector('#fe-page').getBoundingClientRect().height >= md.scrollHeight - 2,
      ink: getComputedStyle(md).color, paper: getComputedStyle(document.body).backgroundColor,
      tools: vis('.fe-md-mermaid .dl-top'),
    };
  });
  check(!printed.side && !printed.bar && !printed.tabs && printed.page, `print shows the page alone: ${JSON.stringify(printed)}`);
  check(printed.tall, 'print lays the whole doc out, not the screenful in view');
  check(printed.ink === 'rgb(17, 17, 17)' && printed.paper === 'rgb(255, 255, 255)', `print is dark ink on white: ${printed.ink} on ${printed.paper}`);
  check(!printed.tools, 'a diagram prints without its toolbar');
  const pdf = join(h.downloads, 'printed.pdf');
  await page.pdf({ path: pdf, format: 'A4' });
  const pdfText = existsSync('/opt/homebrew/bin/pdftotext') ? execFileSync('/opt/homebrew/bin/pdftotext', [pdf, '-']).toString() : '';
  if (pdfText) check(/The last paragraph, far down the page/.test(pdfText) && !/Choose a folder/.test(pdfText), 'the printed PDF holds the end of the doc and none of the sidebar');
  await page.emulateMediaType(null);

  // The Export menu.
  await page.click('#fe-fp-export');
  await sleep(200);
  const items = await page.$$eval('.fe-export-menu [data-fmt]', els => els.map(e => e.textContent.trim()));
  check(items.join() === 'Google Doc,Word document,PDF,Web page', `Export offers four formats: ${items.join(', ')}`);
  await shot(page, 'export-menu');

  // Web page.
  let before = readdirSync(h.downloads);
  await page.click('.fe-export-menu [data-fmt="html"]');
  const html = await download(h, '.html', before);
  check(!!html, `the web page downloads: ${html}`);
  if (html) {
    const s = readFileSync(html, 'utf8');
    check(/<h1[^>]*>Export sample<\/h1>/.test(s) && /<table>/.test(s) && /<pre><code>/.test(s) && /<svg[^>]*>/.test(s) && /<title>Export sample<\/title>/.test(s),
      'the web page holds the heading, table, code and the diagram as SVG');
    check(!/class="fe-|<button|data-sl=/.test(s), 'the web page carries none of the app\'s markup');
    check(/<meta name="description" content="A paragraph with bold/.test(s) && /<meta property="og:title" content="Export sample">/.test(s) && /name="viewport"/.test(s),
      'the web page carries a description, Open Graph title and a viewport tag');
    const p2 = await h.browser.newPage();
    await p2.setViewport({ width: 1280, height: 900 });
    await p2.goto('file://' + html, { waitUntil: 'load' });
    const head = await p2.evaluate(() => ({
      anchors: [...document.querySelectorAll('main h2 a.anchor')].map(a => a.getAttribute('href')),
      chips: [...document.querySelectorAll('.chips li')].map(l => l.textContent),
      facts: document.querySelector('.facts')?.textContent ?? '',
      toc: document.querySelectorAll('.toc a').length,
    }));
    check(head.anchors.length >= 4 && head.anchors.every(h => /^#[\w-]+$/.test(h)), `each section heading links to itself: ${head.anchors.join(' ')}`);
    check(head.chips.join() === 'ownerbfb,statusdraft' && /words/.test(head.facts) && /min read/.test(head.facts) && head.toc >= 4, `the header shows the front matter and facts, with contents: ${JSON.stringify(head)}`);
    await shot(p2, 'export-html');
    // A phone: nothing wider than the screen except inside a table or code box.
    await p2.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await p2.reload({ waitUntil: 'load' });
    const phone = await p2.evaluate(() => ({ page: document.documentElement.scrollWidth, screen: innerWidth, table: getComputedStyle(document.querySelector('.table-wrap')).overflowX }));
    check(phone.page <= phone.screen && phone.table === 'auto', `on a phone the page fits the screen and a table scrolls in its own box: ${JSON.stringify(phone)}`);
    await shot(p2, 'export-html-phone');
    await p2.evaluate(() => document.querySelector('.table-wrap').scrollIntoView());
    await shot(p2, 'export-html-phone-mid');
    await p2.close();
  }

  // Word.
  await page.click('#fe-fp-export'); await sleep(200);
  before = readdirSync(h.downloads);
  await page.click('.fe-export-menu [data-fmt="docx"]');
  const docx = await download(h, '.docx', before);
  check(!!docx, `the Word file downloads: ${docx}`);
  if (docx) {
    const parts = execFileSync('unzip', ['-Z1', docx]).toString().split('\n');
    check(['word/document.xml', 'word/styles.xml', 'word/numbering.xml', 'word/media/image1.png'].every(p => parts.includes(p)), `the .docx holds its parts and the diagram picture: ${parts.filter(Boolean).join(', ')}`);
    const xml = execFileSync('unzip', ['-p', docx, 'word/document.xml']).toString();
    check(/<w:pgMar w:top="864" w:right="864" w:bottom="864" w:left="864"/.test(xml), 'the Word page has 0.6 inch margins');
    check(/w:val="Heading1"/.test(xml) && /<w:tbl>/.test(xml) && /<w:numPr>/.test(xml) && /w:val="Code"/.test(xml) && /<w:hyperlink/.test(xml), 'the Word file has real headings, a table, lists, code and a link');
    copyFileSync(docx, join(SHOTS, 'export-sample.docx'));
    // macOS reads .docx natively; a file it cannot open fails here.
    const out = join(h.downloads, 'docx-text');
    mkdirSync(out, { recursive: true });
    execFileSync('textutil', ['-convert', 'txt', '-output', join(out, 'doc.txt'), docx]);
    const txt = readFileSync(join(out, 'doc.txt'), 'utf8');
    check(/Export sample/.test(txt) && /Alpha/.test(txt) && /export function add/.test(txt) && /Two point one/.test(txt), 'a real reader opens the Word file and finds the text');
  }

  // Google Doc: the doc goes on the clipboard as rich text and a new Google Doc opens.
  try { await h.browser.defaultBrowserContext().overridePermissions('file://', ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']); } catch (e) { console.log('[note] clipboard permission:', e.message); }
  await page.bringToFront();
  await page.click('#fe-fp-export'); await sleep(200);
  const opened = new Promise(r => { h.browser.once('targetcreated', t => r(t.url())); setTimeout(() => r(null), 4000); });
  await page.click('.fe-export-menu [data-fmt="gdoc"]');
  const newTab = await opened;
  check(/docs\.new|docs\.google\.com/.test(newTab ?? ''), `a new Google Doc opens: ${newTab}`);
  await sleep(300);
  await page.bringToFront();
  const clip = await page.evaluate(async () => {
    try {
      const [item] = await navigator.clipboard.read();
      const html = item.types.includes('text/html') ? await (await item.getType('text/html')).text() : '';
      return { types: item.types, h1: /<h1[^>]*>Export sample<\/h1>/.test(html), table: /<table[\s>]/.test(html), img: /<img[^>]+src="data:image\/png/.test(html), padded: /<article|max-width|padding:\s*48/.test(html) };
    } catch (e) { return { error: String(e) }; }
  });
  check(clip.types?.includes('text/html') && clip.h1 && clip.table && clip.img && !clip.padded, `the clipboard holds the doc as rich text with the diagram as a picture: ${JSON.stringify(clip)}`);
  const toastText = await page.$eval('#fe-toast', t => t.textContent);
  check(/Paste it into the new Google Doc/.test(toastText), `the toast says what to do next: "${toastText}"`);
  for (const p of await h.browser.pages()) if (/docs\.new|google/.test(p.url())) await p.close();

  // A table and a code block as pictures.
  await page.hover('.fe-md-tablewrap');
  await sleep(200);
  const shown = await page.$eval('.fe-md-tablewrap > .fe-blk-x', b => getComputedStyle(b).opacity);
  check(shown === '1', `hovering a table shows its picture button: opacity ${shown}`);
  for (const [sel, fmt] of [['.fe-md-tablewrap > .fe-blk-x', 'png'], ['.fe-md-tablewrap > .fe-blk-x', 'svg'], ['.fe-md-code .fe-blk-x', 'png']]) {
    await page.hover(sel.split(' ')[0]);
    await page.click(sel); await sleep(200);
    before = readdirSync(h.downloads);
    await page.click(`.fe-export-menu [data-fmt="${fmt}"]`);
    const f = await download(h, '.' + fmt, before);
    check(!!f, `${sel.includes('table') ? 'the table' : 'the code block'} saves as ${fmt.toUpperCase()}: ${f}`);
    if (f && fmt === 'png') {
      const b = readFileSync(f);
      const w = b.readUInt32BE(16), hh = b.readUInt32BE(20);
      check(b.slice(1, 4).toString() === 'PNG' && w > 200 && hh > 50, `the PNG is a real picture: ${w}x${hh}`);
      const p3 = await h.browser.newPage();
      await p3.goto('file://' + f);
      await shot(p3, `export-${sel.includes('table') ? 'table' : 'code'}-png`);
      await p3.close();
    }
    if (f && fmt === 'svg') check(/<foreignObject/.test(readFileSync(f, 'utf8')) && /Alpha/.test(readFileSync(f, 'utf8')), 'the SVG holds the table');
  }
  await shot(page, 'export-page');
} finally {
  console.log(results.join('\n'));
  await h.close();
}
