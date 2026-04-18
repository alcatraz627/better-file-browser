// Better File Browser v2.2
(function () {
  const preload = document.getElementById('bfb-preload');
  if (!document.title.startsWith('Index of')) {
    if (preload) preload.remove();
    return;
  }

  // ── Path ─────────────────────────────────────────────────────────
  const rawPath = decodeURIComponent(window.location.pathname);
  const segments = rawPath.split('/').filter(Boolean);

  // ── Parse Chrome's directory listing ─────────────────────────────
  function parseEntries() {
    const table = document.querySelector('table') || document.getElementById('listing-table');
    if (!table) return [];
    return Array.from(table.querySelectorAll('tr')).slice(1).flatMap(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length < 2) return [];
      const link = cells[0]?.querySelector('a');
      if (!link) return [];
      const name = link.textContent.trim();
      const href = link.getAttribute('href');
      const rawBytes = parseInt(cells[1]?.getAttribute('data-value') ?? cells[1]?.textContent ?? '-1');
      const dateStr = cells[2]?.textContent?.trim() ?? '';
      const isParent = href === '../';
      const isDir = !isParent && (href?.endsWith('/') ?? false);
      const isHidden = !isParent && name.startsWith('.');
      return [{ name: isParent ? '..' : name, href, isDir, isParent, isHidden, rawBytes, dateStr }];
    });
  }

  function parseFetchedDoc(doc, baseUrl) {
    const table = doc.querySelector('table');
    if (!table) return [];
    return Array.from(table.querySelectorAll('tr')).slice(1).flatMap(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length < 2) return [];
      const link = cells[0]?.querySelector('a');
      if (!link) return [];
      const name = link.textContent.trim();
      const rel = link.getAttribute('href');
      if (rel === '../') return [];
      const href = new URL(rel, baseUrl).href;
      const isDir = rel?.endsWith('/') ?? false;
      const isHidden = name.startsWith('.');
      return [{ name, href, isDir, isParent: false, isHidden, rawBytes: -1, dateStr: '' }];
    });
  }

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── SVG Icon system ───────────────────────────────────────────────
  const EXT_COLORS = {
    js:'#f0db4f',mjs:'#f0db4f',cjs:'#f0db4f',
    ts:'#3178c6',tsx:'#61dafb',jsx:'#61dafb',
    html:'#e34c26',htm:'#e34c26',xml:'#e06c75',vue:'#42b883',svelte:'#ff3e00',
    css:'#264de4',scss:'#cc6699',less:'#1d365d',
    json:'#00b894',yaml:'#cc2936',yml:'#cc2936',toml:'#9c4221',
    md:'#a8b4c1',mdx:'#a8b4c1',txt:'#c0c8d0',rst:'#c0c8d0',
    py:'#3776ab',rb:'#cc342d',go:'#00add8',rs:'#dea584',
    java:'#ed8b00',kt:'#7f52ff',swift:'#f05138',dart:'#0175c2',
    sh:'#4eaa25',bash:'#4eaa25',zsh:'#4eaa25',fish:'#4eaa25',
    c:'#a8b9cc',cpp:'#00599c',h:'#a8b9cc',cs:'#239120',php:'#777bb4',r:'#276dc2',
    sql:'#e38d13',db:'#e38d13',sqlite:'#e38d13',
    pdf:'#e44c38',
    png:'#9b59b6',jpg:'#9b59b6',jpeg:'#9b59b6',gif:'#9b59b6',
    svg:'#ff9900',webp:'#9b59b6',ico:'#9b59b6',avif:'#9b59b6',
    mp4:'#e74c3c',mov:'#e74c3c',avi:'#e74c3c',mkv:'#e74c3c',webm:'#e74c3c',
    mp3:'#e67e22',wav:'#e67e22',flac:'#e67e22',ogg:'#e67e22',m4a:'#e67e22',
    zip:'#795548',tar:'#795548',gz:'#795548',rar:'#795548','7z':'#795548',
    env:'#ffd700',dockerfile:'#2496ed',lock:'#8b949e',
  };
  const IMG_EXTS = new Set(['png','jpg','jpeg','gif','svg','webp','ico','avif','bmp']);

  function icoFile(ext) {
    const c = EXT_COLORS[ext.toLowerCase()] ?? '#6e7681';
    const lbl = ext.length <= 3 ? ext.toUpperCase() : ext.slice(0,3).toUpperCase();
    return `<svg width="16" height="18" viewBox="0 0 16 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 0.5h8l5.5 5.5V17a.5.5 0 0 1-.5.5H2a.5.5 0 0 1-.5-.5V1A.5.5 0 0 1 2 0.5z" fill="${c}1a" stroke="${c}" stroke-width="1.1"/>
      <path d="M10 0.5v5.5h5.5" fill="none" stroke="${c}" stroke-width="1.1"/>
      <text x="8" y="14.5" text-anchor="middle" font-family="'SF Mono',Menlo,Consolas,monospace" font-size="4.5" font-weight="700" fill="${c}">${lbl}</text>
    </svg>`;
  }
  const SPECIAL_FOLDERS = new Set(['Desktop','Documents','Downloads','Projects','Library','Movies','Music','Pictures','Applications','Code','Public','Sites']);
  function icoFolder(name='') {
    const special = SPECIAL_FOLDERS.has(name);
    const c = special ? '#e8a838' : '#4a9eff';
    const d = special ? '#c4882a' : '#2980d9';
    return `<svg width="18" height="15" viewBox="0 0 18 15" xmlns="http://www.w3.org/2000/svg">
      <path d="M0.5 3.8A.8.8 0 0 1 1.3 3h3.9l1.7 2H17.2a.8.8 0 0 1 .8.8V13.2a.8.8 0 0 1-.8.8H1.3a.8.8 0 0 1-.8-.8z" fill="${c}"/>
      <path d="M0.5 3.8A.8.8 0 0 1 1.3 3h3.9l1.7 2H17.2a.8.8 0 0 1 .8.8V13.2a.8.8 0 0 1-.8.8H1.3a.8.8 0 0 1-.8-.8z" fill="none" stroke="${d}" stroke-width=".6"/>
    </svg>`;
  }
  function icoParent() {
    return `<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 3.5L5 8l4 4.5M5 8h9" fill="none" stroke="#6e7681" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }
  function getIcon(e) {
    if (e.isParent) return icoParent();
    if (e.isDir) return icoFolder(e.name);
    const ext = e.name.includes('.') ? e.name.split('.').pop() : '';
    return icoFile(ext || '—');
  }

  // ── Place icons (sidebar) ─────────────────────────────────────────
  const PI = {
    root:   `<svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="2" width="12" height="9" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M1 5h12" stroke="currentColor" stroke-width="1.3"/><circle cx="3.5" cy="3.5" r=".9" fill="currentColor"/><circle cx="5.8" cy="3.5" r=".9" fill="currentColor"/><path d="M3 13h8M7 11v2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
    home:   `<svg width="14" height="14" viewBox="0 0 14 14"><path d="M1 7L7 2l6 5v6H9.5V9.5h-5V13H1z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>`,
    desk:   `<svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="1.5" width="12" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M4.5 12.5h5M7 9.5v3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
    docs:   `<svg width="14" height="14" viewBox="0 0 14 14"><path d="M3.5 1h5l3 3v9h-8z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M8.5 1v3.5H11.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M5 7h4M5 9h4M5 11h2.5" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>`,
    down:   `<svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 1v9M4 7.5l3 3.5 3-3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 12.5h10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
    code:   `<svg width="14" height="14" viewBox="0 0 14 14"><path d="M4.5 4.5L2 7l2.5 2.5M9.5 4.5L12 7l-2.5 2.5M8 3l-2 8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    pics:   `<svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="2" width="12" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="4.5" cy="5.5" r="1.2" fill="currentColor" opacity=".7"/><path d="M1 10l3.5-3.5L7 9l2.5-2.5L13 10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    apps:   `<svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="1" width="5.2" height="5.2" rx="1" fill="currentColor" opacity=".5"/><rect x="7.8" y="1" width="5.2" height="5.2" rx="1" fill="currentColor" opacity=".5"/><rect x="1" y="7.8" width="5.2" height="5.2" rx="1" fill="currentColor" opacity=".5"/><rect x="7.8" y="7.8" width="5.2" height="5.2" rx="1" fill="currentColor" opacity=".5"/></svg>`,
    folder: `<svg width="14" height="14" viewBox="0 0 14 14"><path d="M1 3.5a.8.8 0 0 1 .8-.8h3l1.4 1.5H13.2a.8.8 0 0 1 .8.8V11a.8.8 0 0 1-.8.8H1.8A.8.8 0 0 1 1 11z" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>`,
    scrnsh: `<svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="2" width="12" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M4 5.5l2.5 2.5L9 4.5M5 9.5h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    bm:     `<svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 1h8v12l-4-3-4 3z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>`,
    drag:   `<svg width="10" height="14" viewBox="0 0 10 14"><circle cx="3" cy="3" r="1.2" fill="currentColor"/><circle cx="3" cy="7" r="1.2" fill="currentColor"/><circle cx="3" cy="11" r="1.2" fill="currentColor"/><circle cx="7" cy="3" r="1.2" fill="currentColor"/><circle cx="7" cy="7" r="1.2" fill="currentColor"/><circle cx="7" cy="11" r="1.2" fill="currentColor"/></svg>`,
  };

  // ── Helpers ───────────────────────────────────────────────────────
  function fmtSize(b) {
    if (b < 0 || b === 0) return '—';
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
    if (b < 1073741824) return (b/1048576).toFixed(1) + ' MB';
    return (b/1073741824).toFixed(2) + ' GB';
  }
  function fmtDate(s) {
    if (!s) return '—';
    const d = new Date(s);
    if (isNaN(d)) return s;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function fmtType(e) {
    if (e.isParent) return '';
    if (e.isDir) return 'Folder';
    if (!e.name.includes('.')) return 'File';
    return e.name.split('.').pop().toUpperCase() + ' File';
  }
  function getExt(e) {
    if (e.isDir || e.isParent) return '';
    return e.name.includes('.') ? e.name.split('.').pop().toLowerCase() : '';
  }

  // ── Storage ───────────────────────────────────────────────────────
  const BM_KEY    = 'bfb-bookmarks-v2';
  const VIEW_KEY  = 'bfb-view';
  const THEME_KEY = 'bfb-theme';
  const ZOOM_KEY  = 'bfb-zoom';
  const HIDDEN_KEY= 'bfb-show-hidden';

  function getBM()  { try { return JSON.parse(localStorage.getItem(BM_KEY) ?? '[]'); } catch { return []; } }
  function saveBM(bm) { localStorage.setItem(BM_KEY, JSON.stringify(bm)); }
  function toggleBM(path) {
    const bm = getBM();
    const idx = bm.findIndex(b => b.path === path);
    if (idx >= 0) bm.splice(idx, 1);
    else bm.unshift({ path, label: path.split('/').filter(Boolean).pop() || '/' });
    saveBM(bm); return bm;
  }
  function getView()       { return localStorage.getItem(VIEW_KEY)   ?? 'details'; }
  function getTheme()      { return localStorage.getItem(THEME_KEY)  ?? 'dark'; }
  function getZoom()       { return parseInt(localStorage.getItem(ZOOM_KEY) ?? '100'); }
  function getShowHidden() { return localStorage.getItem(HIDDEN_KEY) === 'true'; }

  // ── Finder Sidebar Favorites ──────────────────────────────────────
  const FINDER_FAVORITES = [
    { label: 'Screenshots', icon: 'scrnsh', href: 'file:///Users/alcatraz627/Pictures/Screenshots/' },
    { label: 'Downloads',   icon: 'down',   href: 'file:///Users/alcatraz627/Downloads/' },
    { label: 'Documents',   icon: 'docs',   href: 'file:///Users/alcatraz627/Documents/' },
    { label: 'Code',        icon: 'code',   href: 'file:///Users/alcatraz627/Code/' },
    { label: 'Versable',    icon: 'folder', href: 'file:///Users/alcatraz627/Code/Versable/' },
    { label: 'enhancement-product', icon:'folder', href:'file:///Users/alcatraz627/Code/Versable/enhancement-product/' },
    { label: 'Applications',icon: 'apps',   href: 'file:///Applications/' },
    { label: 'Pictures',    icon: 'pics',   href: 'file:///Users/alcatraz627/Pictures/' },
    { label: 'Desktop',     icon: 'desk',   href: 'file:///Users/alcatraz627/Desktop/' },
    { label: 'resumes',     icon: 'docs',   href: 'file:///Users/alcatraz627/Code/Claude/resumes/' },
  ];

  // ── Sort / Group / Filter state ───────────────────────────────────
  const ALL_ENTRIES = parseEntries();

  let sortConfig  = { col: null, dir: 'asc' };
  let groupConfig = 'none';   // 'none'|'folders-first'|'files-first'|'ext'|'type'
  let filterConfig = { q: '', regex: false, type: 'all' };

  function applyAll() {
    const parent = ALL_ENTRIES.filter(e => e.isParent);
    let entries  = ALL_ENTRIES.filter(e => !e.isParent);

    // 1. filter
    entries = entries.filter(e => {
      if (filterConfig.type !== 'all') {
        if (filterConfig.type === 'folders' && !e.isDir)  return false;
        if (filterConfig.type === 'files'   && e.isDir)   return false;
        if (!['all','folders','files'].includes(filterConfig.type)) {
          if (getExt(e) !== filterConfig.type) return false;
        }
      }
      if (filterConfig.q) {
        if (filterConfig.regex) {
          try { if (!new RegExp(filterConfig.q, 'i').test(e.name)) return false; }
          catch { /* invalid regex – skip filter */ }
        } else {
          if (!e.name.toLowerCase().includes(filterConfig.q.toLowerCase())) return false;
        }
      }
      return true;
    });

    // 2. sort
    if (sortConfig.col) {
      entries.sort((a, b) => {
        let va, vb;
        if      (sortConfig.col === 'name') { va = a.name.toLowerCase(); vb = b.name.toLowerCase(); }
        else if (sortConfig.col === 'size') { va = a.rawBytes; vb = b.rawBytes; }
        else if (sortConfig.col === 'date') { va = a.dateStr;  vb = b.dateStr; }
        else if (sortConfig.col === 'type') { va = fmtType(a); vb = fmtType(b); }
        else if (sortConfig.col === 'ext')  { va = getExt(a);  vb = getExt(b); }
        else return 0;
        const cmp = (typeof va === 'number')
          ? va - vb
          : String(va).localeCompare(String(vb));
        return sortConfig.dir === 'asc' ? cmp : -cmp;
      });
    }

    // 3. group
    let grouped = null;
    if (groupConfig !== 'none') {
      grouped = buildGroups(entries, groupConfig);
    }

    // 4. re-render
    const tbody = document.getElementById('fe-tbody');
    const tiles  = document.getElementById('fe-tiles');
    if (grouped) {
      tbody.innerHTML = [...parent.map(e => renderRow(e)),
        ...grouped.flatMap(g => [
          `<tr class="fe-group-hdr"><td colspan="4">${esc(g.label)}</td></tr>`,
          ...g.items.map(e => renderRow(e))
        ])
      ].join('');
      tiles.innerHTML = [...parent.map(e => renderTile(e)),
        ...grouped.flatMap(g => [
          `<div class="fe-group-hdr-tile">${esc(g.label)}</div>`,
          ...g.items.map(e => renderTile(e))
        ])
      ].join('');
    } else {
      const all = [...parent, ...entries];
      tbody.innerHTML = all.map(e => renderRow(e)).join('');
      tiles.innerHTML = all.map(e => renderTile(e)).join('');
    }

    // update search box to reflect current q (in case it was set programmatically)
    const search = document.getElementById('fe-search');
    if (search && search.value !== filterConfig.q && !filterConfig.regex) {
      // don't overwrite on every call
    }
  }

  function buildGroups(entries, mode) {
    if (mode === 'folders-first') {
      const dirs  = entries.filter(e => e.isDir);
      const files = entries.filter(e => !e.isDir);
      return [
        ...(dirs.length  ? [{ label: `Folders (${dirs.length})`,  items: dirs  }] : []),
        ...(files.length ? [{ label: `Files (${files.length})`,   items: files }] : []),
      ];
    }
    if (mode === 'files-first') {
      const dirs  = entries.filter(e => e.isDir);
      const files = entries.filter(e => !e.isDir);
      return [
        ...(files.length ? [{ label: `Files (${files.length})`,  items: files }] : []),
        ...(dirs.length  ? [{ label: `Folders (${dirs.length})`, items: dirs  }] : []),
      ];
    }
    if (mode === 'ext') {
      const map = new Map();
      entries.forEach(e => {
        const key = e.isDir ? '📁 Folders' : (getExt(e) ? `.${getExt(e)}` : 'Other');
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(e);
      });
      return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
    }
    if (mode === 'type') {
      const map = new Map();
      entries.forEach(e => {
        const key = e.isDir ? 'Folder' : fmtType(e);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(e);
      });
      return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
    }
    return [{ label: 'All', items: entries }];
  }

  // ── Render: single row / tile ─────────────────────────────────────
  function renderRow(e) {
    const tipData = buildTipData(e);
    return `<tr class="fe-row${e.isDir?' dir':''}${e.isParent?' par':''}${e.isHidden?' dotfile':''}"
               data-name="${esc(e.name.toLowerCase())}"
               data-tip="${esc(tipData)}">
      <td class="c-nm"><a href="${e.href}" class="fe-lnk">${getIcon(e)}<span class="fe-nm">${esc(e.isParent ? 'Parent Directory' : e.name)}</span></a></td>
      <td class="c-tp">${fmtType(e)}</td>
      <td class="c-sz">${e.isDir ? '—' : fmtSize(e.rawBytes)}</td>
      <td class="c-dt">${fmtDate(e.dateStr)}</td>
    </tr>`;
  }

  function renderTile(e) {
    const tipData = buildTipData(e);
    return `<a href="${e.href}" class="fe-tile${e.isDir?' dir':''}${e.isParent?' par':''}${e.isHidden?' dotfile':''}"
              data-name="${esc(e.name.toLowerCase())}"
              data-tip="${esc(tipData)}">
      <span class="fe-tile-ic">${getIcon(e)}</span>
      <span class="fe-tile-nm">${esc(e.isParent ? '..' : e.name)}</span>
      ${!e.isDir && !e.isParent ? `<span class="fe-tile-sz">${fmtSize(e.rawBytes)}</span>` : ''}
    </a>`;
  }

  function renderRows(entries)  { return entries.map(renderRow).join(''); }
  function renderTiles(entries) { return entries.map(renderTile).join(''); }

  // ── Render: Bookmark sidebar list ────────────────────────────────
  function renderBMList(bm) {
    if (!bm.length) return `<div class="fe-hint">No bookmarks.<br>Click ☆ in the path bar to add.</div>`;
    return bm.map(b => `
      <div class="fe-bm-item" draggable="true" data-path="${esc(b.path)}">
        <span class="fe-drag-h">${PI.drag}</span>
        <a href="file://${esc(b.path)}" class="fe-si-link${b.path === rawPath ? ' active' : ''}" title="${esc(b.path)}">
          ${PI.bm}<span class="fe-sl">${esc(b.label)}</span>
        </a>
        <button class="fe-rm-btn" data-path="${esc(b.path)}" title="Remove">✕</button>
      </div>`).join('');
  }

  // ── Render: Breadcrumbs with dropdown chevrons ────────────────────
  function renderCrumbs() {
    const crumbs = [{ label: '/', href: 'file:///' }];
    let acc = '/';
    for (const seg of segments) { acc += seg + '/'; crumbs.push({ label: seg, href: 'file://' + acc }); }
    return crumbs.map((c, i) =>
      `<a href="${c.href}" class="fe-crumb">${esc(c.label)}</a>` +
      `<button class="fe-crumb-dd" data-url="${esc(c.href)}" title="Browse ${esc(c.href)}">▾</button>` +
      (i < crumbs.length - 1 ? `<span class="fe-sep">›</span>` : '')
    ).join('');
  }

  // ── Build tooltip content ─────────────────────────────────────────
  function buildTipData(e) {
    if (e.isParent) return 'Parent Directory\nNavigate up one level';
    const fullPath = rawPath.replace(/\/$/, '') + '/' + e.name + (e.isDir ? '/' : '');
    const lines = [e.name, `Path: ${fullPath}`, `Type: ${fmtType(e)}`];
    if (!e.isDir) lines.push(`Size: ${fmtSize(e.rawBytes)}`);
    lines.push(`Modified: ${fmtDate(e.dateStr)}`);
    if (e.isHidden) lines.push('Hidden file (dotfile)');
    if (IMG_EXTS.has(getExt(e))) lines.push('Image — dimensions require native host');
    lines.push('\n⚠ Permissions/creation date require native host');
    return lines.join('\n');
  }

  // ── Counts ────────────────────────────────────────────────────────
  const nonPar = ALL_ENTRIES.filter(e => !e.isParent);
  const dirs   = nonPar.filter(e => e.isDir).length;
  const files  = nonPar.filter(e => !e.isDir).length;
  const hidden = nonPar.filter(e => e.isHidden).length;

  // Extension list for type filter dropdown
  const allExts = [...new Set(nonPar.filter(e => !e.isDir && getExt(e)).map(getExt))].sort();
  const extOpts = allExts.map(x => `<option value="${x}">.${x}</option>`).join('');

  // ── View mode buttons ─────────────────────────────────────────────
  const VIEW_MODES = [
    { id:'details', label:'Details',    ico:`<svg width="13" height="11" viewBox="0 0 13 11"><path d="M1 1h11M1 4h11M1 7h11M1 10h7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>` },
    { id:'list',    label:'List',       ico:`<svg width="13" height="11" viewBox="0 0 13 11"><circle cx="2" cy="2" r="1.1" fill="currentColor"/><path d="M5 2h7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="2" cy="5.5" r="1.1" fill="currentColor"/><path d="M5 5.5h7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="2" cy="9" r="1.1" fill="currentColor"/><path d="M5 9h7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>` },
    { id:'tiles',   label:'Tiles',      ico:`<svg width="13" height="13" viewBox="0 0 13 13"><rect x="1" y="1" width="4.5" height="4.5" rx=".8" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="7.5" y="1" width="4.5" height="4.5" rx=".8" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="1" y="7.5" width="4.5" height="4.5" rx=".8" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="7.5" y="7.5" width="4.5" height="4.5" rx=".8" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>` },
    { id:'icons',   label:'Large Icons',ico:`<svg width="13" height="13" viewBox="0 0 13 13"><rect x="1" y="1" width="5" height="5" rx="1" fill="currentColor" opacity=".6"/><rect x="7" y="1" width="5" height="5" rx="1" fill="currentColor" opacity=".6"/><rect x="1" y="7" width="5" height="5" rx="1" fill="currentColor" opacity=".6"/><rect x="7" y="7" width="5" height="5" rx="1" fill="currentColor" opacity=".6"/></svg>` },
  ];
  const viewBtnsHTML = VIEW_MODES.map(v =>
    `<button class="fe-view-btn" data-view="${v.id}" title="${v.label}">${v.ico}</button>`
  ).join('');

  const initZoom   = getZoom();
  const initView   = getView();
  const initTheme  = getTheme();
  const initHidden = getShowHidden();
  const initBM     = getBM();
  const curIsBookmarked = initBM.some(b => b.path === rawPath);

  // ── Page HTML ─────────────────────────────────────────────────────
  const PAGE_HTML = `
<div id="fe" data-theme="${initTheme}" data-view="${initView}">

  <div id="fe-bar">
    <div id="fe-bc">${renderCrumbs()}</div>
    <button id="fe-term-btn" title="Open in Ghostty"><svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="1" width="12" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M3.5 5l3 2-3 2M8 9h3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    <button id="fe-bm-btn" class="${curIsBookmarked?'on':''}" title="Bookmark">
      <svg width="13" height="13" viewBox="0 0 13 13"><path id="fe-bm-path" d="M2.5 1h8v11l-4-2.8L2.5 12z" fill="${curIsBookmarked?'currentColor':'none'}" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
    </button>
    <button id="fe-theme-btn" title="Toggle theme">
      <svg id="fe-sun" width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="2.8" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.9 2.9l1 1M10.1 10.1l1 1M10.1 2.9l-1 1M3.9 10.1l-1 1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
      <svg id="fe-moon" width="14" height="14" viewBox="0 0 14 14"><path d="M11.5 8.5A5 5 0 0 1 5.5 2.5a5 5 0 1 0 6 6z" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>
    </button>
  </div>

  <div id="fe-body">
    <nav id="fe-side">
      <div class="fe-sec">
        <div class="fe-sh">Bookmarks</div>
        <div id="fe-bm-list">${renderBMList(initBM)}</div>
      </div>
      <div class="fe-sec">
        <div class="fe-sh">Finder Favorites</div>
        ${FINDER_FAVORITES.map(p =>
          `<a href="${p.href}" class="fe-si${p.href.replace(/\/$/,'') === 'file://'+rawPath.replace(/\/$/,'') ?' active':''}" title="${p.href}">${PI[p.icon]??PI.folder}<span class="fe-sl">${p.label}</span></a>`
        ).join('')}
      </div>
      <div class="fe-sec">
        <div class="fe-sh">System</div>
        <a href="file:///" class="fe-si">${PI.root}<span class="fe-sl">Root /</span></a>
        <a href="file:///Users/alcatraz627/" class="fe-si">${PI.home}<span class="fe-sl">Home</span></a>
      </div>
    </nav>

    <div id="fe-main">
      <div id="fe-toolbar">
        <span id="fe-count">${dirs} folder${dirs!==1?'s':''}, ${files} file${files!==1?'s':''}</span>
        <div id="fe-tb-right">
          <button id="fe-sg-btn" title="Sort &amp; Group">
            <svg width="13" height="12" viewBox="0 0 13 12"><path d="M1 2h11M2 5h9M3.5 8h6M5.5 11h3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
            Sort
          </button>
          <button id="fe-filter-btn" title="Filter">
            <svg width="13" height="12" viewBox="0 0 13 12"><path d="M1 2h11l-4.5 5v4l-2-1V7z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
          </button>
          <button id="fe-hidden-btn" class="${initHidden?'on':''}" title="Show hidden files">
            <svg width="13" height="13" viewBox="0 0 13 13"><path d="M1 6.5C2.5 3 4.8 1.5 6.5 1.5S10.5 3 12 6.5C10.5 10 8.2 11.5 6.5 11.5S2.5 10 1 6.5z" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="6.5" cy="6.5" r="2" fill="${initHidden?'currentColor':'none'}" stroke="currentColor" stroke-width="1.3"/></svg>
          </button>
          <div id="fe-zoom-wrap" title="Zoom">
            <svg width="11" height="11" viewBox="0 0 11 11"><circle cx="4.5" cy="4.5" r="3.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M7.5 7.5L10 10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
            <input type="range" id="fe-zoom" min="50" max="320" value="${initZoom}" step="5">
            <span id="fe-zoom-val">${initZoom}%</span>
          </div>
          <div id="fe-view-group">${viewBtnsHTML}</div>
          <input id="fe-search" type="text" placeholder="Filter…" autocomplete="off" spellcheck="false"/>
        </div>
      </div>

      <!-- Sort & Group panel -->
      <div id="fe-sg-panel" style="display:none">
        <div class="fe-panel-row">
          <span class="fe-panel-lbl">Sort by</span>
          <div class="fe-btn-group" id="fe-sort-cols">
            <button class="fe-pbn active" data-col="name">Name</button>
            <button class="fe-pbn" data-col="size">Size</button>
            <button class="fe-pbn" data-col="date">Modified</button>
            <button class="fe-pbn" data-col="type">Type</button>
            <button class="fe-pbn" data-col="ext">Extension</button>
          </div>
          <button class="fe-pbn" id="fe-sort-dir" title="Direction">↑ Asc</button>
        </div>
        <div class="fe-panel-row">
          <span class="fe-panel-lbl">Group by</span>
          <div class="fe-btn-group" id="fe-group-btns">
            <button class="fe-pbn active" data-group="none">None</button>
            <button class="fe-pbn" data-group="folders-first">Folders first</button>
            <button class="fe-pbn" data-group="files-first">Files first</button>
            <button class="fe-pbn" data-group="ext">Extension</button>
            <button class="fe-pbn" data-group="type">Type</button>
          </div>
        </div>
      </div>

      <!-- Filter bar -->
      <div id="fe-filter-bar" style="display:none">
        <div class="fe-panel-row">
          <span class="fe-panel-lbl">Name</span>
          <input id="fe-filter-q" type="text" placeholder="pattern…" autocomplete="off" spellcheck="false"/>
          <button id="fe-regex-btn" class="fe-pbn" title="Toggle regex mode">.*</button>
          <span class="fe-panel-lbl" style="margin-left:12px">Type</span>
          <select id="fe-type-filter">
            <option value="all">All types</option>
            <option value="folders">Folders only</option>
            <option value="files">Files only</option>
            ${extOpts}
          </select>
        </div>
      </div>

      <div id="fe-scroll" style="zoom:${initZoom/100}">
        <table id="fe-table">
          <thead>
            <tr>
              <th class="c-nm" data-sort="name">Name <span class="si">↕</span></th>
              <th class="c-tp">Type</th>
              <th class="c-sz" data-sort="size">Size <span class="si">↕</span></th>
              <th class="c-dt" data-sort="date">Modified <span class="si">↕</span></th>
            </tr>
          </thead>
          <tbody id="fe-tbody">${renderRows(ALL_ENTRIES)}</tbody>
        </table>
        <div id="fe-tiles">${renderTiles(ALL_ENTRIES)}</div>
      </div>

      <div id="fe-statusbar">
        <span id="fe-status-text">${dirs} folder${dirs!==1?'s':''}, ${files} file${files!==1?'s':''}</span>
        <span id="fe-status-path">${rawPath}</span>
      </div>
    </div>
  </div>

  <!-- Crumb dropdown menu (shared, repositioned dynamically) -->
  <div id="fe-crumb-menu"></div>

  <div id="fe-tip"></div>
  <div id="fe-toast"></div>
</div>`;

  // ── CSS ───────────────────────────────────────────────────────────
  const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0d1117;--s1:#161b22;--s2:#1c2230;--s3:#21262d;
  --bd:#30363d;--tx:#e6edf3;--mt:#8b949e;--dm:#484f58;
  --ac:#58a6ff;--dir:#79c0ff;--gold:#d29922;--green:#3fb950;
  --hover:#21262d;--act:#1a3a5c;--r:6px;
}
#fe[data-theme="light"]{
  --bg:#ffffff;--s1:#f6f8fa;--s2:#eaeef2;--s3:#e2e8f0;
  --bd:#d0d7de;--tx:#1f2328;--mt:#656d76;--dm:#8c959f;
  --hover:#f3f4f6;--act:#dbeafe;--ac:#0969da;--dir:#0550ae;
}
html,body{height:100%;background:var(--bg);color:var(--tx);
  font:13px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;overflow:hidden}
