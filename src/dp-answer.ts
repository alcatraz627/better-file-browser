// The answer side of a decision page: the answer as it will be sent, Copy,
// Submit, and what the page says once it has been answered. gcc composes,
// parses and stores every answer through the notes host; this module only asks
// and shows. When gcc cannot be reached, the page still hands the owner a
// picks line to paste, and says plainly that nothing was sent.
import { esc, copyToClipboard } from './utils';
import { flashCopied } from './copy-done';
import { UI_ICON } from './control-icons';
import { dpIo } from './dp-io';
import { errorText } from './errors';
import { ago } from './dp-lens';
import { toGcc, fromGcc, fallbackAnswer, sentSummary, progress, type DpState, type GccState } from './dp-form';
import type { DpConfig } from './dp-page';

/** What the page around the panel lends it: the current answers, a way to replace them, and when they were last edited. */
export interface AnswerHost { state(): DpState; replace(s: DpState): void; editedAt(): number }

/** What the server stored for a sent answer, and how the asker was told. */
interface Sent { answer: string; submitted_at: number; via?: string }
interface Notify { state?: 'requested' | 'queued' | 'undelivered' | 'no-origin'; at?: string }

// Each way the asker can have been told, as the owner reads it.
const TOLD: Record<string, string> = {
  requested: 'the agent was woken',
  queued: 'the message waits for the agent',
  undelivered: 'the agent was not told',
  'no-origin': 'the page names no agent to tell',
};
const NOT_TOLD = 'Answered, but the agent was not told. It will see it next time it reads its pages.';
const NOT_SENT = 'Not sent. Nothing was written; the picks line is on your clipboard instead.';
const NOT_SENT_COMPOSED = 'Not sent. Nothing was written; the answer is on your clipboard to paste to the agent.';
const DOWN = new Set(['unavailable', 'dp_unavailable']);
const codeOf = (e: unknown) => (e as { code?: string })?.code ?? '';

// One group, so at a narrow width the three wrap to the next line together.
export const answerBarHtml = (): string => `<span class="fe-dp-bar-end">
  <button type="button" class="btn" data-variant="ghost" data-size="sm" id="fe-dp-panel" aria-pressed="false" aria-controls="fe-dp-answer" title="Show the answer as it will be sent (p)">Answer</button>
  <button type="button" class="btn" data-variant="outline" data-size="sm" id="fe-dp-copy" title="Copy the answer (c)">${UI_ICON.copy}<span>Copy</span></button>
  <button type="button" class="btn" data-variant="solid" data-size="sm" id="fe-dp-submit" title="Send the answer to the agent that asked (s or ⌘↩)">Submit</button></span>`;

export const answerPanelHtml = (): string => `
  <section class="card fe-dp-answer" id="fe-dp-answer" hidden aria-label="The answer as it will be sent">
    <p class="notice" id="fe-dp-answer-note" hidden></p>
    <pre class="fe-dp-answer-text" id="fe-dp-answer-text"></pre>
  </section>`;

export const sentHtml = (): string => '<section class="card fe-dp-sent" id="fe-dp-sent" hidden></section>';

/**
 * Wire the panel, Copy and Submit for one page. slug is the page's name in
 * gcc's registry, or undefined for a page outside it, which can be copied
 * but not sent. Returns what the page calls after every change to its answers.
 */
