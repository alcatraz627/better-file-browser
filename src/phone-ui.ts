// bfb's layout on a phone. Only the phone build loads this. On a narrow
// screen the sidebar becomes a drawer that rises from the bottom (the sidebar
// button opens it, the scrim or a pick closes it), controls grow to finger
// size, the preview fills the screen, and buttons that need the Mac itself
// (terminal, open in an app) step aside.
const PHONE_CSS = `
@media (max-width:760px){
  html.bfb-web,html.bfb-web body{overscroll-behavior:none}
  .bfb-web #fe-body{padding:4px}
  .bfb-web #fe-side-rz,.bfb-web #fe-term-btn,.bfb-web #fe-status-path{display:none!important}
  .bfb-web #fe-toc-rail:not([hidden]){position:fixed!important;left:0;right:0;bottom:0;top:auto;width:auto!important;height:min(72vh,620px);
    z-index:430;border-radius:18px 18px 0 0;border:1px solid var(--bd);background:var(--card);box-shadow:0 -12px 40px rgb(var(--ink) / .4);padding-bottom:env(safe-area-inset-bottom)}
  .bfb-web #fe-side{position:fixed!important;left:6px;right:6px;bottom:calc(6px + env(safe-area-inset-bottom));top:auto;
    width:auto!important;height:min(76vh,640px);z-index:450;border-radius:18px;box-shadow:0 -12px 40px rgb(var(--ink) / .45);
    transform:translateY(calc(100% + 24px));transition:transform .26s var(--ease);display:flex!important}
  .bfb-web #fe-side.fe-drawer-open{transform:none}
  html.bfb-web #fe #fe-side{width:auto!important;flex-direction:column;overflow:hidden;background:var(--side);border:1px solid var(--bd)}
  html.bfb-web #fe #fe-rail{flex-direction:row;padding:var(--sp-2) var(--sp-3);border-bottom:1px solid var(--bd);border-right:0;overflow-x:auto}
  html.bfb-web #fe #fe-lenses,html.bfb-web #fe #fe-side.open #fe-lenses{display:block!important;position:static!important;width:auto!important;flex:1;min-height:0;
    overflow-y:auto;border:0;box-shadow:none;animation:none;background:none}
  .bfb-web #fe-side::before{content:'';display:block;width:40px;height:5px;margin:8px auto 2px;border-radius:3px;background:var(--bd2);flex:none}
  .bfb-web .fe-drawer-scrim{position:fixed;inset:0;z-index:440;background:rgb(var(--ink) / .4);opacity:0;pointer-events:none;transition:opacity .2s}
  .bfb-web .fe-drawer-scrim.on{opacity:1;pointer-events:auto}
  .bfb-web #fe-main{border-radius:12px}
  .bfb-web #fe-bar{padding-left:max(6px,env(safe-area-inset-left));padding-right:max(6px,env(safe-area-inset-right))}
  .bfb-web #fe-qlook{position:fixed!important;inset:0!important;width:auto!important;height:auto!important;max-width:none!important;border-radius:0!important;z-index:420}
  .bfb-web #fe-page .fe-md{padding:18px 16px 80px}
  .bfb-web .fe-dv-view-box{inset:0!important;width:100vw!important;height:100dvh!important;max-width:none!important;border-radius:0!important}
}
@media (pointer:coarse){
  .bfb-web .btn[data-icon]{min-width:36px;min-height:36px}
  .bfb-web .row.fe-si,.bfb-web .fe-ctx-item,.bfb-web .fe-dd-item{min-height:44px}
  .bfb-web #fe-tbody tr td{padding-top:10px;padding-bottom:10px}
  .bfb-web .fe-cm-tools .btn{min-height:34px}
  .bfb-web textarea,.bfb-web input[type="text"],.bfb-web input[type="search"]{font-size:16px}
}`;

const narrow = () => matchMedia('(max-width:760px)').matches;

function drawer(open: boolean): void {
  const side = document.getElementById('fe-side');
  if (!side) return;
  side.style.display = '';
  side.classList.toggle('fe-drawer-open', open);
  document.querySelector('.fe-drawer-scrim')?.classList.toggle('on', open);
}

// The app builds its page after the Mac's settings load; dress it once it is there.
function whenBuilt(then: () => void): void {
  if (document.getElementById('fe') && document.head.querySelector('style')) { then(); return; }
  requestAnimationFrame(() => whenBuilt(then));
}

whenBuilt(() => {
  const style = document.createElement('style');
  style.id = 'bfb-phone-css';
  style.textContent = PHONE_CSS;
  document.head.append(style);
  const scrim = document.createElement('div');
  scrim.className = 'fe-drawer-scrim';
  document.getElementById('fe')!.append(scrim);
  scrim.addEventListener('click', () => drawer(false));
  // The sidebar button opens and closes the drawer instead of folding the sidebar.
  document.addEventListener('click', e => {
    if (!narrow()) return;
    const t = e.target as HTMLElement;
    if (t.closest('#fe-side-toggle')) {
      e.preventDefault(); e.stopImmediatePropagation();
      drawer(!document.getElementById('fe-side')?.classList.contains('fe-drawer-open'));
      return;
    }
    // Following a link from the drawer closes it.
    if (t.closest('#fe-side a[href]')) drawer(false);
  }, true);
  // A swipe down on the drawer's top closes it.
  let y0 = -1;
  const side = document.getElementById('fe-side');
  side?.addEventListener('touchstart', e => { y0 = side.scrollTop <= 0 && e.touches[0].clientY - side.getBoundingClientRect().top < 60 ? e.touches[0].clientY : -1; }, { passive: true });
  side?.addEventListener('touchend', e => { if (y0 >= 0 && e.changedTouches[0].clientY - y0 > 60) drawer(false); y0 = -1; }, { passive: true });
});

export {};