body{opacity:1!important}
#fe{display:flex;flex-direction:column;height:100vh;background:var(--bg);color:var(--tx)}

/* ── Path bar ── */
#fe-bar{display:flex;align-items:center;gap:6px;padding:8px 14px;
  background:var(--s1);border-bottom:1px solid var(--bd);flex-shrink:0;min-height:42px}
#fe-bc{display:flex;align-items:center;gap:1px;flex:1;overflow:hidden;white-space:nowrap;min-width:0}
.fe-crumb{color:var(--mt);text-decoration:none;padding:2px 5px;border-radius:4px;
  font-size:12px;flex-shrink:0;transition:background .1s,color .1s}
.fe-crumb:last-of-type{color:var(--tx);font-weight:500}
.fe-crumb:hover{background:var(--hover);color:var(--tx)}
.fe-sep{color:var(--dm);font-size:11px;flex-shrink:0;padding:0 1px}

/* Crumb dropdown chevron */
.fe-crumb-dd{background:none;border:none;color:var(--dm);cursor:pointer;
  padding:1px 3px;font-size:10px;border-radius:3px;line-height:1;
  transition:background .1s,color .1s;flex-shrink:0}
.fe-crumb-dd:hover{background:var(--hover);color:var(--ac)}

/* Crumb dropdown menu */
#fe-crumb-menu{
  position:fixed;z-index:300;
  background:var(--s1);border:1px solid var(--bd);border-radius:var(--r);
  min-width:220px;max-width:340px;max-height:340px;overflow-y:auto;
  box-shadow:0 8px 24px #0009;display:none;
  padding:4px 0;
}
.fe-dd-item{display:flex;align-items:center;gap:8px;padding:6px 12px;
  color:var(--tx);text-decoration:none;font-size:12px;white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis;transition:background .08s}
