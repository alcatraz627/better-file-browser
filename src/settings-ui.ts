// The Settings and Help dialogs: filling the controls from the live
// settings, saving every change, the icon-rule editor, and the local-model
// status card.
import type { App } from './app';
import type { LlmAvailability } from './llm';
import { el, els } from './el';
import { esc } from './utils';
import { icoCustom } from './icons';
import { VIEW_KEY, THEME_KEY, TERMINAL_CMDS, DEFAULT_ICON_RULES, getView, saveIconRules, saveSettings } from './storage';
import { llmAvailability, llmWarm } from './llm';
import { mountDialog } from './dialog';

export function initSettingsUi(app: App): void {
  const { fe, settings, toast } = app;

  function renderRulesList(): void {
    const list = el('fe-st-rules-list');
    if (!app.iconRules.length) {
      list.innerHTML = '<div class="fe-st-rules-empty">No rules yet. Click "+ Add rule" to create one.</div>';
      return;
    }
    list.innerHTML = app.iconRules.map((rule, i) => `
      <div class="fe-st-rule" data-idx="${i}">
        <input type="checkbox" class="fe-st-rule-en" title="Enable" ${rule.enabled ? 'checked' : ''}>
        <div class="fe-st-rule-preview">${icoCustom(rule.label, rule.color)}</div>
        <input type="text" class="fe-st-rule-pattern" value="${esc(rule.pattern)}" placeholder="regex…" title="Regex (case-insensitive)">
        <input type="text" class="fe-st-rule-label"   value="${esc(rule.label)}"   placeholder="LBL"   maxlength="4" title="Badge text (≤4 chars)">
        <input type="color" class="fe-st-rule-color"  value="${esc(rule.color)}"        title="Icon color">
        <button class="fe-st-rule-del" data-idx="${i}" title="Delete">✕</button>
      </div>`).join('');
  }

  function updateTermHint(): void {
    const term = settings.terminalApp || 'ghostty';
    const hint = document.getElementById('fe-st-term-hint');
    if (!hint) return;
    const cmd = term === 'custom' ? (settings.terminalCmd || '') : (TERMINAL_CMDS[term] || '');
    hint.textContent = cmd ? `Command: ${cmd.replace(/\$\{p\}/g, app.folderPath)}` : '';
  }

  const settingsDlg = mountDialog('fe-settings-modal');
  function openSettings(): void {
    els<HTMLInputElement>('input[name="bfb-theme"]').forEach(r => { r.checked = r.value === (fe.dataset.theme || 'dark'); });
    el<HTMLSelectElement>('fe-st-defview').value   = getView();
    el<HTMLInputElement>('fe-st-compact').checked  = !!settings.compactMode;
    el<HTMLInputElement>('fe-st-sidebar').checked  = settings.showSidebar !== false;
    el<HTMLSelectElement>('fe-st-datefmt').value   = settings.dateFormat || 'short';
    el<HTMLSelectElement>('fe-st-terminal').value  = settings.terminalApp || 'ghostty';
    el('fe-st-term-custom-row').style.display = settings.terminalApp === 'custom' ? '' : 'none';
    el<HTMLInputElement>('fe-st-term-custom').value = settings.terminalCmd || '';
    el<HTMLInputElement>('fe-st-notes-root').value = settings.notesRoot || '';
    el<HTMLSelectElement>('fe-st-filepages').value = settings.renderFilePages || 'all';
    updateTermHint();
    renderRulesList();
    refreshAiStatus();
    settingsDlg.open();
  }

  function refreshAiStatus(): void {
    const head = document.querySelector<HTMLElement>('.fe-st-ai-head')!;
    const state = document.querySelector<HTMLElement>('.fe-st-ai-state')!;
    const grid  = el('fe-st-ai-grid');
    const hint  = el('fe-st-ai-hint');
    const controls = el('fe-st-ai-controls');
    const modelSel = el<HTMLSelectElement>('fe-st-ai-model');
    const warmBtn  = el<HTMLButtonElement>('fe-st-ai-warm');
    head.className = 'fe-st-ai-head';
    state.textContent = 'Checking…';
    grid.innerHTML = '';
    hint.innerHTML = '';
    controls.style.display = 'none';
    const row = (k: string, v: string, cls = '') =>
      `<span class="k">${esc(k)}</span><span class="v ${cls}">${esc(v)}</span>`;

    llmAvailability().then((av: LlmAvailability) => {
      if (av.kind === 'unavailable') {
        head.classList.add('off');
        state.textContent = 'Not installed';
        hint.innerHTML = `The native host isn't registered (${esc(av.reason)}). ` +
          `Install it once: run <code>native/install.sh &lt;extension-id&gt;</code> and reload the extension.`;
        return;
      }
      const s = av.status;
      const cls = av.kind === 'down' ? 'down' : (av.cold ? 'cold' : 'ready');
      head.classList.add(cls);
      state.textContent = av.kind === 'down' ? 'Server down'
        : (av.cold ? 'Ready, cold: the first reply loads the model' : 'Ready and warm');
      grid.innerHTML = [
        row('Default model', s.default_model || '—'),
        row('Warm', s.warm ? 'yes, model resident' : 'no, loads on first use', s.warm ? 'warm-yes' : 'warm-no'),
        row('Latency', s.latency_class),
        row('Server', `${s.server}${s.host ? '  ' + s.host : ''}`),
        s.toolkit_version ? row('Toolkit', `lm ${s.toolkit_version}`) : '',
      ].join('');
      if (av.kind === 'ready' && s.available_models?.length) {
        const chosen = settings.aiModel || s.default_model;
        modelSel.innerHTML = s.available_models.map(m =>
          `<option value="${esc(m)}"${m === chosen ? ' selected' : ''}>${esc(m)}${m === s.default_model ? ' (default)' : ''}</option>`,
        ).join('');
        warmBtn.textContent = s.warm ? 'Unload (warm off)' : 'Keep warm';
        warmBtn.disabled = false;
        controls.style.display = '';
      }
      hint.innerHTML = av.kind === 'down'
        ? `Ollama isn't responding. Start it, then Refresh.`
        : (av.cold
            ? `Cold start: the first reply loads the model (about 2 to 3 s). "Keep warm" makes replies instant.`
            : `Model is resident, so replies are near-instant.`);
    });
  }
  el('fe-st-ai-refresh').addEventListener('click', refreshAiStatus);
  el<HTMLSelectElement>('fe-st-ai-model').addEventListener('change', function () {
    settings.aiModel = this.value || undefined;
    saveSettings(settings);
  });
  el('fe-st-ai-warm').addEventListener('click', function () {
    const btn = this as HTMLButtonElement;
    const turnOn = btn.textContent !== 'Unload (warm off)';
    btn.disabled = true; btn.textContent = turnOn ? 'Warming…' : 'Unloading…';
    llmWarm(turnOn).then(r => {
      if (!r.ok) toast(r.message ? `Warm failed: ${r.message}` : 'Warm failed');
      refreshAiStatus();
    });
  });

  el('fe-settings-btn').addEventListener('click', openSettings);
  const helpDlg = mountDialog('fe-help-modal');
  el('fe-help-btn').addEventListener('click', () => helpDlg.open());

  els<HTMLInputElement>('input[name="bfb-theme"]').forEach(r => {
    r.addEventListener('change', () => { fe.dataset.theme = r.value; localStorage.setItem(THEME_KEY, r.value); });
  });
  el<HTMLSelectElement>('fe-st-defview').addEventListener('change', function () {
    localStorage.setItem(VIEW_KEY, this.value);
  });
  el<HTMLInputElement>('fe-st-compact').addEventListener('change', function () {
    settings.compactMode = this.checked; saveSettings(settings);
    fe.classList.toggle('compact', this.checked);
  });
  el<HTMLInputElement>('fe-st-sidebar').addEventListener('change', function () {
    settings.showSidebar = this.checked; saveSettings(settings);
    el('fe-side').style.display = this.checked ? '' : 'none';
  });
  el<HTMLSelectElement>('fe-st-datefmt').addEventListener('change', function () {
    settings.dateFormat = this.value as 'short' | 'full'; saveSettings(settings); app.applyAll();
  });
  el<HTMLSelectElement>('fe-st-terminal').addEventListener('change', function () {
    settings.terminalApp = this.value; saveSettings(settings);
    el('fe-st-term-custom-row').style.display = this.value === 'custom' ? '' : 'none';
    updateTermHint();
    const termBtn = document.getElementById('fe-term-btn');
    if (termBtn) termBtn.title = `Open in ${this.options[this.selectedIndex].text}`;
  });
  el<HTMLSelectElement>('fe-st-filepages').addEventListener('change', function () {
    settings.renderFilePages = this.value as 'all' | 'not-md' | 'off'; saveSettings(settings);
  });
  el<HTMLInputElement>('fe-st-notes-root').addEventListener('change', function () {
    settings.notesRoot = this.value.trim() || undefined; saveSettings(settings);
    app.refreshNotes();
  });
  el<HTMLInputElement>('fe-st-term-custom').addEventListener('input', function () {
    settings.terminalCmd = this.value; saveSettings(settings); updateTermHint();
  });

  const rulesList = el('fe-st-rules-list');
  const ruleAt = (e: Event): [HTMLElement, number] | null => {
    const row = (e.target as HTMLElement).closest<HTMLElement>('.fe-st-rule');
    if (!row) return null;
    const idx = parseInt(row.dataset.idx!);
    return isNaN(idx) || idx >= app.iconRules.length ? null : [row, idx];
  };
  rulesList.addEventListener('change', e => {
    const hit = ruleAt(e); if (!hit) return;
    const [row, idx] = hit;
    const t = e.target as HTMLInputElement;
    if (t.classList.contains('fe-st-rule-en')) app.iconRules[idx].enabled = t.checked;
    if (t.classList.contains('fe-st-rule-color')) {
      app.iconRules[idx].color = t.value;
      row.querySelector('.fe-st-rule-preview')!.innerHTML = icoCustom(app.iconRules[idx].label, app.iconRules[idx].color);
    }
    saveIconRules(app.iconRules); app.applyAll();
  });
  rulesList.addEventListener('input', e => {
    const hit = ruleAt(e); if (!hit) return;
    const [row, idx] = hit;
    const t = e.target as HTMLInputElement;
    if (t.classList.contains('fe-st-rule-pattern')) app.iconRules[idx].pattern = t.value;
    if (t.classList.contains('fe-st-rule-label')) {
      app.iconRules[idx].label = t.value;
      row.querySelector('.fe-st-rule-preview')!.innerHTML = icoCustom(app.iconRules[idx].label, app.iconRules[idx].color);
    }
    saveIconRules(app.iconRules); app.applyAll();
  });
  rulesList.addEventListener('click', e => {
    const del = (e.target as HTMLElement).closest<HTMLElement>('.fe-st-rule-del');
    if (!del) return;
    const idx = parseInt(del.dataset.idx!);
    if (!isNaN(idx)) { app.iconRules.splice(idx, 1); saveIconRules(app.iconRules); app.applyAll(); renderRulesList(); }
  });
  el('fe-st-add-rule').addEventListener('click', () => {
    app.iconRules.push({ id: 'r' + Date.now(), pattern: '', label: 'NEW', color: '#58a6ff', enabled: true });
    saveIconRules(app.iconRules);
    renderRulesList();
    const inputs = els<HTMLInputElement>('.fe-st-rule-pattern', rulesList);
    inputs[inputs.length - 1]?.focus();
  });
  el('fe-st-reset-rules').addEventListener('click', () => {
    app.iconRules = DEFAULT_ICON_RULES.map(r => ({ ...r }));
    saveIconRules(app.iconRules); app.applyAll(); renderRulesList();
    toast('Icon rules reset to defaults');
  });
}
