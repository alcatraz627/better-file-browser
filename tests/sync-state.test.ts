import { describe, it, expect } from 'vitest';
import { describeSync, type SyncReply } from '../src/sync-state';

const NOW = Date.parse('2026-11-01T14:10:00Z') / 1000;
const rep = (state: SyncReply['state'], repo = true): SyncReply => ({ repo, state, now: NOW });
const fresh = { at: '2026-11-01T14:09:00Z', ok: true, problem: null, ahead: 0, behind: 0, clashes: 0, cameBack: [] as string[] };

describe('describeSync', () => {
  it('synced says how long ago', () => {
    expect(describeSync(rep(fresh))).toMatchObject({ level: 'ok', text: 'Synced 1 minute ago.' });
  });
  it('a folder in no repository says it stays on this Mac', () => {
    const v = describeSync(rep(null, false));
    expect(v.level).toBe('off'); expect(v.text).toMatch(/Stays on this Mac/);
  });
  it('a report older than ten minutes is "sync is not running", whatever it said', () => {
    const v = describeSync(rep({ ...fresh, at: '2026-11-01T13:55:00Z' }));
    expect(v.level).toBe('off'); expect(v.text).toMatch(/^Sync is not running\. Its last report was 15 minutes ago/);
    expect(describeSync(rep({ ...fresh, at: '2026-11-01T14:00:01Z' })).level).toBe('ok');   // 9 minutes 59 seconds is still fresh
  });
  it('no state file at all is also "not running"', () => {
    expect(describeSync(rep(null)).text).toMatch(/^Sync is not running/);
  });
  it('a failed round names the problem in the words Switchboard gave', () => {
    const v = describeSync(rep({ ...fresh, ok: false, problem: 'GitHub refused the push' }));
    expect(v).toMatchObject({ level: 'trouble', text: 'Sync has a problem: GitHub refused the push.' });
  });
  it('says how far behind, and what has not been sent', () => {
    expect(describeSync(rep({ ...fresh, behind: 3 })).text).toBe('3 changes from other devices are waiting here.');
    expect(describeSync(rep({ ...fresh, ahead: 1 })).text).toBe('1 change here has not been sent yet.');
  });
  it('counts clashes and notes that came back', () => {
    const v = describeSync(rep({ ...fresh, clashes: 2, cameBack: ['20261101-100000-ab12'] }));
    expect(v.level).toBe('trouble'); expect(v.clashes).toBe(2);
    expect(v.text).toBe('2 notes hold two versions, so settle them; 1 deleted note came back because it was edited elsewhere.');
  });
  it('a damaged state file is said plainly', () => {
    expect(describeSync(rep({ unreadable: true })).text).toMatch(/damaged/);
  });
});
