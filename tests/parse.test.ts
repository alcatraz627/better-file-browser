import { describe, it, expect } from 'vitest';
import { parseAddRows, parseListing } from '../src/parse';

const BASE = 'file:///tmp/bfb-fixtures/';
const TEMPLATE = `
<!DOCTYPE html><html><head></head><body>
<table><thead><tr><th>Name</th></tr></thead></table>
<script>start("/tmp/bfb-fixtures/");</script>
<script>onHasParentDirectory();</script>
<script>addRow("sub","sub",1,160,"160 B",1781262723,"12/06/2026, 16:42:03");</script>
<script>addRow("data.tsv","data.tsv",0,67,"67 B",1781262723,"12/06/2026, 16:42:03");</script>
<script>addRow(".hidden",".hidden",0,5,"5 B",1781262723,"12/06/2026, 16:42:03");</script>
</body></html>`;

describe('parseAddRows', () => {
  it('extracts files and dirs from addRow script calls', () => {
    const entries = parseAddRows(TEMPLATE, BASE);
    expect(entries.map(e => e.name)).toEqual(['sub', 'data.tsv', '.hidden']);
    const dir = entries[0], file = entries[1];
    expect(dir.isDir).toBe(true);
    expect(dir.href).toBe('file:///tmp/bfb-fixtures/sub/');
    expect(file.isDir).toBe(false);
    expect(file.href).toBe('file:///tmp/bfb-fixtures/data.tsv');
    expect(file.rawBytes).toBe(67);
    expect(file.dateStr).toBe('12/06/2026, 16:42:03');
  });

  it('marks dotfiles hidden', () => {
    const entries = parseAddRows(TEMPLATE, BASE);
    expect(entries[2].isHidden).toBe(true);
  });

  it('skips malformed lines without failing', () => {
    const entries = parseAddRows('addRow(garbage);\naddRow("ok","ok",0,1,"1 B",0,"d");', BASE);
    expect(entries.map(e => e.name)).toEqual(['ok']);
  });

  it('resolves URL-encoded names against the base', () => {
    const entries = parseAddRows('addRow("with space","with%20space",0,1,"1 B",0,"d");', BASE);
    expect(entries[0].href).toBe('file:///tmp/bfb-fixtures/with%20space');
  });
});

describe('parseListing', () => {
  it('falls back to addRow parsing when the table is empty', () => {
    const entries = parseListing(TEMPLATE, BASE);
    expect(entries.length).toBe(3);
  });

  it('prefers populated table rows when present', () => {
    const html = `<table><tr><th>h</th><th>h</th><th>h</th></tr>
      <tr><td><a href="x.txt">x.txt</a></td><td data-value="9">9</td><td>d</td></tr></table>`;
    const entries = parseListing(html, BASE);
    expect(entries.map(e => e.name)).toEqual(['x.txt']);
  });
});
