// Client for the notes native host: one request, one reply, through the
// background worker's one-shot relay (content scripts cannot connectNative).
// Every call names the notes root the owner picked in Settings.

export interface NoteMeta { rel: string; size: number; mtime: number }
export interface NoteDoc  { rel: string; text: string; mtime: number }

export class NotesError extends Error {
  constructor(public code: string, message: string) { super(message); this.name = 'NotesError'; }
}

type Frame =
  | { t: 'stat'; root: string; count: number }
  | { t: 'list'; notes: NoteMeta[] }
  | { t: 'note'; rel: string; text: string; mtime: number }
  | { t: 'written'; rel: string; mtime: number }
  | { t: 'renamed'; rel: string; to: string }
  | { t: 'deleted'; rel: string; trashed: string }
  | { t: 'error'; code: string; message: string };

const HOST = 'com.better_file_browser.notes';

function call(payload: Record<string, unknown>): Promise<Frame> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage({ type: 'bfb-native-oneshot', host: HOST, payload }, res => {
        if (chrome.runtime.lastError || !res) return reject(new NotesError('unavailable', chrome.runtime.lastError?.message || 'no reply'));
        if (!res.ok) return reject(new NotesError('unavailable', res.error || 'notes host not installed'));
        const f = res.response as Frame;
        if (f.t === 'error') return reject(new NotesError(f.code, f.message));
        resolve(f);
      });
    } catch (e) { reject(new NotesError('unavailable', String(e))); }
  });
}

export const notes = {
  stat:   (root: string) => call({ op: 'stat', root }) as Promise<{ t: 'stat'; root: string; count: number }>,
  list:   (root: string) => call({ op: 'list', root }).then(f => (f as { notes: NoteMeta[] }).notes),
  read:   (root: string, rel: string) => call({ op: 'read', root, rel }) as Promise<NoteDoc>,
  write:  (root: string, rel: string, text: string, expectMtime?: number) =>
            call({ op: 'write', root, rel, text, expectMtime }) as Promise<{ rel: string; mtime: number }>,
  create: (root: string, rel: string, text = '') => call({ op: 'create', root, rel, text }) as Promise<{ rel: string; mtime: number }>,
  rename: (root: string, rel: string, to: string) => call({ op: 'rename', root, rel, to }),
  writeBinary: (root: string, rel: string, base64: string) =>
            call({ op: 'writeBinary', root, rel, base64 }) as Promise<{ rel: string; mtime: number }>,
  delete: (root: string, rel: string) => call({ op: 'delete', root, rel }),
};

// A note's file name from its first heading or first line, safe for a path.
export function slugForTitle(title: string): string {
  const s = title.replace(/^#+\s*/, '').trim().toLowerCase()
    // Keep letters from any script. The upper bound stays below U+FFFE:
    // Chrome refuses a content script containing a Unicode noncharacter.
    .replace(/[^a-z0-9À-ɏͰ-﷏]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return (s || 'untitled') + '.md';
}

// The title a note shows: front matter title, else first heading, else the
// file name without its extension and dashes.
export function noteTitle(rel: string, text?: string): string {
  if (text) {
    const fm = text.match(/^---\n([\s\S]*?)\n---/);
    const t = fm?.[1].match(/^title:\s*(.+)$/m)?.[1].trim().replace(/^["']|["']$/g, '');
    if (t) return t;
    const h = text.match(/^#\s+(.+)$/m)?.[1].trim();
    if (h) return h;
  }
  return rel.split('/').pop()!.replace(/\.md$/i, '').replace(/[-_]+/g, ' ');
}

export function newNoteText(title: string, now = new Date()): string {
  const iso = now.toISOString();
  return `---\ntitle: ${title}\ntags: []\ncreated: ${iso}\nupdated: ${iso}\n---\n\n# ${title}\n\n`;
}

// Refresh `updated` inside existing front matter; a note without front
// matter is left exactly as written (contract: never add front matter).
export function stampUpdated(text: string, now = new Date()): string {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return text;
  const iso = now.toISOString();
  const fm = /^updated:.*$/m.test(m[1]) ? m[1].replace(/^updated:.*$/m, `updated: ${iso}`) : m[1] + `\nupdated: ${iso}`;
  return text.replace(m[0], `---\n${fm}\n---`);
}
