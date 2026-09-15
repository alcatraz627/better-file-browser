// Browser harness for the extension. Launches Chrome for Testing with the
// unpacked extension loaded, builds a throwaway fixture directory, and hands
// back a page already sitting on that directory's listing.
//
// Chrome for Testing is required: branded Chrome ignores --load-extension.
// Install once with `npx @puppeteer/browsers install chrome@stable`.
import puppeteer from 'puppeteer-core';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir, homedir } from 'node:os';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
export const SHOTS = join(ROOT, 'e2e', 'shots');

function findChrome() {
  if (process.env.BFB_CHROME) return process.env.BFB_CHROME;
  const base = join(homedir(), '.cache', 'puppeteer', 'chrome');
  if (!existsSync(base)) throw new Error('no Chrome for Testing in ~/.cache/puppeteer/chrome');
  const builds = readdirSync(base).filter(d => d.startsWith('mac_arm-')).sort();
  const latest = builds.at(-1);
  if (!latest) throw new Error('no mac_arm Chrome for Testing build cached');
  return join(base, latest, 'chrome-mac-arm64',
    'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing');
}

// A small directory with one file per preview family, plus a nested folder
// so deep search and parent navigation have something to find.
export function makeFixture() {
  const dir = join(tmpdir(), `bfb-fixture-${process.pid}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, 'nested', 'deeper'), { recursive: true });
  const files = {
    'readme.md': '# Fixture\n\nA **markdown** file with a [link](notes.txt).\n\n- one\n- two\n',
    'notes.txt': 'plain text\nsecond line\n',
    'data.json': JSON.stringify({ a: 1, b: [1, 2, 3], c: { d: 'e' } }, null, 2),
    'rows.tsv': 'name\tsize\nalpha\t1\nbeta\t22\n',
    'script.sh': '#!/bin/bash\necho "hi"\n',
    'code.py': 'def f(x):\n    return x * 2\n',
    '.hidden': 'secret\n',
    'nested/inner.txt': 'inner\n',
    'nested/deeper/deepest.md': '# deep\n',
  };
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
}

export async function launch({ headless = true } = {}) {
  execSync('npm run -s build', { cwd: ROOT, stdio: 'inherit' });
  mkdirSync(SHOTS, { recursive: true });
  const profile = join(tmpdir(), `bfb-profile-${process.pid}`);
  rmSync(profile, { recursive: true, force: true });

  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless,
    ignoreDefaultArgs: ['--disable-extensions'],
    userDataDir: profile,
    args: [
      `--load-extension=${ROOT}`,
      `--disable-extensions-except=${ROOT}`,
      '--allow-file-access-from-files',
      '--no-first-run',
      '--window-size=1400,900',
    ],
    defaultViewport: { width: 1400, height: 900 },
  });

  const fixture = makeFixture();

  async function open(dirPath = fixture) {
    const page = await browser.newPage();
    page.on('pageerror', e => console.error('[pageerror]', e.message));
    page.on('console', m => { if (m.type() === 'error') console.error('[console]', m.text()); });
    await page.goto('file://' + dirPath + '/', { waitUntil: 'load' });
    await page.waitForSelector('#fe', { timeout: 10_000 });
    return page;
  }

  async function close() {
    await browser.close();
    rmSync(profile, { recursive: true, force: true });
    rmSync(fixture, { recursive: true, force: true });
  }

  return { browser, fixture, open, close };
}

export async function shot(page, name) {
  const file = join(SHOTS, `${name}.png`);
  await page.screenshot({ path: file });
  return file;
}
