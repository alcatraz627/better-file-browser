// bfb's layout on a phone. Only the phone build loads this; it dresses the
// same app the extension runs rather than drawing its own. On a narrow screen
// the lens rail becomes a bar along the bottom, each lens opens as a sheet
// above it, menus (a row's "…", the crumb menu) rise as sheets with a dimmed
// page behind, and buttons that need the Mac itself (terminal, open in an app)
// step aside. Taps stay at least 44px, but padding is kept tight so a screen
// still shows a useful amount of the folder.
import { runCommand } from './commands';
import { openLayer, type Layer } from './layer';
import { UI_ICON } from './control-icons';
import { notes } from './notes';
import { archivedPref } from './dp-lens';
import { forMe } from './docs-lens';
import { openPages } from './home-model';

const BAR = '52px';
const SHEETS = '#fe-ctx,.fe-ctx,#fe-crumb-menu,.fe-pmenu';

const PHONE_CSS = `
@media (max-width:760px){
  html.bfb-web,html.bfb-web body{overscroll-behavior:none}
  .bfb-web #fe-body{padding:2px 2px calc(${BAR} + env(safe-area-inset-bottom))}
  .bfb-web #fe-side-rz,.bfb-web #fe-term-btn,.bfb-web #fe-status-path,.bfb-web #fe-side-toggle{display:none!important}
  .bfb-web #fe-main{border-radius:10px}
  .bfb-web #fe-bar{gap:2px;padding-left:max(4px,env(safe-area-inset-left));padding-right:max(4px,env(safe-area-inset-right))}

  /* The lens rail, moved out of the sidebar, is the bottom bar. */
  html.bfb-web #fe > #fe-rail{position:fixed;left:0;right:0;bottom:0;z-index:460;height:calc(${BAR} + env(safe-area-inset-bottom));
    flex-direction:row;align-items:stretch;gap:0;padding:0 2px env(safe-area-inset-bottom);overflow-x:auto;scrollbar-width:none;
    background:var(--side);border:0;border-top:1px solid var(--bd)}
  html.bfb-web #fe > #fe-rail .fe-rail-btn{flex:1 0 42px;min-width:42px;height:${BAR};padding:0;justify-content:center;border-radius:0}
  html.bfb-web #fe > #fe-rail .fe-rail-btn em,html.bfb-web #fe > #fe-rail .fe-rail-hl{display:none}
  html.bfb-web #fe > #fe-rail .fe-rail-btn.fe-lit{color:var(--ac);box-shadow:inset 0 2px 0 var(--ac)}
  html.bfb-web #fe > #fe-rail #fe-rail-comments{display:none}
  html.bfb-web #fe > #fe-rail #fe-rail-decisions{position:relative}
  .bfb-web #bfb-inbox-n{display:inline-block;position:absolute;top:6px;left:calc(50% + 4px);min-width:16px;height:16px;padding:0 4px;font-size:10px;line-height:16px;border-radius:8px}
  .bfb-web #bfb-inbox-n[hidden],.bfb-web #bfb-inbox-switch[hidden]{display:none!important}
  .bfb-web #bfb-inbox-switch{display:flex;margin:2px 8px 4px;flex:none}
  .bfb-web #bfb-inbox-switch .fe-seg-b{flex:1}

  /* The open lens: a sheet that rises above the bottom bar. */
  .bfb-web #fe-side{position:fixed!important;left:4px;right:4px;bottom:calc(${BAR} + env(safe-area-inset-bottom) + 4px);top:auto;
    width:auto!important;height:min(70vh,600px);z-index:450;border-radius:14px;box-shadow:0 -10px 32px rgb(var(--ink) / .4);
    transform:translateY(calc(100% + ${BAR} + 24px));transition:transform .24s var(--ease);display:flex!important}
  .bfb-web #fe-side.fe-drawer-open{transform:none}
  html.bfb-web #fe #fe-side{z-index:450;width:auto!important;flex-direction:column;overflow:hidden;background:var(--side);border:1px solid var(--bd)}
  html.bfb-web #fe #fe-lenses,html.bfb-web #fe #fe-side.open #fe-lenses{display:block!important;position:static!important;width:auto!important;flex:1;min-height:0;
    overflow-y:auto;border:0;box-shadow:none;animation:none;background:none}
  .bfb-web #fe-side::before{content:'';display:block;width:36px;height:4px;margin:6px auto 2px;border-radius:2px;background:var(--bd2);flex:none}
  .bfb-web .fe-drawer-scrim{position:fixed;inset:0;z-index:440;background:rgb(var(--ink) / .35);opacity:0;pointer-events:none;transition:opacity .2s}
  .bfb-web .fe-drawer-scrim.on{opacity:1;pointer-events:auto}

  /* Menus rise from the bottom as sheets, over a dimmed page. */
  html.bfb-web :is(${SHEETS})[data-layer]{left:4px!important;right:4px!important;top:auto!important;
    bottom:calc(4px + env(safe-area-inset-bottom))!important;width:auto!important;min-width:0;max-width:none;max-height:70vh;overflow-y:auto;
    border-radius:14px;padding:4px 4px 6px;animation:bfb-sheet-in .2s var(--ease);transform-origin:bottom center}
  html.bfb-web :is(${SHEETS})[data-layer]::before{content:'';display:block;width:36px;height:4px;margin:2px auto 4px;border-radius:2px;background:var(--bd2)}
  html.bfb-web :is(${SHEETS}):popover-open::backdrop{background:rgb(0 0 0 / .35)}
  .bfb-web .fe-ctx-key,.bfb-web .fe-ctx-item[data-act="term"],.bfb-web .fe-ctx-item[data-act^="ow:"]{display:none}
  .bfb-web .fe-ctx-sep:has(+ .fe-ctx-sep),.bfb-web .fe-ctx-item[data-act="term"] + .fe-ctx-sep{display:none}

  /* The folder's controls fit one row that scrolls sideways; the count is
     already in the status bar and the detail slider is a mouse control. */
  .bfb-web #fe-bc{justify-content:flex-start}
  .bfb-web #fe-count,.bfb-web #fe-density-wrap,.bfb-web #fe-tb-right > .bar-sep{display:none}
  .bfb-web #fe-toolbar{padding:4px 6px;min-height:0}
  .bfb-web #fe-tb-right{flex:1;min-width:0;flex-wrap:nowrap;gap:2px;overflow-x:auto;scrollbar-width:none}
  .bfb-web #fe-tb-right .fe-tb-box{order:-1;flex:1 0 110px;min-width:110px;position:sticky;left:0;z-index:1;
    background:var(--card);box-shadow:6px 0 6px -2px var(--card)}
  .bfb-web #fe-tb-right > *{flex-shrink:0}
  .bfb-web #fe-sg-cur{display:none}

  /* The tab strip waits behind a count on the top bar and opens as a sheet,
     its tabs stacked as rows. The phone-link button is for reaching the phone. */
  .bfb-web #fe-phone-btn{display:none}
  .bfb-web #bfb-pages-btn{display:inline-flex;min-width:36px;padding:0 6px;font-variant-numeric:tabular-nums;font-weight:600}
  .bfb-web #bfb-pages-btn span{min-width:20px;height:20px;padding:0 4px;border:1.5px solid currentColor;border-radius:5px;font-size:12px;line-height:17px;text-align:center}
  html.bfb-web #fe-tabbar{position:fixed;left:4px;right:4px;bottom:calc(4px + env(safe-area-inset-bottom));z-index:465;flex-direction:column;align-items:stretch;
    max-height:70vh;overflow-y:auto;padding:4px 4px 6px;border:1px solid var(--bd);border-radius:14px;background:var(--card);box-shadow:0 -10px 32px rgb(var(--ink) / .4);
    transform:translateY(calc(100% + 40px));transition:transform .24s var(--ease)}
  html.bfb-web #fe-tabbar::before{content:'';display:block;width:36px;height:4px;margin:2px auto 6px;border-radius:2px;background:var(--bd2);flex:none}
  html.bfb-web #fe-tabbar.bfb-pages-open{transform:none}
  html.bfb-web #fe-tabbar #fe-tabs{flex-direction:column;align-items:stretch;overflow:visible;gap:2px}
  html.bfb-web #fe-tabbar .fe-tab{max-width:none;width:auto;min-height:44px;border-radius:8px}
  html.bfb-web #fe-tabbar .fe-tab-x{margin-left:auto}
  html.bfb-web #fe-tabbar{display:grid;grid-template-columns:auto 1fr}
  html.bfb-web #fe-tabbar::before,html.bfb-web #fe-tabbar #fe-tabs{grid-column:1/-1}
  html.bfb-web #fe-tabbar #fe-tab-home,html.bfb-web #fe-tabbar #fe-tabs-end{grid-row:3;border:0;border-top:1px solid var(--bd);margin-top:4px;padding-top:4px;min-height:40px}
  html.bfb-web #fe-tabbar #fe-tab-home{display:flex;align-items:center;padding-inline:10px}
  html.bfb-web #fe-tabbar #fe-tab-home::after{display:none}
  html.bfb-web #fe-tabbar #fe-tabs-end{justify-content:flex-end}
  /* Reorder mode: arrows on each row; the row's other buttons step aside. */
  .bfb-web .bfb-reorder-btn{display:inline-flex;padding:0 10px}
  .bfb-web .bfb-reorder-btn.on{color:var(--ac)}
  .bfb-web .bfb-mv{display:inline-flex;gap:2px;margin-left:auto;flex:none}
  .bfb-web #fe-side.bfb-reorder :is(.fe-pl-item,.fe-nt-item) > :not(.fe-si-link,.bfb-mv,.fe-si){display:none}
  .bfb-web #fe-side.bfb-reorder :is(.fe-pl-item,.fe-nt-item){display:flex;align-items:center}

  /* The file page: its tools sit at the bottom of the page, keeping Contents,
     Find, Comments and Edit; Wrap, Raw, Copy and Keep wait under "…". */
  .bfb-web #fe.fe-file-page #fe-statusbar{display:none}
  .bfb-web #fe-fp-bar{order:9;border-bottom:0;border-top:1px solid var(--bd);padding:4px}
  .bfb-web #fe-fp-wrap,.bfb-web #fe-fp-raw,.bfb-web #fe-fp-copy,.bfb-web #fe-fp-keep{display:none!important}
  .bfb-web #bfb-fp-more{display:inline-flex;flex:none}

  /* A decision page's answer bar stays at the bottom with Submit in reach. */
  .bfb-web #fe-dp{--dp-pad-y:12px;padding:12px 10px 72px}
  .bfb-web .fe-dp-bar{position:fixed;left:4px;right:4px;bottom:calc(${BAR} + env(safe-area-inset-bottom) + 4px);top:auto;z-index:400;margin:0;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;padding:4px 4px 4px 10px}
  .bfb-web .fe-dp-bar > *{flex-shrink:0}
  .bfb-web #fe-dp-reset,.bfb-web #fe-dp-panel,.bfb-web #fe-dp-copy > span{display:none}
  .bfb-web .fe-dp-bar-end{position:sticky;right:0;padding-left:6px;background:var(--card)}
  .bfb-web .fe-dp-side{display:none}

  /* Select mode: a tap picks a row; the bar replaces the bottom bar meanwhile. */
  .bfb-web #bfb-select-btn{display:inline-flex;padding:0 10px}
  .bfb-web #bfb-select-btn.on{color:var(--ac)}
  .bfb-web #fe.fe-selecting .fe-acts{display:none}
  .bfb-web #bfb-select-bar.on{display:flex;align-items:center;gap:4px;position:fixed;left:0;right:0;bottom:0;z-index:461;
    height:calc(${BAR} + env(safe-area-inset-bottom));padding:0 6px env(safe-area-inset-bottom);background:var(--side);border-top:1px solid var(--bd)}
  .bfb-web #bfb-select-n{flex:1;min-width:0;padding-left:6px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

  /* Editing: one pane at a time. The file editor's Raw and Rich read as Write
     and Preview and Split steps aside; the note editor gets the same switch. */
  .bfb-web .fe-fe-modes [data-mode="split"]{display:none}
  .bfb-web .fe-fe-modes [data-mode="raw"],.bfb-web .fe-fe-modes [data-mode="rich"]{font-size:0}
  .bfb-web .fe-fe-modes [data-mode="raw"]::after{content:'Write';font-size:13px}
  .bfb-web .fe-fe-modes [data-mode="rich"]::after{content:'Preview';font-size:13px}
  .bfb-web #fe-fe-pill{top:auto;bottom:calc(8px + env(safe-area-inset-bottom));right:8px;left:8px;justify-content:space-between}
  .bfb-web #fe-fe-state{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .bfb-web .fe-ed{flex-direction:column}
  .bfb-web #fe-ed-src{border:0;font-size:16px}
  .bfb-web .fe-ed:not(.bfb-ed-preview) #fe-ed-view,.bfb-web .fe-ed.bfb-ed-preview #fe-ed-src{display:none}
  .bfb-web #bfb-ed-switch{display:flex;margin:4px 6px 0;align-self:flex-start}
  .bfb-web #fe-ed-bar{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;gap:0;padding:2px 4px}
  .bfb-web #fe-ed-bar > *{flex-shrink:0}
  .bfb-web #fe-ed-bar .btn > span,.bfb-web .fe-ed-hint{display:none}

  /* Tiles fill the width in even columns instead of fixed widths with a gap at the end. */
  .bfb-web #fe[data-view="tiles"] #fe-tiles,.bfb-web #fe[data-view="icons"] #fe-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:2px;padding:4px}
  .bfb-web #fe #fe-tiles .fe-tile{width:auto!important;padding:8px 4px 6px;gap:4px;min-width:0}

  /* Each row keeps one "…" for its actions; the hover buttons are for a mouse. */
  .bfb-web .fe-row .fe-acts,.bfb-web .fe-tile .fe-acts{opacity:1;pointer-events:auto;background:none;padding:0}
  .bfb-web .fe-acts > .fe-act-btn{display:none}
  .bfb-web .fe-act-more{display:inline-flex;min-width:36px;min-height:36px;color:var(--dm)}
  .bfb-web .fe-tile .fe-acts{position:absolute;top:2px;right:2px;bottom:auto;left:auto;width:auto}

  .bfb-web #fe-toc-rail:not([hidden]){position:fixed!important;left:0;right:0;bottom:0;top:auto;width:auto!important;height:min(70vh,600px);
    z-index:470;border-radius:14px 14px 0 0;border:1px solid var(--bd);background:var(--card);box-shadow:0 -10px 32px rgb(var(--ink) / .4);padding-bottom:env(safe-area-inset-bottom)}
  .bfb-web #fe-qlook{position:fixed!important;inset:0!important;width:auto!important;height:auto!important;max-width:none!important;border-radius:0!important;z-index:420}
  .bfb-web #fe-page .fe-md{padding:14px 14px 72px}
  .bfb-web #fe-fp-meta,.bfb-web #fe-fp-column{display:none!important}
  .bfb-web #fe-fp-bar{flex-wrap:nowrap;gap:2px}
  .bfb-web #fe-fp-bar>.btn{font-size:0;gap:0;min-width:36px;padding:0 6px;justify-content:center;flex:none}
  .bfb-web #fe-fp-bar #fe-ff{flex:1 1 0;min-width:0}
  .bfb-web #fe-fp-bar .fe-fp-panes{flex:none}
  .bfb-web .fe-dv-view-box{inset:0!important;width:100vw!important;height:100dvh!important;max-width:none!important;border-radius:0!important}
}
@keyframes bfb-sheet-in{from{transform:translateY(24px);opacity:.6}}
@media (pointer:coarse){
  .bfb-web .btn[data-icon]{min-width:36px;min-height:36px}
  .bfb-web .row.fe-si,.bfb-web .fe-ctx-item,.bfb-web .fe-dd-item{min-height:44px}
  .bfb-web .fe-ctx-item{gap:12px;padding-inline:10px}
  .bfb-web #fe-tbody tr td{padding-top:7px;padding-bottom:7px}
  .bfb-web .fe-cm-tools .btn{min-height:34px}
  .bfb-web textarea,.bfb-web input[type="text"],.bfb-web input[type="search"]{font-size:16px}
}`;

