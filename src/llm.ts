// Talks to the local `lm` CLI through the com.better_file_browser.llm native
// messaging host. Content scripts cannot call connectNative, so each request
// opens a runtime port that the background worker proxies to the native host.
// Disconnecting the port mid-stream is the cancellation path (the host
// SIGTERMs lm, which aborts the generation).
function openProxyPort(): chrome.runtime.Port | null {
  try { return chrome.runtime.connect({ name: 'bfb-llm' }); }
  catch { return null; }
}

export interface LlmStatus {
  api_version:     number;
  server:          'up' | 'down';
  host?:           string;
  default_model:   string;
  warm:            boolean;
  latency_class:   'warm' | 'cold' | 'down';
  resident_models?:  string[];
  available_models?: string[];
  toolkit_version?:  string;
}

export type LlmAvailability =
  | { kind: 'ready'; cold: boolean; status: LlmStatus }
  | { kind: 'down'; status: LlmStatus }   // lm + host fine, model server down
  | { kind: 'unavailable'; reason: string };  // host not registered or lm CLI missing

// The frames the native host (and the background proxy) send over a port.
// Branch on `.t` to narrow. `native-gone` is injected by background.js when the
// native port closes (host exited or was never found).
export type NativeFrame =
  | { t: 'status'; data: LlmStatus }
  | { t: 'chunk'; text: string }
  | { t: 'done'; model: string; ms: number; truncated: boolean; tokens_in?: number; tokens_out?: number }
  | { t: 'step'; text: string }
  | { t: 'error'; code: string; message: string }
  | { t: 'warm'; ok: boolean; on: boolean }
  | { t: 'models'; tiers: ModelTier[]; gemini: GeminiModel[] }
  | { t: 'native-gone'; message?: string };

// No caching: `lm status --json` returns in ~40ms, and a stale cache would
// show "cold" after the user runs `lm warm on`. Always ask fresh.
export function llmAvailability(): Promise<LlmAvailability> {
  return new Promise(resolve => {
    let done = false;
    const settle = (res: LlmAvailability) => {
      if (done) return;
      done = true;
      resolve(res);
    };
    const port = openProxyPort();
    if (!port) { settle({ kind: 'unavailable', reason: 'extension messaging unavailable' }); return; }
    const timer = setTimeout(() => {
      try { port.disconnect(); } catch { /* gone */ }
      settle({ kind: 'unavailable', reason: 'status check timed out' });
    }, 5000);
    port.onMessage.addListener((msg: NativeFrame) => {
      if (msg?.t !== 'status' && msg?.t !== 'error' && msg?.t !== 'native-gone') return;
      clearTimeout(timer);
      try { port.disconnect(); } catch { /* gone */ }
      if (msg.t === 'status' && msg.data?.server === 'up') {
        settle({ kind: 'ready', cold: msg.data.latency_class !== 'warm', status: msg.data });
      } else if (msg.t === 'status') {
        settle({ kind: 'down', status: msg.data });
      } else {
        settle({ kind: 'unavailable', reason: msg.message || 'lm host not found' });
      }
    });
    port.onDisconnect.addListener(() => {
      clearTimeout(timer);
      settle({ kind: 'unavailable', reason: chrome.runtime.lastError?.message || 'lm host not found' });
    });
    port.postMessage({ op: 'status' });
  });
}

// What Ask can pick from, read from lm itself: the local tiers by alias, and
// the gemini lane's models (a cloud service; the file's text leaves the machine).
export interface ModelTier { alias: string; model: string }
export interface GeminiModel { name: string; default: boolean }
export function llmModels(): Promise<{ tiers: ModelTier[]; gemini: GeminiModel[] }> {
  return new Promise(resolve => {
    let done = false;
    const settle = (r: { tiers: ModelTier[]; gemini: GeminiModel[] }) => { if (!done) { done = true; resolve(r); } };
    const port = openProxyPort();
    if (!port) { settle({ tiers: [], gemini: [] }); return; }
    const timer = setTimeout(() => { try { port.disconnect(); } catch { /* gone */ } settle({ tiers: [], gemini: [] }); }, 20_000);
    port.onMessage.addListener((msg: NativeFrame) => {
      if (msg?.t !== 'models' && msg?.t !== 'error' && msg?.t !== 'native-gone') return;
      clearTimeout(timer);
      try { port.disconnect(); } catch { /* gone */ }
      settle(msg.t === 'models' ? { tiers: msg.tiers ?? [], gemini: msg.gemini ?? [] } : { tiers: [], gemini: [] });
    });
    port.onDisconnect.addListener(() => { clearTimeout(timer); settle({ tiers: [], gemini: [] }); });
    port.postMessage({ op: 'models' });
  });
}

