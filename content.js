// Better File Browser v2.0 — content.js
(function () {
  const preload = document.getElementById('bfb-preload');

  if (!document.title.startsWith('Index of')) {
    if (preload) preload.remove();
    return;
  }

  // ── Path ─────────────────────────────────────────────────────────
  const rawPath = decodeURIComponent(window.location.pathname);
  const segments = rawPath.split('/').filter(Boolean);
  const homeUser = segments[0] === 'Users' && segments[1] ? segments[1] : null;

  // ── Parse Chrome's directory listing table ────────────────────────
  // Chrome emits <td data-value="..."> for sortable values
  function parseEntries() {
    const table = document.querySelector('table');
    if (!table) return [];
    return Array.from(table.querySelectorAll('tbody tr')).flatMap(row => {
      const cells = row.querySelectorAll('td');
      const link = cells[0]?.querySelector('a');
      if (!link) return [];
      const name = link.textContent.trim();
      const href = link.getAttribute('href');
      const rawBytes = parseInt(cells[1]?.getAttribute('data-value') ?? '-1');
      const dateStr = cells[2]?.textContent?.trim() ?? '';
      const isParent = href === '../';
      const isDir = !isParent && (href?.endsWith('/') ?? false);
      return [{ name: isParent ? '..' : name, href, isDir, isParent, rawBytes, dateStr }];
    });
  }

  // ── Icons — inline SVG ────────────────────────────────────────────
  const EXT_COLORS = {
    js:'#f0db4f', mjs:'#f0db4f', cjs:'#f0db4f',
    ts:'#3178c6', tsx:'#61dafb', jsx:'#61dafb',
    html:'#e34c26', htm:'#e34c26', xml:'#e06c75',
    css:'#264de4', scss:'#cc6699', less:'#1d365d',
    json:'#00b894', yaml:'#cc2936', yml:'#cc2936', toml:'#9c4221',
    md:'#a8b4c1', mdx:'#a8b4c1', txt:'#c0c8d0',
    py:'#3776ab', rb:'#cc342d', go:'#00add8', rs:'#dea584',
    java:'#ed8b00', kt:'#7f52ff', swift:'#f05138',
    sh:'#4eaa25', bash:'#4eaa25', zsh:'#4eaa25',
    c:'#a8b9cc', cpp:'#00599c', cs:'#239120', php:'#777bb4',
    sql:'#e38d13', db:'#e38d13',
    pdf:'#e44c38',
    png:'#9b59b6', jpg:'#9b59b6', jpeg:'#9b59b6', gif:'#9b59b6',
    svg:'#ff9900', webp:'#9b59b6', ico:'#9b59b6',
    mp4:'#e74c3c', mov:'#e74c3c', mkv:'#e74c3c',
    mp3:'#e67e22', wav:'#e67e22', flac:'#e67e22',
    zip:'#795548', tar:'#795548', gz:'#795548', rar:'#795548',
    env:'#ffd700', dockerfile:'#2496ed',
  };

  function icoFile(ext) {
    const c = EXT_COLORS[ext.toLowerCase()] ?? '#8b949e';
    const lbl = ext.length <= 3 ? ext.toUpperCase() : ext.slice(0,3).toUpperCase();
    return `<svg width="16" height="18" viewBox="0 0 16 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 0h8l6 5.5V17a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V1a1 1 0 0 1 1-1z" fill="${c}22" stroke="${c}" stroke-width="1.1"/>
      <path d="M10 0v5.5h6" fill="none" stroke="${c}" stroke-width="1.1"/>
      <text x="8" y="14.5" text-anchor="middle" font-family="'SF Mono',Menlo,monospace" font-size="4.8" font-weight="700" fill="${c}">${lbl}</text>
    </svg>`;
  }
  function icoFolder(special) {
    const c = special ? '#e8a838' : '#4a9eff';
    const d = special ? '#c4882a' : '#2980d9';
    return `<svg width="18" height="15" viewBox="0 0 18 15" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 3.5A1 1 0 0 1 2 2.5h3.86l1.57 1.75H17a1 1 0 0 1 1 1v8.25a1 1 0 0 1-1 1H1a1 1 0 0 1-1-1z" fill="${c}"/>
      <path d="M1 3.5A1 1 0 0 1 2 2.5h3.86l1.57 1.75H17a1 1 0 0 1 1 1v8.25a1 1 0 0 1-1 1H1a1 1 0 0 1-1-1z" fill="none" stroke="${d}" stroke-width=".7"/>
    </svg>`;
  }
  function icoParent() {
    return `<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
      <path d="M9.5 3L5 8l4.5 5M5 8h9" fill="none" stroke="#6e7681" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  const SPECIAL_FOLDERS = new Set(['Desktop','Documents','Downloads','Projects','Library','Movies','Music','Pictures']);

  function getIcon(e) {
    if (e.isParent) return icoParent();
    if (e.isDir) return icoFolder(SPECIAL_FOLDERS.has(e.name));
    const ext = e.name.includes('.') ? e.name.split('.').pop() : '';
    return icoFile(ext || 'bin');
  }

  // ── Place SVG icons ───────────────────────────────────────────────
  const PI = {
    root: `<svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="2" width="12" height="9" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M1 5.5h12" stroke="currentColor" stroke-width="1.3"/><circle cx="3.5" cy="3.8" r=".9" fill="currentColor"/><circle cx="5.8" cy="3.8" r=".9" fill="currentColor"/><path d="M3 13h8M7 11v2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
    home: `<svg width="14" height="14" viewBox="0 0 14 14"><path d="M1 7L7 2l6 5v6H9.5V9.5h-5V13H1z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>`,
    desktop: `<svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="1.5" width="12" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M4.5 12.5h5M7 9.5v3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
    docs: `<svg width="14" height="14" viewBox="0 0 14 14"><path d="M3.5 1h5l3 3v9h-8z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M8.5 1v3.5H11.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M5 7h4M5 9h4M5 11h2.5" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>`,
    down: `<svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 1v9M4 7.5l3 3.5 3-3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 12.5h10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
    projects: `<svg width="14" height="14" viewBox="0 0 14 14"><path d="M1 5.5A1 1 0 0 1 2 4.5h2.8l1.2 1.5H12a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M1 3a1 1 0 0 1 1-1h2.5l1.2 1.5" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>`,
    bm: `<svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 1h8v12l-4-3-4 3z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>`,
    term: `<svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="1" width="12" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M3.5 5l3 2-3 2M8 9h3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  };

  // ── Helpers ───────────────────────────────────────────────────────
  function fmtSize(b) {
    if (b < 0) return '—';
    if (b === 0) return '—';
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
    return (b / 1073741824).toFixed(2) + ' GB';
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
    const ext = e.name.includes('.') ? e.name.split('.').pop().toUpperCase() : '—';
    return ext + ' File';
  }

  // ── Storage ───────────────────────────────────────────────────────
  const BM_KEY = 'bfb-bookmarks-v2';
  const VIEW_KEY = 'bfb-view';
  const THEME_KEY = 'bfb-theme';

  function getBM() { try { return JSON.parse(localStorage.getItem(BM_KEY) ?? '[]'); } catch { return []; } }
  function saveBM(bm) { localStorage.setItem(BM_KEY, JSON.stringify(bm)); }
  function toggleBM(path) {
    const bm = getBM();
    const idx = bm.findIndex(b => b.path === path);
    if (idx >= 0) bm.splice(idx, 1);
    else bm.unshift({ path, label: path.split('/').filter(Boolean).pop() || '/' });
    saveBM(bm); return bm;
  }
  function getView() { return localStorage.getItem(VIEW_KEY) ?? 'details'; }
  function getTheme() { return localStorage.getItem(THEME_KEY) ?? 'dark'; }

  // ── Build HTML ────────────────────────────────────────────────────
  const entries = parseEntries();
  const bm = getBM();
  const curIsBookmarked = bm.some(b => b.path === rawPath);
  const base = homeUser ? `/Users/${homeUser}` : null;

  const QUICK_PLACES = [
    { label: 'Root', icon: 'root', href: 'file:///' },
    ...(homeUser ? [
      { label: 'Home',      icon: 'home',     href: `file://${base}/` },
      { label: 'Desktop',   icon: 'desktop',  href: `file://${base}/Desktop/` },
      { label: 'Documents', icon: 'docs',     href: `file://${base}/Documents/` },
      { label: 'Downloads', icon: 'down',     href: `file://${base}/Downloads/` },
      { label: 'Projects',  icon: 'projects', href: `file://${base}/Projects/` },
    ] : []),
  ];

  function renderBMList(bm) {
    if (!bm.length) return `<div class="fe-hint">No bookmarks.<br>Click ☆ to add current folder.</div>`;
    return bm.map(b => `<a href="file://${b.path}" class="fe-si${b.path === rawPath ? ' active' : ''}" title="${b.path}">
      ${PI.bm}<span class="fe-sl">${b.label}</span>
    </a>`).join('');
  }

  function renderCrumbs() {
    const crumbs = [{ label: '/', href: 'file:///' }];
    let acc = '/';
    for (const seg of segments) { acc += seg + '/'; crumbs.push({ label: seg, href: 'file://' + acc }); }
    return crumbs.map((c, i) =>
      `<a href="${c.href}" class="fe-crumb">${c.label}</a>` +
      (i < crumbs.length - 1 ? `<span class="fe-sep">›</span>` : '')
    ).join('');
  }

  function renderRows() {
    return entries.map(e => {
      const icon = getIcon(e);
      const name = e.isParent ? 'Parent Directory' : e.name;
      return `<tr class="fe-row${e.isDir?' dir':''}${e.isParent?' par':''}" data-name="${name.toLowerCase()}">
        <td class="c-nm"><a href="${e.href}" class="fe-lnk">${icon}<span class="fe-nm">${name}</span></a></td>
        <td class="c-tp">${fmtType(e)}</td>
        <td class="c-sz">${e.isDir ? '—' : fmtSize(e.rawBytes)}</td>
        <td class="c-dt">${fmtDate(e.dateStr)}</td>
      </tr>`;
    }).join('');
  }

  function renderTiles() {
    return entries.map(e => {
      const icon = getIcon(e);
      const name = e.isParent ? '..' : e.name;
      return `<a href="${e.href}" class="fe-tile${e.isDir?' dir':''}${e.isParent?' par':''}" data-name="${name.toLowerCase()}">
        <span class="fe-tile-ic">${icon}</span>
        <span class="fe-tile-nm">${name}</span>
        ${!e.isDir && !e.isParent ? `<span class="fe-tile-sz">${fmtSize(e.rawBytes)}</span>` : ''}
      </a>`;
    }).join('');
  }

  const nonParent = entries.filter(e => !e.isParent);
  const dirs = nonParent.filter(e => e.isDir).length;
  const files = nonParent.filter(e => !e.isDir).length;
  const countLabel = [dirs && `${dirs} folder${dirs>1?'s':''}`, files && `${files} file${files>1?'s':''}`].filter(Boolean).join(', ');

  const VIEW_MODES = [
    { id: 'details', label: 'Details',    icon: `<svg width="13" height="13" viewBox="0 0 13 13"><path d="M1 2h11M1 5.5h11M1 9h11M1 12.5h7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>` },
    { id: 'list',    label: 'List',       icon: `<svg width="13" height="13" viewBox="0 0 13 13"><circle cx="2" cy="2.5" r="1" fill="currentColor"/><path d="M5 2.5h7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="2" cy="6.5" r="1" fill="currentColor"/><path d="M5 6.5h7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="2" cy="10.5" r="1" fill="currentColor"/><path d="M5 10.5h7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>` },
    { id: 'tiles',   label: 'Tiles',      icon: `<svg width="13" height="13" viewBox="0 0 13 13"><rect x="1" y="1" width="4.5" height="4.5" rx=".8" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="7.5" y="1" width="4.5" height="4.5" rx=".8" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="1" y="7.5" width="4.5" height="4.5" rx=".8" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="7.5" y="7.5" width="4.5" height="4.5" rx=".8" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>` },
    { id: 'icons',   label: 'Large Icons',icon: `<svg width="13" height="13" viewBox="0 0 13 13"><rect x="1.5" y="1.5" width="4" height="4" rx=".8" fill="currentColor" opacity=".7"/><rect x="7.5" y="1.5" width="4" height="4" rx=".8" fill="currentColor" opacity=".7"/><rect x="1.5" y="7.5" width="4" height="4" rx=".8" fill="currentColor" opacity=".7"/><rect x="7.5" y="7.5" width="4" height="4" rx=".8" fill="currentColor" opacity=".7"/></svg>` },
  ];

  const viewModeHTML = VIEW_MODES.map(v =>
    `<button class="fe-view-btn" data-view="${v.id}" title="${v.label}">${v.icon}</button>`
  ).join('');

  const PAGE_HTML = `
<div id="fe" data-theme="${getTheme()}" data-view="${getView()}">
  <div id="fe-bar">
    <div id="fe-bc">${renderCrumbs()}</div>
    <button id="fe-term-btn" title="Open in Ghostty">${PI.term}</button>
    <button id="fe-bm-btn" class="${curIsBookmarked ? 'on' : ''}" title="${curIsBookmarked ? 'Remove bookmark' : 'Add bookmark'}">
      <svg width="13" height="13" viewBox="0 0 13 13"><path d="M2.5 1h8v11l-4-2.8L2.5 12z" fill="${curIsBookmarked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
    </button>
    <button id="fe-theme-btn" title="Toggle theme">
      <svg id="fe-sun" width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="3" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.8 2.8l1 1M10.2 10.2l1 1M10.2 2.8l-1 1M3.8 10.2l-1 1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
      <svg id="fe-moon" width="14" height="14" viewBox="0 0 14 14"><path d="M11 8.5A5 5 0 0 1 5.5 3a5 5 0 1 0 5.5 5.5z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
    </button>
  </div>

  <div id="fe-body">
    <nav id="fe-side">
      <div class="fe-sec">
        <div class="fe-sh">Bookmarks</div>
        <div id="fe-bm-list">${renderBMList(bm)}</div>
      </div>
      <div class="fe-sec">
        <div class="fe-sh">Places</div>
        ${QUICK_PLACES.map(p => `<a href="${p.href}" class="fe-si" title="${p.href}">${PI[p.icon]}<span class="fe-sl">${p.label}</span></a>`).join('')}
      </div>
    </nav>

    <div id="fe-main">
      <div id="fe-toolbar">
        <span id="fe-count">${countLabel}</span>
        <div id="fe-view-group">${viewModeHTML}</div>
        <input id="fe-search" type="text" placeholder="Filter…" autocomplete="off" spellcheck="false"/>
      </div>

      <div id="fe-scroll">
        <table id="fe-table">
          <thead>
            <tr>
              <th class="c-nm" data-sort="name">Name <span class="sort-ind">↕</span></th>
              <th class="c-tp">Type</th>
              <th class="c-sz" data-sort="size">Size <span class="sort-ind">↕</span></th>
              <th class="c-dt" data-sort="date">Modified <span class="sort-ind">↕</span></th>
            </tr>
          </thead>
          <tbody id="fe-tbody">${renderRows()}</tbody>
        </table>

        <div id="fe-tiles">${renderTiles()}</div>
      </div>
    </div>
  </div>

  <div id="fe-toast"></div>
</div>`;

  // ── Styles ────────────────────────────────────────────────────────
  const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0d1117;--s1:#161b22;--s2:#1c2230;--s3:#21262d;
  --bd:#30363d;--tx:#e6edf3;--mt:#8b949e;--dm:#484f58;
  --ac:#58a6ff;--dir:#79c0ff;--gold:#d29922;--hover:#21262d;
  --act:#1a3a5c;--green:#3fb950;--radius:6px;
}
#fe[data-theme="light"]{
  --bg:#ffffff;--s1:#f6f8fa;--s2:#eaeef2;--s3:#e2e8f0;
  --bd:#d0d7de;--tx:#1f2328;--mt:#656d76;--dm:#8c959f;
  --hover:#f3f4f6;--act:#dbeafe;--ac:#0969da;--dir:#0550ae;
}
html,body{height:100%;background:var(--bg);color:var(--tx);
  font:13px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;overflow:hidden}
