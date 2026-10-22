// Ask's chat history: the conversations held about each file or folder, newest
// first, so one can be reopened or deleted. Kept in the extension's own
// storage, never beside the file. Capped so a long-lived history cannot grow
// without bound.
import { kvGet, kvSet } from './kv';

export interface AskTurn { q: string; a: string; model: string; ms: number; at: number }
export interface AskChat { id: string; at: number; title: string; turns: AskTurn[] }
type Store = Record<string, AskChat[]>;

const KEY = 'bfb-ask-history-v1';
const CHATS_PER_SUBJECT = 20, SUBJECTS = 100, ANSWER_MAX = 20_000;

function read(): Store {
  try { const v = JSON.parse(kvGet(KEY) || '{}'); return v && typeof v === 'object' ? v as Store : {}; }
  catch { return {}; }
}

/** Every chat about every file or folder, newest first, with what it is about. */
export function allChats(): { subject: string; chat: AskChat }[] {
  return Object.entries(read()).flatMap(([subject, list]) => list.map(chat => ({ subject, chat }))).sort((a, b) => b.chat.at - a.chat.at);
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
  chat.turns.push({ ...turn, a: turn.a.slice(0, ANSWER_MAX) });
  chat.at = turn.at;
  store[subject] = list.sort((a, b) => b.at - a.at).slice(0, CHATS_PER_SUBJECT);
  // Past the subject cap, the subjects asked about longest ago go first.
  const subjects = Object.keys(store);
  if (subjects.length > SUBJECTS) {
    const last = (k: string) => Math.max(...store[k].map(c => c.at));
    subjects.sort((a, b) => last(a) - last(b)).slice(0, subjects.length - SUBJECTS).forEach(k => { delete store[k]; });
  }
  kvSet(KEY, JSON.stringify(store));
  return chat;
}

export function deleteChat(subject: string, chatId: string): void {
  const store = read();
  store[subject] = (store[subject] ?? []).filter(c => c.id !== chatId);
  if (!store[subject].length) delete store[subject];
  kvSet(KEY, JSON.stringify(store));
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
