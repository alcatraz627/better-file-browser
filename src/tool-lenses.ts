// Two sidebar lenses that act on what is open: Search finds text in the
// files of this folder (and its subfolders), and Ask puts a question about
// this file or folder to a model (local, or Gemini when picked), keeping the chats. Both draw their rows with the
// shared row spec and start work only when the person asks for it.
import type { App } from './app';
import type { Entry } from './types';
import { el } from './el';
import { esc, fileHref, pageHref } from './utils';
import { fetchFileText } from './file-fetch';
import { parseListing } from './parse';
import { crawl, relativeName } from './deep-search';
import { EMPTY_FIND, isTextCandidate, searchContents, type FindQuery } from './find';
import { icoFile } from './icons';
import { llmAvailability, llmModels, llmQuery, LLM_ERROR_TEXT } from './llm';
import { addTurn, allChats, chatsFor, deleteChat, withHistory, type AskChat, type AskTurn } from './ask-history';
import { addPaletteSource } from './commands';
import { openLayer, type Layer } from './layer';
import { kvGet, kvSet } from './kv';
import { UI_ICON } from './control-icons';
import { checkHtml, ddHtml, upgradeControls, type DropdownEl, type Opt } from './controls';
import { renderMarkdown } from './renderers';

const listDir = async (url: string): Promise<Entry[]> => parseListing(await fetchFileText(url), url);
const extOf = (name: string) => (name.includes('.') ? name.split('.').pop()!.toLowerCase() : 'txt');

export function initToolLenses(app: App): void {
  initSearch(app);
  initAsk(app);
}

// ── Search ──────────────────────────────────────────────────────────

const SEARCH_MAX_FILES = 2000;

function initSearch(app: App): void {
  const box = document.getElementById('fe-srch');
  if (!box) return;
  box.innerHTML = `
    <div class="fe-tl-form">
      <input id="fe-srch-q" class="fe-tl-input" type="search" placeholder="Search" spellcheck="false" autocomplete="off" title="Enter searches the text of every file here">
      <div class="fe-tl-opts">
        ${checkHtml('fe-srch-deep', 'Subfolders', 'Subfolders: search every folder under this one too', true)}
        ${checkHtml('fe-srch-case', 'Match case', 'Match upper and lower case exactly')}
      </div>
    </div>
    <div id="fe-srch-status" class="fe-hint">Type a word and press Enter.</div>
    <div id="fe-srch-list"></div>`;
  const q = el<HTMLInputElement>('fe-srch-q');
  const status = el('fe-srch-status');
  const list = el('fe-srch-list');
  let run = 0;

  async function search(): Promise<void> {
    const term = q.value.trim();
    const mine = ++run;
    const cancelled = () => mine !== run;
    list.innerHTML = '';
    if (!term) { status.textContent = 'Type a word and press Enter.'; return; }
    const root = fileHref(app.folderPath.replace(/\/?$/, '/'));
    const deep = el<HTMLInputElement>('fe-srch-deep').checked;
    status.textContent = deep ? 'Listing folders…' : 'Searching…';
    let files: Entry[];
    try {
      files = deep
        ? (await crawl(root, listDir, { maxEntries: SEARCH_MAX_FILES }, cancelled)).entries
        : await listDir(root);
    } catch { if (!cancelled()) status.textContent = 'Could not list this folder.'; return; }
    if (cancelled()) return;
    files = files.filter(f => !f.isDir && !f.isParent && isTextCandidate(f));
    const query: FindQuery = { ...EMPTY_FIND, text: term, caseSensitive: el<HTMLInputElement>('fe-srch-case').checked };
    const res = await searchContents(files, fetchFileText, query,
      (done, total) => { if (!cancelled()) status.textContent = `Searching ${done} of ${total} files…`; }, cancelled);
    if (cancelled()) return;
    const hits = [...res.hits].sort((a, b) => b[1].count - a[1].count);
    const total = hits.reduce((n, [, h]) => n + h.count, 0);
    status.textContent = hits.length
      ? `${total} match${total === 1 ? '' : 'es'} in ${hits.length} file${hits.length === 1 ? '' : 's'}`
      : `No file here contains "${term}".`;
    list.innerHTML = hits.map(([href, h]) => {
      const name = relativeName(href, root);
      const snip = `${esc(h.line.slice(0, h.start))}<mark>${esc(h.line.slice(h.start, h.end))}</mark>${esc(h.line.slice(h.end))}`;
      return `<a class="fe-si fe-srch-hit" href="${esc(pageHref(href))}" title="${esc(name)}, line ${h.lineNumber}">${icoFile(extOf(name))}<span class="fe-srch-tx"><span class="fe-sl">${esc(name)}</span><span class="fe-srch-snip">${snip}</span></span><span class="fe-rc-ago">${h.count}</span></a>`;
    }).join('');
  }
  q.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); void search(); }
    else if (e.key === 'Escape') { q.value = ''; run++; list.innerHTML = ''; status.textContent = 'Type a word and press Enter.'; }
  });
  document.addEventListener('bfb-lens', e => { if ((e as CustomEvent).detail === 'search') q.focus({ preventScroll: true }); });
}

