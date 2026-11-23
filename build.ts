import * as esbuild from 'esbuild';

const browser = { bundle: true, platform: 'browser', logLevel: 'info' } as const;

/**
 * Every file the build writes, with the source it comes from. The built files
 * are committed, since Chrome, the phone page and decision pages all load them
 * as they are; tests/bundles.test.ts fails when one is older than its source.
 */
export const BUNDLES: esbuild.BuildOptions[] = [
  // The explorer and file pages on file://.
  { ...browser, entryPoints: ['src/main.ts'], outfile: 'content.js', format: 'iife', target: 'chrome100', sourcemap: false, minify: false, loader: { '.css': 'text' } },
  { ...browser, entryPoints: ['src/mermaid-runtime.ts'], outfile: 'vendor-mermaid.js', format: 'esm', target: 'chrome100', minify: true },
  { ...browser, entryPoints: ['src/search-worker.ts'], outfile: 'search-worker.js', format: 'iife', target: 'chrome100', minify: true },
  // The design-system page (design.html), opened from the extension's own URL.
  { ...browser, entryPoints: ['src/design-page.ts'], outfile: 'design.js', format: 'iife', target: 'chrome100', minify: false, loader: { '.css': 'text' } },
  // A decision page outside the extension, served by gcc's page server at /dp-assets/dp-web.js.
  { ...browser, entryPoints: ['src/dp-web.ts'], outfile: 'assets/dp-web/dp-web.js', loader: { '.css': 'text' }, format: 'iife', target: 'chrome100', minify: true },
  // bfb as a web page for a phone on the tailnet, served by native/web_server.py.
  { ...browser, entryPoints: ['src/web.ts'], outfile: 'assets/web/web.js', format: 'iife', target: 'safari16', minify: true, loader: { '.css': 'text' } },
  // Plugins for ordinary websites, such as the metro switch on Booking and Airbnb maps.
  { ...browser, entryPoints: ['src/site-plugins.ts'], outfile: 'site-plugins.js', format: 'iife', target: 'chrome111', minify: true },
  // The same plugins' link to the network and the extension's cache.
  { ...browser, entryPoints: ['src/site-bridge.ts'], outfile: 'site-bridge.js', format: 'iife', target: 'chrome111', minify: true },
  // Lights (dark mode) and Marks (comments and pins) on every ordinary website.
  { ...browser, entryPoints: ['src/site-tools.ts'], outfile: 'site-tools.js', format: 'iife', target: 'chrome120', minify: true },
];

async function main() {
  const watch = process.argv.includes('--watch');
  const all = await Promise.all(BUNDLES.map(b => esbuild.context(b)));
  if (watch) {
    await Promise.all(all.map(c => c.watch()));
    console.log('Watching for changes…');
  } else {
    await Promise.all(all.map(c => c.rebuild()));
    await Promise.all(all.map(c => c.dispose()));
  }
}

// Run as the build script; imported by the bundle test for the list above.
if (/build\.ts$/.test(process.argv[1] ?? '')) main().catch(e => { console.error(e); process.exit(1); });
