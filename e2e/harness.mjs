// Browser harness for the extension. Launches Chrome for Testing with the
// unpacked extension loaded, builds a throwaway fixture directory, and hands
// back a page already sitting on that directory's listing.
//
// Chrome for Testing is required: branded Chrome ignores --load-extension.
// Install once with `npx @puppeteer/browsers install chrome@stable`.
import puppeteer from 'puppeteer-core';
import { execSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { tmpdir, homedir } from 'node:os';

// An unpacked extension's id is the first 32 hex of sha256(path), 0-9a-f → a-p.
function extensionId(dir) {
  return createHash('sha256').update(dir).digest('hex').slice(0, 32)
    .replace(/[0-9a-f]/g, c => String.fromCharCode(97 + parseInt(c, 16)));
}

// Native host manifests live inside the user-data-dir for Chrome for Testing.
// The host always runs through a launcher that keeps bfb-docs state (the
// comments index, last known copies) and file backups inside the profile,
// never the owner's.
// With pickReply, the launcher also answers the system folder chooser with
// that path, since a headless run has no dialog to click.
function installNotesHost(profile, pickReply) {
  const dir = join(profile, 'NativeMessagingHosts');
  mkdirSync(dir, { recursive: true });
  const hostPath = join(profile, 'notes_host_launcher.py');
  // Decision pages: a scratch registry, and a stand-in for gcc's command that
  // logs each call and, for seen, writes .seen.json the first time as gcc does.
  // reach answers from dp-reach.json in the profile, which a walk writes; with
  // no such file it answers {}, and a file holding "fail" makes it exit 1.
  mkdirSync(dpRegistry(profile), { recursive: true });
  const dpStub = join(profile, 'fake_decision_page.py');
  writeFileSync(dpStub, `#!/usr/bin/env python3
import json, os, sys, time
if sys.argv[1:] == ['reach']:
    p = ${JSON.stringify(join(profile, 'dp-reach.json'))}
    body = open(p).read() if os.path.exists(p) else '{}'
    if body.strip() == 'fail':
        sys.exit(1)
    print(body)
    sys.exit(0)
verb, slug, rest = sys.argv[1], sys.argv[2], sys.argv[3:]
payload = sys.stdin.read()
open(${JSON.stringify(join(profile, 'dp-calls.jsonl'))}, 'a').write(json.dumps({'verb': verb, 'slug': slug, 'args': rest, 'payload': payload}) + '\\n')
page = os.path.join(${JSON.stringify(dpRegistry(profile))}, slug)
if not os.path.isfile(os.path.join(page, 'config.json')):
    sys.stderr.write("decision-page %s: no page '%s'\\n" % (verb, slug)); sys.exit(1)
if verb == 'compose' and os.path.exists(${JSON.stringify(join(profile, 'dp-broken'))}):
    sys.stderr.write('decision-page compose: bun is not installed\\n'); sys.exit(1)
if verb in ('compose', 'parse'):
    # gcc's own composer and parser, over the scratch page's config.
    import subprocess
    r = subprocess.run([${JSON.stringify(BUN)}, ${JSON.stringify(join(profile, 'fake_dp_core.ts'))}, verb, os.path.join(page, 'config.json')], input=payload, capture_output=True, text=True)
    sys.stdout.write(r.stdout); sys.stderr.write(r.stderr); sys.exit(r.returncode)
if verb == 'submit':
    if os.path.exists(${JSON.stringify(join(profile, 'dp-down'))}):
        sys.stderr.write('decision-page submit: the page server on http://127.0.0.1:5106 is not answering; nothing was written\\n'); sys.exit(4)
    ans = os.path.join(page, '.answer.json')
    if os.path.exists(ans) and '--replace' not in rest:
        print(json.dumps({'error': 'this page is already answered; send replace:true to overwrite it', 'answered': True, 'existing': json.load(open(ans))['answer']})); sys.exit(3)
    via = rest[rest.index('--via') + 1] if '--via' in rest else 'cli'
    json.dump({'answer': payload.rstrip('\\n'), 'submitted_at': int(time.time()), 'via': via}, open(ans, 'w'))
    p = ${JSON.stringify(join(profile, 'dp-notify.json'))}
    state = open(p).read().strip() if os.path.exists(p) else 'requested'
    notify = {'state': state, 'via': [], 'reason': '', 'at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
    json.dump(notify, open(os.path.join(page, '.notify.json'), 'w'))
    print(json.dumps({'ok': True, 'slug': slug, 'routed': None, 'notify': notify})); sys.exit(0)
if verb == 'seen':
    p = os.path.join(page, '.seen.json')
    if not os.path.exists(p):
        open(p, 'w').write(json.dumps({'at': time.time()}))
print(json.dumps({'ok': True}))
`, { mode: 0o755 });
  writeFileSync(join(profile, 'fake_dp_core.ts'), `import { compose, parse } from ${JSON.stringify(join(homedir(), '.claude', 'scripts', 'decision-page', 'dp-core.ts'))};
import { readFileSync } from 'node:fs';
const [verb, cfgPath] = process.argv.slice(2);
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
const input = (await Bun.stdin.text()).trim();
if (verb === 'compose') process.stdout.write(compose(cfg, input ? JSON.parse(input) : null) + '\\n');
else console.log(JSON.stringify(parse(input, cfg)));
`);
  writeFileSync(hostPath, `#!/usr/bin/env python3
import importlib.util, os
os.environ['BFB_DP_REGISTRY'] = ${JSON.stringify(dpRegistry(profile))}
os.environ['BFB_DP_BIN'] = ${JSON.stringify(dpStub)}
os.environ['BFB_DOCS_HOME'] = ${JSON.stringify(docsHome(profile))}
os.environ['BFB_BACKUP_DIR'] = ${JSON.stringify(join(profile, 'backups'))}
spec = importlib.util.spec_from_file_location('notes_host', ${JSON.stringify(join(ROOT, 'native', 'notes_host.py'))})
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
${pickReply ? `m.run_picker = lambda start, kind=None: ${JSON.stringify(pickReply)}` : ''}
m.main()
`, { mode: 0o755 });
  writeFileSync(join(dir, 'com.better_file_browser.notes.json'), JSON.stringify({
    name: 'com.better_file_browser.notes',
    description: 'notes host (e2e)',
    path: hostPath,
    type: 'stdio',
    allowed_origins: [`chrome-extension://${extensionId(ROOT)}/`],
  }, null, 2));
}

// With lmStub, the AI host runs as it does for real but over a stand-in `lm`
// that answers at once, so Ask can be walked without models or a cloud call.
// Every call is logged to lm-calls.jsonl in the profile for the walk to read.
function installLlmHost(profile) {
  const dir = join(profile, 'NativeMessagingHosts');
  mkdirSync(dir, { recursive: true });
  const log = join(profile, 'lm-calls.jsonl');
  const fake = join(profile, 'fake_lm.py');
  writeFileSync(fake, `#!/usr/bin/env python3
import json, os, sys
args = sys.argv[1:]
# A file named lm-down in the profile makes the stand-in report its model server down.
down = os.path.exists(${JSON.stringify(join(profile, 'lm-down'))})
stdin = sys.stdin.read() if args[:1] == ['q'] or (args[:1] == ['gemini'] and '--json' in args) else ''
open(${JSON.stringify(log)}, 'a').write(json.dumps({'args': args, 'stdin': stdin[:4000]}) + '\\n')
if args[:2] == ['status', '--json']:
    print(json.dumps({'api_version': 1, 'server': 'down' if down else 'up', 'default_model': 'gemma4-e4b-warm', 'warm': not down, 'latency_class': 'down' if down else 'warm'}))
elif args[:2] == ['models', '--json']:
    print(json.dumps({'default': 'gemma4-e4b-warm', 'resident': [], 'available': [],
        'tiers': [{'alias': 'small', 'model': 'gemma4-e4b-warm'}, {'alias': 'big', 'model': 'gemma4:26b'}, {'alias': 'code', 'model': 'qwen3.6:35b-a3b'}],
        'gemini': [{'name': 'gemini-3.8-flash', 'default': False}, {'name': 'gemini-3.5-flash', 'default': True}]}))
elif args[:1] == ['gemini']:
    print(json.dumps({'ok': True, 'text': 'Gemini says hello.', 'model': 'gemini-3.5-flash', 'ms': 5}))
elif args[:1] == ['q'] and down:
    print(json.dumps({'t': 'error', 'code': 'server_down', 'message': 'ollama is not running'}))
elif args[:1] == ['q']:
    model = args[args.index('-m') + 1] if '-m' in args else 'gemma4-e4b-warm'
    q = args[-1]
    said = ('Seen the chat so far. ' if 'Earlier in this chat' in q else '') + 'Local answer from ' + model + '.'
    if 'Show your thinking' in q:
        said = '<think>\\nWeigh the two points first.\\n</think>\\n\\n- point one\\n- point two'
    if 'Fail please' in q:
        print(json.dumps({'t': 'error', 'code': 'timeout', 'message': 'took too long'}))
        sys.exit(0)
    if 'Stream code' in q:
        import time
        for part in ['Here:\\n\\n', '\`\`\`js\\n', 'const a = 1;\\n', 'const b = 2;\\n']:
            print(json.dumps({'t': 'chunk', 'text': part}), flush=True)
            time.sleep(0.6)
        said = '\`\`\`\\n\\nDone.'
    print(json.dumps({'t': 'chunk', 'text': said}))
    print(json.dumps({'t': 'done', 'model': model, 'ms': 1234, 'truncated': False, 'tokens_in': 1204, 'tokens_out': 388}))
`, { mode: 0o755 });
  const hostPath = join(profile, 'llm_host_launcher.py');
  // A stand-in for `see`, the local vision reader, logged like lm.
  const fakeSee = join(profile, 'fake_see.py');
  writeFileSync(fakeSee, `#!/usr/bin/env python3
import json, sys
args = sys.argv[1:]
open(${JSON.stringify(log)}, 'a').write(json.dumps({'args': ['see', *args], 'stdin': ''}) + '\\n')
print(json.dumps({'ok': True, 'text': 'A screenshot with a blue Save button.', 'model': 'minicpm-v4.6', 'ms': 30}))
`, { mode: 0o755 });
  writeFileSync(hostPath, `#!/usr/bin/env python3
import os, runpy
os.environ['BFB_LM_BIN'] = ${JSON.stringify(fake)}
os.environ['BFB_SEE_BIN'] = ${JSON.stringify(fakeSee)}
runpy.run_path(${JSON.stringify(join(ROOT, 'native', 'llm_host.py'))}, run_name='__main__')
`, { mode: 0o755 });
  writeFileSync(join(dir, 'com.better_file_browser.llm.json'), JSON.stringify({
    name: 'com.better_file_browser.llm', description: 'llm host (e2e)', path: hostPath, type: 'stdio',
    allowed_origins: [`chrome-extension://${extensionId(ROOT)}/`],
  }, null, 2));
  return log;
}

const ROOT = resolve(new URL('..', import.meta.url).pathname);
// gcc's composer runs under bun; the stand-in for its command needs the full path.
export const BUN = ['/opt/homebrew/bin/bun', '/usr/local/bin/bun', join(homedir(), '.bun', 'bin', 'bun')].find(p => existsSync(p)) ?? 'bun';
// gcc's decision-page registry for one run; the live one is never touched.
const dpRegistry = profile => join(profile, 'decision-pages');
// Where the host and a walk's own bfb-docs calls keep comment state for one run.
const docsHome = profile => join(profile, 'bfb-docs-state');
export const SHOTS = join(ROOT, 'e2e', 'shots');

export function findChrome() {
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
    'readme.md': '---\ntitle: Fixture\ntags: demo\n---\n# Fixture\n\nA **markdown** file with a [link](notes.txt).\n\n- one\n- two\n- [x] done\n- [ ] open\n\n```js\nconst a = 1;\n```\n\n```mermaid\nflowchart LR\n  A[Start] --> B[Finish]\n```\n\n| k | v |\n|---|---|\n| a | 1 |\n',
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

// On macOS a headless Chrome draws no new frames while the display sleeps,
// so a screenshot of a page that has gone still waits forever. Keep the
// display awake for as long as this run lives.
function keepDisplayAwake() {
  if (process.platform !== 'darwin') return;
  try { spawn('caffeinate', ['-u', '-d', '-w', String(process.pid)], { stdio: 'ignore' }).unref(); } catch { /* not fatal */ }
}

export async function launch({ headless = true, pickReply, lmStub = false } = {}) {
  keepDisplayAwake();
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

  // Settings live in chrome.storage.local, which only extension contexts can
  // reach; the service worker is the one that is always there.
  const swTarget = await browser.waitForTarget(t => t.type() === 'service_worker' && t.url().includes('/background.js'), { timeout: 10_000 });
  const sw = await swTarget.worker();
  store = {
    get: key => sw.evaluate(k => chrome.storage.local.get(k).then(r => r[k] ?? null), key),
    set: (key, value) => sw.evaluate((k, v) => chrome.storage.local.set({ [k]: v }), key, typeof value === 'string' ? value : JSON.stringify(value)),
    remove: key => sw.evaluate(k => chrome.storage.local.remove(k), key),
    json: async (key, fallback) => { const v = await store.get(key); try { return v === null ? fallback : JSON.parse(v); } catch { return fallback; } },
    // Read, change and write back one JSON value, such as the settings object.
    edit: async (key, change, fallback = {}) => { const v = await store.json(key, fallback); const out = change(v) ?? v; await store.set(key, out); return out; },
  };

  const fixture = makeFixture();
  // After launch: a pre-existing profile folder makes Chrome skip loading
  // the unpacked extension; the manifest is only read when a port opens.
  installNotesHost(profile, pickReply);
  const lmLog = lmStub ? installLlmHost(profile) : null;
  const lmCalls = () => { try { return readFileSync(lmLog, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch { return []; } };

  async function open(dirPath = fixture) {
    const page = await browser.newPage();
    page.on('pageerror', e => console.error('[pageerror]', e.message));
    page.on('console', m => { if (m.type() === 'error') console.error('[console]', m.text()); });
    // A fresh target occasionally detaches mid-navigation on a busy browser; one retry covers it.
    try { await page.goto('file://' + dirPath + '/', { waitUntil: 'load' }); }
    catch (err) {
      if (!/detached/.test(String(err))) throw err;
      await new Promise(r => setTimeout(r, 400));
      await page.goto('file://' + dirPath + '/', { waitUntil: 'load' });
    }
    await page.waitForSelector('#fe', { timeout: 10_000 });
    return page;
  }

  async function close() {
    await browser.close();
    rmSync(profile, { recursive: true, force: true });
    rmSync(fixture, { recursive: true, force: true });
    rmSync(notesDir, { recursive: true, force: true });
  }

  return { browser, fixture, notesDir, open, close, store, sw, docsHome: docsHome(profile), lmCalls, lmDown: join(profile, 'lm-down'), dpRegistry: dpRegistry(profile), dpCalls: join(profile, 'dp-calls.jsonl'), dpReach: join(profile, 'dp-reach.json'), dpDown: join(profile, 'dp-down'), dpBroken: join(profile, 'dp-broken'), dpNotify: join(profile, 'dp-notify.json') };
}

// The extension's settings store for the running browser; set by launch().
export let store = null;

// BFB_THEME=light (or --light) runs the same checks on the light theme;
// screenshots get a -light suffix so both sets sit side by side.
export const THEME = process.env.BFB_THEME === 'light' || process.argv.includes('--light') ? 'light' : 'dark';

export async function applyTheme(page) {
  if (THEME === 'dark') return;
  await store.set('bfb-theme', 'light');
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe');
}

export async function shot(page, name) {
  const file = join(SHOTS, `${name}${THEME === 'light' ? '-light' : ''}.png`);
  await page.screenshot({ path: file });
  return file;
}
