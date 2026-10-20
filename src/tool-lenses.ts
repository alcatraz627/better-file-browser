// Two sidebar lenses that act on what is open: Search finds text in the
// files of this folder (and its subfolders), and Ask puts a question about
// this file or folder to the local model. Both draw their rows with the
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
import { llmAvailability, llmQuery, LLM_ERROR_TEXT } from './llm';
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
      <input id="fe-srch-q" class="fe-tl-input" type="search" placeholder="Text in this folder" spellcheck="false" autocomplete="off" title="Enter searches the text of every file here">
      <div class="fe-tl-opts">
        <label class="fe-tl-opt" title="Look inside subfolders too"><input type="checkbox" id="fe-srch-deep" checked>Subfolders</label>
        <label class="fe-tl-opt" title="Match upper and lower case exactly"><input type="checkbox" id="fe-srch-case">Match case</label>
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

function initAsk(app: App): void {
  const box = document.getElementById('fe-ask');
  if (!box) return;
  const subject = app.fileMode ? app.fileName : (app.folderPath.split('/').filter(Boolean).pop() || '/');
  const quick = app.fileMode
    ? [['summarize', 'Summarize'], ['explain', 'Explain']]
    : [['folder', 'What is in here?']];
  box.innerHTML = `
    <div class="fe-ask-status" id="fe-ask-status"><span class="dot"></span><span id="fe-ask-state">Not checked yet</span></div>
    <div class="fe-ask-about">About ${app.fileMode ? 'this file' : 'this folder'}: <b>${esc(subject)}</b></div>
    <div class="fe-ask-quick">${quick.map(([k, l]) => `<button type="button" class="fe-chip fe-ask-chip" data-intent="${k}">${l}</button>`).join('')}</div>
    <div id="fe-ask-thread"></div>
    <div class="fe-tl-form fe-ask-form">
      <textarea id="fe-ask-q" class="fe-tl-input" rows="2" placeholder="Ask about ${app.fileMode ? 'this file' : 'this folder'}" spellcheck="false" title="Enter asks; Shift+Enter starts a new line"></textarea>
      <button type="button" class="btn" data-variant="solid" id="fe-ask-go" title="Ask the local model">Ask</button>
    </div>`;
  const thread = el('fe-ask-thread');
  const q = el<HTMLTextAreaElement>('fe-ask-q');
  const go = el<HTMLButtonElement>('fe-ask-go');
  const statusRow = el('fe-ask-status');
  const state = el('fe-ask-state');
  let cancel: (() => void) | null = null;
  let checked = false;

  async function checkModel(): Promise<void> {
    checked = true;
    state.textContent = 'Checking the local model…';
    const a = await llmAvailability();
    statusRow.className = `fe-ask-status ${a.kind === 'ready' ? (a.cold ? 'cold' : 'ready') : a.kind}`;
    state.textContent = a.kind === 'ready' ? (a.cold ? `${a.status.default_model}, will load on first question` : `${a.status.default_model} is ready`)
      : a.kind === 'down' ? LLM_ERROR_TEXT.server_down : LLM_ERROR_TEXT.unavailable;
  }

  // What the model reads: the file's text, or the folder's listing.
  async function context(): Promise<{ ctx: string; name: string }> {
    if (app.fileMode) return { ctx: await fetchFileText(location.href.split('#')[0]), name: app.fileName };
    const url = fileHref(app.folderPath.replace(/\/?$/, '/'));
    const rows = (await listDir(url)).filter(e => !e.isParent).map(e => `${e.name}${e.isDir ? '/' : ''}\t${e.isDir ? '' : e.rawBytes + ' bytes'}`);
    return { ctx: `Folder ${app.folderPath}\n${rows.join('\n')}`, name: subject };
  }

  async function ask(intent: string, question?: string): Promise<void> {
    cancel?.();
    const turn = document.createElement('div');
    turn.className = 'fe-ask-turn';
    turn.innerHTML = `<div class="fe-ask-q">${esc(question ?? (intent === 'folder' ? 'What is in here?' : intent === 'summarize' ? 'Summarize' : 'Explain'))}</div><div class="fe-ask-a fe-md"><span class="fe-ask-wait">Thinking…</span></div><div class="fe-ask-meta"></div>`;
    thread.appendChild(turn);
    turn.scrollIntoView({ block: 'end' });
    const out = turn.querySelector<HTMLElement>('.fe-ask-a')!;
    const meta = turn.querySelector<HTMLElement>('.fe-ask-meta')!;
    let c: { ctx: string; name: string };
    try { c = await context(); }
    catch { out.textContent = 'Could not read this to send it.'; return; }
    let full = '';
    go.textContent = 'Stop';
    const done = () => { cancel = null; go.textContent = 'Ask'; };
    cancel = llmQuery(
      {
        ctx: c.ctx, ctxName: c.name,
        // The host knows summarize, explain-code and qa; a folder question is a qa.
        intent: intent === 'explain' ? 'explain-code' : intent === 'summarize' ? 'summarize' : 'qa',
        question: intent === 'folder' ? 'What is in this folder? Group the files by purpose in a few short lines.' : question,
        model: app.settings.aiModel,
      },
      {
        onChunk: t => { full += t; out.textContent = full; },
        onDone: info => { done(); out.innerHTML = renderMarkdown(full); meta.textContent = `${info.model} · ${(info.ms / 1000).toFixed(1)}s${info.truncated ? ' · shortened to fit' : ''}`; },
        onError: (code, message) => { done(); if (code !== 'cancelled') out.textContent = LLM_ERROR_TEXT[code] ?? message; },
      });
  }

  box.addEventListener('click', e => {
    const chip = (e.target as Element).closest<HTMLElement>('.fe-ask-chip');
    if (chip) void ask(chip.dataset.intent!);
  });
  go.addEventListener('click', () => {
    if (cancel) { cancel(); cancel = null; go.textContent = 'Ask'; return; }
    const text = q.value.trim();
    if (!text) { q.focus(); return; }
    q.value = '';
    void ask('qa', text);
  });
  q.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go.click(); }
  });
  document.addEventListener('bfb-lens', e => {
    if ((e as CustomEvent).detail !== 'ask') return;
    if (!checked) void checkModel();
    q.focus({ preventScroll: true });
  });
}
