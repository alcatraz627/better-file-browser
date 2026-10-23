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
import { addTurn, allChats, chatsFor, chatsUnder, deleteChat, turnMeta, withHistory, type AskChat, type AskTurn } from './ask-history';
import { addPaletteSource, bind } from './commands';
import { closeOpenFence, isImageName, quoteMarkdown, quoteTargets, resolveMention, secondOpinion, sendQuote, splitThinking, takeQuote, type ModelOpt } from './ask-quote';
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
        <div class="fe-ask-files" id="fe-ask-files" hidden></div>
        <textarea id="fe-ask-q" rows="1" placeholder="Ask about ${what}" spellcheck="false" title="Enter asks; Shift+Enter starts a new line; start with @code or @gemini to ask that model"></textarea>
        <div class="fe-ask-foot"><span class="fe-ask-ctx" title="${esc(key)}">${app.fileMode ? UI_ICON.file ?? '' : ''}<span>${esc(subject)}</span></span>
          <button type="button" class="btn fe-ask-ib" data-icon id="fe-ask-attach" title="Attach files from this folder, or drop a file here" aria-label="Attach files">${UI_ICON.attach}</button>
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
  // Files sent with every question until removed, as full paths.
  let attached: string[] = [];

  const model = () => pick.value || app.settings.aiModel || '';
  const isCloud = () => model().startsWith('gemini:');
  // The name an answer is filed under before the host reports its own.
  let defaultName = '';
  const modelName = () => model().replace(/^gemini:/, '') || defaultName || 'default';
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
    defaultName = a.kind === 'ready' ? opts[0].label ?? '' : '';
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
  const nameOf = (p: string) => p.split('/').filter(Boolean).pop() ?? p;
  const fileChip = (p: string, remove = false) => `<span class="chip fe-ask-file" data-size="sm" title="${esc(p)}">${isImageName(p) ? UI_ICON.image : UI_ICON.file}<span>${esc(nameOf(p))}</span>${remove ? `<button type="button" class="btn" data-icon data-size="xs" data-unattach="${esc(p)}" title="Remove" aria-label="Remove ${esc(nameOf(p))}">${UI_ICON.close}</button>` : ''}</span>`;
  const turnEl = (question: string, files: string[] = [], via = '') => {
    const turn = document.createElement('div');
    turn.className = 'fe-ask-turn';
    turn.innerHTML = `${via ? `<div class="fe-ask-via">${UI_ICON.opinion}<span>${esc(via)}</span></div>` : `<div class="fe-ask-q">${esc(question)}</div>`}${files.length ? `<div class="fe-ask-qfiles">${files.map(f => fileChip(f)).join('')}</div>` : ''}<div class="fe-ask-a fe-md"><span class="fe-ask-wait">Thinking…</span></div>
      <div class="fe-ask-foot2"><span class="fe-ask-meta"></span><span class="fe-ask-acts">
        <button type="button" class="btn" data-icon data-size="xs" data-act="copy" title="Copy this answer">${UI_ICON.copy}</button>
        <button type="button" class="btn" data-icon data-size="xs" data-act="quote" title="Quote this answer into a chat (q)">${UI_ICON.quote}</button>
        <button type="button" class="btn" data-icon data-size="xs" data-act="other" title="Ask another model to check this answer">${UI_ICON.opinion}</button></span></div>`;
    thread.appendChild(turn);
    syncEmpty();
    return turn;
  };
  // An answer as it reads: a model's thinking folds into one row above what
  // it said. While it streams, the answer is drawn as markdown with any open
  // code fence closed, and the thinking as plain text.
  const paint = (turn: HTMLElement, text: string, done: boolean) => {
    const out = turn.querySelector<HTMLElement>('.fe-ask-a')!;
    const { thinking, answer, open } = splitThinking(text);
    answers.set(turn, answer);
    const words = thinking ? thinking.split(/\s+/).filter(Boolean).length : 0;
    const think = thinking ? `<details class="fe-ask-think"><summary>${UI_ICON.ai}<span>${open ? 'Thinking' : 'Thought it through'}</span><span class="fe-ask-think-n">${words} word${words === 1 ? '' : 's'}</span></summary><div class="fe-md">${done ? renderMarkdown(thinking) : esc(thinking)}</div></details>` : '';
    const was = out.querySelector<HTMLDetailsElement>('.fe-ask-think')?.open;
    out.innerHTML = think + renderMarkdown(done ? answer : closeOpenFence(answer));
    if (was) out.querySelector<HTMLDetailsElement>('.fe-ask-think')!.open = true;
  };
  // A turn that failed says why in plain words and offers to ask again.
  const asks = new WeakMap<HTMLElement, { intent: string; question?: string; model?: string; shown?: string; via?: string }>();
  const paintError = (turn: HTMLElement, code: string, message: string) => {
    turn.querySelector('.fe-ask-a')!.innerHTML = `<div class="fe-ask-err">${UI_ICON.info}<span>${esc(LLM_ERROR_TEXT[code] ?? (message || 'The model did not answer.'))}</span><button type="button" class="btn" data-size="sm" data-variant="outline" data-act="retry" title="Ask this again">Retry</button></div>`;
    turn.querySelector('.fe-ask-meta')!.textContent = '';
  };
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
      const el = turnEl(t.q, t.files, t.via);
      asks.set(el, { intent: t.intent ?? 'qa', question: t.intent && t.intent !== 'qa' ? undefined : t.q });
      if (t.error) { paintError(el, t.error, ''); continue; }
      paint(el, t.a, true);
      el.querySelector('.fe-ask-meta')!.textContent = turnMeta(t);
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

  // One turn's own choices: a model other than the picker's (from @name or a
  // second opinion), the text shown in place of the question, and a label
  // saying which answer a second opinion checks.
  interface TurnOpts { model?: string; shown?: string; via?: string }
  async function ask(intent: string, question?: string, o: TurnOpts = {}): Promise<void> {
    if (go.disabled && !o.model) return;
    cancel?.();
    const shown = o.shown ?? question ?? (intent === 'folder' ? 'What is in here?' : intent === 'summarize' ? 'Summarize' : 'Explain');
    const files = attached.slice();
    const useModel = o.model ?? model();
    const turn = turnEl(shown, attached, o.via);
    asks.set(turn, { intent, question, ...o });
    turn.scrollIntoView({ block: 'end' });
    const out = turn.querySelector<HTMLElement>('.fe-ask-a')!;
    const meta = turn.querySelector<HTMLElement>('.fe-ask-meta')!;
    const started = Date.now();
    const save = (t: AskTurn) => {
      if (!chatId) chatId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      turns.push(t);
      addTurn(key, chatId, t);
      syncHistN();
    };
    const base: Omit<AskTurn, 'a' | 'ms'> = { q: shown, model: useModel.replace(/^gemini:/, '') || modelName(), at: started,
      ...(intent === 'qa' ? {} : { intent }), ...(attached.length ? { files: attached.slice() } : {}), ...(o.via ? { via: o.via } : {}) };
    const steps: string[] = [];
    let c: { ctx: string; name: string };
    try { c = await context(); }
    catch { paintError(turn, 'unreadable', 'Could not read this to send it.'); return; }
    let full = '';
    let frame = 0;
    go.classList.add('stop'); go.title = 'Stop'; go.setAttribute('aria-label', 'Stop');
    const done = () => { cancel = null; cancelAnimationFrame(frame); go.classList.remove('stop'); go.title = 'Ask (Enter)'; go.setAttribute('aria-label', 'Ask'); };
    const asked = intent === 'folder' ? 'What is in this folder? Group the files by purpose in a few short lines.' : question;
    // Stopping, a new chat or opening another chat all end the answer here:
    // the button returns to Ask and what arrived is kept, marked as stopped.
    let over = false;
    const stopped = () => {
      if (over) return;
      over = true; done();
      if (!full.trim()) { out.textContent = 'Stopped before an answer came.'; return; }
      paint(turn, full, true);
      const t: AskTurn = { ...base, a: full, ms: Date.now() - started, stopped: true };
      meta.textContent = turnMeta(t);
      save(t);
    };
    const stop = llmQuery(
      {
        ctx: c.ctx, ctxName: c.name,
        // The host knows summarize, explain-code and qa; a folder question is a qa.
        intent: intent === 'explain' ? 'explain-code' : intent === 'summarize' ? 'summarize' : 'qa',
        question: asked && intent === 'qa' ? withHistory(turns.filter(t => !t.error && !t.via), asked) : asked,
        model: useModel || undefined,
        // lm gemini's own default; a local model keeps the shorter one.
        timeout: useModel.startsWith('gemini:') ? 300 : undefined,
        files: files.length ? files : undefined,
      },
      {
        // Reading an image takes a while; each one shows as a step until the answer starts.
        onStep: s => { steps.push(s); if (!full) out.innerHTML = steps.map(x => `<div class="fe-ask-step">${UI_ICON.image}<span>${esc(x)}…</span></div>`).join(''); },
        // At most one paint per frame, however fast the text arrives.
        onChunk: t => { full += t; frame ||= requestAnimationFrame(() => { frame = 0; paint(turn, full, false); }); },
        onDone: info => {
          over = true; done();
          paint(turn, full, true);
          const read = steps.map(s => esc(s.replace(/^Reading/, 'Read')));
          if (read.length === 1) out.insertAdjacentHTML('afterbegin', `<div class="fe-ask-step fe-ask-work">${UI_ICON.image}<span>${read[0]}</span></div>`);
          else if (read.length) out.insertAdjacentHTML('afterbegin', `<details class="fe-ask-think fe-ask-work"><summary>${UI_ICON.image}<span>Read ${read.length} images</span></summary><div class="fe-md">${read.map(s => `<p>${s}</p>`).join('')}</div></details>`);
          const t: AskTurn = { ...base, a: full, model: info.model || base.model, ms: info.ms, tokensIn: info.tokensIn, tokensOut: info.tokensOut };
          meta.textContent = turnMeta(t, info.truncated);
          save(t);
        },
        onError: (code, message) => {
          over = true; done();
          if (code === 'cancelled') return;
          paintError(turn, code, message);
          save({ ...base, a: '', ms: 0, error: code });
        },
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
    if (btn.dataset.act === 'retry') { const a = turn && asks.get(turn); if (a) void ask(a.intent, a.question, a); return; }
    if (btn.dataset.act === 'other' && turn) { askOther(turn, btn); return; }
    const text = selected() || (inBar ? (hoverBlock ? blockText(hoverBlock) : '') : turn ? answers.get(turn) ?? '' : '');
    if (btn.dataset.act === 'copy') copyText(text);
    else quote(text, btn);
  });
  // The models the picker offers, for @name and for a second opinion.
  const modelOpts = (): ModelOpt[] => { try { return JSON.parse(pick.dataset.opts || '[]'); } catch { return []; } };
  const menuOf = (anchor: HTMLElement, head: string, rows: { label: string; sub?: string; icon: string }[], onPick: (i: number) => void, keepOpen = false) => {
    const menu = document.createElement('div');
    menu.className = 'fe-ctx fe-ask-qmenu';
    menu.innerHTML = `<div class="fe-ask-qmenu-h">${esc(head)}</div>` + rows.map((r, i) => `<div class="row fe-ctx-item" data-i="${i}">${r.icon}<span class="fe-ask-qmenu-t"><span>${esc(r.label)}</span>${r.sub ? `<span class="fe-ask-qmenu-s">${esc(r.sub)}</span>` : ''}</span></div>`).join('');
    let layer: Layer | null = null;
    menu.addEventListener('click', e => {
      const row = (e.target as Element).closest<HTMLElement>('.fe-ctx-item');
      if (!row) return;
      if (!keepOpen) layer?.close('pick');
      onPick(Number(row.dataset.i));
      if (keepOpen) row.classList.toggle('on');
    });
    layer = openLayer(menu, { kind: 'popover', anchor, align: 'end', role: 'menu', label: head });
    return menu;
  };
  // Another model checks an answer; its reply lands as a new turn.
  const askOther = (turn: HTMLElement, anchor: HTMLElement) => {
    const answer = answers.get(turn) ?? '';
    const asked = asks.get(turn);
    if (!answer || !asked) return;
    const opts = modelOpts().filter(o => o.value);
    menuOf(anchor, 'Ask another model to check this', opts.map(o => ({ label: o.label, icon: o.value.startsWith('gemini:') ? UI_ICON.info : UI_ICON.ai })), i => {
      const o = opts[i];
      const label = o.label.replace(/ \(default\)$/, '');
      void ask('qa', secondOpinion(asked.question ?? asked.shown ?? '', answer), { model: o.value, shown: `Second opinion from ${label}`, via: `Second opinion from ${label}` });
    });
  };

  // Attachments: chips above the box, from the attach menu or a dropped file link.
  const filesBox = el('fe-ask-files');
  const paintFiles = () => {
    filesBox.hidden = !attached.length;
    filesBox.innerHTML = attached.map(p => fileChip(p, true)).join('');
  };
  const attach = (p: string) => { if (!attached.includes(p)) { attached.push(p); paintFiles(); } };
  filesBox.addEventListener('click', e => {
    const b = (e.target as Element).closest<HTMLElement>('[data-unattach]');
    if (b) { attached = attached.filter(p => p !== b.dataset.unattach); paintFiles(); q.focus(); }
  });
  el('fe-ask-attach').addEventListener('click', async e => {
    const anchor = e.currentTarget as HTMLElement;
    const dir = app.folderPath.replace(/\/?$/, '/');
    let entries: Entry[] = [];
    try { entries = (await listDir(fileHref(dir))).filter(x => !x.isDir && !x.isParent && !x.name.startsWith('.') && dir + x.name !== app.rawPath); }
    catch { app.toast('Could not list this folder'); return; }
    if (!entries.length) { app.toast('No other files in this folder'); return; }
    const menu = menuOf(anchor, 'Attach from this folder', entries.slice(0, 60).map(x => ({ label: x.name, icon: isImageName(x.name) ? UI_ICON.image : UI_ICON.file })), i => {
      const p = dir + entries[i].name;
      if (attached.includes(p)) { attached = attached.filter(x => x !== p); paintFiles(); } else attach(p);
    }, true);
    menu.querySelectorAll<HTMLElement>('.fe-ctx-item').forEach((r, i) => r.classList.toggle('on', attached.includes(dir + entries[i].name)));
  });
  // A file link dragged from the listing, the sidebar or a tab carries its file:// address.
  const formBox = box.querySelector<HTMLElement>('.fe-ask-box')!;
  formBox.addEventListener('dragover', e => { if (e.dataTransfer?.types.includes('text/uri-list')) { e.preventDefault(); formBox.classList.add('drop'); } });
  formBox.addEventListener('dragleave', () => formBox.classList.remove('drop'));
  formBox.addEventListener('drop', e => {
    formBox.classList.remove('drop');
    const uris = (e.dataTransfer?.getData('text/uri-list') ?? '').split(/\r?\n/).filter(u => u.startsWith('file://'));
    if (!uris.length) return;
    e.preventDefault();
    for (const u of uris) attach(decodeURIComponent(new URL(u).pathname));
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
    // "@code why…" asks that model this once; the picker stays as it was.
    const at = resolveMention(text, modelOpts());
    if (at) void ask('qa', at.question, { model: at.model, shown: text });
    else void ask('qa', text);
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
