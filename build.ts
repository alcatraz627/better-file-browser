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

  if (watch) {
    await ctx.watch();
    console.log('Watching for changes…');
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
