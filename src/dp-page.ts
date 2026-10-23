// A decision page: a folder whose config.json lists decisions or sections
// shows as the page an agent asked the owner to answer, in bfb's own shell,
// instead of as a file listing. A Files button switches to the listing and
// back, remembered for this tab. gcc owns the answer itself; this module
// only draws the page (docs: ~/.claude/features/decision-pages.md).
import type { App } from './app';
import { esc } from './utils';
import { renderMarkdown } from './renderers';
import { fetchFileText } from './file-fetch';
import { textPref } from './storage';

export interface DpOption { code: string; label: string; rec?: boolean; why?: string; images?: string[] }
export interface DpDecision { id: string; question: string; context?: string; note?: string; group?: string; images?: string[]; none?: boolean; noneLabel?: string; noneCode?: string; options: DpOption[] }
export interface DpSection { id: string; group?: string; title?: string; prio?: string; read?: string; pre?: string; images?: string[]; note?: string; slots?: Record<string, string> }
export interface DpOrigin { session?: string; project?: string; topic?: string; created?: string; board?: string; card?: string; goal?: string; milestone?: string }
export interface DpConfig {
  title?: string; storageKey?: string; copyHeader?: string; intro?: string; notes?: boolean; accent?: string;
  origin?: DpOrigin; groups?: Record<string, { context?: string; color?: string }>;
  decisions?: DpDecision[]; sections?: DpSection[];
}

/** The config when the text is a decision page's, or null for any other config.json. */
export function parseDpConfig(text: string): DpConfig | null {
  let c: unknown;
  try { c = JSON.parse(text); } catch { return null; }
  if (!c || typeof c !== 'object') return null;
  const cfg = c as DpConfig;
  return Array.isArray(cfg.decisions) || Array.isArray(cfg.sections) ? cfg : null;
}

/** The origin facts worth a chip, in reading order. */
export function originChips(o: DpOrigin | undefined): { label: string; value: string }[] {
  if (!o) return [];
  const rows: [string, string | undefined][] = [['Topic', o.topic], ['Project', o.project], ['Session', o.session], ['Goal', o.goal], ['Milestone', o.milestone], ['Card', o.card], ['Asked', o.created]];
  return rows.filter((r): r is [string, string] => !!r[1]).map(([label, value]) => ({ label, value }));
}

function headHtml(cfg: DpConfig, base: string): string {
  const d = cfg.decisions?.length ?? 0, s = cfg.sections?.length ?? 0;
  const count = [d ? `${d} decision${d === 1 ? '' : 's'}` : '', s ? `${s} item${s === 1 ? '' : 's'} to review` : ''].filter(Boolean).join(' · ');
  return `<header class="fe-dp-head">
      <div class="fe-dp-titlebar">
        <h1 class="fe-dp-title">${esc(cfg.title || 'Decisions')}</h1>
        <button type="button" id="fe-dp-files" class="btn" data-variant="outline" title="Show the files in this folder">Files</button>
      </div>
      ${originChips(cfg.origin).length ? `<div class="fe-dp-origin">${originChips(cfg.origin).map(c => `<span class="chip" title="${esc(c.label)}"><b>${esc(c.label)}</b>${esc(c.value)}</span>`).join('')}</div>` : ''}
      ${cfg.intro ? `<div class="fe-dp-intro">${renderMarkdown(cfg.intro, base)}</div>` : ''}
      <p class="fe-dp-count">${esc(count)}</p>
    </header>`;
}

/**
 * Show this folder as a decision page when its config.json is one. Until the
 * config is read the listing stays out of sight, so a decision page never
 * flashes its file list first; any other folder gets the listing back at once.
 */
export async function mountDecisionPage(app: App): Promise<DpConfig | null> {
  const fe = app.fe;
  const box = document.getElementById('fe-dp');
  if (app.fileMode || !box || !app.entryNames.includes('config.json')) return null;
  fe.classList.add('fe-dp-pending');
  const base = 'file://' + app.rawPath.split('/').map(encodeURIComponent).join('/');
  let cfg: DpConfig | null = null;
  try { cfg = parseDpConfig(await fetchFileText(base + 'config.json')); } catch { cfg = null; }
  fe.classList.remove('fe-dp-pending');
  if (!cfg) return null;

  const filesPref = textPref('bfb-dp-files:' + app.rawPath, '', 'tab');
  box.innerHTML = headHtml(cfg, base) + `<div id="fe-dp-body"></div>`;
  // Back from the listing: one button at the end of the listing's toolbar.
  const back = document.createElement('button');
  back.type = 'button'; back.id = 'fe-dp-back'; back.className = 'btn'; back.dataset.variant = 'outline';
  back.title = 'Show this folder as its decision page'; back.textContent = 'Decision page';
  document.getElementById('fe-toolbar')?.append(back);
  const show = (page: boolean) => {
    fe.classList.toggle('fe-dp-page', page);
    box.hidden = !page;
    back.hidden = page;
    filesPref.set(page ? '' : '1');
  };
  document.getElementById('fe-dp-files')!.addEventListener('click', () => show(false));
  back.addEventListener('click', () => show(true));
  show(filesPref.get() !== '1');
  return cfg;
}