body{opacity:1!important;transition:opacity .12s ease}

#fe{display:flex;flex-direction:column;height:100vh;background:var(--bg);color:var(--tx)}

/* ── Path bar ── */
#fe-bar{
  display:flex;align-items:center;gap:6px;
  padding:8px 14px;background:var(--s1);border-bottom:1px solid var(--bd);
  flex-shrink:0;min-height:40px;
}
#fe-bc{display:flex;align-items:center;gap:2px;flex:1;overflow:hidden;white-space:nowrap;min-width:0}
.fe-crumb{color:var(--mt);text-decoration:none;padding:2px 5px;border-radius:4px;font-size:12px;flex-shrink:0;transition:background .1s,color .1s}
.fe-crumb:last-of-type{color:var(--tx);font-weight:500}
.fe-crumb:hover{background:var(--hover);color:var(--tx)}
.fe-sep{color:var(--dm);font-size:11px;flex-shrink:0}

/* ── Bar buttons ── */
#fe-bar button{
  background:none;border:1px solid var(--bd);color:var(--mt);cursor:pointer;
  padding:4px 8px;border-radius:var(--radius);line-height:1;
  display:flex;align-items:center;justify-content:center;gap:4px;
  transition:all .15s;flex-shrink:0
}
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

/* ── Sidebar ── */
#fe-side{width:188px;flex-shrink:0;background:var(--s1);border-right:1px solid var(--bd);overflow-y:auto;padding:6px 0}
.fe-sec{margin-bottom:4px}
.fe-sh{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--dm);padding:8px 14px 4px}
.fe-si{display:flex;align-items:center;gap:8px;padding:5px 14px;color:var(--mt);text-decoration:none;transition:background .1s,color .1s}
.fe-si:hover{background:var(--hover);color:var(--tx)}
.fe-si.active{background:var(--act);color:var(--ac)}
.fe-si svg{flex-shrink:0;opacity:.8}
.fe-sl{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fe-hint{font-size:11px;color:var(--dm);padding:5px 14px;font-style:italic;line-height:1.6}

/* ── Main ── */
#fe-main{flex:1;display:flex;flex-direction:column;overflow:hidden}
#fe-toolbar{
  display:flex;align-items:center;gap:10px;
  padding:7px 14px;background:var(--s2);border-bottom:1px solid var(--bd);flex-shrink:0
}
#fe-count{font-size:11px;color:var(--dm);flex:1;white-space:nowrap}
#fe-view-group{display:flex;gap:2px}
.fe-view-btn{
  background:none;border:1px solid transparent;color:var(--dm);cursor:pointer;
  padding:4px 7px;border-radius:5px;display:flex;align-items:center;transition:all .12s
}
.fe-view-btn:hover{background:var(--hover);color:var(--tx)}
.fe-view-btn.active{background:var(--s3);border-color:var(--bd);color:var(--tx)}
#fe-search{
  background:var(--s1);border:1px solid var(--bd);color:var(--tx);
  padding:4px 10px;border-radius:var(--radius);font-size:12px;width:170px;
  outline:none;transition:border-color .15s
}
#fe-search:focus{border-color:var(--ac)}
#fe-search::placeholder{color:var(--dm)}

