"use strict";
(() => {
  // src/parse.ts
  function parseEntries() {
    const table = document.querySelector("table") || document.getElementById("listing-table");
    if (!table) return [];
    return Array.from(table.querySelectorAll("tr")).slice(1).flatMap((row) => {
      const cells = row.querySelectorAll("td");
      if (cells.length < 2) return [];
      const link = cells[0]?.querySelector("a");
      if (!link) return [];
      const rawName = link.textContent.trim();
      const href = link.getAttribute("href");
      const rawBytes = parseInt(cells[1]?.getAttribute("data-value") ?? cells[1]?.textContent ?? "-1");
      const epoch = parseInt(cells[2]?.getAttribute("data-value") ?? "");
      const dateMs = Number.isFinite(epoch) ? epoch * 1e3 : NaN;
      const dateStr = cells[2]?.textContent?.trim() ?? "";
      const isParent = href === "../";
      const isDir = !isParent && (href?.endsWith("/") ?? false);
      const name = isParent ? ".." : isDir ? rawName.replace(/\/$/, "") : rawName;
      const isHidden = !isParent && name.startsWith(".");
      return [{ name, href, isDir, isParent, isHidden, rawBytes, dateMs, dateStr }];
    });
  }
  function parseListing(html, baseUrl) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const fromTable = parseFetchedDoc(doc, baseUrl);
    if (fromTable.length) return fromTable;
    return parseAddRows(html, baseUrl);
  }
  function parseAddRows(html, baseUrl) {
    const out = [];
    for (const m of html.matchAll(/addRow\((.*?)\);/g)) {
      try {
        const a = JSON.parse("[" + m[1] + "]");
        const name = String(a[0]), url = String(a[1]);
        if (name === "." || name === "..") continue;
        const isDir = !!a[2];
        const epoch = typeof a[5] === "number" ? a[5] : NaN;
        out.push({
          name,
          href: new URL(url + (isDir ? "/" : ""), baseUrl).href,
          isDir,
          isParent: false,
          isHidden: name.startsWith("."),
          rawBytes: typeof a[3] === "number" ? a[3] : -1,
          dateMs: Number.isFinite(epoch) ? epoch * 1e3 : NaN,
          dateStr: typeof a[6] === "string" ? a[6] : ""
        });
      } catch {
      }
    }
    return out;
  }
  function parseFetchedDoc(doc, baseUrl) {
    const table = doc.querySelector("table");
    if (!table) return [];
    return Array.from(table.querySelectorAll("tr")).slice(1).flatMap((row) => {
      const cells = row.querySelectorAll("td");
      if (cells.length < 2) return [];
      const link = cells[0]?.querySelector("a");
      if (!link) return [];
      const rawName = link.textContent.trim();
      const rel = link.getAttribute("href");
      if (rel === "../") return [];
      const href = new URL(rel, baseUrl).href;
      const isDir = rel?.endsWith("/") ?? false;
      const name = isDir ? rawName.replace(/\/$/, "") : rawName;
      const isHidden = name.startsWith(".");
      return [{ name, href, isDir, isParent: false, isHidden, rawBytes: -1, dateMs: NaN, dateStr: "" }];
    });
  }

  // src/utils.ts
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function fmtSize(b) {
    if (b < 0 || b === 0) return "\u2014";
    if (b < 1024) return b + " B";
    if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
    if (b < 1073741824) return (b / 1048576).toFixed(1) + " MB";
    return (b / 1073741824).toFixed(2) + " GB";
  }
  function fmtDate(dateMs, settings, rawFallback = "") {
    let d = null;
    if (Number.isFinite(dateMs)) {
      d = new Date(dateMs);
    } else if (rawFallback) {
      const p = new Date(rawFallback);
      if (!isNaN(p.getTime())) d = p;
    }
    if (!d || isNaN(d.getTime())) return rawFallback || "\u2014";
    const fmt = settings?.dateFormat ?? "short";
    return d.toLocaleDateString(
      "en-US",
      fmt === "full" ? { month: "long", day: "numeric", year: "numeric" } : { month: "short", day: "numeric", year: "numeric" }
    );
  }
  function fmtType(e) {
    if (e.isParent) return "";
    if (e.isDir) return "Folder";
    if (!e.name.includes(".")) return "File";
    return e.name.split(".").pop().toUpperCase() + " File";
  }
  function getExt(e) {
    if (e.isDir || e.isParent) return "";
    return e.name.includes(".") ? e.name.split(".").pop().toLowerCase() : "";
  }

  // src/icons.ts
  var EXT_COLORS = {
    js: "#f0db4f",
    mjs: "#f0db4f",
    cjs: "#f0db4f",
    ts: "#3178c6",
    tsx: "#61dafb",
    jsx: "#61dafb",
    html: "#e34c26",
    htm: "#e34c26",
    xml: "#e06c75",
    vue: "#42b883",
    svelte: "#ff3e00",
    css: "#264de4",
    scss: "#cc6699",
    less: "#1d365d",
    json: "#00b894",
    yaml: "#cc2936",
    yml: "#cc2936",
    toml: "#9c4221",
    md: "#a8b4c1",
    mdx: "#a8b4c1",
    txt: "#c0c8d0",
    rst: "#c0c8d0",
    py: "#3776ab",
    rb: "#cc342d",
    go: "#00add8",
    rs: "#dea584",
    java: "#ed8b00",
    kt: "#7f52ff",
    swift: "#f05138",
    dart: "#0175c2",
    sh: "#4eaa25",
    bash: "#4eaa25",
    zsh: "#4eaa25",
    fish: "#4eaa25",
    c: "#a8b9cc",
    cpp: "#00599c",
    h: "#a8b9cc",
    cs: "#239120",
    php: "#777bb4",
    r: "#276dc2",
    sql: "#e38d13",
    db: "#e38d13",
    sqlite: "#e38d13",
    pdf: "#e44c38",
    png: "#9b59b6",
    jpg: "#9b59b6",
    jpeg: "#9b59b6",
    gif: "#9b59b6",
    svg: "#ff9900",
    webp: "#9b59b6",
    ico: "#9b59b6",
    avif: "#9b59b6",
    mp4: "#e74c3c",
    mov: "#e74c3c",
    avi: "#e74c3c",
    mkv: "#e74c3c",
    webm: "#e74c3c",
    mp3: "#e67e22",
    wav: "#e67e22",
    flac: "#e67e22",
    ogg: "#e67e22",
    m4a: "#e67e22",
    zip: "#795548",
    tar: "#795548",
    gz: "#795548",
    rar: "#795548",
    "7z": "#795548",
    env: "#ffd700",
    dockerfile: "#2496ed",
    lock: "#8b949e"
  };
  var IMG_EXTS = /* @__PURE__ */ new Set(["png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "avif", "bmp"]);
  var SPECIAL_FOLDERS = /* @__PURE__ */ new Set([
    "Desktop",
    "Documents",
    "Downloads",
    "Projects",
    "Library",
    "Movies",
    "Music",
    "Pictures",
    "Applications",
    "Code",
    "Public",
    "Sites"
  ]);
  function icoFile(ext) {
    const c = EXT_COLORS[ext.toLowerCase()] ?? "#6e7681";
    const lbl = ext.length <= 3 ? ext.toUpperCase() : ext.slice(0, 3).toUpperCase();
    return `<svg width="16" height="18" viewBox="0 0 16 18" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 0.5h8l5.5 5.5V17a.5.5 0 0 1-.5.5H2a.5.5 0 0 1-.5-.5V1A.5.5 0 0 1 2 0.5z" fill="${c}1a" stroke="${c}" stroke-width="1.1"/>
    <path d="M10 0.5v5.5h5.5" fill="none" stroke="${c}" stroke-width="1.1"/>
    <text x="8" y="14.5" text-anchor="middle" font-family="'SF Mono',Menlo,Consolas,monospace" font-size="4.5" font-weight="700" fill="${c}">${lbl}</text>
  </svg>`;
  }
  function icoFolder(name = "") {
    const special = SPECIAL_FOLDERS.has(name);
    const c = special ? "#e8a838" : "#4a9eff";
    const d = special ? "#c4882a" : "#2980d9";
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
  function icoCustom(label, color) {
    const lbl = String(label || "?").slice(0, 4);
    const safe = lbl.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `<svg width="16" height="18" viewBox="0 0 16 18" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 0.5h8l5.5 5.5V17a.5.5 0 0 1-.5.5H2a.5.5 0 0 1-.5-.5V1A.5.5 0 0 1 2 0.5z" fill="${color}" fill-opacity="0.12" stroke="${color}" stroke-width="1.1"/>
    <path d="M10 0.5L15.5 6H10z" fill="${color}" fill-opacity="0.75"/>
    <text x="8" y="14.5" text-anchor="middle" font-family="'SF Mono',Menlo,Consolas,monospace" font-size="4.5" font-weight="700" fill="${color}">${safe}</text>
  </svg>`;
  }
  function getIcon(e, iconRules) {
    if (e.isParent) return icoParent();
    if (iconRules) {
      for (const rule of iconRules) {
        if (!rule.enabled) continue;
        try {
          if (new RegExp(rule.pattern, "i").test(e.name)) return icoCustom(rule.label, rule.color);
        } catch {
        }
      }
    }
    if (e.isDir) return icoFolder(e.name);
    const ext = e.name.includes(".") ? e.name.split(".").pop() : "";
    return icoFile(ext || "\u2014");
  }
  var PI = {
    root: `<svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="2" width="12" height="9" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M1 5h12" stroke="currentColor" stroke-width="1.3"/><circle cx="3.5" cy="3.5" r=".9" fill="currentColor"/><circle cx="5.8" cy="3.5" r=".9" fill="currentColor"/><path d="M3 13h8M7 11v2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
    home: `<svg width="14" height="14" viewBox="0 0 14 14"><path d="M1 7L7 2l6 5v6H9.5V9.5h-5V13H1z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>`,
    desk: `<svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="1.5" width="12" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M4.5 12.5h5M7 9.5v3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
    docs: `<svg width="14" height="14" viewBox="0 0 14 14"><path d="M3.5 1h5l3 3v9h-8z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M8.5 1v3.5H11.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M5 7h4M5 9h4M5 11h2.5" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>`,
    down: `<svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 1v9M4 7.5l3 3.5 3-3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 12.5h10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
    code: `<svg width="14" height="14" viewBox="0 0 14 14"><path d="M4.5 4.5L2 7l2.5 2.5M9.5 4.5L12 7l-2.5 2.5M8 3l-2 8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    pics: `<svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="2" width="12" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="4.5" cy="5.5" r="1.2" fill="currentColor" opacity=".7"/><path d="M1 10l3.5-3.5L7 9l2.5-2.5L13 10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    apps: `<svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="1" width="5.2" height="5.2" rx="1" fill="currentColor" opacity=".5"/><rect x="7.8" y="1" width="5.2" height="5.2" rx="1" fill="currentColor" opacity=".5"/><rect x="1" y="7.8" width="5.2" height="5.2" rx="1" fill="currentColor" opacity=".5"/><rect x="7.8" y="7.8" width="5.2" height="5.2" rx="1" fill="currentColor" opacity=".5"/></svg>`,
    folder: `<svg width="14" height="14" viewBox="0 0 14 14"><path d="M1 3.5a.8.8 0 0 1 .8-.8h3l1.4 1.5H13.2a.8.8 0 0 1 .8.8V11a.8.8 0 0 1-.8.8H1.8A.8.8 0 0 1 1 11z" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>`,
    scrnsh: `<svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="2" width="12" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M4 5.5l2.5 2.5L9 4.5M5 9.5h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    bm: `<svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 1h8v12l-4-3-4 3z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>`,
    recent: `<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M7 4v3l2 1.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    drag: `<svg width="10" height="14" viewBox="0 0 10 14"><circle cx="3" cy="3" r="1.2" fill="currentColor"/><circle cx="3" cy="7" r="1.2" fill="currentColor"/><circle cx="3" cy="11" r="1.2" fill="currentColor"/><circle cx="7" cy="3" r="1.2" fill="currentColor"/><circle cx="7" cy="7" r="1.2" fill="currentColor"/><circle cx="7" cy="11" r="1.2" fill="currentColor"/></svg>`
  };

  // src/storage.ts
  var BM_KEY = "bfb-bookmarks-v2";
  var RECENTS_KEY = "bfb-recents-v1";
  var COL_WIDTHS_KEY = "bfb-col-widths-v1";
  var PLACES_KEY = "bfb-places-v1";
  var VIEW_KEY = "bfb-view";
  var THEME_KEY = "bfb-theme";
  var ZOOM_KEY = "bfb-zoom";
  var HIDDEN_KEY = "bfb-show-hidden";
  var ICON_RULES_KEY = "bfb-icon-rules-v1";
  var SETTINGS_KEY = "bfb-settings-v1";
  var DEFAULT_ICON_RULES = [
    { id: "r1", pattern: "\\.claude$|^Claude", label: "Cld", color: "#d97757", enabled: true },
    { id: "r2", pattern: "\\.md$", label: "MD\u2193", color: "#4a9eff", enabled: true },
    { id: "r3", pattern: "^\\.DS_Store$", label: "DS", color: "#8b949e", enabled: true }
  ];
  var DEFAULT_SETTINGS = {
    compactMode: false,
    showSidebar: true,
    dateFormat: "short",
    terminalApp: "ghostty",
    terminalCmd: ""
  };
  var TERMINAL_CMDS = {
    ghostty: 'open -a Ghostty "${p}"',
    terminal: 'open -a Terminal "${p}"',
    iterm: 'open -a iTerm "${p}"',
    wezterm: 'wezterm start --cwd "${p}"',
    kitty: 'kitty --directory "${p}"'
  };
  function getIconRules() {
    try {
      const r = JSON.parse(localStorage.getItem(ICON_RULES_KEY) ?? "null");
      return Array.isArray(r) && r.length > 0 ? r : DEFAULT_ICON_RULES.map((r2) => ({ ...r2 }));
    } catch {
      return DEFAULT_ICON_RULES.map((r) => ({ ...r }));
    }
  }
  function saveIconRules(r) {
    localStorage.setItem(ICON_RULES_KEY, JSON.stringify(r));
  }
  function getSettings() {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }
  function saveSettings(s) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  }
  function getBM() {
    try {
      return JSON.parse(localStorage.getItem(BM_KEY) ?? "[]");
    } catch {
      return [];
    }
  }
  function saveBM(bm) {
    localStorage.setItem(BM_KEY, JSON.stringify(bm));
  }
  function toggleBM(path) {
    const bm = getBM();
    const idx = bm.findIndex((b) => b.path === path);
    if (idx >= 0) bm.splice(idx, 1);
    else bm.unshift({ path, label: path.split("/").filter(Boolean).pop() || "/" });
    saveBM(bm);
    return bm;
  }
  function getRecents() {
    try {
      return JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]");
    } catch {
      return [];
    }
  }
  function pushRecent(path) {
    const list = getRecents().filter((r) => r.path !== path);
    list.unshift({ path, ts: Date.now() });
    localStorage.setItem(RECENTS_KEY, JSON.stringify(list.slice(0, 8)));
  }
  function getPlaces() {
    try {
      return JSON.parse(localStorage.getItem(PLACES_KEY) ?? "[]");
    } catch {
      return [];
    }
  }
  function savePlaces(p) {
    localStorage.setItem(PLACES_KEY, JSON.stringify(p));
  }
  function getColWidths() {
    try {
      return JSON.parse(localStorage.getItem(COL_WIDTHS_KEY) ?? "{}");
    } catch {
      return {};
    }
  }
  function saveColWidths(w) {
    localStorage.setItem(COL_WIDTHS_KEY, JSON.stringify(w));
  }
  function getView() {
    return localStorage.getItem(VIEW_KEY) ?? "details";
  }
  function getTheme() {
    return localStorage.getItem(THEME_KEY) ?? "dark";
  }
  function getZoom() {
    return parseInt(localStorage.getItem(ZOOM_KEY) ?? "100");
  }
  function getShowHidden() {
    return localStorage.getItem(HIDDEN_KEY) === "true";
  }

  // src/places.ts
  function upsertPlace(list, place) {
    if (list.some((p) => p.path === place.path)) return list;
    return [...list, place];
  }
  function removePlace(list, path) {
    return list.filter((p) => p.path !== path);
  }
  function renamePlace(list, path, label) {
    return list.map((p) => p.path === path ? { ...p, label } : p);
  }
  function movePlace(list, fromPath, toPath) {
    const from = list.findIndex((p) => p.path === fromPath);
    const to = list.findIndex((p) => p.path === toPath);
    if (from < 0 || to < 0 || from === to) return list;
    const next = [...list];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  }

  // src/renderers.ts
  var CODE_EXTS = /* @__PURE__ */ new Set([
    "sh",
    "bash",
    "zsh",
    "fish",
    "js",
    "mjs",
    "cjs",
    "ts",
    "tsx",
    "jsx",
    "py",
    "rb",
    "go",
    "rs",
    "java",
    "kt",
    "swift",
    "c",
    "cpp",
    "h",
    "cs",
    "php",
    "css",
    "scss",
    "less",
    "html",
    "htm",
    "xml",
    "svg",
    "vue",
    "svelte",
    "yaml",
    "yml",
    "toml",
    "ini",
    "conf",
    "env",
    "sql",
    "md",
    "mdx",
    "txt",
    "log",
    "rst",
    "lock",
    "gitignore",
    "csv"
  ]);
  var TABLE_EXTS = /* @__PURE__ */ new Set(["tsv", "csv"]);
  var JSONL_EXTS = /* @__PURE__ */ new Set(["jsonl", "ndjson"]);
  var RENDER_CAPS = {
    codeChars: 3e5,
    tableRows: 5e3,
    jsonlLines: 2e3,
    treeNodes: 2e4
  };
  function sniffBinary(text) {
    const probe = text.slice(0, 1e3);
    if (probe.includes("\0")) return true;
    let weird = 0;
    for (const ch of probe) {
      const c = ch.charCodeAt(0);
      if (c < 9 || c > 13 && c < 32 || c === 65533) weird++;
    }
    return probe.length > 0 && weird / probe.length > 0.1;
  }
  var sp = (s) => s.split(" ");
  function wordClasses(lang) {
    const m = /* @__PURE__ */ new Map();
    for (const w of lang.kw) m.set(w, "tok-kw");
    const c = lang.kwCats;
    if (c) {
      for (const w of c.ctrl ?? []) m.set(w, "tok-kw-ctrl");
      for (const w of c.type ?? []) m.set(w, "tok-type");
      for (const w of c.builtin ?? []) m.set(w, "tok-builtin");
      for (const w of c.lit ?? []) m.set(w, "tok-lit");
    }
    return m;
  }
  var KW_SH = "if then elif else fi for while until do done case esac in function select local export readonly declare unset return exit break continue shift eval exec source alias trap set echo printf read cd test true false";
  var KW_JS = "const let var function return if else for while do switch case break continue new class extends super this typeof instanceof in of import export from default async await yield try catch finally throw delete void null undefined true false interface type enum implements private public protected readonly static namespace declare as is keyof never unknown any string number boolean object symbol";
  var KW_PY = "def class return if elif else for while break continue pass import from as with lambda try except finally raise yield global nonlocal assert del in is not and or None True False async await match self";
  var KW_SQL = "select from where insert into update delete join left right inner outer on group by order having limit offset create table drop alter index view as and or not null primary key foreign references distinct union all values set";
  var KW_GO = "func package import return if else for range switch case break continue defer go chan select map struct interface type var const nil true false make new len cap append";
  var KW_RS = "fn let mut pub use mod struct enum impl trait return if else for while loop match break continue ref self Self crate super move async await dyn where unsafe true false Some None Ok Err";
  var CATS_JS = {
    ctrl: sp("return if else for while do switch case break continue new throw try catch finally yield await delete in of"),
    type: sp("interface type enum implements string number boolean object symbol any unknown never void keyof readonly as is namespace"),
    builtin: sp("this super console"),
    lit: sp("true false null undefined")
  };
  var CATS_PY = {
    ctrl: sp("return if elif else for while break continue pass raise yield try except finally with assert del in is not and or match async await"),
    builtin: sp("self print len range"),
    lit: sp("None True False")
  };
  var CATS_GO = {
    ctrl: sp("return if else for range switch case break continue defer go select"),
    type: sp("chan map struct interface type"),
    builtin: sp("make new len cap append"),
    lit: sp("nil true false")
  };
  var CATS_RS = {
    ctrl: sp("return if else for while loop match break continue move async await unsafe where"),
    type: sp("struct enum impl trait mod dyn"),
    lit: sp("true false Some None Ok Err self Self")
  };
  var CATS_SQL = {
    ctrl: sp("select from where insert into update delete join on group by order having limit union"),
    type: sp("table view index"),
    lit: sp("null true false")
  };
  var LANGS = {
    shell: {
      line: ["#"],
      strings: [`"`, `'`],
      vars: true,
      kw: KW_SH.split(" "),
      kwCats: { ctrl: sp("if then elif else fi for while until do done case esac return exit break continue"), builtin: sp("echo printf read cd test eval exec source"), lit: sp("true false") }
    },
    js: { line: ["//"], block: ["/*", "*/"], strings: [`"`, `'`, "`"], tickML: true, deco: true, kw: KW_JS.split(" "), kwCats: CATS_JS },
    py: {
      line: ["#"],
      strings: [],
      deco: true,
      kw: KW_PY.split(" "),
      kwCats: CATS_PY,
      strRules: [
        '[rbfuRBFU]{0,2}"""[\\s\\S]*?"""',
        "[rbfuRBFU]{0,2}'''[\\s\\S]*?'''",
        '[rbfuRBFU]{0,2}"(?:\\\\.|[^"\\\\\\n])*"',
        "[rbfuRBFU]{0,2}'(?:\\\\.|[^'\\\\\\n])*'"
      ]
    },
    go: { line: ["//"], block: ["/*", "*/"], strings: [`"`, "`"], tickML: true, kw: KW_GO.split(" "), kwCats: CATS_GO },
    rs: {
      line: ["//"],
      block: ["/*", "*/"],
      strings: [],
      kw: KW_RS.split(" "),
      kwCats: CATS_RS,
      strRules: ['r#+"[\\s\\S]*?"#+', 'r"[^"\\n]*"', 'b?"(?:\\\\.|[^"\\\\\\n])*"']
    },
    sql: { line: ["--"], block: ["/*", "*/"], strings: [`'`, `"`], kw: KW_SQL.split(" "), kwCats: CATS_SQL },
    cfg: { line: ["#", ";"], strings: [`"`, `'`], vars: true, kw: [] },
    cstyle: { line: ["//"], block: ["/*", "*/"], strings: [`"`, `'`], deco: true, kw: KW_JS.split(" "), kwCats: CATS_JS },
    css: { block: ["/*", "*/"], strings: [`"`, `'`], kw: [] },
    plain: { strings: [], kw: [] }
  };
  var EXT_LANG = {
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    fish: "shell",
    js: "js",
    mjs: "js",
    cjs: "js",
    ts: "js",
    tsx: "js",
    jsx: "js",
    vue: "js",
    svelte: "js",
    py: "py",
    rb: "py",
    go: "go",
    rs: "rs",
    java: "cstyle",
    kt: "cstyle",
    swift: "cstyle",
    c: "cstyle",
    cpp: "cstyle",
    h: "cstyle",
    cs: "cstyle",
    php: "cstyle",
    css: "css",
    scss: "css",
    less: "css",
    yaml: "cfg",
    yml: "cfg",
    toml: "cfg",
    ini: "cfg",
    conf: "cfg",
    env: "cfg",
    gitignore: "cfg",
    sql: "sql"
  };
  function reEsc(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  function buildRules(lang) {
    const rules = [];
    if (lang.block) rules.push({ kind: "cmt", pattern: `${reEsc(lang.block[0])}[\\s\\S]*?(?:${reEsc(lang.block[1])}|$)` });
    if (lang.line?.length) {
      const starters = lang.line.map(reEsc).join("|");
      rules.push({ kind: "cmt", pattern: `(?:${starters})[^\\n]*` });
    }
    for (const p of lang.strRules ?? []) rules.push({ kind: "str", pattern: p });
    for (const q of lang.strings ?? []) {
      const body = q === "`" && lang.tickML ? "(?:\\\\.|[^`\\\\])*(?:`|$)" : `(?:\\\\.|[^${reEsc(q)}\\\\\\n])*(?:${reEsc(q)}|\\n|$)`;
      rules.push({ kind: "str", pattern: `${reEsc(q)}${body}` });
    }
    if (lang.vars) rules.push({ kind: "var", pattern: "\\$\\{[^}\\n]*\\}?|\\$[\\w@#?!*-]+" });
    if (lang.deco) rules.push({ kind: "deco", pattern: "@[A-Za-z_][\\w.]*" });
    rules.push({ kind: "num", pattern: "\\b(?:0[xX][0-9a-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|\\d[\\d_]*(?:\\.\\d[\\d_]*)?(?:[eE][+-]?\\d+)?)\\b" });
    rules.push({ kind: "word", pattern: "[A-Za-z_$][\\w$]*" });
    return rules;
  }
  function compile(rules) {
    const kinds = [];
    const parts = rules.map((r, i) => {
      kinds[i] = r.kind;
      return `(?<g${i}>${r.pattern})`;
    });
    return { re: new RegExp(parts.join("|"), "g"), kinds };
  }
  var KIND_CLASS = {
    cmt: "tok-cmt",
    str: "tok-str",
    var: "tok-var",
    num: "tok-num",
    deco: "tok-deco"
  };
  function highlightCode(src, ext) {
    const langKey = EXT_LANG[ext.toLowerCase()] ?? "plain";
    const lang = LANGS[langKey];
    if (langKey === "plain") return esc(src);
    const wmap = wordClasses(lang);
    const { re, kinds } = compile(buildRules(lang));
    let out = "";
    let last = 0;
    let m;
    while ((m = re.exec(src)) !== null) {
      out += esc(src.slice(last, m.index));
      last = m.index + m[0].length;
      const g = m.groups ?? {};
      let kind;
      for (let i = 0; i < kinds.length; i++) if (g[`g${i}`] !== void 0) {
        kind = kinds[i];
        break;
      }
      const text = esc(m[0]);
      if (kind === "word") {
        const cls = wmap.get(m[0]);
        out += cls ? `<span class="${cls}">${text}</span>` : text;
      } else if (kind) out += `<span class="${KIND_CLASS[kind]}">${text}</span>`;
      else out += text;
      if (m[0].length === 0) re.lastIndex++;
    }
    out += esc(src.slice(last));
    return out;
  }
  function renderCode(src, ext) {
    let truncNote = "";
    if (src.length > RENDER_CAPS.codeChars) {
      src = src.slice(0, RENDER_CAPS.codeChars);
      truncNote = `<div class="fe-ql-note">Showing first ${RENDER_CAPS.codeChars.toLocaleString()} characters \u2014 open the raw file for the rest.</div>`;
    }
    const lines = src.split("\n").length;
    const gutter = Array.from({ length: lines }, (_, i) => i + 1).join("\n");
    return `${truncNote}<div class="fe-code-wrap"><pre class="fe-code-gut">${gutter}</pre><pre class="fe-code">${highlightCode(src, ext)}</pre></div>`;
  }
  function parseDSV(text, delim) {
    const rows = [];
    let row = [];
    let cell = "";
    let inQ = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQ) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            cell += '"';
            i++;
          } else inQ = false;
        } else cell += ch;
      } else if (ch === '"' && cell === "") {
        inQ = true;
      } else if (ch === delim) {
        row.push(cell);
        cell = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(cell);
        cell = "";
        rows.push(row);
        row = [];
      } else cell += ch;
    }
    if (cell !== "" || row.length) {
      row.push(cell);
      rows.push(row);
    }
    if (rows.length && rows[rows.length - 1].every((c) => c === "")) rows.pop();
    return rows;
  }
  function numericCols(rows) {
    const out = /* @__PURE__ */ new Set();
    if (rows.length < 2) return out;
    const width = rows[0].length;
    for (let c = 0; c < width; c++) {
      let seen = 0, num = 0;
      for (let r = 1; r < Math.min(rows.length, 200); r++) {
        const v = (rows[r][c] ?? "").trim();
        if (!v) continue;
        seen++;
        if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(v.replace(/,/g, ""))) num++;
      }
      if (seen > 0 && num / seen > 0.8) out.add(c);
    }
    return out;
  }
  function sortDSVRows(rows, col, dir, numeric) {
    const sorted = [...rows].sort((a, b) => {
      const va = (a[col] ?? "").trim(), vb = (b[col] ?? "").trim();
      const cmp = numeric ? (parseFloat(va.replace(/,/g, "")) || 0) - (parseFloat(vb.replace(/,/g, "")) || 0) : va.localeCompare(vb);
      return dir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }
  function renderDSVTable(header, dataRows, numCols, sort) {
    let truncNote = "";
    let rows = dataRows;
    if (rows.length > RENDER_CAPS.tableRows) {
      rows = rows.slice(0, RENDER_CAPS.tableRows);
      truncNote = `<div class="fe-ql-note">Showing first ${RENDER_CAPS.tableRows.toLocaleString()} of ${dataRows.length.toLocaleString()} rows.</div>`;
    }
    const ths = header.map((h, i) => {
      const arrow = sort?.col === i ? sort.dir === "asc" ? " \u2191" : " \u2193" : "";
      return `<th data-col="${i}" class="${numCols.has(i) ? "num" : ""}${sort?.col === i ? " sorted" : ""}" title="Click to sort">${esc(h)}${arrow}</th>`;
    }).join("");
    const trs = rows.map(
      (r) => `<tr>${header.map((_, i) => `<td class="${numCols.has(i) ? "num" : ""}">${esc(r[i] ?? "")}</td>`).join("")}</tr>`
    ).join("");
    return `${truncNote}<table class="fe-ql-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
  }
  function badUrl(url) {
    return /^\s*(javascript|data|vbscript):/i.test(url);
  }
  function resolveMdUrl(base, url) {
    if (!base) return url;
    if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("//") || url.startsWith("#")) return url;
    try {
      return new URL(url, base).href;
    } catch {
      return url;
    }
  }
  var HTML_TAGS = /* @__PURE__ */ new Set([
    "div",
    "span",
    "p",
    "br",
    "hr",
    "img",
    "a",
    "strong",
    "em",
    "b",
    "i",
    "u",
    "s",
    "code",
    "pre",
    "center",
    "sub",
    "sup",
    "details",
    "summary",
    "kbd",
    "picture",
    "source",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "li",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "blockquote"
  ]);
  var HTML_ATTRS = /* @__PURE__ */ new Set(["src", "href", "alt", "title", "width", "height", "align"]);
  var VOID_TAGS = /* @__PURE__ */ new Set(["br", "hr", "img", "source"]);
  function sanitizeHtml(html, baseUrl = "") {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const walk = (node) => {
      if (node.nodeType === Node.TEXT_NODE) return esc(node.textContent ?? "");
      if (node.nodeType !== Node.ELEMENT_NODE) return "";
      const el = node;
      const tag = el.tagName.toLowerCase();
      const kids = Array.from(el.childNodes).map(walk).join("");
      if (!HTML_TAGS.has(tag)) return kids;
      let attrs = "";
      for (const a of Array.from(el.attributes)) {
        if (!HTML_ATTRS.has(a.name)) continue;
        let val = a.value;
        if (a.name === "src" || a.name === "href") {
          if (badUrl(val)) continue;
          val = resolveMdUrl(baseUrl, val);
        }
        attrs += ` ${a.name}="${esc(val)}"`;
      }
      if (tag === "a" && /^https?:/i.test(resolveMdUrl(baseUrl, el.getAttribute("href") ?? ""))) {
        attrs += ' target="_blank" rel="noopener"';
      }
      return VOID_TAGS.has(tag) ? `<${tag}${attrs}>` : `<${tag}${attrs}>${kids}</${tag}>`;
    };
    return Array.from(doc.body.childNodes).map(walk).join("");
  }
  function mdInline(s, baseUrl = "") {
    let out = esc(s);
    out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
    out = out.replace(/!\[([^\]]*)\]\(([^)\s]+?)\)/g, (_m, alt, url) => {
      if (badUrl(url)) return alt;
      return `<img src="${resolveMdUrl(baseUrl, url)}" alt="${alt}" loading="lazy">`;
    });
    out = out.replace(/\[([^\]]+)\]\(([^)\s]+?)\)/g, (_m, t, url) => {
      if (badUrl(url)) return t;
      const u = resolveMdUrl(baseUrl, url);
      return `<a href="${u}"${/^https?:/i.test(u) ? ' target="_blank" rel="noopener"' : ""}>${t}</a>`;
    });
    out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
    out = out.replace(/~~([^~]+)~~/g, "<del>$1</del>");
    return out;
  }
  function renderMarkdown(src, baseUrl = "") {
    const lines = src.replace(/\r\n/g, "\n").split("\n");
    const out = [];
    let para = [];
    const flush = () => {
      if (para.length) {
        out.push(`<p>${mdInline(para.join(" "), baseUrl)}</p>`);
        para = [];
      }
    };
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const fence = line.match(/^```(\w*)\s*$/);
      if (fence) {
        flush();
        const buf = [];
        i++;
        while (i < lines.length && !/^```\s*$/.test(lines[i])) buf.push(lines[i++]);
        i++;
        const code = buf.join("\n");
        out.push(`<pre class="fe-md-pre">${fence[1] ? highlightCode(code, fence[1]) : esc(code)}</pre>`);
        continue;
      }
      const h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        flush();
        const n = h[1].length;
        out.push(`<h${n}>${mdInline(h[2], baseUrl)}</h${n}>`);
        i++;
        continue;
      }
      if (/^\s*<[a-zA-Z!/]/.test(line)) {
        flush();
        const buf = [];
        while (i < lines.length && !/^\s*$/.test(lines[i])) buf.push(lines[i++]);
        out.push(`<div class="fe-md-html">${sanitizeHtml(buf.join("\n"), baseUrl)}</div>`);
        continue;
      }
      if (para.length === 0 && /^\s*(?:\*{3,}|-{3,}|_{3,})\s*$/.test(line)) {
        flush();
        out.push("<hr>");
        i++;
        continue;
      }
      if (/^\s*>/.test(line)) {
        flush();
        const buf = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ""));
        out.push(`<blockquote>${renderMarkdown(buf.join("\n"), baseUrl)}</blockquote>`);
        continue;
      }
      const li = line.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
      if (li) {
        flush();
        const ordered = /\d/.test(li[2]);
        const items = [];
        while (i < lines.length) {
          const m = lines[i].match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
          if (!m) break;
          const depth = Math.min(Math.floor(m[1].length / 2), 4);
          items.push(`<li style="margin-left:${depth * 18}px">${mdInline(m[3], baseUrl)}</li>`);
          i++;
        }
        out.push(`<${ordered ? "ol" : "ul"}>${items.join("")}</${ordered ? "ol" : "ul"}>`);
        continue;
      }
      if (line.includes("|") && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*\s*$/.test(lines[i + 1])) {
        flush();
        const cells = (l) => l.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => mdInline(c.trim(), baseUrl));
        const head = cells(line);
        i += 2;
        const rows = [];
        while (i < lines.length && lines[i].includes("|")) rows.push(cells(lines[i++]));
        out.push(`<table class="fe-md-table"><thead><tr>${head.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
        continue;
      }
      if (/^\s*$/.test(line)) {
        flush();
        i++;
        continue;
      }
      para.push(line.trim());
      i++;
    }
    flush();
    return `<div class="fe-md">${out.join("\n")}</div>`;
  }
  function jsonLeaf(v) {
    if (v === null) return `<span class="tok-kw">null</span>`;
    switch (typeof v) {
      case "string": {
        const s = v.length > 500 ? v.slice(0, 500) + "\u2026" : v;
        return `<span class="tok-str">"${esc(s)}"</span>`;
      }
      case "number":
        return `<span class="tok-num">${v}</span>`;
      case "boolean":
        return `<span class="tok-kw">${v}</span>`;
      default:
        return esc(String(v));
    }
  }
  function jsonNode(key, v, depth, budget) {
    if (budget.n-- <= 0) return `<div class="fe-jt-row">\u2026</div>`;
    const keyHtml = key !== null ? `<span class="fe-jt-key">${esc(key)}</span><span class="fe-jt-colon">: </span>` : "";
    if (v !== null && typeof v === "object") {
      const isArr = Array.isArray(v);
      const entries = isArr ? v.map((x, i) => [String(i), x]) : Object.entries(v);
      const badge = isArr ? `[${entries.length}]` : `{${entries.length}}`;
      if (!entries.length) return `<div class="fe-jt-row">${keyHtml}<span class="fe-jt-badge">${isArr ? "[]" : "{}"}</span></div>`;
      const open = depth < 2 ? " open" : "";
      return `<details class="fe-jt"${open}><summary>${keyHtml}<span class="fe-jt-badge">${badge}</span></summary><div class="fe-jt-kids">${entries.map(([k, x]) => jsonNode(k, x, depth + 1, budget)).join("")}</div></details>`;
    }
    return `<div class="fe-jt-row">${keyHtml}${jsonLeaf(v)}</div>`;
  }
  function renderJsonTree(text) {
    let v;
    try {
      v = JSON.parse(text);
    } catch (err) {
      return `<div class="fe-ql-note err">Invalid JSON \u2014 ${esc(err.message)}</div><div class="fe-code-wrap"><pre class="fe-code">${esc(text.slice(0, RENDER_CAPS.codeChars))}</pre></div>`;
    }
    return `<div class="fe-jt-root">${jsonNode(null, v, 0, { n: RENDER_CAPS.treeNodes })}</div>`;
  }
  function renderJsonl(text) {
    const lines = text.split("\n").filter((l) => l.trim() !== "");
    let truncNote = "";
    let shown = lines;
    if (lines.length > RENDER_CAPS.jsonlLines) {
      shown = lines.slice(0, RENDER_CAPS.jsonlLines);
      truncNote = `<div class="fe-ql-note">Showing first ${RENDER_CAPS.jsonlLines.toLocaleString()} of ${lines.length.toLocaleString()} lines.</div>`;
    }
    const body = shown.map((line, i) => {
      try {
        const v = JSON.parse(line);
        const compact = JSON.stringify(v);
        const preview = compact.length > 140 ? compact.slice(0, 140) + "\u2026" : compact;
        return `<details class="fe-jl-line"><summary><span class="fe-jl-n">${i + 1}</span><span class="fe-jl-prev">${esc(preview)}</span></summary><div class="fe-jt-kids">${jsonNode(null, v, 1, { n: 2e3 })}</div></details>`;
      } catch {
        return `<div class="fe-jl-line bad"><span class="fe-jl-n">${i + 1}</span><span class="fe-jl-err">not JSON</span><span class="fe-jl-prev">${esc(line.slice(0, 200))}</span></div>`;
      }
    }).join("");
    return `${truncNote}<div class="fe-jl-root">${body}</div>`;
  }

  // src/file-fetch.ts
  function xhrDirect(url) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", url);
      xhr.onload = () => resolve(xhr.responseText);
      xhr.onerror = () => reject(new Error("XHR error"));
      xhr.send();
    });
  }
  function fetchFileText(rawUrl) {
    const url = new URL(rawUrl, location.href).href;
    return new Promise((resolve, reject) => {
      let relayed = false;
      try {
        chrome.runtime.sendMessage({ type: "bfb-fetch", url }, (res) => {
          if (relayed) return;
          relayed = true;
          if (chrome.runtime.lastError || !res) {
            xhrDirect(url).then(resolve, reject);
          } else if (res.ok) {
            resolve(res.text);
          } else {
            xhrDirect(url).then(resolve, () => reject(new Error(res.error || "read failed")));
          }
        });
      } catch {
        xhrDirect(url).then(resolve, reject);
      }
    });
  }

  // src/llm.ts
  function openProxyPort() {
    try {
      return chrome.runtime.connect({ name: "bfb-llm" });
    } catch {
      return null;
    }
  }
  function llmAvailability() {
    return new Promise((resolve) => {
      let done = false;
      const settle = (res) => {
        if (done) return;
        done = true;
        resolve(res);
      };
      const port = openProxyPort();
      if (!port) {
        settle({ kind: "unavailable", reason: "extension messaging unavailable" });
        return;
      }
      const timer = setTimeout(() => {
        try {
          port.disconnect();
        } catch {
        }
        settle({ kind: "unavailable", reason: "status check timed out" });
      }, 5e3);
      port.onMessage.addListener((msg) => {
        if (msg?.t !== "status" && msg?.t !== "error" && msg?.t !== "native-gone") return;
        clearTimeout(timer);
        try {
          port.disconnect();
        } catch {
        }
        if (msg.t === "status" && msg.data?.server === "up") {
          settle({ kind: "ready", cold: msg.data.latency_class !== "warm", status: msg.data });
        } else if (msg.t === "status") {
          settle({ kind: "down", status: msg.data });
        } else {
          settle({ kind: "unavailable", reason: msg.message || "lm host not found" });
        }
      });
      port.onDisconnect.addListener(() => {
        clearTimeout(timer);
        settle({ kind: "unavailable", reason: chrome.runtime.lastError?.message || "lm host not found" });
      });
      port.postMessage({ op: "status" });
    });
  }
  function llmQuery(opts, cb) {
    const port = openProxyPort();
    if (!port) {
      cb.onError("unavailable", "AI host not installed");
      return () => {
      };
    }
    let finished = false;
    let gotFrame = false;
    const finish = () => {
      finished = true;
      try {
        port.disconnect();
      } catch {
      }
    };
    port.onMessage.addListener((msg) => {
      if (finished || !msg) return;
      if (msg.t === "chunk") {
        gotFrame = true;
        cb.onChunk(msg.text ?? "");
      } else if (msg.t === "done") {
        finish();
        cb.onDone({ model: msg.model ?? "", ms: msg.ms ?? 0, truncated: !!msg.truncated });
      } else if (msg.t === "error") {
        finish();
        cb.onError(msg.code ?? "unknown", msg.message ?? "");
      } else if (msg.t === "native-gone") {
        finish();
        cb.onError(gotFrame ? "disconnected" : "unavailable", msg.message ?? "");
      }
    });
    port.onDisconnect.addListener(() => {
      if (!finished) {
        finished = true;
        cb.onError("disconnected", "AI host disconnected");
      }
    });
    port.postMessage({
      op: "query",
      ctx: opts.ctx,
      ctxName: opts.ctxName,
      intent: opts.intent,
      question: opts.question,
      timeout: opts.timeout ?? 120,
      model: opts.model
    });
    return () => finish();
  }
  function llmWarm(on) {
    return new Promise((resolve) => {
      let done = false;
      const settle = (r) => {
        if (!done) {
          done = true;
          resolve(r);
        }
      };
      const port = openProxyPort();
      if (!port) {
        settle({ ok: false, message: "AI host not installed" });
        return;
      }
      const timer = setTimeout(() => {
        try {
          port.disconnect();
        } catch {
        }
        settle({ ok: false, message: "timed out" });
      }, 3e4);
      port.onMessage.addListener((msg) => {
        if (msg?.t !== "warm" && msg?.t !== "error" && msg?.t !== "native-gone") return;
        clearTimeout(timer);
        try {
          port.disconnect();
        } catch {
        }
        settle(msg.t === "warm" ? { ok: !!msg.ok } : { ok: false, message: msg.message });
      });
      port.onDisconnect.addListener(() => {
        clearTimeout(timer);
        settle({ ok: false, message: chrome.runtime.lastError?.message });
      });
      port.postMessage({ op: "warm", on });
    });
  }
  var LLM_ERROR_TEXT = {
    server_down: "Local model server is down \u2014 run `lm status` in a terminal.",
    model_missing: "The model is not available on the server.",
    ctx_too_large: "This file is too large for the model.",
    timeout: "The model took too long and was stopped.",
    invalid_args: "Invalid request.",
    cancelled: "Cancelled.",
    host_no_lm: "The lm CLI was not found on this machine.",
    unavailable: "AI host not installed \u2014 run native/install.sh <extension-id>.",
    disconnected: "The AI host disconnected unexpectedly."
  };

  // src/preview.ts
  var FETCH_WARN_BYTES = 8 * 1024 * 1024;
  var PDF_EXTS = /* @__PURE__ */ new Set(["pdf"]);
  var VIDEO_EXTS = /* @__PURE__ */ new Set(["mp4", "m4v", "webm", "ogv", "mov"]);
  var AUDIO_EXTS = /* @__PURE__ */ new Set(["mp3", "wav", "ogg", "m4a", "aac", "flac"]);
  var FONT_EXTS = /* @__PURE__ */ new Set(["ttf", "otf", "woff", "woff2"]);
  function canPreview(e) {
    if (e.isDir || e.isParent) return false;
    const ext = getExt(e);
    return IMG_EXTS.has(ext) || PDF_EXTS.has(ext) || VIDEO_EXTS.has(ext) || AUDIO_EXTS.has(ext) || FONT_EXTS.has(ext) || TABLE_EXTS.has(ext) || JSONL_EXTS.has(ext) || ext === "json" || CODE_EXTS.has(ext) || ext === "";
  }
  function fontSpecimen(href) {
    const sample = "The quick brown fox jumps over the lazy dog 0123456789";
    const sizes = [14, 20, 28, 40, 56];
    return `<style>@font-face{font-family:'bfb-spec';src:url("${esc(href)}")}</style>
    <div class="fe-ql-font">
      ${sizes.map((s) => `<div style="font-size:${s}px">${sample}</div>`).join("")}
      <div style="font-size:30px">ABCDEFGHIJKLMNOPQRSTUVWXYZ<br>abcdefghijklmnopqrstuvwxyz</div>
    </div>`;
  }
  var deps;
  var overlay;
  var currentEntry = null;
  var currentText = null;
  var reqSeq = 0;
  var dsvHeader = [];
  var dsvRows = [];
  var dsvNum = /* @__PURE__ */ new Set();
  var dsvSort = null;
  var aiCancel = null;
  var aiSeq = 0;
  function initPreview(d) {
    deps = d;
    overlay = document.createElement("div");
    overlay.id = "fe-qlook";
    overlay.style.display = "none";
    overlay.innerHTML = `
    <div id="fe-ql-bg"></div>
    <div id="fe-ql-dialog">
      <div id="fe-ql-hdr">
        <span id="fe-ql-icon"></span>
        <span id="fe-ql-name"></span>
        <span id="fe-ql-meta"></span>
        <button id="fe-ql-copy" title="Copy full file contents to clipboard" disabled>
          <svg width="11" height="12" viewBox="0 0 11 12"><rect x="3" y="3" width="7" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M1 1h6v1" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
          <span>copy</span>
        </button>
        <a id="fe-ql-open" title="Open raw file in this tab">open raw \u2197</a>
        <button id="fe-ql-close" title="Close (Esc)">\u2715</button>
      </div>
      <div id="fe-ql-ai" style="display:none">
        <span id="fe-ql-ai-chip"><span class="dot"></span><span id="fe-ql-ai-chip-txt"></span></span>
        <button class="fe-ql-ai-btn" id="fe-ql-ai-sum" title="TL;DR of this file (local model)">Summarize</button>
        <button class="fe-ql-ai-btn" id="fe-ql-ai-exp"></button>
        <input id="fe-ql-ai-q" type="text" placeholder="Ask about this file\u2026" autocomplete="off" spellcheck="false">
        <button class="fe-ql-ai-btn" id="fe-ql-ai-ask" title="Answer grounded in this file only">Ask</button>
      </div>
      <div id="fe-ql-ai-out" style="display:none">
        <div id="fe-ql-ai-out-body"></div>
        <div id="fe-ql-ai-out-meta"></div>
      </div>
      <div id="fe-ql-body"></div>
    </div>`;
    document.getElementById("fe").appendChild(overlay);
    document.getElementById("fe-ql-close").addEventListener("click", closePreview);
    document.getElementById("fe-ql-bg").addEventListener("click", closePreview);
    const copyBtn = document.getElementById("fe-ql-copy");
    copyBtn.addEventListener("click", () => {
      if (currentText === null) return;
      const flash = (ok) => {
        copyBtn.querySelector("span").textContent = ok ? "\u2713 copied" : "failed";
        setTimeout(() => {
          copyBtn.querySelector("span").textContent = "copy";
        }, 1400);
      };
      navigator.clipboard.writeText(currentText).then(() => flash(true)).catch(() => {
        const ta = document.createElement("textarea");
        ta.value = currentText;
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        flash(ok);
      });
    });
    const aiQ = document.getElementById("fe-ql-ai-q");
    document.getElementById("fe-ql-ai-sum").addEventListener("click", () => runAi("summarize"));
    document.getElementById("fe-ql-ai-exp").addEventListener("click", function() {
      runAi(this.dataset.intent || "explain-code");
    });
    const askAi = () => {
      const q = aiQ.value.trim();
      if (!q) {
        aiQ.focus();
        return;
      }
      runAi("qa", q);
    };
    document.getElementById("fe-ql-ai-ask").addEventListener("click", askAi);
    aiQ.addEventListener("keydown", (e) => {
      if (e.key === "Enter") askAi();
      else if (e.key === "Escape") {
        e.stopPropagation();
        aiQ.blur();
      }
    });
    document.getElementById("fe-ql-body").addEventListener("click", (e) => {
      const th = e.target.closest(".fe-ql-table th");
      if (!th || !dsvHeader.length) return;
      const col = parseInt(th.dataset.col);
      dsvSort = dsvSort?.col === col ? { col, dir: dsvSort.dir === "asc" ? "desc" : "asc" } : { col, dir: "asc" };
      const sorted = sortDSVRows(dsvRows, col, dsvSort.dir, dsvNum.has(col));
      document.getElementById("fe-ql-body").innerHTML = renderDSVTable(dsvHeader, sorted, dsvNum, dsvSort);
    });
  }
  function isPreviewOpen() {
    return overlay?.style.display !== "none";
  }
  function closePreview() {
    overlay.style.display = "none";
    currentEntry = null;
    currentText = null;
    dsvHeader = [];
    dsvRows = [];
    dsvSort = null;
    document.getElementById("fe-ql-body").innerHTML = "";
    resetAiUi();
  }
  function resetAiUi() {
    aiCancel?.();
    aiCancel = null;
    aiSeq++;
    document.getElementById("fe-ql-ai").style.display = "none";
    document.getElementById("fe-ql-ai-out").style.display = "none";
    document.getElementById("fe-ql-ai-out-body").innerHTML = "";
    document.getElementById("fe-ql-ai-out-meta").textContent = "";
    document.getElementById("fe-ql-ai-q").value = "";
  }
  function setupAi(e, ext) {
    llmAvailability().then((av) => {
      if (currentEntry !== e || !isPreviewOpen()) return;
      if (av.kind === "unavailable") return;
      const tabular = TABLE_EXTS.has(ext) || JSONL_EXTS.has(ext) || ext === "json";
      const exp = document.getElementById("fe-ql-ai-exp");
      exp.textContent = tabular ? "Describe" : "Explain";
      exp.dataset.intent = tabular ? "describe-data" : "explain-code";
      exp.title = tabular ? "Schema + notable observations (local model)" : "What this does, with safety callouts (local model)";
      const ready = av.kind === "ready";
      const chip = document.getElementById("fe-ql-ai-chip");
      chip.className = ready ? av.cold ? "cold" : "ready" : "down";
      document.getElementById("fe-ql-ai-chip-txt").textContent = ready ? av.cold ? "AI \xB7 cold start" : "AI \xB7 ready" : "AI \xB7 lm server down";
      document.querySelectorAll(".fe-ql-ai-btn").forEach((b) => {
        b.disabled = !ready;
      });
      document.getElementById("fe-ql-ai-q").disabled = !ready;
      document.getElementById("fe-ql-ai").style.display = "";
    });
  }
  function runAi(intent, question) {
    if (currentText === null || !currentEntry) return;
    aiCancel?.();
    const seq = ++aiSeq;
    const body = document.getElementById("fe-ql-ai-out-body");
    const meta = document.getElementById("fe-ql-ai-out-meta");
    document.getElementById("fe-ql-ai-out").style.display = "";
    body.textContent = "";
    meta.textContent = "Thinking\u2026";
    let full = "";
    aiCancel = llmQuery(
      { ctx: currentText, ctxName: currentEntry.name, intent, question, model: deps.aiModel?.() },
      {
        onChunk: (t) => {
          if (seq !== aiSeq) return;
          full += t;
          body.textContent = full;
        },
        onDone: (info) => {
          if (seq !== aiSeq) return;
          aiCancel = null;
          body.innerHTML = renderMarkdown(full);
          meta.textContent = `${info.model} \xB7 ${(info.ms / 1e3).toFixed(1)}s` + (info.truncated ? " \xB7 input truncated to fit the model" : "");
        },
        onError: (code, message) => {
          if (seq !== aiSeq) return;
          aiCancel = null;
          if (code === "cancelled") return;
          body.textContent = LLM_ERROR_TEXT[code] ?? message;
          meta.textContent = "";
        }
      }
    );
  }
  function openPreview(e) {
    if (!canPreview(e)) return;
    currentEntry = e;
    const seq = ++reqSeq;
    const ext = getExt(e);
    document.getElementById("fe-ql-icon").innerHTML = getIcon(e, deps.iconRules());
    document.getElementById("fe-ql-name").textContent = e.name;
    document.getElementById("fe-ql-meta").textContent = `${fmtSize(e.rawBytes)}${ext ? " \xB7 ." + ext : ""}`;
    document.getElementById("fe-ql-open").href = e.href;
    const body = document.getElementById("fe-ql-body");
    overlay.style.display = "flex";
    dsvHeader = [];
    dsvRows = [];
    dsvSort = null;
    currentText = null;
    resetAiUi();
    const copyBtn = document.getElementById("fe-ql-copy");
    copyBtn.disabled = true;
    if (IMG_EXTS.has(ext) || PDF_EXTS.has(ext) || VIDEO_EXTS.has(ext) || AUDIO_EXTS.has(ext) || FONT_EXTS.has(ext)) {
      copyBtn.style.display = "none";
      if (IMG_EXTS.has(ext)) {
        body.innerHTML = `<div class="fe-ql-imgwrap"><img class="fe-ql-img" src="${esc(e.href)}" alt="${esc(e.name)}"><div class="fe-ql-dim"></div></div>`;
        const img = body.querySelector("img.fe-ql-img");
        const dim = body.querySelector(".fe-ql-dim");
        if (img && dim) {
          const show = () => {
            if (img.naturalWidth) dim.textContent = `${img.naturalWidth} \xD7 ${img.naturalHeight}`;
          };
          if (img.complete) show();
          else img.addEventListener("load", show, { once: true });
        }
      } else if (PDF_EXTS.has(ext)) body.innerHTML = `<embed class="fe-ql-pdf" src="${esc(e.href)}" type="application/pdf">`;
      else if (VIDEO_EXTS.has(ext)) body.innerHTML = `<div class="fe-ql-media-wrap"><video class="fe-ql-media" src="${esc(e.href)}" controls autoplay muted></video></div>`;
      else if (AUDIO_EXTS.has(ext)) body.innerHTML = `<div class="fe-ql-center"><audio src="${esc(e.href)}" controls></audio></div>`;
      else body.innerHTML = fontSpecimen(e.href);
      return;
    }
    copyBtn.style.display = "";
    setupAi(e, ext);
    if (e.rawBytes > FETCH_WARN_BYTES) {
      body.innerHTML = `
      <div class="fe-ql-center">
        <div class="fe-ql-note">File is ${fmtSize(e.rawBytes)} \u2014 large files can be slow to render.</div>
        <button id="fe-ql-force" class="fe-pbn">Load anyway</button>
      </div>`;
      document.getElementById("fe-ql-force").addEventListener("click", () => fetchAndRender(e, ext, seq));
      return;
    }
    fetchAndRender(e, ext, seq);
  }
  function fetchAndRender(e, ext, seq) {
    const body = document.getElementById("fe-ql-body");
    body.innerHTML = `<div class="fe-ql-center"><div class="fe-ql-note">Loading\u2026</div></div>`;
    fetchFileText(e.href).then((text) => {
      if (seq !== reqSeq) return;
      currentText = text;
      document.getElementById("fe-ql-copy").disabled = false;
      render(text, ext);
    }).catch((err) => {
      if (seq !== reqSeq) return;
      console.error("[BFB] preview failed:", e.href, err);
      body.innerHTML = `<div class="fe-ql-center"><div class="fe-ql-note err">Could not read file.</div></div>`;
    });
  }
  function render(text, ext) {
    const body = document.getElementById("fe-ql-body");
    if (sniffBinary(text)) {
      document.getElementById("fe-ql-ai").style.display = "none";
      body.innerHTML = `<div class="fe-ql-center"><div class="fe-ql-note">Binary file \u2014 no text preview.</div></div>`;
      return;
    }
    if (TABLE_EXTS.has(ext)) {
      const rows = parseDSV(text, ext === "tsv" ? "	" : ",");
      if (rows.length) {
        dsvHeader = rows[0];
        dsvRows = rows.slice(1);
        dsvNum = numericCols(rows);
        body.innerHTML = renderDSVTable(dsvHeader, dsvRows, dsvNum);
        return;
      }
      body.innerHTML = `<div class="fe-ql-center"><div class="fe-ql-note">Empty file.</div></div>`;
      return;
    }
    if (JSONL_EXTS.has(ext)) {
      body.innerHTML = renderJsonl(text);
      return;
    }
    if (ext === "json") {
      body.innerHTML = renderJsonTree(text);
      return;
    }
    if (ext === "md" || ext === "mdx") {
      body.innerHTML = renderMarkdown(text, currentEntry?.href ?? "");
      return;
    }
    body.innerHTML = renderCode(text, ext);
  }

  // src/selection.ts
  function selectionRange(anchor, target) {
    const lo = Math.min(anchor, target);
    const hi = Math.max(anchor, target);
    const out = [];
    for (let i = lo; i <= hi; i++) out.push(i);
    return out;
  }

  // src/sort-filter.ts
  function applyFilter(entries, config) {
    return entries.filter((e) => {
      if (config.type !== "all") {
        if (config.type === "folders" && !e.isDir) return false;
        if (config.type === "files" && e.isDir) return false;
        if (!["all", "folders", "files"].includes(config.type)) {
          if (getExt(e) !== config.type) return false;
        }
      }
      if (config.q) {
        if (config.regex) {
          try {
            if (!new RegExp(config.q, "i").test(e.name)) return false;
          } catch {
          }
        } else {
          if (!e.name.toLowerCase().includes(config.q.toLowerCase())) return false;
        }
      }
      return true;
    });
  }
  function applySort(entries, config) {
    if (!config.col) return entries;
    return [...entries].sort((a, b) => {
      let va, vb;
      if (config.col === "name") {
        va = a.name.toLowerCase();
        vb = b.name.toLowerCase();
      } else if (config.col === "size") {
        va = a.rawBytes;
        vb = b.rawBytes;
      } else if (config.col === "date") {
        va = Number.isFinite(a.dateMs) ? a.dateMs : 0;
        vb = Number.isFinite(b.dateMs) ? b.dateMs : 0;
      } else if (config.col === "type") {
        va = fmtType(a);
        vb = fmtType(b);
      } else if (config.col === "ext") {
        va = getExt(a);
        vb = getExt(b);
      } else return 0;
      const cmp = typeof va === "number" ? va - vb : String(va).localeCompare(String(vb));
      return config.dir === "asc" ? cmp : -cmp;
    });
  }
  function buildGroups(entries, mode) {
    if (mode === "folders-first") {
      const dirs = entries.filter((e) => e.isDir);
      const files = entries.filter((e) => !e.isDir);
      return [
        ...dirs.length ? [{ label: `Folders (${dirs.length})`, items: dirs }] : [],
        ...files.length ? [{ label: `Files (${files.length})`, items: files }] : []
      ];
    }
    if (mode === "files-first") {
      const dirs = entries.filter((e) => e.isDir);
      const files = entries.filter((e) => !e.isDir);
      return [
        ...files.length ? [{ label: `Files (${files.length})`, items: files }] : [],
        ...dirs.length ? [{ label: `Folders (${dirs.length})`, items: dirs }] : []
      ];
    }
    if (mode === "ext") {
      const map = /* @__PURE__ */ new Map();
      entries.forEach((e) => {
        const key = e.isDir ? "\u{1F4C1} Folders" : getExt(e) ? `.${getExt(e)}` : "Other";
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(e);
      });
      return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
    }
    if (mode === "type") {
      const map = /* @__PURE__ */ new Map();
      entries.forEach((e) => {
        const key = e.isDir ? "Folder" : fmtType(e);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(e);
      });
      return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
    }
    return [{ label: "All", items: entries }];
  }

  // src/render.ts
  function buildTipData(e, ctx) {
    if (e.isParent) {
      return JSON.stringify({ icon: "", name: "Parent Directory", lines: ["Navigate up one level"] });
    }
    const fullPath = ctx.rawPath.replace(/\/$/, "") + "/" + e.name + (e.isDir ? "/" : "");
    const lines = [`Path: ${fullPath}`, `Type: ${fmtType(e)}`];
    if (!e.isDir) lines.push(`Size: ${fmtSize(e.rawBytes)}`);
    lines.push(`Modified: ${fmtDate(e.dateMs, ctx.settings, e.dateStr)}`);
    if (e.isHidden) lines.push("Hidden file (dotfile)");
    if (IMG_EXTS.has(getExt(e))) lines.push("Image \u2014 dimensions require native host");
    const tip = {
      icon: getIcon(e, ctx.iconRules),
      name: e.name,
      lines,
      warn: "Permissions/creation date require native host"
    };
    return JSON.stringify(tip);
  }
  function itemActions(e, rawPath) {
    if (e.isParent) return "";
    const fullPath = rawPath.replace(/\/$/, "") + "/" + e.name + (e.isDir ? "/" : "");
    const dPath = esc(fullPath), dName = esc(e.name);
    const pvBtn = canPreview(e) ? `<button class="fe-act-btn fe-act-pv" title="Preview (Space)" data-pv="${dName}">
        <svg width="12" height="12" viewBox="0 0 13 13"><path d="M1 6.5C2.5 3 4.8 1.5 6.5 1.5S10.5 3 12 6.5C10.5 10 8.2 11.5 6.5 11.5S2.5 10 1 6.5z" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="6.5" cy="6.5" r="2" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
      </button>` : "";
    return `<span class="fe-acts" data-path="${dPath}" data-name="${dName}">
    ${pvBtn}<button class="fe-act-btn fe-act-cp" title="Copy full path" data-copy="${dPath}">
      <svg width="11" height="12" viewBox="0 0 11 12"><rect x="3" y="3" width="7" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M1 1h6v1" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
    </button>
    <button class="fe-act-btn fe-act-nm" title="Copy name" data-copy="${dName}">
      <svg width="11" height="11" viewBox="0 0 11 11"><path d="M2 3h7M2 6h7M2 9h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
    </button>
  </span>`;
  }
  function renderRow(e, ctx, idx = -1) {
    const tipData = buildTipData(e, ctx);
    return `<tr class="fe-row${e.isDir ? " dir" : ""}${e.isParent ? " par" : ""}${e.isHidden ? " dotfile" : ""}"
             data-name="${esc(e.name.toLowerCase())}"
             data-idx="${idx}"
             data-tip="${esc(tipData)}">
    <td class="c-nm"><a href="${e.href}" class="fe-lnk">${getIcon(e, ctx.iconRules)}<span class="fe-nm">${esc(e.isParent ? "Parent Directory" : e.name)}</span></a>${itemActions(e, ctx.rawPath)}</td>
    <td class="c-tp">${fmtType(e)}</td>
    <td class="c-sz">${e.isDir ? "\u2014" : fmtSize(e.rawBytes)}</td>
    <td class="c-dt">${fmtDate(e.dateMs, ctx.settings, e.dateStr)}</td>
  </tr>`;
  }
  function renderTile(e, ctx, idx = -1) {
    const tipData = buildTipData(e, ctx);
    const isImg = !e.isDir && !e.isParent && IMG_EXTS.has(getExt(e));
    const iconHtml = isImg ? `<span class="fe-tile-img-wrap"><img class="fe-tile-thumb" src="${esc(e.href)}" loading="lazy" alt="" onerror="this.closest('.fe-tile-img-wrap').classList.add('err')">${getIcon(e, ctx.iconRules)}</span>` : getIcon(e, ctx.iconRules);
    return `<a href="${e.href}" class="fe-tile${e.isDir ? " dir" : ""}${e.isParent ? " par" : ""}${e.isHidden ? " dotfile" : ""}"
            data-name="${esc(e.name.toLowerCase())}"
            data-idx="${idx}"
            data-tip="${esc(tipData)}">
    <span class="fe-tile-ic">${iconHtml}</span>
    <span class="fe-tile-nm">${esc(e.isParent ? ".." : e.name)}</span>
    ${!e.isDir && !e.isParent ? `<span class="fe-tile-sz">${fmtSize(e.rawBytes)}</span>` : ""}
    ${itemActions(e, ctx.rawPath)}
  </a>`;
  }
  function renderRows(entries, ctx, start = 0) {
    return entries.map((e, i) => renderRow(e, ctx, start + i)).join("");
  }
  function renderTiles(entries, ctx, start = 0) {
    return entries.map((e, i) => renderTile(e, ctx, start + i)).join("");
  }
  function renderBMList(bm, rawPath) {
    if (!bm.length) return `<div class="fe-hint">No bookmarks.<br>Click \u2606 in the path bar to add.</div>`;
    return bm.map((b) => `
    <div class="fe-bm-item" draggable="true" data-path="${esc(b.path)}">
      <span class="fe-drag-h">${PI.drag}</span>
      <a href="file://${esc(b.path)}" class="fe-si-link${b.path === rawPath ? " active" : ""}" title="${esc(b.path)}">
        ${PI.bm}<span class="fe-sl">${esc(b.label)}</span>
      </a>
      <button class="fe-rm-btn" data-path="${esc(b.path)}" title="Remove">\u2715</button>
    </div>`).join("");
  }
  function renderPlacesList(places, rawPath) {
    if (!places.length) return `<div class="fe-hint">No places yet.<br>Click + to add this folder.</div>`;
    return places.map((p) => `
    <div class="fe-bm-item fe-pl-item" draggable="true" data-path="${esc(p.path)}">
      <span class="fe-drag-h">${PI.drag}</span>
      <a href="file://${esc(p.path)}" class="fe-si-link${p.path === rawPath ? " active" : ""}" title="${esc(p.path)}">
        ${PI.folder}<span class="fe-sl fe-pl-label" title="Double-click to rename">${esc(p.label)}</span>
      </a>
      <button class="fe-rm-btn" data-path="${esc(p.path)}" title="Remove">\u2715</button>
    </div>`).join("");
  }
  function renderCrumbs(rawPath, segments) {
    const crumbs = [{ label: "/", href: "file:///" }];
    let acc = "/";
    for (const seg of segments) {
      acc += seg + "/";
      crumbs.push({ label: seg, href: "file://" + acc });
    }
    return crumbs.map(
      (c, i) => `<a href="${c.href}" class="fe-crumb">${esc(c.label)}</a><button class="fe-crumb-dd" data-url="${esc(c.href)}" title="Browse ${esc(c.href)}">\u25BE</button>` + (i < crumbs.length - 1 ? `<span class="fe-sep">\u203A</span>` : "")
    ).join("");
  }

  // src/main.ts
  (function() {
    const preload = document.getElementById("bfb-preload");
    if (!document.title.startsWith("Index of")) {
      preload?.remove();
      return;
    }
    const rawPath = decodeURIComponent(window.location.pathname);
    const segments = rawPath.split("/").filter(Boolean);
    const ALL_ENTRIES = parseEntries();
    if (segments.length && !ALL_ENTRIES.some((e) => e.isParent)) {
      const parentSegs = segments.slice(0, -1);
      ALL_ENTRIES.unshift({
        name: "..",
        href: "file:///" + parentSegs.map(encodeURIComponent).join("/") + (parentSegs.length ? "/" : ""),
        isDir: true,
        isParent: true,
        isHidden: false,
        rawBytes: -1,
        dateMs: NaN,
        dateStr: ""
      });
    }
    let sortConfig = { col: null, dir: "asc" };
    let groupConfig = "none";
    let filterConfig = { q: "", regex: false, type: "all" };
    let iconRules = getIconRules();
    let settings = getSettings();
    function getRenderCtx() {
      return { rawPath, iconRules, settings };
    }
    let VISIBLE = ALL_ENTRIES;
    let baseStatus = "";
    function applyAll() {
      const parent = ALL_ENTRIES.filter((e) => e.isParent);
      let entries = ALL_ENTRIES.filter((e) => !e.isParent);
      entries = applyFilter(entries, filterConfig);
      entries = applySort(entries, sortConfig);
      const ctx = getRenderCtx();
      const tbody = document.getElementById("fe-tbody");
      const tiles = document.getElementById("fe-tiles");
      VISIBLE = [];
      const rowParts = [], tileParts = [];
      const pushEntry = (e) => {
        const idx = VISIBLE.length;
        VISIBLE.push(e);
        rowParts.push(renderRow(e, ctx, idx));
        tileParts.push(renderTile(e, ctx, idx));
      };
      parent.forEach(pushEntry);
      if (groupConfig !== "none") {
        for (const g of buildGroups(entries, groupConfig)) {
          rowParts.push(`<tr class="fe-group-hdr"><td colspan="4">${esc(g.label)}</td></tr>`);
          tileParts.push(`<div class="fe-group-hdr-tile">${esc(g.label)}</div>`);
          g.items.forEach(pushEntry);
        }
      } else {
        entries.forEach(pushEntry);
      }
      tbody.innerHTML = rowParts.join("");
      tiles.innerHTML = tileParts.join("");
      const shown = VISIBLE.filter((en) => !en.isParent).length;
      const filtered = !!filterConfig.q || filterConfig.type !== "all";
      baseStatus = filtered ? `${shown} of ${nonPar.length} item${nonPar.length !== 1 ? "s" : ""} shown` : `${dirs} folder${dirs !== 1 ? "s" : ""}, ${files} file${files !== 1 ? "s" : ""}`;
      document.getElementById("fe-count").textContent = baseStatus;
      setSel(-1);
    }
    const nonPar = ALL_ENTRIES.filter((e) => !e.isParent);
    const dirs = nonPar.filter((e) => e.isDir).length;
    const files = nonPar.filter((e) => !e.isDir).length;
    const hidden = nonPar.filter((e) => e.isHidden).length;
    const allExts = [...new Set(nonPar.filter((e) => !e.isDir && getExt(e)).map(getExt))].sort();
    const extOpts = allExts.map((x) => `<option value="${x}">.${x}</option>`).join("");
    baseStatus = `${dirs} folder${dirs !== 1 ? "s" : ""}, ${files} file${files !== 1 ? "s" : ""}`;
    const initZoom = getZoom();
    const initView = getView();
    const initTheme = getTheme();
    const initHidden = getShowHidden();
    const initBM = getBM();
    const curIsBookmarked = initBM.some((b) => b.path === rawPath);
    const VIEW_MODES = [
      { id: "details", label: "Details", ico: `<svg width="13" height="11" viewBox="0 0 13 11"><path d="M1 1h11M1 4h11M1 7h11M1 10h7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>` },
      { id: "list", label: "List", ico: `<svg width="13" height="11" viewBox="0 0 13 11"><circle cx="2" cy="2" r="1.1" fill="currentColor"/><path d="M5 2h7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="2" cy="5.5" r="1.1" fill="currentColor"/><path d="M5 5.5h7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="2" cy="9" r="1.1" fill="currentColor"/><path d="M5 9h7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>` },
      { id: "tiles", label: "Tiles", ico: `<svg width="13" height="13" viewBox="0 0 13 13"><rect x="1" y="1" width="4.5" height="4.5" rx=".8" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="7.5" y="1" width="4.5" height="4.5" rx=".8" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="1" y="7.5" width="4.5" height="4.5" rx=".8" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="7.5" y="7.5" width="4.5" height="4.5" rx=".8" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>` },
      { id: "icons", label: "Large Icons", ico: `<svg width="13" height="13" viewBox="0 0 13 13"><rect x="1" y="1" width="5" height="5" rx="1" fill="currentColor" opacity=".6"/><rect x="7" y="1" width="5" height="5" rx="1" fill="currentColor" opacity=".6"/><rect x="1" y="7" width="5" height="5" rx="1" fill="currentColor" opacity=".6"/><rect x="7" y="7" width="5" height="5" rx="1" fill="currentColor" opacity=".6"/></svg>` }
    ];
    const VIEW_LABELS = {
      details: "Full table \u2014 Name, Type, Size, Modified",
      list: "Compact single-column rows",
      tiles: "Medium icon grid with filename below",
      icons: "Large icon grid"
    };
    const viewBtnsHTML = VIEW_MODES.map(
      (v) => `<button class="fe-view-btn" data-view="${v.id}" title="${v.label} view \u2014 ${VIEW_LABELS[v.id]}${v.id === initView ? " (active)" : ""}">${v.ico}</button>`
    ).join("");
    const FINDER_FAVORITES = [
      { label: "Screenshots", icon: "scrnsh", href: "file:///Users/alcatraz627/Pictures/Screenshots/" },
      { label: "Downloads", icon: "down", href: "file:///Users/alcatraz627/Downloads/" },
      { label: "Documents", icon: "docs", href: "file:///Users/alcatraz627/Documents/" },
      { label: "Code", icon: "code", href: "file:///Users/alcatraz627/Code/" },
      { label: "Versable", icon: "folder", href: "file:///Users/alcatraz627/Code/Versable/" },
      { label: "enhancement-product", icon: "folder", href: "file:///Users/alcatraz627/Code/Versable/enhancement-product/" },
      { label: "Applications", icon: "apps", href: "file:///Applications/" },
      { label: "Pictures", icon: "pics", href: "file:///Users/alcatraz627/Pictures/" },
      { label: "Desktop", icon: "desk", href: "file:///Users/alcatraz627/Desktop/" },
      { label: "resumes", icon: "docs", href: "file:///Users/alcatraz627/Code/Claude/resumes/" }
    ];
    const recents = getRecents().filter((r) => r.path !== rawPath).slice(0, 6);
    pushRecent(rawPath);
    const recentsHTML = recents.length ? `
      <div class="fe-sec">
        <div class="fe-sh">Recent</div>
        ${recents.map((r) => {
      const lbl = r.path.split("/").filter(Boolean).pop() || "/";
      return `<a href="file://${esc(r.path)}" class="fe-si" title="${esc(r.path)}">${PI.recent}<span class="fe-sl">${esc(lbl)}</span></a>`;
    }).join("")}
      </div>` : "";
    const ctx0 = getRenderCtx();
    const PAGE_HTML = `
<div id="fe" data-theme="${initTheme}" data-view="${initView}">

  <div id="fe-bar">
    <div id="fe-bc">${renderCrumbs(rawPath, segments)}</div>
    <button id="fe-term-btn" title="Open in terminal (${settings.terminalApp || "ghostty"}) \u2014 Click to open current folder \xB7 Shift+click copies command"><svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="1" width="12" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M3.5 5l3 2-3 2M8 9h3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    <button id="fe-bm-btn" class="${curIsBookmarked ? "on" : ""}" title="${curIsBookmarked ? "Remove bookmark for this folder" : "Bookmark this folder \u2014 saved in sidebar"}">
      <svg width="13" height="13" viewBox="0 0 13 13"><path id="fe-bm-path" d="M2.5 1h8v11l-4-2.8L2.5 12z" fill="${curIsBookmarked ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
    </button>
    <button id="fe-theme-btn" title="Toggle theme \u2014 currently ${initTheme === "light" ? "Light" : "Dark"}">
      <svg id="fe-sun" width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="2.8" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.9 2.9l1 1M10.1 10.1l1 1M10.1 2.9l-1 1M3.9 10.1l-1 1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
      <svg id="fe-moon" width="14" height="14" viewBox="0 0 14 14"><path d="M11.5 8.5A5 5 0 0 1 5.5 2.5a5 5 0 1 0 6 6z" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>
    </button>
    <button id="fe-settings-btn" title="Settings \u2014 customize theme, views, terminal, icon rules">
      <svg width="14" height="14" viewBox="0 0 14 14"><path d="M8.5 1H5.5L4.5 2.8 2.5 4 1 5.5v3L2.5 10l2 1.2L5.5 13h3l1-1.8 2-1.2L13 8.5v-3L11.5 4l-2-1.2z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><circle cx="7" cy="7" r="2" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>
    </button>
  </div>

  <div id="fe-body">
    <nav id="fe-side">
      <div class="fe-sec">
        <div class="fe-sh">Bookmarks</div>
        <div id="fe-bm-list">${renderBMList(initBM, rawPath)}</div>
      </div>
      <div class="fe-sec">
        <div class="fe-sh" style="justify-content:space-between">My Places
          <button id="fe-pl-add" title="Add this folder to Places">+</button></div>
        <div id="fe-pl-list">${renderPlacesList(getPlaces(), rawPath)}</div>
      </div>${recentsHTML}
      <div class="fe-sec">
        <div class="fe-sh">Finder Favorites</div>
        ${FINDER_FAVORITES.map(
      (p) => `<a href="${p.href}" class="fe-si${p.href.replace(/\/$/, "") === "file://" + rawPath.replace(/\/$/, "") ? " active" : ""}" title="${p.label}
${p.href}">${PI[p.icon] ?? PI.folder}<span class="fe-sl">${p.label}</span></a>`
    ).join("")}
      </div>
      <div class="fe-sec">
        <div class="fe-sh">System</div>
        <a href="file:///" class="fe-si" title="Root