const DESKTOP_ONLY = '.bfb-web #bfb-pages-btn,.bfb-web #bfb-select-btn,.bfb-web #bfb-select-bar,.bfb-web #bfb-inbox-switch,.bfb-web #bfb-inbox-n,.bfb-web #bfb-fp-more,.bfb-web .bfb-reorder-btn{display:none}';

const narrow = () => matchMedia('(max-width:760px)').matches;

// The open pages: a count on the top bar that opens the tab strip as a sheet.
function pages(open: boolean): void {
  document.getElementById('fe-tabbar')?.classList.toggle('bfb-pages-open', open);
  document.querySelector('.fe-drawer-scrim')?.classList.toggle('on', open || isOpen());
}

function addPagesButton(): void {
  const bar = document.getElementById('fe-bar'), tabs = document.getElementById('fe-tabs');
  if (!bar || !tabs) return;
  const btn = document.createElement('button');
  btn.id = 'bfb-pages-btn';
  btn.className = 'btn';
  btn.type = 'button';
  const count = document.createElement('span');
  btn.append(count);
  const update = () => {
    const n = tabs.querySelectorAll('.fe-tab').length;
    count.textContent = String(n);
    btn.title = btn.ariaLabel = `${n} open page${n === 1 ? '' : 's'}`;
  };
  update();
  new MutationObserver(update).observe(tabs, { childList: true });
  btn.addEventListener('click', () => { drawer(false); pages(!document.getElementById('fe-tabbar')!.classList.contains('bfb-pages-open')); });
  (document.getElementById('fe-phone-btn') ?? bar.lastElementChild)?.before(btn);
}
const isOpen = () => !!document.getElementById('fe-side')?.classList.contains('fe-drawer-open');

