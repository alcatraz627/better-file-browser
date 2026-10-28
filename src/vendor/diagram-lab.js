// Mermaid lab: shows a mermaid flowchart the way mature diagram tools show
// theirs, on any page built with the kit. The mermaid source is never
// changed: layout, direction, look, box positions and every highlight are
// view choices, remembered in the browser.
//
//   MermaidLab.mount(element, { src, md, file, key, panel, expand, height })
//
// src is the mermaid text. md (optional) is the markdown the diagram lives in;
// its tables and its plain-text path feed the side panel. Needs mermaid 12
// (ELK is built in). Every option, and how better-file-browser keeps its
// copy of this file: conventions/pages.md, section "Diagrams".
(() => {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const inline = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ICON = {
    find: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5 14 14"/></svg>',
    out: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3.5 8h9"/></svg>',
    in: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3.5 8h9M8 3.5v9"/></svg>',
    width: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M2 3v10M14 3v10M4.5 8h7M6 6l-2 2 2 2M10 6l2 2-2 2"/></svg>',
    all: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"/></svg>',
    copy: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="5" y="5" width="8.5" height="8.5" rx="1.5"/><path d="M3 10.5V3.8C3 3.4 3.4 3 3.8 3h6.7"/></svg>',
    save: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10"/></svg>',
    expand: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M9.5 2.5h4v4M13.5 2.5 9 7M6.5 13.5h-4v-4M2.5 13.5 7 9"/></svg>',
    reset: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 8a5 5 0 1 0 1.5-3.6M3 2.5v2.5h2.5"/></svg>',
  };
  const svg16 = d => `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  Object.assign(ICON, {
    tidy: svg16('<rect x="1.5" y="2" width="5.5" height="3.5" rx="1"/><rect x="9" y="10.5" width="5.5" height="3.5" rx="1"/><path d="M4.25 5.5v2.75h7.5v2.25"/>'),
    packed: svg16('<rect x="5.25" y="2" width="5.5" height="3.5" rx="1"/><rect x="1.5" y="10.5" width="5" height="3.5" rx="1"/><rect x="9.5" y="10.5" width="5" height="3.5" rx="1"/><path d="M6.8 5.5 4.2 10.5M9.2 5.5l2.6 5"/>'),
    down: svg16('<path d="M8 2.5v11M4 9.5l4 4 4-4"/>'),
    right: svg16('<path d="M2.5 8h11M9.5 4l4 4-4 4"/>'),
    curved: svg16('<path d="M2.5 13.5C2.5 6.5 13.5 9.5 13.5 2.5"/>'),
    square: svg16('<path d="M2.5 13.5V10a2 2 0 0 1 2-2h7a2 2 0 0 0 2-2V2.5"/>'),
    navigate: svg16('<path d="M3.5 2.5 12.5 7l-4 1.2-1.7 4.3z"/>'),
    focus: svg16('<circle cx="8" cy="8" r="5.5"/><circle cx="8" cy="8" r="2"/>'),
    walk: svg16('<path d="M3.5 3.5v9l6.5-4.5z"/><path d="M12.5 3.5v9"/>'),
    look: svg16('<path d="M8 2.5a5.5 5.5 0 1 0 0 11c.9 0 1.3-.6 1.3-1.2 0-.8-.6-1-.6-1.8 0-.6.5-1 1.1-1h1.4a2.3 2.3 0 0 0 2.3-2.3c0-2.6-2.5-4.7-5.5-4.7z"/><circle cx="5.3" cy="7.2" r=".7"/><circle cx="7.6" cy="5.1" r=".7"/><circle cx="10.4" cy="5.7" r=".7"/>'),
    panel: svg16('<rect x="2" y="2.5" width="12" height="11" rx="1.5"/><path d="M10 2.5v11"/>'),
    code: svg16('<path d="M6 4.5 2.5 8 6 11.5M10 4.5l3.5 3.5-3.5 3.5"/>'),
    caret: '<svg class="dl-caret" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 6.5 8 9.5l3-3"/></svg>',
    close: svg16('<path d="M4 4l8 8M12 4l-8 8"/>'),
    diagram: svg16('<rect x="1.5" y="2" width="5.5" height="4" rx="1"/><rect x="9" y="10" width="5.5" height="4" rx="1"/><path d="M4.25 6v2.5a1.5 1.5 0 0 0 1.5 1.5H9"/>'),
    fsvg: svg16('<circle cx="3.5" cy="12.5" r="1.5"/><circle cx="12.5" cy="3.5" r="1.5"/><path d="M5 12.5c4 0 2-9 6-9"/>'),
    fpng: svg16('<rect x="2" y="3" width="12" height="10" rx="1.5"/><circle cx="6" cy="6.5" r="1.2"/><path d="m2.5 12 4-3.5 2.5 2 2-1.5 3 2.5"/>'),
    fpdf: svg16('<path d="M4 2h5.5L12.5 5v9H4z"/><path d="M9.5 2v3h3M6 9h4.5M6 11.5h3"/>'),
    fmd: svg16('<rect x="1.5" y="3.5" width="13" height="9" rx="1.5"/><path d="M4 10.5v-5l2 2.5 2-2.5v5M11.5 5.5v5M10 9l1.5 1.5L13 9"/>'),
    ftxt: svg16('<path d="M3 4h10M3 7h10M3 10h7M3 13h5"/>'),
  });
  const plain = t => String(t ?? '').replace(/<br\s*\/?>/gi, ' · ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const lines = t => String(t ?? '').split(/<br\s*\/?>/i).map(plain).filter(Boolean);
  const bare = t => t.replace(/^[^\p{L}\p{N}]+/u, '');
  let instances = 0, active = null;

  // ---- The doc around the diagram: its tables, legend and plain-text path.
  function readDoc(md) {
    const ls = (md ?? '').split('\n'), tables = [], blocks = [];
    let section = '', fence = null, buf = [];
    const slug = t => t.toLowerCase().replace(/[^\w\- ]+/g, '').trim().replace(/ /g, '-');
    for (let i = 0; i < ls.length; i++) {
      const l = ls[i];
      if (fence !== null) { if (l.startsWith('```')) { blocks.push({ section, lang: fence, lines: buf }); fence = null; buf = []; } else buf.push(l); continue; }
      if (l.startsWith('```')) { fence = l.slice(3).trim(); continue; }
      const h = l.match(/^#{1,4}\s+(.*)/);
      if (h) { section = h[1].trim(); continue; }
      if (l.startsWith('|') && ls[i + 1] && /^\|[\s:|-]+\|$/.test(ls[i + 1].trim())) {
        const cells = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
        const t = { section, anchor: slug(section), headers: cells(l), rows: [] };
        for (i += 2; i < ls.length && ls[i].startsWith('|'); i++) t.rows.push(cells(ls[i]));
        i--; tables.push(t);
      }
    }
    const textPath = blocks.find(b => !b.lang && b.lines.some(x => x.includes('▼')))?.lines ?? [];
    const legendTable = tables.find(t => /legend/i.test(t.section));
    const legend = new Map((legendTable?.rows ?? []).map(r => [r[1]?.toLowerCase(), { mark: r[0], name: r[1], meaning: r[2] }]));
    const word = key => new RegExp(`(^|[^\\w])${key}([^\\w]|$)`);
    return {
      legend,
      rowsFor(key) {
        if (!key) return [];
        const re = word(key);
        return tables.filter(t => t !== legendTable).flatMap(t => t.rows.filter(r => r.some(c => re.test(c))).map(r => ({ t, r })));
      },
      // The step's line in the text path and the branch lines under it, as plain items.
      pathFor(key) {
        if (!key) return [];
        const re = word(key), at = textPath.findIndex(x => re.test(x));
        if (at < 0) return [];
        const out = [];
        for (let j = at + 1; j < textPath.length && /^\s+[│├]/.test(textPath[j]); j++) {
          const t = textPath[j].replace(/[│├└─]+/g, ' ').replace(/\s*▶\s*/g, ' → ').replace(/\s+/g, ' ').trim();
          if (t) out.push(t);
        }
        return out;
      },
    };
  }

  // Smooth line through points: the uniform B-spline d3 calls curveBasis.
  function basis(p) {
    if (p.length < 3) return 'M' + p.map(q => `${q.x},${q.y}`).join('L');
    let d = `M${p[0].x},${p[0].y}`, x0 = p[0].x, y0 = p[0].y, x1 = p[1].x, y1 = p[1].y;
    d += `L${(5 * x0 + x1) / 6},${(5 * y0 + y1) / 6}`;
    for (let i = 2; i < p.length; i++) {
      const { x, y } = p[i];
      d += `C${(2 * x0 + x1) / 3},${(2 * y0 + y1) / 3} ${(x0 + 2 * x1) / 3},${(y0 + 2 * y1) / 3} ${(x0 + 4 * x1 + x) / 6},${(y0 + 4 * y1 + y) / 6}`;
      x0 = x1; y0 = y1; x1 = x; y1 = y;
    }
    d += `C${(2 * x0 + x1) / 3},${(2 * y0 + y1) / 3} ${(x0 + 2 * x1) / 3},${(y0 + 2 * y1) / 3} ${x1},${y1}`;
    return d;
  }
  // Right-angle line with each corner rounded.
  function rounded(p, r = 12) {
    let d = `M${p[0].x},${p[0].y}`;
    for (let i = 1; i < p.length - 1; i++) {
      const a = p[i - 1], b = p[i], c = p[i + 1];
      const l1 = Math.hypot(b.x - a.x, b.y - a.y), l2 = Math.hypot(c.x - b.x, c.y - b.y);
      const k = Math.min(r, l1 / 2, l2 / 2);
      if (!k) { d += `L${b.x},${b.y}`; continue; }
      d += `L${b.x + (a.x - b.x) / l1 * k},${b.y + (a.y - b.y) / l1 * k}Q${b.x},${b.y} ${b.x + (c.x - b.x) / l2 * k},${b.y + (c.y - b.y) / l2 * k}`;
    }
    const z = p[p.length - 1];
    return d + `L${z.x},${z.y}`;
  }

  const hashOf = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + s.length.toString(36); };

  function mount(root, opts) {
    const me = ++instances, KEY = 'dl-' + (opts.key ?? 'lab') + '-', compact = !!opts.compact;
    const store = opts.store ?? {
      get(k, d) { try { const v = localStorage.getItem(KEY + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
      set(k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch (e) { /* private window: this visit only */ } },
    };
    let M = typeof opts.mermaid === 'function' ? null : opts.mermaid ?? window.mermaid;
    const loadMermaid = async () => {
      if (!M) M = await opts.mermaid();
      if (!M.__dlInit) { M.initialize({ startOnLoad: false, securityLevel: 'strict' }); M.__dlInit = true; }
      // A render straight after loading can come back empty until mermaid has parsed once.
      if (!M.__dlPrimed) { await M.mermaidAPI.getDiagramFromText(opts.src).catch(() => {}); M.__dlPrimed = true; }
      return M;
    };
    const srcHash = hashOf(opts.src);
    // The author's direction is the default; a reader's flip is remembered for this diagram.
    const ownDir = (opts.src.match(/^\s*(?:flowchart|graph)\s+(TB|TD|BT|RL|LR)\b/m)?.[1] ?? 'TD').replace('TB', 'TD');
    const view = { layout: store.get('layout', 'elk'), dir: store.get('dir', ownDir), look: store.get('look', 'classic'), style: store.get('style', 'soft'), edges: store.get('edges', 'curved'), mode: compact ? 'navigate' : store.get('mode', 'navigate') };
    const doc = readDoc(opts.md);
    // Toggles are icon segments; the rarer choices and the exports sit in menus.
    const seg = (opt, label, items) => `<div class="dl-seg" data-opt="${opt}" role="group" aria-label="${label}">${items.map(([v, icon, title]) => `<button type="button" data-v="${v}" title="${esc(label + ': ' + title)}" aria-label="${esc(title)}">${icon}</button>`).join('')}</div>`;
    const actBtn = (a, icon, title, text = '', extra = '') => `<button type="button" class="dl-act${text ? '' : ' dl-icon'}" data-act="${a}" title="${esc(title)}" aria-label="${esc(title)}"${extra}>${icon}${text}</button>`;
    const menu = (id, icon, title, body) => `<div class="dl-menu" data-menu="${id}"><button type="button" class="dl-act dl-menu-btn" aria-haspopup="menu" aria-expanded="false" title="${esc(title)}" aria-label="${esc(title)}">${icon}${ICON.caret}</button><div class="dl-menu-list" role="menu" hidden>${body}</div></div>`;
    const item = (attrs, icon, name, note) => `<button type="button" role="menuitem" ${attrs} title="${esc(note)}">${icon}<span><b>${esc(name)}</b><small>${esc(note)}</small></span></button>`;
    const choices = (opt, label, items) => `<div class="dl-menu-sec" data-opt="${opt}" role="group" aria-label="${label}"><h4>${label}</h4>${items.map(([v, name, note]) => `<button type="button" role="menuitemradio" data-v="${v}" title="${esc(note)}"><span><b>${esc(name)}</b><small>${esc(note)}</small></span></button>`).join('')}</div>`;
    const EXPORTS = [['svg', ICON.fsvg, 'SVG', 'The picture, sharp at any size'], ['png', ICON.fpng, 'PNG', 'The picture as an image, twice the size'], ['pdf', ICON.fpdf, 'PDF', 'One page holding the picture'], ['md', ICON.fmd, 'Markdown', 'The mermaid in a fenced block, to paste in a doc'], ['txt', ICON.ftxt, 'Text', 'The mermaid source alone']];
    const host = opts.themeHost ?? document.documentElement;
    const tone = () => { root.dataset.tone = host.dataset.theme === 'light' ? 'light' : 'dark'; };
    tone();
    root.classList.add('dl');
    root.classList.toggle('dl-compact', compact);
    if (opts.panel === false || compact) root.classList.add('dl-nopanel');
    if (opts.height) root.style.setProperty('--dl-height', opts.height);
    const modeBtn = (m, icon, name, note) => `<button type="button" role="tab" data-mode="${m}" title="${esc(name + ': ' + note)}">${icon}<b>${name}</b></button>`;
    root.innerHTML = `
      <div class="dl-top">
        ${opts.title ? `<div class="dl-title"><span class="dl-title-icon">${opts.icon ?? ICON.diagram}</span><div><b>${esc(opts.title)}</b><small class="dl-subtitle">${esc(opts.subtitle ?? '')}</small></div></div>` : ''}
        ${compact ? '' : `<div class="dl-modes" role="tablist" aria-label="How to read the diagram">
          ${modeBtn('navigate', ICON.navigate, 'Navigate', 'hover and click steps')}
          ${modeBtn('focus', ICON.focus, 'Focus', "one step's part of the flow")}
          ${modeBtn('walkthrough', ICON.walk, 'Walk', 'step through the flow')}
        </div>`}
        <div class="dl-opts">
          ${seg('layout', 'Layout', [['elk', ICON.tidy, 'Tidy, fewer crossing lines and steps in clear lanes'], ['dagre', ICON.packed, "Compact, mermaid's usual layout: tighter, more lines cross"]])}
          ${seg('dir', 'Flow', [['TD', ICON.down, 'Top to bottom'], ['LR', ICON.right, 'Left to right']])}
          ${seg('edges', 'Lines', [['curved', ICON.curved, 'Curved'], ['rounded', ICON.square, 'Square, right angles with rounded corners']])}
          ${compact ? '' : menu('look', ICON.look, 'Colour and shapes',
            choices('style', 'Colour', [['soft', 'Soft', 'A pale wash of each kind'], ['outline', 'Outline', 'Plain cards, coloured lines'], ['bold', 'Bold', 'Solid colours, like sticky notes']])
            + choices('look', 'Shapes', [['classic', 'Classic', "Mermaid's classic shapes"], ['neo', 'Neo', "Mermaid's newer, rounder shapes"]]))}
        </div>
        <div class="dl-acts">
          ${actBtn('reset', ICON.reset, 'Put moved boxes back', '', ' disabled')}
          ${(opts.tools ?? []).map(t => actBtn(t.act, t.icon, t.title, t.label ?? '', t.pressed != null ? ` aria-pressed="${t.pressed}"` : '')).join('')}
          ${compact || opts.panel === false ? '' : actBtn('panel', ICON.panel, 'Show or hide the side panel', '', ' aria-pressed="true"')}
          ${actBtn('raw', ICON.code, 'Show the mermaid text', '', ' aria-pressed="false"')}
          ${actBtn('copy', ICON.copy, 'Copy the mermaid source')}
          ${menu('export', ICON.save, 'Download', EXPORTS.map(([f, icon, name, note]) => item(`data-export="${f}"`, icon, name, note)).join(''))}
          ${opts.expand ? actBtn('expand', ICON.expand, 'Open large, with the side panel') : ''}
          ${opts.onClose ? actBtn('close', ICON.close, 'Close (Esc)') : ''}
        </div>
      </div>
      <div class="dl-main">
        <div class="dl-stage" aria-label="Diagram">
          <div class="dl-world"></div>
          <div class="dl-float dl-find">${ICON.find}<input type="search" placeholder="Find a step" aria-label="Find a step" autocomplete="off"><kbd>/</kbd><ul role="listbox"></ul></div>
          <div class="dl-float dl-zoom" role="group" aria-label="Zoom">
            <button type="button" data-z="out" title="Zoom out (-)" aria-label="Zoom out">${ICON.out}</button>
            <button type="button" data-z="one" class="dl-pct" title="Back to 100%">100%</button>
            <button type="button" data-z="in" title="Zoom in (+)" aria-label="Zoom in">${ICON.in}</button><i></i>
            <button type="button" data-z="width" title="Fit the width, text stays readable (w)" aria-label="Fit width">${ICON.width}</button>
            <button type="button" data-z="all" title="See it all (f)" aria-label="See it all">${ICON.all}</button>
          </div>
          <div class="dl-float dl-legend" aria-label="Kinds of step"></div>
          <div class="dl-float dl-mini" title="Minimap: click or drag to move"><div class="dl-mini-svg"></div><div class="dl-mini-view"></div></div>
          <div class="dl-hint" aria-live="polite"></div>
          <div class="dl-toast" aria-live="polite"></div>
        </div>
        <div class="dl-resize" role="separator" aria-orientation="vertical" title="Drag to resize the side panel"></div>
        <aside class="dl-panel" aria-live="polite"></aside>
      </div>
      <pre class="dl-raw" hidden></pre>`;
    const $ = s => root.querySelector(s);
    const stage = $('.dl-stage'), world = $('.dl-world'), panel = $('.dl-panel'), hint = $('.dl-hint');
    root.addEventListener('pointerenter', () => { active = me; });
    root.addEventListener('focusin', () => { active = me; });
    if (!active || !compact) active = me;
    let toastT;
    // A toast, or with busy a lasting one with a spinner until the next toast replaces it.
    const toast = (t, busy = false) => {
      const el = $('.dl-toast');
      el.textContent = t; el.classList.toggle('dl-busy', busy);
      clearTimeout(toastT);
      if (!busy) toastT = setTimeout(() => { el.textContent = ''; el.classList.remove('dl-busy'); }, 2200);
    };

    // ---- The graph, from mermaid's own model so it matches what is drawn.
    const graph = { nodes: new Map(), edges: [], out: new Map(), in: new Map(), classes: {} };
    const titleOf = id => bare(lines(graph.nodes.get(id)?.text)[0] ?? id);
    const subOf = id => lines(graph.nodes.get(id)?.text).slice(1).join(' · ');
    const kindOf = n => n.classes.find(c => graph.classes[c]);
    function keyOf(id, depth = 0) {
      const m = plain(graph.nodes.get(id)?.text).match(/\b([A-Z]\d{1,2})\b/);
      if (m) return { key: m[1], via: null };
      if (depth > 1) return { key: null, via: null };
      for (const e of graph.in.get(id) ?? []) { const k = keyOf(e.start, depth + 1); if (k.key) return { key: k.key, via: e.start }; }
      return { key: null, via: null };
    }
    const label = id => { const k = keyOf(id); return k.key && !k.via ? k.key : id; };
    // Only a flowchart gets the full treatment; any other kind of diagram
    // (sequence, gantt, pie...) is drawn by mermaid as it is, with zoom and export.
    async function readModel() {
      let m = await opts.cache?.get('m:' + srcHash).catch(() => null);
      if (!m) {
        const d = await (await loadMermaid()).mermaidAPI.getDiagramFromText(opts.src);
        m = { flow: typeof d.db.getVertices === 'function', nodes: [], edges: [], classes: {} };
        if (m.flow) {
          const verts = d.db.getVertices();
          for (const v of (verts instanceof Map ? verts.values() : Object.values(verts))) m.nodes.push({ id: v.id, text: v.text, type: v.type, classes: v.classes ?? [] });
          m.edges = d.db.getEdges().map(e => ({ id: e.id, start: e.start, end: e.end, text: plain(e.text) }));
          const cls = d.db.getClasses();
          for (const [name, c] of (cls instanceof Map ? cls : Object.entries(cls))) {
            const stroke = (c.styles ?? []).map(s => s.match(/^stroke:\s*(#[0-9a-f]{3,8})/i)?.[1]).find(Boolean);
            if (stroke) m.classes[name] = { name, hue: stroke };
          }
        }
        opts.cache?.set('m:' + srcHash, m);
      }
      graph.flow = m.flow;
      for (const n of m.nodes) graph.nodes.set(n.id, n);
      graph.edges = m.edges;
      graph.classes = m.classes;
      for (const e of graph.edges) {
        (graph.out.get(e.start) ?? graph.out.set(e.start, []).get(e.start)).push(e);
        (graph.in.get(e.end) ?? graph.in.set(e.end, []).get(e.end)).push(e);
      }
      root.classList.toggle('dl-plain', !graph.flow);
    }
    function reach(id, dir) {
      const seen = new Map([[id, 0]]), q = [id], edges = new Set();
      while (q.length) {
        const cur = q.shift();
        for (const e of (dir === 'out' ? graph.out : graph.in).get(cur) ?? []) {
          const next = dir === 'out' ? e.end : e.start;
          edges.add(e.id);
          if (!seen.has(next)) { seen.set(next, seen.get(cur) + 1); q.push(next); }
        }
      }
      return { nodes: seen, edges };
    }

    // ---- Drawing. Mermaid lays it out; the page re-colours it, re-draws the
    // lines and their heads, and splits each label into a title and details.
    const els = { svg: null, nodes: new Map(), edges: new Map(), base: new Map(), boxes0: new Map(), boxes: new Map(), W: 0, H: 0 };
    let renders = 0, offsets = {};
    const posKey = () => `pos-${view.layout}-${view.dir}-${view.look}`;
    async function draw() {
      const font = getComputedStyle(root).fontFamily;
      const config = graph.flow
        ? { layout: view.layout, look: view.look, theme: 'base', themeVariables: { fontFamily: font, fontSize: '13.5px' }, flowchart: { padding: 16, wrappingWidth: 240, nodeSpacing: 40, rankSpacing: 56 } }
        : { theme: root.dataset.tone === 'light' ? 'default' : 'dark', themeVariables: { fontFamily: font } };
      const head = '---\nconfig:\n' + Object.entries(config).map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`).join('\n') + '\n---\n';
      const code = head + (graph.flow ? opts.src.replace(/^(\s*)(flowchart|graph)\s+\w+/m, `$1$2 ${view.dir}`) : opts.src);
      const ck = `s:${hashOf(code)}`;
      // A drawing with no size is a failed one: never kept, never reused, tried once more.
      const sized = t => typeof t === 'string' && /viewBox="[-\d.]+ [-\d.]+ [1-9]/.test(t);
      let svg = await opts.cache?.get(ck).catch(() => null);
      if (!sized(svg)) {
        try {
          const m = await loadMermaid();
          for (let i = 0; i < 2 && !sized(svg); i++) ({ svg } = await m.render(`dl${me}r${++renders}`, code));
        } catch (e) { world.innerHTML = ''; fail(e); return false; }
        if (!sized(svg)) { world.innerHTML = ''; fail(new Error('mermaid drew nothing')); return false; }
        opts.cache?.set(ck, svg);
      }
      stage.querySelector('.dl-msg')?.remove();
      world.innerHTML = svg;
      const s = world.querySelector('svg'), vb = s.viewBox.baseVal;
      s.removeAttribute('style'); s.setAttribute('width', vb.width); s.setAttribute('height', vb.height);
      Object.assign(els, { svg: s, W: vb.width, H: vb.height });
      els.nodes.clear(); els.edges.clear(); els.base.clear();
      if (!graph.flow) { els.boxes0.clear(); els.boxes.clear(); buildMini(); return true; }
      const NS = 'http://www.w3.org/2000/svg';
      for (const g of s.querySelectorAll('g.node')) {
        const m = g.id.match(/-flowchart-(.+)-\d+$/);
        if (!m || !graph.nodes.has(m[1])) continue;
        const id = m[1], n = graph.nodes.get(id), k = kindOf(n);
        g.dataset.node = id;
        if (k) { g.dataset.k = k; g.style.setProperty('--k', graph.classes[k].hue); }
        // classDef colours arrive inline and in mermaid's own id-scoped stylesheet;
        // both outrank the page, so they go and data-k carries the kind instead.
        for (const el of g.querySelectorAll('[style]')) for (const p of ['fill', 'stroke', 'color']) el.style.removeProperty(p);
        for (const c of Object.keys(graph.classes)) g.classList.remove(c);
        // A stadium becomes a card with rounder corners: a full pill wastes room around wrapped text.
        if (n.type === 'stadium' && view.look === 'classic') {
          const shape = g.querySelector(':scope > .label-container, :scope > path, :scope > g.basic');
          if (shape) {
            const b = shape.getBBox(), r = document.createElementNS(NS, 'rect');
            Object.entries({ x: b.x, y: b.y, width: b.width, height: b.height, class: 'dl-term' }).forEach(([a, v]) => r.setAttribute(a, v));
            shape.replaceWith(r);
          }
        }
        // Title line, then smaller detail lines.
        const p = g.querySelector('.nodeLabel p') ?? g.querySelector('.nodeLabel');
        if (p) {
          const parts = p.innerHTML.split(/<br\s*\/?>/i);
          p.innerHTML = `<span class="dl-t">${parts[0]}</span>` + (parts.length > 1 ? `<span class="dl-s">${parts.slice(1).join('<br>')}</span>` : '');
        }
        const t = (g.getAttribute('transform') ?? '').match(/translate\(\s*([-\d.e]+)[ ,]+([-\d.e]+)/);
        els.base.set(id, t ? { x: +t[1], y: +t[2] } : { x: 0, y: 0 });
        els.nodes.set(id, g);
      }
      // Lines: our own path through mermaid's routing points, and our own small head.
      for (const p of s.querySelectorAll('path[data-edge="true"]')) {
        let pts = null;
        try { pts = JSON.parse(atob(p.dataset.points)); } catch (e) { /* older mermaid: keep its path */ }
        p.removeAttribute('marker-end'); p.removeAttribute('marker-start');
        const head = document.createElementNS(NS, 'path');
        head.setAttribute('class', 'dl-head'); head.setAttribute('d', 'M0,0 L-8,-4 L-8,4 Z');
        p.after(head);
        // A wide, invisible twin of the line, so the pointer can find a thin line.
        const hit = document.createElementNS(NS, 'path');
        hit.setAttribute('class', 'dl-ehit');
        hit.dataset.e = p.dataset.e = head.dataset.e = p.dataset.id;
        p.before(hit);
        els.edges.set(p.dataset.id, { path: p, head, hit, pts, label: null, lpos: null });
      }
      for (const l of s.querySelectorAll('.edgeLabel .label[data-id]')) {
        const e = els.edges.get(l.dataset.id); if (!e) continue;
        e.label = l.closest('g.edgeLabel');
        e.label.dataset.e = l.dataset.id;
        const t = (e.label.getAttribute('transform') ?? '').match(/translate\(\s*([-\d.e]+)[ ,]+([-\d.e]+)/);
        e.lpos = t ? { x: +t[1], y: +t[2] } : null;
      }
      const guides = document.createElementNS(NS, 'g'); guides.setAttribute('class', 'dl-guides'); s.append(guides);
      world.classList.remove('dl-anim'); world.style.transform = 'none';
      const o = world.getBoundingClientRect();
      els.boxes0.clear();
      for (const [id, g] of els.nodes) { const r = g.getBoundingClientRect(); els.boxes0.set(id, { x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height }); }
      offsets = store.get(posKey(), {});
      placeAll();
      buildLegend();
      return true;
    }

    // ---- Positions: where each box sits after any drag, and lines that follow.
    const delta = id => offsets[id] ?? { dx: 0, dy: 0 };
    function placeNode(id) {
      const b = els.base.get(id), d = delta(id), b0 = els.boxes0.get(id);
      els.nodes.get(id).setAttribute('transform', `translate(${b.x + d.dx}, ${b.y + d.dy})`);
      els.boxes.set(id, { ...b0, x: b0.x + d.dx, y: b0.y + d.dy });
    }
    function routeEdge(id) {
      const e = els.edges.get(id); if (!e?.pts) return;
      const ge = graph.edges.find(x => x.id === id);
      const ds = delta(ge.start), de = delta(ge.end);
      let pts = e.pts;
      const moved = ds.dx || ds.dy || de.dx || de.dy;
      if (moved) {
        const a = { x: pts[0].x + ds.dx, y: pts[0].y + ds.dy }, z = { x: pts.at(-1).x + de.dx, y: pts.at(-1).y + de.dy };
        const down = view.dir === 'TD' ? z.y - a.y > 24 : z.x - a.x > 24;
        if (down) {
          // Forward in the flow: a clean elbow between the two boxes.
          if (view.dir === 'TD') { const m = (a.y + z.y) / 2; pts = [a, { x: a.x, y: m }, { x: z.x, y: m }, z]; }
          else { const m = (a.x + z.x) / 2; pts = [a, { x: m, y: a.y }, { x: m, y: z.y }, z]; }
        } else {
          // Backwards: keep mermaid's route and stretch it between the moved ends.
          let L = 0; const cum = [0];
          for (let i = 1; i < pts.length; i++) { L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); cum.push(L); }
          pts = pts.map((q, i) => { const t = L ? cum[i] / L : 0; return { x: q.x + ds.dx * (1 - t) + de.dx * t, y: q.y + ds.dy * (1 - t) + de.dy * t }; });
        }
      }
      // Pull the line back so it ends inside the head, then draw both.
      const z = pts.at(-1), y = pts.findLast?.((q, i) => i < pts.length - 1 && (q.x !== z.x || q.y !== z.y)) ?? pts.at(-2);
      const ang = Math.atan2(z.y - y.y, z.x - y.x);
      const cut = [...pts.slice(0, -1), { x: z.x - Math.cos(ang) * 6, y: z.y - Math.sin(ang) * 6 }];
      const d = view.edges === 'curved' ? basis(cut) : rounded(cut);
      e.path.setAttribute('d', d); e.hit?.setAttribute('d', d);
      e.head.setAttribute('transform', `translate(${z.x}, ${z.y}) rotate(${ang * 180 / Math.PI})`);
      if (e.label && e.lpos) {
        if (moved) { const L = e.path.getTotalLength(), m = e.path.getPointAtLength(L / 2); e.label.setAttribute('transform', `translate(${m.x}, ${m.y})`); }
        else e.label.setAttribute('transform', `translate(${e.lpos.x}, ${e.lpos.y})`);
      }
    }
    function placeAll() {
      for (const id of els.nodes.keys()) placeNode(id);
      for (const id of els.edges.keys()) routeEdge(id);
      $('[data-act="reset"]').disabled = !Object.keys(offsets).length;
      buildMini();
    }

    // ---- Camera: drag or scroll to pan, pinch or ctrl+scroll to zoom. Fitting
    // the width never shrinks text below a reading floor.
    const cam = { x: 0, y: 0, k: 1 }, READ_FLOOR = 0.85;
    const size = () => ({ w: stage.clientWidth, h: stage.clientHeight });
    function apply(anim = false) {
      world.classList.toggle('dl-anim', anim && !reduced());
      world.style.transform = `translate(${cam.x}px, ${cam.y}px) scale(${cam.k})`;
      $('.dl-pct').textContent = Math.round(cam.k * 100) + '%';
      drawMiniView();
    }
    function fitWidth(anim = true) {
      const { w } = size();
      cam.k = Math.max(READ_FLOOR, Math.min(1.15, (w - 64) / els.W));
      cam.x = els.W * cam.k < w ? (w - els.W * cam.k) / 2 : 32; cam.y = 64;
      apply(anim);
    }
    function fitAll(anim = true) {
      const { w, h } = size();
      cam.k = Math.min(1.4, (w - 64) / els.W, (h - 120) / els.H);
      cam.x = (w - els.W * cam.k) / 2; cam.y = 56 + (h - 120 - els.H * cam.k) / 2;
      apply(anim);
    }
    function fitBox(b, maxK = 1.2) {
      const { w, h } = size();
      cam.k = Math.max(READ_FLOOR, Math.min(maxK, (w - 160) / b.w, (h - 160) / b.h));
      cam.x = w / 2 - (b.x + b.w / 2) * cam.k; cam.y = h / 2 - (b.y + b.h / 2) * cam.k;
      apply(true);
    }
    const union = ids => {
      const bs = [...ids].map(id => els.boxes.get(id)).filter(Boolean);
      if (!bs.length) return null;
      const x = Math.min(...bs.map(b => b.x)), y = Math.min(...bs.map(b => b.y));
      return { x, y, w: Math.max(...bs.map(b => b.x + b.w)) - x, h: Math.max(...bs.map(b => b.y + b.h)) - y };
    };
    function centreOn(id, k = Math.max(cam.k, 1)) {
      const b = els.boxes.get(id); if (!b) return;
      const { w, h } = size();
      cam.k = k; cam.x = w / 2 - (b.x + b.w / 2) * k; cam.y = h / 2 - (b.y + b.h / 2) * k;
      apply(true);
    }
    function zoomAt(px, py, f) {
      const k = Math.min(3, Math.max(0.15, cam.k * f));
      cam.x = px - (px - cam.x) * (k / cam.k); cam.y = py - (py - cam.y) * (k / cam.k); cam.k = k;
      apply(false);
    }
    // Inside a document the wheel scrolls the document; ⌘ or ⌃ with it zooms.
    stage.addEventListener('wheel', e => {
      if (compact && !(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const r = stage.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.01));
      else { cam.x -= e.deltaX; cam.y -= e.deltaY; apply(false); }
    }, { passive: false });

    // Press on the canvas pans; press on a box and move drags the box; a press
    // that does not move is a click.
    let drag = null;
    stage.addEventListener('pointerdown', e => {
      if (e.button !== 0 || e.target.closest('.dl-float')) return;
      const node = e.target.closest('g.node')?.dataset.node;
      drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false, node, d0: node ? { ...delta(node) } : null };
    });
    const SNAP = 7;
    function guide(lines) {
      const g = els.svg?.querySelector('.dl-guides'); if (!g) return;
      g.innerHTML = lines.map(([x1, y1, x2, y2]) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`).join('');
    }
    window.addEventListener('pointermove', e => {
      if (!root.isConnected) return;
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      if (!drag.moved) { drag.moved = true; stage.classList.add(drag.node ? 'dl-dragging' : 'dl-panning'); }
      if (!drag.node) { cam.x = drag.cx + dx; cam.y = drag.cy + dy; apply(false); return; }
      // Move the box, snapping its centre to other boxes' centre lines.
      const id = drag.node, b0 = els.boxes0.get(id);
      let nx = drag.d0.dx + dx / cam.k, ny = drag.d0.dy + dy / cam.k;
      const cx = b0.x + b0.w / 2 + nx, cy = b0.y + b0.h / 2 + ny, lines = [];
      let bx = SNAP / cam.k, by = SNAP / cam.k, sx = null, sy = null;
      for (const [o, b] of els.boxes) {
        if (o === id) continue;
        const ox = b.x + b.w / 2, oy = b.y + b.h / 2;
        if (Math.abs(ox - cx) < bx) { bx = Math.abs(ox - cx); sx = { v: ox, b }; }
        if (Math.abs(oy - cy) < by) { by = Math.abs(oy - cy); sy = { v: oy, b }; }
      }
      if (sx) { nx += sx.v - cx; lines.push([sx.v, Math.min(sx.b.y, b0.y + ny), sx.v, Math.max(sx.b.y + sx.b.h, b0.y + ny + b0.h)]); }
      if (sy) { ny += sy.v - cy; lines.push([Math.min(sy.b.x, b0.x + nx), sy.v, Math.max(sy.b.x + sy.b.w, b0.x + nx + b0.w), sy.v]); }
      offsets[id] = { dx: Math.round(nx), dy: Math.round(ny) };
      placeNode(id);
      for (const ge of [...(graph.out.get(id) ?? []), ...(graph.in.get(id) ?? [])]) routeEdge(ge.id);
      guide(lines);
    });
    window.addEventListener('pointerup', e => {
      if (!root.isConnected) return;
      if (!drag) return;
      const d = drag; drag = null;
      stage.classList.remove('dl-panning', 'dl-dragging');
      if (d.moved && d.node) { guide([]); store.set(posKey(), offsets); placeAll(); modes[view.mode].refresh(); return; }
      if (d.moved) return;
      if (d.node) modes[view.mode].click(d.node, e); else modes[view.mode].background();
    });
    stage.addEventListener('dblclick', e => { if (!e.target.closest('g.node, .dl-float')) fitDefault(true); });
    stage.addEventListener('pointerover', e => {
      if (drag) return;
      const id = e.target.closest?.('g.node')?.dataset.node; if (id) return modes[view.mode].hover?.(id);
      const eid = e.target.closest?.('[data-e]')?.dataset.e; if (eid) hoverEdge(eid);
    });
    stage.addEventListener('pointerout', e => {
      if (drag) return;
      const g = e.target.closest?.('g.node'); if (g && !g.contains(e.relatedTarget)) return modes[view.mode].hover?.(null);
      const x = e.target.closest?.('[data-e]'); if (x && !e.relatedTarget?.closest?.(`[data-e="${x.dataset.e}"]`)) hoverEdge(null);
    });
    // Pointing at a line or its words lights the line and the two steps it joins,
    // on top of whatever the current way of reading shows, and names them.
    let edgeHint = '';
    function hoverEdge(id) {
      els.svg?.querySelectorAll('.dl-ehov').forEach(el => el.classList.remove('dl-ehov'));
      els.svg?.classList.toggle('dl-ehovering', !!id);
      if (hint.textContent === edgeHint) hint.textContent = '';
      edgeHint = '';
      const ge = id && graph.edges.find(x => x.id === id);
      if (!ge) return;
      const e = els.edges.get(id);
      for (const el of [e?.path, e?.head, e?.label, els.nodes.get(ge.start), els.nodes.get(ge.end)]) el?.classList.add('dl-ehov');
      edgeHint = `${titleOf(ge.start)} → ${titleOf(ge.end)}${ge.text ? `: ${ge.text}` : ''}`;
      hint.textContent = edgeHint;
    }

    // ---- Highlight: a set of steps and lines is on; the rest dims or hides.
    const mini = { el: $('.dl-mini'), s: 1, dots: [] };
    function highlight({ nodes = [], edges = [], how = 'dim', sel = [], cur = null, trail = [] } = {}) {
      const s = els.svg; if (!s) return;
      const on = new Set(nodes), onE = new Set([...edges, ...trail]), tr = new Set(trail);
      s.classList.toggle('dl-dim', how === 'dim' && on.size > 0);
      s.classList.toggle('dl-hide', how === 'hide' && on.size > 0);
      for (const [id, g] of els.nodes) { g.classList.toggle('dl-on', on.has(id)); g.classList.toggle('dl-sel', sel.includes(id)); g.classList.toggle('dl-cur', id === cur); }
      for (const [id, e] of els.edges) {
        for (const el of [e.path, e.head, e.label].filter(Boolean)) { el.classList.toggle('dl-on', onE.has(id)); el.classList.toggle('dl-trail', tr.has(id)); }
      }
      mini.dots = [...(cur ? [cur] : []), ...sel];
      drawMiniView();
    }
    const around = id => {
      const es = [...(graph.out.get(id) ?? []), ...(graph.in.get(id) ?? [])];
      return { nodes: [id, ...es.map(e => e.start), ...es.map(e => e.end)], edges: es.map(e => e.id) };
    };

    // ---- Minimap.
    function buildMini() {
      if (!els.svg) return;
      mini.s = Math.min(180 / els.W, 200 / els.H);
      const w = Math.round(els.W * mini.s), h = Math.round(els.H * mini.s);
      Object.assign(mini.el.style, { width: w + 'px', height: h + 'px' });
      const c = els.svg.cloneNode(true);
      c.setAttribute('width', w); c.setAttribute('height', h);
      c.querySelectorAll('[id]:not(svg)').forEach(n => n.removeAttribute('id'));
      mini.el.querySelector('.dl-mini-svg').replaceChildren(c);
      drawMiniView();
    }
    function drawMiniView() {
      if (!els.svg) return;
      const { w, h } = size(), s = mini.s, v = mini.el.querySelector('.dl-mini-view');
      // No map when the whole diagram is already in view: it would only cover part of it.
      const left = -cam.x / cam.k, top = -cam.y / cam.k;
      mini.el.hidden = left <= 1 && top <= 1 && left + w / cam.k >= els.W - 1 && top + h / cam.k >= els.H - 1;
      Object.assign(v.style, { left: -cam.x / cam.k * s + 'px', top: -cam.y / cam.k * s + 'px', width: w / cam.k * s + 'px', height: h / cam.k * s + 'px' });
      mini.el.querySelectorAll('.dl-mini-dot').forEach(d => d.remove());
      for (const id of mini.dots) {
        const b = els.boxes.get(id); if (!b) continue;
        const d = document.createElement('span'); d.className = 'dl-mini-dot';
        Object.assign(d.style, { left: (b.x + b.w / 2) * s + 'px', top: (b.y + b.h / 2) * s + 'px' });
        mini.el.append(d);
      }
    }
    const miniTo = e => {
      const r = mini.el.getBoundingClientRect(), { w, h } = size();
      cam.x = w / 2 - (e.clientX - r.left) / mini.s * cam.k; cam.y = h / 2 - (e.clientY - r.top) / mini.s * cam.k; apply(false);
    };
    mini.el.addEventListener('pointerdown', e => { e.stopPropagation(); mini.el.setPointerCapture(e.pointerId); miniTo(e); mini.el.onpointermove = miniTo; });
    mini.el.addEventListener('pointerup', () => { mini.el.onpointermove = null; });

    // ---- Legend, from the diagram's own classes, named from the doc's legend.
    let legendPick = null;
    const kindName = k => { const l = doc.legend.get(k); const n = l?.name ?? k; return n[0].toUpperCase() + n.slice(1).toLowerCase(); };
    function buildLegend() {
      const box = $('.dl-legend'), counts = {};
      for (const n of graph.nodes.values()) { const k = kindOf(n); if (k) counts[k] = (counts[k] ?? 0) + 1; }
      const ks = Object.values(graph.classes);
      box.hidden = !ks.length;
      box.innerHTML = ks.map(c => `<button type="button" class="dl-chip" data-cls="${esc(c.name)}" style="--k:${esc(c.hue)}" aria-pressed="${legendPick === c.name}" title="${esc(doc.legend.get(c.name)?.meaning ?? '')}"><i></i>${esc(kindName(c.name))} <em>${counts[c.name] ?? 0}</em></button>`).join('') + '<div class="dl-legend-note"></div>';
      if (legendPick) pickClass(legendPick);
    }
    function pickClass(name) {
      legendPick = name;
      root.querySelectorAll('.dl-chip').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.cls === name)));
      $('.dl-legend-note').textContent = name ? doc.legend.get(name)?.meaning ?? '' : '';
      if (!name) { modes[view.mode].refresh(); return; }
      highlight({ nodes: [...graph.nodes.values()].filter(n => kindOf(n) === name).map(n => n.id) });
    }
    $('.dl-legend').addEventListener('click', e => { const c = e.target.closest('.dl-chip'); if (c) pickClass(legendPick === c.dataset.cls ? null : c.dataset.cls); });

    // ---- Find.
    const findIn = $('.dl-find input'), findList = $('.dl-find ul');
    let found = [], foundAt = 0;
    function runFind() {
      const q = findIn.value.trim().toLowerCase();
      found = q ? [...graph.nodes.values()].filter(n => (n.id + ' ' + plain(n.text)).toLowerCase().includes(q)).slice(0, 8) : [];
      foundAt = 0; paintFind();
      if (found.length) highlight({ nodes: found.map(n => n.id) }); else modes[view.mode].refresh();
    }
    const paintFind = () => { findList.innerHTML = found.map((n, i) => `<li role="option" data-id="${esc(n.id)}" aria-selected="${i === foundAt}"><span class="dl-id">${esc(label(n.id))}</span>${esc(titleOf(n.id))}</li>`).join(''); };
    function goFound(id) { findIn.value = ''; found = []; paintFind(); findIn.blur(); modes[view.mode].go(id); }
    findIn.addEventListener('input', runFind);
    findIn.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); foundAt = (foundAt + (e.key === 'ArrowDown' ? 1 : -1) + found.length) % Math.max(1, found.length); paintFind(); }
      else if (e.key === 'Enter' && found[foundAt]) goFound(found[foundAt].id);
      else if (e.key === 'Escape') { findIn.value = ''; runFind(); findIn.blur(); }
    });
    findList.addEventListener('pointerdown', e => { const li = e.target.closest('li'); if (li) { e.preventDefault(); goFound(li.dataset.id); } });

    // ---- Panel pieces.
    function card(id) {
      const n = graph.nodes.get(id), k = kindOf(n), sub = subOf(id), mean = k && doc.legend.get(k)?.meaning;
      return `<div class="dl-card" ${k ? `style="--k:${esc(graph.classes[k].hue)}"` : ''}><div class="dl-card-top">${k ? `<i></i>${esc(kindName(k))}` : 'Step'}<span class="dl-id">${esc(label(id))}</span></div>`
        + `<h2>${esc(titleOf(id))}</h2>${sub ? `<div class="dl-sub">${esc(sub)}</div>` : ''}${mean ? `<div class="dl-mean">${esc(mean)}</div>` : ''}</div>`;
    }
    function linkList(edges, dir) {
      if (!edges.length) return '';
      return `<h3>${dir === 'out' ? 'Leads to' : 'Comes from'}</h3><ul class="dl-links">` + edges.map(e => {
        const other = dir === 'out' ? e.end : e.start;
        return `<li><button type="button" data-go="${esc(other)}"><small title="${esc(e.text)}">${esc(e.text || (dir === 'out' ? 'then' : 'after'))}</small><span>${esc(titleOf(other))}</span></button></li>`;
      }).join('') + '</ul>';
    }
    function fromDoc(id, cap) {
      if (!opts.md) return '';
      const { key, via } = keyOf(id);
      if (!key) return '';
      const rows = doc.rowsFor(key), path = doc.pathFor(key);
      if (!rows.length && !path.length) return '';
      const skip = h => /^(#|mark)$/i.test(h);
      const sec = ({ t, r }) => `<section><header><span>${esc(t.section.replace(/^[\dA-Z]+\.\s*/, ''))}</span>${opts.file ? `<a href="${esc(opts.file)}#${esc(t.anchor)}" target="_blank" rel="noopener" title="Open this part of the doc">Open</a>` : ''}</header>`
        + `<dl class="dl-kv">${r.map((c, i) => c && !skip(t.headers[i] ?? '') ? `<dt>${esc(t.headers[i] ?? '')}</dt><dd>${inline(c)}</dd>` : '').join('')}</dl></section>`;
      return `<h3>From the doc${via ? `, via ${esc(key)}` : ''}</h3><div class="dl-src">`
        + (path.length ? `<section><header><span>The path</span></header><ul class="dl-steps">${path.map(x => `<li>${inline(x)}</li>`).join('')}</ul></section>` : '')
        + rows.slice(0, cap).map(sec).join('') + '</div>'
        + (rows.length > cap ? `<button type="button" class="dl-more" data-more="1">Show ${rows.length - cap} more</button>` : '');
    }
    panel.addEventListener('click', e => {
      const go = e.target.closest('[data-go]'); if (go) return modes[view.mode].go(go.dataset.go);
      if (e.target.closest('[data-more]')) { modes[view.mode].cap = 99; modes[view.mode].panel(); }
    });

    // ---- Modes.
    const modes = {};
    const nav = { sel: null, hov: null };
    modes.navigate = {
      cap: 3,
      refresh() { const id = nav.hov ?? nav.sel, sel = [nav.sel, nav.hov].filter(Boolean); highlight(id ? { ...around(id), sel } : { sel }); hint.textContent = ''; },
      hover(id) { if (legendPick || findIn.value) return; nav.hov = id; this.refresh(); },
      click(id) { nav.sel = id; this.cap = 3; this.refresh(); this.panel(); },
      go(id) { this.click(id); centreOn(id); },
      background() { nav.sel = null; this.refresh(); this.panel(); },
      panel() {
        const id = nav.sel;
        panel.innerHTML = id
          ? card(id) + linkList(graph.out.get(id) ?? [], 'out') + linkList(graph.in.get(id) ?? [], 'in') + fromDoc(id, this.cap)
          : `<p class="dl-empty">Hover a step to see what it connects to. Click one to read about it here.</p><div class="dl-tip"><kbd>/</kbd> find · drag a box to move it · <kbd>w</kbd> fit width · <kbd>f</kbd> see it all</div>`;
      },
      enter() { this.refresh(); this.panel(); },
    };
    const foc = { sel: null, scope: store.get('scope', 'after') };
    const SCOPES = [['near', 'Next to it'], ['after', 'After'], ['before', 'Before'], ['both', 'Both ways']];
    function focusSet() {
      const id = foc.sel;
      if (foc.scope === 'near') { const a = around(id); return { nodes: new Set(a.nodes), edges: a.edges, after: (graph.out.get(id) ?? []).map(e => [e.end, 1]), before: (graph.in.get(id) ?? []).map(e => [e.start, 1]) }; }
      const none = { nodes: new Map(), edges: new Set() };
      const down = foc.scope !== 'before' ? reach(id, 'out') : none, up = foc.scope !== 'after' ? reach(id, 'in') : none;
      const sorted = m => [...m].filter(([n]) => n !== id).sort((a, b) => a[1] - b[1]);
      return { nodes: new Set([id, ...down.nodes.keys(), ...up.nodes.keys()]), edges: [...down.edges, ...up.edges], after: sorted(down.nodes), before: sorted(up.nodes) };
    }
    modes.focus = {
      cap: 3,
      refresh() {
        if (!foc.sel) { highlight({}); hint.textContent = 'Click a step to focus on it'; return; }
        hint.textContent = '';
        const f = focusSet();
        highlight({ nodes: [...f.nodes], edges: f.edges, how: 'hide', sel: [foc.sel] });
      },
      click(id) { this.go(id); },
      go(id) {
        foc.sel = id; this.cap = 3; this.refresh(); this.panel();
        const b = union(focusSet().nodes), s = els.boxes.get(id), { w, h } = size();
        if (b && Math.min((w - 160) / b.w, (h - 160) / b.h) >= READ_FLOOR) fitBox(b);
        else if (s) { cam.k = READ_FLOOR; cam.x = w / 2 - (s.x + s.w / 2) * cam.k; cam.y = h * 0.22 - (s.y + s.h / 2) * cam.k; apply(true); }
      },
      background() { foc.sel = null; this.refresh(); this.panel(); },
      panel() {
        const id = foc.sel;
        if (!id) { panel.innerHTML = `<p class="dl-empty">Click a step. Everything that does not relate to it fades, so you read only its part of the flow.</p><div class="dl-tip"><kbd>Esc</kbd> lets go</div>`; return; }
        const f = focusSet();
        const list = (xs, t) => xs.length ? `<h3>${t} · ${xs.length}</h3><ul class="dl-links">${xs.map(([n, d]) => `<li><button type="button" data-go="${esc(n)}"><small>${d === 1 ? 'next' : d + ' steps'}</small><span>${esc(titleOf(n))}</span></button></li>`).join('')}</ul>` : '';
        panel.innerHTML = card(id) + `<div class="dl-scope" role="group" aria-label="How far to follow">${SCOPES.map(([k, l]) => `<button type="button" data-scope="${k}" aria-pressed="${foc.scope === k}">${l}</button>`).join('')}</div>`
          + list(f.before, 'Before it') + list(f.after, 'After it') + fromDoc(id, this.cap);
      },
      enter() { this.refresh(); this.panel(); },
    };
    panel.addEventListener('click', e => { const s = e.target.closest('[data-scope]'); if (!s) return; foc.scope = s.dataset.scope; store.set('scope', foc.scope); modes.focus.go(foc.sel); });

    const walk = { at: null, hist: [] };
    const start = () => [...graph.nodes.keys()].find(id => !(graph.in.get(id) ?? []).length) ?? [...graph.nodes.keys()][0];
    // The main path out of a step: an unlabelled line first (a label usually
    // marks the exception), never back onto the walked path, then the branch
    // that leads on to the most steps.
    function mainChoice(id) {
      const outs = graph.out.get(id) ?? [];
      if (outs.length < 2) return 0;
      const walked = new Set(walk.hist);
      const score = e => (walked.has(e.end) ? -1e6 : 0) + (e.text ? 0 : 1e3) + reach(e.end, 'out').nodes.size;
      return outs.reduce((best, e, i) => score(e) > score(outs[best]) ? i : best, 0);
    }
    const walkEdges = () => walk.hist.map((id, i) => (graph.out.get(id) ?? []).find(e => e.end === (walk.hist[i + 1] ?? walk.at))?.id).filter(Boolean);
    modes.walkthrough = {
      cap: 2,
      refresh() {
        walk.at ??= start();
        const outs = graph.out.get(walk.at) ?? [];
        hint.textContent = '';
        highlight({ nodes: [...walk.hist, walk.at, ...outs.map(e => e.end)], edges: outs.map(e => e.id), trail: walkEdges(), cur: walk.at });
      },
      step(to, push = true) { if (push) walk.hist.push(walk.at); walk.at = to; this.cap = 2; this.refresh(); this.panel(); centreOn(to); },
      next(i = mainChoice(walk.at)) { const o = graph.out.get(walk.at) ?? []; if (o[i]) this.step(o[i].end); },
      back() { if (!walk.hist.length) return; walk.at = walk.hist.pop(); this.refresh(); this.panel(); centreOn(walk.at); },
      toChoice() { while (walk.hist.length) { this.back(); if ((graph.out.get(walk.at) ?? []).length > 1) return; } },
      restart() { walk.hist = []; walk.at = null; this.refresh(); this.panel(); centreOn(walk.at, 1); },
      click(id) { if (id === walk.at) return; const i = (graph.out.get(walk.at) ?? []).findIndex(e => e.end === id); if (i >= 0) this.next(i); else this.step(id); },
      go(id) { this.step(id); },
      background() {},
      panel() {
        const id = walk.at, outs = graph.out.get(id) ?? [], main = mainChoice(id);
        const choices = outs.length
          ? `<h3>${outs.length > 1 ? 'Choose what happens' : 'Then'}</h3><div class="dl-choices">${outs.map((e, i) => `<button type="button" class="dl-choice${outs.length > 1 && i === main ? ' dl-main-choice' : ''}" data-choice="${i}" ${outs.length > 1 && i === main ? 'title="The main path: → takes this one"' : ''}><kbd>${outs.length > 1 ? i + 1 : '→'}</kbd><span>${esc(e.text || titleOf(e.end))}${e.text ? `<small>to ${esc(titleOf(e.end))}</small>` : ''}</span></button>`).join('')}</div>`
          : `<h3>End of this path</h3><p class="dl-empty">Nothing comes after this step.</p>`;
        panel.innerHTML = `<h3 style="margin-top:0">Step ${walk.hist.length + 1}</h3>` + card(id) + choices
          + `<div class="dl-nav"><button type="button" class="dl-btn" data-walk="back" ${walk.hist.length ? '' : 'disabled'}>← Back</button><button type="button" class="dl-btn" data-walk="choice" ${walk.hist.length ? '' : 'disabled'}>Last choice</button><button type="button" class="dl-btn" data-walk="restart">Start over</button></div>`
          + fromDoc(id, this.cap)
          + `<h3>Path so far</h3><div class="dl-trailbar">${[...walk.hist, id].map((n, i, a) => `<button type="button" data-crumb="${i}" ${i === a.length - 1 ? 'aria-current="step"' : ''} title="${esc(titleOf(n))}">${esc(label(n))}</button>`).join('')}</div>`
          + `<div class="dl-tip"><kbd>→</kbd> next on the main path · <kbd>←</kbd> back · a number picks a branch</div>`;
      },
      enter() { this.refresh(); this.panel(); if (walk.at) centreOn(walk.at); },
    };
    panel.addEventListener('click', e => {
      const c = e.target.closest('[data-choice]'); if (c) return modes.walkthrough.next(+c.dataset.choice);
      const w = e.target.closest('[data-walk]');
      if (w) return ({ back: () => modes.walkthrough.back(), choice: () => modes.walkthrough.toChoice(), restart: () => modes.walkthrough.restart() })[w.dataset.walk]();
      const cr = e.target.closest('[data-crumb]');
      if (cr && +cr.dataset.crumb < walk.hist.length) { const i = +cr.dataset.crumb; walk.at = walk.hist[i]; walk.hist = walk.hist.slice(0, i); modes.walkthrough.step(walk.at, false); }
    });

    // ---- Export: the mermaid source, or the picture as it looks now.
    function snapshot() {
      const src = els.svg, c = src.cloneNode(true), a = src.querySelectorAll('*'), b = c.querySelectorAll('*');
      const props = ['fill', 'stroke', 'stroke-width', 'opacity', 'color', 'font-family', 'font-size', 'font-weight', 'line-height', 'background-color', 'border-radius', 'box-shadow', 'rx', 'ry', 'display', 'margin-top'];
      a.forEach((el, i) => { const cs = getComputedStyle(el); b[i].setAttribute('style', props.map(p => `${p}:${cs.getPropertyValue(p)}`).join(';')); });
      c.querySelectorAll('.dl-guides, .dl-ehit').forEach(n => n.remove());
      c.classList.remove('dl-dim', 'dl-hide', 'dl-ehovering');
      const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      const vb = src.viewBox.baseVal;
      Object.entries({ x: vb.x, y: vb.y, width: vb.width, height: vb.height, fill: getComputedStyle(stage).backgroundColor }).forEach(([k, v]) => bg.setAttribute(k, v));
      c.prepend(bg);
      c.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      return new XMLSerializer().serializeToString(c);
    }
    function save(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
    const fileBase = () => (opts.name ?? 'diagram').replace(/[^\w.-]+/g, '-');
    // The picture drawn onto a canvas at twice its size, for PNG and PDF.
    function canvas() {
      return new Promise((res, rej) => {
        const img = new Image(), scale = 2;
        img.onload = () => {
          const cv = document.createElement('canvas'); cv.width = Math.round(els.W * scale); cv.height = Math.round(els.H * scale);
          const ctx = cv.getContext('2d'); ctx.scale(scale, scale); ctx.drawImage(img, 0, 0, els.W, els.H);
          res(cv);
        };
        img.onerror = () => rej(new Error('the picture would not draw'));
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(snapshot());
      });
    }
    const blobOf = (cv, type, q) => new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error('the browser made no image')), type, q));
    // One PDF page the size of the picture, holding it as a JPEG. Small enough to write by hand.
    async function pdf(cv) {
      const jpg = new Uint8Array(await (await blobOf(cv, 'image/jpeg', 0.92)).arrayBuffer());
      const W = +(els.W).toFixed(2), H = +(els.H).toFixed(2), enc = new TextEncoder(), parts = [], offs = [];
      let len = 0;
      const put = p => { const b = typeof p === 'string' ? enc.encode(p) : p; parts.push(b); len += b.length; };
      const obj = (n, body) => { offs[n] = len; put(`${n} 0 obj\n`); body(); put('\nendobj\n'); };
      const draw = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
      put('%PDF-1.4\n');
      obj(1, () => put('<< /Type /Catalog /Pages 2 0 R >>'));
      obj(2, () => put('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'));
      obj(3, () => put(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`));
      obj(4, () => put(`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`));
      obj(5, () => { put(`<< /Type /XObject /Subtype /Image /Width ${cv.width} /Height ${cv.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`); put(jpg); put('\nendstream'); });
      const xref = len;
      put(`xref\n0 6\n0000000000 65535 f \n${[1, 2, 3, 4, 5].map(n => String(offs[n]).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
      return new Blob(parts, { type: 'application/pdf' });
    }
    async function exportAs(f) {
      const name = fileBase() + '.' + f, label = { svg: 'SVG', png: 'PNG', pdf: 'PDF', md: 'Markdown', txt: 'text' }[f];
      toast(`Preparing ${label}…`, true);
      await new Promise(r => requestAnimationFrame(() => setTimeout(r)));
      try {
        let blob;
        if (f === 'svg') blob = new Blob([snapshot()], { type: 'image/svg+xml' });
        else if (f === 'png') blob = await blobOf(await canvas(), 'image/png');
        else if (f === 'pdf') blob = await pdf(await canvas());
        else if (f === 'md') blob = new Blob([`${opts.name ? `# ${opts.name}\n\n` : ''}\`\`\`mermaid\n${opts.src.replace(/\n?$/, '\n')}\`\`\`\n`], { type: 'text/markdown' });
        else blob = new Blob([opts.src], { type: 'text/plain' });
        save(blob, name);
        toast(`Saved ${name}`);
      } catch (e) { toast(`${label} failed: ${e.message}. SVG still works`); }
    }
    async function act(kind) {
      if (kind === 'copy') { try { await navigator.clipboard.writeText(opts.src); toast('Mermaid copied'); } catch (e) { toast('Copy was blocked by the browser'); } return; }
      if (kind === 'reset') { offsets = {}; store.set(posKey(), offsets); placeAll(); modes[view.mode].refresh(); toast('Boxes back where the layout put them'); return; }
      if (kind === 'expand') { typeof opts.expand === 'function' ? opts.expand({ ...opts, compact: false, expand: false }) : openModal(); return; }
      if (kind === 'panel') return showPanel(root.classList.contains('dl-panel-off'));
      if (kind === 'raw') return showRaw(!root.classList.contains('dl-raw-on'));
      if (kind === 'close') return opts.onClose?.();
      opts.onTool?.(kind, root.querySelector(`[data-act="${kind}"]`));
    }
    $('.dl-acts').addEventListener('click', e => {
      const x = e.target.closest('[data-export]'); if (x) { closeMenus(); exportAs(x.dataset.export); return; }
      const b = e.target.closest('[data-act]'); if (b) act(b.dataset.act);
    });

    // Menus: one open at a time; a pick, a click elsewhere or Esc closes it.
    function closeMenus(except) {
      root.querySelectorAll('.dl-menu').forEach(m => { if (m === except) return; m.querySelector('.dl-menu-list').hidden = true; m.querySelector('.dl-menu-btn').setAttribute('aria-expanded', 'false'); });
    }
    root.addEventListener('click', e => {
      const btn = e.target.closest('.dl-menu-btn');
      if (btn) {
        const m = btn.closest('.dl-menu'), list = m.querySelector('.dl-menu-list');
        closeMenus(m); list.hidden = !list.hidden; btn.setAttribute('aria-expanded', String(!list.hidden));
        // Fixed to the window, so a short diagram's box never clips its menu.
        if (!list.hidden) {
          const r = btn.getBoundingClientRect(), w = list.offsetWidth, below = innerHeight - r.bottom > list.offsetHeight + 12;
          Object.assign(list.style, { position: 'fixed', top: (below ? r.bottom + 6 : Math.max(8, r.top - 6 - list.offsetHeight)) + 'px', left: Math.max(8, Math.min(innerWidth - w - 8, m.closest('.dl-opts') ? r.left : r.right - w)) + 'px', right: 'auto' });
        }
        return;
      }
      if (e.target.closest('.dl-menu-list [data-v]')) closeMenus();
    });
    document.addEventListener('pointerdown', e => { if (!e.target.closest?.('.dl-menu')) closeMenus(); }, true);
    document.addEventListener('scroll', () => closeMenus(), true);

    // The side panel: shown or hidden, and as wide as the reader dragged it.
    function showPanel(on) {
      root.classList.toggle('dl-panel-off', !on);
      $('[data-act="panel"]')?.setAttribute('aria-pressed', String(on));
      store.set('panel', on);
    }
    const panelW = w => { root.style.setProperty('--dl-panel', Math.round(w) + 'px'); };
    if (store.get('panelW', 0)) panelW(store.get('panelW', 320));
    if (!compact && store.get('panel', true) === false) showPanel(false);
    $('.dl-resize').addEventListener('pointerdown', e => {
      e.preventDefault();
      const r = $('.dl-main').getBoundingClientRect(), bar = e.currentTarget;
      bar.setPointerCapture(e.pointerId); root.classList.add('dl-resizing');
      const move = m => panelW(Math.max(240, Math.min(r.width * 0.6, r.right - m.clientX)));
      const up = () => { bar.removeEventListener('pointermove', move); bar.removeEventListener('pointerup', up); root.classList.remove('dl-resizing'); store.set('panelW', parseInt(root.style.getPropertyValue('--dl-panel'), 10)); };
      bar.addEventListener('pointermove', move); bar.addEventListener('pointerup', up);
    });

    // The mermaid text in place of the picture, and back.
    function showRaw(on) {
      const pre = $('.dl-raw');
      if (on) pre.textContent = opts.src;
      pre.hidden = !on;
      root.classList.toggle('dl-raw-on', on);
      const b = $('[data-act="raw"]');
      b.setAttribute('aria-pressed', String(on));
      b.title = b.ariaLabel = on ? 'Show the diagram' : 'Show the mermaid text';
    }
    function openModal() {
      const wrap = document.createElement('div'); wrap.className = 'dl-modal';
      const inner = document.createElement('div'); wrap.append(inner); document.body.append(wrap);
      const close = () => { wrap.remove(); document.removeEventListener('keydown', esc2, true); };
      const esc2 = e => { if (e.key === 'Escape' && !e.target.closest?.('input')) { e.stopPropagation(); close(); } };
      document.addEventListener('keydown', esc2, true);
      wrap.addEventListener('pointerdown', e => { if (e.target === wrap) close(); });
      mount(inner, { ...opts, compact: false, expand: false, height: '100%' });
    }

    // ---- Switching.
    function setMode(m) {
      if (!modes[m]) m = 'navigate';
      view.mode = m; store.set('mode', m);
      root.querySelectorAll('.dl-modes [data-mode]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === m)));
      legendPick = null; buildLegend(); nav.hov = null;
      modes[m].enter();
    }
    function paintOpts() {
      stage.dataset.style = view.style;
      root.querySelectorAll('[data-opt]').forEach(s => s.querySelectorAll('button[data-v]').forEach(b => b.setAttribute(b.role === 'menuitemradio' ? 'aria-checked' : 'aria-pressed', String(view[s.dataset.opt] === b.dataset.v))));
    }
    async function setOpt(opt, v) {
      view[opt] = v; store.set(opt, v); paintOpts();
      if (opt === 'style') return;
      if (opt === 'edges') { for (const id of els.edges.keys()) routeEdge(id); buildMini(); return; }
      if (await draw()) { fitDefault(false); modes[view.mode].enter(); }
    }
    root.querySelector('.dl-modes')?.addEventListener('click', e => { const b = e.target.closest('[data-mode]'); if (b) setMode(b.dataset.mode); });
    root.querySelector('.dl-opts').addEventListener('click', e => { const b = e.target.closest('[data-opt] button[data-v]'); if (b) setOpt(b.closest('[data-opt]').dataset.opt, b.dataset.v); });
    $('.dl-zoom').addEventListener('click', e => {
      const b = e.target.closest('[data-z]'); if (!b) return;
      const { w, h } = size();
      ({ in: () => zoomAt(w / 2, h / 2, 1.25), out: () => zoomAt(w / 2, h / 2, 0.8), one: () => zoomAt(w / 2, h / 2, 1 / cam.k), width: () => fitWidth(), all: () => fitAll() })[b.dataset.z]();
    });
    // Keys act on the diagram under the pointer or holding focus. Inside a
    // document they need focus, so the host page keeps its own keys.
    const onKey = e => {
      if (active !== me || !root.isConnected || e.target.closest?.('input, textarea, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (compact && !root.contains(document.activeElement)) return;
      if (root.closest('.dl-modal') == null && document.querySelector('.dl-modal')) return;
      const { w, h } = size(), k = e.key;
      const take = () => { e.preventDefault(); e.stopPropagation(); };
      if (k === 'Escape' && root.querySelector('.dl-menu-list:not([hidden])')) { take(); closeMenus(); return; }
      if (k === '/' && !compact) { take(); findIn.focus(); return; }
      if (k === 'Escape' && (legendPick || nav.sel || foc.sel)) { take(); if (legendPick) pickClass(null); else modes[view.mode].background(); return; }
      if (k === 'f') { take(); return fitAll(); }
      if (k === 'w') { take(); return fitWidth(); }
      if (k === '+' || k === '=') { take(); return zoomAt(w / 2, h / 2, 1.25); }
      if (k === '-') { take(); return zoomAt(w / 2, h / 2, 0.8); }
      if (view.mode === 'walkthrough') {
        if (k === 'ArrowRight' || k === ' ') { take(); modes.walkthrough.next(); }
        else if (k === 'ArrowLeft' || k === 'Backspace') { take(); modes.walkthrough.back(); }
        else if (/^[1-9]$/.test(k)) { take(); modes.walkthrough.next(+k - 1); }
      }
    };
    document.addEventListener('keydown', onKey, true);
    // The theme switch changes colours the minimap copied, and redraws a
    // diagram mermaid coloured itself.
    const themed = new MutationObserver(() => {
      if (!root.isConnected) return;
      const was = root.dataset.tone; tone();
      if (!graph.flow && was !== root.dataset.tone) draw().then(ok => ok && fitDefault(false));
      else buildMini();
    });
    themed.observe(host, { attributes: true, attributeFilter: ['data-theme'] });
    new ResizeObserver(() => { if (els.svg) drawMiniView(); }).observe(stage);

    // A document's diagram opens fitted, its box only as tall as the drawing
    // needs; a large one fits its width at a readable size and scrolls inside.
    function fitDefault(anim) {
      if (!compact) {
        // A diagram that fits whole at a readable size sits in the middle; a bigger one fits its width.
        const { w, h } = size(), k = Math.min(1.15, (w - 64) / els.W, (h - 120) / els.H);
        if (k < READ_FLOOR) return fitWidth(anim);
        cam.k = k; cam.x = (w - els.W * k) / 2; cam.y = 56 + (h - 120 - els.H * k) / 2;
        return apply(anim);
      }
      const w = stage.clientWidth, k = Math.max(READ_FLOOR, Math.min(1, (w - 32) / els.W));
      const h = Math.min(Math.round(els.H * k + 32), Math.round(innerHeight * 0.7));
      root.style.setProperty('--dl-height', `${h + $('.dl-top').offsetHeight + 2}px`);
      cam.k = k; cam.x = Math.max(16, (w - els.W * k) / 2); cam.y = 16;
      apply(anim);
    }
    function fail(e) {
      stage.querySelector('.dl-msg')?.remove();
      stage.insertAdjacentHTML('beforeend', `<div class="dl-msg">Could not render this diagram: ${esc(e?.message ?? e)}</div>`);
      opts.onError?.(e);
    }

    (async () => {
      try { await readModel(); }
      catch (e) { fail(e); return; }
      const sub = $('.dl-subtitle');
      const count = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
      if (sub) sub.textContent = [opts.subtitle, graph.flow ? `${count(graph.nodes.size, "step")}, ${count(graph.edges.length, "link")}` : 'Mermaid diagram'].filter(Boolean).join(' · ');
      paintOpts();
      if (await draw()) { fitDefault(false); setMode(view.mode); }
      root.dataset.ready = '1';
      opts.onReady?.(els.svg);
    })();
    return { root, setMode, setOpt, view, fit: () => fitDefault(true) };
  }

  window.MermaidLab = { mount };
})();
