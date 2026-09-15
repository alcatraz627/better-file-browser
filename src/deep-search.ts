// Walk a folder tree and return every entry with its path relative to the
// root, so the listing filter can match against "src/app/main.ts". Pure:
// the caller supplies how a folder is listed, so tests run on a fake tree.
import type { Entry } from './types';

export interface CrawlOptions {
  maxDepth?:      number;               // folders below the root; default 8
  maxEntries?:    number;               // stop collecting past this; default 5000
  includeHidden?: boolean;              // descend into dot-folders; default false
  skipDirs?:      Set<string>;          // never descend into these names
  onProgress?:    (folders: number, entries: number) => void;
}

export interface CrawlResult {
  entries:   Entry[];
  folders:   number;      // folders listed, root included
  truncated: boolean;     // hit maxEntries or maxDepth somewhere
  cancelled: boolean;
}

export const DEFAULT_SKIP_DIRS = new Set(['node_modules', '.git', '.svn', '.hg', '__pycache__', '.venv', 'venv']);

const CONCURRENCY = 4;

export function relativeName(href: string, rootUrl: string): string {
  const rel = href.startsWith(rootUrl) ? href.slice(rootUrl.length) : href;
  let out: string;
  try { out = decodeURIComponent(rel); } catch { out = rel; }
  return out.replace(/\/$/, '');
}

export async function crawl(
  rootUrl: string,
  listDir: (url: string) => Promise<Entry[]>,
  opts: CrawlOptions = {},
  isCancelled: () => boolean = () => false,
): Promise<CrawlResult> {
  const maxDepth   = opts.maxDepth   ?? 8;
  const maxEntries = opts.maxEntries ?? 5000;
  const skip       = opts.skipDirs   ?? DEFAULT_SKIP_DIRS;
  const entries: Entry[] = [];
  let folders = 0, truncated = false;

  // Breadth-first so shallow matches land before deep ones, with a small pool
  // of folder reads in flight at once.
  let queue: { url: string; depth: number }[] = [{ url: rootUrl, depth: 0 }];
  while (queue.length && !isCancelled() && entries.length < maxEntries) {
    const batch = queue.splice(0, CONCURRENCY);
    const listed = await Promise.all(batch.map(async b => {
      try { return { b, kids: await listDir(b.url) }; }
      catch { return { b, kids: [] as Entry[] }; }
    }));
    for (const { b, kids } of listed) {
      folders++;
      for (const k of kids) {
        if (k.isParent) continue;
        if (entries.length >= maxEntries) { truncated = true; break; }
        const name = relativeName(k.href, rootUrl);
        const hiddenSeg = name.split('/').some(s => s.startsWith('.'));
        entries.push({ ...k, name, isHidden: hiddenSeg });
        if (!k.isDir) continue;
        if (skip.has(k.name) || (!opts.includeHidden && k.name.startsWith('.'))) continue;
        if (b.depth + 1 > maxDepth) { truncated = true; continue; }
        queue.push({ url: k.href, depth: b.depth + 1 });
      }
    }
    opts.onProgress?.(folders, entries.length);
  }
  return { entries, folders, truncated, cancelled: isCancelled() };
}