.fe-dd-item:hover{background:var(--hover)}
.fe-dd-item.dir{color:var(--dir)}
.fe-dd-item svg{flex-shrink:0}
.fe-dd-spinner,.fe-dd-empty{padding:10px 14px;font-size:12px;color:var(--dm);font-style:italic}

#fe-bar button{background:none;border:1px solid var(--bd);color:var(--mt);cursor:pointer;
  padding:4px 8px;border-radius:var(--r);line-height:1;display:flex;align-items:center;
  justify-content:center;gap:5px;transition:all .15s;flex-shrink:0}
#fe-bar button:hover{border-color:var(--ac);color:var(--ac)}
#fe-bm-btn.on{color:var(--gold);border-color:var(--gold)}
#fe-bm-btn.on:hover{color:var(--gold)}
#fe-term-btn:hover{border-color:var(--green);color:var(--green)}
#fe-theme-btn #fe-sun{display:none}
#fe-theme-btn #fe-moon{display:block}
#fe[data-theme="light"] #fe-theme-btn #fe-sun{display:block}
#fe[data-theme="light"] #fe-theme-btn #fe-moon{display:none}

/* ── Layout ── */
#fe-body{display:flex;flex:1;overflow:hidden}

/* ── Sidebar — 1.5× size ── */
#fe-side{width:220px;flex-shrink:0;background:var(--s1);border-right:1px solid var(--bd);overflow-y:auto;padding:6px 0}
.fe-sec{margin-bottom:4px}
.fe-sh{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;
  color:var(--dm);padding:10px 14px 5px;display:flex;align-items:center;gap:6px}