export function wireAnswer(cfg: DpConfig, box: HTMLElement, slug: string | undefined, base: string, host: AnswerHost, toast: (m: string) => void) {
  const q = <T extends HTMLElement>(sel: string) => box.querySelector<T>(sel)!;
  const panel = q('#fe-dp-answer'), pre = q('#fe-dp-answer-text'), note = q('#fe-dp-answer-note');
  const panelBtn = q('#fe-dp-panel'), copyBtn = q<HTMLButtonElement>('#fe-dp-copy'), submitBtn = q<HTMLButtonElement>('#fe-dp-submit');
  const sentBox = q('#fe-dp-sent');
  // gcc: composed by gcc. down: gcc could not be asked, so the text is bfb's picks line. outside: not a registry page.
  let mode: 'gcc' | 'down' | 'outside' = slug ? 'gcc' : 'outside';
  let text = '', sent: Sent | null = null, seq = 0, busy = false;
  let pending: Promise<void> = Promise.resolve();

  // The plain sentence shows; gcc's own words, when there are any, sit in the hover text.
  const setNote = (msg: string, tone?: 'danger' | 'warn', cause = '') => {
    note.hidden = !msg;
    note.textContent = msg;
    note.title = cause;
    if (tone) note.dataset.tone = tone; else delete note.dataset.tone;
  };
  const paintButtons = () => {
    const p = progress(cfg, host.state());
    copyBtn.querySelector('span')!.textContent = p.flagged ? `Copy (${p.flagged})` : 'Copy';
    submitBtn.textContent = sent ? 'Replace answer' : 'Submit';
    submitBtn.disabled = mode !== 'gcc' || busy;
    submitBtn.title = mode === 'outside' ? 'This page is not in gcc\'s registry, so it cannot be sent; Copy gives the picks line'
      : mode === 'down' ? 'gcc cannot be reached, so nothing can be sent; Copy gives the picks line'
      : sent ? 'Send a new answer in place of the one already sent (s or ⌘↩)' : 'Send the answer to the agent that asked (s or ⌘↩)';
  };
  // Ask gcc for the answer string; a newer change wins over a slower older one.
  const compose = (): Promise<void> => {
    const mine = ++seq;
    const s = host.state();
    const local = () => {
      text = fallbackAnswer(cfg, s);
      pre.textContent = text;
      paintButtons();
    };
    if (!slug) {
      local();
      setNote('This page is not in gcc\'s registry, so it cannot be sent. Copy gives the picks line to paste to the agent.');
      return Promise.resolve();
    }
    return dpIo().dp('compose', slug, toGcc(cfg, s)).then(r => {
      if (mine !== seq) return;
      mode = 'gcc';
      text = (r as { answer: string }).answer;
      pre.textContent = text;
      setNote('');
      paintButtons();
    }).catch(err => {
      if (mine !== seq) return;
      mode = 'down';
      local();
      setNote('Answer path down: gcc could not compose the answer, so nothing can be sent. Copy the picks line and paste it to the agent.', 'danger', errorText(err));
    });
  };
  let timer: ReturnType<typeof setTimeout> | null = null;
  const changed = () => {
    paintButtons();
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { pending = compose(); }, 150);
  };
  const fresh = async () => { if (timer) { clearTimeout(timer); timer = null; pending = compose(); } await pending; };

  const showPanel = (on: boolean) => {
    panel.hidden = !on;
    panelBtn.setAttribute('aria-pressed', String(on));
  };
  const copy = async () => {
    await fresh();
    const ok = await copyToClipboard(text);
    if (!ok) { showPanel(true); toast('Copy was refused; the answer is in the panel to select by hand'); return; }
    flashCopied(copyBtn);
    if (mode !== 'gcc') toast('Copied the picks line; gcc did not compose it');
  };

  // The answered state: a notice with when and how the asker was told, the
  // picks by label (moved ones tinted), each note or disagreement, and the
  // full text as sent, folded.
  const paintSent = (notify: Notify | null, parsed: DpState | null) => {
    if (!sent) { sentBox.hidden = true; return; }
    const told = notify?.state ? TOLD[notify.state] ?? notify.state : 'whether the agent was told is not recorded';
    const sum = parsed ? sentSummary(cfg, parsed) : null;
    sentBox.hidden = false;
    sentBox.dataset.told = notify?.state ?? 'unknown';
    sentBox.innerHTML = `<p class="fe-dp-sent-head"><strong>Answered ${esc(ago(sent.submitted_at) === 'just now' ? 'just now' : `${ago(sent.submitted_at)} ago`)}</strong>
        <span class="fe-dp-sent-told" title="${esc(sent.via ? `Sent from the ${sent.via}` : 'Sent')}">${esc(told)}</span></p>
      ${sum ? `<div class="fe-dp-sent-picks">${sum.picks.map(p => `<span class="chip" data-size="sm" ${p.moved ? 'data-tone="due" data-fill' : 'data-tone="quiet"'} title="${esc(`${p.id}${p.code} · ${p.moved ? 'moved off the recommendation' : 'as recommended'}`)}"><span>${esc(p.id)} · ${esc(p.label)}</span></span>`).join('')}</div>
        ${sum.lines.length ? `<ul class="fe-dp-sent-lines">${sum.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}` : ''}
      <details class="fe-dp-sent-full"><summary>Full answer as sent</summary><pre>${esc(sent.answer)}</pre></details>`;
    paintButtons();
  };
  // Read what the server stored. The form is filled from the sent answer
  // unless the owner has edited it since, so a reload never loses a replacement in progress.
  const readSent = async (fromSubmit = false) => {
    // Asked first, so an unanswered page leaves no missing-file error in the console.
    const readJson = async <T>(name: string): Promise<T | null> => {
      if (!(await dpIo().exists(base + name))) return null;
      try { return JSON.parse(await dpIo().text(base + name)) as T; } catch { return null; }
    };
    sent = await readJson<Sent>('.answer.json');
    if (!sent || typeof sent.answer !== 'string') { sent = null; paintSent(null, null); return; }
    const notify = await readJson<Notify>('.notify.json');
    let parsed: DpState | null = null;
    if (slug) {
      try { parsed = fromGcc(cfg, await dpIo().dp('parse', slug, { answer: sent.answer }) as Partial<GccState>); } catch { parsed = null; }
    }
    if (parsed && (fromSubmit || host.editedAt() < sent.submitted_at * 1000)) host.replace(parsed);
    paintSent(notify, parsed);
    changed();
  };

  const submit = async () => {
    if (busy) return;
    await fresh();
    if (mode !== 'gcc' || !slug) {
      const ok = await copyToClipboard(text);
      showPanel(true);
      toast(ok ? NOT_SENT : 'Not sent. Nothing was written; copy the picks line from the panel.');
      return;
    }
    const replace = !!sent;
    if (replace && !confirm('Replace the answer you already sent? The agent is told again.')) return;
    busy = true; paintButtons();
    try {
      const r = await dpIo().dp('submit', slug, { answer: text, replace }) as { notify?: Notify | null };
      const st = r?.notify?.state;
      toast(st === 'requested' ? 'Sent. The agent was woken.' : st === 'queued' ? 'Sent. The agent is idle; the message waits for it.' : NOT_TOLD);
      // The Decisions lens moves this page to Answered now, not at its next poll.
      document.dispatchEvent(new CustomEvent('bfb-dp-answered', { detail: slug }));
      await readSent(true);
    } catch (err) {
      const code = codeOf(err);
      if (code === 'dp_conflict') { toast('Answered somewhere else already. Use Replace answer to send yours instead.'); await readSent(); }
      else if (DOWN.has(code)) {
        // gcc composed the answer but its server could not store it: the composed
        // text is the best thing to paste, and Submit stays for a retry.
        const ok = await copyToClipboard(text);
        showPanel(true);
        setNote('Not sent: gcc\'s page server is not answering, so nothing was written. Paste this answer to the agent, or Submit again once the server is back.', 'danger', errorText(err));
        toast(ok ? NOT_SENT_COMPOSED : 'Not sent. Nothing was written; copy the answer from the panel.');
      } else toast(`Not sent: ${errorText(err)}`);
    } finally { busy = false; paintButtons(); }
  };

  panelBtn.addEventListener('click', () => showPanel(panel.hidden));
  copyBtn.addEventListener('click', () => void copy());
  submitBtn.addEventListener('click', () => void submit());
  paintButtons();
  pending = compose();
  void readSent();
  return { changed, togglePanel: () => showPanel(panel.hidden), copy, submit };
}