#fe-scroll{flex:1;overflow-y:auto}

/* ── Details & List views ── */
#fe-table{width:100%;border-collapse:collapse;table-layout:fixed}
thead{position:sticky;top:0;z-index:5;background:var(--s2)}
thead th{padding:6px 12px;text-align:left;font-size:11px;font-weight:600;
  text-transform:uppercase;letter-spacing:.07em;color:var(--dm);
  border-bottom:1px solid var(--bd);user-select:none;white-space:nowrap}
thead th[data-sort]{cursor:pointer}
thead th[data-sort]:hover{color:var(--tx)}
.sort-ind{opacity:.4;font-size:10px}
th.sorted .sort-ind{opacity:1;color:var(--ac)}
.c-nm{width:46%}.c-tp{width:16%}.c-sz{width:12%;text-align:right}.c-dt{width:26%}
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
.fe-row.hidden{display:none!important}

/* ── View: list (hide type+date cols) ── */
#fe[data-view="list"] .c-tp,
#fe[data-view="list"] .c-sz,
#fe[data-view="list"] .c-dt{display:none}
#fe[data-view="list"] .c-nm{width:100%}
#fe[data-view="list"] tbody td{padding:4px 12px}

/* ── Tiles / Icons views ── */
#fe-tiles{display:none;flex-wrap:wrap;gap:6px;padding:12px}
#fe[data-view="tiles"] #fe-table,
#fe[data-view="icons"] #fe-table{display:none}
#fe[data-view="tiles"] #fe-tiles,
#fe[data-view="icons"] #fe-tiles{display:flex}

