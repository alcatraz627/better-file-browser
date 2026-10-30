// The design-system page: every token and every shared part, drawn with the
// app's own stylesheet and controls, in either theme and any palette. It is the
// visual reference reviews compare against (docs/plan/component-system.md,
// 13.2 and section 17), and it grows as each slice adds parts.
import { CSS } from './styles';
import { UI_CSS } from './styles-ui';
import { segHtml, ddHtml, sliderHtml, chipsHtml, upgradeControls, type ValuedEl } from './controls';
import { UI_ICON } from './control-icons';
import { PALETTES } from './storage';
import { esc } from './utils';

const PAGE_CSS = `
html,body{height:auto;overflow:auto;margin:0;background:var(--bg)}
#fe{display:block;height:auto;min-height:100vh;color:var(--tx);font:var(--type-ui) -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.ds-wrap{max-width:1080px;margin:0 auto;padding:var(--sp-8) var(--sp-6) var(--sp-9)}
.ds-head{display:flex;align-items:center;gap:var(--sp-5);flex-wrap:wrap;margin-bottom:var(--sp-8)}
.ds-head h1{font-size:var(--type-title);font-weight:600;margin-right:auto}
.ds-sec{margin-bottom:var(--sp-9)}
.ds-sec > h2{font-size:var(--type-micro);font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--dm);margin-bottom:var(--sp-4)}
.ds-sec > p{color:var(--mt);margin-bottom:var(--sp-5);max-width:72ch}
.ds-card{background:var(--card);border:1px solid var(--bd);border-radius:var(--pop-r);padding:var(--sp-6)}
.ds-row{display:flex;align-items:center;gap:var(--sp-5);flex-wrap:wrap;padding:var(--sp-3) 0}
.ds-row + .ds-row{border-top:1px solid var(--bd)}
.ds-lbl{min-width:140px;color:var(--mt);font-size:var(--type-small)}
.ds-sw{display:grid;gap:var(--sp-2);justify-items:center;font-size:var(--type-micro);color:var(--mt)}
.ds-sw i{display:block;width:56px;height:36px;border-radius:var(--row-r);border:1px solid var(--bd)}
.ds-bar{height:var(--sp-5);background:var(--ac);border-radius:var(--r-xs)}
.ds-box{background:var(--s2);border:1px solid var(--bd2)}
.ds-tag{font-size:var(--type-micro);color:var(--dm)}
.ds-plan{color:var(--dm)}
`;

const swatch = (token: string) => `<span class="ds-sw"><i style="background:var(${token})"></i>${esc(token)}</span>`;
const row = (label: string, body: string) => `<div class="ds-row"><span class="ds-lbl">${esc(label)}</span>${body}</div>`;
const sec = (title: string, intro: string, body: string) => `<section class="ds-sec"><h2>${esc(title)}</h2>${intro ? `<p>${esc(intro)}</p>` : ''}<div class="ds-card">${body}</div></section>`;

const SPACE = ['--sp-1', '--sp-2', '--sp-3', '--sp-4', '--sp-5', '--sp-6', '--sp-7', '--sp-8', '--sp-9'];
const CTL = ['--ctl-xs', '--ctl-sm', '--ctl-md', '--ctl-lg', '--row-h', '--bar-h'];
const RADII = ['--r-xs', '--r-sm', '--row-r', '--pop-r', '--r-full'];
const TYPE = ['--type-micro', '--type-small', '--type-ui', '--type-ui-strong', '--type-title'];
const LEVELS = ['--z-sticky', '--z-panel', '--z-popover', '--z-overlay', '--z-command', '--z-toast', '--z-tip'];

