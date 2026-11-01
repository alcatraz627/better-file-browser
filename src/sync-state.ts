// What Switchboard last said about syncing the notes folder, in words a person can act on.
// Switchboard writes `<repo>/.git/mnt-sync-state.json` (spec: "The state file"); the host
// reads it and this turns it into one line. A report older than ten minutes means sync is
// not running, whatever it last said.

export interface SyncReport {
  at?: string; ok?: boolean; problem?: string | null; ahead?: number; behind?: number; clashes?: number;
  cameBack?: string[]; lastOk?: string; unreadable?: boolean;
}
export interface SyncReply { repo: boolean; state: SyncReport | null; now: number }

/** How serious the line is: good, something waiting, needs a look, or not syncing at all. */
export type SyncLevel = 'ok' | 'waiting' | 'trouble' | 'off';
export interface SyncView { level: SyncLevel; text: string; clashes: number; cameBack: string[] }

export const STALE_SECONDS = 10 * 60;

const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;

function ago(seconds: number): string {
  const m = Math.floor(seconds / 60);
  if (m < 1) return 'less than a minute ago';
  if (m < 60) return `${plural(m, 'minute')} ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${plural(h, 'hour')} ago`;
  return `${plural(Math.floor(h / 24), 'day')} ago`;
}

/** One plain line for the Notes lens and Home. */
export function describeSync(r: SyncReply): SyncView {
  const none = { clashes: 0, cameBack: [] as string[] };
  if (!r.repo) return { level: 'off', text: 'Not synced: this notes folder is not in a synced repository, so it stays on this Mac.', ...none };
  const s = r.state;
  if (!s) return { level: 'off', text: 'Sync is not running: Switchboard has not reported on this folder yet.', ...none };
  if (s.unreadable) return { level: 'trouble', text: 'Sync status could not be read: the state file is damaged.', ...none };
  const at = s.at ? Date.parse(s.at) / 1000 : NaN;
  const clashes = s.clashes ?? 0, cameBack = s.cameBack ?? [];
  if (!isFinite(at) || r.now - at > STALE_SECONDS) {
    const when = isFinite(at) ? ` Its last report was ${ago(r.now - at)}.` : '';
    return { level: 'off', text: `Sync is not running.${when} Notes still save here, but they are not reaching other devices.`, clashes, cameBack };
  }
  if (s.ok === false) {
    return { level: 'trouble', text: `Sync has a problem: ${s.problem || 'it did not say what'}.`, clashes, cameBack };
  }
  const parts: string[] = [];
  if (clashes) parts.push(`${plural(clashes, 'note')} hold${clashes === 1 ? 's' : ''} two versions, so settle ${clashes === 1 ? 'it' : 'them'}`);
  if (s.behind) parts.push(`${plural(s.behind, 'change')} from other devices ${s.behind === 1 ? 'is' : 'are'} waiting here`);
  if (s.ahead) parts.push(`${plural(s.ahead, 'change')} here ${s.ahead === 1 ? 'has' : 'have'} not been sent yet`);
  if (cameBack.length) parts.push(`${plural(cameBack.length, 'deleted note')} came back because it was edited elsewhere`);
  if (!parts.length) return { level: 'ok', text: `Synced ${ago(r.now - at)}.`, clashes, cameBack };
  return { level: clashes ? 'trouble' : 'waiting', text: parts.join('; ').replace(/^./, c => c.toUpperCase()) + '.', clashes, cameBack };
}
