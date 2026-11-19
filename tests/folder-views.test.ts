import { describe, it, expect, beforeEach } from 'vitest';
import { folderView, keepFolderView, dropFolderView, allFolderViews, folderKey, folderTree } from '../src/folder-views';

describe('folders that keep their own view', () => {
  beforeEach(() => { for (const k of Object.keys(allFolderViews())) dropFolderView(k); });

  it('keeps nothing until asked', () => {
    expect(folderView('/a/b/')).toBeNull();
  });
  it('treats a trailing slash as the same folder', () => {
    keepFolderView('/a/b/', { view: 'tiles' });
    expect(folderView('/a/b')).toEqual({ view: 'tiles' });
    expect(folderKey('/')).toBe('/');
  });
  it('changes part of what a folder keeps', () => {
    keepFolderView('/a', { view: 'list', group: 'ext' });
    keepFolderView('/a', { sort: { col: 'size', dir: 'desc' } });
    expect(folderView('/a')).toEqual({ view: 'list', group: 'ext', sort: { col: 'size', dir: 'desc' } });
  });
  it('lets a folder follow the default again', () => {
    keepFolderView('/a', { view: 'list' });
    dropFolderView('/a/');
    expect(folderView('/a')).toBeNull();
  });
  it('lays folders out as a tree under the kept folder above them', () => {
    expect(folderTree(['/u/code/app', '/u/code', '/u/notes', '/u/code/app/src', '/u/codex'])).toEqual([
      { path: '/u/code', depth: 0, tail: '/u/code' },
      { path: '/u/code/app', depth: 1, tail: 'app' },
      { path: '/u/code/app/src', depth: 2, tail: 'src' },
      { path: '/u/codex', depth: 0, tail: '/u/codex' },
      { path: '/u/notes', depth: 0, tail: '/u/notes' },
    ]);
    expect(folderTree(['/', '/etc'])).toEqual([{ path: '/', depth: 0, tail: '/' }, { path: '/etc', depth: 1, tail: 'etc' }]);
  });
  it('leaves out a damaged part, so the defaults fill it', () => {
    keepFolderView('/d', { view: 'nonsense', sort: { col: 'weird', dir: 'up' }, group: 'odd' } as never);
    expect(folderView('/d')).toEqual({});
    keepFolderView('/e', { view: 'tiles', sort: { col: null, dir: 'desc' }, group: 'ext' });
    expect(folderView('/e')).toEqual({ view: 'tiles', sort: { col: null, dir: 'desc' }, group: 'ext' });
  });
});