file:///">${PI.root}<span class="fe-sl">Root /</span></a>
        <a href="file:///Users/alcatraz627/" class="fe-si" title="Home
file:///Users/alcatraz627/">${PI.home}<span class="fe-sl">Home</span></a>
      </div>
    </nav>

    <div id="fe-main">
      <div id="fe-toolbar">
        <span id="fe-count">${dirs} folder${dirs !== 1 ? "s" : ""}, ${files} file${files !== 1 ? "s" : ""}</span>
        <div id="fe-tb-right">
          <button id="fe-sg-btn" title="Sort &amp; Group \u2014 Click to toggle sort/group panel">
            <svg width="13" height="12" viewBox="0 0 13 12"><path d="M1 2h11M2 5h9M3.5 8h6M5.5 11h3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
            Sort
          </button>
          <button id="fe-filter-btn" title="Filter \u2014 Filter by filename pattern or file type">
            <svg width="13" height="12" viewBox="0 0 13 12"><path d="M1 2h11l-4.5 5v4l-2-1V7z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
          </button>
          <button id="fe-hidden-btn" class="${initHidden ? "on" : ""}" title="Hidden files \u2014 Currently: ${initHidden ? "showing" : "hiding"} dotfiles \xB7 Click to toggle">
            <svg width="13" height="13" viewBox="0 0 13 13"><path d="M1 6.5C2.5 3 4.8 1.5 6.5 1.5S10.5 3 12 6.5C10.5 10 8.2 11.5 6.5 11.5S2.5 10 1 6.5z" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="6.5" cy="6.5" r="2" fill="${initHidden ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.3"/></svg>
          </button>
          <div id="fe-zoom-wrap" title="Zoom \u2014 Scale the file list (50\u2013320%) \xB7 Currently: ${initZoom}% \xB7 Drag slider to adjust">
            <svg width="11" height="11" viewBox="0 0 11 11"><circle cx="4.5" cy="4.5" r="3.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M7.5 7.5L10 10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
            <input type="range" id="fe-zoom" min="50" max="320" value="${initZoom}" step="5" title="Zoom: ${initZoom}% \u2014 drag to scale">
            <span id="fe-zoom-val">${initZoom}%</span>
          </div>
          <div id="fe-view-group">${viewBtnsHTML}</div>
          <input id="fe-search" type="text" placeholder="Filter\u2026" autocomplete="off" spellcheck="false" title="Quick filter \u2014 Type to filter files by name in any view"/>
        </div>
      </div>

      <div id="fe-sg-panel" style="display:none">
        <div class="fe-panel-row">
          <span class="fe-panel-lbl">Sort by</span>
          <div class="fe-btn-group" id="fe-sort-cols">
            <button class="fe-pbn active" data-col="name" title="Sort by name (A\u2013Z or Z\u2013A)">Name</button>
            <button class="fe-pbn" data-col="size" title="Sort by file size">Size</button>
            <button class="fe-pbn" data-col="date" title="Sort by last modified date">Modified</button>
            <button class="fe-pbn" data-col="type" title="Sort by file type (folder, JS, image\u2026)">Type</button>
            <button class="fe-pbn" data-col="ext" title="Sort alphabetically by file extension">Extension</button>
          </div>
          <button class="fe-pbn" id="fe-sort-dir" title="Toggle sort direction (ascending / descending)">\u2191 Asc</button>
        </div>
        <div class="fe-panel-row">
          <span class="fe-panel-lbl">Group by</span>
          <div class="fe-btn-group" id="fe-group-btns">
            <button class="fe-pbn active" data-group="none" title="No grouping \u2014 flat list">None</button>
            <button class="fe-pbn" data-group="folders-first" title="Show all folders above files">Folders first</button>
            <button class="fe-pbn" data-group="files-first" title="Show all files above folders">Files first</button>
            <button class="fe-pbn" data-group="ext" title="Group items by file extension">Extension</button>
            <button class="fe-pbn" data-group="type" title="Group items by broad file type (image, video, code\u2026)">Type</button>
          </div>
        </div>
      </div>

      <div id="fe-filter-bar" style="display:none">
        <div class="fe-panel-row">
          <span class="fe-panel-lbl">Name</span>
          <input id="fe-filter-q" type="text" placeholder="pattern\u2026" autocomplete="off" spellcheck="false" title="Filter by name \u2014 supports plain text or regex (enable .* button)"/>
          <button id="fe-regex-btn" class="fe-pbn" title="Toggle regex mode \u2014 when active, pattern is treated as a regular expression">.*</button>
          <span class="fe-panel-lbl" style="margin-left:12px">Type</span>
          <select id="fe-type-filter" title="Filter by file type \u2014 show only folders, files, or a specific extension">
            <option value="all">All types</option>
            <option value="folders">Folders only</option>
            <option value="files">Files only</option>
            ${extOpts}
          </select>
        </div>
      </div>

      <div id="fe-scroll" style="zoom:${initZoom / 100}">
        <table id="fe-table">
          <thead>
            <tr>
              <th class="c-nm" data-ck="nm" data-sort="name">Name <span class="si">\u2195</span><span class="fe-col-rz"></span></th>
              <th class="c-tp" data-ck="tp">Type<span class="fe-col-rz"></span></th>
              <th class="c-sz" data-ck="sz" data-sort="size">Size <span class="si">\u2195</span><span class="fe-col-rz"></span></th>
              <th class="c-dt" data-ck="dt" data-sort="date">Modified <span class="si">\u2195</span></th>
            </tr>
          </thead>
          <tbody id="fe-tbody">${renderRows(ALL_ENTRIES, ctx0)}</tbody>
        </table>
        <div id="fe-tiles">${renderTiles(ALL_ENTRIES, ctx0)}</div>
      </div>

      <div id="fe-statusbar">
        <span id="fe-status-text">${dirs} folder${dirs !== 1 ? "s" : ""}, ${files} file${files !== 1 ? "s" : ""}</span>
        <span id="fe-status-path">${rawPath}</span>
      </div>
    </div>
  </div>

  <div id="fe-crumb-menu"></div>
  <div id="fe-tip"></div>
  <div id="fe-toast"></div>

  <div id="fe-settings-modal" style="display:none">
    <div id="fe-settings-bg"></div>
    <div id="fe-settings-dialog">
      <div id="fe-settings-hdr">
        <span>Settings</span>
        <button id="fe-settings-close" title="Close">\u2715</button>
      </div>
      <div id="fe-settings-body">

        <div class="fe-st-section">
          <div class="fe-st-title">Theme</div>
          <div class="fe-st-row">
            <label class="fe-st-radio"><input type="radio" name="bfb-theme" value="dark"> Dark</label>
            <label class="fe-st-radio"><input type="radio" name="bfb-theme" value="light"> Light</label>
          </div>
        </div>

        <div class="fe-st-section">
          <div class="fe-st-title">Appearance</div>
          <div class="fe-st-row">
            <span class="fe-st-lbl">Default view</span>
            <select id="fe-st-defview" class="fe-st-select">
              <option value="details">Details</option>
              <option value="list">List</option>
              <option value="tiles">Tiles</option>
              <option value="icons">Large Icons</option>
            </select>
          </div>
          <div class="fe-st-row">
            <label class="fe-st-check"><input type="checkbox" id="fe-st-compact"> Compact mode</label>
          </div>
          <div class="fe-st-row">
            <label class="fe-st-check"><input type="checkbox" id="fe-st-sidebar"> Show sidebar</label>
          </div>
          <div class="fe-st-row">
            <span class="fe-st-lbl">Date format</span>
            <select id="fe-st-datefmt" class="fe-st-select">
              <option value="short">Short \u2014 Apr 17</option>
              <option value="full">Full \u2014 April 17, 2025</option>
            </select>
          </div>
        </div>

        <div class="fe-st-section">
          <div class="fe-st-title">Terminal</div>
          <div class="fe-st-row">
            <span class="fe-st-lbl" title="Which terminal app to open when clicking the terminal button">Open with</span>
            <select id="fe-st-terminal" class="fe-st-select" title="Terminal app to open current folder in">
              <option value="ghostty">Ghostty (native host)</option>
              <option value="terminal">Terminal.app</option>
              <option value="iterm">iTerm2</option>
              <option value="wezterm">WezTerm</option>
              <option value="kitty">Kitty</option>
              <option value="custom">Custom command\u2026</option>
            </select>
          </div>
          <div class="fe-st-row" id="fe-st-term-custom-row" style="display:none">
            <input type="text" id="fe-st-term-custom" class="fe-st-input" placeholder='open -a MyTerm "\${p}"' title='Shell command template. Use \${p} as placeholder for the folder path.'>
          </div>
          <div class="fe-st-hint" id="fe-st-term-hint" style="font-size:11px;color:var(--dm);margin-top:-4px"></div>
        </div>

        <div class="fe-st-section">
          <div class="fe-st-title" style="display:flex;align-items:center;justify-content:space-between">
            <span>Local Model (AI)</span>
            <button id="fe-st-ai-refresh" class="fe-pbn" title="Re-check the lm server status">\u21BB Refresh</button>
          </div>
          <div id="fe-st-ai-card">
            <div class="fe-st-ai-head">
              <span class="fe-st-ai-blink"><span class="dot"></span></span>
              <span class="fe-st-ai-state">Checking\u2026</span>
            </div>
            <div class="fe-st-ai-grid" id="fe-st-ai-grid"></div>
            <div class="fe-st-ai-controls" id="fe-st-ai-controls" style="display:none">
              <span class="fe-st-lbl">Model</span>
              <select id="fe-st-ai-model" class="fe-st-select" title="Model used for AI queries (-m)"></select>
              <button id="fe-st-ai-warm" class="fe-pbn" title="Keep the model resident (lm warm)"></button>
            </div>
            <div class="fe-st-ai-hint" id="fe-st-ai-hint"></div>
          </div>
        </div>

        <div class="fe-st-section">
          <div class="fe-st-title" style="display:flex;align-items:center;justify-content:space-between">
            <span>Custom Icon Rules</span>
            <button id="fe-st-add-rule" class="fe-pbn">+ Add rule</button>
          </div>
          <div class="fe-st-rules-hint">Regex matched against filename (case-insensitive). Rules override built-in icons.</div>
          <div class="fe-st-rules-cols">
            <span></span><span></span>
            <span class="fe-st-col-lbl">Pattern (regex)</span>
            <span class="fe-st-col-lbl">Label</span>
            <span class="fe-st-col-lbl">Color</span>
            <span></span>
          </div>
          <div id="fe-st-rules-list"></div>
          <button id="fe-st-reset-rules" class="fe-pbn" style="margin-top:8px;align-self:flex-start;color:#f85149;border-color:#f8514940">Reset to defaults</button>
        </div>

      </div>
    </div>
  </div>