.fe-si{display:flex;align-items:center;gap:10px;padding:8px 14px;
  color:var(--mt);text-decoration:none;transition:background .1s,color .1s}
.fe-si:hover{background:var(--hover);color:var(--tx)}
.fe-si.active{background:var(--act);color:var(--ac)}
.fe-si svg{flex-shrink:0;opacity:.7;width:19px;height:19px}
.fe-sl{font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fe-hint{font-size:12px;color:var(--dm);padding:6px 14px;font-style:italic;line-height:1.7}

/* ── Bookmark drag-to-reorder ── */
.fe-bm-item{display:flex;align-items:center;gap:0;position:relative;user-select:none}
.fe-drag-h{padding:7px 4px 7px 10px;color:var(--dm);cursor:grab;opacity:0;transition:opacity .1s;flex-shrink:0;display:flex;align-items:center}
.fe-bm-item:hover .fe-drag-h{opacity:1}
.fe-bm-item.dragging{opacity:.4;background:var(--hover)}
.fe-bm-item.drag-over{border-top:2px solid var(--ac)}
.fe-si-link{display:flex;align-items:center;gap:10px;flex:1;padding:7px 6px 7px 4px;
  color:var(--mt);text-decoration:none;min-width:0;transition:color .1s}
.fe-si-link:hover{color:var(--tx)}
.fe-si-link.active{color:var(--ac)}
.fe-si-link svg{flex-shrink:0;opacity:.7;width:19px;height:19px}
.fe-rm-btn{background:none;border:none;color:var(--dm);cursor:pointer;
  padding:4px 10px 4px 4px;font-size:12px;opacity:0;transition:opacity .1s,color .1s;flex-shrink:0}
.fe-bm-item:hover .fe-rm-btn{opacity:1}
.fe-rm-btn:hover{color:#f85149}

/* ── Main panel ── */
#fe-main{flex:1;display:flex;flex-direction:column;overflow:hidden}
#fe-toolbar{display:flex;align-items:center;gap:10px;padding:7px 14px;
  background:var(--s2);border-bottom:1px solid var(--bd);flex-shrink:0}
#fe-count{font-size:11px;color:var(--dm);flex:1;white-space:nowrap}
#fe-tb-right{display:flex;align-items:center;gap:6px}

#fe-toolbar button{background:none;border:1px solid var(--bd);color:var(--dm);cursor:pointer;
  padding:4px 8px;border-radius:var(--r);display:flex;align-items:center;gap:4px;
  font-size:12px;transition:all .15s}
