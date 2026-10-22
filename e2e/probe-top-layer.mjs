// Does the browser's top layer (the popover attribute) work for an element the
// extension adds to a file:// listing? If so, layers can stack by opening order
// instead of z-index (docs/plan/component-system.md, 5.4).
//   node e2e/probe-top-layer.mjs
import { launch } from './harness.mjs';

const h = await launch();
try {
  const page = await h.open();
  const r = await page.evaluate(() => {
    const fe = document.getElementById('fe');
    const a = document.createElement('div'), b = document.createElement('div');
    for (const [el, txt] of [[a, 'first'], [b, 'second']]) {
      el.setAttribute('popover', 'manual'); el.textContent = txt;
      el.style.cssText = 'inset:auto;left:100px;top:100px;width:120px;height:60px;margin:0';
      fe.appendChild(el);
    }
    const supported = typeof a.showPopover === 'function';
    if (!supported) return { supported };
    a.showPopover(); b.showPopover();
    const top = document.elementFromPoint(150, 130)?.textContent;
    const open = [a.matches(':popover-open'), b.matches(':popover-open')];
    // A z-index on an ordinary element cannot cover a top-layer element.
    const cover = document.createElement('div');
    cover.style.cssText = 'position:fixed;left:0;top:0;width:400px;height:400px;z-index:2147483647';
    cover.textContent = 'cover';
    fe.appendChild(cover);
    const stillTop = document.elementFromPoint(150, 130)?.textContent;
    return { supported, open, top, stillTop, highlights: typeof CSS !== 'undefined' && 'highlights' in CSS };
  });
  console.log(JSON.stringify(r));
  const ok = r.supported && r.open.every(Boolean) && r.top === 'second' && r.stillTop === 'second';
  console.log(ok ? 'ok   top layer works on file:// pages; later popovers stack above earlier ones and above any z-index' : 'FAIL top layer does not behave as needed');
  if (!ok) process.exitCode = 1;
} finally { await h.close(); }