function drawer(open: boolean): void {
  const side = document.getElementById('fe-side');
  if (!side) return;
  side.style.display = '';
  side.classList.toggle('fe-drawer-open', open);
  document.querySelector('.fe-drawer-scrim')?.classList.toggle('on', open);
  // The bar lights the lens that is showing, and nothing while the sheet is down.
  let on = document.querySelector('#fe-rail .fe-rail-btn.on');
  if (on?.id === 'fe-rail-comments') on = document.getElementById('fe-rail-decisions');
  for (const b of document.querySelectorAll('#fe-rail .fe-rail-btn')) b.classList.toggle('fe-lit', open && b === on);
}

// On a narrow screen the rail (the bottom bar) and the tab strip (a sheet) sit
// directly in the page, because the sidebar and the main pane each pin fixed
// children to themselves. A wide screen puts them back where they came from.
function placeRail(): void {
  const fe = document.getElementById('fe'), side = document.getElementById('fe-side'), main = document.getElementById('fe-main');
  const rail = document.getElementById('fe-rail'), tabbar = document.getElementById('fe-tabbar');
  if (!fe || !side || !main || !rail || !tabbar) return;
  if (narrow()) { if (rail.parentElement !== fe) fe.append(rail, tabbar); return; }
  if (rail.parentElement === fe) { side.prepend(rail); main.prepend(tabbar); drawer(false); pages(false); }
}

