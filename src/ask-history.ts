// Ask's chat history: the conversations held about each file or folder, newest
// first, so one can be reopened or deleted. Kept in the extension's own
// storage, never beside the file. Capped so a long-lived history cannot grow
// without bound.
import { jsonPref } from './storage';
import { isWithin } from './places';

/** One question and its answer. `stopped` and `error` mark an answer that did
 *  not finish; `files` names what was attached; `via` marks a second opinion. */
export interface AskTurn {
  q: string; a: string; model: string; ms: number; at: number;
  tokensIn?: number; tokensOut?: number; stopped?: boolean; error?: string; files?: string[]; via?: string; intent?: string;
}

/** The line under an answer: model, tokens in and out, time, and how it ended.
 *  A part that is not known is left out rather than shown as zero. */
export function turnMeta(t: AskTurn, truncated = false): string {
  // Turns saved before `stopped` existed kept "stopped" as their model.
  if (t.model === 'stopped') return 'Stopped';
  const n = (v: number) => v.toLocaleString('en-US');
  return [
    t.model,
    t.tokensIn ? `in ${n(t.tokensIn)}` : '',
    t.tokensOut ? `out ${n(t.tokensOut)}` : '',
    t.ms ? `${(t.ms / 1000).toFixed(1)}s` : '',
    truncated ? 'shortened to fit' : '',
    t.stopped ? 'stopped' : '',
  ].filter(Boolean).join(' · ');
}
/** The turn an answer became once it ended: finished, or cut off with what it
 *  had said kept as a stopped answer, or failed with nothing said. */
export function endedTurn(base: Omit<AskTurn, 'a' | 'ms'>, text: string,
  end: { t: string; model?: string; ms?: number; tokens_in?: number; tokens_out?: number; code?: string }): AskTurn {
  if (end.t === 'done') return { ...base, a: text, model: end.model || base.model, ms: end.ms ?? 0, tokensIn: end.tokens_in || undefined, tokensOut: end.tokens_out || undefined };
  if (text.trim()) return { ...base, a: text, ms: Date.now() - base.at, stopped: true };
  return { ...base, a: '', ms: 0, error: end.code || 'unknown' };
}

export interface AskChat { id: string; at: number; title: string; turns: AskTurn[] }
type Store = Record<string, AskChat[]>;

const historyPref = jsonPref<Store>('bfb-ask-history-v1', {}, v => !!v && typeof v === 'object');
const CHATS_PER_SUBJECT = 20, SUBJECTS = 100, ANSWER_MAX = 20_000;

function read(): Store {
  return historyPref.get();
}

/** Every chat about every file or folder, newest first, with what it is about. */
export function allChats(): { subject: string; chat: AskChat }[] {
  return Object.entries(read()).flatMap(([subject, list]) => list.map(chat => ({ subject, chat }))).sort((a, b) => b.chat.at - a.chat.at);
}

/** Chats about a folder and about what is inside it, up to `depth` levels
 *  down, newest first. Reads only the stored history, never the disk, so a
 *  deep tree costs nothing. */
export function chatsUnder(folder: string, depth = 4): { subject: string; chat: AskChat }[] {
  return allChats().filter(({ subject }) => isWithin(subject, folder, depth));
}

/** The chats about one subject, newest first. */
export function chatsFor(subject: string): AskChat[] {
  return (read()[subject] ?? []).slice().sort((a, b) => b.at - a.at);
}

/** Add a turn to a chat, starting the chat if it is new; returns the chat. */
export function addTurn(subject: string, chatId: string, turn: AskTurn): AskChat {
  const store = read();
  const list = store[subject] ?? [];
  let chat = list.find(c => c.id === chatId);
  if (!chat) { chat = { id: chatId, at: turn.at, title: turn.q.slice(0, 80), turns: [] }; list.push(chat); }
  // Two tabs watching one answer both finish it; the turn is filed once.
  if (chat.turns.some(t => t.at === turn.at && t.q === turn.q)) return chat;
  chat.turns.push({ ...turn, a: turn.a.slice(0, ANSWER_MAX) });
  chat.at = turn.at;
  store[subject] = list.sort((a, b) => b.at - a.at).slice(0, CHATS_PER_SUBJECT);
  // Past the subject cap, the subjects asked about longest ago go first.
  const subjects = Object.keys(store);
  if (subjects.length > SUBJECTS) {
    const last = (k: string) => Math.max(...store[k].map(c => c.at));
    subjects.sort((a, b) => last(a) - last(b)).slice(0, subjects.length - SUBJECTS).forEach(k => { delete store[k]; });
  }
  historyPref.set(store);
  return chat;
}

export function deleteChat(subject: string, chatId: string): void {
  const store = read();
  store[subject] = (store[subject] ?? []).filter(c => c.id !== chatId);
  if (!store[subject].length) delete store[subject];
  historyPref.set(store);
}

/** A follow-up question carrying the chat so far, last few turns only, so the
 *  model answers in context without the document being crowded out. */
export function withHistory(turns: AskTurn[], question: string, maxChars = 4000): string {
  if (!turns.length) return question;
  const parts: string[] = [];
  let used = 0;
  for (const t of turns.slice(-4).reverse()) {
    const block = `Q: ${t.q}\nA: ${t.a}`;
    if (used + block.length > maxChars) break;
    parts.unshift(block); used += block.length;
  }
  return parts.length ? `Earlier in this chat:\n${parts.join('\n\n')}\n\nNow: ${question}` : question;
}
