import { scanContent, type FindQuery } from './find';

self.onmessage = (event: MessageEvent<{ id: number; text: string; query: FindQuery }>) => {
  const { id, text, query } = event.data;
  self.postMessage({ id, started: true });
  try { self.postMessage({ id, hit: scanContent(text, query) }); }
  catch (error) { self.postMessage({ id, error: String(error) }); }
};
