// Notice files changing on disk. Each part that wants to know (the file page,
// the editor, the comments panel) registers a check here, and one timer runs
// them all every two seconds. Nothing runs while the tab is hidden, a part can
// pause its own check (while it saves or edits), and a check still running
// from the last tick is not started again.

const EVERY_MS = 2000;

// A check still running after this many ticks is given up on and run again,
// so a reply that never comes cannot stop a part's watching for good.
const STALE_TICKS = 3;

interface Sub { check: () => unknown; pause?: () => boolean; running: number }
const subs = new Set<Sub>();
let timer = 0;

function tick(): void {
  if (document.visibilityState !== 'visible') return;
  for (const s of subs) {
    if (s.running && ++s.running <= STALE_TICKS) continue;
    let paused: boolean;
    try { paused = !!s.pause?.(); } catch { paused = true; }
    if (paused) { s.running = 0; continue; }
    const run = s.running = 1;
    Promise.resolve().then(s.check).catch(() => { /* the check reports its own failures */ })
      .finally(() => { if (s.running === run) s.running = 0; });
  }
}

/** Run `check` on the shared clock until the returned function is called. */
export function watch(check: () => unknown, o: { pause?: () => boolean } = {}): () => void {
  const s: Sub = { check, pause: o.pause, running: 0 };
  subs.add(s);
  if (!timer) timer = window.setInterval(tick, EVERY_MS);
  return () => {
    subs.delete(s);
    if (!subs.size) { clearInterval(timer); timer = 0; }
  };
}
