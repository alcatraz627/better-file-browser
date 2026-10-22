// Notice files changing on disk. Each part that wants to know (the file page,
// the editor, the comments panel) registers a check here, and one timer runs
// them all every two seconds. Nothing runs while the tab is hidden, a part can
// pause its own check (while it saves or edits), and a check still running
// from the last tick is not started again.

const EVERY_MS = 2000;

interface Sub { check: () => unknown; pause?: () => boolean; running: boolean }
const subs = new Set<Sub>();
let timer = 0;

function tick(): void {
  if (document.visibilityState !== 'visible') return;
  for (const s of subs) {
    if (s.running || s.pause?.()) continue;
    s.running = true;
    Promise.resolve().then(s.check).catch(() => { /* the check reports its own failures */ }).finally(() => { s.running = false; });
  }
}

/** Run `check` on the shared clock until the returned function is called. */
export function watch(check: () => unknown, o: { pause?: () => boolean } = {}): () => void {
  const s: Sub = { check, pause: o.pause, running: false };
  subs.add(s);
  if (!timer) timer = window.setInterval(tick, EVERY_MS);
  return () => {
    subs.delete(s);
    if (!subs.size) { clearInterval(timer); timer = 0; }
  };
}
