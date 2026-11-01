// Joining two copies of Ask's chat history without losing either's chats. The
// phone starts from the Mac's copy on every load, so what was asked on the phone
// has to be kept beside it. Plain data in and out, so the phone shim can use it
// before the app has started.
interface Turn { at: number; q: string }
interface Chat { id: string; at: number; title: string; turns: Turn[] }
export type AskStore = Record<string, Chat[]>;

const CHATS_PER_SUBJECT = 20, SUBJECTS = 100;

const isStore = (v: unknown): v is AskStore => !!v && typeof v === 'object' && !Array.isArray(v);

/** Every chat from both copies. The same chat in both keeps the copy with more turns (the later one on a tie). */
export function mergeAskStores(a: unknown, b: unknown): AskStore {
  const out: AskStore = {};
  for (const store of [a, b]) {
    if (!isStore(store)) continue;
    for (const [subject, list] of Object.entries(store)) {
      if (!Array.isArray(list)) continue;
      const mine = out[subject] ?? [];
      for (const chat of list) {
        if (!chat || typeof chat.id !== 'string' || !Array.isArray(chat.turns)) continue;
        const at = mine.findIndex(c => c.id === chat.id);
        if (at < 0) mine.push(chat);
        else if (chat.turns.length > mine[at].turns.length || (chat.turns.length === mine[at].turns.length && chat.at > mine[at].at)) mine[at] = chat;
      }
      out[subject] = mine;
    }
  }
  for (const [subject, list] of Object.entries(out)) {
    out[subject] = list.sort((x, y) => y.at - x.at).slice(0, CHATS_PER_SUBJECT);
    if (!out[subject].length) delete out[subject];
  }
  const subjects = Object.keys(out);
  if (subjects.length > SUBJECTS) {
    const last = (k: string) => Math.max(...out[k].map(c => c.at));
    subjects.sort((x, y) => last(x) - last(y)).slice(0, subjects.length - SUBJECTS).forEach(k => { delete out[k]; });
  }
  return out;
}

/** The same join for the stored form, which keeps the history as JSON text. */
export function mergeAskHistory(a: unknown, b: unknown): string {
  const parse = (x: unknown) => { if (typeof x !== 'string') return x; try { return JSON.parse(x); } catch { return undefined; } };
  return JSON.stringify(mergeAskStores(parse(a), parse(b)));
}