.fe-tile{
  display:flex;flex-direction:column;align-items:center;gap:5px;
  padding:10px 8px 8px;border-radius:var(--radius);text-decoration:none;
  color:var(--tx);border:1px solid transparent;transition:all .12s;
  width:90px;overflow:hidden;cursor:pointer
}
.fe-tile:hover{background:var(--hover);border-color:var(--bd)}
.fe-tile.active{background:var(--act);border-color:var(--ac)}
.fe-tile-ic{font-size:0;line-height:0}
.fe-tile-ic svg{display:block}
.fe-tile-nm{font-size:11px;text-align:center;word-break:break-all;
  overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
  line-height:1.3;color:var(--tx)}
.fe-tile-sz{font-size:10px;color:var(--dm)}
.fe-tile.dir .fe-tile-nm{color:var(--dir)}
.fe-tile.par .fe-tile-nm{color:var(--dm)}

/* Tiles — scale up icons */
#fe[data-view="tiles"] .fe-tile-ic svg{transform:scale(1.5);margin:4px}
#fe[data-view="icons"] .fe-tile{width:110px;padding:14px 8px 10px}
#fe[data-view="icons"] .fe-tile-ic svg{transform:scale(2.2);margin:10px}
#fe[data-view="icons"] .fe-tile-nm{font-size:12px}

