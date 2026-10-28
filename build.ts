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
    loader:      { '.css': 'text' },
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
    format: 'iife', target: 'chrome100', platform: 'browser', minify: false, loader: { '.css': 'text' },
    logLevel: 'info',
  });

  // A decision page outside the extension, served by gcc's page server at /dp-assets/dp-web.js.
  const dpWebCtx = await esbuild.context({
    entryPoints: ['src/dp-web.ts'], bundle: true, outfile: 'assets/dp-web/dp-web.js', loader: { '.css': 'text' },
    format: 'iife', target: 'chrome100', platform: 'browser', minify: true,
    logLevel: 'info',
  });

  // bfb as a web page for a phone on the tailnet, served by native/web_server.py.
  const webCtx = await esbuild.context({
    entryPoints: ['src/web.ts'], bundle: true, outfile: 'assets/web/web.js',
    format: 'iife', target: 'safari16', platform: 'browser', minify: true, loader: { '.css': 'text' },
    logLevel: 'info',
  });

  const all = [ctx, mermaidCtx, searchCtx, designCtx, dpWebCtx, webCtx];
  if (watch) {
    await Promise.all(all.map(c => c.watch()));
    console.log('Watching for changes…');
  } else {
    await Promise.all(all.map(c => c.rebuild()));
    await Promise.all(all.map(c => c.dispose()));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