// ── Ask ─────────────────────────────────────────────────────────────

const ASK_MODEL_KEY = 'bfb-ask-model-v1';
const when = (at: number) => new Date(at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function initAsk(app: App): void {
  const box = document.getElementById('fe-ask');
  if (!box) return;
  const subject = app.fileMode ? app.fileName : (app.folderPath.split('/').filter(Boolean).pop() || '/');
  // Chats are kept per file or folder, by its full path.
  const key = app.fileMode ? decodeURIComponent(location.pathname) : app.folderPath;
  const quick = app.fileMode
    ? [['summarize', 'Summarize'], ['explain', 'Explain']]
    : [['folder', 'What is in here?']];
  const what = app.fileMode ? 'this file' : 'this folder';
  box.innerHTML = `
    <div class="fe-ask-top">
      <span class="fe-ask-model"><span class="dot"></span>${ddHtml('fe-ask-model', [{ value: '', label: 'Default' }], "Which model answers. Local models run on this machine; Gemini runs on Google's servers.")}</span>
      <span class="fe-ask-sp"></span>
      <button type="button" class="btn fe-ask-ib" data-icon id="fe-ask-new" title="New chat">${UI_ICON.add}</button>
      <button type="button" class="btn fe-ask-ib" data-icon id="fe-ask-hist-btn" title="Earlier chats about ${what}" aria-expanded="false">${UI_ICON.clock}<span class="fe-ask-n" id="fe-ask-hist-n"></span></button>
      <div class="fe-ask-hist" id="fe-ask-hist" hidden></div>
    </div>
    <div class="fe-ask-status" id="fe-ask-status" hidden><span class="dot"></span><span id="fe-ask-state">Not checked yet</span></div>
    <p class="fe-ask-cloud" id="fe-ask-cloud" hidden>${UI_ICON.info}<span>Sends ${app.fileMode ? 'the text' : 'the listing'} to Google</span></p>
    <div id="fe-ask-thread"></div>
    <div class="fe-ask-empty" id="fe-ask-empty"><p>Ask anything about ${what}.</p><div class="fe-ask-quick">${quick.map(([k, l]) => `<button type="button" class="fe-chip fe-ask-chip" data-intent="${k}">${l}</button>`).join('')}</div></div>
    <div class="fe-ask-form">
      <div class="fe-ask-box">
        <textarea id="fe-ask-q" rows="1" placeholder="Ask about ${what}" spellcheck="false" title="Enter asks; Shift+Enter starts a new line"></textarea>
        <div class="fe-ask-foot"><span class="fe-ask-ctx" title="${esc(app.fileMode ? decodeURIComponent(location.pathname) : app.folderPath)}">${app.fileMode ? UI_ICON.file ?? '' : ''}<span>${esc(subject)}</span></span>
          <button type="button" class="btn fe-ask-send" data-icon data-variant="solid" id="fe-ask-go" title="Ask (Enter)" aria-label="Ask">${UI_ICON.send ?? '↑'}</button></div>
      </div>
    </div>`;
  const thread = el('fe-ask-thread');
  const q = el<HTMLTextAreaElement>('fe-ask-q');
  const go = el<HTMLButtonElement>('fe-ask-go');
  const statusRow = el('fe-ask-status');
  const state = el('fe-ask-state');
  upgradeControls(box);
  const pick = el<DropdownEl>('fe-ask-model');
  const cloud = el('fe-ask-cloud');
  const hist = el('fe-ask-hist');
  const histBtn = el('fe-ask-hist-btn');
  const histN = el('fe-ask-hist-n');
  const emptyBox = el('fe-ask-empty');
  const chipDot = box.querySelector<HTMLElement>('.fe-ask-model .dot')!;
  const syncEmpty = () => { emptyBox.hidden = thread.children.length > 0; };
  // The box grows with what is typed, up to a few lines, then scrolls.
  const grow = () => { q.style.height = 'auto'; q.style.height = Math.min(q.scrollHeight, 140) + 'px'; };
  q.addEventListener('input', grow);
  let cancel: (() => void) | null = null;
  let checked = false;
  let localReady = false;
  let chatId = '';
  let turns: AskTurn[] = [];

  const model = () => pick.value || app.settings.aiModel || '';
  const isCloud = () => model().startsWith('gemini:');
  // A cloud model answers even when the local server is down.
  const syncUsable = () => {
    const usable = localReady || isCloud();
    q.disabled = go.disabled = !usable;
    box!.querySelectorAll<HTMLButtonElement>('.fe-ask-chip').forEach(b => { b.disabled = !usable; });
    cloud.hidden = !isCloud();
  };

  async function checkModel(): Promise<void> {
    checked = true;
    state.textContent = 'Checking the local model…';
    const [a, models] = await Promise.all([llmAvailability(), llmModels()]);
    const kind = a.kind === 'ready' ? (a.cold ? 'cold' : 'ready') : a.kind;
    statusRow.className = `fe-ask-status ${kind}`;
    statusRow.hidden = a.kind === 'ready';
    state.textContent = a.kind === 'ready' ? '' : a.kind === 'down' ? LLM_ERROR_TEXT.server_down : LLM_ERROR_TEXT.unavailable;
    chipDot.className = `dot ${kind}`;
    chipDot.title = a.kind === 'ready' ? (a.cold ? 'Loads on the first question' : 'Ready') : state.textContent;
    localReady = a.kind === 'ready';
    const saved = kvGet(ASK_MODEL_KEY) ?? '';
    const opts: Opt[] = [
      { value: '', label: a.kind === 'ready' ? a.status.default_model.replace(/:latest$/, '') : 'Default' },
      ...models.tiers.map(t => ({ value: t.alias, label: t.alias, hint: t.model, group: 'On this machine' })),
      ...models.gemini.map(g => ({ value: `gemini:${g.name}`, label: g.name + (g.default ? ' (default)' : ''), group: "Gemini, on Google's servers" })),
    ];
    pick.setOptions(opts);
    pick.value = opts.some(o => o.value === saved) ? saved : '';
    syncUsable();
  }
  pick.addEventListener('change', () => { kvSet(ASK_MODEL_KEY, pick.value); syncUsable(); });

  // What the model reads: the file's text, or the folder's listing.
  async function context(): Promise<{ ctx: string; name: string }> {
    if (app.fileMode) return { ctx: await fetchFileText(location.href.split('#')[0]), name: app.fileName };
    const url = fileHref(app.folderPath.replace(/\/?$/, '/'));
    const rows = (await listDir(url)).filter(e => !e.isParent).map(e => `${e.name}${e.isDir ? '/' : ''}\t${e.isDir ? '' : e.rawBytes + ' bytes'}`);
    return { ctx: `Folder ${app.folderPath}\n${rows.join('\n')}`, name: subject };
  }

  const turnEl = (question: string) => {
    const turn = document.createElement('div');
    turn.className = 'fe-ask-turn';
    turn.innerHTML = `<div class="fe-ask-q">${esc(question)}</div><div class="fe-ask-a fe-md"><span class="fe-ask-wait">Thinking…</span></div><div class="fe-ask-meta"></div>`;
    thread.appendChild(turn);
    syncEmpty();
    return turn;
  };
  const metaText = (m: string, ms: number, truncated = false) => `${m} · ${(ms / 1000).toFixed(1)}s${truncated ? ' · shortened to fit' : ''}`;
  const syncHistN = () => { const n = chatsFor(key).length; histN.textContent = n ? String(n) : ''; };
  const newChat = () => { cancel?.(); chatId = ''; turns = []; thread.innerHTML = ''; syncEmpty(); q.focus(); };
  const openChat = (c: AskChat) => {
    cancel?.();
    chatId = c.id; turns = c.turns.slice();
    thread.innerHTML = '';
    for (const t of turns) {
      const el = turnEl(t.q);
      el.querySelector('.fe-ask-a')!.innerHTML = renderMarkdown(t.a);
      el.querySelector('.fe-ask-meta')!.textContent = t.model === 'stopped' ? 'Stopped' : metaText(t.model, t.ms);
    }
    syncEmpty();
    showHist(false);
  };
  const paintHist = () => {
    const chats = chatsFor(key);
    hist.innerHTML = chats.length ? chats.map(c => `<div class="fe-ask-h${c.id === chatId ? ' on' : ''}" data-chat="${esc(c.id)}">
        <button type="button" class="fe-ask-h-open" title="Open this chat"><span class="fe-ask-h-t">${esc(c.title)}</span><span class="fe-ask-h-m">${esc(when(c.at))} · ${c.turns.length} question${c.turns.length === 1 ? '' : 's'}</span></button>
        <button type="button" class="fe-ask-h-del" title="Delete this chat" aria-label="Delete this chat">${UI_ICON.close}</button>
      </div>`).join('') : '<p class="fe-ask-h-none">No earlier chats about this yet</p>';
  };
  let histLayer: Layer | null = null;
  const showHist = (on: boolean) => {
    if (!on) { histLayer?.close('api'); return; }
    hist.hidden = false;
    paintHist();
    histLayer = openLayer(hist, { kind: 'popover', anchor: histBtn, align: 'end', onClose: () => { hist.hidden = true; histBtn.classList.remove('on'); } });
    if (histLayer.open) histBtn.classList.add('on'); else hist.hidden = true;
  };

  async function ask(intent: string, question?: string): Promise<void> {
    if (go.disabled) return;
    cancel?.();
    const shown = question ?? (intent === 'folder' ? 'What is in here?' : intent === 'summarize' ? 'Summarize' : 'Explain');
    const turn = turnEl(shown);
    turn.scrollIntoView({ block: 'end' });
    const out = turn.querySelector<HTMLElement>('.fe-ask-a')!;
    const meta = turn.querySelector<HTMLElement>('.fe-ask-meta')!;
    let c: { ctx: string; name: string };
    try { c = await context(); }
    catch { out.textContent = 'Could not read this to send it.'; return; }
    let full = '';
    go.classList.add('stop'); go.title = 'Stop'; go.setAttribute('aria-label', 'Stop');
    const done = () => { cancel = null; go.classList.remove('stop'); go.title = 'Ask (Enter)'; go.setAttribute('aria-label', 'Ask'); };
    const asked = intent === 'folder' ? 'What is in this folder? Group the files by purpose in a few short lines.' : question;
    // Stopping, a new chat or opening another chat all end the answer here:
    // the button returns to Ask and what arrived is kept, marked as stopped.
    let over = false;
    const stopped = () => {
      if (over) return;
      over = true; done();
      if (!full.trim()) { out.textContent = 'Stopped before an answer came.'; return; }
      out.innerHTML = renderMarkdown(full);
      meta.textContent = 'Stopped';
      if (!chatId) chatId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const t: AskTurn = { q: shown, a: full + '\n\n*(stopped)*', model: 'stopped', ms: 0, at: Date.now() };
      turns.push(t);
      addTurn(key, chatId, t);
      syncHistN();
    };
    const stop = llmQuery(
      {
        ctx: c.ctx, ctxName: c.name,
        // The host knows summarize, explain-code and qa; a folder question is a qa.
        intent: intent === 'explain' ? 'explain-code' : intent === 'summarize' ? 'summarize' : 'qa',
        question: asked && intent === 'qa' ? withHistory(turns, asked) : asked,
        model: model() || undefined,
        // lm gemini's own default; a local model keeps the shorter one.
        timeout: isCloud() ? 300 : undefined,
      },
      {
        onChunk: t => { full += t; out.textContent = full; },
        onDone: info => {
          over = true; done();
          out.innerHTML = renderMarkdown(full);
          meta.textContent = metaText(info.model, info.ms, info.truncated);
          if (!chatId) chatId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
          const t: AskTurn = { q: shown, a: full, model: info.model, ms: info.ms, at: Date.now() };
          turns.push(t);
          addTurn(key, chatId, t);
          syncHistN();
        },
        onError: (code, message) => { over = true; done(); if (code !== 'cancelled') out.textContent = LLM_ERROR_TEXT[code] ?? message; },
      });
    cancel = () => { stop(); stopped(); };
  }

  box.addEventListener('click', e => {
    const t = e.target as Element;
    const chip = t.closest<HTMLElement>('.fe-ask-chip');
    if (chip) { void ask(chip.dataset.intent!); return; }
    const row = t.closest<HTMLElement>('.fe-ask-h');
    if (row && t.closest('.fe-ask-h-del')) { deleteChat(key, row.dataset.chat!); if (row.dataset.chat === chatId) newChat(); paintHist(); syncHistN(); return; }
    if (row && t.closest('.fe-ask-h-open')) { const c = chatsFor(key).find(x => x.id === row.dataset.chat); if (c) openChat(c); }
  });
  el('fe-ask-new').addEventListener('click', () => { showHist(false); newChat(); });
  histBtn.addEventListener('click', () => showHist(hist.hidden));
  go.addEventListener('click', () => {
    if (cancel) { cancel(); return; }
    const text = q.value.trim();
    if (!text) { q.focus(); return; }
    q.value = ''; grow();
    void ask('qa', text);
  });
  q.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go.click(); }
  });
  syncHistN();
  // Every chat is in the palette's Chats tab. One about this page opens here;
  // one about another file or folder opens there, through #ask=<chat>.
  const reopen = (id: string) => {
    const c = chatsFor(key).find(x => x.id === id);
    if (!c) return;
    app.showLens?.('ask');
    openChat(c);
  };
  addPaletteSource(() => allChats().slice(0, 60).map(({ subject, chat }) => ({
    title: chat.title, sub: `${subject.split('/').filter(Boolean).pop() || '/'} · ${when(chat.at)}`, group: 'Chats', tab: 'chats' as const, icon: UI_ICON.ai,
    run: () => { if (subject === key) reopen(chat.id); else app.strip.go(subject, '#ask=' + encodeURIComponent(chat.id)); },
  })));
  const askHash = /^#ask=(.+)$/.exec(location.hash);
  if (askHash) setTimeout(() => reopen(decodeURIComponent(askHash[1])), 0);
  document.addEventListener('bfb-lens', e => {
    if ((e as CustomEvent).detail !== 'ask') return;
    if (!checked) void checkModel();
    q.focus({ preventScroll: true });
  });
}
