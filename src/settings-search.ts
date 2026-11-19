// Settings search: a box at the top of the tab list. As you type, the settings
// that match from every tab are shown together, the words that matched are
// marked, and the tab list says how many matched under each tab and names
// them, so a click goes straight to one. Esc clears the box; Esc again closes
// Settings. The ideas are borrowed from VS Code's settings (results from
// every section, counts in the contents) and Chrome's (matches marked in place).
//
// The settings themselves are not copied: each tab's pane is moved into one
// results column while searching and put back after, so every control keeps
// working as it does on its own tab.

import { esc } from './utils';

const HL = 'bfb-settings-hit';
const words = (q: string) => q.toLowerCase().split(/\s+/).filter(Boolean);

/** Everything a person could search a setting by: what it says, and its controls' titles. */
function said(node: Element): string {
  const parts = [node.textContent ?? ''];
  node.querySelectorAll<HTMLElement>('[title],[aria-label],[placeholder]').forEach(e => {
    parts.push(e.getAttribute('title') ?? '', e.getAttribute('aria-label') ?? '', e.getAttribute('placeholder') ?? '');
  });
  return parts.join(' ').toLowerCase();
}

const hasAll = (hay: string, ws: string[]) => ws.every(w => hay.includes(w));

/** A short name for a matched setting, for the tab list. */
function nameOf(unit: Element, cardTitle: string): string {
  const l = unit.querySelector('.fe-set-l')?.textContent?.trim();
  return l || cardTitle;
}