export interface LlmQueryOpts {
  ctx:      string;
  ctxName:  string;
  intent?:  string;
  question?: string;
  timeout?: number;
  model?:   string;   // -m override (a model or alias), or gemini:<name>; omitted → lm default model
  /// Files read alongside the page: text goes into the context, images are read by the local vision model.
  files?:   string[];
}
export interface LlmDone { model: string; ms: number; truncated: boolean; tokensIn?: number; tokensOut?: number }
export interface LlmCallbacks {
  onChunk: (text: string) => void;
  onDone:  (info: LlmDone) => void;
  onError: (code: string, message: string) => void;
  /// A step the host takes before answering, such as reading an attached image.
  onStep?: (text: string) => void;
}

/** What the background worker needs to file an answer that finishes after its
 *  page has gone: which chat it belongs to and the turn as it was asked. */
export interface AskJob { id: string; subject: string; chatId: string; turn: Record<string, unknown> }

/** Start a streamed query; the returned function cancels it. With `job`, the
 *  answer belongs to the background worker and keeps going if this page goes. */
export function llmQuery(opts: LlmQueryOpts, cb: LlmCallbacks, job?: AskJob): () => void {
  const port = openProxyPort();
  if (!port) { cb.onError('unavailable', 'AI host not installed'); return () => {}; }
  const stop = follow(port, cb, job?.id);
  port.postMessage({
    op: 'query', ctx: opts.ctx, ctxName: opts.ctxName,
    intent: opts.intent, question: opts.question, timeout: opts.timeout ?? 120,
    model: opts.model, files: opts.files, ...(job ? { job } : {}),
  });
  return stop;
}

/** Pick up an answer still running in the background: `onReplay` gets what
 *  arrived so far, then frames flow as usual. `onGone` means it already ended. */
export function llmAttach(id: string, cb: LlmCallbacks & { onReplay: (text: string, steps: string[]) => void; onGone: () => void }): () => void {
  const port = openProxyPort();
  if (!port) { cb.onGone(); return () => {}; }
  const stop = follow(port, cb, id, cb);
  port.postMessage({ op: 'attach', id });
  return stop;
}

/** Answers running in the background, with what each has said so far. */
export function llmRunning(): Promise<{ id: string; job: AskJob; text: string; steps: string[] }[]> {
  return oneFrame({ op: 'running' }, 'running', m => (m as { jobs?: [] }).jobs ?? [], []);
}

/** Answers that finished while no page watched them; taking them removes them. */
export function llmOrphans(): Promise<{ job: AskJob; text: string; steps: string[]; frame: NativeFrame }[]> {
  return oneFrame({ op: 'orphans' }, 'orphans', m => (m as { list?: [] }).list ?? [], []);
}

function oneFrame<T>(msg: object, t: string, read: (m: unknown) => T, empty: T): Promise<T> {
  return new Promise(resolve => {
    const port = openProxyPort();
    if (!port) { resolve(empty); return; }
    const timer = setTimeout(() => { try { port.disconnect(); } catch { /* gone */ } resolve(empty); }, 3000);
    port.onMessage.addListener((m: { t?: string }) => {
      if (m?.t !== t) return;
      clearTimeout(timer);
      try { port.disconnect(); } catch { /* gone */ }
      resolve(read(m));
    });
    port.onDisconnect.addListener(() => { clearTimeout(timer); resolve(empty); });
    port.postMessage(msg);
  });
}

