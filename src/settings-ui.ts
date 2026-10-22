// The Settings and Help dialogs: filling the controls from the live
// settings, saving every change as it happens, the icon-rule editor, and the
// AI status.
import type { App } from './app';
import type { LlmAvailability } from './llm';
import type { IconRule, SortConfig, GroupMode } from './types';
import { el, els } from './el';
import { esc } from './utils';
import { kvGet, kvKeys, kvSet } from './kv';
import { icoCustom, RULE_GLYPHS } from './icons';
import { VIEW_KEY, PALETTE_KEY, TERMINAL_CMDS, DEFAULT_ICON_RULES, DEFAULT_SETTINGS, getView, saveIconRules, saveSettings, getPreviewLayout, savePreviewLayout, getSortConfig, getGroupMode } from './storage';
import { llmAvailability, llmWarm, llmModels } from './llm';
import { mountDialog } from './dialog';
import { wireKeyboardMap } from './help';
import { COLUMN_KEY, parseExcludedExtensions, savedColumnMode } from './file-page';
import { UI_ICON } from './control-icons';
import { setSidebarShown } from './motion';
import { setUiScale } from './chrome';
import { upgradeControls, type ValuedEl, type DropdownEl } from './controls';
import { setThemeMode, setAppIcon, appIconUrl, APP_ICON_KEY, type ThemeMode } from './theme';

// Ready-made rules offered above the list; each appears until it is added.
const RULE_SUGGESTIONS: (Omit<IconRule, 'id' | 'enabled'> & { name: string })[] = [
  { name: 'Images', pattern: '\\.(png|jpe?g|gif|webp|svg|avif|heic)$', label: 'IMG', glyph: 'image', color: '#b197fc' },
  { name: 'Archives', pattern: '\\.(zip|tar|gz|tgz|rar|7z|xz)$', label: 'ZIP', glyph: 'archive', color: '#a1887f' },
  { name: 'Env files', pattern: '^\\.env', label: 'ENV', glyph: 'key', color: '#e8b923' },
  { name: 'Lockfiles', pattern: '(\\.lock|-lock\\.json|lockfile)$', label: 'LCK', glyph: 'lock', color: '#8b949e' },
  { name: 'Tests', pattern: '(\\.test|\\.spec|_test)\\.', label: 'TST', glyph: 'test', color: '#40c057' },
  { name: 'Docker', pattern: '^(dockerfile|docker-compose|compose\\.ya?ml)', label: 'DKR', glyph: 'box', color: '#4dabf7' },
  { name: 'Config', pattern: '(\\.config\\.[a-z]+|rc|\\.toml|\\.ini)$', label: 'CFG', glyph: 'gear', color: '#868e96' },
  { name: 'Data', pattern: '\\.(db|sqlite3?|sql|parquet)$', label: 'DB', glyph: 'db', color: '#ffa94d' },
  { name: 'Media', pattern: '\\.(mp4|mov|mkv|webm|mp3|wav|flac)$', label: 'MED', glyph: 'video', color: '#ff6b6b' },
  { name: 'Git', pattern: '^\\.git(ignore|attributes|modules)?$', label: 'GIT', glyph: 'branch', color: '#f05133' },
  { name: 'Readme', pattern: '^readme', label: 'RDM', glyph: 'book', color: '#4a9eff' },
  { name: 'Claude', pattern: '(^claude\\.md$|\\.claude$)', label: 'Cld', glyph: 'sparkle', color: '#d97757' },
];
const SWATCHES = ['#ff6b6b', '#f783ac', '#d97757', '#ffa94d', '#e8b923', '#94d82d', '#40c057', '#38d9a9',
  '#3bc9db', '#4dabf7', '#4a9eff', '#748ffc', '#b197fc', '#da77f2', '#a1887f', '#8b949e'];