// A swipe down that starts near the top of a sheet closes it.
function swipeToClose(sel: string, close: (el: HTMLElement) => void): void {
  let y0 = -1, target: HTMLElement | null = null;
  document.addEventListener('touchstart', e => {
    target = (e.target as HTMLElement).closest<HTMLElement>(sel);
    const t = e.touches[0];
    y0 = target && target.scrollTop <= 0 && t.clientY - target.getBoundingClientRect().top < 56 ? t.clientY : -1;
  }, { passive: true });
  document.addEventListener('touchend', e => {
    if (target && y0 >= 0 && e.changedTouches[0].clientY - y0 > 56) close(target);
    y0 = -1; target = null;
  }, { passive: true });
}

// The file page keeps four tools in reach; the rest open from a "…" as a
// sheet whose rows press the page's own buttons, so each keeps its behaviour.
const FP_MORE = ['fe-fp-keep', 'fe-fp-wrap', 'fe-fp-raw', 'fe-fp-copy'];
function fileTools(): void {
  const bar = document.getElementById('fe-fp-bar');
  if (!bar) return;
  const btn = document.createElement('button');
  btn.id = 'bfb-fp-more';
  btn.type = 'button';
  btn.className = 'btn';
  btn.dataset.icon = '';
  btn.title = 'More for this file';
  btn.setAttribute('aria-label', btn.title);
  btn.setAttribute('aria-haspopup', 'menu');
  btn.innerHTML = UI_ICON.more;
  bar.append(btn);
  const menu = document.createElement('div');
  menu.className = 'fe-ctx';
  let layer: Layer | null = null;
  btn.addEventListener('click', () => {
    menu.innerHTML = FP_MORE.map(id => document.getElementById(id)).filter((b): b is HTMLElement => !!b)
      .map(b => `<div class="row fe-ctx-item${b.classList.contains('on') ? ' on' : ''}" data-for="${b.id}">${b.querySelector('svg')?.outerHTML ?? ''}<span>${b.textContent!.trim()}</span></div>`).join('');
    layer = openLayer(menu, { kind: 'popover', anchor: btn, role: 'menu', group: 'menu', place: 'above' });
  });
  menu.addEventListener('click', e => {
    const id = (e.target as HTMLElement).closest<HTMLElement>('[data-for]')?.dataset.for;
    if (!id) return;
    layer?.close('pick');
    document.getElementById(id)?.click();
  });
}