#fe-toolbar button:hover{border-color:var(--ac);color:var(--ac)}
#fe-hidden-btn.on{border-color:var(--ac);color:var(--ac);background:var(--act)}
#fe-sg-btn.on,#fe-filter-btn.on{border-color:var(--ac);color:var(--ac);background:var(--act)}

#fe-zoom-wrap{display:flex;align-items:center;gap:5px;color:var(--dm)}
#fe-zoom{width:80px;accent-color:var(--ac);cursor:pointer}
#fe-zoom-val{font-size:10px;color:var(--dm);width:34px;text-align:right}

#fe-view-group{display:flex;gap:2px}
.fe-view-btn{background:none;border:1px solid transparent;color:var(--dm);cursor:pointer;
  padding:4px 7px;border-radius:5px;display:flex;align-items:center;transition:all .12s}
.fe-view-btn:hover{background:var(--hover);color:var(--tx)}
.fe-view-btn.active{background:var(--s3);border-color:var(--bd);color:var(--tx)}
#fe-search{background:var(--s1);border:1px solid var(--bd);color:var(--tx);
  padding:4px 10px;border-radius:var(--r);font-size:12px;width:150px;outline:none;transition:border-color .15s}
#fe-search:focus{border-color:var(--ac)}
#fe-search::placeholder{color:var(--dm)}

