import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { renderMarkdown } from '../src/renderers';
import { toDocx } from '../src/docx';
import { zip } from '../src/zip';

const docOf = (md: string) => {
  const root = document.createElement('div');
  root.innerHTML = renderMarkdown(md);
  return root.querySelector<HTMLElement>('.fe-md') ?? root;
};
const save = async (b: Blob, name: string) => {
  const f = join(mkdtempSync(join(tmpdir(), 'bfb-docx-')), name);
  writeFileSync(f, new Uint8Array(await b.arrayBuffer()));
  return f;
};

describe('zip', () => {
  it('writes an archive that unzip lists and reads back', async () => {
    const f = await save(zip([{ name: 'a.txt', data: 'hello' }, { name: 'dir/b.txt', data: 'two' }]), 'x.zip');
    expect(execFileSync('unzip', ['-Z1', f]).toString().trim().split('\n')).toEqual(['a.txt', 'dir/b.txt']);
    expect(execFileSync('unzip', ['-p', f, 'dir/b.txt']).toString()).toBe('two');
    // unzip -t checks every CRC; a wrong checksum fails here.
    expect(execFileSync('unzip', ['-t', f]).toString()).toMatch(/No errors detected/);
  });
});

describe('toDocx', () => {
  const md = '# Title\n\nText with **bold**, `code` and a [link](https://example.com).\n\n- one\n  - nested\n1. first\n\n| a | b |\n|---|---|\n| 1 | <2> & 3 |\n\n```ts\nconst x = 1;\n```\n\n> quoted\n';
  it('writes headings, lists, a table, code and a link as Word parts', async () => {
    const f = await save(toDocx(docOf(md), 'Title'), 'd.docx');
    const xml = execFileSync('unzip', ['-p', f, 'word/document.xml']).toString();
    expect(xml).toContain('<w:pStyle w:val="Heading1"/>');
    expect(xml).toMatch(/<w:numPr><w:ilvl w:val="1"\/><w:numId w:val="1"\/><\/w:numPr>/);
    expect(xml).toMatch(/<w:numId w:val="2"\/>/);
    expect(xml).toContain('<w:tbl>');
    expect(xml).toContain('&lt;2&gt; &amp; 3');
    expect(xml).toContain('<w:pStyle w:val="Code"/>');
    expect(xml).toContain('<w:pStyle w:val="Quote"/>');
    expect(xml).toMatch(/<w:hyperlink r:id="rId\d+">/);
    const rels = execFileSync('unzip', ['-p', f, 'word/_rels/document.xml.rels']).toString();
    expect(rels).toContain('Target="https://example.com/" TargetMode="External"');
  });
  it('opens in a real reader', async () => {
    const f = await save(toDocx(docOf(md), 'Title'), 'd.docx');
    const out = f.replace(/\.docx$/, '.txt');
    execFileSync('textutil', ['-convert', 'txt', '-output', out, f]);
    const txt = execFileSync('cat', [out]).toString();
    expect(txt).toContain('Title');
    expect(txt).toContain('nested');
    expect(txt).toContain('const x = 1;');
  });
});
