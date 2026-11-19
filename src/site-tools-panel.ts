// The page panel: Lights' mode for this site and the list of this page's marks,
// opened from the right-click menu or Alt+Shift+K.

import { LIGHTS_MODES, lightsState, onLightsChange, setLightsMode, type LightsMode } from './site-lights';
import { MODE_LABEL, MODE_TIP } from './site-lights-settings';
import { allPages, deleteMark, isFound, marksMarkdown, onMarksChange, pageMarks, reveal, startPinDrop, commentOnSelection } from './site-marks';
import { ICON, esc, hint, overlay, syncTheme, when } from './site-tools-overlay';

let panel: HTMLElement | null = null;
let showAll = false;
let unsub: (() => void)[] = [];

export const panelOpen = () => !!panel;

export function togglePanel() {
  if (panel) closePanel(); else openPanel();
}

function closePanel() {
  panel?.remove();
  panel = null;
  for (const u of unsub) u();
  unsub = [];
  removeEventListener('keydown', onKey, true);
}

function onKey(e: KeyboardEvent) {
  if (e.key !== 'Escape' || !panel) return;
  if (panel.ownerDocument && overlay().querySelector('.card, .veil')) return;
  e.stopPropagation();
  closePanel();
}

function openPanel() {
  panel = document.createElement('aside');
  panel.className = 'panel';
  panel.setAttribute('aria-label', 'bfb page tools');
  overlay().append(panel);
  unsub.push(onLightsChange(() => { syncTheme(); render(); }), onMarksChange(render));
  addEventListener('keydown', onKey, true);
  panel.addEventListener('keydown', e => e.stopPropagation());
  panel.addEventListener('click', onClick);
  void render();
}

async function render() {
  if (!panel) return;
  const s = lightsState();
  const marks = pageMarks();
  const seg = LIGHTS_MODES.map(m => `<button data-mode="${m}" aria-pressed="${s.mode === m}" title="${MODE_TIP[m]}">${MODE_LABEL[m]}</button>`).join('');
  const applied = s.mode === 'auto' && s.applied !== 'off' ? ` Using ${MODE_LABEL[s.applied]}.` : '';
  const rows = marks.map(m => `<li data-id="${m.id}">${m.kind === 'pin' ? ICON.pin : ICON.comment}
      <div class="text">${m.quote ? `<div class="q">“${esc(m.quote.exact.slice(0, 120))}”</div>` : ''}
      <div class="n">${m.note ? esc(m.note) : `<i>${m.kind === 'pin' ? 'Pin' : 'Comment'} with no note</i>`}</div>
      ${isFound(m) ? '' : '<div class="lost">Those words are not on the page now</div>'}</div>
      <button class="icon-btn danger" data-del="${m.id}" title="Delete" aria-label="Delete">${ICON.trash}</button></li>`).join('');
  let pages = '';
  if (showAll) {
    const list = await allPages();
    pages = list.length
      ? `<ul class="list">${list.map(p => `<li><a href="${esc(p.key)}" target="_blank" rel="noopener" class="text"><div class="n">${esc(p.title)}</div><div class="q">${p.count} mark${p.count === 1 ? '' : 's'} · ${when(p.updated)} · ${esc(new URL(p.key).hostname)}</div></a></li>`).join('')}</ul>`
      : '<p class="empty">No marks on any page yet.</p>';
  }
  if (!panel) return;
  panel.innerHTML = `
    <header><h2 title="${esc(location.hostname)}">${esc(location.hostname)}</h2>
      <button class="icon-btn" data-act="settings" title="All dark mode and marks settings" aria-label="Settings">${ICON.gear}</button>
      <button class="icon-btn" data-act="close" title="Close (Esc)" aria-label="Close">${ICON.close}</button></header>
    <section>
      <h3>${ICON.moon}Dark mode</h3>
      <div class="seg" role="group" aria-label="Dark mode for this site">${seg}</div>
      <p class="note">${esc(s.note || (s.mode === 'off' ? 'This site shows as it is.' : ''))}${applied}</p>
      <div class="actions" style="margin-top:8px">
        <button class="btn" data-act="default" title="Sites you have not set yourself will use ${MODE_LABEL[s.mode]}" ${s.fromDefault ? 'disabled' : ''}>${ICON.globe}Use on every site</button>
      </div>
      ${s.fromDefault ? `<p class="note">${s.mode === 'off' ? 'Off' : MODE_LABEL[s.mode]} is the default for sites you have not set.</p>` : ''}
    </section>
    <div class="scroll">
      <section>
        <h3>${ICON.comment}Marks on this page</h3>
        <div class="actions">
          <button class="btn" data-act="pin" title="Drop a pin, then write a note (Alt+Shift+M)">${ICON.pin}Pin</button>
          <button class="btn" data-act="comment" title="Comment on the selected words (Alt+Shift+M)">${ICON.comment}Comment</button>
          <button class="btn" data-act="copy" title="Copy this page's marks as Markdown" ${marks.length ? '' : 'disabled'}>${ICON.copy}Copy</button>
        </div>
        ${marks.length ? `<ul class="list">${rows}</ul>` : '<p class="empty">Select words and press Comment, or drop a Pin anywhere.</p>'}
      </section>
      <section>
        <h3>${ICON.globe}All pages</h3>
        <button class="btn" data-act="all" aria-expanded="${showAll}">${showAll ? 'Hide' : 'Show'} pages with marks</button>
        ${pages}
      </section>
    </div>`;
}

// The selection is read on pointerdown, before the click moves focus and clears it.
let heldSelection: Range | null = null;
addEventListener('pointerdown', () => {
  const sel = getSelection();
  heldSelection = sel && !sel.isCollapsed && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
}, true);

async function onClick(e: Event) {
  const t = e.target as HTMLElement;
  const btn = t.closest<HTMLElement>('button, input, li');
  if (!btn) return;
  if (btn.dataset.mode) { await setLightsMode(btn.dataset.mode as LightsMode, 'site'); return; }
  if (btn.dataset.del) {
    e.stopPropagation();
    const m = pageMarks().find(x => x.id === btn.dataset.del);
    if (m) deleteMark(m);
    return;
  }
  switch (btn.dataset.act) {
    case 'close': closePanel(); return;
    case 'settings': void chrome.runtime.sendMessage({ type: 'bfb-open-settings', tab: 'web' }); return;
    case 'default': await setLightsMode(lightsState().mode, 'default'); return;
    case 'pin': startPinDrop(); return;
    case 'comment':
      if (heldSelection) { const sel = getSelection()!; sel.removeAllRanges(); sel.addRange(heldSelection); }
      commentOnSelection();
      return;
    case 'copy':
      await navigator.clipboard.writeText(marksMarkdown()).then(() => hint('Copied as Markdown'), () => hint('Could not copy'));
      return;
    case 'all': showAll = !showAll; void render(); return;
  }
  if (btn.tagName === 'LI' && btn.dataset.id) {
    const m = pageMarks().find(x => x.id === btn.dataset.id);
    if (m) reveal(m);
  }
}