export function initSettingsSearch(root: HTMLElement): void {
  const box = root.querySelector<HTMLElement>('.fe-dlg-box')!;
  const rail = root.querySelector<HTMLElement>('.fe-dlg-tabs')!;
  const panes = [...root.querySelectorAll<HTMLElement>('.fe-dlg-pane')];
  const tabs = [...rail.querySelectorAll<HTMLElement>('.fe-dlg-tab')];

  const wrap = document.createElement('label');
  wrap.className = 'fe-dlg-search';
  wrap.innerHTML = `<input type="search" id="fe-st-search" class="tb" data-size="lg" data-lead="search" placeholder="Search settings" spellcheck="false" autocomplete="off" title="Search every tab (⌘F)" aria-label="Search settings">`;
  // Above the tab list rather than in it, so the list holds only tabs.
  root.querySelector('.fe-dlg-title')!.append(wrap);
  const input = wrap.querySelector('input')!;

  const results = document.createElement('div');
  results.className = 'fe-dlg-pane fe-dlg-results';
  results.setAttribute('role', 'region');
  results.setAttribute('aria-label', 'Search results');
  box.append(results);

  let searching = false;

  function clearMarks(): void {
    root.querySelectorAll('.fe-sr-miss').forEach(e => e.classList.remove('fe-sr-miss'));
    root.querySelectorAll('.fe-dlg-hits').forEach(e => e.remove());
    tabs.forEach(t => { t.classList.remove('fe-sr-none'); t.querySelector('.fe-dlg-n')?.remove(); });
    CSS.highlights?.delete(HL);
  }

  function stop(): void {
    if (!searching) return;
    searching = false;
    clearMarks();
    // Every pane sat just before the results column, in tab order.
    for (const p of panes) box.insertBefore(p, results);
    results.replaceChildren();
    root.classList.remove('searching');
    input.removeAttribute('data-own-esc');
  }

  function start(): void {
    if (searching) return;
    searching = true;
    root.classList.add('searching');
    input.setAttribute('data-own-esc', '');
  }

  function run(): void {
    const ws = words(input.value);
    if (!ws.length) { stop(); return; }
    start();
    clearMarks();
    results.replaceChildren();
    const marked: Element[] = [];
    let total = 0;
    panes.forEach((pane, i) => {
      const tab = tabs[i];
      const tabSays = said(tab);
      const hits: { name: string; el: Element }[] = [];
      pane.querySelectorAll<HTMLElement>('.fe-set-group').forEach(group => {
        const title = group.querySelector('.fe-set-h')?.textContent?.trim() ?? '';
        const titleSays = title.toLowerCase();
        const units = [...group.querySelectorAll<HTMLElement>('.fe-set-card > *')];
        // A tab or card whose own name matches shows whole; otherwise only the rows that match.
        const whole = hasAll(tabSays + ' ' + titleSays, ws);
        let shown = 0;
        for (const u of units) {
          const ok = whole || hasAll(said(u) + ' ' + titleSays + ' ' + tabSays, ws);
          u.classList.toggle('fe-sr-miss', !ok);
          if (ok) { shown++; marked.push(u); if (!u.matches('.fe-set-note')) hits.push({ name: nameOf(u, title), el: u }); }
        }
        group.classList.toggle('fe-sr-miss', !shown);
        if (shown) marked.push(group.querySelector('.fe-set-h')!);
      });
      tab.classList.toggle('fe-sr-none', !hits.length);
      if (!hits.length) return;
      total += hits.length;
      results.append(pane);
      tab.querySelector('.fe-dlg-tab-main')?.insertAdjacentHTML('beforeend', `<em class="fe-dlg-n" aria-label="${hits.length} matching">${hits.length}</em>`);
      const list = document.createElement('div');
      list.className = 'fe-dlg-hits';
      list.dataset.tab = tab.dataset.tab;
      const seen = new Set<string>();
      const named = hits.filter(h => h.name && !seen.has(h.name) && seen.add(h.name));
      list.innerHTML = named.slice(0, 4).map((h, j) => `<button type="button" class="fe-dlg-hit" data-j="${j}" title="Go to ${esc(h.name)}">${esc(h.name)}</button>`).join('')
        + (named.length > 4 ? `<span class="fe-dlg-more">and ${named.length - 4} more</span>` : '');
      list.addEventListener('click', e => {
        const b = (e.target as HTMLElement).closest<HTMLElement>('.fe-dlg-hit');
        if (b) goTo(named[Number(b.dataset.j)].el);
      });
      tab.after(list);
      marked.push(tab, list);
    });
    if (!total) results.innerHTML = `<div class="fe-sr-empty"><b>No setting matches “${esc(input.value.trim())}”</b><span>Try a shorter word, or a different one</span></div>`;
    else results.scrollTop = 0;
    paintMarks(marked, ws);
  }

  // Marks the matched words with the CSS Custom Highlight API, so nothing in the settings is rewritten.
  function paintMarks(scopes: Element[], ws: string[]): void {
    if (!CSS.highlights || typeof Highlight === 'undefined') return;
    const ranges: Range[] = [];
    for (const scope of scopes) {
      const walk = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
        acceptNode: n => (n.parentElement?.closest('.fe-sr-miss, input, textarea, script, style, svg') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
      });
      for (let n = walk.nextNode() as Text | null; n; n = walk.nextNode() as Text | null) {
        const text = n.data.toLowerCase();
        for (const w of ws) {
          for (let at = text.indexOf(w); at >= 0; at = text.indexOf(w, at + w.length)) {
            const r = new Range();
            r.setStart(n, at); r.setEnd(n, at + w.length);
            ranges.push(r);
          }
        }
      }
    }
    CSS.highlights.set(HL, new Highlight(...ranges));
  }

  function goTo(el: Element): void {
    el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    el.classList.remove('fe-sr-flash');
    void (el as HTMLElement).offsetWidth;
    el.classList.add('fe-sr-flash');
    (el.querySelector<HTMLElement>('input, button, [tabindex="0"]'))?.focus({ preventScroll: true });
  }

  input.addEventListener('input', run);
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape' && input.value) { e.preventDefault(); e.stopPropagation(); input.value = ''; run(); }
    else if (e.key === 'Enter') { const first = rail.querySelector<HTMLElement>('.fe-dlg-hit'); if (first) { e.preventDefault(); first.click(); } }
  });
  // A tab picked while searching, by a click or by [ and ], ends the search and
  // opens that tab as usual. Search itself never changes which tab is open.
  tabs.forEach(t => t.addEventListener('click', () => { if (searching) { input.value = ''; stop(); } }, { capture: true }));
  const hasOn = (cls: string | null) => (cls ?? '').split(/\s+/).includes('on');
  new MutationObserver(ms => {
    if (searching && ms.some(m => (m.target as Element).matches('.fe-dlg-tab') && hasOn(m.oldValue) !== (m.target as Element).classList.contains('on'))) { input.value = ''; stop(); }
  }).observe(rail, { subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
  // ⌘F inside Settings goes to the box rather than the page's find.
  root.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); e.stopPropagation(); input.focus(); input.select(); }
  });
}

/** Clear the box when Settings closes, so it opens on its tabs next time. */
export function resetSettingsSearch(root: HTMLElement): void {
  const input = root.querySelector<HTMLInputElement>('#fe-st-search');
  if (input?.value) { input.value = ''; input.dispatchEvent(new Event('input')); }
}
