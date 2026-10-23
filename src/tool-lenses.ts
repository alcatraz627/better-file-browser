// Two sidebar lenses that act on what is open: Search finds text in the
// files of this folder (and its subfolders), and Ask puts a question about
// this file or folder to a model (local, or Gemini when picked), keeping the chats. Both draw their rows with the
// shared row spec and start work only when the person asks for it.
import type { App } from './app';
import type { Entry } from './types';
import { el } from './el';
import { copyToClipboard, esc, fileHref, pageHref } from './utils';
import { fetchFileText } from './file-fetch';
import { parseListing } from './parse';
import { crawl, relativeName } from './deep-search';
import { EMPTY_FIND, isTextCandidate, searchContents, type FindQuery } from './find';
import { icoFile } from './icons';
import { llmAvailability, llmModels, llmQuery, LLM_ERROR_TEXT } from './llm';
import { addTurn, allChats, chatsFor, chatsUnder, deleteChat, withHistory, type AskChat, type AskTurn } from './ask-history';
import { addPaletteSource, bind } from './commands';
import { quoteMarkdown, quoteTargets, sendQuote, splitThinking, takeQuote } from './ask-quote';
import { openLayer, type Layer } from './layer';
import { textPref } from './storage';
import { UI_ICON } from './control-icons';
import { checkHtml, ddHtml, upgradeControls, type DropdownEl, type Opt } from './controls';
import { renderMarkdown } from './renderers';
import { emptyHtml } from './empty-state';

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
      <input id="fe-srch-q" class="tb fe-tl-input" data-size="lg" data-lead="search" type="search" placeholder="Search" spellcheck="false" autocomplete="off" title="Enter searches the text of every file here">
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
      return `<a class="row fe-si fe-srch-hit" href="${esc(pageHref(href))}" title="${esc(name)}, line ${h.lineNumber}">${icoFile(extOf(name))}<span class="fe-srch-tx"><span class="fe-sl">${esc(name)}</span><span class="fe-srch-snip">${snip}</span></span><span class="fe-rc-ago">${h.count}</span></a>`;
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

