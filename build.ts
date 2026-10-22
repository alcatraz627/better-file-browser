import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ['src/main.ts'],
    bundle:      true,
    outfile:     'content.js',
    format:      'iife',
    target:      'chrome100',
    platform:    'browser',
    sourcemap:   false,
    minify:      false,
    logLevel:    'info',
  });
  const mermaidCtx = await esbuild.context({
    entryPoints: ['src/mermaid-runtime.ts'], bundle: true, outfile: 'vendor-mermaid.js',
    format: 'esm', target: 'chrome100', platform: 'browser', minify: true,
    logLevel: 'info',
  });
  const searchCtx = await esbuild.context({
    entryPoints: ['src/search-worker.ts'], bundle: true, outfile: 'search-worker.js',
    format: 'iife', target: 'chrome100', platform: 'browser', minify: true,
    logLevel: 'info',
  });

  // The design-system page (design.html), opened from the extension's own URL.
  const designCtx = await esbuild.context({
    entryPoints: ['src/design-page.ts'], bundle: true, outfile: 'design.js',
    format: 'iife', target: 'chrome100', platform: 'browser', minify: false,
    logLevel: 'info',
  });

  if (watch) {
    await Promise.all([ctx.watch(), mermaidCtx.watch(), searchCtx.watch(), designCtx.watch()]);
    console.log('Watching for changes…');
  } else {
    await Promise.all([ctx.rebuild(), mermaidCtx.rebuild(), searchCtx.rebuild(), designCtx.rebuild()]);
    await ctx.dispose();
    await mermaidCtx.dispose();
    await searchCtx.dispose();
    await designCtx.dispose();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
