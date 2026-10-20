import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, shot } from './harness.mjs';

const h = await launch();
try {
  const linksFile = join(h.fixture, 'links.md');
  const calloutFile = join(h.fixture, 'callout.md');
  writeFileSync(linksFile, '# Links\n\nSee /Users/alcatraz627/Code/better-file-browser/README.md:83 and `/Users/alcatraz627/My Docs/a #1?.md:7`.\n');
  writeFileSync(calloutFile, [
    '# Report', '', '## Owner words', '',
    '> This is a blockquote with several paragraphs and a list.',
    '> - First item', '> - Second item', '>',
    `> ${'A longer explanation follows the list and wraps across the reading column. '.repeat(2)}`,
    '>', '> The final paragraph should sit near the bottom border.', '',
  ].join('\n'));
  const page = await h.browser.newPage();
  await page.goto('file://' + linksFile, { waitUntil: 'load' });
  await page.waitForSelector('#fe-page .fe-md');
  const links = await page.$$eval('#fe-page .fe-md a[href^="file:///Users/alcatraz627/"]', nodes =>
    nodes.map(a => ({ text: a.textContent, href: a.href, target: a.target })));
  assert.deepEqual(links, [
    { text: '/Users/alcatraz627/Code/better-file-browser/README.md:83', href: 'file:///Users/alcatraz627/Code/better-file-browser/README.md', target: '_blank' },
    { text: '/Users/alcatraz627/My Docs/a #1?.md:7', href: 'file:///Users/alcatraz627/My%20Docs/a%20%231%3F.md', target: '_blank' },
  ]);
  const opened = h.browser.waitForTarget(t => t.url() === links[0].href, { timeout: 5000 });
  await page.click('#fe-page .fe-md a[href="file:///Users/alcatraz627/Code/better-file-browser/README.md"]');
  await opened;

  await page.goto('file://' + calloutFile, { waitUntil: 'load' });
  await page.waitForSelector('#fe-page blockquote .fe-md');
  const checkPage = () => page.evaluate(() => {
    const quote = document.querySelector('#fe-page blockquote');
    const nested = quote.querySelector(':scope > .fe-md');
    const first = nested.firstElementChild;
    const last = nested.lastElementChild;
    const buttons = [...document.querySelectorAll('#fe-fp-bar button')].filter(b => !b.closest('#fe-ff') && b.offsetParent);
    return {
      top: Math.round(first.getBoundingClientRect().top - quote.getBoundingClientRect().top),
      bottom: Math.round(quote.getBoundingClientRect().bottom - last.getBoundingClientRect().bottom),
      controls: buttons.map(b => ({ text: b.textContent.trim(), icon: !!b.querySelector('svg') })),
      theme: document.getElementById('fe').dataset.theme,
    };
  });
  const dark = await checkPage();
  assert.equal(dark.theme, 'dark');
  assert.ok(dark.top < 35 && dark.bottom < 35, JSON.stringify(dark));
  assert.deepEqual(dark.controls, ['Full width', 'Edit', 'Wrap', 'Raw', 'Copy'].map(text => ({ text, icon: true })));
  await shot(page, 'markdown-callout-fixture-dark');
  await page.bringToFront();
  await page.evaluate(() => document.getElementById('fe-theme-btn').click());
  const light = await checkPage();
  assert.equal(light.theme, 'light');
  assert.ok(light.top < 35 && light.bottom < 35, JSON.stringify(light));
  await shot(page, 'markdown-callout-fixture-light');

  const listing = await h.open();
  const controls = await listing.evaluate(() => ({
    placeholders: [...document.querySelectorAll('input[placeholder]')].map(input => input.getAttribute('placeholder')),
    crumbIcons: [...document.querySelectorAll('#fe-bc .fe-crumb-dd')].every(button => !!button.querySelector('svg')),
  }));
  assert.ok(controls.placeholders.every(text => !/(?:\.{3}|…)$/.test(text)));
  assert.equal(controls.crumbIcons, true);
  await listing.keyboard.press('t');
  await listing.goto('file://' + h.fixture + '/nested/', { waitUntil: 'load' });
  await listing.waitForSelector('#fe');
  await listing.keyboard.press('t');
  await listing.waitForSelector('#fe-tabs .fe-tab-list svg');

  const jsonPage = await h.browser.newPage();
  await jsonPage.goto('file://' + h.fixture + '/data.json', { waitUntil: 'load' });
  await jsonPage.waitForSelector('#fe-page .fe-jt summary svg');
  const disclosure = await jsonPage.$eval('#fe-page .fe-jt summary', el => ({
    icon: !!el.querySelector('svg'), text: el.textContent,
  }));
  assert.equal(disclosure.icon, true);
  assert.doesNotMatch(disclosure.text, /[▾⌄▼]/);
  console.log(`Markdown links, quote spacing (dark ${dark.top}/${dark.bottom}px, light ${light.top}/${light.bottom}px), toolbar icons, placeholders, and chevron icons passed`);
} finally {
  await h.close();
}