/* ── Sort & Group / Filter panels ── */
#fe-sg-panel,#fe-filter-bar{
  padding:8px 14px;background:var(--s1);border-bottom:1px solid var(--bd);flex-shrink:0}
.fe-panel-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.fe-panel-lbl{font-size:11px;color:var(--dm);font-weight:500;white-space:nowrap}
.fe-btn-group{display:flex;gap:4px;flex-wrap:wrap}
.fe-pbn{background:none;border:1px solid var(--bd);color:var(--dm);cursor:pointer;
  padding:3px 9px;border-radius:5px;font-size:11px;transition:all .12s;white-space:nowrap}
.fe-pbn:hover{border-color:var(--ac);color:var(--ac)}
.fe-pbn.active{background:var(--act);border-color:var(--ac);color:var(--ac)}
#fe-filter-q{background:var(--s2);border:1px solid var(--bd);color:var(--tx);
  padding:3px 8px;border-radius:var(--r);font-size:12px;width:200px;outline:none;transition:border-color .15s}
#fe-filter-q:focus{border-color:var(--ac)}
#fe-type-filter{background:var(--s2);border:1px solid var(--bd);color:var(--tx);
  padding:3px 8px;border-radius:var(--r);font-size:12px;outline:none;cursor:pointer}
#fe-regex-btn.active{background:var(--act);border-color:var(--ac);color:var(--ac)}

/* ── Scroll container ── */
#fe-scroll{flex:1;overflow-y:auto;transform-origin:top left}

/* ── Table ── */
#fe-table{width:100%;border-collapse:collapse;table-layout:fixed}
thead{position:sticky;top:0;z-index:5;background:var(--s2)}
thead th{padding:6px 12px;text-align:left;font-size:11px;font-weight:600;
  text-transform:uppercase;letter-spacing:.07em;color:var(--dm);
  border-bottom:1px solid var(--bd);user-select:none;white-space:nowrap}
thead th[data-sort]{cursor:pointer}
thead th[data-sort]:hover{color:var(--tx)}
.si{opacity:.35;font-size:10px}
th.sorted .si{opacity:1;color:var(--ac)}
.c-nm{width:46%}.c-tp{width:16%}.c-sz{width:13%;text-align:right}.c-dt{width:25%}
tbody tr{border-bottom:1px solid var(--bg);transition:background .08s}
tbody tr:hover{background:var(--hover)}
tbody td{padding:5px 12px;vertical-align:middle}
td.c-sz{text-align:right;color:var(--dm);font-variant-numeric:tabular-nums;font-size:12px}
td.c-dt{color:var(--dm);font-size:12px}
td.c-tp{color:var(--dm);font-size:11px}
.fe-lnk{display:flex;align-items:center;gap:8px;text-decoration:none;color:var(--tx)}
.fe-lnk svg{flex-shrink:0}
.fe-lnk:hover .fe-nm{color:var(--ac);text-decoration:underline}
.fe-nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dir .fe-nm{color:var(--dir)}
.par td.c-nm .fe-nm{color:var(--dm)}
.par:hover .fe-nm{color:var(--mt)}
.dotfile{opacity:.65}

/* Group header rows */
.fe-group-hdr td{padding:5px 12px;font-size:10.5px;font-weight:600;
  text-transform:uppercase;letter-spacing:.08em;color:var(--dm);
  background:var(--s2);border-bottom:1px solid var(--bd);border-top:1px solid var(--bd)}
.fe-group-hdr-tile{width:100%;padding:6px 4px 2px;font-size:10.5px;font-weight:600;
  text-transform:uppercase;letter-spacing:.08em;color:var(--dm)}

/* Hidden files toggle */
#fe:not(.show-hidden) .fe-row.dotfile,
#fe:not(.show-hidden) .fe-tile.dotfile{display:none!important}

/* List view */
#fe[data-view="list"] .c-tp,#fe[data-view="list"] .c-sz,#fe[data-view="list"] .c-dt{display:none}
#fe[data-view="list"] .c-nm{width:100%}
#fe[data-view="list"] tbody td{padding:4px 12px}

/* Tiles / Icons */
#fe-tiles{display:none;flex-wrap:wrap;gap:6px;padding:12px;align-content:flex-start}
#fe[data-view="tiles"] #fe-table,#fe[data-view="icons"] #fe-table{display:none}
#fe[data-view="tiles"] #fe-tiles,#fe[data-view="icons"] #fe-tiles{display:flex}
.fe-tile{display:flex;flex-direction:column;align-items:center;gap:5px;
  padding:10px 8px 8px;border-radius:var(--r);text-decoration:none;
  color:var(--tx);border:1px solid transparent;transition:all .12s;
  width:90px;overflow:hidden;cursor:pointer}