// Feeds one port's frames to the callbacks; the returned function stops the
// answer (a background job is told to stop, not just left).
function follow(port: chrome.runtime.Port, cb: LlmCallbacks, jobId?: string,
  attach?: { onReplay: (text: string, steps: string[]) => void; onGone: () => void }): () => void {
  let finished = false;
  let gotFrame = false;
  const finish = () => { finished = true; try { port.disconnect(); } catch { /* gone */ } };
  port.onMessage.addListener((msg: NativeFrame | { t: 'replay'; text: string; steps: string[] } | { t: 'gone' }) => {
    if (finished || !msg) return;
    if      (msg.t === 'replay') { gotFrame = true; attach?.onReplay(msg.text ?? '', msg.steps ?? []); }
    else if (msg.t === 'gone')   { finish(); attach?.onGone(); }
    else if (msg.t === 'chunk') { gotFrame = true; cb.onChunk(msg.text ?? ''); }
    else if (msg.t === 'step')  { gotFrame = true; cb.onStep?.(msg.text ?? ''); }
    else if (msg.t === 'done')  { finish(); cb.onDone({ model: msg.model ?? '', ms: msg.ms ?? 0, truncated: !!msg.truncated, tokensIn: msg.tokens_in || undefined, tokensOut: msg.tokens_out || undefined }); }
    else if (msg.t === 'error') { finish(); cb.onError(msg.code ?? 'unknown', msg.message ?? ''); }
    else if (msg.t === 'native-gone') {
      // Host exit after done/error is normal; before any frame it means the
      // host or lm never started.
      finish();
      cb.onError(gotFrame ? 'disconnected' : 'unavailable', msg.message ?? '');
    }
  });
  port.onDisconnect.addListener(() => {
    if (!finished) { finished = true; cb.onError('disconnected', 'AI host disconnected'); }
  });
  return () => {
    if (jobId && !finished) try { port.postMessage({ op: 'cancel', id: jobId }); } catch { /* gone */ }
    finish();
  };
}

/** Warm or unwarm the default model (runs `lm warm on|off`). User-initiated. */
export function llmWarm(on: boolean): Promise<{ ok: boolean; message?: string }> {
  return new Promise(resolve => {
    let done = false;
    const settle = (r: { ok: boolean; message?: string }) => { if (!done) { done = true; resolve(r); } };
    const port = openProxyPort();
    if (!port) { settle({ ok: false, message: 'AI host not installed' }); return; }
    const timer = setTimeout(() => { try { port.disconnect(); } catch { /* gone */ } settle({ ok: false, message: 'timed out' }); }, 30_000);
    port.onMessage.addListener((msg: NativeFrame) => {
      if (msg?.t !== 'warm' && msg?.t !== 'error' && msg?.t !== 'native-gone') return;
      clearTimeout(timer);
      try { port.disconnect(); } catch { /* gone */ }
      settle(msg.t === 'warm' ? { ok: !!msg.ok } : { ok: false, message: msg.message });
    });
    port.onDisconnect.addListener(() => { clearTimeout(timer); settle({ ok: false, message: chrome.runtime.lastError?.message }); });
    port.postMessage({ op: 'warm', on });
  });
}

/** Human messages keyed by stable error code — never branch on message text. */
export const LLM_ERROR_TEXT: Record<string, string> = {
  server_down:   'The local model is not running. Start it with lm in a terminal.',
  model_missing: 'The model is not available on the server.',
  ctx_too_large: 'This file is too large for the model.',
  timeout:       'The model took too long and was stopped.',
  invalid_args:  'Invalid request.',
  cancelled:     'Cancelled.',
  host_no_lm:    'The lm CLI was not found on this machine.',
  unavailable:   'Local AI is not set up. Settings, AI shows how.',
  disconnected:  'The AI host disconnected unexpectedly.',
  gemini_unavailable: 'Gemini did not answer. Check lm gemini in a terminal, or pick a local model.',
};