function render(): string {
  const btns = (attrs: string) => ['', 'shade', 'outline', 'solid'].map(v =>
    `<button class="btn" ${attrs} ${v ? `data-variant="${v}"` : ''} title="${v || 'plain'}">${UI_ICON.copy}${v || 'Plain'}</button>`).join('');
  const iconBtns = ['', 'shade', 'outline', 'solid'].map(v =>
    `<button class="btn" data-icon ${v ? `data-variant="${v}"` : ''} title="${v || 'plain'} icon button" aria-label="${v || 'plain'}">${UI_ICON.copy}</button>`).join('');
  return `
<div class="ds-wrap">
  <div class="ds-head">
    <h1>Better File Browser design system</h1>
    ${segHtml('ds-theme', [{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }], 'Theme')}
    ${ddHtml('ds-palette', PALETTES.map(p => ({ value: p, label: p[0].toUpperCase() + p.slice(1) })), 'Palette')}
  </div>
  ${sec('Colour', 'Surfaces step one layer at a time; text has three weights; states and tones are mixed from these.', [
    row('Surfaces', ['--bg', '--s1', '--s2', '--s3', '--card', '--side'].map(swatch).join('')),
    row('Text', ['--tx', '--mt', '--dm'].map(swatch).join('')),
    row('Lines and accent', ['--bd', '--bd2', '--ac', '--on', '--hover', '--shade'].map(swatch).join('')),
    row('Tones', ['--tone-ok', '--tone-warn', '--tone-danger', '--tone-info'].map(swatch).join('')),
  ].join(''))}
  ${sec('Type', 'Five roles; every text in the app maps to one.', TYPE.map(t =>
    row(t, `<span style="font-size:var(${t})${t === '--type-ui-strong' || t === '--type-title' ? ';font-weight:600' : ''}">Read the folder, open the file</span>`)).join(''))}
  ${sec('Space', 'Every gap and padding is one of these steps.', SPACE.map(t =>
    row(t, `<span class="ds-bar" style="width:var(${t})"></span>`)).join(''))}
  ${sec('Sizes and shape', 'Control heights, row and bar heights, and the corner radii.', [
    ...CTL.map(t => row(t, `<span class="ds-box" style="display:inline-block;width:120px;height:var(${t});border-radius:var(--row-r)"></span>`)),
    ...RADII.map(t => row(t, `<span class="ds-box" style="display:inline-block;width:64px;height:40px;border-radius:var(${t})"></span>`)),
  ].join(''))}
  ${sec('Layer levels', 'Each floating archetype has a base level; a layer opened from another sits one step above it.', LEVELS.map(t =>
    row(t, `<span class="ds-tag">${esc(getComputedStyle(document.documentElement).getPropertyValue(t).trim() || '?')}</span>`)).join(''))}
  ${sec('Buttons (today)', 'The shared button. Slice 3 makes it the only button.', [
    row('Text, md', btns('')),
    row('Text, sm', btns('data-size="sm"')),
    row('Icon', iconBtns),
    row('States', `<button class="btn on" title="on">${UI_ICON.check}On</button><button class="btn" disabled title="disabled">${UI_ICON.check}Disabled</button>`),
  ].join(''))}
  ${sec('Controls (today)', 'The Settings controls the filter bar and sort panel already use.', [
    row('Segmented', segHtml('ds-seg', [{ value: 'a', label: 'Name' }, { value: 'b', label: 'Size' }, { value: 'c', label: 'Modified' }], 'Segmented')),
    row('Segmented, icons', segHtml('ds-seg-i', [{ value: 'a', icon: UI_ICON.list, hint: 'List' }, { value: 'b', icon: UI_ICON.table, hint: 'Table' }, { value: 'c', icon: UI_ICON.image, hint: 'Images' }], 'Segmented with icons')),
    row('Dropdown', ddHtml('ds-dd', [{ value: 'a', label: 'As listed', icon: UI_ICON.list }, { value: 'b', label: 'Name', icon: UI_ICON.file }, { value: 'c', label: 'Modified', icon: UI_ICON.clock }], 'Dropdown')),
    row('Slider', sliderHtml('ds-sld', [1, 2, 3, 4, 5], '', 'Detail', ['Overview', 'Large', 'Standard', 'Detailed', 'Full detail'])),
    row('Chips', chipsHtml('ds-chips', 'Add a tag', 'Chips')),
    row('Text box', `<label class="fe-in-box" style="width:260px"><input class="tb" type="text" placeholder="Pattern" title="Text box"><span class="fe-in-chips"><button type="button" class="btn fe-in-chip active" data-size="sm" data-variant="outline" data-mono title="Regex">.*</button></span></label>`),
  ].join(''))}
  ${sec('Planned parts', 'Built slice by slice (component-system.md, section 14); each appears here when it lands.', [
    row('Slice 1', '<span class="ds-plan">Layer, Menu, HoverCard, rich tooltip, RovingFocus, FocusTrap</span>'),
    row('Slice 2', '<span class="ds-plan">Actions, key scopes, palette tabs</span>'),
    row('Slice 3', '<span class="ds-plan">Icon, Button, IconButton, Toggle, Busy</span>'),
    row('Slice 4', '<span class="ds-plan">TextBox, Dropdown, Check, Switch, Chip, Badge</span>'),
    row('Slices 5 to 8', '<span class="ds-plan">Toolbar, SectionTitle, Notice, Panel, Dialog, ListRow, EmptyState, services</span>'),
  ].join(''))}
</div>`;
}

const style = document.createElement('style');
style.textContent = CSS + UI_CSS + PAGE_CSS;
document.head.appendChild(style);
const fe = document.createElement('div');
fe.id = 'fe';
fe.dataset.theme = 'dark';
fe.dataset.palette = 'slate';
document.body.appendChild(fe);
fe.innerHTML = render();
upgradeControls(fe);
const theme = document.getElementById('ds-theme') as ValuedEl, palette = document.getElementById('ds-palette') as ValuedEl;
theme.value = 'dark'; palette.value = 'slate';
(document.getElementById('ds-dd') as ValuedEl).value = 'a';
(document.getElementById('ds-seg') as ValuedEl).value = 'a';
(document.getElementById('ds-seg-i') as ValuedEl).value = 'b';
(document.getElementById('ds-sld') as ValuedEl).value = '3';
// The page reads its starting theme and palette from the query, so a screenshot can ask for one.
const [hTheme, hPalette] = location.search.slice(1).split(',');
if (hTheme === 'light') { theme.value = 'light'; fe.dataset.theme = 'light'; }
if (hPalette && PALETTES.includes(hPalette)) { palette.value = hPalette; fe.dataset.palette = hPalette; }
theme.addEventListener('change', () => { fe.dataset.theme = theme.value; });
palette.addEventListener('change', () => { fe.dataset.palette = palette.value; });
