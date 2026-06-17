import { describe, it, expect } from 'vitest';
import { canPreview } from '../src/preview';
import type { Entry } from '../src/types';

const file = (name: string): Entry =>
  ({ name, href: 'file:///x/' + name, isDir: false, isParent: false, isHidden: false, rawBytes: 1, dateMs: NaN, dateStr: '' });
const dir = (name: string): Entry =>
  ({ name, href: 'file:///x/' + name + '/', isDir: true, isParent: false, isHidden: false, rawBytes: -1, dateMs: NaN, dateStr: '' });

describe('canPreview', () => {
  it('accepts the new binary media types', () => {
    ['doc.pdf', 'clip.mp4', 'clip.webm', 'song.mp3', 'tune.flac', 'face.woff2', 'face.ttf']
      .forEach(n => expect(canPreview(file(n)), n).toBe(true));
  });
  it('still accepts text/table/code/image types', () => {
    ['data.tsv', 'log.jsonl', 'app.json', 'run.sh', 'README.md', 'pic.png']
      .forEach(n => expect(canPreview(file(n)), n).toBe(true));
  });
  it('rejects folders, parent, and unhandled binary types', () => {
    expect(canPreview(dir('src'))).toBe(false);
    expect(canPreview({ ...file('..'), isParent: true })).toBe(false);
    expect(canPreview(file('archive.zip'))).toBe(false);
  });
});
