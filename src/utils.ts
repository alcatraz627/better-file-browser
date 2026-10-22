import type { Entry, Settings } from './types';

export function esc(s: unknown): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// A file:// URL with each path segment encoded, so a # or ? in a name is not
// read as a fragment or query when the browser follows the anchor.
export function fileHref(path: string): string {
  return 'file://' + path.split('/').map(encodeURIComponent).join('/');
}

// Chrome downloads these instead of showing them, so the explorer opens them
// inside their folder's page (folder/#view=name) and renders them there.
export const DOWNLOAD_EXTS = new Set(['yaml', 'yml', 'sql', 'csv', 'tsv', 'xml']);

/** The address that shows a file in the explorer: its own URL, or its folder's view route for a download type. */
export function pageHref(href: string): string {
  if (!/^[a-z]+:/i.test(href) && typeof location !== 'undefined') { try { href = new URL(href, location.href).href; } catch { /* keep as is */ } }
  const m = href.match(/^(file:\/\/[^?#]*\/)([^/?#]+)$/);
  if (!m || !m[2].includes('.')) return href;
  return DOWNLOAD_EXTS.has(m[2].split('.').pop()!.toLowerCase()) ? `${m[1]}#view=${m[2]}` : href;
}

export function fmtSize(b: number): string {
  if (b < 0 || b === 0) return '—';
  if (b < 1024)         return b + ' B';
  if (b < 1048576)      return (b / 1024).toFixed(1) + ' KB';
  if (b < 1073741824)   return (b / 1048576).toFixed(1) + ' MB';
  return (b / 1073741824).toFixed(2) + ' GB';
}

// Format a modified-date for display. Prefers the unambiguous epoch (dateMs);
// the raw listing string is a last-resort fallback only, because Chrome renders
// it locale-formatted (e.g. "12/06/2026") which new Date() misreads as MM/DD.
export function fmtDate(dateMs: number, settings?: Pick<Settings, 'dateFormat'>, rawFallback = ''): string {
  let d: Date | null = null;
  if (Number.isFinite(dateMs)) {
    d = new Date(dateMs);
  } else if (rawFallback) {
    const p = new Date(rawFallback);
    if (!isNaN(p.getTime())) d = p;
  }
  if (!d || isNaN(d.getTime())) return rawFallback || '—';
  const fmt = settings?.dateFormat ?? 'short';
  return d.toLocaleDateString('en-US',
    fmt === 'full'
      ? { month: 'long',  day: 'numeric', year: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' },
  );
}

// A file type's name in words, the one place the listing, the preview header
// and the file bar all read it from.
const KINDS: Record<string, string> = {
  md: 'Markdown', mdx: 'MDX', txt: 'Text', log: 'Log', json: 'JSON', jsonl: 'JSON Lines', ndjson: 'JSON Lines', jsonc: 'JSON',
  yaml: 'YAML', yml: 'YAML', toml: 'TOML', xml: 'XML', csv: 'CSV', tsv: 'TSV', sql: 'SQL', html: 'HTML', htm: 'HTML',
  css: 'CSS', scss: 'SCSS', js: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript', ts: 'TypeScript', tsx: 'TypeScript',
  jsx: 'JavaScript', py: 'Python', rb: 'Ruby', go: 'Go', rs: 'Rust', java: 'Java', kt: 'Kotlin', swift: 'Swift',
  c: 'C', h: 'C header', cpp: 'C++', cs: 'C#', php: 'PHP', sh: 'Shell', bash: 'Shell', zsh: 'Shell', fish: 'Shell',
  env: 'Env', ini: 'INI', conf: 'Config', diff: 'Diff', patch: 'Patch', svg: 'SVG', proto: 'Protobuf', graphql: 'GraphQL',
  png: 'PNG image', jpg: 'JPEG image', jpeg: 'JPEG image', gif: 'GIF image', webp: 'WebP image', heic: 'HEIC image',
  ico: 'Icon', pdf: 'PDF', zip: 'ZIP archive', gz: 'Gzip archive', tar: 'Tar archive', dmg: 'Disk image',
  mp4: 'Video', mov: 'Video', mp3: 'Audio', wav: 'Audio', makefile: 'Makefile', dockerfile: 'Dockerfile', gitignore: 'Git ignore',
};
export const kindName = (ext: string): string => KINDS[ext.toLowerCase()] ?? (ext ? `${ext.toUpperCase()} file` : 'File');

export function fmtType(e: Entry): string {
  if (e.isParent) return '';
  if (e.isDir)    return 'Folder';
  return kindName(getExt(e));
}

const DOTFILE_KINDS = new Set(['env', 'gitignore', 'dockerignore', 'npmrc', 'editorconfig']);

export function getExt(e: Entry): string {
  if (e.isDir || e.isParent) return '';
  const bare = e.name.split('/').pop()!.toLowerCase();
  if (['dockerfile', 'containerfile', 'makefile', 'gitignore'].includes(bare)) return bare;
  // A dotfile's name is not an extension (.DS_Store is not a "DS_STORE file"),
  // except the few whose name says what they hold.
  if (bare.startsWith('.') && bare.indexOf('.', 1) === -1) return DOTFILE_KINDS.has(bare.slice(1)) ? bare.slice(1) : '';
  const ext = bare.includes('.') ? bare.split('.').pop()! : '';
  return ext.length > 10 ? '' : ext;   // a long tail after a dot is part of the name
}

/** Absolute path of an entry within rawPath (dirs get a trailing slash). */
export function fullPath(rawPath: string, e: Pick<Entry, 'name' | 'isDir'>): string {
  return rawPath.replace(/\/$/, '') + '/' + e.name + (e.isDir ? '/' : '');
}

/** Copy text to the clipboard with an execCommand fallback. Resolves to success. */
export function copyToClipboard(text: string): Promise<boolean> {
  return navigator.clipboard.writeText(text).then(() => true).catch(() => {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch { return false; }
  });
}

/// A long title cut in two so one line can keep both ends: the head takes the ellipsis, the tail stays whole.
export function splitMiddle(text: string, tail = 10): { head: string; tail: string } {
  const chars = Array.from(text);
  if (chars.length <= tail + 6) return { head: text, tail: '' };
  return { head: chars.slice(0, chars.length - tail).join(''), tail: chars.slice(chars.length - tail).join('') };
}

/// The one-line, middle-truncated title markup; CSS (.fe-mid) does the cutting at whatever width the row has.
export function midHtml(text: string): string {
  const { head, tail } = splitMiddle(text);
  return `<span class="fe-mid"><span class="fe-mid-h">${esc(head)}</span>${tail ? `<span class="fe-mid-t">${esc(tail)}</span>` : ''}</span>`;
}