// Reorder mode for Saved and Notes: dragging a row fights the list's scroll on
// glass, so a Reorder button gives each row an up and a down arrow instead.
// They run the same move the keyboard's ⌥↑ and ⌥↓ make on the focused row.
const MOVABLE = '.fe-pl-item, .fe-nt-item[draggable="true"]';
function reorderMode(): void {
  const side = document.getElementById('fe-side');
  if (!side) return;
  const arrows = '<span class="bfb-mv"><button type="button" class="btn" data-icon data-size="sm" data-mv="-1" aria-label="Move up">↑</button><button type="button" class="btn" data-icon data-size="sm" data-mv="1" aria-label="Move down">↓</button></span>';
  const dress = () => { if (side.classList.contains('bfb-reorder')) side.querySelectorAll<HTMLElement>(MOVABLE).forEach(r => { if (!r.querySelector(':scope > .bfb-mv')) r.insertAdjacentHTML('beforeend', arrows); }); };
  for (const tools of side.querySelectorAll<HTMLElement>('#fe-lens-saved .fe-lens-tools, #fe-lens-notes .fe-lens-tools')) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn bfb-reorder-btn';
    b.textContent = 'Reorder';
    b.title = 'Move rows up and down';
    tools.prepend(b);
  }
  side.addEventListener('click', e => {
    const t = e.target as HTMLElement;
    if (t.closest('.bfb-reorder-btn')) {
      const on = side.classList.toggle('bfb-reorder');
      side.querySelectorAll('.bfb-reorder-btn').forEach(x => { x.classList.toggle('on', on); x.textContent = on ? 'Done' : 'Reorder'; });
      if (on) dress(); else side.querySelectorAll('.bfb-mv').forEach(x => x.remove());
      return;
    }
    const mv = t.closest<HTMLElement>('[data-mv]');
    if (!mv) return;
    e.preventDefault(); e.stopPropagation();
    const row = mv.closest<HTMLElement>(MOVABLE);
    row?.querySelector<HTMLElement>('.fe-si-link')?.focus({ preventScroll: true });
    runCommand('side-reorder', mv.dataset.mv === '-1' ? '⌥↑' : '⌥↓');
  }, true);
  // A move redraws the list, so the arrows go back on whatever rows it drew.
  new MutationObserver(dress).observe(side, { childList: true, subtree: true });
}