/* ── Toast ── */
#fe-toast{
  position:fixed;bottom:20px;left:50%;transform:translateX(-50%) translateY(8px);
  background:#1f2937;color:#e5e7eb;padding:8px 18px;border-radius:20px;
  font-size:12px;opacity:0;transition:all .25s;pointer-events:none;white-space:nowrap;
  border:1px solid #374151;z-index:999
}
#fe-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}

/* ── Scrollbar ── */
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--bd);border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:var(--dm)}
`;

  // ── Inject ────────────────────────────────────────────────────────
  document.title = `📁 ${segments[segments.length - 1] || '/'}`;
  document.head.innerHTML = `<meta charset="utf-8"><title>${document.title}</title>`;
  document.body.innerHTML = PAGE_HTML;
  const styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);
  if (preload) preload.remove();

  // ── Events ────────────────────────────────────────────────────────
  function toast(msg, ms = 2200) {
    const t = document.getElementById('fe-toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), ms);
  }

  // Active view buttons
  const curView = getView();
  document.querySelectorAll('.fe-view-btn').forEach(btn => {
    if (btn.dataset.view === curView) btn.classList.add('active');
    btn.addEventListener('click', () => {
      document.querySelectorAll('.fe-view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const v = btn.dataset.view;
      document.getElementById('fe').dataset.view = v;
      localStorage.setItem(VIEW_KEY, v);
    });
  });

  // Search
  document.getElementById('fe-search').addEventListener('input', function () {
    const q = this.value.toLowerCase();
    document.querySelectorAll('.fe-row').forEach(r => {
      const n = r.dataset.name ?? '';
      r.classList.toggle('hidden', q.length > 0 && !n.includes(q) && !r.classList.contains('par'));
    });
    document.querySelectorAll('.fe-tile').forEach(t => {
      const n = t.dataset.name ?? '';
      t.classList.toggle('hidden', q.length > 0 && !n.includes(q) && !t.classList.contains('par'));
    });
  });

  // Bookmark
  document.getElementById('fe-bm-btn').addEventListener('click', function () {
    const newBm = toggleBM(rawPath);
    const on = newBm.some(b => b.path === rawPath);
    this.classList.toggle('on', on);
    this.querySelector('path').setAttribute('fill', on ? 'currentColor' : 'none');
    document.getElementById('fe-bm-list').innerHTML = renderBMList(newBm);
    toast(on ? 'Bookmarked' : 'Bookmark removed');
  });

  // Theme toggle
  document.getElementById('fe-theme-btn').addEventListener('click', () => {
    const fe = document.getElementById('fe');
    const next = fe.dataset.theme === 'dark' ? 'light' : 'dark';
    fe.dataset.theme = next;
    localStorage.setItem(THEME_KEY, next);
  });

  // Ghostty terminal — tries native messaging, falls back to clipboard
  document.getElementById('fe-term-btn').addEventListener('click', () => {
    const fullPath = rawPath;
    try {
      // Try native messaging host (requires install.sh setup)
      const port = chrome.runtime.connectNative('com.better_file_browser.ghostty');
      port.postMessage({ action: 'open_terminal', path: fullPath });
      port.onDisconnect.addListener(() => {
        if (chrome.runtime.lastError) {
          fallbackCopy(fullPath);
        }
      });
    } catch {
      fallbackCopy(fullPath);
    }
  });

  function fallbackCopy(path) {
    navigator.clipboard.writeText(path).then(() => {
      toast(`Path copied — run: open -a Ghostty "${path}"`);
    }).catch(() => {
      toast(`Path: ${path}`);
    });
  }

  // Column sort
  let sortState = { col: null, asc: true };
  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (sortState.col === col) sortState.asc = !sortState.asc;
      else { sortState.col = col; sortState.asc = true; }
      document.querySelectorAll('th[data-sort]').forEach(h => h.classList.remove('sorted'));
      th.classList.add('sorted');
      th.querySelector('.sort-ind').textContent = sortState.asc ? '↑' : '↓';
      sortRows(col, sortState.asc);
    });
  });

  function sortRows(col, asc) {
    const tbody = document.getElementById('fe-tbody');
    const rows = Array.from(tbody.querySelectorAll('.fe-row:not(.par)'));
    const par = tbody.querySelector('.par');
    rows.sort((a, b) => {
      let av, bv;
      if (col === 'name') { av = a.dataset.name; bv = b.dataset.name; }
      else if (col === 'size') { av = parseInt(a.querySelector('.c-sz')?.textContent) || 0; bv = parseInt(b.querySelector('.c-sz')?.textContent) || 0; return asc ? av-bv : bv-av; }
      else if (col === 'date') { av = a.querySelector('.c-dt')?.textContent ?? ''; bv = b.querySelector('.c-dt')?.textContent ?? ''; }
      return asc ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    if (par) tbody.prepend(par);
    rows.forEach(r => tbody.appendChild(r));
  }

})();
