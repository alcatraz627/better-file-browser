import { describe, expect, it } from 'vitest';
import { linkOf, rowLinks } from '../src/directions-list';

// The shapes below are the ones real directions docs carry (GitHub issues,
// pull requests and commits, Linear tickets, Google docs, other pages, and
// relative file and folder paths), with made-up names.
describe('linkOf', () => {
  const label = (raw: string) => { const l = linkOf(raw); return l && [l.kind, l.label]; };
  it('names GitHub pull requests, issues and commits', () => {
    expect(label('https://github.com/acme/app/pull/365')).toEqual(['pr', 'PR #365']);
    expect(label('https://github.com/acme/app/issues/116')).toEqual(['issue', '#116']);
    expect(label('https://github.com/acme/app/commit/d2c6055')).toEqual(['commit', 'd2c6055']);
    expect(label('https://github.com/acme/app/commit/d2c6055aa81f3e')).toEqual(['commit', 'd2c6055']);
    expect(linkOf('https://github.com/acme/app/pull/35')!.title).toBe('Pull request #35 in acme/app');
  });
  it('names Linear tickets by their id', () => {
    expect(label('https://linear.app/acme/issue/VER-1034/some-slug')).toEqual(['linear', 'VER-1034']);
  });
  it('names Google docs by type and other pages by host', () => {
    expect(label('https://docs.google.com/document/d/abc/edit')).toEqual(['doc', 'Google Doc']);
    expect(label('https://docs.google.com/spreadsheets/d/abc')).toEqual(['doc', 'Google Sheet']);
    expect(label('https://www.example.com/a/b')).toEqual(['web', 'example.com']);
    expect(label('https://claude.ai/artifact/XYZ')).toEqual(['web', 'claude.ai']);
  });
  it('names files and folders by their last part', () => {
    expect(label('../../packages/ui/package.json')).toEqual(['file', 'package.json']);
    expect(label('../../.claude/output/20261021-recon')).toEqual(['file', '20261021-recon']);
    expect(label('../ui-categorical/')).toEqual(['file', 'ui-categorical']);
    expect(label('90-defect-prevention.md')).toEqual(['file', '90-defect-prevention.md']);
    expect(linkOf('../../scripts/a%20b.md')!.label).toBe('a b.md');
  });
  it('leaves out links within the page and non-links', () => {
    expect(linkOf('#section')).toBeNull();
    expect(linkOf('')).toBeNull();
    expect(linkOf('mailto:x@y.z')).toBeNull();
  });
});

describe('rowLinks', () => {
  const row = (html: string) => { const t = document.createElement('table'); t.innerHTML = `<tr>${html}</tr>`; return t.rows[0]; };
  it('lists each link of a row once, in order, from any cell', () => {
    const r = row('<td><a href="https://github.com/acme/app/issues/196">GH#196</a></td>'
      + '<td>See <a href="../x/plan.md">plan</a> and <a href="https://github.com/acme/app/pull/7">PR</a></td>'
      + '<td><a href="../x/plan.md">again</a> <a href="#local">here</a></td>');
    expect(rowLinks(r).map(l => l.label)).toEqual(['#196', 'plan.md', 'PR #7']);
  });
  it('gives nothing for a row without links', () => {
    expect(rowLinks(row('<td>A1</td><td>Plain words</td>'))).toEqual([]);
  });
});
