import type { Entry } from './types';

export function parseEntries(): Entry[] {
  const table = document.querySelector('table') || document.getElementById('listing-table');
  if (!table) return [];
  return Array.from(table.querySelectorAll('tr')).slice(1).flatMap(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length < 2) return [];
    const link = cells[0]?.querySelector('a');
    if (!link) return [];
    const rawName  = link.textContent!.trim();
    const href     = link.getAttribute('href')!;
    const rawBytes = parseInt(cells[1]?.getAttribute('data-value') ?? cells[1]?.textContent ?? '-1');
    const epoch    = parseInt(cells[2]?.getAttribute('data-value') ?? '');
    const dateMs   = Number.isFinite(epoch) ? epoch * 1000 : NaN;
    const dateStr  = cells[2]?.textContent?.trim() ?? '';
    const isParent = href === '../';
    const isDir    = !isParent && (href?.endsWith('/') ?? false);
    const name     = isParent ? '..' : (isDir ? rawName.replace(/\/$/, '') : rawName);
    const isHidden = !isParent && name.startsWith('.');
    return [{ name, href, isDir, isParent, isHidden, rawBytes, dateMs, dateStr }];
  });
}

/**
 * Parse a fetched directory listing into entries. Chrome serves listings as
 * a template populated by inline addRow(...) script calls — DOMParser never
 * executes those, so the <table> path only works for live-DOM HTML; the
 * addRow text fallback covers fetched listings.
 */
export function parseListing(html: string, baseUrl: string): Entry[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const fromTable = parseFetchedDoc(doc, baseUrl);
  if (fromTable.length) return fromTable;
  return parseAddRows(html, baseUrl);
}

/** Extract entries from addRow("name","url",isdir,size,"sizeStr",mtime,"dateStr") calls. */
export function parseAddRows(html: string, baseUrl: string): Entry[] {
  const out: Entry[] = [];
  for (const m of html.matchAll(/addRow\((.*?)\);/g)) {
    try {
      const a = JSON.parse('[' + m[1] + ']');
      const name = String(a[0]), url = String(a[1]);
      if (name === '.' || name === '..') continue;
      const isDir = !!a[2];
      const epoch = typeof a[5] === 'number' ? a[5] : NaN;
      out.push({
        name,
        href:     new URL(url + (isDir ? '/' : ''), baseUrl).href,
        isDir,
        isParent: false,
        isHidden: name.startsWith('.'),
        rawBytes: typeof a[3] === 'number' ? a[3] : -1,
        dateMs:   Number.isFinite(epoch) ? epoch * 1000 : NaN,
        dateStr:  typeof a[6] === 'string' ? a[6] : '',
      });
    } catch { /* malformed addRow line — skip it */ }
  }
  return out;
}

export function parseFetchedDoc(doc: Document, baseUrl: string): Entry[] {
  const table = doc.querySelector('table');
  if (!table) return [];
  return Array.from(table.querySelectorAll('tr')).slice(1).flatMap(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length < 2) return [];
    const link = cells[0]?.querySelector('a');
    if (!link) return [];
    const rawName = link.textContent!.trim();
    const rel     = link.getAttribute('href')!;
    if (rel === '../') return [];
    const href     = new URL(rel, baseUrl).href;
    const isDir    = rel?.endsWith('/') ?? false;
    const name     = isDir ? rawName.replace(/\/$/, '') : rawName;
    const isHidden = name.startsWith('.');
    return [{ name, href, isDir, isParent: false, isHidden, rawBytes: -1, dateMs: NaN, dateStr: '' }];
  });
}
