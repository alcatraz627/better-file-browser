export interface NameEntry { href: string; name: string }

export async function filterNames(entries: NameEntry[], pattern: string, signal: AbortSignal): Promise<Set<string>> {
  const response = await fetch(chrome.runtime.getURL('search-worker.js'), { signal });
  if (!response.ok) throw new Error(`Name matching worker HTTP ${response.status}`);
  const script = await response.text();
  if (signal.aborted) throw new Error('Name matching stopped');
  const url = URL.createObjectURL(new Blob([script], { type: 'text/javascript' }));
  let worker: Worker;
  try { worker = new Worker(url); }
  finally { URL.revokeObjectURL(url); }
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (result?: string[], error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      worker.terminate();
      if (error) reject(error); else resolve(new Set(result));
    };
    const abort = () => finish(undefined, new Error('Name matching stopped'));
    const timer = setTimeout(() => finish(undefined, Object.assign(new Error('Name regex timed out'), { code: 'match-timeout' })), 500);
    signal.addEventListener('abort', abort, { once: true });
    worker.onerror = () => finish(undefined, new Error('Name matching worker failed'));
    worker.onmessage = (event: MessageEvent<{ type: string; matched?: string[]; error?: string }>) => {
      if (event.data.type !== 'name-result') return;
      finish(event.data.matched, event.data.error ? new Error(event.data.error) : undefined);
    };
    if (signal.aborted) abort();
    else worker.postMessage({ type: 'names', entries, pattern });
  });
}
