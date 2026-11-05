// What both Markdown editors offer, the peek and the file tab: the format bar and
// its keys, pictures pasted or dropped into the text, and the panel of saved
// versions. Each editor supplies only how its own text is changed and shown.
import { UI_ICON } from './control-icons';
import { emptyHtml } from './empty-state';
import { errorText } from './errors';
import { attachmentRel, notes } from './notes';
import { whenText, esc } from './utils';
import { tableSnippet, wrapSelection, type TextEdit } from './editor';

export type Sel = { start: number; end: number };

const button = (act: string, icon: string, title: string) =>
  `<button type="button" class="btn" data-icon data-act="${act}" title="${title}" aria-label="${title.replace(/ \(.*$/, '')}">${icon}</button>`;

/** The format buttons. ⌘K means the palette in a file tab, so only the peek names it for Link. */
export function formatButtons(o: { linkKey: boolean }): string {
  return button('bold', UI_ICON.fmtBold, 'Bold (⌘B)')
    + button('italic', UI_ICON.fmtItalic, 'Italic (⌘I)')
    + button('code', UI_ICON.fmtCode, 'Code (⌘E)')
    + button('strike', UI_ICON.fmtStrike, 'Strikethrough (⌘⇧X)')
    + button('heading', UI_ICON.fmtHeading, 'Heading, deeper each press (⌘⇧H)')
    + button('link', UI_ICON.link, o.linkKey ? 'Link (⌘K)' : 'Link')
    + button('quote', UI_ICON.fmtQuote, 'Quote (⌘⇧.)')
    + button('olist', UI_ICON.fmtOlist, 'Numbered list (⌘⇧7)')
    + button('list', UI_ICON.list, 'Bullet list')
    + button('task', UI_ICON.task, 'Task list')
    + button('table', UI_ICON.table, 'Insert a table')
    + button('image', UI_ICON.image, 'Insert an image (or paste or drop one)')
    + `<input type="file" class="fe-ed-file" accept="image/*" hidden>`;
}

/** The buttons that act on the file rather than its words. */
export function fileButtons(o: { steps: boolean; manage: boolean }): string {
  return button('versions', UI_ICON.versions, 'Versions, every save from git history')
    + (o.steps ? button('prev', UI_ICON.prev, 'Previous note in the list (⌥⌘↑)') + button('next', UI_ICON.next, 'Next note in the list (⌥⌘↓)') : '')
    + (o.manage ? button('rename', UI_ICON.rename, 'Rename (F2)') + button('delete', UI_ICON.trash, 'Move to .trash (⌘⇧⌫)') : '');
}

/** Run a bar's buttons. Pressing one leaves the caret and the selection in the text. */
export function wireBar(bar: HTMLElement, act: (name: string, btn: HTMLElement) => void): void {
  bar.addEventListener('mousedown', e => { if ((e.target as HTMLElement).closest('[data-act]')) e.preventDefault(); });
  bar.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (b) act(b.dataset.act!, b);
  });
}

function prefixed(text: string, sel: Sel, line: (l: string, n: number) => string): TextEdit {
  const from = text.lastIndexOf('\n', sel.start - 1) + 1;
  let to = text.indexOf('\n', sel.end); if (to < 0) to = text.length;
  const lines = text.slice(from, to).split('\n').map(line).join('\n');
  return { text: text.slice(0, from) + lines + text.slice(to), start: from, end: from + lines.length };
}

