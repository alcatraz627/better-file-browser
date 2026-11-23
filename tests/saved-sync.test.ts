// A save made while Saved is being written to the notes folder must not be
// undone when the sync then reads the folder back.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Place } from '../src/types';

const host = vi.hoisted(() => ({
  duringWrite: null as null | (() => void),
  folder: [] as { key: string; text: string; mtime: number }[],
}));
vi.mock('../src/notes', async importOriginal => ({
  ...await importOriginal<typeof import('../src/notes')>(),
  notes: {
    savedList: async () => ({ exists: true, items: host.folder, tags: {} }),
    savedSync: async () => { host.duringWrite?.(); return { written: [], skipped: [], removed: [] }; },
  },
}));

describe('Saved sync', () => {
  beforeEach(() => { localStorage.clear(); vi.resetModules(); host.duringWrite = null; host.folder = []; });

  it('keeps a place saved while the folder write was running', async () => {
    const storage = await import('../src/storage');
    const sync = await import('../src/saved-sync');
    const s = storage.getSettings(); s.notesRoot = '/notes'; storage.saveSettings(s);
    localStorage.setItem('bfb-saved-moved-v1', JSON.stringify({ root: '/notes', at: 1 }));
    const first = { path: '/first', label: 'First' } as Place, late = { path: '/late', label: 'Late' } as Place;
    storage.saveSaved([first]);
    // The person saves another place while the first push is at the notes host.
    host.duringWrite = () => { host.duringWrite = null; storage.saveSaved([first, late]); };
    await sync.pullSaved();
    expect(storage.getSaved().map(p => p.path)).toEqual(['/first', '/late']);
    expect(storage.savedUnsent()).toBe(true);
  });

  it('still takes the folder\'s list when nothing is waiting to be sent', async () => {
    const storage = await import('../src/storage');
    const sync = await import('../src/saved-sync');
    const files = await import('../src/saved-files');
    const s = storage.getSettings(); s.notesRoot = '/notes'; storage.saveSettings(s);
    localStorage.setItem('bfb-saved-moved-v1', JSON.stringify({ root: '/notes', at: 1 }));
    const key = await files.placeKey('/from-folder');
    host.folder = [{ key, text: files.placeText({ path: '/from-folder', label: 'From folder' } as Place, 'a0', null), mtime: 1 }];
    expect(await sync.pullSaved()).toBe('pulled');
    expect(storage.getSaved().map(p => p.path)).toEqual(['/from-folder']);
  });
});