.fe-tile:hover{background:var(--hover);border-color:var(--bd)}
.fe-tile-ic{font-size:0;line-height:0}
.fe-tile-ic svg{display:block}
.fe-tile-nm{font-size:11px;text-align:center;word-break:break-all;
  overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
  line-height:1.3}
.fe-tile-sz{font-size:10px;color:var(--dm)}
.fe-tile.dir .fe-tile-nm{color:var(--dir)}
.fe-tile.par .fe-tile-nm{color:var(--dm)}
#fe[data-view="tiles"] .fe-tile-ic svg{transform:scale(1.5);margin:4px}
#fe[data-view="icons"] .fe-tile{width:110px;padding:14px 8px 10px}
#fe[data-view="icons"] .fe-tile-ic svg{transform:scale(2.2);margin:10px}
#fe[data-view="icons"] .fe-tile-nm{font-size:12px}

/* ── Status bar ── */
#fe-statusbar{display:flex;justify-content:space-between;padding:4px 14px;
  background:var(--s1);border-top:1px solid var(--bd);flex-shrink:0;font-size:11px;color:var(--dm)}

/* ── Tooltip — wrap long paths ── */
#fe-tip{
  position:fixed;pointer-events:none;z-index:200;
  background:var(--s2);border:1px solid var(--bd);border-radius:var(--r);
  padding:9px 12px;font-size:11.5px;line-height:1.7;color:var(--tx);
  max-width:380px;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;
  box-shadow:0 4px 16px #0008;opacity:0;transition:opacity .12s;
}
#fe-tip.show{opacity:1}
#fe-tip .tip-name{font-weight:600;font-size:12px;margin-bottom:2px;word-break:break-all}
#fe-tip .tip-warn{color:var(--dm);font-size:10.5px;margin-top:3px}

/* ── Toast ── */
#fe-toast{
  position:fixed;bottom:32px;left:50%;transform:translateX(-50%) translateY(6px);
  background:#1f2937;color:#e5e7eb;padding:8px 18px;border-radius:20px;
  font-size:12px;opacity:0;transition:all .22s;pointer-events:none;white-space:nowrap;
  border:1px solid #374151;z-index:200
}
#fe-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}

