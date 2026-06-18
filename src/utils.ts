import type { Entry, Settings } from './types';

export function esc(s: unknown): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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

export function fmtType(e: Entry): string {
  if (e.isParent) return '';
  if (e.isDir)    return 'Folder';
  if (!e.name.includes('.')) return 'File';
  return e.name.split('.').pop()!.toUpperCase() + ' File';
}

export function getExt(e: Entry): string {
  if (e.isDir || e.isParent) return '';
  return e.name.includes('.') ? e.name.split('.').pop()!.toLowerCase() : '';
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