/** What a format button does to the text; null for a name that is not a format. */
export function formatEdit(name: string, text: string, sel: Sel): TextEdit | null {
  switch (name) {
    case 'bold':   return wrapSelection(text, sel, '**');
    case 'italic': return wrapSelection(text, sel, '_');
    case 'code':   return wrapSelection(text, sel, '`');
    case 'strike': return wrapSelection(text, sel, '~~');
    case 'quote':  return prefixed(text, sel, l => '> ' + l);
    case 'list':   return prefixed(text, sel, l => '- ' + l);
    case 'task':   return prefixed(text, sel, l => '- [ ] ' + l);
    case 'olist':  return prefixed(text, sel, (l, n) => `${n + 1}. ${l}`);
    case 'heading': {
      const from = text.lastIndexOf('\n', sel.start - 1) + 1;
      let to = text.indexOf('\n', from); if (to < 0) to = text.length;
      const line = text.slice(from, to);
      const level = line.match(/^(#{1,6}) /)?.[1].length ?? 0;
      const plain = line.replace(/^#{1,6} /, '');
      const next = level >= 3 ? plain : '#'.repeat(level + 1) + ' ' + plain;
      return { text: text.slice(0, from) + next + text.slice(to), start: from + next.length, end: from + next.length };
    }
    case 'link': {
      const label = text.slice(sel.start, sel.end) || 'text';
      const at = sel.start + label.length + 3;
      return { text: text.slice(0, sel.start) + `[${label}](url)` + text.slice(sel.end), start: at, end: at + 3 };
    }
    default: return null;
  }
}

/** A new table as it goes in at `at`, on a line of its own. */
export function tableAt(text: string, at: number): string {
  return (!at || text.slice(0, at).endsWith('\n') ? '' : '\n') + tableSnippet();
}

/** The format a key stands for, or null. */
export function formatKey(e: KeyboardEvent): string | null {
  if (!(e.metaKey || e.ctrlKey) || e.altKey) return null;
  const k = e.key.toLowerCase();
  if (!e.shiftKey) return k === 'b' ? 'bold' : k === 'i' ? 'italic' : k === 'e' ? 'code' : null;
  return k === 'x' ? 'strike' : k === 'h' ? 'heading' : k === '.' || k === '>' ? 'quote' : k === '7' || k === '&' ? 'olist' : null;
}

/**
 * Where a new picture goes and how the text links to it. In the Notes folder every
 * picture shares its attachments folder, as the notes format says. Elsewhere it
 * sits beside the file, so editing one file does not scatter folders higher up.
 */
export function picturePlace(root: string, rel: string, notesRoot: string, ext: string, now = Date.now()): { root: string; rel: string; ref: string } {
  const full = root.replace(/\/$/, '') + '/' + rel;
  const home = notesRoot.replace(/\/$/, '');
  if (home && full.startsWith(home + '/')) {
    const inNotes = full.slice(home.length + 1);
    const file = attachmentRel(inNotes, ext, now);
    return { root: home, rel: file, ref: '../'.repeat(inNotes.split('/').length - 1) + file };
  }
  const file = attachmentRel(rel, ext, now);
  const dir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/') + 1) : '';
  return { root, rel: dir + file, ref: file };
}

export interface PictureHost {
  root(): string; rel(): string; notesRoot(): string;
  insert(text: string): void;
  /** Saying why a picture was not added. */
  failed(text: string): void;
  warn(text: string): void;
}

const MAX_PICTURE = 20 * 1024 * 1024;
const BIG_PICTURE = 5 * 1024 * 1024;

/** Store one picture and put a link to it in the text. Up to 20 MB, with a warning over 5 MB because a file stays in history for good. */
export async function addPicture(file: File, host: PictureHost): Promise<void> {
  if (file.size > MAX_PICTURE) { host.failed('Adding the image: over 20 MB, so it is not added'); return; }
  if (file.size > BIG_PICTURE) host.warn('That picture is over 5 MB and stays in the notes history for good');
  const ext = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
  const place = picturePlace(host.root(), host.rel(), host.notesRoot(), ext);
  const b64 = await new Promise<string>(res => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.readAsDataURL(file); });
  try {
    await notes.writeBinary(place.root, place.rel, b64);
    host.insert(`![${file.name.replace(/\.[^.]+$/, '')}](${place.ref})`);
  } catch (err) { host.failed(errorText(err, 'Adding the image')); }
}

/** Pictures pasted or dropped on the text, and those from the bar's file button, all go in as links. */
export function wirePictures(ta: HTMLTextAreaElement, input: HTMLInputElement | null, host: PictureHost): void {
  const images = (dt: DataTransfer | null) => [...(dt?.files ?? [])].filter(f => f.type.startsWith('image/'));
  const take = (e: Event, dt: DataTransfer | null) => {
    const fs = images(dt);
    if (!fs.length) return;
    e.preventDefault();
    fs.forEach(f => void addPicture(f, host));
  };
  ta.addEventListener('paste', e => take(e, e.clipboardData));
  ta.addEventListener('drop', e => take(e, e.dataTransfer));
  ta.addEventListener('dragover', e => e.preventDefault());
  input?.addEventListener('change', () => {
    [...(input.files ?? [])].forEach(f => void addPicture(f, host));
    input.value = '';
  });
}

export interface VersionsHost {
  root(): string; rel(): string;
  /** Show one saved version somewhere; the head holds its Use and Back buttons. */
  show(head: string, text: string): void;
  /** Take this version's words into the editor. */
  use(text: string): void;
  /** Go back to showing the text as it is now. */
  back(): void;
  /** What to say when nothing has been saved to git here. */
  emptyHint(notRepo: boolean): string;
}

/**
 * The saved versions of a file: git's log for it, a row per save. A row shows that
 * version where the rendered text goes, and "Use this version" takes its words,
 * so the next save keeps today's text in the log too. Answers the panel's toggle.
 */
export function mountVersions(panel: HTMLElement, host: VersionsHost): () => void {
  const draw = async () => {
    panel.innerHTML = emptyHtml('loading', 'Reading versions…', { inline: true });
    try {
      const { versions, repo } = await notes.history(host.root(), host.rel());
      if (!versions.length) {
        panel.innerHTML = emptyHtml('empty', 'No versions yet', { inline: true, hint: host.emptyHint(repo === false) });
        return;
      }
      panel.innerHTML = versions.slice(0, 30).map(v =>
        `<button class="row fe-hist-row" data-sha="${esc(v.sha)}"><span>${whenText(v.when)}</span><span>${esc(v.reason)}</span><code>${esc(v.sha)}</code></button>`).join('')
        + (versions.length > 30 ? `<span class="fe-ed-hint">and ${versions.length - 30} older</span>` : '');
    } catch (err) {
      panel.innerHTML = emptyHtml('failed', 'Versions could not be read', { inline: true, hint: errorText(err), actions: [{ a: 'retry', label: 'Try again', title: 'Read the versions again' }] });
    }
  };
  const open = async (sha: string) => {
    panel.querySelectorAll<HTMLElement>('.fe-hist-row').forEach(b => b.classList.toggle('active', b.dataset.sha === sha));
    try {
      const v = await notes.version(host.root(), host.rel(), sha);
      host.show(`<div class="fe-hist-head"><span>version ${esc(sha)}</span>`
        + `<button class="btn" id="fe-hist-use" title="Use this text; today's stays in versions">${UI_ICON.check}<span>Use this version</span></button>`
        + `<button class="btn" id="fe-hist-back" title="Back to the text as it is now">${UI_ICON.close}<span>Back to now</span></button></div>`, v.text);
      document.getElementById('fe-hist-use')?.addEventListener('click', () => { panel.hidden = true; host.use(v.text); });
      document.getElementById('fe-hist-back')?.addEventListener('click', () => host.back());
    } catch (err) { panel.textContent = errorText(err, 'Reading that version'); }
  };
  panel.addEventListener('click', e => {
    const t = e.target as HTMLElement;
    const row = t.closest<HTMLElement>('.fe-hist-row');
    if (row) void open(row.dataset.sha!);
    else if (t.closest('[data-a="retry"]')) void draw();
  });
  return () => {
    if (panel.hidden) { panel.hidden = false; void draw(); }
    else { panel.hidden = true; host.back(); }
  };
}
