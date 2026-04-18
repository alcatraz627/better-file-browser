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

export function fmtDate(s: string, settings?: Pick<Settings, 'dateFormat'>): string {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
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