/* ── Scrollbar ── */
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--bd);border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:var(--dm)}
`;

  // ── Inject ────────────────────────────────────────────────────────
  document.title = `📁 ${segments[segments.length-1] || '/'}`;
  document.head.innerHTML = `<meta charset="utf-8"><title>${document.title}</title>`;
  document.body.innerHTML = PAGE_HTML;
  const styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);
  if (preload) preload.remove();

  const fe = document.getElementById('fe');

  function toast(msg, ms = 2400) {
    const t = document.getElementById('fe-toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._tid);
    t._tid = setTimeout(() => t.classList.remove('show'), ms);
  }

  // ── Active view buttons ───────────────────────────────────────────
  document.querySelectorAll('.fe-view-btn').forEach(btn => {
    if (btn.dataset.view === initView) btn.classList.add('active');
    btn.addEventListener('click', () => {
      document.querySelectorAll('.fe-view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      fe.dataset.view = btn.dataset.view;
      localStorage.setItem(VIEW_KEY, btn.dataset.view);
    });
  });

  // ── Hidden files ──────────────────────────────────────────────────
  const hiddenBtn = document.getElementById('fe-hidden-btn');
  if (initHidden) fe.classList.add('show-hidden');
  hiddenBtn.addEventListener('click', () => {
    const on = fe.classList.toggle('show-hidden');
    hiddenBtn.classList.toggle('on', on);
    localStorage.setItem(HIDDEN_KEY, on);
    toast(on ? `Showing ${hidden} hidden file${hidden!==1?'s':''}` : 'Hidden files concealed');
  });

  // ── Zoom slider (max 320 = 2× previous 160) ───────────────────────
  const zoomEl  = document.getElementById('fe-zoom');
  const zoomVal = document.getElementById('fe-zoom-val');
  const scroll  = document.getElementById('fe-scroll');
  zoomEl.addEventListener('input', () => {
    const z = parseInt(zoomEl.value);
    scroll.style.zoom = z / 100;
    zoomVal.textContent = z + '%';
    localStorage.setItem(ZOOM_KEY, z);
  });

  // ── Column sort (header clicks) ───────────────────────────────────
  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (sortConfig.col === col) {
        sortConfig.dir = sortConfig.dir === 'asc' ? 'desc' : 'asc';
      } else {
        sortConfig.col = col; sortConfig.dir = 'asc';
      }
      // sync sort panel button state
      document.querySelectorAll('#fe-sort-cols .fe-pbn').forEach(b => b.classList.toggle('active', b.dataset.col === col));
      document.getElementById('fe-sort-dir').textContent = sortConfig.dir === 'asc' ? '↑ Asc' : '↓ Desc';
      document.querySelectorAll('th[data-sort]').forEach(h => {
        h.classList.remove('sorted');
        h.querySelector('.si').textContent = '↕';
      });
      th.classList.add('sorted');
      th.querySelector('.si').textContent = sortConfig.dir === 'asc' ? '↑' : '↓';
      applyAll();
    });
  });

  // ── Sort & Group panel ────────────────────────────────────────────
  const sgPanel = document.getElementById('fe-sg-panel');
  document.getElementById('fe-sg-btn').addEventListener('click', () => {
    const open = sgPanel.style.display === 'none';
    sgPanel.style.display = open ? '' : 'none';
    document.getElementById('fe-sg-btn').classList.toggle('on', open);
  });

  document.querySelectorAll('#fe-sort-cols .fe-pbn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (sortConfig.col === btn.dataset.col) {
        sortConfig.dir = sortConfig.dir === 'asc' ? 'desc' : 'asc';
      } else {
        sortConfig.col = btn.dataset.col; sortConfig.dir = 'asc';
      }
      document.querySelectorAll('#fe-sort-cols .fe-pbn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('fe-sort-dir').textContent = sortConfig.dir === 'asc' ? '↑ Asc' : '↓ Desc';
      applyAll();
    });
  });

  document.getElementById('fe-sort-dir').addEventListener('click', () => {
    sortConfig.dir = sortConfig.dir === 'asc' ? 'desc' : 'asc';
    document.getElementById('fe-sort-dir').textContent = sortConfig.dir === 'asc' ? '↑ Asc' : '↓ Desc';
    applyAll();
  });

  document.querySelectorAll('#fe-group-btns .fe-pbn').forEach(btn => {
    btn.addEventListener('click', () => {
      groupConfig = btn.dataset.group;
      document.querySelectorAll('#fe-group-btns .fe-pbn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyAll();
    });
  });

  // ── Filter bar ────────────────────────────────────────────────────
  const filterBar = document.getElementById('fe-filter-bar');
  document.getElementById('fe-filter-btn').addEventListener('click', () => {
    const open = filterBar.style.display === 'none';
    filterBar.style.display = open ? '' : 'none';
    document.getElementById('fe-filter-btn').classList.toggle('on', open);
    if (open) document.getElementById('fe-filter-q').focus();
  });

  document.getElementById('fe-filter-q').addEventListener('input', function () {
    filterConfig.q = this.value;
    applyAll();
  });

  document.getElementById('fe-regex-btn').addEventListener('click', function () {
    filterConfig.regex = !filterConfig.regex;
    this.classList.toggle('active', filterConfig.regex);
    this.title = filterConfig.regex ? 'Regex mode on' : 'Toggle regex mode';
    applyAll();
  });

  document.getElementById('fe-type-filter').addEventListener('change', function () {
    filterConfig.type = this.value;
    applyAll();
  });

  // ── Search bar (quick name filter, delegates to applyAll) ─────────
  document.getElementById('fe-search').addEventListener('input', function () {
    filterConfig.q = this.value;
    // also sync the filter bar input
    const fq = document.getElementById('fe-filter-q');
    if (fq) fq.value = this.value;
    applyAll();
  });

  // ── Bookmark toggle ───────────────────────────────────────────────
  document.getElementById('fe-bm-btn').addEventListener('click', function () {
    const newBm = toggleBM(rawPath);
    const on = newBm.some(b => b.path === rawPath);
    this.classList.toggle('on', on);
    document.getElementById('fe-bm-path').setAttribute('fill', on ? 'currentColor' : 'none');
    document.getElementById('fe-bm-list').innerHTML = renderBMList(newBm);
    attachBMEvents();
    toast(on ? 'Bookmarked' : 'Bookmark removed');
  });

  // ── Theme toggle ──────────────────────────────────────────────────
  document.getElementById('fe-theme-btn').addEventListener('click', () => {
    const next = fe.dataset.theme === 'dark' ? 'light' : 'dark';
    fe.dataset.theme = next;
    localStorage.setItem(THEME_KEY, next);
  });

  // ── Ghostty terminal ──────────────────────────────────────────────
  document.getElementById('fe-term-btn').addEventListener('click', () => {
    try {
      const port = chrome.runtime.connectNative('com.better_file_browser.ghostty');
      port.postMessage({ action: 'open_terminal', path: rawPath });
      port.onDisconnect.addListener(() => {
        if (chrome.runtime.lastError) fallbackCopy(rawPath);
      });
    } catch { fallbackCopy(rawPath); }
  });
  function fallbackCopy(path) {
    navigator.clipboard.writeText(path).catch(() => {});
    toast(`Path copied  —  open -a Ghostty "${path}"`);
  }

  // ── Tooltip ───────────────────────────────────────────────────────
  const tip = document.getElementById('fe-tip');
  let tipTimeout;
  document.getElementById('fe-scroll').addEventListener('mousemove', e => {
    const target = e.target.closest('[data-tip]');
    if (!target) { hideTip(); return; }
    clearTimeout(tipTimeout);
    tipTimeout = setTimeout(() => showTip(target, e), 300);
  });
  document.getElementById('fe-scroll').addEventListener('mouseleave', hideTip);
  function showTip(el, e) {
    const raw = el.getAttribute('data-tip') ?? '';
    const lines = raw.split('\n');
    const name = lines[0] ?? '';
    const rest = lines.slice(1).filter(l => !l.startsWith('⚠'));
    const warn = lines.find(l => l.startsWith('⚠')) ?? '';
    tip.innerHTML = `<div class="tip-name">${esc(name)}</div>${rest.map(l=>`<div>${esc(l)}</div>`).join('')}${warn?`<div class="tip-warn">${esc(warn)}</div>`:''}`;
    tip.classList.add('show');
    positionTip(e);
  }
  function hideTip() { clearTimeout(tipTimeout); tip.classList.remove('show'); }
  document.addEventListener('mousemove', e => { if (tip.classList.contains('show')) positionTip(e); });
  function positionTip(e) {
    const vw = window.innerWidth, vh = window.innerHeight;
    const tw = tip.offsetWidth || 280, th = tip.offsetHeight || 100;
    let x = e.clientX + 14, y = e.clientY + 14;
    if (x + tw > vw - 8) x = e.clientX - tw - 10;
    if (y + th > vh - 8) y = e.clientY - th - 10;
    tip.style.left = x + 'px';
    tip.style.top  = y + 'px';
  }

  // ── Crumb dropdown (async directory listing) ──────────────────────
  const crumbMenu = document.getElementById('fe-crumb-menu');
  let crumbMenuUrl = null;

  document.getElementById('fe-bc').addEventListener('click', async e => {
    const btn = e.target.closest('.fe-crumb-dd');
    if (!btn) return;
    e.preventDefault(); e.stopPropagation();
    const url = btn.dataset.url;

    if (crumbMenu.style.display !== 'none' && crumbMenuUrl === url) {
      closeCrumbMenu(); return;
    }

    const rect = btn.getBoundingClientRect();
    crumbMenu.style.left = Math.min(rect.left, window.innerWidth - 260) + 'px';
    crumbMenu.style.top  = (rect.bottom + 4) + 'px';
    crumbMenu.style.display = 'block';
    crumbMenu.innerHTML = '<div class="fe-dd-spinner">Loading…</div>';
    crumbMenuUrl = url;

    try {
      const res  = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      if (crumbMenuUrl !== url) return;
      const doc     = new DOMParser().parseFromString(text, 'text/html');
      const entries = parseFetchedDoc(doc, url);
      if (!entries.length) {
        crumbMenu.innerHTML = '<div class="fe-dd-empty">Empty folder</div>'; return;
      }
      crumbMenu.innerHTML = entries.map(e =>
        `<a href="${esc(e.href)}" class="fe-dd-item${e.isDir?' dir':''}">${getIcon(e)}<span>${esc(e.name)}</span></a>`
      ).join('');
    } catch {
      if (crumbMenuUrl === url)
        crumbMenu.innerHTML = '<div class="fe-dd-empty">Cannot load directory</div>';
    }
  });

  document.addEventListener('click', e => {
    if (!crumbMenu.contains(e.target) && !e.target.classList.contains('fe-crumb-dd'))
      closeCrumbMenu();
  });
  function closeCrumbMenu() { crumbMenu.style.display = 'none'; crumbMenuUrl = null; }

  // ── Bookmark drag-to-reorder ──────────────────────────────────────
  let dragSrc = null;
  function attachBMEvents() {
    const bmList = document.getElementById('fe-bm-list');
    bmList.querySelectorAll('.fe-rm-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation(); e.preventDefault();
        const bm = getBM().filter(b => b.path !== btn.dataset.path);
        saveBM(bm);
        bmList.innerHTML = renderBMList(bm);
        attachBMEvents();
        toast('Bookmark removed');
      });
    });
    bmList.querySelectorAll('.fe-bm-item').forEach(item => {
      item.addEventListener('dragstart', e => {
        dragSrc = item; e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => item.classList.add('dragging'), 0);
      });
      item.addEventListener('dragend', () => item.classList.remove('dragging'));
      item.addEventListener('dragover', e => { e.preventDefault(); item.classList.add('drag-over'); });
      item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
      item.addEventListener('drop', e => {
        e.stopPropagation(); e.preventDefault();
        item.classList.remove('drag-over');
        if (!dragSrc || dragSrc === item) return;
        const bm = getBM();
        const fi = bm.findIndex(b => b.path === dragSrc.dataset.path);
        const ti = bm.findIndex(b => b.path === item.dataset.path);
        if (fi >= 0 && ti >= 0) {
          const [moved] = bm.splice(fi, 1);
          bm.splice(ti, 0, moved);
          saveBM(bm);
          bmList.innerHTML = renderBMList(bm);
          attachBMEvents();
        }
      });
    });
  }
  attachBMEvents();

})();