// The Inbox: on a phone, Decisions and Comments share one button on the
// bottom bar, with a switch between them at the top of the sheet. Its badge
// counts what waits on you: decision pages to answer, and documents with open
// comments that mention you.
const INBOX = ['decisions', 'comments'];
function inbox(): void {
  const dec = document.getElementById('fe-rail-decisions'), lenses = document.getElementById('fe-lenses');
  if (!dec || !lenses) return;
  dec.dataset.hint = 'Inbox: decision pages to answer and comments for you';
  dec.setAttribute('aria-label', dec.dataset.hint);
  const badge = document.createElement('span');
  badge.id = 'bfb-inbox-n';
  badge.className = 'badge';
  badge.dataset.tone = 'solid';
  badge.dataset.size = 'sm';
  badge.hidden = true;
  dec.append(badge);
  const sw = document.createElement('div');
  sw.id = 'bfb-inbox-switch';
  sw.className = 'fe-seg';
  sw.setAttribute('role', 'group');
  sw.setAttribute('aria-label', 'Inbox');
  sw.hidden = true;
  sw.innerHTML = INBOX.map(l => `<button type="button" class="fe-seg-b" data-to="${l}">${l === 'decisions' ? 'Decisions' : 'Comments'}</button>`).join('');
  sw.addEventListener('click', e => {
    const to = (e.target as HTMLElement).closest<HTMLElement>('[data-to]')?.dataset.to;
    if (to) document.getElementById('fe-rail-' + to)?.click();
  });
  lenses.before(sw);
  document.addEventListener('bfb-lens', e => {
    const lens = (e as CustomEvent<string>).detail;
    sw.hidden = !INBOX.includes(lens);
    sw.querySelectorAll<HTMLElement>('[data-to]').forEach(b => { b.classList.toggle('on', b.dataset.to === lens); b.setAttribute('aria-pressed', String(b.dataset.to === lens)); });
  });
  const count = () => Promise.all([notes.dpPages().catch(() => []), notes.docsIndex().catch(() => [])]).then(([pages, docs]) => {
    const n = openPages(pages, new Set(archivedPref.get())).filter(r => r.state === 'waiting').length + docs.filter(d => d.open > 0 && forMe(d)).length;
    badge.textContent = String(n);
    badge.hidden = !n;
    badge.title = `${n} waiting on you`;
  });
  void count();
  setInterval(() => { if (!document.hidden && narrow()) void count(); }, 60_000);
}

