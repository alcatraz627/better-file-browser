// A made-up notes store shaped like the one Switchboard and the phone share:
// notes named by the moment they were made (20261009-203134.md), Switchboard's
// front matter (JSON-quoted title, created, pinned, color, tags, pos), notes
// titled by their first line, a note with both sides of a clash, an empty
// note, an attachments folder, and a git history that ignores .trash. The
// notes walks copy this instead of anyone's real notes.
//
//   node e2e/make-notes-store.mjs <folder>        (or import makeNotesStore)
import { mkdirSync, writeFileSync, rmSync, utimesSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { deflateSync, crc32 } from 'node:zlib';

const fm = (fields, body) => `---\n${Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\n${body}`;

// [file, text, the title every app should show]
const NOTES = [
  ['20260929-195411.md', fm({ title: '"Groceries for Sunday"', created: '2026-09-29T14:24:11Z', color: 'purple', pos: 'a' }, 'eggs\nmilk\n'), 'Groceries for Sunday'],
  ['20260930-145139.md', fm({ title: '"Call the bank"', created: '2026-09-30T09:21:39Z', pinned: 'true', color: 'blue' }, 'About the refinance, before Friday.\n'), 'Call the bank'],
  ['20260930-210441.md', fm({ title: '"Deck links"', created: '2026-09-30T15:34:41Z', pinned: 'true', color: 'green', tags: '"work, deck"' }, 'file:///tmp/deck/deck.html?s=11\n\nbanner at the start\nfavicon\n'), 'Deck links'],
  ['20261002-233707.md', fm({ title: '"Reading list"', created: '2026-10-02T18:07:07Z', tags: '"books"', pos: 'b' }, '- The Mythical Man-Month\n- A Pattern Language\n'), 'Reading list'],
  ['20261003-000506.md', fm({ created: '2026-10-02T18:35:06Z', color: 'red' }, '# Trip packing\n\n- charger\n- passport\n'), 'Trip packing'],
  ['20261003-152440.md', '# Plain heading note\n\nNo front matter at all.\n', 'Plain heading note'],
  ['20261003-152458.md', 'First line is the title\n\nand this is the body.\n', 'First line is the title'],
  ['20261004-150347.md', fm({ title: '"Agent: weekly summary"', created: '2026-10-04T09:33:47Z', tags: '"agent"' }, 'Written by an agent.\n'), 'Agent: weekly summary'],
  ['20261009-203134.md', fm({ title: '"Both sides"', created: '2026-10-09T15:01:34Z' }, '<<<<<<< ours\nkept here\n=======\nkept there\n>>>>>>> theirs\n'), 'Both sides'],
  ['20261010-203425-f574.md', fm({ title: '"Phone note one"', created: '2026-10-10T15:04:25Z', pos: 'c' }, 'from the phone\n'), 'Phone note one'],
  ['20261010-203426-01f4.md', fm({ title: '"Phone note two"', created: '2026-10-10T15:04:26Z', pos: 'd' }, 'also from the phone\n'), 'Phone note two'],
  ['20261011-031023.md', fm({ title: '"A very long title that keeps going well past the width of any sidebar row so it has to be cut"', created: '2026-10-10T21:40:23Z' }, 'long\n'), 'A very long title that keeps going well past the width of any sidebar row so it has to be cut'],
  ['20261015-122422.md', fm({ title: '"Tagged twice"', created: '2026-10-15T06:54:22Z', tags: '"home, todo"' }, 'tags\n'), 'Tagged twice'],
  ['meeting-notes.md', '# Meeting notes\n\nA note bfb named after its title.\n', 'Meeting notes'],
  ['ideas.md', 'Ideas\n\n- one\n- two\n', 'Ideas'],
  ['untitled-20261022153635.md', '', null],
];

// A solid-colour PNG, w x h, for the image walks.
function png(w, h, [r, g, b]) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => [r, g, b]).flat())]);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(Array.from({ length: h }, () => row)))), chunk('IEND', Buffer.alloc(0))]);
}

export function makeNotesStore(dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, 'attachments'), { recursive: true });
  writeFileSync(join(dir, 'attachments', 'pic.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20" fill="#3c6"/></svg>');
  writeFileSync(join(dir, 'attachments', 'groceries-photo.png'), png(64, 48, [60, 140, 200]));
  writeFileSync(join(dir, '.gitignore'), '.trash/\n');
  for (const [file, text] of NOTES) writeFileSync(join(dir, file), text);
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ notes: NOTES.map(([file, , t]) => ({ file, expect_title: t })) }, null, 2));
  const git = (...a) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=T', '-C', dir, ...a], { stdio: 'pipe' });
  git('init', '-q');
  git('add', '-A');
  git('commit', '-qm', 'notes');
  // A second saved version of the pinned notes, for Versions.
  for (const [file, text] of NOTES.filter(([, t]) => /pinned: true/.test(t))) writeFileSync(join(dir, file), text + '\nedited later\n');
  git('commit', '-qam', 'edit');
  // Files written in one go share a second; give each its own hour so an
  // order that falls back to file time has something to sort by.
  NOTES.forEach(([file], i) => { const t = new Date(Date.UTC(2026, 9, 20, i)); utimesSync(join(dir, file), t, t); });
  return dir;
}

/// The store a notes walk copies: BFB_NOTES_SRC when it names a scratch or
/// generated store, otherwise a fresh generated one. A real Notes folder is
/// refused: walks never read the owner's notes.
export function notesSource() {
  const src = process.env.BFB_NOTES_SRC;
  if (!src) return makeNotesStore(join(tmpdir(), `bfb-made-notes-${process.pid}`));
  if (/\/Notes\/?$/.test(src) && !/scratch|fuzz|made/.test(src)) throw new Error('refusing to copy a real Notes folder; leave BFB_NOTES_SRC unset to use a generated store');
  return src;
}

/// Where a walk keeps its own copy: BFB_NOTES_SCRATCH, or a fresh temp folder.
/// Never the source itself, which the walk clears before copying.
export function scratchStore(src, name) {
  const store = process.env.BFB_NOTES_SCRATCH || join(tmpdir(), `bfb-${name}-${process.pid}`);
  if (resolve(store) === resolve(src)) throw new Error('BFB_NOTES_SCRATCH is the source store; the walk would clear it');
  return store;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const dir = process.argv[2];
  if (!dir) { console.error('usage: node e2e/make-notes-store.mjs <folder>'); process.exit(2); }
  console.log(makeNotesStore(dir));
}
