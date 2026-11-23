// @vitest-environment node
// The built files are committed and are what Chrome, the phone page and
// decision pages load. This fails when one no longer matches its source, so a
// source change cannot be committed without its build.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as esbuild from 'esbuild';
import { BUNDLES } from '../build';

// Mermaid's bundle is five megabytes of a vendored library and changes only
// with package.json; rebuilding it here would cost more than it guards.
const checked = BUNDLES.filter(b => b.outfile !== 'vendor-mermaid.js');

describe('built files match their source', () => {
  it('covers every bundle but the vendored one', () => {
    expect(checked.length).toBe(BUNDLES.length - 1);
    expect(checked.length).toBeGreaterThanOrEqual(8);
  });
  it.each(checked.map(b => [b.outfile as string, b] as const))('%s', async (outfile, options) => {
    const built = await esbuild.build({ ...options, write: false, logLevel: 'silent' });
    const fresh = built.outputFiles![0].text;
    const onDisk = readFileSync(outfile, 'utf8');
    expect(fresh === onDisk, `${outfile} is older than its source: run npm run build and commit the result`).toBe(true);
  }, 60_000);
});