// Select mode: a button in the folder's controls turns it on, and a bar over
// the bottom bar shows how many rows are picked, with All, Copy paths and Done.
// The listing owns the selection; this only drives its named commands.
function selectMode(): void {
  const tools = document.getElementById('fe-tb-right'), fe = document.getElementById('fe');
  if (!tools || !fe) return;
  const btn = document.createElement('button');
  btn.id = 'bfb-select-btn';
  btn.type = 'button';
  btn.className = 'btn';
  btn.textContent = 'Select';
  btn.title = 'Pick several files with taps';
  btn.addEventListener('click', () => runCommand('select-mode'));
  tools.querySelector('.fe-tb-box')?.after(btn);
  const bar = document.createElement('div');
  bar.id = 'bfb-select-bar';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Selection');
  bar.innerHTML = '<span id="bfb-select-n"></span><button type="button" class="btn" data-sel="select-shown">All</button>'
    + '<button type="button" class="btn" data-sel="copy-paths">Copy paths</button>'
    + '<button type="button" class="btn" data-variant="solid" data-sel="select-mode">Done</button>';
  bar.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-sel]');
    if (b) runCommand(b.dataset.sel!);
  });
  fe.append(bar);
  document.addEventListener('bfb-selection', e => {
    const n = (e as CustomEvent<number>).detail, on = fe.classList.contains('fe-selecting');
    bar.classList.toggle('on', on);
    btn.classList.toggle('on', on);
    bar.querySelector('#bfb-select-n')!.textContent = n ? `${n} picked` : 'Tap files to pick them';
    bar.querySelector<HTMLButtonElement>('[data-sel="copy-paths"]')!.disabled = !n;
  });
}