</div>`;
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
#fe-bar{display:flex;align-items:center;gap:6px;padding:8px 14px;
  background:var(--s1);border-bottom:1px solid var(--bd);flex-shrink:0;min-height:42px}
#fe-bc{display:flex;align-items:center;gap:1px;flex:1;overflow:hidden;white-space:nowrap;min-width:0}
.fe-crumb{color:var(--mt);text-decoration:none;padding:2px 5px;border-radius:4px;
  font-size:12px;flex-shrink:0;transition:background .1s,color .1s}
.fe-crumb:last-of-type{color:var(--tx);font-weight:500}
.fe-crumb:hover{background:var(--hover);color:var(--tx)}
.fe-sep{color:var(--dm);font-size:11px;flex-shrink:0;padding:0 1px}
#fe-bar .fe-crumb-dd{background:none;border:none;color:var(--dm);cursor:pointer;
  padding:0 2px;font-size:9px;border-radius:3px;line-height:1;opacity:0.35;
  transition:opacity .1s,color .1s,background .1s;flex-shrink:0;min-width:0}
#fe-bar .fe-crumb-dd:hover{background:var(--hover);color:var(--ac);opacity:1;border:none}
#fe-crumb-menu{
  position:fixed;z-index:300;
  background:var(--s1);border:1px solid var(--bd);border-radius:var(--r);
  min-width:220px;max-width:340px;max-height:340px;overflow:hidden;
  box-shadow:0 8px 24px #0009;display:none;padding:4px 0;
}
.fe-dd-search-wrap{padding:5px 8px 7px;border-bottom:1px solid var(--bd)}
.fe-dd-search{width:100%;background:var(--s2);border:1px solid var(--bd);color:var(--tx);
  padding:4px 8px;border-radius:5px;font-size:12px;outline:none;box-sizing:border-box}
.fe-dd-search:focus{border-color:var(--ac)}
.fe-dd-items{max-height:288px;overflow-y:auto;padding:2px 0}
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
#fe-body{display:flex;flex:1;overflow:hidden}
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
#fe-pl-add{background:none;border:1px solid var(--bd);color:var(--mt);cursor:pointer;border-radius:4px;
  width:18px;height:18px;line-height:1;font-size:13px;padding:0;display:flex;align-items:center;justify-content:center}
#fe-pl-add:hover{border-color:var(--ac);color:var(--ac)}
.fe-pl-label.editing{outline:1px solid var(--ac);border-radius:3px;background:var(--s2);padding:0 3px;cursor:text}
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
#fe-scroll{flex:1;overflow-y:auto;transform-origin:top left}
#fe-table{width:100%;border-collapse:collapse;table-layout:fixed}
thead{position:sticky;top:0;z-index:5;background:var(--s2)}
thead th{padding:6px 12px;text-align:left;font-size:11px;font-weight:600;
  text-transform:uppercase;letter-spacing:.07em;color:var(--dm);
  border-bottom:1px solid var(--bd);user-select:none;white-space:nowrap}
thead th{position:relative}
thead th[data-sort]{cursor:pointer}
thead th[data-sort]:hover{color:var(--tx)}
.fe-col-rz{position:absolute;top:0;right:0;width:7px;height:100%;cursor:col-resize;user-select:none}
.fe-col-rz:hover{background:linear-gradient(90deg,transparent,var(--ac))}
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
.fe-group-hdr td{padding:5px 12px;font-size:10.5px;font-weight:600;
  text-transform:uppercase;letter-spacing:.08em;color:var(--dm);
  background:var(--s2);border-bottom:1px solid var(--bd);border-top:1px solid var(--bd)}
.fe-group-hdr-tile{width:100%;padding:6px 4px 2px;font-size:10.5px;font-weight:600;
  text-transform:uppercase;letter-spacing:.08em;color:var(--dm)}
#fe:not(.show-hidden) .fe-row.dotfile,
#fe:not(.show-hidden) .fe-tile.dotfile{display:none!important}
#fe[data-view="list"] .c-tp,#fe[data-view="list"] .c-sz,#fe[data-view="list"] .c-dt{display:none}
#fe[data-view="list"] .c-nm{width:100%}
#fe[data-view="list"] tbody td{padding:4px 12px}
#fe-tiles{display:none;flex-wrap:wrap;gap:6px;padding:12px;align-content:flex-start}
#fe[data-view="tiles"] #fe-table,#fe[data-view="icons"] #fe-table{display:none}
#fe[data-view="tiles"] #fe-tiles,#fe[data-view="icons"] #fe-tiles{display:flex}
.fe-tile{display:flex;flex-direction:column;align-items:center;gap:5px;
  padding:10px 8px 8px;border-radius:var(--r);text-decoration:none;
  color:var(--tx);border:1px solid transparent;transition:all .12s;
  width:90px;overflow:hidden;cursor:pointer;position:relative}
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
.fe-tile-img-wrap{display:block;width:68px;height:56px;border-radius:5px;overflow:hidden;
  box-shadow:0 1px 4px #0005;flex-shrink:0}
.fe-tile-thumb{width:100%;height:100%;object-fit:cover;display:block;border-radius:5px}
.fe-tile-img-wrap svg{display:none;transform:none!important;margin:4px!important;width:24px;height:24px}
.fe-tile-img-wrap.err .fe-tile-thumb{display:none}
.fe-tile-img-wrap.err svg{display:block}
#fe[data-view="tiles"] .fe-tile-ic .fe-tile-img-wrap{width:68px;height:56px}
#fe[data-view="icons"] .fe-tile-ic .fe-tile-img-wrap{width:86px;height:70px}
#fe[data-view="tiles"] .fe-tile-ic .fe-tile-img-wrap svg,
#fe[data-view="icons"] .fe-tile-ic .fe-tile-img-wrap svg{transform:none!important;margin:8px!important}
.fe-row .fe-acts{
  display:inline-flex;align-items:center;gap:3px;
  position:absolute;right:8px;top:50%;transform:translateY(-50%);
  opacity:0;transition:opacity .12s;pointer-events:none}
.fe-row:hover .fe-acts{opacity:1;pointer-events:auto}
.fe-tile .fe-acts{
  display:flex;justify-content:center;gap:4px;
  position:absolute;bottom:0;left:0;right:0;
  padding:4px 4px 5px;
  background:linear-gradient(transparent,var(--s1)cc 40%,var(--s1) 100%);
  border-radius:0 0 var(--r) var(--r);
  opacity:0;transition:opacity .14s;pointer-events:none}
.fe-tile:hover .fe-acts{opacity:1;pointer-events:auto}
#fe[data-view="list"] .fe-tile .fe-acts{
  position:absolute;right:6px;top:50%;transform:translateY(-50%);
  background:none;border-radius:0;padding:0;width:auto;left:auto}
.fe-act-btn{
  background:var(--s2);border:1px solid var(--bd);border-radius:4px;
  color:var(--mt);cursor:pointer;padding:3px 5px;
  transition:background .1s,color .1s,border-color .1s;
  display:flex;align-items:center;justify-content:center}
.fe-act-btn:hover{background:var(--hover);color:var(--ac);border-color:var(--ac)}
.fe-row td.c-nm{position:relative}
#fe-statusbar{display:flex;justify-content:space-between;padding:4px 14px;
  background:var(--s1);border-top:1px solid var(--bd);flex-shrink:0;font-size:11px;color:var(--dm)}
#fe-tip{
  position:fixed;pointer-events:none;z-index:200;
  background:var(--s2);border:1px solid var(--bd);border-radius:var(--r);
  padding:9px 12px;font-size:11.5px;line-height:1.7;color:var(--tx);
  max-width:380px;overflow-wrap:anywhere;word-break:break-word;
  box-shadow:0 4px 20px #000a;opacity:0;
  transition:opacity .15s ease-out;
}
#fe-tip.show{opacity:1;transition:opacity .18s ease-in .06s}
.tip-header{display:flex;align-items:center;gap:7px;margin-bottom:4px}
.tip-icon{flex-shrink:0;display:flex;align-items:center}
.tip-icon svg{display:block}
.tip-name{font-weight:600;font-size:12px;word-break:break-all;color:var(--tx)}
.tip-line{color:var(--mt);font-size:11px;line-height:1.6}
.tip-warn{color:var(--dm);font-size:10.5px;margin-top:3px;border-top:1px solid var(--bd);padding-top:3px}
#fe-toast{
  position:fixed;bottom:32px;left:50%;transform:translateX(-50%) translateY(6px);
  background:#1f2937;color:#e5e7eb;padding:8px 18px;border-radius:20px;
  font-size:12px;opacity:0;transition:all .22s;pointer-events:none;white-space:nowrap;
  border:1px solid #374151;z-index:200
}
#fe-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--bd);border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:var(--dm)}
#fe.compact tbody td{padding:2px 12px}
#fe.compact .fe-tile{padding:6px 6px 5px;gap:3px}
#fe-settings-modal{position:fixed;inset:0;z-index:400;display:flex;align-items:center;justify-content:center}
#fe-settings-bg{position:absolute;inset:0;background:#00000088;backdrop-filter:blur(2px)}
#fe-settings-dialog{
  position:relative;z-index:1;
  background:var(--s1);border:1px solid var(--bd);border-radius:10px;
  width:520px;max-width:calc(100vw - 40px);max-height:82vh;
  display:flex;flex-direction:column;box-shadow:0 24px 64px #000d;
}
#fe-settings-hdr{
  display:flex;align-items:center;justify-content:space-between;
  padding:14px 18px;border-bottom:1px solid var(--bd);flex-shrink:0;
}
#fe-settings-hdr>span{font-size:14px;font-weight:600;color:var(--tx)}
#fe-settings-close{background:none;border:none;color:var(--dm);cursor:pointer;
  font-size:14px;padding:3px 7px;border-radius:4px;line-height:1;transition:color .1s,background .1s}
#fe-settings-close:hover{background:var(--hover);color:var(--tx)}
#fe-settings-body{overflow-y:auto;padding:16px 18px;display:flex;flex-direction:column;gap:20px}
.fe-st-section{display:flex;flex-direction:column;gap:10px}
.fe-st-title{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;
  color:var(--dm);padding-bottom:4px;border-bottom:1px solid var(--bd)}
.fe-st-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.fe-st-lbl{font-size:12px;color:var(--mt);min-width:90px;flex-shrink:0}
.fe-st-radio{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--tx);cursor:pointer}
.fe-st-radio input{accent-color:var(--ac);cursor:pointer}
.fe-st-check{display:flex;align-items:center;gap:7px;font-size:13px;color:var(--tx);cursor:pointer}
.fe-st-check input{accent-color:var(--ac);cursor:pointer;width:14px;height:14px}
.fe-st-select{background:var(--s2);border:1px solid var(--bd);color:var(--tx);
  padding:4px 8px;border-radius:var(--r);font-size:12px;outline:none;cursor:pointer}
.fe-st-input{background:var(--s2);border:1px solid var(--bd);color:var(--tx);
  padding:4px 8px;border-radius:var(--r);font-size:12px;outline:none;width:100%;
  font-family:inherit;box-sizing:border-box}
.fe-st-input:focus{border-color:var(--ac)}
.fe-st-rules-hint{font-size:11px;color:var(--dm);font-style:italic}
.fe-st-rules-cols{display:grid;grid-template-columns:16px 22px 1fr 58px 32px 24px;
  gap:6px;padding:0 2px 4px;align-items:center;font-size:10px;color:var(--dm)}
.fe-st-col-lbl{font-size:10px;color:var(--dm);font-weight:500}
.fe-st-rule{display:grid;grid-template-columns:16px 22px 1fr 58px 32px 24px;
  gap:6px;align-items:center;padding:5px 2px;border-bottom:1px solid var(--bd)}
.fe-st-rule:last-child{border-bottom:none}
.fe-st-rule input[type="checkbox"]{accent-color:var(--ac);cursor:pointer;width:13px;height:13px}
.fe-st-rule-preview{display:flex;align-items:center;justify-content:center;height:20px}
.fe-st-rule-pattern,.fe-st-rule-label{
  background:var(--s2);border:1px solid var(--bd);color:var(--tx);
  padding:3px 6px;border-radius:var(--r);font-size:11px;
  font-family:'SF Mono',Consolas,monospace;outline:none;transition:border-color .15s;width:100%}
.fe-st-rule-pattern:focus,.fe-st-rule-label:focus{border-color:var(--ac)}
.fe-st-rule-label{text-align:center}
.fe-st-rule-color{border:1px solid var(--bd);background:none;cursor:pointer;
  width:28px;height:24px;padding:1px;border-radius:4px;flex-shrink:0}
.fe-st-rule-del{background:none;border:none;color:var(--dm);cursor:pointer;
  padding:3px 5px;font-size:12px;border-radius:3px;line-height:1;transition:color .1s,background .1s;text-align:center}
.fe-st-rule-del:hover{color:#f85149;background:var(--hover)}
.fe-st-rules-empty{font-size:12px;color:var(--dm);padding:8px 2px;font-style:italic}
#fe-st-ai-card{background:var(--s2);border:1px solid var(--bd);border-radius:var(--r);padding:11px 13px}
.fe-st-ai-head{display:flex;align-items:center;gap:8px;margin-bottom:9px}
.fe-st-ai-blink{position:relative;display:inline-flex;width:9px;height:9px;flex-shrink:0}
.fe-st-ai-blink .dot{width:9px;height:9px;border-radius:50%;background:var(--dm);z-index:1}
.fe-st-ai-blink::after{content:'';position:absolute;inset:0;border-radius:50%;background:inherit}
.fe-st-ai-head.ready .dot{background:var(--green)}
.fe-st-ai-head.cold .dot{background:var(--gold)}
.fe-st-ai-head.down .dot,.fe-st-ai-head.off .dot{background:#f85149}
/* Pulsing halo only when the model is actually resident (ready). */
.fe-st-ai-head.ready .fe-st-ai-blink::after{background:var(--green);animation:fe-blink 1.6s ease-out infinite}
.fe-st-ai-head.cold .fe-st-ai-blink::after{background:var(--gold);animation:fe-blink 2.4s ease-out infinite}
@keyframes fe-blink{0%{transform:scale(1);opacity:.55}70%,100%{transform:scale(2.6);opacity:0}}
.fe-st-ai-state{font-size:12.5px;font-weight:600;color:var(--tx)}
.fe-st-ai-grid{display:grid;grid-template-columns:auto 1fr;gap:3px 12px;font-size:11.5px}
.fe-st-ai-grid .k{color:var(--dm)}
.fe-st-ai-grid .v{color:var(--tx);font-family:'SF Mono',Menlo,Consolas,monospace;font-size:11px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fe-st-ai-grid .v.warm-yes{color:var(--green)}
.fe-st-ai-grid .v.warm-no{color:var(--gold)}
.fe-st-ai-controls{display:flex;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap}
.fe-st-ai-controls .fe-st-select{flex:1;min-width:120px}
.fe-st-ai-hint{font-size:11px;color:var(--dm);margin-top:8px;line-height:1.5}
.fe-st-ai-hint code{background:var(--bg);border:1px solid var(--bd);border-radius:3px;padding:0 4px;
  font-family:'SF Mono',Menlo,Consolas,monospace;font-size:10.5px;color:var(--mt)}
.fe-row.selected td{background:var(--act)}
.fe-row.selected .fe-nm{color:var(--ac)}
.fe-tile.selected{background:var(--act);border-color:var(--ac)}
#fe-qlook{position:fixed;inset:0;z-index:350;display:flex;align-items:center;justify-content:center}
#fe-ql-bg{position:absolute;inset:0;background:#0009;backdrop-filter:blur(2px)}
#fe-ql-dialog{position:relative;z-index:1;background:var(--s1);border:1px solid var(--bd);
  border-radius:10px;width:min(880px,calc(100vw - 64px));height:min(78vh,900px);
  display:flex;flex-direction:column;box-shadow:0 24px 64px #000d;overflow:hidden}
#fe-ql-hdr{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--bd);flex-shrink:0}
#fe-ql-icon svg{display:block}
#fe-ql-name{font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#fe-ql-meta{font-size:11px;color:var(--dm);flex:1;white-space:nowrap}
#fe-ql-open{font-size:11px;color:var(--ac);text-decoration:none;padding:3px 8px;border:1px solid var(--bd);border-radius:5px;white-space:nowrap}
#fe-ql-open:hover{border-color:var(--ac)}
#fe-ql-copy{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--mt);background:none;
  cursor:pointer;padding:3px 8px;border:1px solid var(--bd);border-radius:5px;white-space:nowrap;line-height:1.4}
#fe-ql-copy:hover:not(:disabled){border-color:var(--ac);color:var(--ac)}
#fe-ql-copy:disabled{opacity:.45;cursor:default}
#fe-ql-close{background:none;border:none;color:var(--dm);cursor:pointer;font-size:13px;padding:3px 7px;border-radius:4px;line-height:1}
#fe-ql-close:hover{background:var(--hover);color:var(--tx)}
#fe-ql-body{flex:1;overflow:auto;font-size:12px}
#fe-ql-ai{display:flex;align-items:center;gap:6px;padding:7px 14px;
  border-bottom:1px solid var(--bd);background:var(--s2);flex-shrink:0}
#fe-ql-ai-chip{display:flex;align-items:center;gap:5px;font-size:10.5px;color:var(--dm);
  margin-right:4px;white-space:nowrap}
#fe-ql-ai-chip .dot{width:7px;height:7px;border-radius:50%;background:var(--dm);flex-shrink:0}
#fe-ql-ai-chip.ready .dot{background:var(--green)}
#fe-ql-ai-chip.cold .dot{background:var(--gold)}
#fe-ql-ai-chip.down .dot{background:#f85149}
.fe-ql-ai-btn{background:none;border:1px solid var(--bd);color:var(--mt);cursor:pointer;
  padding:3px 9px;border-radius:5px;font-size:11px;transition:all .12s;white-space:nowrap}
.fe-ql-ai-btn:hover:not(:disabled){border-color:var(--ac);color:var(--ac)}
.fe-ql-ai-btn:disabled{opacity:.45;cursor:default}
#fe-ql-ai-q{flex:1;min-width:80px;background:var(--s1);border:1px solid var(--bd);color:var(--tx);
  padding:4px 9px;border-radius:5px;font-size:11.5px;outline:none;transition:border-color .15s}
#fe-ql-ai-q:focus{border-color:var(--ac)}
#fe-ql-ai-q:disabled{opacity:.45}
#fe-ql-ai-q::placeholder{color:var(--dm)}
#fe-ql-ai-out{border-bottom:1px solid var(--bd);max-height:42%;overflow-y:auto;flex-shrink:0;background:var(--s1)}
#fe-ql-ai-out-body{padding:10px 16px 4px;font-size:12.5px;line-height:1.6;white-space:pre-wrap}
#fe-ql-ai-out-body .fe-md{padding:0;white-space:normal}
#fe-ql-ai-out-meta{padding:2px 16px 8px;font-size:10px;color:var(--dm)}
.fe-ql-center{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:10px}
.fe-ql-note{font-size:11.5px;color:var(--dm);padding:6px 14px}
.fe-ql-note.err{color:#f85149}
.fe-ql-imgwrap{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;height:100%;padding:16px}
.fe-ql-img{max-width:100%;max-height:calc(100% - 22px);object-fit:contain;border-radius:4px}
.fe-ql-dim{font-size:11px;color:var(--dm);font-variant-numeric:tabular-nums}
.fe-ql-pdf{width:100%;height:100%;border:none}
.fe-ql-media-wrap{display:flex;align-items:center;justify-content:center;height:100%;padding:16px}
.fe-ql-media{max-width:100%;max-height:100%;border-radius:4px;background:#000}
.fe-ql-center audio{width:min(480px,90%)}
.fe-ql-font{padding:20px 26px;overflow:auto;line-height:1.5}
.fe-ql-font>div{margin:6px 0;word-break:break-word;border-bottom:1px solid var(--s2);padding-bottom:6px}
.fe-code-wrap{display:flex;font:11.5px/1.55 'SF Mono',Menlo,Consolas,monospace;min-height:100%}
.fe-code-gut{padding:10px 8px 14px 12px;text-align:right;color:var(--dm);user-select:none;
  border-right:1px solid var(--bd);background:var(--s2);min-width:34px;flex-shrink:0}
.fe-code{padding:10px 14px 14px;white-space:pre;flex:1}
.tok-cmt{color:var(--mt);font-style:italic}
.tok-str{color:#7ee787}
.tok-kw{color:#ff7b72}
.tok-kw-ctrl{color:#ff7b72}
.tok-type{color:#56d4dd}
.tok-builtin{color:#ffa657}
.tok-lit{color:#a5d6ff}
.tok-num{color:#79c0ff}
.tok-var{color:#d2a8ff}
.tok-deco{color:#e2b340}
#fe[data-theme="light"] .tok-str{color:#0a7d33}
#fe[data-theme="light"] .tok-kw,#fe[data-theme="light"] .tok-kw-ctrl{color:#cf222e}
#fe[data-theme="light"] .tok-type{color:#1b7c83}
#fe[data-theme="light"] .tok-builtin{color:#953800}
#fe[data-theme="light"] .tok-lit{color:#0550ae}
#fe[data-theme="light"] .tok-num{color:#0550ae}
#fe[data-theme="light"] .tok-var{color:#8250df}
#fe[data-theme="light"] .tok-deco{color:#9a6700}
.fe-ql-table{border-collapse:collapse;width:100%;font:11.5px 'SF Mono',Menlo,Consolas,monospace}
.fe-ql-table th{position:sticky;top:0;background:var(--s2);padding:6px 10px;text-align:left;
  border-bottom:1px solid var(--bd);cursor:pointer;white-space:nowrap;color:var(--mt);font-weight:600;z-index:1}
.fe-ql-table th:hover{color:var(--tx)}
.fe-ql-table th.sorted{color:var(--ac)}
.fe-ql-table td{padding:4px 10px;border-bottom:1px solid var(--s2);white-space:nowrap;
  max-width:340px;overflow:hidden;text-overflow:ellipsis}
.fe-ql-table th.num,.fe-ql-table td.num{text-align:right;font-variant-numeric:tabular-nums}
.fe-ql-table tbody tr:hover{background:var(--hover)}
.fe-jt-root,.fe-jl-root{padding:10px 14px;font:11.5px/1.6 'SF Mono',Menlo,Consolas,monospace}
.fe-jt summary,.fe-jl-line summary{cursor:pointer;list-style:none}
.fe-jt summary::-webkit-details-marker,.fe-jl-line summary::-webkit-details-marker{display:none}
.fe-jt summary::before{content:'\u25B8';display:inline-block;width:12px;color:var(--dm);font-size:9px}
.fe-jt[open]>summary::before{content:'\u25BE'}
.fe-jt summary:hover{background:var(--hover)}
.fe-jt-kids{padding-left:16px;border-left:1px solid var(--s3);margin-left:4px}
.fe-jt-key{color:#79c0ff}
#fe[data-theme="light"] .fe-jt-key{color:#0550ae}
.fe-jt-colon{color:var(--dm)}
.fe-jt-badge{color:var(--dm);font-size:10.5px}
.fe-jt-row{padding-left:12px}
.fe-jl-line{border-bottom:1px solid var(--s2);padding:2px 0}
.fe-jl-line summary{display:flex;gap:8px;align-items:baseline}
.fe-jl-line summary::before{content:'\u25B8';color:var(--dm);font-size:9px;flex-shrink:0}
.fe-jl-line[open]>summary::before{content:'\u25BE'}
.fe-jl-n{color:var(--dm);min-width:28px;text-align:right;user-select:none;font-size:10.5px;flex-shrink:0}
.fe-jl-prev{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--mt)}
.fe-jl-line.bad{display:flex;gap:8px;align-items:baseline}
.fe-jl-err{color:#f85149;font-size:10px;border:1px solid #f8514940;border-radius:3px;padding:0 4px;flex-shrink:0}
.fe-md{padding:14px 22px 20px;font-size:13px;line-height:1.65;max-width:760px}
.fe-md h1{font-size:19px;border-bottom:1px solid var(--bd);padding-bottom:6px;margin:16px 0 10px}
.fe-md h2{font-size:16px;border-bottom:1px solid var(--bd);padding-bottom:4px;margin:14px 0 8px}
.fe-md h3{font-size:14px;margin:12px 0 6px}
.fe-md h4,.fe-md h5,.fe-md h6{font-size:13px;margin:10px 0 5px}
.fe-md p{margin:7px 0}
.fe-md code{background:var(--s2);border:1px solid var(--bd);padding:0 5px;border-radius:4px;
  font:11.5px 'SF Mono',Menlo,Consolas,monospace}
.fe-md-pre{background:var(--s2);border:1px solid var(--bd);border-radius:6px;padding:10px 12px;
  overflow-x:auto;font:11.5px/1.55 'SF Mono',Menlo,Consolas,monospace;margin:10px 0;white-space:pre}
.fe-md blockquote{border-left:3px solid var(--bd);padding:1px 12px;color:var(--mt);margin:8px 0}
.fe-md blockquote .fe-md{padding:0}
.fe-md ul,.fe-md ol{padding-left:24px;margin:7px 0}
.fe-md li{margin:3px 0}
.fe-md a{color:var(--ac);text-decoration:none}
.fe-md a:hover{text-decoration:underline}
.fe-md img{max-width:100%;border-radius:6px}
.fe-md hr{border:none;border-top:1px solid var(--bd);margin:14px 0}
.fe-md-table{border-collapse:collapse;margin:10px 0;font-size:12.5px}
.fe-md-table th,.fe-md-table td{border:1px solid var(--bd);padding:5px 11px;text-align:left}
.fe-md-table th{background:var(--s2);font-weight:600}
#fe-ctx{position:fixed;z-index:360;background:var(--s1);border:1px solid var(--bd);border-radius:var(--r);
  min-width:180px;box-shadow:0 8px 24px #0009;display:none;padding:4px 0}
.fe-ctx-item{display:flex;align-items:center;gap:8px;padding:6px 12px;color:var(--tx);
  font-size:12px;cursor:pointer;white-space:nowrap}
.fe-ctx-item:hover{background:var(--hover)}
.fe-ctx-key{margin-left:auto;color:var(--dm);font-size:10px;padding-left:16px}
.fe-ctx-sep{height:1px;background:var(--bd);margin:4px 0}
`;
    const dirName = segments[segments.length - 1] || "/";
    const shortDir = dirName.length > 20 ? dirName.slice(0, 20) + "\u2026" : dirName;
    document.title = `${shortDir} | Better File Browser`;
    const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="%230d1117"/><path d="M3 12.5A1.5 1.5 0 0 1 4.5 11h5.5l2.5 3H28a1.5 1.5 0 0 1 1.5 1.5V24A1.5 1.5 0 0 1 28 25.5H4.5A1.5 1.5 0 0 1 3 24z" fill="%234a9eff"/><path d="M9 18.5h14M9 22h9" stroke="white" stroke-width="2" stroke-linecap="round" opacity="0.75"/></svg>`;
    document.head.innerHTML = `<meta charset="utf-8"><title>${document.title}</title><link rel="icon" href="data:image/svg+xml,${faviconSvg}">`;
    document.body.innerHTML = PAGE_HTML;
    const styleEl = document.createElement("style");
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);
    preload?.remove();
    const fe = document.getElementById("fe");
    if (!settings.showSidebar) document.getElementById("fe-side").style.display = "none";
    if (settings.compactMode) fe.classList.add("compact");
    initPreview({ iconRules: () => iconRules, aiModel: () => settings.aiModel });
    const toastEl = document.getElementById("fe-toast");
    function toast(msg, ms = 2400) {
      toastEl.textContent = msg;
      toastEl.classList.add("show");
      clearTimeout(toastEl._tid);
      toastEl._tid = setTimeout(() => toastEl.classList.remove("show"), ms);
    }
    document.querySelectorAll(".fe-view-btn").forEach((btn) => {
      if (btn.dataset.view === initView) btn.classList.add("active");
      btn.addEventListener("click", () => {
        document.querySelectorAll(".fe-view-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        fe.dataset.view = btn.dataset.view;
        localStorage.setItem(VIEW_KEY, btn.dataset.view);
      });
    });
    const hiddenBtn = document.getElementById("fe-hidden-btn");
    if (initHidden) fe.classList.add("show-hidden");
    hiddenBtn.addEventListener("click", () => {
      const on = fe.classList.toggle("show-hidden");
      hiddenBtn.classList.toggle("on", on);
      hiddenBtn.title = `Hidden files \u2014 Currently: ${on ? "showing" : "hiding"} dotfiles \xB7 Click to toggle`;
      localStorage.setItem(HIDDEN_KEY, String(on));
      toast(on ? `Showing ${hidden} hidden file${hidden !== 1 ? "s" : ""}` : "Hidden files concealed");
    });
    const zoomEl = document.getElementById("fe-zoom");
    const zoomVal = document.getElementById("fe-zoom-val");
    const scroll = document.getElementById("fe-scroll");
    zoomEl.addEventListener("input", () => {
      const z = parseInt(zoomEl.value);
      scroll.style.zoom = String(z / 100);
      zoomVal.textContent = z + "%";
      zoomEl.title = `Zoom: ${z}% \u2014 drag to scale`;
      document.getElementById("fe-zoom-wrap").title = `Zoom \u2014 Scale the file list (50\u2013320%) \xB7 Currently: ${z}% \xB7 Drag slider to adjust`;
      localStorage.setItem(ZOOM_KEY, String(z));
    });
    document.querySelectorAll("th[data-sort]").forEach((th) => {
      th.addEventListener("click", () => {
        const col = th.dataset.sort;
        if (sortConfig.col === col) sortConfig.dir = sortConfig.dir === "asc" ? "desc" : "asc";
        else {
          sortConfig.col = col;
          sortConfig.dir = "asc";
        }
        document.querySelectorAll("#fe-sort-cols .fe-pbn").forEach((b) => b.classList.toggle("active", b.dataset.col === col));
        document.getElementById("fe-sort-dir").textContent = sortConfig.dir === "asc" ? "\u2191 Asc" : "\u2193 Desc";
        document.querySelectorAll("th[data-sort]").forEach((h) => {
          h.classList.remove("sorted");
          h.querySelector(".si").textContent = "\u2195";
        });
        th.classList.add("sorted");
        th.querySelector(".si").textContent = sortConfig.dir === "asc" ? "\u2191" : "\u2193";
        applyAll();
      });
    });
    function applyColWidths() {
      const w = getColWidths();
      document.querySelectorAll("thead th[data-ck]").forEach((th) => {
        const px = w[th.dataset.ck];
        if (px) th.style.width = px + "px";
      });
    }
    applyColWidths();
    document.querySelectorAll(".fe-col-rz").forEach((handle) => {
      handle.addEventListener("click", (e) => e.stopPropagation());
      handle.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const th = handle.closest("th");
        const key = th.dataset.ck;
        const startX = e.clientX, startW = th.offsetWidth;
        const onMove = (ev) => {
          th.style.width = Math.max(48, startW + ev.clientX - startX) + "px";
        };
        const onUp = (ev) => {
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);
          const all = getColWidths();
          all[key] = Math.max(48, startW + ev.clientX - startX);
          saveColWidths(all);
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      });
    });
    const sgPanel = document.getElementById("fe-sg-panel");
    document.getElementById("fe-sg-btn").addEventListener("click", () => {
      const open = sgPanel.style.display === "none";
      sgPanel.style.display = open ? "" : "none";
      document.getElementById("fe-sg-btn").classList.toggle("on", open);
    });
    document.querySelectorAll("#fe-sort-cols .fe-pbn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const col = btn.dataset.col;
        if (sortConfig.col === col) sortConfig.dir = sortConfig.dir === "asc" ? "desc" : "asc";
        else {
          sortConfig.col = col;
          sortConfig.dir = "asc";
        }
        document.querySelectorAll("#fe-sort-cols .fe-pbn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById("fe-sort-dir").textContent = sortConfig.dir === "asc" ? "\u2191 Asc" : "\u2193 Desc";
        applyAll();
      });
    });
    document.getElementById("fe-sort-dir").addEventListener("click", () => {
      sortConfig.dir = sortConfig.dir === "asc" ? "desc" : "asc";
      document.getElementById("fe-sort-dir").textContent = sortConfig.dir === "asc" ? "\u2191 Asc" : "\u2193 Desc";
      applyAll();
    });
    document.querySelectorAll("#fe-group-btns .fe-pbn").forEach((btn) => {
      btn.addEventListener("click", () => {
        groupConfig = btn.dataset.group;
        document.querySelectorAll("#fe-group-btns .fe-pbn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        applyAll();
      });
    });
    const filterBar = document.getElementById("fe-filter-bar");
    document.getElementById("fe-filter-btn").addEventListener("click", () => {
      const open = filterBar.style.display === "none";
      filterBar.style.display = open ? "" : "none";
      document.getElementById("fe-filter-btn").classList.toggle("on", open);
      if (open) document.getElementById("fe-filter-q").focus();
    });
    document.getElementById("fe-filter-q").addEventListener("input", function() {
      filterConfig.q = this.value;
      applyAll();
    });
    document.getElementById("fe-regex-btn").addEventListener("click", function() {
      filterConfig.regex = !filterConfig.regex;
      this.classList.toggle("active", filterConfig.regex);
      this.title = filterConfig.regex ? "Regex mode on" : "Toggle regex mode";
      applyAll();
    });
    document.getElementById("fe-type-filter").addEventListener("change", function() {
      filterConfig.type = this.value;
      applyAll();
    });
    const searchEl = document.getElementById("fe-search");
    searchEl.addEventListener("input", function() {
      filterConfig.q = this.value;
      const fq = document.getElementById("fe-filter-q");
      if (fq) fq.value = this.value;
      applyAll();
    });
    searchEl.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      if (searchEl.value) {
        searchEl.value = "";
        filterConfig.q = "";
        const fq = document.getElementById("fe-filter-q");
        if (fq) fq.value = "";
        applyAll();
      }
      searchEl.blur();
    });
    document.getElementById("fe-bm-btn").addEventListener("click", function() {
      const newBm = toggleBM(rawPath);
      const on = newBm.some((b) => b.path === rawPath);
      this.classList.toggle("on", on);
      document.getElementById("fe-bm-path").setAttribute("fill", on ? "currentColor" : "none");
      document.getElementById("fe-bm-list").innerHTML = renderBMList(newBm, rawPath);
      attachBMEvents();
      toast(on ? "Bookmarked" : "Bookmark removed");
    });
    document.getElementById("fe-theme-btn").addEventListener("click", () => {
      const next = fe.dataset.theme === "dark" ? "light" : "dark";
      fe.dataset.theme = next;
      localStorage.setItem(THEME_KEY, next);
    });
    function getTermCmd(path) {
      const app = settings.terminalApp || "ghostty";
      const tpl = app === "custom" ? settings.terminalCmd || 'cd "${p}"' : TERMINAL_CMDS[app] || TERMINAL_CMDS.ghostty;
      return tpl.replace(/\$\{p\}/g, path);
    }
    function openInTerminal(path) {
      const app = settings.terminalApp || "ghostty";
      if (app === "ghostty") {
        chrome.runtime.sendMessage(
          { type: "bfb-native-oneshot", host: "com.better_file_browser.ghostty", payload: { action: "open_terminal", path } },
          (res) => {
            if (chrome.runtime.lastError || !res?.ok) fallbackCopy(path);
          }
        );
        return;
      }
      fallbackCopy(path);
    }
    document.getElementById("fe-term-btn").addEventListener("click", () => openInTerminal(rawPath));
    function fallbackCopy(path) {
      const cmd = getTermCmd(path);
      navigator.clipboard.writeText(cmd).catch(() => {
      });
      toast(`Copied: ${cmd}`);
    }
    const tip = document.getElementById("fe-tip");
    let tipTimeout;
    scroll.addEventListener("mousemove", (e) => {
      const target = e.target.closest("[data-tip]");
      if (!target) {
        hideTip();
        return;
      }
      clearTimeout(tipTimeout);
      tipTimeout = setTimeout(() => showTip(target, e), 300);
    });
    scroll.addEventListener("mouseleave", hideTip);
    function showTip(el, ev) {
      try {
        const d = JSON.parse(el.getAttribute("data-tip") ?? "{}");
        const iconHtml = d.icon ? `<span class="tip-icon">${d.icon}</span>` : "";
        const linesHtml = (d.lines || []).map((l) => `<div class="tip-line">${esc(l)}</div>`).join("");
        const warnHtml = d.warn ? `<div class="tip-warn">\u26A0 ${esc(d.warn)}</div>` : "";
        tip.innerHTML = `<div class="tip-header">${iconHtml}<span class="tip-name">${esc(d.name || "")}</span></div>${linesHtml}${warnHtml}`;
      } catch {
        tip.innerHTML = `<div class="tip-name">${esc(el.getAttribute("data-tip") ?? "")}</div>`;
      }
      tip.classList.add("show");
      positionTip(ev);
    }
    function hideTip() {
      clearTimeout(tipTimeout);
      tip.classList.remove("show");
    }
    document.addEventListener("mousemove", (e) => {
      if (tip.classList.contains("show")) positionTip(e);
    });
    function positionTip(e) {
      const vw = window.innerWidth, vh = window.innerHeight;
      const tw = tip.offsetWidth || 280, th = tip.offsetHeight || 100;
      let x = e.clientX + 14, y = e.clientY + 14;
      if (x + tw > vw - 8) x = e.clientX - tw - 10;
      if (y + th > vh - 8) y = e.clientY - th - 10;
      tip.style.left = x + "px";
      tip.style.top = y + "px";
    }
    const crumbMenu = document.getElementById("fe-crumb-menu");
    let crumbMenuUrl = null;
    document.getElementById("fe-bc").addEventListener("click", async (e) => {
      const btn = e.target.closest(".fe-crumb-dd");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const url = btn.dataset.url;
      if (crumbMenu.style.display !== "none" && crumbMenuUrl === url) {
        closeCrumbMenu();
        return;
      }
      const rect = btn.getBoundingClientRect();
      crumbMenu.style.left = Math.min(rect.left, window.innerWidth - 260) + "px";
      crumbMenu.style.top = rect.bottom + 4 + "px";
      crumbMenu.style.display = "block";
      crumbMenu.innerHTML = '<div class="fe-dd-spinner">Loading\u2026</div>';
      crumbMenuUrl = url;
      const text = await fetchFileText(url).catch((err) => {
        console.error("[BFB] crumb dropdown failed:", url, err);
        return null;
      });
      if (text === null) {
        if (crumbMenuUrl === url) crumbMenu.innerHTML = '<div class="fe-dd-empty">Cannot load directory</div>';
        return;
      }
      if (crumbMenuUrl !== url) return;
      try {
        const entries = parseListing(text, url);
        if (!entries.length) {
          crumbMenu.innerHTML = '<div class="fe-dd-empty">Empty folder</div>';
          return;
        }
        crumbMenu.innerHTML = `<div class="fe-dd-search-wrap"><input class="fe-dd-search" type="text" placeholder="Filter\u2026" autocomplete="off" spellcheck="false"></div><div class="fe-dd-items">${entries.map(
          (en) => `<a href="${esc(en.href)}" class="fe-dd-item${en.isDir ? " dir" : ""}" data-name="${esc(en.name.toLowerCase())}">${getIcon(en, iconRules)}<span>${esc(en.name)}</span></a>`
        ).join("")}</div>`;
        const ddSearch = crumbMenu.querySelector(".fe-dd-search");
        ddSearch.focus();
        ddSearch.addEventListener("input", () => {
          const q = ddSearch.value.toLowerCase();
          crumbMenu.querySelectorAll(".fe-dd-item").forEach((it) => {
            it.style.display = it.dataset.name.includes(q) ? "" : "none";
          });
        });
        ddSearch.addEventListener("keydown", (ke) => {
          if (ke.key === "Escape") {
            ke.stopPropagation();
            closeCrumbMenu();
          } else if (ke.key === "Enter") {
            const first = [...crumbMenu.querySelectorAll(".fe-dd-item")].find((it) => it.style.display !== "none");
            if (first) location.href = first.href;
          }
        });
      } catch (err) {
        console.error("[BFB] crumb dropdown parse error:", url, err);
        if (crumbMenuUrl === url) crumbMenu.innerHTML = '<div class="fe-dd-empty">Cannot load directory</div>';
      }
    });
    document.addEventListener("click", (e) => {
      if (!crumbMenu.contains(e.target) && !e.target.classList.contains("fe-crumb-dd"))
        closeCrumbMenu();
    });
    function closeCrumbMenu() {
      crumbMenu.style.display = "none";
      crumbMenuUrl = null;
    }
    function copyText(val) {
      navigator.clipboard.writeText(val).then(() => toast(`Copied: ${val}`)).catch(() => {
        const ta = document.createElement("textarea");
        ta.value = val;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        toast(`Copied: ${val}`);
      });
    }
    scroll.addEventListener("click", (e) => {
      const pv = e.target.closest(".fe-act-pv");
      if (pv) {
        e.preventDefault();
        e.stopPropagation();
        const en = ALL_ENTRIES.find((x) => x.name === pv.dataset.pv);
        if (en) {
          setSel(VISIBLE.indexOf(en));
          openPreview(en);
        }
        return;
      }
      const btn = e.target.closest(".fe-act-btn");
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        copyText(btn.dataset.copy || "");
        return;
      }
      const holder = e.target.closest("[data-idx]");
      if (!holder) return;
      const i = parseInt(holder.dataset.idx);
      if ((e.shiftKey || e.metaKey || e.ctrlKey) && selectable(i)) {
        e.preventDefault();
        if (e.shiftKey) rangeSel(i);
        else toggleSel(i);
        return;
      }
      if (!e.target.closest("a") && selectable(i)) setSel(i);
    });
    const selSet = /* @__PURE__ */ new Set();
    let selIdx = -1;
    let anchor = -1;
    function entryShown(en) {
      return !en.isHidden || fe.classList.contains("show-hidden");
    }
    function selectable(i) {
      const en = VISIBLE[i];
      return !!en && !en.isParent && entryShown(en);
    }
    function paintSel() {
      document.querySelectorAll("#fe-scroll .selected").forEach((el) => el.classList.remove("selected"));
      selSet.forEach((i) => document.querySelectorAll(`#fe-scroll [data-idx="${i}"]`).forEach((el) => el.classList.add("selected")));
      const t = document.getElementById("fe-status-text");
      if (selSet.size > 1) {
        t.textContent = `${selSet.size} selected`;
      } else {
        const en = selIdx >= 0 ? VISIBLE[selIdx] : null;
        t.textContent = en && !en.isParent ? en.isDir ? `${en.name}/` : `${en.name} \u2014 ${fmtSize(en.rawBytes)}` : baseStatus;
      }
    }
    function scrollToLead() {
      if (selIdx < 0) return;
      document.querySelectorAll(`#fe-scroll [data-idx="${selIdx}"]`).forEach((el) => {
        if (el.offsetParent) el.scrollIntoView({ block: "nearest" });
      });
    }
    function setSel(i) {
      selSet.clear();
      selIdx = i;
      anchor = i;
      if (i >= 0) selSet.add(i);
      paintSel();
      scrollToLead();
    }
    function toggleSel(i) {
      if (selSet.has(i)) selSet.delete(i);
      else selSet.add(i);
      selIdx = i;
      anchor = i;
      paintSel();
    }
    function rangeSel(target) {
      const a = anchor >= 0 ? anchor : target;
      selSet.clear();
      selectionRange(a, target).filter(selectable).forEach((i) => selSet.add(i));
      selIdx = target;
      paintSel();
      scrollToLead();
    }
    function selectAll() {
      selSet.clear();
      for (let i = 0; i < VISIBLE.length; i++) if (selectable(i)) selSet.add(i);
      if (selSet.size && selIdx < 0) selIdx = [...selSet][0];
      paintSel();
    }
    function selectedPaths() {
      return [...selSet].sort((a, b) => a - b).map((i) => {
        const en = VISIBLE[i];
        return rawPath.replace(/\/$/, "") + "/" + en.name + (en.isDir ? "/" : "");
      });
    }
    function copySelection() {
      const paths = selectedPaths();
      if (!paths.length) return;
      navigator.clipboard.writeText(paths.join("\n")).then(
        () => toast(`Copied ${paths.length} path${paths.length !== 1 ? "s" : ""}`)
      ).catch(() => {
        const ta = document.createElement("textarea");
        ta.value = paths.join("\n");
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        toast(`Copied ${paths.length} path${paths.length !== 1 ? "s" : ""}`);
      });
    }
    function moveSel(step) {
      let i = selIdx;
      for (let n = 0; n < VISIBLE.length; n++) {
        i += step;
        if (i < 0 || i >= VISIBLE.length) return;
        if (entryShown(VISIBLE[i])) {
          setSel(i);
          return;
        }
      }
    }
    function tryPreview(en) {
      if (canPreview(en)) {
        setSel(VISIBLE.indexOf(en));
        openPreview(en);
      } else if (en.isDir || en.isParent) toast("Folders have no preview \u2014 press Enter to open");
      else toast("No preview for this file type");
    }
    function previewStep(step) {
      let i = selIdx;
      for (let n = 0; n < VISIBLE.length; n++) {
        i += step;
        if (i < 0 || i >= VISIBLE.length) return;
        const en = VISIBLE[i];
        if (entryShown(en) && canPreview(en)) {
          setSel(i);
          openPreview(en);
          return;
        }
      }
    }
    function goUp() {
      const up = ALL_ENTRIES.find((x) => x.isParent);
      if (up) location.href = up.href;
      else if (rawPath !== "/") location.href = "file:///";
    }
    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "f") {
        const s = document.getElementById("fe-search");
        if (document.activeElement !== s) {
          e.preventDefault();
          s.focus();
          s.select();
        }
        return;
      }
      const ae = document.activeElement;
      if (ae && ["INPUT", "TEXTAREA", "SELECT"].includes(ae.tagName)) return;
      if (settingsModal.style.display !== "none") return;
      if (e.metaKey && e.key === "ArrowUp") {
        e.preventDefault();
        goUp();
        return;
      }
      if (ctxMenu.style.display !== "none") {
        if (e.key === "Escape") closeCtx();
        return;
      }
      if (isPreviewOpen()) {
        if (e.key === "Escape" || e.key === " ") {
          e.preventDefault();
          closePreview();
        } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
          e.preventDefault();
          previewStep(1);
        } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
          e.preventDefault();
          previewStep(-1);
        }
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        moveSel(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        moveSel(-1);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        selectAll();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c" && selSet.size) {
        e.preventDefault();
        copySelection();
      } else if (e.key === "Enter" && selIdx >= 0) {
        location.href = VISIBLE[selIdx].href;
      } else if (e.key === "Backspace") {
        e.preventDefault();
        goUp();
      } else if (e.key === " " && selIdx >= 0) {
        e.preventDefault();
        tryPreview(VISIBLE[selIdx]);
      }
    });
    const ctxMenu = document.createElement("div");
    ctxMenu.id = "fe-ctx";
    ctxMenu.style.display = "none";
    fe.appendChild(ctxMenu);
    function closeCtx() {
      ctxMenu.style.display = "none";
    }
    scroll.addEventListener("contextmenu", (e) => {
      const holder = e.target.closest("[data-idx]");
      if (!holder) return;
      const idx = parseInt(holder.dataset.idx);
      const en = VISIBLE[idx];
      if (!en || en.isParent) return;
      e.preventDefault();
      const multi = selSet.size > 1 && selSet.has(idx);
      if (!multi) setSel(idx);
      ctxMenu.innerHTML = multi ? [
        `<div class="fe-ctx-item" data-act="cp-paths">Copy ${selSet.size} paths</div>`,
        `<div class="fe-ctx-item" data-act="cp-names">Copy ${selSet.size} names</div>`
      ].join("") : [
        canPreview(en) ? `<div class="fe-ctx-item" data-act="pv">Preview<span class="fe-ctx-key">Space</span></div>` : "",
        `<div class="fe-ctx-item" data-act="cp-path">Copy path</div>`,
        `<div class="fe-ctx-item" data-act="cp-name">Copy name</div>`,
        `<div class="fe-ctx-sep"></div>`,
        `<div class="fe-ctx-item" data-act="term">Open in terminal</div>`
      ].join("");
      ctxMenu.dataset.idx = String(idx);
      ctxMenu.style.display = "block";
      ctxMenu.style.left = Math.min(e.clientX, window.innerWidth - ctxMenu.offsetWidth - 8) + "px";
      ctxMenu.style.top = Math.min(e.clientY, window.innerHeight - ctxMenu.offsetHeight - 8) + "px";
    });
    ctxMenu.addEventListener("click", (e) => {
      const item = e.target.closest(".fe-ctx-item");
      if (!item) return;
      const en = VISIBLE[parseInt(ctxMenu.dataset.idx)];
      closeCtx();
      if (!en) return;
      const fullPath = rawPath.replace(/\/$/, "") + "/" + en.name + (en.isDir ? "/" : "");
      if (item.dataset.act === "pv") openPreview(en);
      else if (item.dataset.act === "cp-path") copyText(fullPath);
      else if (item.dataset.act === "cp-name") copyText(en.name);
      else if (item.dataset.act === "term") openInTerminal(en.isDir ? fullPath : rawPath);
      else if (item.dataset.act === "cp-paths") copySelection();
      else if (item.dataset.act === "cp-names") {
        const names = [...selSet].sort((a, b) => a - b).map((i) => VISIBLE[i].name).join("\n");
        navigator.clipboard.writeText(names).then(() => toast(`Copied ${selSet.size} names`)).catch(() => {
        });
      }
    });
    document.addEventListener("click", (e) => {
      if (ctxMenu.style.display !== "none" && !ctxMenu.contains(e.target)) closeCtx();
    });
    const settingsModal = document.getElementById("fe-settings-modal");
    function renderRulesList() {
      const list = document.getElementById("fe-st-rules-list");
      if (!iconRules.length) {
        list.innerHTML = '<div class="fe-st-rules-empty">No rules \u2014 click "+ Add rule" to create one.</div>';
        return;
      }
      list.innerHTML = iconRules.map((rule, i) => `
      <div class="fe-st-rule" data-idx="${i}">
        <input type="checkbox" class="fe-st-rule-en" title="Enable" ${rule.enabled ? "checked" : ""}>
        <div class="fe-st-rule-preview">${icoCustom(rule.label, rule.color)}</div>
        <input type="text" class="fe-st-rule-pattern" value="${esc(rule.pattern)}" placeholder="regex\u2026" title="Regex (case-insensitive)">
        <input type="text" class="fe-st-rule-label"   value="${esc(rule.label)}"   placeholder="LBL"   maxlength="4" title="Badge text (\u22644 chars)">
        <input type="color" class="fe-st-rule-color"  value="${rule.color}"        title="Icon color">
        <button class="fe-st-rule-del" data-idx="${i}" title="Delete">\u2715</button>
      </div>`).join("");
    }
    function updateTermHint() {
      const app = settings.terminalApp || "ghostty";
      const hint = document.getElementById("fe-st-term-hint");
      if (!hint) return;
      const cmd = app === "custom" ? settings.terminalCmd || "" : TERMINAL_CMDS[app] || "";
      hint.textContent = cmd ? `Command: ${cmd.replace(/\$\{p\}/g, rawPath)}` : "";
    }
    function openSettings() {
      document.querySelectorAll('input[name="bfb-theme"]').forEach((r) => {
        r.checked = r.value === (fe.dataset.theme || "dark");
      });
      document.getElementById("fe-st-defview").value = getView();
      document.getElementById("fe-st-compact").checked = !!settings.compactMode;
      document.getElementById("fe-st-sidebar").checked = settings.showSidebar !== false;
      document.getElementById("fe-st-datefmt").value = settings.dateFormat || "short";
      document.getElementById("fe-st-terminal").value = settings.terminalApp || "ghostty";
      document.getElementById("fe-st-term-custom-row").style.display = settings.terminalApp === "custom" ? "" : "none";
      document.getElementById("fe-st-term-custom").value = settings.terminalCmd || "";
      updateTermHint();
      renderRulesList();
      refreshAiStatus();
      settingsModal.style.display = "flex";
    }
    function closeSettings() {
      settingsModal.style.display = "none";
    }
    function refreshAiStatus() {
      const head = document.querySelector(".fe-st-ai-head");
      const state = document.querySelector(".fe-st-ai-state");
      const grid = document.getElementById("fe-st-ai-grid");
      const hint = document.getElementById("fe-st-ai-hint");
      const controls = document.getElementById("fe-st-ai-controls");
      const modelSel = document.getElementById("fe-st-ai-model");
      const warmBtn = document.getElementById("fe-st-ai-warm");
      head.className = "fe-st-ai-head";
      state.textContent = "Checking\u2026";
      grid.innerHTML = "";
      hint.innerHTML = "";
      controls.style.display = "none";
      const row = (k, v, cls = "") => `<span class="k">${esc(k)}</span><span class="v ${cls}">${esc(v)}</span>`;
      llmAvailability().then((av) => {
        if (av.kind === "unavailable") {
          head.classList.add("off");
          state.textContent = "Not installed";
          hint.innerHTML = `The native host isn't registered (${esc(av.reason)}). Install it once: run <code>native/install.sh &lt;extension-id&gt;</code> and reload the extension.`;
          return;
        }
        const s = av.status;
        const cls = av.kind === "down" ? "down" : av.cold ? "cold" : "ready";
        head.classList.add(cls);
        state.textContent = av.kind === "down" ? "Server down" : av.cold ? "Ready (cold \u2014 first reply loads the model)" : "Ready & warm";
        grid.innerHTML = [
          row("Default model", s.default_model || "\u2014"),
          row("Warm", s.warm ? "yes \u2014 model resident" : "no \u2014 loads on first use", s.warm ? "warm-yes" : "warm-no"),
          row("Latency", s.latency_class),
          row("Server", `${s.server}${s.host ? "  " + s.host : ""}`),
          s.toolkit_version ? row("Toolkit", `lm ${s.toolkit_version}`) : ""
        ].join("");
        if (av.kind === "ready" && s.available_models?.length) {
          const chosen = settings.aiModel || s.default_model;
          modelSel.innerHTML = s.available_models.map(
            (m) => `<option value="${esc(m)}"${m === chosen ? " selected" : ""}>${esc(m)}${m === s.default_model ? " (default)" : ""}</option>`
          ).join("");
          warmBtn.textContent = s.warm ? "Unload (warm off)" : "Keep warm";
          warmBtn.disabled = false;
          controls.style.display = "";
        }
        hint.innerHTML = av.kind === "down" ? `Ollama isn't responding. Start it, then Refresh.` : av.cold ? `Cold start \u2014 first reply loads the model (~2\u20133s). "Keep warm" makes replies instant.` : `Model is resident \u2014 replies are near-instant.`;
      });
    }
    document.getElementById("fe-st-ai-refresh").addEventListener("click", refreshAiStatus);
    document.getElementById("fe-st-ai-model").addEventListener("change", function() {
      settings.aiModel = this.value || void 0;
      saveSettings(settings);
    });
    document.getElementById("fe-st-ai-warm").addEventListener("click", function() {
      const btn = this;
      const turnOn = btn.textContent !== "Unload (warm off)";
      btn.disabled = true;
      btn.textContent = turnOn ? "Warming\u2026" : "Unloading\u2026";
      llmWarm(turnOn).then((r) => {
        if (!r.ok) toast(r.message ? `Warm failed: ${r.message}` : "Warm failed");
        refreshAiStatus();
      });
    });
    document.getElementById("fe-settings-btn").addEventListener("click", openSettings);
    document.getElementById("fe-settings-close").addEventListener("click", closeSettings);
    document.getElementById("fe-settings-bg").addEventListener("click", closeSettings);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && settingsModal.style.display !== "none") closeSettings();
    });
    document.querySelectorAll('input[name="bfb-theme"]').forEach((r) => {
      r.addEventListener("change", () => {
        fe.dataset.theme = r.value;
        localStorage.setItem(THEME_KEY, r.value);
      });
    });
    document.getElementById("fe-st-defview").addEventListener("change", function() {
      localStorage.setItem(VIEW_KEY, this.value);
    });
    document.getElementById("fe-st-compact").addEventListener("change", function() {
      settings.compactMode = this.checked;
      saveSettings(settings);
      fe.classList.toggle("compact", this.checked);
    });
    document.getElementById("fe-st-sidebar").addEventListener("change", function() {
      settings.showSidebar = this.checked;
      saveSettings(settings);
      document.getElementById("fe-side").style.display = this.checked ? "" : "none";
    });
    document.getElementById("fe-st-datefmt").addEventListener("change", function() {
      settings.dateFormat = this.value;
      saveSettings(settings);
      applyAll();
    });
    document.getElementById("fe-st-terminal").addEventListener("change", function() {
      settings.terminalApp = this.value;
      saveSettings(settings);
      document.getElementById("fe-st-term-custom-row").style.display = this.value === "custom" ? "" : "none";
      updateTermHint();
      const termBtn = document.getElementById("fe-term-btn");
      if (termBtn) termBtn.title = `Open in ${this.options[this.selectedIndex].text}`;
    });
    document.getElementById("fe-st-term-custom").addEventListener("input", function() {
      settings.terminalCmd = this.value;
      saveSettings(settings);
      updateTermHint();
    });
    const rulesList = document.getElementById("fe-st-rules-list");
    rulesList.addEventListener("change", (e) => {
      const row = e.target.closest(".fe-st-rule");
      if (!row) return;
      const idx = parseInt(row.dataset.idx);
      if (isNaN(idx) || idx >= iconRules.length) return;
      if (e.target.classList.contains("fe-st-rule-en"))
        iconRules[idx].enabled = e.target.checked;
      if (e.target.classList.contains("fe-st-rule-color")) {
        iconRules[idx].color = e.target.value;
        row.querySelector(".fe-st-rule-preview").innerHTML = icoCustom(iconRules[idx].label, iconRules[idx].color);
      }
      saveIconRules(iconRules);
      applyAll();
    });
    rulesList.addEventListener("input", (e) => {
      const row = e.target.closest(".fe-st-rule");
      if (!row) return;
      const idx = parseInt(row.dataset.idx);
      if (isNaN(idx) || idx >= iconRules.length) return;
      if (e.target.classList.contains("fe-st-rule-pattern"))
        iconRules[idx].pattern = e.target.value;
      if (e.target.classList.contains("fe-st-rule-label")) {
        iconRules[idx].label = e.target.value;
        row.querySelector(".fe-st-rule-preview").innerHTML = icoCustom(iconRules[idx].label, iconRules[idx].color);
      }
      saveIconRules(iconRules);
      applyAll();
    });
    rulesList.addEventListener("click", (e) => {
      const del = e.target.closest(".fe-st-rule-del");
      if (!del) return;
      const idx = parseInt(del.dataset.idx);
      if (!isNaN(idx)) {
        iconRules.splice(idx, 1);
        saveIconRules(iconRules);
        applyAll();
        renderRulesList();
      }
    });
    document.getElementById("fe-st-add-rule").addEventListener("click", () => {
      iconRules.push({ id: "r" + Date.now(), pattern: "", label: "NEW", color: "#58a6ff", enabled: true });
      saveIconRules(iconRules);
      renderRulesList();
      rulesList.querySelectorAll(".fe-st-rule-pattern").forEach((el, i, arr) => {
        if (i === arr.length - 1) el.focus();
      });
    });
    document.getElementById("fe-st-reset-rules").addEventListener("click", () => {
      iconRules = DEFAULT_ICON_RULES.map((r) => ({ ...r }));
      saveIconRules(iconRules);
      applyAll();
      renderRulesList();
      toast("Icon rules reset to defaults");
    });
    let dragSrc = null;
    function attachBMEvents() {
      const bmList = document.getElementById("fe-bm-list");
      bmList.querySelectorAll(".fe-rm-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          e.preventDefault();
          const bm = getBM().filter((b) => b.path !== btn.dataset.path);
          saveBM(bm);
          bmList.innerHTML = renderBMList(bm, rawPath);
          attachBMEvents();
          toast("Bookmark removed");
        });
      });
      bmList.querySelectorAll(".fe-bm-item").forEach((item) => {
        item.addEventListener("dragstart", (e) => {
          dragSrc = item;
          e.dataTransfer.effectAllowed = "move";
          setTimeout(() => item.classList.add("dragging"), 0);
        });
        item.addEventListener("dragend", () => item.classList.remove("dragging"));
        item.addEventListener("dragover", (e) => {
          e.preventDefault();
          item.classList.add("drag-over");
        });
        item.addEventListener("dragleave", () => item.classList.remove("drag-over"));
        item.addEventListener("drop", (e) => {
          e.stopPropagation();
          e.preventDefault();
          item.classList.remove("drag-over");
          if (!dragSrc || dragSrc === item) return;
          const bm = getBM();
          const fi = bm.findIndex((b) => b.path === dragSrc.dataset.path);
          const ti = bm.findIndex((b) => b.path === item.dataset.path);
          if (fi >= 0 && ti >= 0) {
            const [moved] = bm.splice(fi, 1);
            bm.splice(ti, 0, moved);
            saveBM(bm);
            bmList.innerHTML = renderBMList(bm, rawPath);
            attachBMEvents();
          }
        });
      });
    }
    attachBMEvents();
    const plList = document.getElementById("fe-pl-list");
    function refreshPlaces() {
      plList.innerHTML = renderPlacesList(getPlaces(), rawPath);
      attachPlaceEvents();
    }
    function startRename(lbl) {
      const item = lbl.closest(".fe-pl-item");
      const path = item.dataset.path;
      const orig = lbl.textContent || "";
      lbl.contentEditable = "true";
      lbl.classList.add("editing");
      lbl.focus();
      const range = document.createRange();
      range.selectNodeContents(lbl);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      let done = false;
      const finish = (save) => {
        if (done) return;
        done = true;
        const val = (lbl.textContent || "").trim();
        lbl.contentEditable = "false";
        lbl.classList.remove("editing");
        if (save && val && val !== orig) savePlaces(renamePlace(getPlaces(), path, val));
        refreshPlaces();
      };
      lbl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          finish(true);
        } else if (e.key === "Escape") {
          e.preventDefault();
          lbl.textContent = orig;
          finish(false);
        }
      });
      lbl.addEventListener("blur", () => finish(true), { once: true });
    }
    function attachPlaceEvents() {
      plList.querySelectorAll(".fe-rm-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          e.preventDefault();
          savePlaces(removePlace(getPlaces(), btn.dataset.path));
          refreshPlaces();
          toast("Removed from Places");
        });
      });
      plList.querySelectorAll(".fe-pl-label").forEach((lbl) => {
        lbl.addEventListener("dblclick", (e) => {
          e.preventDefault();
          e.stopPropagation();
          startRename(lbl);
        });
      });
      plList.querySelectorAll(".fe-pl-item").forEach((item) => {
        item.addEventListener("dragstart", (e) => {
          dragSrc = item;
          e.dataTransfer.effectAllowed = "move";
          setTimeout(() => item.classList.add("dragging"), 0);
        });
        item.addEventListener("dragend", () => item.classList.remove("dragging"));
        item.addEventListener("dragover", (e) => {
          e.preventDefault();
          item.classList.add("drag-over");
        });
        item.addEventListener("dragleave", () => item.classList.remove("drag-over"));
        item.addEventListener("drop", (e) => {
          e.stopPropagation();
          e.preventDefault();
          item.classList.remove("drag-over");
          if (!dragSrc || dragSrc === item) return;
          savePlaces(movePlace(getPlaces(), dragSrc.dataset.path, item.dataset.path));
          refreshPlaces();
        });
      });
    }
    document.getElementById("fe-pl-add").addEventListener("click", () => {
      const label = rawPath.split("/").filter(Boolean).pop() || "/";
      savePlaces(upsertPlace(getPlaces(), { path: rawPath, label }));
      refreshPlaces();
      toast("Added to Places");
      const fresh = [...plList.querySelectorAll(".fe-pl-item")].find((i) => i.dataset.path === rawPath);
      const lbl = fresh?.querySelector(".fe-pl-label");
      if (lbl) startRename(lbl);
    });
    attachPlaceEvents();
  })();
})();
