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
  default_model:   string;
  warm:            boolean;
  latency_class:   'warm' | 'cold' | 'down';
  available_models?: string[];
}

export type LlmAvailability =
  | { kind: 'ready'; cold: boolean; status: LlmStatus }
  | { kind: 'down' }            // lm + host fine, model server down
  | { kind: 'unavailable' };    // host not registered or lm CLI missing

let availCache: { at: number; res: LlmAvailability } | null = null;

export function llmAvailability(): Promise<LlmAvailability> {
  if (availCache && Date.now() - availCache.at < 30_000) return Promise.resolve(availCache.res);
  return new Promise(resolve => {
    let done = false;
    const settle = (res: LlmAvailability) => {
      if (done) return;
      done = true;
      availCache = { at: Date.now(), res };
      resolve(res);
    };
    const port = openProxyPort();
    if (!port) { settle({ kind: 'unavailable' }); return; }
    const timer = setTimeout(() => { try { port.disconnect(); } catch { /* gone */ } settle({ kind: 'unavailable' }); }, 5000);
    port.onMessage.addListener(msg => {
      if (msg?.t !== 'status' && msg?.t !== 'error' && msg?.t !== 'native-gone') return;
      clearTimeout(timer);
      try { port.disconnect(); } catch { /* gone */ }
      if (msg.t === 'status' && msg.data?.server === 'up') {
        settle({ kind: 'ready', cold: msg.data.latency_class !== 'warm', status: msg.data });
      } else if (msg.t === 'status') {
        settle({ kind: 'down' });
      } else {
        settle({ kind: 'unavailable' });   // host missing, lm missing, or host error
      }
    });
    port.onDisconnect.addListener(() => {
      console.info('[BFB] llm status port disconnected:', chrome.runtime.lastError?.message ?? '(no lastError)');
      clearTimeout(timer);
      settle({ kind: 'unavailable' });
    });
    port.postMessage({ op: 'status' });
  });
}

export interface LlmQueryOpts {
  ctx:      string;
  ctxName:  string;
  intent?:  string;
  question?: string;
  timeout?: number;
}
export interface LlmCallbacks {
  onChunk: (text: string) => void;
  onDone:  (info: { model: string; ms: number; truncated: boolean }) => void;
  onError: (code: string, message: string) => void;
}

/** Start a streamed query; the returned function cancels it. */
export function llmQuery(opts: LlmQueryOpts, cb: LlmCallbacks): () => void {
  const port = openProxyPort();
  if (!port) { cb.onError('unavailable', 'AI host not installed'); return () => {}; }
  let finished = false;
  let gotFrame = false;
  const finish = () => { finished = true; try { port.disconnect(); } catch { /* gone */ } };
  port.onMessage.addListener(msg => {
    if (finished || !msg) return;
    if      (msg.t === 'chunk') { gotFrame = true; cb.onChunk(msg.text ?? ''); }
    else if (msg.t === 'done')  { finish(); cb.onDone({ model: msg.model ?? '', ms: msg.ms ?? 0, truncated: !!msg.truncated }); }
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
  port.postMessage({
    op: 'query', ctx: opts.ctx, ctxName: opts.ctxName,
    intent: opts.intent, question: opts.question, timeout: opts.timeout ?? 120,
  });
  return () => finish();
}

/** Human messages keyed by stable error code — never branch on message text. */
export const LLM_ERROR_TEXT: Record<string, string> = {
  server_down:   'Local model server is down — run `lm status` in a terminal.',
  model_missing: 'The model is not available on the server.',
  ctx_too_large: 'This file is too large for the model.',
  timeout:       'The model took too long and was stopped.',
  invalid_args:  'Invalid request.',
  cancelled:     'Cancelled.',
  host_no_lm:    'The lm CLI was not found on this machine.',
  unavailable:   'AI host not installed — run native/install.sh <extension-id>.',
  disconnected:  'The AI host disconnected unexpectedly.',
};
