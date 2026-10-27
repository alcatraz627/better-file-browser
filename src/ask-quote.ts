// Moving text between Ask chats, and reading a model's thinking out of its
// answer. A quote is markdown that says where it came from; it travels to
// another page's chat through one stored hand-off that the page picks up when
// it opens. These are the pure parts; tool-lenses.ts draws them.
import { jsonPref } from './storage';
import type { AskChat } from './ask-history';

/** Longest quote carried, so a whole long answer cannot flood a chat box. */
export const QUOTE_MAX = 4000;

/** The text as a markdown quote led by its source, ready for a chat box. */
export function quoteMarkdown(text: string, from: string): string {
  let body = text.trim();
  const cut = body.length > QUOTE_MAX;
  if (cut) body = body.slice(0, QUOTE_MAX).trimEnd() + ' …';
  const lines = [`From ${from}${cut ? ' (shortened)' : ''}:`, '', ...body.split('\n')];
  return lines.map(l => (l ? `> ${l}` : '>')).join('\n') + '\n\n';
}

/** A chat a quote can go to. `here` is the chat open on this page. */
export interface QuoteTarget { subject: string; chatId: string; title: string; label: string; here: boolean }

const nameOf = (path: string) => path.split('/').filter(Boolean).pop() || '/';

/** Where a quote can go: this page's chat first, then the newest chat of each
 *  open tab, then recent chats elsewhere, each subject once, at most `max`. */
export function quoteTargets(
  here: { subject: string; chatId: string; title: string },
  tabPaths: string[],
  recent: { subject: string; chat: AskChat }[],
  chatsFor: (subject: string) => AskChat[],
  max = 8,
): QuoteTarget[] {
  const out: QuoteTarget[] = [{ ...here, label: 'This chat', here: true }];
  const seen = new Set([here.subject]);
  const add = (subject: string, chat: AskChat | undefined, label: string) => {
    if (!chat || seen.has(subject) || out.length >= max) return;
    seen.add(subject);
    out.push({ subject, chatId: chat.id, title: chat.title, label, here: false });
  };
  for (const p of tabPaths) add(p, chatsFor(p)[0], `${nameOf(p)} · open tab`);
  for (const r of recent) add(r.subject, r.chat, nameOf(r.subject));
  return out;
}

/** A quote on its way to another page's chat. */
export interface QuoteHandoff { subject: string; chatId: string; text: string; at: number }
const handoffPref = jsonPref<QuoteHandoff | null>('bfb-ask-quote-v1', null, v => v === null || (typeof v === 'object' && typeof (v as QuoteHandoff).text === 'string'));
/** How long a hand-off waits for its page before it is dropped. */
const HANDOFF_TTL = 2 * 60_000;

export function sendQuote(h: QuoteHandoff): void { handoffPref.set(h); }

/** The quote waiting for this subject, taken so it lands once. */
export function takeQuote(subject: string, now = Date.now()): QuoteHandoff | null {
  const h = handoffPref.get();
  if (!h || h.subject !== subject) return null;
  handoffPref.set(null);
  return now - h.at <= HANDOFF_TTL ? h : null;
}

/** The tag the picker puts after a remote lane's own default model. */
const LANE_DEFAULT = /\(((Gemini|Codex) )?default\)$/;
/** A model's label without its default tag, for naming it in an answer. */
export const bareLabel = (label: string) => label.replace(/ \(((Gemini|Codex) )?default\)$/, '');

/** A model the picker offers, as Ask's dropdown holds it. */
export interface ModelOpt { value: string; label: string }

/** A question that starts with `@name` goes to that model for this one turn.
 *  The name is a picker value (`code`, `gemini:gemini-4-argon`), a remote
 *  model's bare name, or `gemini` / `gpt` for that lane's default model. */
export function resolveMention(text: string, opts: ModelOpt[]): { model: string; label: string; question: string } | null {
  const m = /^@(\S+)\s+([\s\S]*\S)/.exec(text.trim());
  if (!m) return null;
  const want = m[1].toLowerCase();
  const lane = (name: string) => opts.filter(o => o.value.startsWith(name + ':'));
  const remote = [...lane('gemini'), ...lane('gpt')];
  const laneDefault = (name: string) => lane(name).find(o => LANE_DEFAULT.test(o.label)) ?? lane(name)[0];
  const hit = opts.find(o => o.value && o.value.toLowerCase() === want)
    ?? remote.find(o => o.value.slice(o.value.indexOf(':') + 1).toLowerCase() === want)
    ?? (want === 'gemini' || want === 'gpt' ? laneDefault(want) : undefined);
  return hit ? { model: hit.value, label: bareLabel(hit.label), question: m[2] } : null;
}

/** What a second model is asked when it checks another model's answer. */
export function secondOpinion(question: string, answer: string): string {
  return `Another model answered the question "${question}" as below. Check that answer against the context: say plainly what is wrong or missing, then give a better answer.\n\nTheir answer:\n${answer}`;
}

/** Whether a file is an image the local vision model reads. */
export const isImageName = (name: string) => /\.(png|jpe?g|gif|webp|heic|bmp|tiff?)$/i.test(name);

/** Text that is still arriving, made safe to draw as markdown: an open code
 *  fence is closed, so a half-written block shows as code and not as prose. */
export function closeOpenFence(text: string): string {
  const fences = text.match(/^\s*```/gm)?.length ?? 0;
  return fences % 2 ? text + '\n```' : text;
}

/** An answer split into the model's thinking and what it said. Some local
 *  models write their reasoning inside <think> tags before the answer;
 *  `open` means the thinking has not ended yet, as while it streams. */
export function splitThinking(text: string): { thinking: string; answer: string; open: boolean } {
  const m = /^\s*<think>([\s\S]*?)(<\/think>|$)/.exec(text);
  if (!m) return { thinking: '', answer: text, open: false };
  return { thinking: m[1].trim(), answer: text.slice(m[0].length).replace(/^\s+/, ''), open: !m[2] };
}