const askModelPref = textPref('bfb-ask-model-v1');
const when = (at: number) => new Date(at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function initAsk(app: App): void {
  const box = document.getElementById('fe-ask');
  if (!box) return;
  const subject = app.fileMode ? app.fileName : (app.folderPath.split('/').filter(Boolean).pop() || '/');
  // Chats are kept per file or folder, by its full path. A file shown as a
  // folder's #view= page has the folder as its URL path, so rawPath is used.
  const key = app.fileMode ? app.rawPath : app.folderPath;
  const quick = app.fileMode
    ? [['summarize', 'Summarize'], ['explain', 'Explain']]
    : [['folder', 'What is in here?']];
  const what = app.fileMode ? 'this file' : 'this folder';
  box.innerHTML = `
    <div class="fe-ask-top">
      <span class="fe-ask-model"><span class="dot"></span>${ddHtml('fe-ask-model', [{ value: '', label: 'Default' }], "Which model answers. Local models run on this machine; Gemini runs on Google's servers.")}</span>
      <span class="fe-ask-sp"></span>
      <button type="button" class="btn fe-ask-ib" data-icon id="fe-ask-new" title="New chat">${UI_ICON.add}</button>
      <button type="button" class="btn fe-ask-ib" data-icon id="fe-ask-hist-btn" title="Earlier chats about ${app.fileMode ? what : 'this folder and what is in it'}" aria-expanded="false">${UI_ICON.clock}<span class="badge fe-ask-n" data-size="sm" data-tone="solid" id="fe-ask-hist-n"></span></button>
      <div class="fe-ask-hist" id="fe-ask-hist" hidden></div>
    </div>
    <div class="fe-ask-status" id="fe-ask-status" hidden><span class="dot"></span><span id="fe-ask-state">Not checked yet</span></div>
    <p class="fe-ask-cloud" id="fe-ask-cloud" hidden>${UI_ICON.info}<span>Sends ${app.fileMode ? 'the text' : 'the listing'} to Google</span></p>
    <div id="fe-ask-thread"></div>
    <div class="fe-ask-empty" id="fe-ask-empty"><p>Ask anything about ${what}.</p><div class="fe-ask-quick">${quick.map(([k, l]) => `<button type="button" class="btn fe-ask-chip" data-size="sm" data-variant="outline" data-shape="pill" data-intent="${k}">${l}</button>`).join('')}</div></div>
    <div class="fe-ask-form">
      <div class="fe-ask-box">
        <textarea id="fe-ask-q" rows="1" placeholder="Ask about ${what}" spellcheck="false" title="Enter asks; Shift+Enter starts a new line"></textarea>
        <div class="fe-ask-foot"><span class="fe-ask-ctx" title="${esc(key)}">${app.fileMode ? UI_ICON.file ?? '' : ''}<span>${esc(subject)}</span></span>
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
  const syncEmpty = () => { emptyBox.hidden = !!thread.querySelector('.fe-ask-turn'); };
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
    const saved = askModelPref.get();
    const opts: Opt[] = [
      { value: '', label: a.kind === 'ready' ? a.status.default_model.replace(/:latest$/, '') : 'Default' },
      ...models.tiers.map(t => ({ value: t.alias, label: t.alias, hint: t.model, group: 'On this machine' })),
      ...models.gemini.map(g => ({ value: `gemini:${g.name}`, label: g.name + (g.default ? ' (default)' : ''), group: "Gemini, on Google's servers" })),
    ];
    pick.setOptions(opts);
    pick.value = opts.some(o => o.value === saved) ? saved : '';
    syncUsable();
  }
  pick.addEventListener('change', () => { askModelPref.set(pick.value); syncUsable(); });

  // What the model reads: the file's text, or the folder's listing.
  async function context(): Promise<{ ctx: string; name: string }> {
    if (app.fileMode) return { ctx: await fetchFileText(location.href.split('#')[0]), name: app.fileName };
    const url = fileHref(app.folderPath.replace(/\/?$/, '/'));
    const rows = (await listDir(url)).filter(e => !e.isParent).map(e => `${e.name}${e.isDir ? '/' : ''}\t${e.isDir ? '' : e.rawBytes + ' bytes'}`);
    return { ctx: `Folder ${app.folderPath}\n${rows.join('\n')}`, name: subject };
  }

  // What each turn's answer said, for its Copy and Quote buttons.
  const answers = new WeakMap<HTMLElement, string>();
  const turnEl = (question: string) => {
    const turn = document.createElement('div');
    turn.className = 'fe-ask-turn';
    turn.innerHTML = `<div class="fe-ask-q">${esc(question)}</div><div class="fe-ask-a fe-md"><span class="fe-ask-wait">Thinking…</span></div>
      <div class="fe-ask-foot2"><span class="fe-ask-meta"></span><span class="fe-ask-acts">
        <button type="button" class="btn" data-icon data-size="xs" data-act="copy" title="Copy this answer">${UI_ICON.copy}</button>
        <button type="button" class="btn" data-icon data-size="xs" data-act="quote" title="Quote this answer into a chat (q)">${UI_ICON.quote}</button></span></div>`;
    thread.appendChild(turn);
    syncEmpty();
    return turn;
  };
  // An answer as it reads: a model's thinking folds into one row above what
  // it said. While the answer streams, both show as plain text.
  const paint = (turn: HTMLElement, text: string, done: boolean) => {
    const out = turn.querySelector<HTMLElement>('.fe-ask-a')!;
    const { thinking, answer, open } = splitThinking(text);
    answers.set(turn, answer);
    const words = thinking ? thinking.split(/\s+/).filter(Boolean).length : 0;
    const think = thinking ? `<details class="fe-ask-think"><summary>${UI_ICON.ai}<span>${open ? 'Thinking' : 'Thought it through'}</span><span class="fe-ask-think-n">${words} word${words === 1 ? '' : 's'}</span></summary><div class="fe-md">${done ? renderMarkdown(thinking) : esc(thinking)}</div></details>` : '';
    const was = out.querySelector<HTMLDetailsElement>('.fe-ask-think')?.open;
    out.innerHTML = think + (done ? renderMarkdown(answer) : `<div class="fe-ask-raw">${esc(answer)}</div>`);
    if (was) out.querySelector<HTMLDetailsElement>('.fe-ask-think')!.open = true;
  };
  const metaText = (m: string, ms: number, truncated = false) => `${m} · ${(ms / 1000).toFixed(1)}s${truncated ? ' · shortened to fit' : ''}`;
  // On a folder, chats about what is inside it, four levels down, are listed too.
  const listed = () => app.fileMode ? chatsFor(key).map(chat => ({ subject: key, chat })) : chatsUnder(key);
  const below = (subject: string) => subject === key ? '' : subject.slice(key.length).replace(/^\//, '');
  const syncHistN = () => { const n = listed().length; histN.textContent = n ? String(n) : ''; };
  const clearThread = () => thread.querySelectorAll('.fe-ask-turn').forEach(t => t.remove());
  const newChat = () => { cancel?.(); chatId = ''; turns = []; clearThread(); syncEmpty(); q.focus(); };
  const openChat = (c: AskChat) => {
    cancel?.();
    chatId = c.id; turns = c.turns.slice();
    clearThread();
    for (const t of turns) {
      const el = turnEl(t.q);
      paint(el, t.a, true);
      el.querySelector('.fe-ask-meta')!.textContent = t.model === 'stopped' ? 'Stopped' : metaText(t.model, t.ms);
    }
    syncEmpty();
    showHist(false);
  };
  const paintHist = () => {
    const chats = listed();
    hist.innerHTML = chats.length ? chats.map(({ subject, chat: c }) => `<div class="row fe-ask-h${c.id === chatId ? ' on' : ''}" data-chat="${esc(c.id)}" data-subject="${esc(subject)}">
        <button type="button" class="fe-ask-h-open" title="${below(subject) ? `Open this chat about ${esc(below(subject))}` : 'Open this chat'}"><span class="fe-ask-h-t">${esc(c.title)}</span><span class="fe-ask-h-m">${below(subject) ? `${esc(below(subject))} · ` : ''}${esc(when(c.at))} · ${c.turns.length} question${c.turns.length === 1 ? '' : 's'}</span></button>
        <button type="button" class="btn fe-ask-h-del" data-icon data-size="sm" data-tone="danger" title="Delete this chat" aria-label="Delete this chat">${UI_ICON.close}</button>
      </div>`).join('') : emptyHtml('empty', 'No earlier chats about this yet', { inline: true });
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
      paint(turn, full, true);
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
        onChunk: t => { full += t; paint(turn, full, false); },
        onDone: info => {
          over = true; done();
          paint(turn, full, true);
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

  // Copy and Quote act on a selection in the chat first, then on the part
  // under the pointer (a paragraph, list or code block), then on a whole answer.
  const blkBar = document.createElement('div');
  blkBar.className = 'fe-ask-blk';
  blkBar.hidden = true;
  blkBar.innerHTML = `<button type="button" class="btn" data-icon data-size="xs" data-act="copy" title="Copy this part">${UI_ICON.copy}</button><button type="button" class="btn" data-icon data-size="xs" data-act="quote" title="Quote this part into a chat (q)">${UI_ICON.quote}</button>`;
  thread.prepend(blkBar);
  let hoverBlock: HTMLElement | null = null;
  let hoverTurn: HTMLElement | null = null;
  const blockText = (b: HTMLElement) => (b.querySelector('pre')?.textContent ?? b.innerText).trim();
  const selected = () => {
    const s = getSelection();
    const text = s?.toString().trim() ?? '';
    return text && s!.anchorNode && thread.contains(s!.anchorNode) ? text : '';
  };
  thread.addEventListener('mouseover', e => {
    const t = e.target as Element;
    if (blkBar.contains(t)) return;
    hoverTurn = t.closest<HTMLElement>('.fe-ask-turn');
    const b = t.closest<HTMLElement>('.fe-ask-a > .fe-md > *');
    hoverBlock = b;
    blkBar.hidden = !b;
    // The block sits in its turn, and the turn in the thread; both are positioned.
    if (b) blkBar.style.top = `${b.offsetTop + hoverTurn!.offsetTop}px`;
  });
  thread.addEventListener('mouseleave', () => { hoverBlock = hoverTurn = null; blkBar.hidden = true; });
  const fromName = () => (app.fileMode ? app.fileName : subject);
  const copyText = (text: string) => { void copyToClipboard(text).then(ok => app.toast(ok ? 'Copied' : 'Copy failed')); };
  // The quote menu: this chat first, then the chats of open tabs, then recent ones.
  let quoteLayer: Layer | null = null;
  const quote = (text: string, anchor: HTMLElement | null) => {
    if (!text) return;
    const md = quoteMarkdown(text, fromName());
    const targets = quoteTargets({ subject: key, chatId, title: turns[0]?.q ?? 'New chat' },
      app.strip.shown().map(t => t.path), allChats().slice(0, 30), chatsFor);
    const menu = document.createElement('div');
    menu.className = 'fe-ctx fe-ask-qmenu';
    menu.innerHTML = `<div class="fe-ask-qmenu-h">Quote into</div>` + targets.map((t, i) => `<div class="row fe-ctx-item" data-i="${i}" title="${esc(t.subject)}">${t.here ? UI_ICON.ai : UI_ICON.file}<span class="fe-ask-qmenu-t"><span>${esc(t.label)}</span><span class="fe-ask-qmenu-s">${esc(t.title)}</span></span></div>`).join('');
    menu.addEventListener('click', e => {
      const row = (e.target as Element).closest<HTMLElement>('.fe-ctx-item');
      if (!row) return;
      const t = targets[Number(row.dataset.i)];
      quoteLayer?.close('pick');
      if (t.here) { q.value = md + q.value; grow(); q.focus(); q.setSelectionRange(q.value.length, q.value.length); return; }
      sendQuote({ subject: t.subject, chatId: t.chatId, text: md, at: Date.now() });
      app.strip.go(t.subject, '#ask=' + encodeURIComponent(t.chatId));
    });
    const r = (anchor ?? hoverBlock ?? thread).getBoundingClientRect();
    quoteLayer = openLayer(menu, anchor ? { kind: 'popover', anchor, align: 'end', role: 'menu', label: 'Quote into' }
      : { kind: 'popover', place: 'point', point: { x: r.left + 12, y: r.top + 12 }, origin: thread, role: 'menu', label: 'Quote into' });
    menu.querySelector('.fe-ctx-item')?.classList.add('kb');
  };
  thread.addEventListener('click', e => {
    const btn = (e.target as Element).closest<HTMLElement>('[data-act]');
    if (!btn) return;
    const inBar = blkBar.contains(btn);
    const turn = btn.closest<HTMLElement>('.fe-ask-turn');
    const text = selected() || (inBar ? (hoverBlock ? blockText(hoverBlock) : '') : turn ? answers.get(turn) ?? '' : '');
    if (btn.dataset.act === 'copy') copyText(text);
    else quote(text, btn);
  });
  bind('ask-quote', () => quote(selected() || (hoverBlock ? blockText(hoverBlock) : hoverTurn ? answers.get(hoverTurn) ?? '' : ''), null),
    () => !!selected() || !!hoverBlock || !!hoverTurn);

  box.addEventListener('click', e => {
    const t = e.target as Element;
    const chip = t.closest<HTMLElement>('.fe-ask-chip');
    if (chip) { void ask(chip.dataset.intent!); return; }
    const row = t.closest<HTMLElement>('.fe-ask-h');
    const at = row?.dataset.subject ?? key;
    if (row && t.closest('.fe-ask-h-del')) { deleteChat(at, row.dataset.chat!); if (row.dataset.chat === chatId) newChat(); paintHist(); syncHistN(); return; }
    if (row && t.closest('.fe-ask-h-open')) {
      // A chat about something inside this folder opens on that page.
      if (at !== key) { showHist(false); app.strip.go(at, '#ask=' + encodeURIComponent(row.dataset.chat!)); return; }
      const c = chatsFor(key).find(x => x.id === row.dataset.chat); if (c) openChat(c);
    }
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
  // A quote sent here from another page's chat lands in the box.
  const landed = takeQuote(key);
  if (askHash || landed) setTimeout(() => {
    if (askHash) reopen(decodeURIComponent(askHash[1]));
    if (!landed) return;
    app.showLens?.('ask');
    q.value = landed.text + q.value; grow();
    q.focus(); q.setSelectionRange(q.value.length, q.value.length);
  }, 0);
  document.addEventListener('bfb-lens', e => {
    if ((e as CustomEvent).detail !== 'ask') return;
    if (!checked) void checkModel();
    q.focus({ preventScroll: true });
  });
}
