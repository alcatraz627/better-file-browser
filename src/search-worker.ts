import { scanContent, type FindQuery } from './find';

type WorkerRequest = { id: number; text: string; query: FindQuery } | { type: 'names'; entries: { href: string; name: string }[]; pattern: string };

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  if (!('id' in event.data)) {
    try {
      const regex = new RegExp(event.data.pattern, 'i');
      const matched = event.data.entries.filter(entry => regex.test(entry.name)).map(entry => entry.href);
      self.postMessage({ type: 'name-result', matched });
    } catch { self.postMessage({ type: 'name-result', error: 'Invalid name regex' }); }
    return;
  }
  const { id, text, query } = event.data;
  self.postMessage({ id, started: true });
  try { self.postMessage({ id, hit: scanContent(text, query) }); }
  catch (error) { self.postMessage({ id, error: String(error) }); }
};
