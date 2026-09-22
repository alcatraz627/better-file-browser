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

  if (watch) {
    await Promise.all([ctx.watch(), mermaidCtx.watch(), searchCtx.watch()]);
    console.log('Watching for changes…');
  } else {
    await Promise.all([ctx.rebuild(), mermaidCtx.rebuild(), searchCtx.rebuild()]);
    await ctx.dispose();
    await mermaidCtx.dispose();
    await searchCtx.dispose();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
