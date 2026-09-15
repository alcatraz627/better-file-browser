// Browser harness for the extension. Launches Chrome for Testing with the
// unpacked extension loaded, builds a throwaway fixture directory, and hands
// back a page already sitting on that directory's listing.
//
// Chrome for Testing is required: branded Chrome ignores --load-extension.
// Install once with `npx @puppeteer/browsers install chrome@stable`.
import puppeteer from 'puppeteer-core';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { tmpdir, homedir } from 'node:os';

// An unpacked extension's id is the first 32 hex of sha256(path), 0-9a-f → a-p.
function extensionId(dir) {
  return createHash('sha256').update(dir).digest('hex').slice(0, 32)
    .replace(/[0-9a-f]/g, c => String.fromCharCode(97 + parseInt(c, 16)));
}

// Native host manifests live inside the user-data-dir for Chrome for Testing.
function installNotesHost(profile) {
  const dir = join(profile, 'NativeMessagingHosts');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'com.better_file_browser.notes.json'), JSON.stringify({
    name: 'com.better_file_browser.notes',
    description: 'notes host (e2e)',
    path: join(ROOT, 'native', 'notes_host.py'),
    type: 'stdio',
    allowed_origins: [`chrome-extension://${extensionId(ROOT)}/`],
  }, null, 2));
}

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

export function makeNotesDir() {
  const dir = join(tmpdir(), `bfb-notes-${process.pid}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'existing-note.md'), '---\ntitle: Existing note\n---\n\n# Existing note\n\nhello\n');
  return dir;
}

export async function launch({ headless = true } = {}) {
  execSync('npm run -s build', { cwd: ROOT, stdio: 'inherit' });
  mkdirSync(SHOTS, { recursive: true });
  const profile = join(tmpdir(), `bfb-profile-${process.pid}`);
  rmSync(profile, { recursive: true, force: true });
  const notesDir = makeNotesDir();

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
    dumpio: !!process.env.BFB_DUMPIO,
  });

  const fixture = makeFixture();
  // After launch: a pre-existing profile folder makes Chrome skip loading
  // the unpacked extension; the manifest is only read when a port opens.
  installNotesHost(profile);

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
    rmSync(notesDir, { recursive: true, force: true });
  }

  return { browser, fixture, notesDir, open, close };
}

export async function shot(page, name) {
  const file = join(SHOTS, `${name}.png`);
  await page.screenshot({ path: file });
  return file;
}
