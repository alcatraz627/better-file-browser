// The editing core a textarea gets: undo that survives the element being
// rebuilt, keystrokes coalesced so a sentence is one undo step, and insert at
// the caret. Carried over from the kanban board's editor.js, typed.
const BUF_CAP = 60, BUF_COALESCE = 600;
interface Hist { past: string[]; future: string[]; timer: ReturnType<typeof setTimeout> | null }
const bufHist = new Map<string, Hist>();

export function insertAtCursor(el: HTMLTextAreaElement, text: string): void {
  const a = el.selectionStart ?? el.value.length, b = el.selectionEnd ?? a;
  el.value = el.value.slice(0, a) + text + el.value.slice(b);
  const at = a + text.length;
  el.setSelectionRange(at, at);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.focus();
}

export interface Buffer { undo: () => boolean; redo: () => boolean; snap: () => void; depth: () => number; insert: (t: string) => void }

export function attachBuffer(el: HTMLTextAreaElement, id: string): Buffer {
  let h = bufHist.get(id) ?? { past: [], future: [], timer: null };
  bufHist.set(id, h);
  h.past = [el.value ?? ''];
  h.future = [];

  const snap = () => {
    const now = el.value ?? '';
    if (h.past[h.past.length - 1] === now) return;
    h.past.push(now);
    if (h.past.length > BUF_CAP) h.past.shift();
    h.future = [];                       // a new edit forks the timeline
  };
  const record = () => { if (h.timer) clearTimeout(h.timer); h.timer = setTimeout(snap, BUF_COALESCE); };
  const put = (v: string) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
  const undo = () => {
    if (h.timer) clearTimeout(h.timer);
    snap();
    if (h.past.length < 2) return false;
    h.future.push(h.past.pop()!);
    put(h.past[h.past.length - 1]);
    return true;
  };
  const redo = () => {
    if (!h.future.length) return false;
    const v = h.future.pop()!;
    h.past.push(v);
    put(v);
    return true;
  };
  el.addEventListener('input', record);
  el.addEventListener('keydown', e => {
    if (!(e.metaKey || e.ctrlKey)) return;
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { if (undo()) { e.preventDefault(); e.stopPropagation(); } }
    else if ((k === 'z' && e.shiftKey) || k === 'y') { if (redo()) { e.preventDefault(); e.stopPropagation(); } }
  });
  return { undo, redo, snap, depth: () => h.past.length, insert: t => insertAtCursor(el, t) };
}