// The note editor draws its text box beside its rendered view; on a phone a
// Write | Preview switch above them shows one at a time. Each editor opening
// builds a fresh pair, so the switch is added whenever one appears.
function noteEditorSwitch(): void {
  const add = () => {
    const ed = document.querySelector<HTMLElement>('.fe-ed');
    if (!ed || document.getElementById('bfb-ed-switch')) return;
    const sw = document.createElement('span');
    sw.id = 'bfb-ed-switch';
    sw.className = 'fe-seg';
    sw.setAttribute('role', 'group');
    sw.setAttribute('aria-label', 'View');
    sw.innerHTML = '<button type="button" class="fe-seg-b on" data-ed="write" aria-pressed="true">Write</button><button type="button" class="fe-seg-b" data-ed="preview" aria-pressed="false">Preview</button>';
    sw.addEventListener('click', e => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-ed]');
      if (!b) return;
      const preview = b.dataset.ed === 'preview';
      ed.classList.toggle('bfb-ed-preview', preview);
      sw.querySelectorAll<HTMLElement>('[data-ed]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
      if (!preview) ed.querySelector<HTMLTextAreaElement>('#fe-ed-src')?.focus({ preventScroll: true });
    });
    ed.before(sw);
  };
  new MutationObserver(() => { if (narrow()) add(); }).observe(document.getElementById('fe')!, { childList: true, subtree: true });
}

// The app builds its page after the Mac's settings load; dress it once it is there.
function whenBuilt(then: () => void): void {
  if (document.getElementById('fe') && document.head.querySelector('style')) { then(); return; }
  requestAnimationFrame(() => whenBuilt(then));
}

whenBuilt(() => {
  const style = document.createElement('style');
  style.id = 'bfb-phone-css';
  style.textContent = DESKTOP_ONLY + PHONE_CSS;
  document.head.append(style);
  // The dimmed page sits right before the sidebar, in the same stacking
  // context, so the lens sheet stays above it and takes its own taps.
  const scrim = document.createElement('div');
  scrim.className = 'fe-drawer-scrim';
  document.getElementById('fe-side')!.before(scrim);
  scrim.addEventListener('click', () => { drawer(false); pages(false); });
  placeRail();
  addPagesButton();
  noteEditorSwitch();
  selectMode();
  inbox();
  fileTools();
  reorderMode();
  matchMedia('(max-width:760px)').addEventListener('change', placeRail);
  document.addEventListener('click', e => {
    if (!narrow()) return;
    const t = e.target as HTMLElement;
    // A lens button opens its lens as a sheet; the lit one closes it again.
    // The sidebar's own handler still switches the lens.
    const b = t.closest<HTMLElement>('#fe-rail .fe-rail-btn');
    if (b) {
      const close = isOpen() && b.classList.contains('on');
      pages(false);
      requestAnimationFrame(() => drawer(!close));
      return;
    }
    // Following a link from a sheet closes it.
    if (t.closest('#fe-side a[href]')) drawer(false);
    if (t.closest('#fe-tabbar a[href], #fe-tabbar #fe-tabs-end .btn')) pages(false);
  }, true);
  swipeToClose('#fe-side', () => drawer(false));
  swipeToClose('#fe-tabbar', () => pages(false));
  // A menu sheet closes the way Esc closes any menu.
  swipeToClose(SHEETS, () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
});

export {};