export function initSettingsUi(app: App): void {
  const { fe, settings, toast } = app;
  const v = <T extends HTMLElement = ValuedEl>(id: string) => el(id) as unknown as T;
  upgradeControls(el('fe-settings-modal'));

  // Icon rules.
  const badRegex = (p: string) => { try { new RegExp(p, 'i'); return ''; } catch (e) { return String((e as Error).message); } };
  const hits = (p: string) => { try { const r = new RegExp(p, 'i'); return app.entryNames.filter(n => r.test(n)).length; } catch { return 0; } };
  function renderRulesList(): void {
    const list = el('fe-st-rules-list');
    list.innerHTML = app.iconRules.length ? app.iconRules.map((rule, i) => {
      const bad = badRegex(rule.pattern);
      return `<div class="fe-rule${rule.enabled ? '' : ' off'}" data-idx="${i}">
        <input type="checkbox" class="fe-switch sm fe-st-rule-en" title="${rule.enabled ? 'On' : 'Off'}"${rule.enabled ? ' checked' : ''}>
        <button type="button" class="fe-rule-ico" title="Icon and colour">${icoCustom(rule.label, rule.color, rule.glyph)}</button>
        <input type="text" class="fe-st-rule-pattern${bad ? ' bad' : ''}" value="${esc(rule.pattern)}" placeholder="name pattern, e.g. \\.md$" spellcheck="false" title="${bad ? esc(bad) : 'Matches file names, any case'}">
        <span class="fe-rule-n" title="Matches in this folder">${bad ? '!' : hits(rule.pattern)}</span>
        <button type="button" class="fe-ibtn fe-st-rule-del" title="Delete rule" aria-label="Delete rule">${UI_ICON.trash}</button>
      </div>`;
    }).join('') : '<p class="fe-set-note">No rules. Add one, or pick a suggestion.</p>';
    const have = new Set(app.iconRules.map(r => r.pattern));
    const left = RULE_SUGGESTIONS.filter(s => !have.has(s.pattern));
    el('fe-st-rule-sugg').innerHTML = left.length ? `<span class="fe-rule-sugg-l">Add</span>` + left.map(s =>
      `<button type="button" class="fe-chip fe-rule-add" data-name="${esc(s.name)}" title="${esc(s.pattern)}">${icoCustom(s.label, s.color, s.glyph)}${esc(s.name)}</button>`).join('') : '';
  }
  const saveRules = () => { saveIconRules(app.iconRules); app.applyAll(); };
  const rulesList = el('fe-st-rules-list');
  const ruleAt = (e: Event): [HTMLElement, number] | null => {
    const row = (e.target as HTMLElement).closest<HTMLElement>('.fe-rule');
    if (!row) return null;
    const idx = parseInt(row.dataset.idx!);
    return isNaN(idx) || idx >= app.iconRules.length ? null : [row, idx];
  };
  rulesList.addEventListener('change', e => {
    const hit = ruleAt(e); if (!hit) return;
    const t = e.target as HTMLInputElement;
    if (t.classList.contains('fe-st-rule-en')) { app.iconRules[hit[1]].enabled = t.checked; hit[0].classList.toggle('off', !t.checked); saveRules(); }
  });
  rulesList.addEventListener('input', e => {
    const hit = ruleAt(e); if (!hit) return;
    const t = e.target as HTMLInputElement;
    if (!t.classList.contains('fe-st-rule-pattern')) return;
    app.iconRules[hit[1]].pattern = t.value;
    const bad = badRegex(t.value);
    t.classList.toggle('bad', !!bad);
    t.title = bad || 'Matches file names, any case';
    hit[0].querySelector('.fe-rule-n')!.textContent = bad ? '!' : String(hits(t.value));
    if (!bad) saveRules();
  });
  rulesList.addEventListener('click', e => {
    const hit = ruleAt(e); if (!hit) return;
    const t = e.target as HTMLElement;
    if (t.closest('.fe-st-rule-del')) { app.iconRules.splice(hit[1], 1); saveRules(); renderRulesList(); }
    else if (t.closest('.fe-rule-ico')) openRulePop(hit[1], t.closest<HTMLElement>('.fe-rule-ico')!);
  });
  el('fe-st-rule-sugg').addEventListener('click', e => {
    const b = (e.target as Element).closest<HTMLElement>('.fe-rule-add');
    const s = b && RULE_SUGGESTIONS.find(x => x.name === b.dataset.name);
    if (!s) return;
    app.iconRules.push({ id: 'r' + Date.now(), pattern: s.pattern, label: s.label, color: s.color, glyph: s.glyph, enabled: true });
    saveRules(); renderRulesList();
  });
  el('fe-st-add-rule').addEventListener('click', () => {
    app.iconRules.push({ id: 'r' + Date.now(), pattern: '', label: 'NEW', color: '#4a9eff', enabled: true });
    saveIconRules(app.iconRules);
    renderRulesList();
    els<HTMLInputElement>('.fe-st-rule-pattern', rulesList).pop()?.focus();
  });
  el('fe-st-reset-rules').addEventListener('click', () => {
    app.iconRules = DEFAULT_ICON_RULES.map(r => ({ ...r }));
    saveRules(); renderRulesList();
    toast('Icon rules reset');
  });

  // The icon designer: a short text badge or a picture, and a colour.
  let pop: HTMLElement | null = null;
  const closePop = () => { pop?.remove(); pop = null; };
  function openRulePop(idx: number, anchor: HTMLElement): void {
    closePop();
    const rule = app.iconRules[idx];
    const box = document.createElement('div');
    pop = box;
    box.className = 'fe-rule-pop';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Icon and colour');
    const paint = () => {
      box.innerHTML = `
        <div class="fe-rp-sec"><span class="fe-rp-l">Picture</span>
          <div class="fe-rp-glyphs">
            <button type="button" class="fe-rp-g${rule.glyph ? '' : ' on'}" data-g="" title="Text badge">${icoCustom(rule.label, rule.color)}</button>
            ${Object.keys(RULE_GLYPHS).map(g => `<button type="button" class="fe-rp-g${rule.glyph === g ? ' on' : ''}" data-g="${g}" title="${g}">${icoCustom('', rule.color, g)}</button>`).join('')}
          </div></div>
        <div class="fe-rp-sec"><span class="fe-rp-l">Text</span><input class="fe-st-input fe-rp-label" maxlength="4" value="${esc(rule.label)}" spellcheck="false" title="Up to 4 characters, shown when there is no picture"></div>
        <div class="fe-rp-sec"><span class="fe-rp-l">Colour</span>
          <div class="fe-rp-sw">${SWATCHES.map(c => `<button type="button" class="fe-rp-c${c === rule.color ? ' on' : ''}" data-c="${c}" style="--c:${c}" title="${c}" aria-label="${c}"></button>`).join('')}
          <input class="fe-st-input fe-rp-hex" value="${esc(rule.color)}" maxlength="7" spellcheck="false" title="Any hex colour"></div></div>`;
    };
    paint();
    const apply = () => {
      saveRules();
      const ico = rulesList.querySelector(`.fe-rule[data-idx="${idx}"] .fe-rule-ico`);
      if (ico) ico.innerHTML = icoCustom(rule.label, rule.color, rule.glyph);
    };
    box.addEventListener('click', e => {
      const t = e.target as HTMLElement;
      const g = t.closest<HTMLElement>('.fe-rp-g'), c = t.closest<HTMLElement>('.fe-rp-c');
      if (g) rule.glyph = g.dataset.g || undefined;
      else if (c) rule.color = c.dataset.c!;
      else return;
      apply(); paint();
      box.querySelector<HTMLElement>(g ? `.fe-rp-g[data-g="${g.dataset.g}"]` : `.fe-rp-c[data-c="${c!.dataset.c}"]`)?.focus();
    });
    box.addEventListener('input', e => {
      const t = e.target as HTMLInputElement;
      if (t.classList.contains('fe-rp-label')) { rule.label = t.value; apply(); }
      if (t.classList.contains('fe-rp-hex') && /^#[0-9a-f]{6}$/i.test(t.value)) { rule.color = t.value; apply(); }
    });
    box.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePop(); anchor.focus(); } });
    fe.appendChild(box);
    const r = anchor.getBoundingClientRect();
    box.style.left = `${Math.max(8, Math.min(r.left, innerWidth - box.offsetWidth - 8))}px`;
    box.style.top = `${r.bottom + box.offsetHeight + 8 > innerHeight ? Math.max(8, r.top - box.offsetHeight - 6) : r.bottom + 6}px`;
    box.querySelector<HTMLElement>('.fe-rp-g.on')?.focus();
  }
  document.addEventListener('mousedown', e => {
    if (pop && !pop.contains(e.target as Node) && !(e.target as Element).closest?.('.fe-rule-ico')) closePop();
  }, true);

  // AI.
  const aiModel = v<DropdownEl>('fe-st-ai-model');
  const warm = el<HTMLInputElement>('fe-st-ai-warm');
  function refreshAi(): void {
    const head = document.querySelector<HTMLElement>('#fe-st-ai-card .fe-st-ai-head')!;
    const state = document.querySelector<HTMLElement>('.fe-st-ai-state')!;
    const sub = el('fe-st-ai-sub'), grid = el('fe-st-ai-grid'), hint = el('fe-st-ai-hint');
    head.className = 'fe-st-ai-head';
    state.textContent = 'Checking…';
    sub.textContent = ''; grid.innerHTML = ''; hint.innerHTML = '';
    warm.disabled = true;
    const kv = (k: string, val: string) => `<span class="k">${esc(k)}</span><span class="v">${esc(val)}</span>`;
    llmAvailability().then((av: LlmAvailability) => {
      if (av.kind === 'unavailable') {
        head.classList.add('off');
        state.textContent = 'Not set up';
        sub.textContent = 'Ask and the AI bar stay hidden';
        hint.innerHTML = `Run <code>native/install.sh &lt;extension-id&gt;</code>, then reload. <span class="fe-dm">(${esc(av.reason)})</span>`;
        aiModel.setOptions([]);
        return;
      }
      const s = av.status;
      head.classList.add(av.kind === 'down' ? 'down' : (av.cold ? 'cold' : 'ready'));
      state.textContent = av.kind === 'down' ? 'Server down' : av.cold ? 'Ready, cold' : 'Ready';
      sub.textContent = av.kind === 'down' ? 'Start Ollama, then check again' : `${settings.aiModel || s.default_model} · ${av.cold ? 'first reply loads it' : 'replies at once'}`;
      grid.innerHTML = kv('Server', `${s.server}${s.host ? ' · ' + s.host : ''}`) + (s.toolkit_version ? kv('Toolkit', `lm ${s.toolkit_version}`) : '');
      const resident = new Set(s.resident_models ?? []);
      aiModel.setOptions((s.available_models ?? []).map(m => ({ value: m, label: m, icon: UI_ICON.bot,
        hint: [m === s.default_model ? 'default' : '', resident.has(m) ? 'loaded' : ''].filter(Boolean).join(' · ') })));
      aiModel.value = settings.aiModel || s.default_model;
      warm.checked = !!s.warm;
      warm.disabled = av.kind !== 'ready';
    });
    const models = el('fe-st-ai-models');
    llmModels().then(({ tiers, gemini }) => {
      const rowHtml = (icon: string, name: string, model: string, where: string, star = false) =>
        `<div class="fe-ai-m">${icon}<b>${esc(name)}</b><span class="fe-ai-m-id">${esc(model)}</span>${star ? '<span class="fe-ai-def">default</span>' : ''}<span class="fe-ai-where${where === 'Google' ? ' cloud' : ''}">${where}</span></div>`;
      models.innerHTML = tiers.length || gemini.length
        ? tiers.map(t => rowHtml(UI_ICON.bot, t.alias, t.model, 'This Mac')).join('')
          + gemini.map(g => rowHtml(UI_ICON.ai, g.name.replace(/^gemini-/, 'Gemini '), g.name, 'Google', g.default)).join('')
          + `<p class="fe-set-note">Google models send the question and the file to Google.</p>`
        : '<p class="fe-set-note">No model list from lm.</p>';
    });
  }
  el('fe-st-ai-refresh').addEventListener('click', refreshAi);
  aiModel.addEventListener('change', () => { settings.aiModel = aiModel.value || undefined; saveSettings(settings); });
  warm.addEventListener('change', () => {
    warm.disabled = true;
    llmWarm(warm.checked).then(r => { if (!r.ok) toast(r.message ? `Warm failed: ${r.message}` : 'Warm failed'); refreshAi(); });
  });

  // Open.
  function updateTermHint(): void {
    const term = settings.terminalApp || 'ghostty';
    const cmd = term === 'custom' ? (settings.terminalCmd || '') : (TERMINAL_CMDS[term] || '');
    el('fe-st-term-hint').textContent = cmd ? cmd.replace(/\$\{p\}/g, app.folderPath) : '';
  }
  const settingsDlg = mountDialog('fe-settings-modal', { onClose: closePop });
  function openSettings(tab?: string): void {
    els<HTMLInputElement>('input[name="bfb-theme"]').forEach(r => { r.checked = r.value === (fe.dataset.mode || 'dark'); });
    els<HTMLInputElement>('input[name="bfb-palette"]').forEach(r => { r.checked = r.value === (fe.dataset.palette || 'slate'); });
    const icon = kvGet(APP_ICON_KEY) ?? 'classic';
    els<HTMLInputElement>('input[name="bfb-appicon"]').forEach(r => {
      r.checked = r.value === icon;
      const img = r.nextElementSibling as HTMLImageElement;
      if (!img.getAttribute('src')) img.src = appIconUrl(r.value);
    });
    v('fe-st-uiscale').value = String(settings.uiScale || 100);
    v('fe-st-rd-size').value = String(settings.readerSize || 15);
    v('fe-st-density').value = settings.compactMode ? 'compact' : 'roomy';
    el<HTMLInputElement>('fe-st-tooltips').checked = settings.tooltips !== false;
    v('fe-st-defview').value = getView();
    const order = getSortConfig();
    v('fe-st-sort').value = order.col ?? '';
    v('fe-st-sort-dir').value = order.dir;
    v('fe-st-group').value = getGroupMode();
    v('fe-st-datefmt').value = settings.dateFormat || 'short';
    v('fe-st-click').value = settings.clickOpens || 'look';
    v('fe-st-panel').value = getPreviewLayout().mode;
    el<HTMLInputElement>('fe-st-sidebar').checked = settings.showSidebar !== false;
    el<HTMLInputElement>('fe-st-sec-recent').checked = !settings.hideRecent;
    v('fe-st-terminal').value = settings.terminalApp || 'ghostty';
    el('fe-st-term-custom-row').style.display = settings.terminalApp === 'custom' ? '' : 'none';
    el<HTMLInputElement>('fe-st-term-custom').value = settings.terminalCmd || '';
    v('fe-st-rd-column').value = savedColumnMode(settings.readerColumn);
    v('fe-st-rd-lh').value = String(settings.readerLineHeight || 1.65);
    v('fe-st-rd-code').value = String(settings.readerCodeSize || 13);
    el<HTMLInputElement>('fe-st-wrap').checked = settings.wrapLines !== false;
    v('fe-st-filepages').value = settings.renderFilePages || 'all';
    const excluded = Array.isArray(settings.excludedFileExtensions) ? settings.excludedFileExtensions : DEFAULT_SETTINGS.excludedFileExtensions ?? [];
    v('fe-st-excluded-exts').value = excluded.map(x => '.' + x).join(', ');
    el<HTMLInputElement>('fe-st-notes-root').value = settings.notesRoot || '';
    v('fe-st-edit-roots').value = (settings.editableFolders ?? []).join(', ');
    updateTermHint();
    renderRulesList();
    refreshAi();
    settingsDlg.open(tab);
  }

  el('fe-settings-btn').addEventListener('click', () => openSettings());
  const helpDlg = mountDialog('fe-help-modal');
  wireKeyboardMap(el('fe-help-modal'));
  el('fe-help-btn').addEventListener('click', () => helpDlg.open());
  el('fe-st-keys').addEventListener('click', () => { settingsDlg.close(); helpDlg.open('keys'); });
  app.openHelp = tab => helpDlg.open(tab);
  app.openSettings = openSettings;

  // Look.
  els<HTMLInputElement>('input[name="bfb-theme"]').forEach(r => r.addEventListener('change', () => setThemeMode(fe, r.value as ThemeMode)));
  els<HTMLInputElement>('input[name="bfb-palette"]').forEach(r => r.addEventListener('change', () => { fe.dataset.palette = r.value; kvSet(PALETTE_KEY, r.value); }));
  els<HTMLInputElement>('input[name="bfb-appicon"]').forEach(r => r.addEventListener('change', () => setAppIcon(r.value)));
  v('fe-st-uiscale').addEventListener('change', () => {
    settings.uiScale = Number(v('fe-st-uiscale').value); saveSettings(settings);
    setUiScale(settings.uiScale);
  });
  const textScale = () => document.documentElement.style.setProperty('--ui-text-scale', String(Number(v('fe-st-rd-size').value) / 15));
  v('fe-st-rd-size').addEventListener('input', textScale);
  v('fe-st-rd-size').addEventListener('change', () => { textScale(); settings.readerSize = Number(v('fe-st-rd-size').value); saveSettings(settings); });
  v('fe-st-density').addEventListener('change', () => {
    settings.compactMode = v('fe-st-density').value === 'compact'; saveSettings(settings);
    fe.classList.toggle('compact', settings.compactMode);
  });
  el<HTMLInputElement>('fe-st-tooltips').addEventListener('change', function () {
    settings.tooltips = this.checked; saveSettings(settings);
    fe.classList.toggle('fe-notips', !this.checked);
  });

  // Folders.
  v('fe-st-defview').addEventListener('change', () => kvSet(VIEW_KEY, v('fe-st-defview').value));
  const applyOrder = () => app.setOrder(
    { col: (v('fe-st-sort').value || null) as SortConfig['col'], dir: v('fe-st-sort-dir').value as SortConfig['dir'] },
    v('fe-st-group').value as GroupMode);
  ['fe-st-sort', 'fe-st-sort-dir', 'fe-st-group'].forEach(id => el(id).addEventListener('change', applyOrder));
  v('fe-st-datefmt').addEventListener('change', () => { settings.dateFormat = v('fe-st-datefmt').value as 'short' | 'full'; saveSettings(settings); app.applyAll(); });
  v('fe-st-click').addEventListener('change', () => { settings.clickOpens = v('fe-st-click').value as 'look' | 'go'; saveSettings(settings); });
  v('fe-st-panel').addEventListener('change', () => {
    savePreviewLayout({ ...getPreviewLayout(), mode: v('fe-st-panel').value as 'modal' | 'side' });
    toast('The next preview opens there');
  });
  el('fe-st-panel-reset').addEventListener('click', () => { savePreviewLayout({ mode: getPreviewLayout().mode }); toast('Preview sizes reset'); });
  el<HTMLInputElement>('fe-st-sidebar').addEventListener('change', function () {
    settings.showSidebar = this.checked; saveSettings(settings);
    setSidebarShown(this.checked);
  });
  el<HTMLInputElement>('fe-st-sec-recent').addEventListener('change', function () {
    settings.hideRecent = !this.checked; saveSettings(settings);
    app.showLens?.(this.checked ? null : 'notes', !this.checked);
  });
  v('fe-st-terminal').addEventListener('change', () => {
    settings.terminalApp = v('fe-st-terminal').value; saveSettings(settings);
    el('fe-st-term-custom-row').style.display = settings.terminalApp === 'custom' ? '' : 'none';
    updateTermHint();
  });
  el<HTMLInputElement>('fe-st-term-custom').addEventListener('input', function () {
    settings.terminalCmd = this.value; saveSettings(settings); updateTermHint();
  });

  // Files.
  v('fe-st-rd-column').addEventListener('change', () => {
    settings.readerColumn = v('fe-st-rd-column').value as 'unset' | 'xl' | 'lg' | 'md'; saveSettings(settings);
    try { kvSet(COLUMN_KEY, settings.readerColumn); } catch { /* fine */ }
  });
  const readerVar = (id: string, key: 'readerLineHeight' | 'readerCodeSize', cssVar: string, unit: string) => {
    const live = () => fe.style.setProperty(cssVar, v(id).value + unit);
    v(id).addEventListener('input', live);
    v(id).addEventListener('change', () => { live(); settings[key] = Number(v(id).value); saveSettings(settings); });
  };
  readerVar('fe-st-rd-lh', 'readerLineHeight', '--rd-lh', '');
  readerVar('fe-st-rd-code', 'readerCodeSize', '--rd-code', 'px');
  el<HTMLInputElement>('fe-st-wrap').addEventListener('change', function () {
    settings.wrapLines = this.checked; saveSettings(settings);
    fe.dataset.wrap = this.checked ? 'on' : 'off';
  });
  v('fe-st-filepages').addEventListener('change', () => { settings.renderFilePages = v('fe-st-filepages').value as 'all' | 'not-md' | 'off'; saveSettings(settings); });
  v('fe-st-excluded-exts').addEventListener('change', () => {
    settings.excludedFileExtensions = parseExcludedExtensions(v('fe-st-excluded-exts').value);
    v('fe-st-excluded-exts').value = settings.excludedFileExtensions.map(x => '.' + x).join(', ');
    saveSettings(settings);
  });
  el('fe-st-excluded-reset').addEventListener('click', () => {
    settings.excludedFileExtensions = [...(DEFAULT_SETTINGS.excludedFileExtensions ?? [])];
    v('fe-st-excluded-exts').value = settings.excludedFileExtensions.map(x => '.' + x).join(', ');
    saveSettings(settings);
  });

  // Notes.
  el('fe-st-notes-pick').addEventListener('click', () => app.pickNotesFolder());
  el<HTMLInputElement>('fe-st-notes-root').addEventListener('change', function () {
    settings.notesRoot = this.value.trim() || undefined; saveSettings(settings);
    app.refreshNotes();
  });
  v('fe-st-edit-roots').addEventListener('change', () => {
    const list = v('fe-st-edit-roots').value.split(',').map(s => s.trim()).filter(Boolean);
    settings.editableFolders = list.length ? list : undefined; saveSettings(settings);
  });

  // Data.
  el('fe-st-export').addEventListener('click', () => {
    const out: Record<string, unknown> = {};
    for (const k of kvKeys().sort()) { try { out[k] = JSON.parse(kvGet(k)!); } catch { out[k] = kvGet(k); } }
    const text = JSON.stringify(out, null, 2);
    const ta = el<HTMLTextAreaElement>('fe-st-export-out');
    ta.value = text; ta.style.display = ''; ta.select();
    navigator.clipboard.writeText(text).then(() => toast('Export copied'), () => toast('Export shown below'));
  });
  el('fe-st-import').addEventListener('click', () => el<HTMLInputElement>('fe-st-import-file').click());
  el<HTMLInputElement>('fe-st-import-file').addEventListener('change', function () {
    const f = this.files?.[0];
    if (!f) return;
    f.text().then(text => {
      const data = JSON.parse(text) as Record<string, unknown>;
      let n = 0;
      for (const [k, val] of Object.entries(data)) if (k.startsWith('bfb-')) { kvSet(k, typeof val === 'string' ? val : JSON.stringify(val)); n++; }
      toast(`Imported ${n} keys, reloading`);
      setTimeout(() => location.reload(), 600);
    }).catch(() => toast('That file is not a JSON export'));
  });
}
