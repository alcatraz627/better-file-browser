import type { ContentHit, FindQuery } from './find';

interface Pending<T> { resolve(value: T): void; reject(error: Error): void }

export class SearchFileReader {
  private port = chrome.runtime.connect({ name: 'bfb-search-fetch' });
  private pending = new Map<number, Pending<string>>();
  private next = 0;
  private closed = false;

  constructor() {
    this.port.onMessage.addListener((msg: { id: number; ok: boolean; text?: string; error?: string }) => {
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      if (msg.ok) p.resolve(msg.text ?? ''); else p.reject(new Error(msg.error ?? 'read failed'));
    });
    this.port.onDisconnect.addListener(() => this.close());
  }

  read = (href: string): Promise<string> => new Promise((resolve, reject) => {
    if (this.closed) { reject(new Error('search stopped')); return; }
    const id = ++this.next;
    this.pending.set(id, { resolve, reject });
    try { this.port.postMessage({ type: 'read', id, url: new URL(href, location.href).href }); }
    catch (error) { this.pending.delete(id); reject(new Error(String(error))); }
  });

  close(): void {
    if (this.closed) return;
    this.closed = true;
    try { this.port.disconnect(); } catch { /* already disconnected */ }
    for (const p of this.pending.values()) p.reject(new Error('search stopped'));
    this.pending.clear();
  }
}

export class SearchSession extends SearchFileReader {
  private worker: Worker;
  private matches = new Map<number, Pending<ContentHit | null> & { timer?: ReturnType<typeof setTimeout> }>();
  private matchId = 0;
  dead = false;
  failure: string | null = null;

  static async open(): Promise<SearchSession> {
    const response = await fetch(chrome.runtime.getURL('search-worker.js'));
    if (!response.ok) throw new Error(`Search worker HTTP ${response.status}`);
    const script = await response.text();
    const url = URL.createObjectURL(new Blob([script], { type: 'text/javascript' }));
    try { return new SearchSession(new Worker(url)); }
    finally { URL.revokeObjectURL(url); }
  }

  private constructor(worker: Worker) {
    super();
    this.worker = worker;
    this.worker.onmessage = (event: MessageEvent<{ id: number; started?: boolean; hit?: ContentHit | null; error?: string }>) => {
      const msg = event.data;
      const p = this.matches.get(msg.id);
      if (!p) return;
      if (msg.started) {
        p.timer = setTimeout(() => this.failMatches(Object.assign(new Error('Text matching timed out'), { code: 'match-timeout' })), 2000);
        return;
      }
      if (p.timer) clearTimeout(p.timer);
      this.matches.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error)); else p.resolve(msg.hit ?? null);
    };
    this.worker.onerror = () => this.failMatches(new Error('Text matching worker failed'));
  }

  match = (text: string, query: FindQuery): Promise<ContentHit | null> => new Promise((resolve, reject) => {
    if (this.dead) { reject(new Error(this.failure ?? 'search stopped')); return; }
    const id = ++this.matchId;
    this.matches.set(id, { resolve, reject });
    try { this.worker.postMessage({ id, text, query }); }
    catch (error) { this.matches.delete(id); reject(new Error(String(error))); }
  });

  private failMatches(error: Error): void {
    if (this.dead) return;
    this.dead = true;
    this.failure = error.message;
    this.worker?.terminate();
    for (const p of this.matches.values()) {
      if (p.timer) clearTimeout(p.timer);
      p.reject(error);
    }
    this.matches.clear();
  }

  override close(): void {
    super.close();
    this.failMatches(new Error('search stopped'));
  }
}
