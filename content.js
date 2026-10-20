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
  function fileHref(path) {
    return "file://" + path.split("/").map(encodeURIComponent).join("/");
  }
  var DOWNLOAD_EXTS = /* @__PURE__ */ new Set(["yaml", "yml", "sql", "csv", "xml"]);
  function pageHref(href) {
    if (!/^[a-z]+:/i.test(href) && typeof location !== "undefined") {
      try {
        href = new URL(href, location.href).href;
      } catch {
      }
    }
    const m = href.match(/^(file:\/\/[^?#]*\/)([^/?#]+)$/);
    if (!m || !m[2].includes(".")) return href;
    return DOWNLOAD_EXTS.has(m[2].split(".").pop().toLowerCase()) ? `${m[1]}#view=${m[2]}` : href;
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
  var KINDS = {
    md: "Markdown",
    mdx: "MDX",
    txt: "Text",
    log: "Log",
    json: "JSON",
    jsonl: "JSON Lines",
    ndjson: "JSON Lines",
    jsonc: "JSON",
    yaml: "YAML",
    yml: "YAML",
    toml: "TOML",
    xml: "XML",
    csv: "CSV",
    tsv: "TSV",
    sql: "SQL",
    html: "HTML",
    htm: "HTML",
    css: "CSS",
    scss: "SCSS",
    js: "JavaScript",
    mjs: "JavaScript",
    cjs: "JavaScript",
    ts: "TypeScript",
    tsx: "TypeScript",
    jsx: "JavaScript",
    py: "Python",
    rb: "Ruby",
    go: "Go",
    rs: "Rust",
    java: "Java",
    kt: "Kotlin",
    swift: "Swift",
    c: "C",
    h: "C header",
    cpp: "C++",
    cs: "C#",
    php: "PHP",
    sh: "Shell",
    bash: "Shell",
    zsh: "Shell",
    fish: "Shell",
    env: "Env",
    ini: "INI",
    conf: "Config",
    diff: "Diff",
    patch: "Patch",
    svg: "SVG",
    proto: "Protobuf",
    graphql: "GraphQL",
    png: "PNG image",
    jpg: "JPEG image",
    jpeg: "JPEG image",
    gif: "GIF image",
    webp: "WebP image",
    heic: "HEIC image",
    ico: "Icon",
    pdf: "PDF",
    zip: "ZIP archive",
    gz: "Gzip archive",
    tar: "Tar archive",
    dmg: "Disk image",
    mp4: "Video",
    mov: "Video",
    mp3: "Audio",
    wav: "Audio",
    makefile: "Makefile",
    dockerfile: "Dockerfile",
    gitignore: "Git ignore"
  };
  var kindName = (ext2) => KINDS[ext2.toLowerCase()] ?? (ext2 ? `${ext2.toUpperCase()} file` : "File");
  function fmtType(e) {
    if (e.isParent) return "";
    if (e.isDir) return "Folder";
    return kindName(getExt(e));
  }
  function getExt(e) {
    if (e.isDir || e.isParent) return "";
    const bare = e.name.split("/").pop().toLowerCase();
    if (["dockerfile", "containerfile", "makefile", "gitignore"].includes(bare)) return bare;
    return e.name.includes(".") ? e.name.split(".").pop().toLowerCase() : "";
  }
  function fullPath(rawPath, e) {
    return rawPath.replace(/\/$/, "") + "/" + e.name + (e.isDir ? "/" : "");
  }
  function copyToClipboard(text) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        return ok;
      } catch {
        return false;
      }
    });
  }
  function splitMiddle(text, tail = 10) {
    const chars = Array.from(text);
    if (chars.length <= tail + 6) return { head: text, tail: "" };
    return { head: chars.slice(0, chars.length - tail).join(""), tail: chars.slice(chars.length - tail).join("") };
  }
  function midHtml(text) {
    const { head, tail } = splitMiddle(text);
    return `<span class="fe-mid"><span class="fe-mid-h">${esc(head)}</span>${tail ? `<span class="fe-mid-t">${esc(tail)}</span>` : ""}</span>`;
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
  function parseTags(text) {
    const out = [];
    for (const raw of text.split(/[,\s]+/)) {
      const t = raw.trim().toLowerCase();
      if (t && !out.includes(t)) out.push(t);
    }
    return out;
  }
  function setTags(list, path, tags) {
    return list.map((p) => p.path === path ? { ...p, tags: tags.length ? tags : void 0 } : p);
  }
  var TAG_COLORS = ["#58a6ff", "#3fb950", "#d29922", "#f778ba", "#a371f7", "#f0883e", "#39c5cf", "#8b949e"];
  function reconcileTags(list, tags) {
    const used = [];
    for (const p of list) for (const t of p.tags ?? []) if (!used.includes(t)) used.push(t);
    const kept = tags.filter((t) => used.includes(t.name));
    for (const name of used) {
      if (kept.some((t) => t.name === name)) continue;
      kept.push({ name, color: TAG_COLORS[kept.length % TAG_COLORS.length] });
    }
    return kept;
  }
  function cycleTagColor(tags, name) {
    return tags.map((t) => {
      if (t.name !== name) return t;
      const i = TAG_COLORS.indexOf(t.color);
      return { ...t, color: TAG_COLORS[(i + 1) % TAG_COLORS.length] };
    });
  }
  function filterSaved(list, text) {
    const q = text.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) => p.label.toLowerCase().includes(q) || p.path.toLowerCase().includes(q) || (p.tags ?? []).some((t) => t.includes(q)));
  }
  function groupByTag(list, tags) {
    const groups = [{ tag: null, items: list.filter((p) => !p.tags?.length) }];
    for (const tag of tags) {
      const items = list.filter((p) => p.tags?.[0] === tag.name);
      if (items.length) groups.push({ tag, items });
    }
    return groups;
  }
  function mergeLegacy(bookmarks, places) {
    let out = places.map((p) => ({ ...p }));
    for (const b of bookmarks) out = upsertPlace(out, { path: b.path, label: b.label });
    return out;
  }

  // src/kv.ts
  var MIGRATED = "bfb-kv-migrated";
  var NOT_KV = "bfb-strip-v2:";
  var cache = /* @__PURE__ */ new Map();
  var area = null;
  var watchers = [];
  function onKvChange(fn) {
    watchers.push(fn);
    if (!area) window.addEventListener("storage", (e) => {
      if (e.key && isKvKey(e.key)) fn(e.key);
    });
  }
  var isKvKey = (k) => k.startsWith("bfb-") && !k.startsWith(NOT_KV) && k !== MIGRATED;
  function chromeArea() {
    try {
      return typeof chrome !== "undefined" && chrome.storage?.local || null;
    } catch {
      return null;
    }
  }
  function localKeys() {
    const out = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && isKvKey(k)) out.push(k);
      }
    } catch {
    }
    return out;
  }
  async function loadKv() {
    const a = chromeArea();
    if (!a) return;
    let all;
    try {
      all = await a.get(null);
    } catch {
      return;
    }
    area = a;
    cache.clear();
    for (const [k, v] of Object.entries(all)) if (isKvKey(k) && typeof v === "string") cache.set(k, v);
    if (!all[MIGRATED]) {
      const moved = { [MIGRATED]: "1" };
      for (const k of localKeys()) {
        if (cache.has(k)) continue;
        const v = localStorage.getItem(k);
        if (v !== null) {
          cache.set(k, v);
          moved[k] = v;
        }
      }
      try {
        await a.set(moved);
      } catch {
      }
    }
    chrome.storage.onChanged.addListener((changes, name) => {
      if (name !== "local") return;
      for (const [k, c] of Object.entries(changes)) {
        if (!isKvKey(k)) continue;
        if (cache.get(k) === c.newValue) continue;
        if (typeof c.newValue === "string") cache.set(k, c.newValue);
        else cache.delete(k);
        watchers.forEach((fn) => fn(k));
      }
    });
  }
  function kvGet(key) {
    if (!area) {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    }
    return cache.get(key) ?? null;
  }
  function kvSet(key, value) {
    if (!area) {
      try {
        localStorage.setItem(key, value);
      } catch {
      }
      return;
    }
    cache.set(key, value);
    try {
      area.set({ [key]: value }).catch(() => {
      });
    } catch {
    }
  }
  function kvKeys() {
    return area ? [...cache.keys()] : localKeys();
  }

  // src/storage.ts
  var BM_KEY = "bfb-bookmarks-v2";
  var RECENTS_KEY = "bfb-recents-v1";
  var COL_WIDTHS_KEY = "bfb-col-widths-v1";
  var PLACES_KEY = "bfb-places-v1";
  var SAVED_KEY = "bfb-saved-v1";
  var TAGS_KEY = "bfb-tags-v1";
  var VIEW_KEY = "bfb-view";
  var THEME_KEY = "bfb-theme";
  var ZOOM_KEY = "bfb-zoom";
  var HIDDEN_KEY = "bfb-show-hidden";
  var ICON_RULES_KEY = "bfb-icon-rules-v1";
  var SETTINGS_KEY = "bfb-settings-v1";
  var SORT_KEY = "bfb-sort-v1";
  var GROUP_KEY = "bfb-group-v1";
  var PREVIEW_LAYOUT_KEY = "bfb-preview-layout-v1";
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
    terminalCmd: "",
    excludedFileExtensions: ["pdf", "html", "htm"]
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
      const r = JSON.parse(kvGet(ICON_RULES_KEY) ?? "null");
      return Array.isArray(r) && r.length > 0 ? r : DEFAULT_ICON_RULES.map((r2) => ({ ...r2 }));
    } catch {
      return DEFAULT_ICON_RULES.map((r) => ({ ...r }));
    }
  }
  function saveIconRules(r) {
    kvSet(ICON_RULES_KEY, JSON.stringify(r));
  }
  function getSettings() {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(kvGet(SETTINGS_KEY) ?? "{}") };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }
  function saveSettings(s) {
    kvSet(SETTINGS_KEY, JSON.stringify(s));
  }
  function readList(key) {
    try {
      const v = JSON.parse(kvGet(key) ?? "[]");
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }
  function getSaved() {
    if (kvGet(SAVED_KEY) !== null) return readList(SAVED_KEY);
    const merged = mergeLegacy(readList(BM_KEY), readList(PLACES_KEY));
    kvSet(SAVED_KEY, JSON.stringify(merged));
    return merged;
  }
  function saveSaved(list) {
    kvSet(SAVED_KEY, JSON.stringify(list));
    kvSet(TAGS_KEY, JSON.stringify(reconcileTags(list, readList(TAGS_KEY))));
  }
  function getTags() {
    return reconcileTags(getSaved(), readList(TAGS_KEY));
  }
  function saveTags(tags) {
    kvSet(TAGS_KEY, JSON.stringify(tags));
  }
  function getRecents() {
    try {
      return JSON.parse(kvGet(RECENTS_KEY) ?? "[]");
    } catch {
      return [];
    }
  }
  function pushRecent(path) {
    const list = getRecents().filter((r) => r.path !== path);
    list.unshift({ path, ts: Date.now() });
    kvSet(RECENTS_KEY, JSON.stringify(list.slice(0, 20)));
  }
  var HOME_KEY = "bfb-home-v1";
  function homeDir(path) {
    const seen = path.match(/^\/Users\/[^/]+/)?.[0];
    if (seen && seen !== "/Users/Shared") {
      if (kvGet(HOME_KEY) !== seen) kvSet(HOME_KEY, seen);
      return seen;
    }
    return kvGet(HOME_KEY) ?? "";
  }
  function getColWidths() {
    try {
      return JSON.parse(kvGet(COL_WIDTHS_KEY) ?? "{}");
    } catch {
      return {};
    }
  }
  function saveColWidths(w) {
    kvSet(COL_WIDTHS_KEY, JSON.stringify(w));
  }
  var SORT_COLS = ["name", "size", "date", "type", "ext"];
  var GROUP_MODES = ["none", "folders-first", "files-first", "ext", "type"];
  function getSortConfig() {
    try {
      const s = JSON.parse(kvGet(SORT_KEY) ?? "null");
      if (s && SORT_COLS.includes(s.col) && (s.dir === "asc" || s.dir === "desc")) return { col: s.col, dir: s.dir };
    } catch {
    }
    return { col: null, dir: "asc" };
  }
  function saveSortConfig(s) {
    kvSet(SORT_KEY, JSON.stringify(s));
  }
  function getGroupMode() {
    const g = kvGet(GROUP_KEY);
    return g && GROUP_MODES.includes(g) ? g : "none";
  }
  function saveGroupMode(g) {
    kvSet(GROUP_KEY, g);
  }
  var px = (v) => typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : void 0;
  function getPreviewLayout() {
    try {
      const l = JSON.parse(kvGet(PREVIEW_LAYOUT_KEY) ?? "null");
      if (l && (l.mode === "modal" || l.mode === "side"))
        return { mode: l.mode, modalW: px(l.modalW), modalH: px(l.modalH), sideW: px(l.sideW) };
    } catch {
    }
    return { mode: "modal" };
  }
  function savePreviewLayout(l) {
    kvSet(PREVIEW_LAYOUT_KEY, JSON.stringify(l));
  }
  function getView() {
    return kvGet(VIEW_KEY) ?? "details";
  }
  function getTheme() {
    return kvGet(THEME_KEY) ?? "dark";
  }
  function getZoom() {
    const z = parseInt(kvGet(ZOOM_KEY) ?? "100");
    return Number.isFinite(z) ? z : 100;
  }
  function getShowHidden() {
    return kvGet(HIDDEN_KEY) === "true";
  }

  // src/control-icons.ts
  var svg = (body) => `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  var UI_ICON = {
    appearance: svg('<circle cx="7" cy="7" r="2.5"/><path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.8 2.8l1.1 1.1m6.2 6.2 1.1 1.1m0-8.4-1.1 1.1m-6.2 6.2-1.1 1.1"/>'),
    preview: svg('<rect x="1.5" y="2" width="11" height="10" rx="1.5"/><path d="M8 2v10"/>'),
    files: svg('<path d="M3 1.5h5l3 3V12H3z"/><path d="M8 1.5v3h3M5 7h4M5 9h4"/>'),
    exclusions: svg('<path d="M7 1l5 2v3.5c0 3-2 5-5 6.5-3-1.5-5-3.5-5-6.5V3z"/><path d="M5 7h4"/>'),
    notes: svg('<path d="M2 2h10v10H2zM4 5h6M4 7h6M4 9h4"/>'),
    tab: svg('<path d="M1.5 3h4l1.2 1.5h5.8v7H1.5z"/><path d="M8.5 7.5v3M7 9h3"/>'),
    terminal: svg('<rect x="1" y="2" width="12" height="10" rx="1.5"/><path d="m3.5 5 2 2-2 2M7 9h3"/>'),
    data: svg('<ellipse cx="7" cy="3" rx="5" ry="2"/><path d="M2 3v7c0 1.1 2.2 2 5 2s5-.9 5-2V3M2 6.5c0 1.1 2.2 2 5 2s5-.9 5-2"/>'),
    ai: svg('<path d="M7 1.5 8.2 5.8 12.5 7l-4.3 1.2L7 12.5 5.8 8.2 1.5 7l4.3-1.2z"/>'),
    keyboard: svg('<rect x="1" y="3" width="12" height="8" rx="1.5"/><path d="M3 5h.5M5.5 5H6M8 5h.5M10.5 5h.5M3 7.5h.5M5.5 7.5H6M8 7.5h.5M10.5 7.5h.5M4.5 9h5"/>'),
    reset: svg('<path d="M2.5 5A5 5 0 1 1 2 8M2.5 2.5V5H5"/>'),
    add: svg('<path d="M7 2v10M2 7h10"/>'),
    export: svg('<path d="M7 1.5v7m-2.5-2.5L7 8.5 9.5 6M2 10v2h10v-2"/>'),
    import: svg('<path d="M7 9V2m-2.5 2.5L7 2l2.5 2.5M2 10v2h10v-2"/>'),
    warm: svg('<path d="M7 1.5c1 2-1 2.7-.5 4 1-1 1.8-1.2 2-2 .5 2 3 3.1 3 5.1A4.5 4.5 0 0 1 7 13a4.5 4.5 0 0 1-4.5-4.4c0-2 1.4-3.8 3-4.8-.2 1.2.2 1.8.6 2.2C7 4.5 6 3.5 7 1.5z"/>'),
    unload: svg('<path d="M7 1v12M2 4l10 6M2 10l10-6M4.5 2.5 7 4l2.5-1.5M4.5 11.5 7 10l2.5 1.5"/>'),
    close: svg('<path d="m3 3 8 8M11 3l-8 8"/>'),
    // the notes editor's toolbar and header (owner: an icon left of the text on every button)
    list: svg('<path d="M5 3.5h7M5 7h7M5 10.5h7"/><circle cx="2.5" cy="3.5" r=".6"/><circle cx="2.5" cy="7" r=".6"/><circle cx="2.5" cy="10.5" r=".6"/>'),
    task: svg('<rect x="1.5" y="2" width="4" height="4" rx=".8"/><path d="m2.5 4 1 1 1.5-2M7.5 4h5M1.5 9h4v3h-4zM7.5 10.5h5"/>'),
    table: svg('<rect x="1.5" y="2.5" width="11" height="9" rx="1"/><path d="M1.5 5.5h11M5.5 2.5v9M9 2.5v9"/>'),
    image: svg('<rect x="1.5" y="2.5" width="11" height="9" rx="1"/><circle cx="5" cy="5.5" r="1"/><path d="m1.5 10 3.5-3 3 2.5 2-1.5 2.5 2"/>'),
    versions: svg('<path d="M2.5 5A5 5 0 1 1 2 8M2.5 2.5V5H5M7 4.5V7l2 1.5"/>'),
    external: svg('<path d="M8 2h4v4M12 2 6.5 7.5M10 8.5V12H2V4h3.5"/>'),
    // notes properties and the image toolbar
    pin: svg('<path d="M8.5 1.5 12.5 5.5 10.5 6.5 9 8l.5 2.5L3.5 4.5 6 5l1.5-1.5zM5.5 8.5 2 12"/>'),
    tag: svg('<path d="M1.5 2.5v4.2L7.8 13l4.7-4.7L6.2 2H2z"/><circle cx="4.4" cy="4.9" r=".8"/>'),
    palette: svg('<path d="M7 1.5C3.9 1.5 1.5 3.8 1.5 6.8S3.9 12.5 6.5 12.5c1.2 0 1.3-.9.8-1.5-.5-.6-.2-1.5.7-1.5H10.5c1.2 0 2-.9 2-2.1C12.5 4.2 10.2 1.5 7 1.5z"/><circle cx="4.5" cy="6" r=".7"/><circle cx="7" cy="4.3" r=".7"/><circle cx="9.5" cy="6" r=".7"/>'),
    zoomIn: svg('<circle cx="6" cy="6" r="4"/><path d="m9 9 3.5 3.5M6 4v4M4 6h4"/>'),
    zoomOut: svg('<circle cx="6" cy="6" r="4"/><path d="m9 9 3.5 3.5M4 6h4"/>'),
    actualSize: svg('<rect x="2" y="2" width="10" height="10" rx="1"/><path d="M5 5.2 7 4v6M5 10h4"/>'),
    rotate: svg('<path d="M11.5 7A4.5 4.5 0 1 1 10 3.6M11.5 1.5v2.5H9"/>'),
    flip: svg('<path d="M7 1.5v11M5 4 1.5 10.5H5zM9 4l3.5 6.5H9z"/>'),
    fit: svg('<path d="M1.5 5V1.5H5M9 1.5h3.5V5M12.5 9v3.5H9M5 12.5H1.5V9"/>'),
    rename: svg('<path d="M9.5 2 12 4.5 5 11.5 2 12l.5-3z"/><path d="M8 3.5 10.5 6"/>'),
    trash: svg('<path d="M2 4h10M5.5 4V2.5h3V4M3.5 4l.6 7.5h5.8L10.5 4M5.8 6.2v3.5M8.2 6.2v3.5"/>'),
    prev: svg('<path d="m8.5 2.5-4.5 4.5 4.5 4.5"/>'),
    next: svg('<path d="m5.5 2.5 4.5 4.5-4.5 4.5"/>'),
    folderOpen: svg('<path d="M1.5 3.5h4l1.2 1.5h5.8v6.5h-11z"/>'),
    copy: svg('<rect x="4.5" y="4.5" width="8" height="8" rx="1"/><path d="M9.5 4.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2"/>'),
    check: svg('<path d="m2.5 7.5 3 3 6-7"/>'),
    eye: svg('<path d="M1 7c1.6-3.3 3.8-5 6-5s4.4 1.7 6 5c-1.6 3.3-3.8 5-6 5S2.6 10.3 1 7z"/><circle cx="7" cy="7" r="2"/>'),
    lock: svg('<rect x="2.5" y="6" width="9" height="6.5" rx="1"/><path d="M4.5 6V4.5a2.5 2.5 0 0 1 5 0V6"/>'),
    copyImage: svg('<rect x="4.5" y="4.5" width="8" height="8" rx="1"/><path d="M9.5 4.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2"/>')
  };

  // src/dialog.ts
  function renderDialog(d) {
    return `
  <div id="${esc(d.id)}" class="fe-dlg" style="display:none">
    <div class="fe-dlg-bg"></div>
    <div class="fe-dlg-box" role="dialog" aria-labelledby="${esc(d.id)}-title" tabindex="-1">
      <div class="fe-dlg-title">
        <span class="fe-dlg-mark">${d.mark}</span>
        <span class="fe-dlg-tx"><b id="${esc(d.id)}-title">${esc(d.title)}</b><i>${esc(d.subtitle)}</i></span>
        <button class="fe-dlg-close" title="Close (Esc)">${UI_ICON.close}</button>
      </div>
      <div class="fe-dlg-tabs" role="tablist">
        ${d.tabs.map((t) => `<button class="fe-dlg-tab" role="tab" data-tab="${esc(t.key)}" title="${esc(t.label)} \xB7 [ ] switch tabs \xB7 Esc closes"><span class="fe-dlg-tab-main">${t.icon ?? ""}<b>${esc(t.label)}</b></span>${t.hint ? `<i>${esc(t.hint)}</i>` : ""}</button>`).join("")}
      </div>
      ${d.tabs.map((t) => `<div class="fe-dlg-pane" role="tabpanel" data-tab="${esc(t.key)}">${t.body}</div>`).join("")}
    </div>
  </div>`;
  }
  var focusStack = [];
  function rememberFocus() {
    focusStack.push(document.activeElement);
  }
  function restoreFocus() {
    const el2 = focusStack.pop() ?? null;
    if (el2 && document.contains(el2) && typeof el2.focus === "function") el2.focus();
  }
  function mountDialog(id, hooks = {}) {
    const root = document.getElementById(id);
    const box = root.querySelector(".fe-dlg-box");
    const tabs = [...root.querySelectorAll(".fe-dlg-tab")];
    const panes = [...root.querySelectorAll(".fe-dlg-pane")];
    const memory = `bfb-dialog-tab:${id}`;
    const isOpen = () => root.style.display !== "none";
    function show(tab) {
      if (!tabs.some((t) => t.dataset.tab === tab)) tab = tabs[0]?.dataset.tab ?? "";
      tabs.forEach((t) => t.classList.toggle("on", t.dataset.tab === tab));
      panes.forEach((p) => {
        p.classList.toggle("on", p.dataset.tab === tab);
        if (p.dataset.tab === tab) p.scrollTop = 0;
      });
      try {
        kvSet(memory, tab);
      } catch {
      }
    }
    function open(tab) {
      rememberFocus();
      hooks.onOpen?.();
      let last = "";
      try {
        last = kvGet(memory) || "";
      } catch {
      }
      show(tab ?? last);
      root.style.display = "flex";
      box.focus();
    }
    function close() {
      if (!isOpen()) return;
      root.style.display = "none";
      hooks.onClose?.();
      restoreFocus();
    }
    tabs.forEach((t) => t.addEventListener("click", () => show(t.dataset.tab)));
    root.querySelector(".fe-dlg-close").addEventListener("click", close);
    root.querySelector(".fe-dlg-bg").addEventListener("click", close);
    document.addEventListener("keydown", (e) => {
      if (!isOpen()) return;
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if ((e.key === "[" || e.key === "]") && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) {
        const i = tabs.findIndex((t) => t.classList.contains("on"));
        const j = (i + (e.key === "]" ? 1 : -1) + tabs.length) % tabs.length;
        e.preventDefault();
        show(tabs[j].dataset.tab);
      }
    });
    return { open, close, isOpen, show };
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
  var CHEVRON_DOWN = '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="m2.5 4.5 3.5 3 3.5-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
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
  function icoFile(ext2) {
    const c = EXT_COLORS[ext2.toLowerCase()] ?? "#6e7681";
    const lbl = ext2.length <= 3 ? ext2.toUpperCase() : ext2.slice(0, 3).toUpperCase();
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
  function safeColor(color) {
    return /^#[0-9a-fA-F]{3,8}$/.test(color) || /^[a-zA-Z]{1,20}$/.test(color) ? color : "#6e7681";
  }
  function icoCustom(label, color) {
    const lbl = String(label || "?").slice(0, 4);
    const safe = lbl.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const c = safeColor(color);
    return `<svg width="16" height="18" viewBox="0 0 16 18" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 0.5h8l5.5 5.5V17a.5.5 0 0 1-.5.5H2a.5.5 0 0 1-.5-.5V1A.5.5 0 0 1 2 0.5z" fill="${c}" fill-opacity="0.12" stroke="${c}" stroke-width="1.1"/>
    <path d="M10 0.5L15.5 6H10z" fill="${c}" fill-opacity="0.75"/>
    <text x="8" y="14.5" text-anchor="middle" font-family="'SF Mono',Menlo,Consolas,monospace" font-size="4.5" font-weight="700" fill="${c}">${safe}</text>
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
    const ext2 = e.name.includes(".") ? e.name.split(".").pop() : "";
    return icoFile(ext2 || "\u2014");
  }
  var PI = {
    tabset: `<svg width="14" height="14" viewBox="0 0 14 14"><path d="M1.5 5h11v7.5h-11z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M1.5 5V2.5h4l1 2.5M6.5 5V3h3.5l1 2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>`,
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
    help: `<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M5.2 5.2a1.9 1.9 0 1 1 2.6 1.8c-.6.3-.8.6-.8 1.2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="7" cy="10.3" r="0.9" fill="currentColor"/></svg>`,
    gear: `<svg width="14" height="14" viewBox="0 0 14 14"><path d="M8.5 1H5.5L4.5 2.8 2.5 4 1 5.5v3L2.5 10l2 1.2L5.5 13h3l1-1.8 2-1.2L13 8.5v-3L11.5 4l-2-1.2z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><circle cx="7" cy="7" r="2" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>`,
    drag: `<svg width="10" height="14" viewBox="0 0 10 14"><circle cx="3" cy="3" r="1.2" fill="currentColor"/><circle cx="3" cy="7" r="1.2" fill="currentColor"/><circle cx="3" cy="11" r="1.2" fill="currentColor"/><circle cx="7" cy="3" r="1.2" fill="currentColor"/><circle cx="7" cy="7" r="1.2" fill="currentColor"/><circle cx="7" cy="11" r="1.2" fill="currentColor"/></svg>`
  };

  // src/file-meta.ts
  var plural = (n, one, many = one + "s") => `${n.toLocaleString()} ${n === 1 ? one : many}`;
  function fileMeta(text, ext2, path, bytes = new Blob([text]).size) {
    const e = ext2.toLowerCase();
    const lines = text ? text.split("\n").length - (text.endsWith("\n") ? 1 : 0) : 0;
    const words = (text.match(/\S+/g) || []).length;
    const items = [
      { key: "size", label: "Size", value: fmtSize(bytes) },
      { key: "lines", label: "Lines", value: plural(lines, "line") }
    ];
    if (e === "md" || e === "mdx" || e === "txt") items.push({ key: "words", label: "Words", value: plural(words, "word") });
    if (e === "md" || e === "mdx") {
      let fenced = false, heads = 0;
      for (const l of text.split("\n")) {
        if (/^\s*(```|~~~)/.test(l)) fenced = !fenced;
        else if (!fenced && /^#{1,6}\s/.test(l)) heads++;
      }
      items.push({ key: "headings", label: "Headings", value: plural(heads, "heading") });
    }
    if (e === "csv" || e === "tsv") {
      const rows = text.split("\n").filter((l) => l.trim());
      const cols = rows.length ? rows[0].split(e === "tsv" ? "	" : ",").length : 0;
      items.push({ key: "rows", label: "Rows", value: plural(Math.max(0, rows.length - 1), "row") }, { key: "cols", label: "Columns", value: plural(cols, "column") });
    }
    if (e === "json" || e === "jsonc") {
      try {
        const v = JSON.parse(text);
        if (Array.isArray(v)) items.push({ key: "items", label: "Items", value: plural(v.length, "item") });
        else if (v && typeof v === "object") items.push({ key: "keys", label: "Keys", value: plural(Object.keys(v).length, "top-level key") });
      } catch {
      }
    }
    return { kind: kindName(e), path, items };
  }
  function metaSummary(m) {
    const pick = (k) => m.items.find((i) => i.key === k)?.value;
    return [m.kind, pick("size"), pick("lines")].filter(Boolean).join(" \xB7 ");
  }
  var ICONS = {
    size: '<path d="M2.5 4.5 7 2l4.5 2.5v5L7 12l-4.5-2.5z"/><path d="M2.5 4.5 7 7l4.5-2.5M7 7v5"/>',
    lines: '<path d="M2 3.5h10M2 7h10M2 10.5h6"/>',
    words: '<path d="M2 4h4M2 7h7M2 10h5M10 9.5l1.5 1.5 2-3"/>',
    headings: '<path d="M3 2.5v9M9 2.5v9M3 7h6M11.5 6.5l1.5-1v6"/>',
    rows: '<rect x="1.5" y="2.5" width="11" height="9" rx="1"/><path d="M1.5 5.5h11M1.5 8.5h11"/>',
    cols: '<rect x="1.5" y="2.5" width="11" height="9" rx="1"/><path d="M5.2 2.5v9M8.8 2.5v9"/>',
    items: '<path d="M4 2.5H2.5v9H4M10 2.5h1.5v9H10"/>',
    keys: '<path d="M4.5 2.5c-1.5 0-1.5 1-1.5 2s-1 2-1.5 2.5c.5.5 1.5 1 1.5 2.5s0 2 1.5 2M9.5 2.5c1.5 0 1.5 1 1.5 2s1 2 1.5 2.5c-.5.5-1.5 1-1.5 2.5s0 2-1.5 2"/>'
  };
  var icon = (k) => `<svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k] ?? ""}</svg>`;
  function metaChips(m) {
    return m.items.map((i) => `<span class="fe-meta-item" title="${esc(i.label)}">${icon(i.key)}${esc(i.value)}</span>`).join("");
  }

  // src/col-resize.ts
  var COL_HANDLE = '<span class="fe-col-rz" title="Drag to resize this column \xB7 double-click to reset"></span>';
  var MIN_W = 40;
  var installed = false;
  function installColumnResize() {
    if (installed) return;
    installed = true;
    const handleOf = (e) => e.target?.closest?.("table.fe-rz .fe-col-rz") ?? null;
    document.addEventListener("click", (e) => {
      if (handleOf(e)) e.stopPropagation();
    }, true);
    document.addEventListener("dblclick", (e) => {
      const handle = handleOf(e);
      if (!handle) return;
      e.stopPropagation();
      const table = handle.closest("table");
      table.classList.remove("fe-rz-fixed");
      table.style.width = "";
      table.querySelectorAll("thead th").forEach((th) => {
        th.style.width = "";
      });
    }, true);
    document.addEventListener("pointerdown", (e) => {
      const handle = handleOf(e);
      if (!handle || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const th = handle.closest("th");
      const table = th.closest("table");
      const ths = [...table.querySelectorAll("thead th")];
      if (!table.classList.contains("fe-rz-fixed")) {
        const widths = ths.map((h) => h.getBoundingClientRect().width);
        ths.forEach((h, i) => {
          h.style.width = widths[i] + "px";
        });
        table.style.width = widths.reduce((a, b) => a + b, 0) + "px";
        table.classList.add("fe-rz-fixed");
      }
      const startX = e.clientX;
      const startW = parseFloat(th.style.width);
      const startTable = parseFloat(table.style.width);
      document.body.classList.add("fe-col-dragging");
      const onMove = (ev) => {
        const w = Math.max(MIN_W, startW + ev.clientX - startX);
        th.style.width = w + "px";
        table.style.width = startTable + (w - startW) + "px";
      };
      const onUp = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.body.classList.remove("fe-col-dragging");
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    }, true);
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
    "csv",
    "diff",
    "patch",
    "dockerfile",
    "containerfile",
    "makefile",
    "jsonc",
    "graphql",
    "gql",
    "proto"
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
  var KW_SQL = "select from where insert into update delete join left right inner outer full cross on using group by order having limit offset create table drop alter add column index view as and or not null primary key foreign references distinct union all values set default check constraint unique case when then else end exists between like ilike in is with returning interval asc desc cascade if replace begin commit rollback grant";
  var KW_GO = "func package import return if else for range switch case break continue defer go chan select map struct interface type var const nil true false make new len cap append";
  var KW_RS = "fn let mut pub use mod struct enum impl trait return if else for while loop match break continue ref self Self crate super move async await dyn where unsafe true false Some None Ok Err";
  var KW_GQL = "query mutation subscription fragment on type interface union enum input scalar directive schema implements extend true false null";
  var KW_PROTO = "syntax package import message enum service rpc returns option repeated optional required oneof map reserved public weak true false";
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
    ctrl: sp("select from where insert into update delete join on group by order having limit union with returning case when then else end"),
    type: sp("table view index text varchar char int integer bigint smallint serial bigserial boolean bool numeric decimal real float double precision date time timestamp timestamptz interval json jsonb uuid bytea"),
    builtin: sp("count sum avg min max coalesce now array_agg jsonb_build_object"),
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
    js: { line: ["//"], block: ["/*", "*/"], strings: [`"`, `'`, "`"], tickML: true, deco: true, regexLiterals: true, namedTypes: true, kw: KW_JS.split(" "), kwCats: CATS_JS },
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
    go: { line: ["//"], block: ["/*", "*/"], strings: [`"`, "`"], tickML: true, namedTypes: true, kw: KW_GO.split(" "), kwCats: CATS_GO },
    rs: {
      line: ["//"],
      block: ["/*", "*/"],
      strings: [],
      namedTypes: true,
      kw: KW_RS.split(" "),
      kwCats: CATS_RS,
      strRules: ['r#+"[\\s\\S]*?"#+', 'r"[^"\\n]*"', 'b?"(?:\\\\.|[^"\\\\\\n])*"']
    },
    sql: {
      line: ["--"],
      block: ["/*", "*/"],
      strings: [`'`, `"`],
      caseless: true,
      kw: KW_SQL.split(" "),
      kwCats: CATS_SQL,
      special: [{ kind: "var", pattern: "(?<!:):[A-Za-z_]\\w*|\\$\\d+" }]
    },
    json: {
      strings: [`"`],
      kw: [],
      kwCats: { lit: sp("true false null") },
      special: [{ kind: "key", pattern: '"(?:\\\\.|[^"\\\\\\n])*"(?=[ \\t]*:)' }]
    },
    http: {
      line: ["#"],
      strings: [`"`],
      kw: sp("GET POST PUT PATCH DELETE HEAD OPTIONS HTTP"),
      kwCats: { lit: sp("true false null") },
      special: [{ kind: "key", pattern: "^[A-Za-z][\\w-]*(?=:[ \\t])" }, { kind: "key", pattern: '"(?:\\\\.|[^"\\\\\\n])*"(?=[ \\t]*:)' }]
    },
    md: { strings: [], kw: [], prose: true, special: [
      { kind: "cmt", pattern: "<!--[\\s\\S]*?(?:-->|$)" },
      { kind: "meta", pattern: "^[ \\t]*(?:```|~~~)[^\\n]*" },
      { kind: "section", pattern: "^#{1,6}[ \\t][^\\n]*" },
      { kind: "cmt", pattern: "^>[^\\n]*" },
      { kind: "tag", pattern: "^[ \\t]*(?:[-*+]|\\d+[.)])(?=[ \\t])" },
      { kind: "str", pattern: "`[^`\\n]+`" },
      { kind: "key", pattern: "!?\\[[^\\]\\n]*\\]\\([^)\\n]*\\)" },
      { kind: "deco", pattern: "\\*\\*[^*\\n]+\\*\\*|__[^_\\n]+__" },
      { kind: "meta", pattern: "^[ \\t]*\\|?(?:[ \\t]*:?-{3,}:?[ \\t]*\\|)+[^\\n]*" }
    ] },
    cfg: { line: ["#", ";"], strings: [`"`, `'`], vars: true, kw: [] },
    cstyle: { line: ["//"], block: ["/*", "*/"], strings: [`"`, `'`], deco: true, namedTypes: true, kw: KW_JS.split(" "), kwCats: CATS_JS },
    css: { block: ["/*", "*/"], strings: [`"`, `'`], kw: [] },
    jsonc: { line: ["//"], block: ["/*", "*/"], strings: [`"`], kw: [], kwCats: { lit: sp("true false null") } },
    graphql: { line: ["#"], strings: [`"`], kw: sp(KW_GQL), kwCats: { ctrl: sp("query mutation subscription fragment on"), type: sp("type interface union enum input scalar"), lit: sp("true false null") } },
    proto: {
      line: ["//"],
      block: ["/*", "*/"],
      strings: [`"`],
      kw: sp(KW_PROTO),
      namedTypes: true,
      kwCats: { ctrl: sp("import rpc returns"), type: sp("message enum service oneof map"), lit: sp("true false") }
    },
    html: { block: ["<!--", "-->"], strings: [], kw: [], special: [{ kind: "tag", pattern: "<\\/?[A-Za-z][^>\\n]*>" }] },
    // Keys, anchors and plain values each get a colour; indentation and the list
    // dash stay outside the key, and an unquoted value like it's is one value.
    yaml: {
      line: ["#"],
      strings: [`"`, `'`],
      kw: [],
      kwCats: { lit: sp("true false null yes no True False Null") },
      special: [
        { kind: "meta", pattern: "^(?:---|\\.\\.\\.)[ \\t]*$" },
        { kind: "key", pattern: "(?<=^[ \\t]*(?:-[ \\t]+)?)[A-Za-z_][\\w.-]*(?=[ \\t]*:(?:[ \\t]|$))" },
        { kind: "deco", pattern: "(?<=[:\\s-][ \\t]*)[&*][A-Za-z_][\\w-]*" },
        { kind: "str", pattern: `(?<=:[ \\t]+|^[ \\t]*-[ \\t]+)(?!['"#&*|>\\[{]|(?:true|false|null|yes|no|True|False|Null|~|[-+]?\\d[\\d_.]*)[ \\t]*(?:#|$))[^\\n#]*[^\\s#]` }
      ]
    },
    toml: {
      line: ["#"],
      strings: [`"`, `'`],
      kw: [],
      kwCats: { lit: sp("true false") },
      special: [{ kind: "section", pattern: "^\\[[^\\]\\n]+\\]" }, { kind: "key", pattern: "^[ \\t]*[A-Za-z_][\\w.-]*(?=[ \\t]*=)" }]
    },
    diff: { strings: [], kw: [], special: [
      { kind: "meta", pattern: "^(?:@@|diff |index |\\+\\+\\+ |--- )[^\\n]*" },
      { kind: "add", pattern: "^\\+[^\\n]*" },
      { kind: "del", pattern: "^-[^\\n]*" }
    ] },
    dockerfile: {
      line: ["#"],
      strings: [`"`, `'`],
      vars: true,
      kw: sp("FROM RUN CMD COPY ADD WORKDIR ENV ARG EXPOSE USER ENTRYPOINT VOLUME LABEL HEALTHCHECK SHELL STOPSIGNAL ONBUILD")
    },
    makefile: {
      line: ["#"],
      strings: [`"`, `'`],
      vars: true,
      kw: sp("include define endef ifeq ifneq ifdef ifndef else endif export override private"),
      special: [{ kind: "key", pattern: "^[A-Za-z0-9_./%-]+(?=[ \\t]*:)" }]
    },
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
    ini: "cfg",
    conf: "cfg",
    env: "cfg",
    gitignore: "cfg",
    sql: "sql",
    diff: "diff",
    patch: "diff",
    dockerfile: "dockerfile",
    containerfile: "dockerfile",
    makefile: "makefile",
    jsonc: "jsonc",
    graphql: "graphql",
    gql: "graphql",
    proto: "proto",
    html: "html",
    htm: "html",
    xml: "html",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
    json: "json",
    json5: "json",
    geojson: "json",
    http: "http",
    md: "md",
    mdx: "md",
    markdown: "md"
  };
  var FENCE_ALIAS = {
    javascript: "js",
    typescript: "ts",
    node: "js",
    python: "py",
    python3: "py",
    py3: "py",
    ruby: "rb",
    shell: "sh",
    shellscript: "sh",
    console: "sh",
    terminal: "sh",
    ps: "sh",
    golang: "go",
    rust: "rs",
    kotlin: "kt",
    csharp: "cs",
    "c++": "cpp",
    "c#": "cs",
    objc: "c",
    postgres: "sql",
    postgresql: "sql",
    psql: "sql",
    mysql: "sql",
    sqlite: "sql",
    plpgsql: "sql",
    https: "http",
    rest: "http",
    svg: "xml",
    docker: "dockerfile",
    make: "makefile",
    dotenv: "env",
    properties: "ini",
    cfg: "ini",
    patch: "diff"
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
    if (lang.regexLiterals) rules.push({ kind: "regex", pattern: String.raw`(?:(?<=^)|(?<=[=(,:;!&|?{}\n][ \t]{0,16})|(?<=\breturn[ \t]{1,16}))/(?:\\.|[^/\\\n])+/[dgimsuvy]*` });
    rules.push(...lang.special ?? []);
    for (const p of lang.strRules ?? []) rules.push({ kind: "str", pattern: p });
    for (const q of lang.strings ?? []) {
      const body = q === "`" && lang.tickML ? "(?:\\\\.|[^`\\\\])*(?:`|$)" : `(?:\\\\.|[^${reEsc(q)}\\\\\\n])*(?:${reEsc(q)}|\\n|$)`;
      rules.push({ kind: "str", pattern: `${reEsc(q)}${body}` });
    }
    if (lang.vars) rules.push({ kind: "var", pattern: "\\$\\{[^}\\n]*\\}?|\\$[\\w@#?!*-]+" });
    if (lang.deco) rules.push({ kind: "deco", pattern: "@[A-Za-z_][\\w.]*" });
    if (!lang.prose) rules.push({ kind: "num", pattern: "\\b(?:0[xX][0-9a-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|\\d[\\d_]*(?:\\.\\d[\\d_]*)?(?:[eE][+-]?\\d+)?)\\b" });
    rules.push({ kind: "word", pattern: "[A-Za-z_$][\\w$]*" });
    return rules;
  }
  function compile(rules) {
    const kinds = [];
    const parts = rules.map((r, i) => {
      kinds[i] = r.kind;
      return `(?<g${i}>${r.pattern})`;
    });
    return { re: new RegExp(parts.join("|"), "gm"), kinds };
  }
  var KIND_CLASS = {
    cmt: "tok-cmt",
    str: "tok-str",
    var: "tok-var",
    num: "tok-num",
    deco: "tok-deco",
    regex: "tok-regex",
    tag: "tok-type",
    key: "tok-key",
    section: "tok-section",
    add: "tok-add",
    del: "tok-del",
    meta: "tok-cmt"
  };
  function highlightCode(src, ext2) {
    const key = ext2.toLowerCase();
    const langKey = EXT_LANG[FENCE_ALIAS[key] ?? key] ?? "plain";
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
        const before = src.slice(Math.max(0, m.index - 32), m.index);
        const declaration = /\b(?:function|def|func|fn)\s+$/.test(before);
        const call2 = /^\s*\(/.test(src.slice(last, last + 12));
        const type = lang.namedTypes && /^[A-Z]/.test(m[0]) && /(?:\bnew|\bextends|\bimplements|[:<,])\s*$/.test(before);
        const cls = wmap.get(lang.caseless ? m[0].toLowerCase() : m[0]) ?? (declaration || call2 ? "tok-fn" : type ? "tok-type" : void 0);
        out += cls ? `<span class="${cls}">${text}</span>` : text;
      } else if (kind) out += `<span class="${KIND_CLASS[kind]}">${text}</span>`;
      else out += text;
      if (m[0].length === 0) re.lastIndex++;
    }
    out += esc(src.slice(last));
    return out;
  }
  function renderCode(src, ext2) {
    let truncNote = "";
    if (src.length > RENDER_CAPS.codeChars) {
      src = src.slice(0, RENDER_CAPS.codeChars);
      truncNote = `<div class="fe-ql-note">Showing first ${RENDER_CAPS.codeChars.toLocaleString()} characters \u2014 open the raw file for the rest.</div>`;
    }
    const lines = src.split("\n").length;
    const gutter = Array.from({ length: lines }, (_, i) => i + 1).join("\n");
    return `${truncNote}<div class="fe-code-wrap"><pre class="fe-code-gut">${gutter}</pre><pre class="fe-code">${highlightCode(src, ext2)}</pre></div>`;
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
      return `<th data-col="${i}" class="${numCols.has(i) ? "num" : ""}${sort?.col === i ? " sorted" : ""}" title="Click to sort">${esc(h)}${arrow}${COL_HANDLE}</th>`;
    }).join("");
    const trs = rows.map(
      (r) => `<tr>${header.map((_, i) => `<td class="${numCols.has(i) ? "num" : ""}">${esc(r[i] ?? "")}</td>`).join("")}</tr>`
    ).join("");
    return `${truncNote}<table class="fe-ql-table fe-rz"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
  }
  function badUrl(url) {
    return /^\s*(javascript|data|vbscript):/i.test(url);
  }
  function localFileUrl(path) {
    const filePath = path.replace(/:\d+(?::\d+)?$/, "");
    return "file://" + filePath.split("/").map(encodeURIComponent).join("/");
  }
  function resolveMdUrl(base, url) {
    if (/^\/Users\/alcatraz627(?:\/|$)/.test(url)) return localFileUrl(url);
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
  var HTML_ATTRS = /* @__PURE__ */ new Set(["src", "href", "alt", "title", "width", "height", "align", "colspan", "rowspan", "start"]);
  var HTML_BOOL_ATTRS = /* @__PURE__ */ new Set(["open", "reversed"]);
  var VOID_TAGS = /* @__PURE__ */ new Set(["br", "hr", "img", "source"]);
  function sanitizeHtml(html, baseUrl = "") {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const walk = (node) => {
      if (node.nodeType === Node.TEXT_NODE) return esc(node.textContent ?? "");
      if (node.nodeType !== Node.ELEMENT_NODE) return "";
      const el2 = node;
      const tag = el2.tagName.toLowerCase();
      const kids = Array.from(el2.childNodes).map(walk).join("");
      if (!HTML_TAGS.has(tag)) return kids;
      let attrs = "";
      for (const a of Array.from(el2.attributes)) {
        if (HTML_BOOL_ATTRS.has(a.name)) {
          attrs += ` ${a.name}`;
          continue;
        }
        if (!HTML_ATTRS.has(a.name)) continue;
        let val = a.value;
        if (a.name === "src" || a.name === "href") {
          if (badUrl(val)) continue;
          val = resolveMdUrl(baseUrl, val);
        }
        attrs += ` ${a.name}="${esc(val)}"`;
      }
      if (tag === "a" && /^(?:https?:|file:\/\/\/Users\/alcatraz627(?:\/|$))/i.test(resolveMdUrl(baseUrl, el2.getAttribute("href") ?? ""))) {
        attrs += ' target="_blank" rel="noopener"';
      }
      return VOID_TAGS.has(tag) ? `<${tag}${attrs}>` : `<${tag}${attrs}>${kids}</${tag}>`;
    };
    return Array.from(doc.body.childNodes).map(walk).join("");
  }
  function mdInline(s, baseUrl = "") {
    const htmlTags = [];
    let source = "";
    let codeTicks = 0;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === "`") {
        let end2 = i;
        while (s[end2] === "`") end2++;
        const count = end2 - i;
        if (!codeTicks) codeTicks = count;
        else if (codeTicks === count) codeTicks = 0;
        source += s.slice(i, end2);
        i = end2 - 1;
        continue;
      }
      if (s[i] !== "<" || codeTicks || !/^<\/?[a-z][\w-]*\b/i.test(s.slice(i))) {
        source += s[i];
        continue;
      }
      let end = i + 1, quote = "";
      for (; end < s.length; end++) {
        if (quote) {
          if (s[end] === quote) quote = "";
        } else if (s[end] === '"' || s[end] === "'") quote = s[end];
        else if (s[end] === ">") break;
      }
      if (end === s.length) {
        source += s[i];
        continue;
      }
      const raw = s.slice(i, end + 1);
      const name = raw.match(/^<\/?([a-z][\w-]*)/i)[1].toLowerCase();
      if (!HTML_TAGS.has(name)) {
        source += raw;
        i = end;
        continue;
      }
      const safe = sanitizeHtml(raw.startsWith("</") ? `<${name}></${name}>` : `${raw}${VOID_TAGS.has(name) ? "" : `</${name}>`}`, baseUrl);
      const tag = raw.startsWith("</") ? `</${name}>` : safe.slice(0, safe.indexOf(">") + 1);
      htmlTags.push(tag);
      source += `\uE000${htmlTags.length - 1}\uE001`;
      i = end;
    }
    let out = esc(source);
    out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
    out = out.replace(/!\[([^\]]*)\]\(([^)\s]+?)\)/g, (_m, alt, url) => {
      if (badUrl(url)) return alt;
      return `<img src="${resolveMdUrl(baseUrl, url)}" alt="${alt}" loading="lazy">`;
    });
    out = out.replace(/\[([^\]]+)\]\(([^)\s]+?)\)/g, (_m, t, url) => {
      if (badUrl(url)) return t;
      const u = resolveMdUrl(baseUrl, url);
      return `<a href="${u}"${/^(?:https?:|file:\/\/\/Users\/alcatraz627(?:\/|$))/i.test(u) ? ' target="_blank" rel="noopener"' : ""}>${t}</a>`;
    });
    out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
    out = out.replace(/~~([^~]+)~~/g, "<del>$1</del>");
    return out.replace(/\uE000(\d+)\uE001/g, (_m, index) => htmlTags[Number(index)]);
  }
  var BARE_URL = /\b(?:https?|file):\/\/[^\s<>"'`]+/gi;
  function trimUrl(url) {
    let u = url.replace(/[.,;:!?*_]+$/, "");
    for (const [open, close] of [["(", ")"], ["[", "]"]]) {
      while (u.endsWith(close) && u.split(open).length < u.split(close).length) u = u.slice(0, -1).replace(/[.,;:!?*_]+$/, "");
    }
    return u;
  }
  function linkBareUrls(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    for (const node of textNodes) {
      if (node.parentElement?.closest("a, pre, svg, style, script")) continue;
      const value = node.textContent || "";
      BARE_URL.lastIndex = 0;
      if (!BARE_URL.test(value)) continue;
      BARE_URL.lastIndex = 0;
      const replacement = document.createDocumentFragment();
      let cursor = 0;
      for (const m of value.matchAll(BARE_URL)) {
        const url = trimUrl(m[0]);
        const start = m.index ?? 0;
        replacement.append(value.slice(cursor, start));
        const link = document.createElement("a");
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = url;
        replacement.append(link);
        cursor = start + url.length;
      }
      replacement.append(value.slice(cursor));
      node.parentNode?.replaceChild(replacement, node);
    }
  }
  function linkLocalPaths(html) {
    if (!html.includes("/Users/alcatraz627") && !/(?:https?|file):\/\//i.test(html)) return html;
    const template = document.createElement("template");
    template.innerHTML = html;
    linkBareUrls(template.content);
    const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    for (const node of textNodes) {
      if (node.parentElement?.closest("a, pre, svg, style, script")) continue;
      const value = node.textContent || "";
      const replacement = document.createDocumentFragment();
      let cursor = 0;
      while (cursor < value.length) {
        const start = value.indexOf("/Users/alcatraz627", cursor);
        if (start < 0) break;
        const afterHome = value[start + "/Users/alcatraz627".length];
        if (start && /[\w/:]/.test(value[start - 1]) || afterHome && afterHome !== "/" && !/\s|[),.;!?]/.test(afterHome)) {
          replacement.append(value.slice(cursor, start + 1));
          cursor = start + 1;
          continue;
        }
        let end = start + "/Users/alcatraz627".length;
        let depth = 0;
        const opener = start ? value[start - 1] : "";
        const delimiter = opener === '"' || opener === "'" ? opener : opener === "<" ? ">" : "";
        const delimited = node.parentElement?.tagName === "CODE" || !!delimiter;
        while (end < value.length) {
          const char = value[end];
          if (delimiter && char === delimiter || !delimited && /[\n\r<>"']/.test(char) || !delimited && char === ")" && depth === 0 || !delimited && char === "]") break;
          if (char === "(") depth++;
          if (char === ")") depth--;
          if (!delimited && /\s/.test(char)) {
            const prefix = value.slice(start, end);
            const hasLaterPathPart = /\/|\.[a-zA-Z0-9_-]{1,15}(?=:\d+|\s|$|[),;!?])/.test(value.slice(end + 1, end + 100));
            if (/\/$/.test(prefix) || /(?:\.[a-zA-Z0-9_-]{1,15}|:\d+(?::\d+)?)$/.test(prefix) || !hasLaterPathPart) break;
          }
          end++;
        }
        let path = value.slice(start, end);
        if (!delimited) path = path.replace(/[.,;!?]+$/, "");
        replacement.append(value.slice(cursor, start));
        const link = document.createElement("a");
        link.href = localFileUrl(path);
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = path;
        replacement.append(link);
        cursor = start + path.length;
      }
      if (cursor) {
        replacement.append(value.slice(cursor));
        node.parentNode?.replaceChild(replacement, node);
      }
    }
    return template.innerHTML;
  }
  function headingId(text, seen) {
    let id = text.trim().toLowerCase().replace(/[^a-z0-9À-ɏͰ-﷏]+/g, "-").replace(/^-+|-+$/g, "") || "section";
    const n = seen.get(id) ?? 0;
    seen.set(id, n + 1);
    if (n) id += "-" + n;
    return id;
  }
  var ALERTS = { NOTE: "Note", TIP: "Tip", IMPORTANT: "Important", WARNING: "Warning", CAUTION: "Caution" };
  var LIST_ITEM = /^(\s*)([-*+]|\d{1,9}[.)])(?:\s+(.*)|\s*)$/;
  function renderMarkdown(src, baseUrl = "", inner = false) {
    let lines = src.replace(/\r\n/g, "\n").split("\n");
    const out = [];
    let para = [];
    const seenIds = /* @__PURE__ */ new Map();
    const notes2 = /* @__PURE__ */ new Map();
    if (!inner) {
      let inFence = false;
      lines = lines.filter((l) => {
        if (/^ {0,3}(`{3,}|~{3,})/.test(l)) inFence = !inFence;
        const m = !inFence && l.match(/^\[\^([^\]\s]+)\]:\s*(.*)$/);
        if (m) {
          notes2.set(m[1], m[2]);
          return false;
        }
        return true;
      });
    }
    let i = 0;
    if (!inner && lines[0] === "---") {
      const end = lines.slice(1, 60).findIndex((l) => l === "---");
      if (end >= 0) {
        const rows = lines.slice(1, end + 1).map((l) => l.match(/^([\w.-]+)\s*:\s*(.*)$/)).filter(Boolean);
        if (rows.length) out.push(`<dl class="fe-md-fm">${rows.map((m) => `<dt>${esc(m[1])}</dt><dd>${mdInline(m[2], baseUrl)}</dd>`).join("")}</dl>`);
        i = end + 2;
      }
    }
    const flush = () => {
      if (!para.length) return;
      const text = para.map((l, k) => k < para.length - 1 && /( {2,}|\\)$/.test(l) ? l.replace(/( {2,}|\\)$/, "") + "\uE002" : l.trim()).join(" ");
      out.push(`<p>${mdInline(text, baseUrl).replace(/\uE002 ?/g, "<br>")}</p>`);
      para = [];
    };
    while (i < lines.length) {
      const line = lines[i];
      const fence = line.match(/^( {0,3})(`{3,}|~{3,})([^\r\n]*)$/);
      if (fence) {
        flush();
        const buf = [];
        i++;
        const marker = fence[2][0], width = fence[2].length, indent = fence[1].length;
        const close = new RegExp(`^ {0,3}${marker === "`" ? "`" : "~"}{${width},}\\s*$`);
        while (i < lines.length && !close.test(lines[i])) {
          buf.push(lines[i++].replace(new RegExp(`^ {0,${indent}}`), ""));
        }
        if (i < lines.length) i++;
        const code = buf.join("\n");
        const language = fence[3].trim().split(/\s+/)[0] || "";
        if (language.toLowerCase() === "mermaid") {
          out.push(`<div class="fe-md-mermaid"><pre class="fe-md-mermaid-source" hidden>${esc(code)}</pre><div class="fe-md-mermaid-view">Rendering diagram\u2026</div></div>`);
        } else {
          out.push(`<div class="fe-md-code"><div class="fe-md-code-bar"><span class="fe-md-lang">${esc(language || "text")}</span><button type="button" class="fe-md-copy" title="Copy this block" aria-label="Copy this block">${UI_ICON.copy}</button></div><pre class="fe-md-pre">${highlightCode(code, language || "md")}</pre></div>`);
        }
        continue;
      }
      const h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        flush();
        const n = h[1].length;
        const id = headingId(h[2].replace(/[*_`]/g, ""), seenIds);
        out.push(`<h${n} id="${esc(id)}">${mdInline(h[2], baseUrl)}<a class="fe-md-anchor" href="#${esc(id)}" title="Link to this heading"></a></h${n}>`);
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
        const alert = buf[0]?.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/i);
        if (alert) {
          const kind = alert[1].toUpperCase();
          out.push(`<div class="fe-md-alert fe-md-alert-${kind.toLowerCase()}"><p class="fe-md-alert-title">${ALERTS[kind]}</p>${renderMarkdown(buf.slice(1).join("\n"), baseUrl, true)}</div>`);
        } else out.push(`<blockquote>${renderMarkdown(buf.join("\n"), baseUrl)}</blockquote>`);
        continue;
      }
      const li = line.match(LIST_ITEM);
      if (li && (li[3] !== void 0 || para.length === 0)) {
        flush();
        const baseIndent = li[1].length;
        const ordered = /\d/.test(li[2]);
        const items = [];
        let loose = false;
        while (i < lines.length) {
          const m = lines[i].match(LIST_ITEM);
          if (!m || m[1].length !== baseIndent || /\d/.test(m[2]) !== ordered) break;
          const contentIndent = m[1].length + m[2].length + 1;
          const body = [m[3] ?? ""];
          i++;
          while (i < lines.length) {
            const l = lines[i];
            if (/^\s*$/.test(l)) {
              const next = lines.slice(i + 1).find((x) => !/^\s*$/.test(x));
              if (next !== void 0 && next.match(/^\s*/)[0].length >= contentIndent) {
                body.push("");
                i++;
                loose = true;
                continue;
              }
              break;
            }
            const ind = l.match(/^\s*/)[0].length;
            if (ind >= contentIndent || ind > baseIndent && LIST_ITEM.test(l)) {
              body.push(l.slice(Math.min(ind, contentIndent)));
              i++;
              continue;
            }
            if (!LIST_ITEM.test(l) && body[body.length - 1] !== "" && !/^\s*(#|>|```|~~~|\|)/.test(l)) {
              body.push(l.trim());
              i++;
              continue;
            }
            break;
          }
          const task = body[0].match(/^\[( |x|X)\]\s+(.*)$/);
          if (task) body[0] = task[2];
          let html2 = renderMarkdown(body.join("\n"), baseUrl, true);
          const tight = html2.match(/^<p>([\s\S]*?)<\/p>(\n?[\s\S]*)$/);
          if (tight && !loose) html2 = tight[1] + tight[2];
          items.push(task ? `<li class="fe-task"><input type="checkbox" disabled${task[1] === " " ? "" : " checked"}> ${html2}</li>` : `<li>${html2}</li>`);
          if (i < lines.length && /^\s*$/.test(lines[i]) && lines[i + 1]?.match(LIST_ITEM)?.[1].length === baseIndent) {
            i++;
            loose = true;
          }
        }
        const start = ordered ? parseInt(li[2], 10) : 1;
        out.push(ordered ? `<ol${start !== 1 ? ` start="${start}"` : ""}>${items.join("")}</ol>` : `<ul>${items.join("")}</ul>`);
        continue;
      }
      if (line.includes("|") && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*\s*$/.test(lines[i + 1])) {
        flush();
        const cells = (l) => {
          const parts = [];
          let cell = "";
          let codeTicks = 0;
          for (let p = 0; p < l.length; p++) {
            if (l[p] === "\\" && l[p + 1] === "|") {
              cell += "|";
              p++;
              continue;
            }
            if (l[p] === "`") {
              let end = p;
              while (l[end] === "`") end++;
              const ticks = end - p;
              if (!codeTicks) codeTicks = ticks;
              else if (codeTicks === ticks) codeTicks = 0;
              cell += l.slice(p, end);
              p = end - 1;
              continue;
            }
            if (l[p] === "|" && !codeTicks) {
              parts.push(cell);
              cell = "";
              continue;
            }
            cell += l[p];
          }
          parts.push(cell);
          if (/^\s*\|/.test(l)) parts.shift();
          if (/\|\s*$/.test(l) && !/\\\|\s*$/.test(l)) parts.pop();
          return parts.map((c) => mdInline(c.trim(), baseUrl));
        };
        const head = cells(line);
        i += 2;
        const rows = [];
        while (i < lines.length && lines[i].includes("|")) rows.push(cells(lines[i++]));
        out.push(`<div class="fe-md-tablewrap"><table class="fe-md-table fe-rz"><thead><tr>${head.map((c) => `<th>${c}${COL_HANDLE}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${Array.from({ length: head.length }, (_, n) => `<td>${r[n] ?? ""}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
        continue;
      }
      if (/^\s*$/.test(line)) {
        flush();
        i++;
        continue;
      }
      para.push(line.replace(/^\s+/, ""));
      i++;
    }
    flush();
    if (inner) return out.join("\n");
    let html = out.join("\n");
    if (notes2.size) {
      const order = [];
      html = html.replace(/\[\^([^\]\s]+)\]/g, (m, id) => {
        if (!notes2.has(id)) return m;
        if (!order.includes(id)) order.push(id);
        const n = order.indexOf(id) + 1;
        return `<sup class="fe-md-fnref"><a href="#fn-${esc(id)}" id="fnref-${esc(id)}">${n}</a></sup>`;
      });
      const listed = [...order, ...[...notes2.keys()].filter((k) => !order.includes(k))];
      html += `<section class="fe-md-footnotes"><ol>${listed.map((id) => `<li id="fn-${esc(id)}">${mdInline(notes2.get(id), baseUrl)} <a href="#fnref-${esc(id)}" class="fe-md-fnback" title="Back to the text">\u21A9</a></li>`).join("")}</ol></section>`;
    }
    return linkLocalPaths(`<div class="fe-md">${html}</div>`);
  }
  function jsonLeaf(v) {
    if (v === null) return `<span class="tok-lit">null</span>`;
    switch (typeof v) {
      case "string": {
        const s = v.length > 500 ? v.slice(0, 500) + "\u2026" : v;
        return `<span class="tok-str">"${esc(s)}"</span>`;
      }
      case "number":
        return `<span class="tok-num">${v}</span>`;
      case "boolean":
        return `<span class="tok-lit">${v}</span>`;
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
      return `<details class="fe-jt"${open}><summary>${CHEVRON_DOWN}${keyHtml}<span class="fe-jt-badge">${badge}</span></summary><div class="fe-jt-kids">${entries.map(([k, x]) => jsonNode(k, x, depth + 1, budget)).join("")}</div></details>`;
    }
    return `<div class="fe-jt-row">${keyHtml}${jsonLeaf(v)}</div>`;
  }
  function renderJsonTree(text) {
    let v;
    try {
      v = JSON.parse(text);
    } catch (err) {
      return `<div class="fe-ql-note">Not strict JSON, shown as text: ${esc(err.message)}</div>${renderCode(text, "jsonc")}`;
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
        return `<details class="fe-jl-line"><summary>${CHEVRON_DOWN}<span class="fe-jl-n">${i + 1}</span><span class="fe-jl-prev">${esc(preview)}</span></summary><div class="fe-jt-kids">${jsonNode(null, v, 1, { n: 2e3 })}</div></details>`;
      } catch {
        return `<div class="fe-jl-line bad"><span class="fe-jl-n">${i + 1}</span><span class="fe-jl-err">not JSON</span><span class="fe-jl-prev">${esc(line.slice(0, 200))}</span></div>`;
      }
    }).join("");
    return `${truncNote}<div class="fe-jl-root">${body}</div>`;
  }

  // src/file-fetch.ts
  var FileFetchError = class extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
      this.name = "FileFetchError";
    }
  };
  function xhrDirect(url) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", url);
      xhr.onload = () => resolve(xhr.responseText);
      xhr.onerror = () => reject(new Error("XHR error"));
      xhr.send();
    });
  }
  function relayOnce(url) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "bfb-fetch", url }, (res) => {
        if (chrome.runtime.lastError || !res) resolve(null);
        else resolve(res);
      });
    });
  }
  var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function fetchFileText(rawUrl, attempts = 3, delayMs = 150) {
    const url = new URL(rawUrl, location.href).href;
    for (let i = 0; i < attempts; i++) {
      if (!chrome.runtime?.id) throw new FileFetchError("context-invalidated", "extension reloaded under this page");
      let res;
      try {
        res = await relayOnce(url);
      } catch (e) {
        throw new FileFetchError("context-invalidated", String(e));
      }
      if (res === null) {
        await sleep(delayMs * (i + 1));
        continue;
      }
      if (res.ok) return res.text;
      return xhrDirect(url).catch(() => {
        throw new FileFetchError("read-failed", res.error || "read failed");
      });
    }
    return xhrDirect(url).catch(() => {
      throw new FileFetchError("read-failed", "no reply from the extension worker");
    });
  }

  // src/notes.ts
  var NotesError = class extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
      this.name = "NotesError";
    }
  };
  var HOST = "com.better_file_browser.notes";
  function call(payload) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage({ type: "bfb-native-oneshot", host: HOST, payload }, (res) => {
          if (chrome.runtime.lastError || !res) return reject(new NotesError("unavailable", chrome.runtime.lastError?.message || "no reply"));
          if (!res.ok) return reject(new NotesError("unavailable", res.error || "notes host not installed"));
          const f = res.response;
          if (f.t === "error") return reject(new NotesError(f.code, f.message));
          resolve(f);
        });
      } catch (e) {
        reject(new NotesError("unavailable", String(e)));
      }
    });
  }
  var notes = {
    stat: (root) => call({ op: "stat", root }),
    list: (root) => call({ op: "list", root }).then((f) => f.notes),
    read: (root, rel) => call({ op: "read", root, rel }),
    write: (root, rel, text, expectMtime) => call({ op: "write", root, rel, text, expectMtime }),
    create: (root, rel, text = "") => call({ op: "create", root, rel, text }),
    rename: (root, rel, to) => call({ op: "rename", root, rel, to }),
    writeBinary: (root, rel, base64) => call({ op: "writeBinary", root, rel, base64 }),
    delete: (root, rel) => call({ op: "delete", root, rel }),
    /// The system folder chooser, opened on `start`; resolves to '' when the person cancels.
    pick: (start) => call({ op: "pick", start }).then((f) => f.root),
    history: (root, rel) => call({ op: "history", root, rel }).then((f) => f),
    version: (root, rel, sha) => call({ op: "version", root, rel, sha }),
    /// Notes whose text holds every word of the query, each with its first matching line.
    search: (root, query) => call({ op: "search", root, query }).then((f) => f.hits),
    /// Any text file inside a folder allowed for editing; root is that folder.
    fileRead: (root, rel) => call({ op: "fileRead", root, rel }),
    fileWrite: (root, rel, text, expectMtime) => call({ op: "fileWrite", root, rel, text, expectMtime })
  };
  function slugForTitle(title) {
    const s = title.replace(/^#+\s*/, "").trim().toLowerCase().replace(/[^a-z0-9À-ɏͰ-﷏]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
    return (s || "untitled") + ".md";
  }
  function unquoteYaml(v) {
    if (v.length >= 2 && v[0] === '"' && v.endsWith('"')) {
      try {
        return JSON.parse(v);
      } catch {
        return v.slice(1, -1);
      }
    }
    if (v.length >= 2 && v[0] === "'" && v.endsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
    return v;
  }
  function noteTitle(rel, text) {
    if (text) {
      const fm = text.match(/^---\n([\s\S]*?)\n---/);
      const raw = fm?.[1].match(/^title:\s*(.+)$/m)?.[1].trim();
      const t = raw && unquoteYaml(raw).trim();
      if (t) return t;
      const first = splitNote(text).body.trim().split("\n")[0].replace(/^#+/, "").trim();
      if (first) return first;
    }
    return rel.split("/").pop().replace(/\.md$/i, "").replace(/[-_]+/g, " ");
  }
  function setTitle(text, title) {
    const m = text.match(/^---\n([\s\S]*?)\n---/);
    if (!m) return null;
    const line = `title: ${JSON.stringify(title)}`;
    const fm = /^title:.*$/m.test(m[1]) ? m[1].replace(/^title:.*$/m, () => line) : `${line}
${m[1]}`;
    return text.replace(m[0], () => `---
${fm}
---`);
  }
  function settleClash(text, keep) {
    const out = [];
    let first = [], second = [];
    let part = "out";
    for (const line of text.split("\n")) {
      if (part === "out" && (line.startsWith("<<<<<<< ") || line === "<<<<<<<")) {
        part = "first";
        first = [];
        second = [];
      } else if (part === "out") out.push(line);
      else if (part === "first" && line === "=======") part = "second";
      else if (part === "first") first.push(line);
      else if (line.startsWith(">>>>>>> ") || line === ">>>>>>>") {
        part = "out";
        out.push(...keep === "second" ? second : keep === "first" ? first : [...first, ...second]);
      } else second.push(line);
    }
    if (part !== "out") out.push(...first, ...second);
    return out.join("\n");
  }
  function clashSides(text) {
    const a = text.match(/^<<<<<<< (.+)$/m)?.[1], b = text.match(/^>>>>>>> (.+)$/m)?.[1];
    if (!a || !b) return null;
    const name = (m) => m === "HEAD" ? "this Mac's" : /^pi\b|csync/.test(m) ? "the Pi's" : m === "phone" ? "the phone's" : `${m}'s`;
    return [name(a.trim()), name(b.trim())];
  }
  function stampUpdated(text, now = /* @__PURE__ */ new Date()) {
    const m = text.match(/^---\n([\s\S]*?)\n---/);
    if (!m) return text;
    const iso = now.toISOString();
    const fm = /^updated:.*$/m.test(m[1]) ? m[1].replace(/^updated:.*$/m, () => `updated: ${iso}`) : m[1] + `
updated: ${iso}`;
    return text.replace(m[0], () => `---
${fm}
---`);
  }
  var NOTE_COLORS = ["red", "orange", "yellow", "green", "teal", "blue", "purple", "pink"];
  var LEGACY_COLORS = { indigo: "purple", mint: "green", brown: "orange", gray: "blue", cyan: "teal" };
  function colorName(v) {
    if (!v) return null;
    const n = LEGACY_COLORS[v] ?? v;
    return NOTE_COLORS.includes(n) ? n : null;
  }
  var KEY_ORDER = [
    "title",
    "created",
    "tags",
    "expires",
    "remind_at",
    "remind_repeat",
    "remind_on",
    "reminder_id",
    "pinned",
    "color",
    "agent",
    "source",
    "url",
    "pos"
  ];
  var FM_RE = /^---\n(?:([\s\S]*?)\n)?---(?:\n|$)/;
  function splitNote(text) {
    const m = text.match(FM_RE);
    if (!m || /^(<{7}|={7}|>{7})/m.test(m[0])) return { head: "", body: text };
    return { head: m[0], body: text.slice(m[0].length) };
  }
  function fmLines(head) {
    const m = head.match(FM_RE);
    return m && m[1] !== void 0 ? m[1].split("\n") : [];
  }
  function readProps(rel, text) {
    const { head } = splitNote(text);
    const f = {};
    for (const line of fmLines(head)) {
      const i = line.indexOf(":");
      if (i > 0) f[line.slice(0, i).trim()] = unquoteYaml(line.slice(i + 1).trim());
    }
    return {
      title: noteTitle(rel, text),
      color: colorName(f.color),
      pinned: f.pinned === "true",
      tags: parseTags2(f.tags),
      ...f.pos ? { pos: f.pos } : {}
    };
  }
  function parseTags2(v) {
    const s = (v ?? "").trim();
    return (s.startsWith("[") && s.endsWith("]") ? s.slice(1, -1) : s).split(",").map((t) => t.trim().replace(/^(["'])(.*)\1$/, "$2")).filter(Boolean);
  }
  function setField(text, key, value) {
    const line = value === null ? null : `${key}: ${value}`;
    const { head, body } = splitNote(text);
    if (!head) return line === null ? text : `---
${line}
---
${text}`;
    const lines = fmLines(head);
    const at = lines.findIndex((l) => l.slice(0, Math.max(l.indexOf(":"), 0)).trim() === key);
    if (at >= 0) {
      if (line === null) lines.splice(at, 1);
      else lines[at] = line;
    } else if (line !== null) {
      const rank = KEY_ORDER.indexOf(key);
      let pos = lines.length;
      if (rank >= 0) {
        const later = lines.findIndex((l) => {
          const r = KEY_ORDER.indexOf(l.slice(0, Math.max(l.indexOf(":"), 0)).trim());
          return r < 0 || r > rank;
        });
        if (later >= 0) pos = later;
      }
      lines.splice(pos, 0, line);
    }
    if (!lines.length && at >= 0) return body;
    return `---
${lines.length ? lines.join("\n") + "\n" : ""}---
${body}`;
  }
  var setPinned = (text, on) => setField(text, "pinned", on ? "true" : null);
  var setColor = (text, c) => setField(text, "color", c);
  var setTags2 = (text, tags) => setField(text, "tags", tags.length ? JSON.stringify(tags.join(", ")) : null);
  function frontmatterDrift(before, after, allowed) {
    const skip = /* @__PURE__ */ new Set([...allowed, "updated"]);
    const keep = (t) => fmLines(splitNote(t).head).filter((l) => !skip.has(l.slice(0, Math.max(l.indexOf(":"), 0)).trim()));
    const a = keep(before), b = keep(after);
    return a.length === b.length && a.every((l, i) => l === b[i]) ? [] : [...a.filter((l) => !b.includes(l)).map((l) => `- ${l}`), ...b.filter((l) => !a.includes(l)).map((l) => `+ ${l}`)];
  }
  function sharedOrder(list) {
    const made = (n) => n.created ?? n.mtime;
    return [...list].sort((x, y) => {
      if (!!x.pinned !== !!y.pinned) return x.pinned ? -1 : 1;
      if (!x.pos !== !y.pos) return x.pos ? 1 : -1;
      if (!x.pos) return made(y) - made(x) || (x.rel < y.rel ? -1 : x.rel > y.rel ? 1 : 0);
      return x.pos < y.pos ? -1 : x.pos > y.pos ? 1 : x.rel < y.rel ? -1 : x.rel > y.rel ? 1 : 0;
    });
  }
  function filterNotes(list, query) {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return list;
    return list.filter((n) => {
      const tags = (n.tags ?? []).map((t) => t.toLowerCase());
      const hay = `${n.title || noteTitle(n.rel)} ${n.rel} ${colorName(n.color) ?? ""} ${tags.join(" ")}`.toLowerCase();
      return words.every((w) => w.startsWith("#") ? w.length > 1 && tags.some((t) => t.includes(w.slice(1))) : hay.includes(w));
    });
  }
  function applyChange(text, c) {
    let t = text;
    if (c.color !== void 0) t = setColor(t, c.color);
    if (c.pinned !== void 0) t = setPinned(t, c.pinned);
    if (c.tags !== void 0) t = setTags2(t, c.tags);
    return t;
  }
  function changedKeys(c) {
    return ["color", "pinned", "tags"].filter((k) => c[k] !== void 0);
  }

  // src/note-meta-ui.ts
  var colorDot = (c) => `<svg class="fe-cdot" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">` + (c ? `<circle cx="6" cy="6" r="4.5" fill="var(--nc-${c})"/>` : `<circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" stroke-width="1.2"/>`) + `</svg>`;
  var openMenu = null;
  function closePropsMenu() {
    openMenu?.off();
    openMenu = null;
  }
  function openPropsMenu(anchor, props, apply) {
    closePropsMenu();
    const menu = document.createElement("div");
    menu.className = "fe-pmenu";
    menu.setAttribute("role", "menu");
    const host = document.getElementById("fe") ?? document.body;
    host.appendChild(menu);
    let cur = props;
    const render2 = () => {
      menu.innerHTML = `
      <button class="fe-pbn fe-pm-pin${cur.pinned ? " active" : ""}" data-pm="pin" role="menuitem">${UI_ICON.pin}<span>${cur.pinned ? "unpin" : "pin to top"}</span></button>
      <div class="fe-pm-lbl">colour</div>
      <div class="fe-pm-colors">
        <button class="fe-pbn${cur.color === null ? " active" : ""}" data-pm="color" data-color="" role="menuitem">${colorDot(null)}<span>none</span></button>
        ${NOTE_COLORS.map((c) => `<button class="fe-pbn${cur.color === c ? " active" : ""}" data-pm="color" data-color="${c}" role="menuitem">${colorDot(c)}<span>${c}</span></button>`).join("")}
      </div>
      <div class="fe-pm-lbl">tags</div>
      <div class="fe-pm-tags">
        ${cur.tags.map((t) => `<span class="fe-chip">${UI_ICON.tag}<span>${esc(t)}</span><button class="fe-chip-x" data-pm="untag" data-tag="${esc(t)}" title="Remove tag ${esc(t)}" aria-label="Remove tag ${esc(t)}">${UI_ICON.close}</button></span>`).join("")}
      </div>
      <form class="fe-pm-add"><input type="text" placeholder="new tag" autocomplete="off" spellcheck="false" maxlength="32"><button class="fe-pbn" type="submit">${UI_ICON.add}<span>add</span></button></form>`;
    };
    const run = async (c) => {
      const r2 = await apply(c);
      if (r2) cur = r2;
      render2();
      menu.querySelector(".fe-pm-add input")?.focus();
    };
    menu.addEventListener("click", (e) => {
      const b = e.target.closest("[data-pm]");
      if (!b) return;
      e.preventDefault();
      e.stopPropagation();
      const k = b.dataset.pm;
      if (k === "pin") void run({ pinned: !cur.pinned });
      else if (k === "color") void run({ color: b.dataset.color || null });
      else if (k === "untag") void run({ tags: cur.tags.filter((t) => t !== b.dataset.tag) });
    });
    menu.addEventListener("submit", (e) => {
      e.preventDefault();
      const inp = menu.querySelector(".fe-pm-add input");
      const t = inp.value.replace(/,/g, " ").replace(/\s+/g, " ").trim();
      const why = t.toLowerCase() === "pin" ? '"pin" is kept for pins; pin the note instead' : t.length > 32 ? "A tag is at most 32 characters" : cur.tags.length >= 12 && !cur.tags.includes(t) ? "A note keeps at most 12 tags" : "";
      inp.setCustomValidity(why);
      if (why) {
        inp.reportValidity();
        return;
      }
      if (t && !cur.tags.includes(t)) void run({ tags: [...cur.tags, t] });
      else inp.value = "";
    });
    render2();
    const r = anchor.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - menu.offsetWidth - 8))}px`;
    menu.style.top = `${Math.min(r.bottom + 4, window.innerHeight - menu.offsetHeight - 8)}px`;
    const onDown = (e) => {
      if (!menu.contains(e.target) && !anchor.contains(e.target)) closePropsMenu();
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        closePropsMenu();
      }
    };
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    openMenu = { el: menu, off: () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
      menu.remove();
    } };
    menu.querySelector(".fe-pm-add input").focus();
  }
  function mountMetaBar(host, o) {
    const draw = () => {
      const p = o.props();
      host.innerHTML = `
      ${o.titleEditable() ? `<button id="fe-meta-title" class="fe-chip-title" data-title="${esc(p.title)}" title="${esc(p.title)}&#10;Click to edit the whole title" aria-label="Note title: ${esc(p.title)}. Click to edit.">${UI_ICON.rename}${midHtml(p.title)}</button>` : `<span class="fe-chip fe-chip-static" title="This note has no properties block yet; its title is its first line">${UI_ICON.notes}<span>${esc(p.title)}</span></span>`}
      <button class="fe-pbn fe-chip-btn${p.pinned ? " active" : ""}" data-m="pin" title="${p.pinned ? "Unpin this note" : "Pin this note to the top of the list"}">${UI_ICON.pin}<span>${p.pinned ? "pinned" : "pin"}</span></button>
      <button class="fe-pbn fe-chip-btn${p.color ? " active" : ""}" data-m="color" title="Set this note's colour">${colorDot(p.color)}<span>${p.color ?? "colour"}</span></button>
      ${p.tags.map((t) => `<span class="fe-chip">${UI_ICON.tag}<span>${esc(t)}</span><button class="fe-chip-x" data-m="untag" data-tag="${esc(t)}" title="Remove tag ${esc(t)}" aria-label="Remove tag ${esc(t)}">${UI_ICON.close}</button></span>`).join("")}
      <button class="fe-pbn fe-chip-btn" data-m="tag" title="Add a tag">${UI_ICON.add}<span>tag</span></button>`;
      const btn = host.querySelector("#fe-meta-title");
      btn?.addEventListener("click", () => {
        const box = document.createElement("textarea");
        box.id = "fe-meta-title-edit";
        box.className = "fe-chip-title";
        box.value = p.title;
        box.rows = 1;
        box.maxLength = 200;
        box.spellcheck = true;
        box.setAttribute("aria-label", "Note title");
        btn.replaceWith(box);
        const fit = () => {
          box.style.height = "auto";
          box.style.height = box.scrollHeight + 2 + "px";
        };
        fit();
        box.focus();
        box.select();
        let done = false;
        const finish = (save) => {
          if (done) return;
          done = true;
          const v = box.value.replace(/\s*\n\s*/g, " ").trim();
          if (save && v && v !== p.title) o.setTitle(v);
          else draw();
        };
        box.addEventListener("input", fit);
        box.addEventListener("blur", () => finish(true));
        box.addEventListener("keydown", (e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            e.preventDefault();
            finish(true);
          } else if (e.key === "Escape") {
            e.preventDefault();
            finish(false);
          }
        });
      });
    };
    host.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-m]");
      if (!b) return;
      const p = o.props();
      if (b.dataset.m === "pin") {
        await o.apply({ pinned: !p.pinned });
        draw();
      } else if (b.dataset.m === "untag") {
        await o.apply({ tags: p.tags.filter((t) => t !== b.dataset.tag) });
        draw();
      } else {
        openPropsMenu(b, p, async (c) => {
          const r = await o.apply(c);
          draw();
          return r;
        });
      }
    });
    draw();
    return draw;
  }

  // src/image-tools.ts
  var START_VIEW = { fit: true, zoom: 1, rot: 0, flip: false };
  function turnedSize(w, h, rot) {
    return rot % 180 === 0 ? { w, h } : { w: h, h: w };
  }
  function fitZoom(w, h, rot, stageW, stageH) {
    const t = turnedSize(w, h, rot);
    if (!t.w || !t.h) return 1;
    return Math.min(1, Math.max(stageW - 32, 1) / t.w, Math.max(stageH - 32, 1) / t.h);
  }
  var STEP = 1.25;
  var clampZoom = (z) => Math.min(16, Math.max(0.05, z));
  function viewTransform(v) {
    return `translate(-50%,-50%) scaleX(${v.flip ? -1 : 1}) rotate(${v.rot}deg)`;
  }
  var BTN = (act, icon2, text, title) => `<button class="fe-pbn" data-img="${act}" title="${esc(title)}">${icon2}<span>${text}</span></button>`;
  function mountImageTools(wrap, o) {
    wrap.innerHTML = `
    <div class="fe-ql-imgbar" role="toolbar" aria-label="Image tools">
      ${BTN("in", UI_ICON.zoomIn, "zoom in", "Zoom in")}
      ${BTN("out", UI_ICON.zoomOut, "zoom out", "Zoom out")}
      ${BTN("fit", UI_ICON.fit, "fit", "Fit the picture in the panel")}
      ${BTN("actual", UI_ICON.actualSize, "actual size", "Show at 100%")}
      ${BTN("rotate", UI_ICON.rotate, "rotate", "Turn a quarter clockwise")}
      ${BTN("flip", UI_ICON.flip, "flip", "Mirror left to right")}
      ${BTN("copy", UI_ICON.copyImage, "copy image", "Copy the picture as shown")}
      ${BTN("open", UI_ICON.external, "open in app", "Open in the default app")}
    </div>
    <div class="fe-ql-imgstage"><div class="fe-ql-imgsizer"><img class="fe-ql-img" src="${esc(o.href)}" alt="${esc(o.name)}"></div></div>
    <div class="fe-ql-dim"></div>`;
    const stage = wrap.querySelector(".fe-ql-imgstage");
    const sizer = wrap.querySelector(".fe-ql-imgsizer");
    const img = wrap.querySelector("img.fe-ql-img");
    const dim = wrap.querySelector(".fe-ql-dim");
    let v = { ...START_VIEW };
    const natural = () => ({ w: img.naturalWidth, h: img.naturalHeight });
    const zoomNow = () => v.fit ? fitZoom(natural().w, natural().h, v.rot, stage.clientWidth, stage.clientHeight) : v.zoom;
    const draw = () => {
      const n = natural();
      if (!n.w) return;
      const z = zoomNow();
      const t = turnedSize(n.w * z, n.h * z, v.rot);
      sizer.style.width = `${t.w}px`;
      sizer.style.height = `${t.h}px`;
      img.style.width = `${n.w * z}px`;
      img.style.height = `${n.h * z}px`;
      img.style.transform = viewTransform(v);
      dim.textContent = `${n.w} \xD7 ${n.h} \xB7 ${Math.round(z * 100)}%`;
      wrap.dataset.zoom = String(Math.round(z * 100));
      wrap.dataset.rot = String(v.rot);
      wrap.dataset.flip = v.flip ? "1" : "0";
    };
    if (img.complete) draw();
    else img.addEventListener("load", draw, { once: true });
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(() => {
      if (v.fit) draw();
    }).observe(stage);
    const copy = async () => {
      try {
        const reply = await new Promise((res) => chrome.runtime.sendMessage({ type: "bfb-fetch-image", url: new URL(o.href, location.href).href }, (r) => res(r ?? { ok: false, error: "no reply" })));
        if (!reply.ok || !reply.base64) throw new Error(reply.error || "could not read the image");
        const bytes = Uint8Array.from(atob(reply.base64), (c) => c.charCodeAt(0));
        const src = URL.createObjectURL(new Blob([bytes], { type: reply.type || "image/png" }));
        const pic = new Image();
        await new Promise((ok, bad) => {
          pic.onload = ok;
          pic.onerror = () => bad(new Error("cannot decode the image"));
          pic.src = src;
        });
        const n = { w: pic.naturalWidth, h: pic.naturalHeight };
        const t = turnedSize(n.w, n.h, v.rot);
        const cv = document.createElement("canvas");
        cv.width = t.w;
        cv.height = t.h;
        const ctx = cv.getContext("2d");
        ctx.translate(t.w / 2, t.h / 2);
        ctx.scale(v.flip ? -1 : 1, 1);
        ctx.rotate(v.rot * Math.PI / 180);
        ctx.drawImage(pic, -n.w / 2, -n.h / 2);
        URL.revokeObjectURL(src);
        const png = await new Promise((res) => cv.toBlob(res, "image/png"));
        if (!png) throw new Error("could not encode the image");
        await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
        o.notify("Image copied");
      } catch (e) {
        o.notify(`Copy failed: ${e.message}`);
      }
    };
    const act = (a) => {
      if (a === "in" || a === "out") {
        v = { ...v, zoom: clampZoom(zoomNow() * (a === "in" ? STEP : 1 / STEP)), fit: false };
      } else if (a === "fit") v = { ...v, fit: true };
      else if (a === "actual") v = { ...v, zoom: 1, fit: false };
      else if (a === "rotate") v = { ...v, rot: (v.rot + 90) % 360 };
      else if (a === "flip") v = { ...v, flip: !v.flip };
      else if (a === "copy") {
        void copy();
        return;
      } else if (a === "open") {
        void o.openNative(o.path).then((ok) => {
          if (!ok) o.notify("Open in app needs the native host: run native/install.sh");
        });
        return;
      }
      draw();
    };
    wrap.querySelector(".fe-ql-imgbar").addEventListener("click", (e) => {
      const b = e.target.closest("[data-img]");
      if (b) act(b.dataset.img);
    });
    stage.addEventListener("wheel", (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      act(e.deltaY < 0 ? "in" : "out");
    }, { passive: false });
  }

  // src/editor.ts
  var BUF_CAP = 60;
  var BUF_COALESCE = 600;
  var bufHist = /* @__PURE__ */ new Map();
  function insertAtCursor(el2, text) {
    const a = el2.selectionStart ?? el2.value.length, b = el2.selectionEnd ?? a;
    el2.value = el2.value.slice(0, a) + text + el2.value.slice(b);
    const at = a + text.length;
    el2.setSelectionRange(at, at);
    el2.dispatchEvent(new Event("input", { bubbles: true }));
    el2.focus();
  }
  function lineSpan(text, sel) {
    const from = text.lastIndexOf("\n", sel.start - 1) + 1;
    let to = text.indexOf("\n", Math.max(sel.end - (sel.end > sel.start && text[sel.end - 1] === "\n" ? 1 : 0), sel.start));
    if (to < 0) to = text.length;
    return { from, to };
  }
  function moveLines(text, sel, dir) {
    const { from, to } = lineSpan(text, sel);
    const block = text.slice(from, to);
    if (dir < 0) {
      if (from === 0) return { text, ...sel };
      const prevFrom = text.lastIndexOf("\n", from - 2) + 1;
      const prev = text.slice(prevFrom, from - 1);
      const out2 = text.slice(0, prevFrom) + block + "\n" + prev + text.slice(to);
      const shift2 = -(prev.length + 1);
      return { text: out2, start: sel.start + shift2, end: sel.end + shift2 };
    }
    if (to >= text.length) return { text, ...sel };
    let nextTo = text.indexOf("\n", to + 1);
    if (nextTo < 0) nextTo = text.length;
    const next = text.slice(to + 1, nextTo);
    const out = text.slice(0, from) + next + "\n" + block + text.slice(nextTo);
    const shift = next.length + 1;
    return { text: out, start: sel.start + shift, end: sel.end + shift };
  }
  function duplicateLines(text, sel) {
    const { from, to } = lineSpan(text, sel);
    const block = text.slice(from, to);
    const out = text.slice(0, to) + "\n" + block + text.slice(to);
    const shift = block.length + 1;
    return { text: out, start: sel.start + shift, end: sel.end + shift };
  }
  function indentLines(text, sel, outdent, unit = "  ") {
    const { from, to } = lineSpan(text, sel);
    const lines = text.slice(from, to).split("\n");
    let firstDelta = 0, total = 0;
    const changed = lines.map((l, i) => {
      let d;
      if (outdent) {
        const n = l.startsWith(unit) ? unit.length : l.startsWith(" ") ? 1 : 0;
        d = -n;
        l = l.slice(n);
      } else {
        l = unit + l;
        d = unit.length;
      }
      if (i === 0) firstDelta = d;
      total += d;
      return l;
    });
    const out = text.slice(0, from) + changed.join("\n") + text.slice(to);
    return { text: out, start: Math.max(from, sel.start + firstDelta), end: Math.max(from, sel.end + total) };
  }
  function continueList(text, sel) {
    const from = text.lastIndexOf("\n", sel.start - 1) + 1;
    const line = text.slice(from, sel.start);
    const m = line.match(/^(\s*)([-*+]|\d+[.)])\s(\[[ xX]\]\s)?(.*)$/);
    if (!m) return null;
    const [, ind, marker, box, rest] = m;
    if (!rest.trim() && !box) {
      const out2 = text.slice(0, from) + text.slice(sel.end);
      return { text: out2, start: from, end: from };
    }
    if (!rest.trim() && box) {
      const out2 = text.slice(0, from) + text.slice(sel.end);
      return { text: out2, start: from, end: from };
    }
    const nextMarker = /^\d+/.test(marker) ? String(parseInt(marker) + 1) + marker.slice(-1) : marker;
    const ins = "\n" + ind + nextMarker + " " + (box ? "[ ] " : "");
    const out = text.slice(0, sel.start) + ins + text.slice(sel.end);
    return { text: out, start: sel.start + ins.length, end: sel.start + ins.length };
  }
  function wrapSelection(text, sel, left, right = left) {
    const inner = text.slice(sel.start, sel.end);
    const out = text.slice(0, sel.start) + left + inner + right + text.slice(sel.end);
    return { text: out, start: sel.start + left.length, end: sel.end + left.length };
  }
  function tableSnippet(cols = 2, rows = 2) {
    const head = "| " + Array.from({ length: cols }, (_, i) => `Column ${i + 1}`).join(" | ") + " |";
    const sep = "|" + Array.from({ length: cols }, () => " --- |").join("");
    const body = Array.from({ length: rows }, () => "|" + Array.from({ length: cols }, () => "   |").join("")).join("\n");
    return `${head}
${sep}
${body}
`;
  }
  function attachBuffer(el2, id) {
    let h = bufHist.get(id) ?? { past: [], future: [], timer: null };
    bufHist.set(id, h);
    h.past = [el2.value ?? ""];
    h.future = [];
    const snap = () => {
      const now = el2.value ?? "";
      if (h.past[h.past.length - 1] === now) return;
      h.past.push(now);
      if (h.past.length > BUF_CAP) h.past.shift();
      h.future = [];
    };
    const record = () => {
      if (h.timer) clearTimeout(h.timer);
      h.timer = setTimeout(snap, BUF_COALESCE);
    };
    const put = (v) => {
      el2.value = v;
      el2.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const undo = () => {
      if (h.timer) clearTimeout(h.timer);
      snap();
      if (h.past.length < 2) return false;
      h.future.push(h.past.pop());
      put(h.past[h.past.length - 1]);
      return true;
    };
    const redo = () => {
      if (!h.future.length) return false;
      const v = h.future.pop();
      h.past.push(v);
      put(v);
      return true;
    };
    el2.addEventListener("input", record);
    el2.addEventListener("keydown", (e) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        if (undo()) {
          e.preventDefault();
          e.stopPropagation();
        }
      } else if (k === "z" && e.shiftKey || k === "y") {
        if (redo()) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    });
    return { undo, redo, snap, depth: () => h.past.length, insert: (t) => insertAtCursor(el2, t) };
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
    const ext2 = getExt(e);
    return IMG_EXTS.has(ext2) || PDF_EXTS.has(ext2) || VIDEO_EXTS.has(ext2) || AUDIO_EXTS.has(ext2) || FONT_EXTS.has(ext2) || TABLE_EXTS.has(ext2) || JSONL_EXTS.has(ext2) || ext2 === "json" || CODE_EXTS.has(ext2) || ext2 === "";
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
  var scrollMemo = /* @__PURE__ */ new Map();
  function previewEntry() {
    return currentEntry;
  }
  function keepPreviewedAsTab() {
    const path = currentEntry ? decodeURIComponent(new URL(currentEntry.href, location.href).pathname) : edit ? edit.root.replace(/\/$/, "") + "/" + edit.rel : null;
    if (path && deps.keepTab) deps.keepTab(path);
  }
  var deps;
  var overlay;
  var layout = { mode: "modal" };
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
    layout = getPreviewLayout();
    overlay = document.createElement("div");
    overlay.id = "fe-qlook";
    overlay.style.display = "none";
    overlay.innerHTML = `
    <div id="fe-ql-bg"></div>
    <div id="fe-ql-dialog">
      <div id="fe-ql-hdr">
        <span id="fe-ql-icon"></span>
        <a id="fe-ql-name" target="_blank" rel="noopener" title="Open natively in a new tab (\u2318-click / middle-click also work)"></a>
        <span id="fe-ql-meta"></span>
        <button id="fe-ql-copy" title="Copy full file contents to clipboard" disabled>
          <svg width="11" height="12" viewBox="0 0 11 12"><rect x="3" y="3" width="7" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M1 1h6v1" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
          <span>copy</span>
        </button>
        <a id="fe-ql-open" target="_blank" rel="noopener" title="Open raw file in a new tab">${UI_ICON.external}<span>open raw</span></a>
        <button id="fe-ql-go" title="Open in this tab (Enter)">${UI_ICON.files}<span>open</span></button>
        <button id="fe-ql-tab" title="Keep as a strip tab (t)">${UI_ICON.tab}<span>tab</span></button>
        <button id="fe-ql-dock" data-icon title="Dock the preview to the side">
          <svg width="13" height="13" viewBox="0 0 13 13"><rect x="1" y="1.5" width="11" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M8 1.5v10" stroke="currentColor" stroke-width="1.3"/></svg>
        </button>
        <button id="fe-ql-close" data-icon title="Close (Esc)">${UI_ICON.close}</button>
      </div>
      <div id="fe-ql-rz" title="Drag to resize"></div>
      <div id="fe-ql-rz-side" title="Drag to resize"></div>
      <div id="fe-ql-ai" style="display:none">
        <span id="fe-ql-ai-chip"><span class="dot"></span><span id="fe-ql-ai-chip-txt"></span></span>
        <button class="fe-ql-ai-btn" id="fe-ql-ai-sum" title="TL;DR of this file (local model)">Summarize</button>
        <button class="fe-ql-ai-btn" id="fe-ql-ai-exp" title="Explain this file, or describe a table (local model)"></button>
        <input id="fe-ql-ai-q" type="text" placeholder="Ask about this file" autocomplete="off" spellcheck="false">
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
    document.getElementById("fe-ql-go").addEventListener("click", () => {
      if (currentEntry) location.href = pageHref(currentEntry.href);
      else if (edit) location.href = pageHref("file://" + edit.root.replace(/\/$/, "") + "/" + edit.rel);
    });
    document.getElementById("fe-ql-tab").addEventListener("click", keepPreviewedAsTab);
    const bodyEl = document.getElementById("fe-ql-body");
    bodyEl.addEventListener("scroll", () => {
      if (currentEntry) scrollMemo.set(currentEntry.href, bodyEl.scrollTop);
    });
    document.getElementById("fe-ql-bg").addEventListener("click", closePreview);
    document.getElementById("fe-ql-dock").addEventListener("click", () => {
      layout = { ...layout, mode: layout.mode === "side" ? "modal" : "side" };
      savePreviewLayout(layout);
      applyLayout();
    });
    applyLayout();
    const dialog = document.getElementById("fe-ql-dialog");
    const drag = (grip, onMove, onUp) => {
      grip.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const move = (ev) => onMove(ev);
        const up = () => {
          document.removeEventListener("mousemove", move);
          document.removeEventListener("mouseup", up);
          document.body.style.cursor = "";
          onUp();
          savePreviewLayout(layout);
        };
        document.body.style.cursor = getComputedStyle(grip).cursor;
        document.addEventListener("mousemove", move);
        document.addEventListener("mouseup", up);
      });
    };
    drag(document.getElementById("fe-ql-rz"), (ev) => {
      const r = dialog.getBoundingClientRect();
      layout.modalW = Math.min(window.innerWidth - r.left - 8, Math.max(360, ev.clientX - r.left));
      layout.modalH = Math.min(window.innerHeight - r.top - 8, Math.max(240, ev.clientY - r.top));
      applyLayout();
    }, () => {
    });
    drag(document.getElementById("fe-ql-rz-side"), (ev) => {
      const r = overlay.getBoundingClientRect();
      layout.sideW = Math.min(window.innerWidth * 0.8, Math.max(280, r.right - ev.clientX));
      applyLayout();
    }, () => {
    });
    const copyBtn = document.getElementById("fe-ql-copy");
    copyBtn.addEventListener("click", () => {
      if (currentText === null) return;
      const flash = (ok) => {
        copyBtn.querySelector("span").textContent = ok ? "\u2713 copied" : "failed";
        setTimeout(() => {
          copyBtn.querySelector("span").textContent = "copy";
        }, 1400);
      };
      copyToClipboard(currentText).then(flash);
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
  function applyLayout() {
    const dialog = document.getElementById("fe-ql-dialog");
    const side = layout.mode === "side";
    overlay.classList.toggle("side", side);
    const host = side ? document.getElementById("fe-body") : document.getElementById("fe");
    if (host && overlay.parentElement !== host) host.appendChild(overlay);
    overlay.style.width = side && layout.sideW ? layout.sideW + "px" : "";
    dialog.style.width = !side && layout.modalW ? layout.modalW + "px" : "";
    dialog.style.height = !side && layout.modalH ? layout.modalH + "px" : "";
    const dock = document.getElementById("fe-ql-dock");
    dock.title = side ? "Float the preview as a window" : "Dock the preview to the side";
    dock.classList.toggle("on", side);
  }
  function closePreview() {
    if (edit) {
      if (edit.timer) clearTimeout(edit.timer);
      if (edit.dirty) void saveNote();
      edit = null;
    }
    overlay.style.display = "none";
    restoreFocus();
    document.getElementById("fe-ql-body").classList.remove("fe-editing");
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
  function setupAi(e, ext2) {
    llmAvailability().then((av) => {
      if (currentEntry !== e || !isPreviewOpen()) return;
      if (av.kind === "unavailable") return;
      const tabular = TABLE_EXTS.has(ext2) || JSONL_EXTS.has(ext2) || ext2 === "json";
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
  var edit = null;
  function editingRel() {
    return edit ? edit.rel : null;
  }
  function saveEditor() {
    return saveNote();
  }
  function editHeader(status) {
    if (!edit) return;
    const nameEl = document.getElementById("fe-ql-name");
    nameEl.innerHTML = midHtml((edit.dirty ? "\u25CF " : "") + noteTitle(edit.rel, edit.text));
    document.getElementById("fe-ql-meta").textContent = `${edit.rel} \xB7 ${status}`;
  }
  var stripFrontMatter = (t) => t.replace(/^---\n[\s\S]*?\n---\n?/, "");
  function discardEditor() {
    if (edit) {
      if (edit.timer) clearTimeout(edit.timer);
      edit.dirty = false;
    }
    closePreview();
  }
  function openNote(root, doc, onSaved, actions) {
    if (edit && edit.dirty) void saveNote();
    currentEntry = null;
    reqSeq++;
    const { head, body: noteBody } = splitNote(doc.text);
    edit = { root, rel: doc.rel, mtime: doc.mtime, text: doc.text, head, base: doc.text, touched: /* @__PURE__ */ new Set(), dirty: false, saving: false, version: 0, timer: null, onSaved, actions };
    currentText = doc.text;
    document.getElementById("fe-ql-icon").innerHTML = "";
    const nameEl = document.getElementById("fe-ql-name");
    nameEl.href = "file://" + root.replace(/\/$/, "") + "/" + doc.rel;
    document.getElementById("fe-ql-open").href = nameEl.href;
    resetAiUi();
    document.getElementById("fe-ql-ai").style.display = "none";
    const copyBtn = document.getElementById("fe-ql-copy");
    copyBtn.style.display = "";
    copyBtn.disabled = false;
    if (overlay.style.display === "none") rememberFocus();
    overlay.style.display = "flex";
    const body = document.getElementById("fe-ql-body");
    body.classList.add("fe-editing");
    body.innerHTML = `
    <div id="fe-ed-meta"></div>
    <div id="fe-ed-bar">
      <button class="fe-pbn" data-act="bold" title="Bold (\u2318B)"><b>B</b></button>
      <button class="fe-pbn" data-act="italic" title="Italic (\u2318I)"><i>I</i></button>
      <button class="fe-pbn" data-act="code" title="Code (\u2318E)">\u2039\u203A</button>
      <button class="fe-pbn" data-act="strike" title="Strikethrough (\u2318\u21E7X)"><s>S</s></button>
      <button class="fe-pbn" data-act="heading" title="Heading: each press adds a level, up to ###, then clears (\u2318\u21E7H)">H</button>
      <button class="fe-pbn" data-act="link" title="Link (\u2318K)">\u{1F517}</button>
      <button class="fe-pbn" data-act="quote" title="Quote (\u2318\u21E7.)">\u275D</button>
      <button class="fe-pbn" data-act="olist" title="Numbered list (\u2318\u21E77)">1.</button>
      <button class="fe-pbn" data-act="list" title="Bullet list">${UI_ICON.list}<span>list</span></button>
      <button class="fe-pbn" data-act="task" title="Task list">${UI_ICON.task}<span>task</span></button>
      <button class="fe-pbn" data-act="table" title="Insert a table">${UI_ICON.table}<span>table</span></button>
      <button class="fe-pbn" data-act="image" title="Insert an image (or paste / drop one)">${UI_ICON.image}<span>image</span></button>
      <button class="fe-pbn" data-act="versions" title="Every save of this note, from the folder's git history">${UI_ICON.versions}<span>versions</span></button>
      ${actions ? `<button class="fe-pbn" data-act="prev" title="Previous note in the list (\u2325\u2318\u2191)">${UI_ICON.prev}<span>prev</span></button>
      <button class="fe-pbn" data-act="next" title="Next note in the list (\u2325\u2318\u2193)">${UI_ICON.next}<span>next</span></button>
      <button class="fe-pbn" data-act="rename" title="Rename this note in the sidebar (F2 there)">${UI_ICON.rename}<span>rename</span></button>
      <button class="fe-pbn" data-act="delete" title="Move this note to .trash">${UI_ICON.trash}<span>delete</span></button>` : ""}
      <input type="file" id="fe-ed-file" accept="image/*" style="display:none">
      <span class="fe-ed-hint">\u2325\u2191\u2193 move line \xB7 \u2325\u21E7\u2191\u2193 duplicate \xB7 \u21E5 indent \xB7 Enter continues lists</span>
    </div>
    <div id="fe-ed-hist" style="display:none"></div>
    <div class="fe-ed"><textarea id="fe-ed-src" spellcheck="true"></textarea><div id="fe-ed-view" class="fe-md"></div></div>`;
    const ta = document.getElementById("fe-ed-src");
    const view = document.getElementById("fe-ed-view");
    ta.value = noteBody;
    edit.ta = ta;
    const buf = attachBuffer(ta, `note:${root}/${doc.rel}`);
    const apply = (r) => {
      buf.snap();
      ta.value = r.text;
      ta.setSelectionRange(r.start, r.end);
      ta.dispatchEvent(new Event("input", { bubbles: true }));
      ta.focus();
    };
    const sel = () => ({ start: ta.selectionStart, end: ta.selectionEnd });
    const prefixLines = (prefix) => {
      const s = sel();
      const from = ta.value.lastIndexOf("\n", s.start - 1) + 1;
      let to = ta.value.indexOf("\n", s.end);
      if (to < 0) to = ta.value.length;
      const lines = ta.value.slice(from, to).split("\n").map((l) => prefix + l);
      apply({ text: ta.value.slice(0, from) + lines.join("\n") + ta.value.slice(to), start: from, end: from + lines.join("\n").length });
    };
    const act = (name) => {
      if (name === "bold") apply(wrapSelection(ta.value, sel(), "**"));
      if (name === "italic") apply(wrapSelection(ta.value, sel(), "_"));
      if (name === "code") apply(wrapSelection(ta.value, sel(), "`"));
      if (name === "strike") apply(wrapSelection(ta.value, sel(), "~~"));
      if (name === "quote") prefixLines("> ");
      if (name === "olist") {
        const s = sel();
        const from = ta.value.lastIndexOf("\n", s.start - 1) + 1;
        let to = ta.value.indexOf("\n", s.end);
        if (to < 0) to = ta.value.length;
        const lines = ta.value.slice(from, to).split("\n").map((l, n) => `${n + 1}. ${l}`).join("\n");
        apply({ text: ta.value.slice(0, from) + lines + ta.value.slice(to), start: from, end: from + lines.length });
      }
      if (name === "heading") {
        const s = sel();
        const from = ta.value.lastIndexOf("\n", s.start - 1) + 1;
        let to = ta.value.indexOf("\n", from);
        if (to < 0) to = ta.value.length;
        const line = ta.value.slice(from, to);
        const level = line.match(/^(#{1,6}) /)?.[1].length ?? 0;
        const next = level >= 3 ? line.replace(/^#{1,6} /, "") : "#".repeat(level + 1) + " " + line.replace(/^#{1,6} /, "");
        apply({ text: ta.value.slice(0, from) + next + ta.value.slice(to), start: from + next.length, end: from + next.length });
      }
      if (name === "link") {
        const s = sel();
        const label = ta.value.slice(s.start, s.end) || "text";
        const t = `[${label}](url)`;
        const at = s.start + label.length + 3;
        apply({ text: ta.value.slice(0, s.start) + t + ta.value.slice(s.end), start: at, end: at + 3 });
      }
      if (name === "list") prefixLines("- ");
      if (name === "task") prefixLines("- [ ] ");
      if (name === "table") buf.insert((ta.value.slice(0, ta.selectionStart).endsWith("\n") || !ta.selectionStart ? "" : "\n") + tableSnippet());
      if (name === "image") document.getElementById("fe-ed-file").click();
      if (name === "versions") void toggleVersions();
      if (name === "prev") actions?.step(edit.rel, -1);
      if (name === "next") actions?.step(edit.rel, 1);
      if (name === "rename") actions?.rename(edit.rel);
      if (name === "delete") actions?.del(edit.rel);
    };
    const hist = document.getElementById("fe-ed-hist");
    const escHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const whenText = (ms) => new Date(ms).toLocaleString(void 0, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
    const toggleVersions = async () => {
      if (hist.style.display !== "none") {
        hist.style.display = "none";
        renderView();
        return;
      }
      hist.style.display = "";
      hist.textContent = "reading versions\u2026";
      try {
        const { versions: vs, repo } = await notes.history(root, edit?.rel ?? doc.rel);
        if (!vs.length) {
          hist.textContent = repo === false ? "No versions yet: the notes folder is not a git repository (Switchboard makes it one on its first save)." : "No versions yet: this note has not been committed to the notes folder's git history.";
          return;
        }
        hist.innerHTML = vs.slice(0, 30).map((v) => `<button class="fe-hist-row" data-sha="${v.sha}"><span>${whenText(v.when)}</span><span>${escHtml(v.reason)}</span><code>${v.sha}</code></button>`).join("") + (vs.length > 30 ? `<span class="fe-ed-hint">and ${vs.length - 30} older</span>` : "");
        hist.querySelectorAll(".fe-hist-row").forEach((b) => b.addEventListener("click", () => void showVersion(b.dataset.sha)));
      } catch (err) {
        hist.textContent = `versions failed: ${err.message}`;
      }
    };
    const showVersion = async (sha) => {
      hist.querySelectorAll(".fe-hist-row").forEach((b) => b.classList.toggle("active", b.dataset.sha === sha));
      try {
        const v = await notes.version(root, edit?.rel ?? doc.rel, sha);
        view.innerHTML = `<div class="fe-hist-head"><span>version ${sha}</span><button class="fe-pbn" id="fe-hist-use" title="Put this text in the editor; today's text stays in the versions">Use this version</button><button class="fe-pbn" id="fe-hist-back">Back to now</button></div>` + renderMarkdown(stripFrontMatter(v.text), nameEl.href);
        document.getElementById("fe-hist-use").addEventListener("click", () => {
          buf.snap();
          ta.value = splitNote(v.text).body;
          ta.dispatchEvent(new Event("input", { bubbles: true }));
          hist.style.display = "none";
          ta.focus();
        });
        document.getElementById("fe-hist-back").addEventListener("click", () => renderView());
      } catch (err) {
        hist.textContent = `version failed: ${err.message}`;
      }
    };
    document.getElementById("fe-ed-bar").querySelectorAll("[data-act]").forEach((b) => b.addEventListener("mousedown", (e) => {
      e.preventDefault();
      act(b.dataset.act);
    }));
    const addImage = async (file) => {
      const st2 = edit;
      if (!st2 || st2.root !== root) return;
      const ext2 = (file.type.split("/")[1] || "png").replace("jpeg", "jpg");
      const rel = `attachments/${slugForTitle(noteTitle(st2.rel, st2.text)).replace(/\.md$/, "")}-${Date.now().toString(36)}.${ext2}`;
      const b64 = await new Promise((res) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(",")[1] || "");
        r.readAsDataURL(file);
      });
      try {
        await notes.writeBinary(root, rel, b64);
        const depth = st2.rel.split("/").length - 1;
        buf.insert(`![${file.name.replace(/\.[^.]+$/, "")}](${"../".repeat(depth)}${rel})`);
      } catch (err) {
        editHeader(`image failed: ${err.message}`);
      }
    };
    const imageFiles = (dt) => [...dt?.files ?? []].filter((f) => f.type.startsWith("image/"));
    ta.addEventListener("paste", (e) => {
      const fs = imageFiles(e.clipboardData);
      if (fs.length) {
        e.preventDefault();
        fs.forEach((f) => void addImage(f));
      }
    });
    ta.addEventListener("drop", (e) => {
      const fs = imageFiles(e.dataTransfer);
      if (fs.length) {
        e.preventDefault();
        fs.forEach((f) => void addImage(f));
      }
    });
    ta.addEventListener("dragover", (e) => e.preventDefault());
    document.getElementById("fe-ed-file").addEventListener("change", function() {
      [...this.files ?? []].forEach((f) => void addImage(f));
      this.value = "";
    });
    const renderView = () => {
      view.innerHTML = renderMarkdown(ta.value, nameEl.href);
    };
    renderView();
    const showClash = () => {
      document.getElementById("fe-ed-clash")?.remove();
      const sides = clashSides(ta.value);
      if (!sides) return;
      document.getElementById("fe-ql-body").insertAdjacentHTML(
        "afterbegin",
        `<div id="fe-ed-clash" class="fe-ql-note">Two versions, keep: <button class="fe-pbn" data-keep="first">${UI_ICON.files}<span>${esc(sides[0])}</span></button> <button class="fe-pbn" data-keep="second">${UI_ICON.files}<span>${esc(sides[1])}</span></button> <button class="fe-pbn" data-keep="both">${UI_ICON.notes}<span>both</span></button></div>`
      );
      document.querySelectorAll("#fe-ed-clash [data-keep]").forEach((b) => b.addEventListener("click", () => {
        ta.value = settleClash(ta.value, b.dataset.keep);
        ta.dispatchEvent(new Event("input", { bubbles: true }));
        void saveNote();
      }));
    };
    showClash();
    let viewTimer = null;
    ta.addEventListener("input", () => {
      if (!edit) return;
      if (!!document.getElementById("fe-ed-clash") !== !!clashSides(ta.value)) showClash();
      edit.text = edit.head + ta.value;
      edit.dirty = true;
      edit.version++;
      currentText = edit.text;
      editHeader("unsaved");
      if (viewTimer) clearTimeout(viewTimer);
      viewTimer = setTimeout(renderView, 120);
      if (edit.timer) clearTimeout(edit.timer);
      edit.timer = setTimeout(() => void saveNote(), 1500);
    });
    ta.addEventListener("keydown", (e) => {
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      const stop = () => {
        e.preventDefault();
        e.stopPropagation();
      };
      if (mod && k === "s") {
        stop();
        void saveNote();
      } else if (e.key === "Escape") {
        stop();
        closePreview();
      } else if (mod && !e.shiftKey && k === "b") {
        stop();
        act("bold");
      } else if (mod && !e.shiftKey && k === "i") {
        stop();
        act("italic");
      } else if (mod && !e.shiftKey && k === "e") {
        stop();
        act("code");
      } else if (mod && !e.shiftKey && k === "k") {
        stop();
        act("link");
      } else if (mod && e.shiftKey && k === "x") {
        stop();
        act("strike");
      } else if (mod && e.shiftKey && k === "h") {
        stop();
        act("heading");
      } else if (mod && e.shiftKey && (k === "." || k === ">")) {
        stop();
        act("quote");
      } else if (mod && e.shiftKey && (k === "7" || k === "&")) {
        stop();
        act("olist");
      } else if (mod && e.altKey && !e.shiftKey && (e.key === "ArrowUp" || e.key === "ArrowDown") && actions) {
        stop();
        actions.step(edit.rel, e.key === "ArrowDown" ? 1 : -1);
      } else if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        stop();
        apply(e.shiftKey ? duplicateLines(ta.value, sel()) : moveLines(ta.value, sel(), e.key === "ArrowDown" ? 1 : -1));
      } else if (e.key === "Tab") {
        stop();
        apply(indentLines(ta.value, sel(), e.shiftKey));
      } else if (e.key === "Enter" && !mod && !e.shiftKey) {
        const r = continueList(ta.value, sel());
        if (r) {
          stop();
          apply(r);
        }
      }
    });
    const st = edit;
    const change = (fn, keys) => {
      if (/^<{7} /m.test(st.text)) {
        editHeader("settle the two versions before changing properties");
        return false;
      }
      st.head = fn(st.head);
      keys.forEach((k) => st.touched.add(k));
      st.text = st.head + ta.value;
      st.dirty = true;
      st.version++;
      currentText = st.text;
      editHeader("unsaved");
      if (st.timer) clearTimeout(st.timer);
      st.timer = setTimeout(() => void saveNote(), 1500);
      return true;
    };
    st.redrawMeta = mountMetaBar(document.getElementById("fe-ed-meta"), {
      props: () => readProps(st.rel, st.text),
      titleEditable: () => !!st.head,
      setTitle: (v) => {
        change((h) => setField(h, "title", JSON.stringify(v)), ["title"]);
        st.redrawMeta?.();
      },
      apply: (c) => {
        change((h) => applyChange(h, c), changedKeys(c));
        return readProps(st.rel, st.text);
      }
    });
    editHeader("saved");
    ta.setSelectionRange(0, 0);
    ta.focus();
    ta.scrollTop = 0;
  }
  async function saveNote(st = edit) {
    if (!st || st.saving) return;
    if (st.timer) {
      clearTimeout(st.timer);
      st.timer = null;
    }
    st.saving = true;
    const version = st.version;
    let text = stampUpdated(st.text);
    if (frontmatterDrift(st.base, text, st.touched).length) {
      if (st.ta && !st.head) {
        st.ta.value = "\n" + st.ta.value;
        st.text = st.head + st.ta.value;
        text = stampUpdated(st.text);
      }
      if (frontmatterDrift(st.base, text, st.touched).length) {
        st.saving = false;
        if (edit === st) editHeader("not saved: this would change the note properties");
        return;
      }
    }
    let wrote = false;
    try {
      const r = await notes.write(st.root, st.rel, text, st.mtime);
      wrote = true;
      st.mtime = r.mtime;
      st.dirty = st.version !== version;
      st.base = text;
      const want = slugForTitle(noteTitle(st.rel, st.text));
      if (/^untitled-/.test(st.rel.split("/").pop()) && !/^untitled/.test(want)) {
        const to = st.rel.replace(/[^/]+$/, want);
        try {
          await notes.rename(st.root, st.rel, to);
          st.rel = to;
        } catch {
        }
      }
      if (edit === st) editHeader(st.dirty ? "unsaved" : "saved " + (/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      st.onSaved?.(st.rel);
    } catch (err) {
      const e = err;
      if (edit === st) {
        editHeader(e.code === "notes_conflict" ? "changed on disk, not saved" : `save failed: ${e.message}`);
        if (e.code === "notes_conflict") {
          const body = document.getElementById("fe-ql-body");
          if (!document.getElementById("fe-ed-conflict")) {
            body.insertAdjacentHTML(
              "afterbegin",
              `<div id="fe-ed-conflict" class="fe-ql-note err">Another program changed this note. <button id="fe-ed-reload" class="fe-pbn" title="Replace the editor text with the file on disk">Reload from disk</button> <button id="fe-ed-force" class="fe-pbn" title="Write the editor text over the disk copy">Overwrite</button></div>`
            );
            document.getElementById("fe-ed-reload").addEventListener("click", () => {
              notes.read(st.root, st.rel).then((d) => openNote(st.root, d, st.onSaved, st.actions));
            });
            document.getElementById("fe-ed-force").addEventListener("click", () => {
              st.mtime = 0;
              notes.read(st.root, st.rel).then((d) => {
                st.mtime = d.mtime;
                document.getElementById("fe-ed-conflict")?.remove();
                void saveNote();
              });
            });
          }
        }
      } else deps.saveError?.(`Note save failed: ${e.message}`);
    } finally {
      st.saving = false;
      if (wrote && st.dirty) void saveNote(st);
    }
  }
  function openPreview(e) {
    if (!canPreview(e)) return;
    if (edit) {
      if (edit.timer) clearTimeout(edit.timer);
      if (edit.dirty) void saveNote();
      edit = null;
    }
    document.getElementById("fe-ql-body").classList.remove("fe-editing");
    closePropsMenu();
    currentEntry = e;
    const seq = ++reqSeq;
    const ext2 = getExt(e);
    document.getElementById("fe-ql-icon").innerHTML = getIcon(e, deps.iconRules());
    const nameEl = document.getElementById("fe-ql-name");
    nameEl.textContent = e.name;
    nameEl.href = e.href;
    document.getElementById("fe-ql-meta").textContent = [kindName(ext2), e.rawBytes >= 0 ? fmtSize(e.rawBytes) : ""].filter(Boolean).join(" \xB7 ");
    document.getElementById("fe-ql-open").href = e.href;
    const body = document.getElementById("fe-ql-body");
    if (overlay.style.display === "none") rememberFocus();
    overlay.style.display = "flex";
    dsvHeader = [];
    dsvRows = [];
    dsvSort = null;
    currentText = null;
    resetAiUi();
    const copyBtn = document.getElementById("fe-ql-copy");
    copyBtn.disabled = true;
    if (IMG_EXTS.has(ext2) || PDF_EXTS.has(ext2) || VIDEO_EXTS.has(ext2) || AUDIO_EXTS.has(ext2) || FONT_EXTS.has(ext2)) {
      copyBtn.style.display = "none";
      if (IMG_EXTS.has(ext2)) {
        body.innerHTML = '<div class="fe-ql-imgwrap"></div>';
        mountImageTools(body.querySelector(".fe-ql-imgwrap"), {
          href: e.href,
          name: e.name,
          path: decodeURIComponent(new URL(e.href, location.href).pathname),
          notify: (m) => deps.toast?.(m),
          // the Ghostty host also opens a file in its default app; a missing host answers not-ok
          openNative: (p) => new Promise((res) => chrome.runtime.sendMessage(
            { type: "bfb-native-oneshot", host: "com.better_file_browser.ghostty", payload: { action: "open_file", path: p } },
            (r) => res(!chrome.runtime.lastError && !!r?.ok && r.response?.success === true)
          ))
        });
      } else if (PDF_EXTS.has(ext2)) body.innerHTML = `<embed class="fe-ql-pdf" src="${esc(e.href)}" type="application/pdf">`;
      else if (VIDEO_EXTS.has(ext2)) body.innerHTML = `<div class="fe-ql-media-wrap"><video class="fe-ql-media" src="${esc(e.href)}" controls autoplay muted></video></div>`;
      else if (AUDIO_EXTS.has(ext2)) body.innerHTML = `<div class="fe-ql-center"><audio src="${esc(e.href)}" controls></audio></div>`;
      else body.innerHTML = fontSpecimen(e.href);
      return;
    }
    copyBtn.style.display = "";
    setupAi(e, ext2);
    if (e.rawBytes > FETCH_WARN_BYTES) {
      body.innerHTML = `
      <div class="fe-ql-center">
        <div class="fe-ql-note">File is ${fmtSize(e.rawBytes)} \u2014 large files can be slow to render.</div>
        <button id="fe-ql-force" class="fe-pbn" title="Render despite the size">Load anyway</button>
      </div>`;
      document.getElementById("fe-ql-force").addEventListener("click", () => fetchAndRender(e, ext2, seq));
      return;
    }
    fetchAndRender(e, ext2, seq);
  }
  function fetchAndRender(e, ext2, seq) {
    const body = document.getElementById("fe-ql-body");
    body.innerHTML = `<div class="fe-ql-center"><div class="fe-ql-note">Loading\u2026</div></div>`;
    fetchFileText(e.href).then((text) => {
      if (seq !== reqSeq) return;
      currentText = text;
      document.getElementById("fe-ql-copy").disabled = false;
      document.getElementById("fe-ql-meta").textContent = metaSummary(fileMeta(text, ext2, e.href, e.rawBytes >= 0 ? e.rawBytes : void 0));
      render(text, ext2);
    }).catch((err) => {
      if (seq !== reqSeq) return;
      console.error("[BFB] preview failed:", e.href, err);
      const stale = err instanceof FileFetchError && err.code === "context-invalidated";
      body.innerHTML = stale ? `<div class="fe-ql-center"><div class="fe-ql-note err">The extension was reloaded; this page needs a refresh.</div><button id="fe-ql-retry" class="fe-pbn" title="Reload this page">Refresh page</button></div>` : `<div class="fe-ql-center"><div class="fe-ql-note err">Could not read file.</div><button id="fe-ql-retry" class="fe-pbn" title="Try reading the file again">Retry</button></div>`;
      document.getElementById("fe-ql-retry").addEventListener("click", () => {
        if (stale) location.reload();
        else fetchAndRender(e, ext2, seq);
      });
    });
  }
  function render(text, ext2) {
    const body = document.getElementById("fe-ql-body");
    if (sniffBinary(text)) {
      document.getElementById("fe-ql-ai").style.display = "none";
      body.innerHTML = `<div class="fe-ql-center"><div class="fe-ql-note">Binary file \u2014 no text preview.</div></div>`;
      return;
    }
    if (TABLE_EXTS.has(ext2)) {
      const rows = parseDSV(text, ext2 === "tsv" ? "	" : ",");
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
    if (JSONL_EXTS.has(ext2)) {
      body.innerHTML = renderJsonl(text);
      return;
    }
    if (ext2 === "json") {
      body.innerHTML = renderJsonTree(text);
      return;
    }
    if (ext2 === "html" || ext2 === "htm") {
      renderHtml(body, text);
      return;
    }
    if (ext2 === "md" || ext2 === "mdx") {
      body.innerHTML = renderMarkdown(text, currentEntry?.href ?? "");
      body.querySelectorAll("a[href]:not(.fe-md-anchor)").forEach((a) => {
        a.target = "_blank";
        a.rel = "noopener";
      });
      restoreScroll(body);
      return;
    }
    body.innerHTML = renderCode(text, ext2);
    restoreScroll(body);
  }
  var htmlSource = false;
  function renderHtml(body, text) {
    const btn = (v, label, on) => `<button class="fe-pbn${on ? " on" : ""}" data-v="${v}" title="${v === "page" ? "Show the rendered page" : "Show the HTML source"}">${label}</button>`;
    body.innerHTML = `<div class="fe-ql-htmlbar">${btn("page", "Page", !htmlSource)}${btn("src", "Source", htmlSource)}</div>` + (htmlSource ? renderCode(text, "html") : '<iframe class="fe-ql-html" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"></iframe>');
    const frame = body.querySelector("iframe.fe-ql-html");
    if (frame && currentEntry) frame.src = currentEntry.href;
    body.querySelectorAll(".fe-ql-htmlbar button").forEach((b) => b.addEventListener("click", () => {
      htmlSource = b.dataset.v === "src";
      renderHtml(body, text);
    }));
  }
  function restoreScroll(body) {
    const top = currentEntry ? scrollMemo.get(currentEntry.href) : void 0;
    if (top) body.scrollTop = top;
  }

  // src/styles.ts
  var CSS = `
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0d1117;--s1:#151b23;--s2:#1c232d;--s3:#252e3a;
  --bd:#2a313c;--bd2:#3a434f;--tx:#e6edf3;--mt:#9aa4af;--dm:#6e7781;
  --shade:rgb(139 148 158 / .14);--shade2:rgb(139 148 158 / .24);
  --ac:#58a6ff;--dir:#79c0ff;--gold:#d29922;--green:#3fb950;
  --hover:#1c232d;--act:#1a3a5c;--r:6px;
  --t-fast:120ms;--t-base:180ms;--t-slow:260ms;--ease:cubic-bezier(.2,.8,.2,1);
  --mono:'SF Mono',Menlo,Consolas,monospace;
  --nc-red:#ff6b6b;--nc-orange:#ffa94d;--nc-yellow:#ffd43b;--nc-green:#51cf66;--nc-teal:#38d9a9;--nc-blue:#4dabf7;--nc-purple:#b197fc;--nc-pink:#f783ac;
}
#fe[data-theme="light"]{
  --bg:#ffffff;--s1:#f6f8fa;--s2:#eff2f5;--s3:#e5e9ee;
  --bd:#dde3e9;--bd2:#c9d1d9;--tx:#1f2328;--mt:#59636e;--dm:#8c959f;
  --shade:rgb(110 119 129 / .10);--shade2:rgb(110 119 129 / .18);
  --hover:#f3f5f7;--act:#dbeafe;--ac:#0969da;--dir:#0550ae;
  --nc-red:#d92d2d;--nc-orange:#d9730d;--nc-yellow:#b58900;--nc-green:#2b8a3e;--nc-teal:#0c8f78;--nc-blue:#1971c2;--nc-purple:#7048e8;--nc-pink:#c2255c;
}
html:has(#fe[data-theme="light"]){
  --bg:#ffffff;--s1:#f6f8fa;--s2:#eff2f5;--s3:#e5e9ee;
  --bd:#dde3e9;--bd2:#c9d1d9;--tx:#1f2328;--mt:#59636e;--dm:#8c959f;
  --shade:rgb(110 119 129 / .10);--shade2:rgb(110 119 129 / .18);
  --hover:#f3f5f7;--act:#dbeafe;--ac:#0969da;--dir:#0550ae;
  --nc-red:#d92d2d;--nc-orange:#d9730d;--nc-yellow:#b58900;--nc-green:#2b8a3e;--nc-teal:#0c8f78;--nc-blue:#1971c2;--nc-purple:#7048e8;--nc-pink:#c2255c;
}
/* Button: plain by default (design-system.md). data-variant solid|outline|shade,
   data-shade (same as variant shade), data-hover-shade, data-icon (a circle),
   data-size sm. Every bar's buttons share these rules. */
.btn,#fe-bar button,#fe-toolbar button,#fe-fp-bar button,#fe-ql-hdr button,#fe-ql-hdr #fe-ql-open,.fe-ql-ai-btn,.fe-pbn{display:inline-flex;align-items:center;justify-content:center;gap:5px;height:26px;padding:0 8px;flex-shrink:0;
  border:1px solid transparent;border-radius:6px;background:none;color:var(--mt);font:inherit;font-size:calc(12px * var(--ui-text-scale,1));
  line-height:1;white-space:nowrap;text-decoration:none;cursor:pointer;
  transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease),border-color var(--t-fast) var(--ease)}
.btn:hover{color:var(--tx)}
.btn[data-hover-shade]:hover,#fe-bar button:hover,#fe-toolbar button:hover,#fe-fp-bar button:hover,#fe-ql-hdr button:hover,#fe-ql-hdr #fe-ql-open:hover,.fe-ql-ai-btn:hover,.fe-pbn:hover{color:var(--tx);background:var(--shade)}
.btn[data-variant="shade"],#fe-bar button[data-variant="shade"],#fe-toolbar button[data-variant="shade"],#fe-fp-bar button[data-variant="shade"],#fe-ql-hdr button[data-variant="shade"],#fe-ql-hdr #fe-ql-open[data-variant="shade"],.fe-ql-ai-btn[data-variant="shade"],.fe-pbn[data-variant="shade"],.btn[data-shade],#fe-bar button[data-shade],#fe-toolbar button[data-shade],#fe-fp-bar button[data-shade],#fe-ql-hdr button[data-shade],#fe-ql-hdr #fe-ql-open[data-shade],.fe-ql-ai-btn[data-shade],.fe-pbn[data-shade]{background:var(--shade)}
.btn[data-variant="shade"]:hover,#fe-bar button[data-variant="shade"]:hover,#fe-toolbar button[data-variant="shade"]:hover,#fe-fp-bar button[data-variant="shade"]:hover,#fe-ql-hdr button[data-variant="shade"]:hover,#fe-ql-hdr #fe-ql-open[data-variant="shade"]:hover,.fe-ql-ai-btn[data-variant="shade"]:hover,.fe-pbn[data-variant="shade"]:hover,.btn[data-shade]:hover,#fe-bar button[data-shade]:hover,#fe-toolbar button[data-shade]:hover,#fe-fp-bar button[data-shade]:hover,#fe-ql-hdr button[data-shade]:hover,#fe-ql-hdr #fe-ql-open[data-shade]:hover,.fe-ql-ai-btn[data-shade]:hover,.fe-pbn[data-shade]:hover{background:var(--shade2)}
.btn[data-variant="outline"],#fe-bar button[data-variant="outline"],#fe-toolbar button[data-variant="outline"],#fe-fp-bar button[data-variant="outline"],#fe-ql-hdr button[data-variant="outline"],#fe-ql-hdr #fe-ql-open[data-variant="outline"],.fe-ql-ai-btn[data-variant="outline"],.fe-pbn[data-variant="outline"]{border-color:var(--bd2)}
.btn[data-variant="outline"]:hover,#fe-bar button[data-variant="outline"]:hover,#fe-toolbar button[data-variant="outline"]:hover,#fe-fp-bar button[data-variant="outline"]:hover,#fe-ql-hdr button[data-variant="outline"]:hover,#fe-ql-hdr #fe-ql-open[data-variant="outline"]:hover,.fe-ql-ai-btn[data-variant="outline"]:hover,.fe-pbn[data-variant="outline"]:hover{border-color:var(--mt)}
.btn[data-variant="solid"],#fe-bar button[data-variant="solid"],#fe-toolbar button[data-variant="solid"],#fe-fp-bar button[data-variant="solid"],#fe-ql-hdr button[data-variant="solid"],#fe-ql-hdr #fe-ql-open[data-variant="solid"],.fe-ql-ai-btn[data-variant="solid"],.fe-pbn[data-variant="solid"]{background:var(--ac);color:#fff}
.btn[data-variant="solid"]:hover,#fe-bar button[data-variant="solid"]:hover,#fe-toolbar button[data-variant="solid"]:hover,#fe-fp-bar button[data-variant="solid"]:hover,#fe-ql-hdr button[data-variant="solid"]:hover,#fe-ql-hdr #fe-ql-open[data-variant="solid"]:hover,.fe-ql-ai-btn[data-variant="solid"]:hover,.fe-pbn[data-variant="solid"]:hover{background:var(--ac);color:#fff;filter:brightness(1.1)}
.btn[data-icon],#fe-bar button[data-icon],#fe-toolbar button[data-icon],#fe-fp-bar button[data-icon],#fe-ql-hdr button[data-icon],#fe-ql-hdr #fe-ql-open[data-icon],.fe-ql-ai-btn[data-icon],.fe-pbn[data-icon]{width:26px;padding:0;border-radius:50%}
.btn[data-size="sm"],#fe-bar button[data-size="sm"],#fe-toolbar button[data-size="sm"],#fe-fp-bar button[data-size="sm"],#fe-ql-hdr button[data-size="sm"],#fe-ql-hdr #fe-ql-open[data-size="sm"],.fe-ql-ai-btn[data-size="sm"],.fe-pbn[data-size="sm"]{height:22px;font-size:calc(11px * var(--ui-text-scale,1))}
.btn[data-size="sm"][data-icon],#fe-bar button[data-size="sm"][data-icon],#fe-toolbar button[data-size="sm"][data-icon],#fe-fp-bar button[data-size="sm"][data-icon],#fe-ql-hdr button[data-size="sm"][data-icon],#fe-ql-hdr #fe-ql-open[data-size="sm"][data-icon],.fe-ql-ai-btn[data-size="sm"][data-icon],.fe-pbn[data-size="sm"][data-icon]{width:22px}
.btn.on,#fe-bar button.on,#fe-toolbar button.on,#fe-fp-bar button.on,#fe-ql-hdr button.on,#fe-ql-hdr #fe-ql-open.on,.fe-ql-ai-btn.on,.fe-pbn.on,.btn.active,#fe-bar button.active,#fe-toolbar button.active,#fe-fp-bar button.active,#fe-ql-hdr button.active,#fe-ql-hdr #fe-ql-open.active,.fe-ql-ai-btn.active,.fe-pbn.active{color:var(--ac);background:var(--shade)}
.btn:disabled,#fe-bar button:disabled,#fe-toolbar button:disabled,#fe-fp-bar button:disabled,#fe-ql-hdr button:disabled,#fe-ql-hdr #fe-ql-open:disabled,.fe-ql-ai-btn:disabled,.fe-pbn:disabled{opacity:.45;cursor:default;background:none}
.btn:focus-visible,#fe-bar button:focus-visible,#fe-toolbar button:focus-visible,#fe-fp-bar button:focus-visible,#fe-ql-hdr button:focus-visible,#fe-ql-hdr #fe-ql-open:focus-visible,.fe-ql-ai-btn:focus-visible,.fe-pbn:focus-visible{outline:2px solid var(--ac);outline-offset:1px}
.btn svg,#fe-bar button svg,#fe-toolbar button svg,#fe-fp-bar button svg,#fe-ql-hdr button svg,#fe-ql-hdr #fe-ql-open svg,.fe-ql-ai-btn svg,.fe-pbn svg{flex:none}
@media (prefers-reduced-motion:reduce){.btn,#fe-bar button,#fe-toolbar button,#fe-fp-bar button,#fe-ql-hdr button,#fe-ql-hdr #fe-ql-open,.fe-ql-ai-btn,.fe-pbn{transition:none}}
html,body{height:100%;background:var(--bg);color:var(--tx);
  font:calc(13px * var(--ui-text-scale,1))/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;overflow:hidden}
body{opacity:1!important}
#fe{display:flex;flex-direction:column;height:100vh;background:var(--bg);color:var(--tx)}
#fe-bar{display:flex;align-items:center;gap:6px;padding:8px 14px;
  background:var(--s1);border-bottom:1px solid var(--bd);flex-shrink:0;min-height:42px}
#fe-bc{display:flex;align-items:center;gap:1px;flex:1;overflow:hidden;white-space:nowrap;min-width:0}
.fe-crumb{color:var(--mt);text-decoration:none;padding:2px 5px;border-radius:4px;
  font-size:calc(12px * var(--ui-text-scale,1));flex-shrink:0;transition:background .1s,color .1s}
.fe-crumb:last-of-type{color:var(--tx);font-weight:500}
.fe-crumb:hover{background:var(--hover);color:var(--tx)}
.fe-sep{color:var(--dm);font-size:calc(11px * var(--ui-text-scale,1));flex-shrink:0;padding:0 1px}
#fe-bar .fe-crumb-dd{background:none;border:none;color:var(--dm);cursor:pointer;
  padding:0 2px;font-size:calc(9px * var(--ui-text-scale,1));border-radius:3px;line-height:1;opacity:0.35;
  transition:opacity .1s,color .1s,background .1s;flex-shrink:0;min-width:0}
#fe-bar .fe-crumb-dd:hover{background:var(--hover);color:var(--ac);opacity:1;border:none}
#fe-bar .fe-crumb-dd svg{display:block}
#fe-crumb-menu{
  position:fixed;z-index:300;
  background:var(--s1);border:1px solid var(--bd);border-radius:var(--r);
  min-width:220px;max-width:340px;max-height:340px;overflow:hidden;
  box-shadow:0 8px 24px #0009;display:none;padding:4px 0;
}
.fe-dd-search-wrap{padding:5px 8px 7px;border-bottom:1px solid var(--bd)}
.fe-dd-search{width:100%;background:var(--bg);border:1px solid var(--bd);color:var(--tx);
  padding:4px 8px;border-radius:5px;font-size:calc(12px * var(--ui-text-scale,1));outline:none;box-sizing:border-box}
.fe-dd-search:focus{border-color:var(--ac)}
.fe-dd-items{max-height:288px;overflow-y:auto;padding:2px 0}
.fe-dd-item{display:flex;align-items:center;gap:8px;padding:6px 12px;
  color:var(--tx);text-decoration:none;font-size:calc(12px * var(--ui-text-scale,1));white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis;transition:background .08s}
.fe-dd-item:hover{background:var(--hover)}
.fe-dd-item.dir{color:var(--dir)}
.fe-dd-item svg{flex-shrink:0}
.fe-dd-spinner,.fe-dd-empty{padding:10px 14px;font-size:calc(12px * var(--ui-text-scale,1));color:var(--dm);font-style:italic}
#fe-bm-btn.on,#fe-bm-btn.on:hover{color:var(--gold)}
#fe-theme-btn #fe-sun{display:none}
#fe-theme-btn #fe-moon{display:block}
#fe[data-theme="light"] #fe-theme-btn #fe-sun{display:block}
#fe[data-theme="light"] #fe-theme-btn #fe-moon{display:none}
#fe-body{display:flex;flex:1;overflow:hidden}
#fe-side{width:272px;flex-shrink:0;background:var(--s1);border-right:1px solid var(--bd);display:flex;min-height:0;overflow:hidden}
/* The rail picks one lens; the lens fills the rest of the sidebar. */
#fe-rail{width:52px;flex:none;display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 0;border-right:1px solid var(--bd)}
.fe-rail-btn{width:44px;display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 0 5px;border:0;border-radius:8px;background:none;color:var(--mt);cursor:pointer;
  font:inherit;transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease)}
.fe-rail-btn[hidden]{display:none}
.fe-rail-btn svg{width:17px;height:17px}
.fe-rail-btn em{font-style:normal;font-size:calc(10px * var(--ui-text-scale,1));letter-spacing:.01em}
.fe-rail-btn:hover{background:var(--hover);color:var(--tx)}
.fe-rail-btn.on{background:color-mix(in srgb,var(--ac) 16%,transparent);color:var(--tx)}
.fe-rail-btn.on:hover{background:color-mix(in srgb,var(--ac) 22%,transparent)}
.fe-rail-btn:focus-visible{outline:2px solid var(--ac);outline-offset:1px}
#fe-lenses{flex:1;min-width:0;overflow-y:auto;padding:6px 0}
.fe-lens[hidden]{display:none}
.fe-lens-h{display:flex;align-items:flex-start;gap:6px;padding:6px 12px 8px 14px}
.fe-lens-t{flex:1;display:flex;flex-direction:column;line-height:1.25;min-width:0}
.fe-lens-t b{font-size:calc(14px * var(--ui-text-scale,1));font-weight:600;color:var(--tx)}
.fe-lens-t i{font-style:normal;font-size:calc(11.5px * var(--ui-text-scale,1));color:var(--dm)}
#fe-side-rz{width:5px;flex-shrink:0;cursor:col-resize;background:transparent;transition:background .12s}
#fe-side-rz:hover,#fe-side-rz.drag{background:var(--ac)}
.fe-sec{margin-bottom:4px}
.fe-sec.fe-collapsed>:not(.fe-sh){display:none!important}
.fe-sh{font-size:calc(11px * var(--ui-text-scale,1));font-weight:600;text-transform:uppercase;letter-spacing:.08em;
  color:var(--dm);padding:10px 14px 5px;display:flex;align-items:center;gap:6px}
#fe-side .fe-sh{justify-content:flex-start!important}
.fe-sh-collapse{min-height:24px;min-width:0;display:flex;align-items:center;gap:6px;padding:0;border:0;background:none;color:inherit;cursor:pointer;font:inherit;letter-spacing:inherit;text-transform:inherit;text-align:left}
.fe-sh-collapse svg{width:12px;height:12px;flex:none;transition:transform .12s}
.fe-collapsed .fe-sh-collapse svg{transform:rotate(-90deg)}
.fe-sh-collapse:hover,#fe-notes-root:hover{color:var(--tx)}
#fe-notes-root{display:grid;place-items:center;width:24px;height:24px;margin-left:auto;color:inherit}
#fe-notes-root svg{width:14px;height:14px}
#fe-notes-root:not([href]){opacity:.45;pointer-events:none}
.fe-si{display:flex;align-items:center;gap:10px;padding:8px 14px;
  color:var(--mt);text-decoration:none;transition:background .1s,color .1s}
.fe-si:hover{background:var(--hover);color:var(--tx)}
.fe-si.active{background:var(--act);color:var(--ac)}
button.fe-si{width:100%;border:0;background:none;font:inherit;text-align:left;cursor:pointer}
.fe-rc-ago{font-size:calc(11px * var(--ui-text-scale,1));color:var(--dm);flex-shrink:0}
.fe-si svg{flex-shrink:0;opacity:.7;width:19px;height:19px}
.fe-sl{font-size:calc(13.5px * var(--ui-text-scale,1));white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;flex:1}
.fe-hint{font-size:calc(12px * var(--ui-text-scale,1));color:var(--dm);padding:6px 14px;font-style:italic;line-height:1.7}
.fe-hint-action{border:0;background:none;color:var(--ac);padding:0;cursor:pointer;font:inherit;font-style:normal;text-decoration:underline;text-underline-offset:2px}
.fe-hint-action:hover{color:var(--tx)}
.fe-hint-action.fe-icon-act{display:inline-flex;align-items:center;gap:5px;margin-bottom:3px}
.fe-hint-action.fe-icon-act svg{width:13px;height:13px;flex:none}
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
  padding:4px 10px 4px 4px;font-size:calc(12px * var(--ui-text-scale,1));opacity:0;transition:opacity .1s,color .1s;flex-shrink:0}
.fe-bm-item:hover .fe-rm-btn{opacity:1}
.fe-rm-btn:hover{color:#f85149}
#fe-sv-add{background:none;border:1px solid var(--bd);color:var(--mt);cursor:pointer;border-radius:4px;
  width:18px;height:18px;line-height:1;font-size:calc(13px * var(--ui-text-scale,1));padding:0;display:flex;align-items:center;justify-content:center}
#fe-sv-add:hover{border-color:var(--ac);color:var(--ac)}
#fe-sv-filter,#fe-nt-filter{display:block;width:calc(100% - 20px);margin:0 10px 4px;box-sizing:border-box;background:var(--bg);border:1px solid var(--bd);color:var(--tx);
  padding:3px 8px;border-radius:var(--r);font-size:calc(11px * var(--ui-text-scale,1));outline:none;transition:border-color .15s}
#fe-sv-filter:focus,#fe-nt-filter:focus{border-color:var(--ac)}
#fe-sv-filter::placeholder,#fe-nt-filter::placeholder{color:var(--dm)}
.fe-pl-label.editing,.fe-pl-tags.editing{outline:1px solid var(--ac);border-radius:3px;background:var(--s2);padding:0 3px;cursor:text}
.fe-sv-tag{display:flex;align-items:center;gap:7px;padding:8px 14px 3px;font-size:calc(10.5px * var(--ui-text-scale,1));font-weight:600;
  text-transform:uppercase;letter-spacing:.07em;color:var(--dm)}
.fe-sv-dot{width:9px;height:9px;border-radius:50%;cursor:pointer;flex-shrink:0;box-shadow:0 0 0 1px #0004}
.fe-sv-dot:hover{transform:scale(1.25)}
.fe-pl-dots{display:flex;gap:3px;margin-left:auto;padding-right:2px}
.fe-sv-mini{width:6px;height:6px;border-radius:50%;display:inline-block}
.fe-pl-tags{display:none;font-size:calc(11px * var(--ui-text-scale,1));color:var(--mt);min-width:60px;max-width:110px;white-space:nowrap;overflow:hidden}
.fe-pl-tags.show{display:inline-block}
.fe-tag-btn{background:none;border:none;color:var(--dm);cursor:pointer;padding:4px 4px;font-size:calc(12px * var(--ui-text-scale,1));opacity:0;transition:opacity .1s,color .1s;flex-shrink:0}
.fe-bm-item:hover .fe-tag-btn{opacity:1}
.fe-tag-btn:hover{color:var(--ac)}
/* clip, not hidden: focusing a control past the edge must not scroll the pane sideways.
   The pane is a size container so its toolbar wraps by the pane's width, which a
   docked preview can make narrow in a wide window. */
#fe-main{flex:1;display:flex;flex-direction:column;overflow:clip;container:fe-main / inline-size;min-width:0}
#fe-toolbar{display:flex;align-items:center;gap:10px;padding:7px 14px;
  background:var(--s2);border-bottom:1px solid var(--bd);flex-shrink:0}
#fe-count{font-size:calc(11px * var(--ui-text-scale,1));color:var(--dm);flex:1;white-space:nowrap}
#fe-tb-right{display:flex;align-items:center;gap:6px}
#fe-zoom-wrap{display:flex;align-items:center;gap:5px;color:var(--dm)}
#fe-zoom{width:80px;accent-color:var(--ac);cursor:pointer}
#fe-zoom-val{font-size:calc(10px * var(--ui-text-scale,1));color:var(--dm);width:34px;text-align:right}
#fe-view-group{display:flex;gap:2px}
#fe-search{background:var(--bg);border:1px solid var(--bd);color:var(--tx);
  padding:4px 10px;border-radius:var(--r);font-size:calc(12px * var(--ui-text-scale,1));width:150px;outline:none;transition:border-color .15s}
#fe-search:focus{border-color:var(--ac)}
#fe-search::placeholder{color:var(--dm)}
#fe-sg-panel,#fe-filter-bar{
  padding:8px 14px;background:var(--s1);border-bottom:1px solid var(--bd);flex-shrink:0}
.fe-panel-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.fe-panel-lbl{font-size:calc(11px * var(--ui-text-scale,1));color:var(--dm);font-weight:500;white-space:nowrap}
.fe-btn-group{display:flex;gap:4px;flex-wrap:wrap}
#fe-filter-q{background:var(--bg);border:1px solid var(--bd);color:var(--tx);
  padding:3px 8px;border-radius:var(--r);font-size:calc(12px * var(--ui-text-scale,1));width:200px;outline:none;transition:border-color .15s}
#fe-filter-q:focus{border-color:var(--ac)}
#fe-type-filter{background:var(--s2);border:1px solid var(--bd);color:var(--tx);
  padding:3px 8px;border-radius:var(--r);font-size:calc(12px * var(--ui-text-scale,1));outline:none;cursor:pointer}
#fe-regex-btn.active{background:var(--act);border-color:var(--ac);color:var(--ac)}
#fe-find-text{background:var(--bg);border:1px solid var(--bd);color:var(--tx);padding:4px 8px;border-radius:5px;font-size:calc(12px * var(--ui-text-scale,1));width:260px;outline:none}
#fe-find-text:focus{border-color:var(--ac)}
#fe-find-status{font-size:calc(11px * var(--ui-text-scale,1));color:var(--mt);margin-left:4px}
.fe-view .fe-si-link svg{color:var(--ac);opacity:.9}
#fe-scroll{flex:1;overflow-y:auto;transform-origin:top left}
#fe-table{width:100%;border-collapse:collapse;table-layout:fixed}
thead{position:sticky;top:0;z-index:5;background:var(--s2)}
thead th{padding:6px 12px;text-align:left;font-size:calc(11px * var(--ui-text-scale,1));font-weight:600;
  text-transform:uppercase;letter-spacing:.07em;color:var(--dm);
  border-bottom:1px solid var(--bd);user-select:none;white-space:nowrap}
thead th{position:relative}
thead th[data-sort]{cursor:pointer}
thead th[data-sort]:hover{color:var(--tx)}
.fe-col-rz{position:absolute;top:0;right:0;width:7px;height:100%;cursor:col-resize;user-select:none}
.fe-col-rz:hover{background:linear-gradient(90deg,transparent,var(--ac))}
/* Rendered tables (markdown, CSV/TSV) share the handle; col-resize.ts fixes
   the layout on the first drag so one column moves at a time. */
.fe-md-table th{position:relative}
table.fe-rz-fixed{table-layout:fixed}
.fe-ql-table.fe-rz-fixed th,.fe-ql-table.fe-rz-fixed td{overflow:hidden;text-overflow:ellipsis}
.fe-md-table.fe-rz-fixed td,.fe-md-table.fe-rz-fixed th{overflow-wrap:anywhere}
body.fe-col-dragging{cursor:col-resize;user-select:none}
.si{opacity:.35;font-size:calc(10px * var(--ui-text-scale,1))}
th.sorted .si{opacity:1;color:var(--ac)}
.c-nm{width:40%}.c-tp{width:14%}.c-tg{width:14%}.c-sz{width:11%;text-align:right}.c-dt{width:21%}
td.c-tg{white-space:nowrap;overflow:hidden}
.fe-chip{display:inline-flex;align-items:center;height:18px;padding:0 7px;margin-right:4px;border:1px solid color-mix(in srgb,var(--chip,var(--bd2)) 55%,transparent);
  border-radius:9px;font-size:calc(11px * var(--ui-text-scale,1));color:var(--mt);line-height:1}
.c-match{display:none;text-align:right;width:72px;color:var(--dm)}
#fe.fe-has-find-hits[data-view="details"] .c-match{display:table-cell}
#fe.fe-has-find-hits[data-view="details"] .c-nm{width:42%}
#fe.fe-has-find-hits[data-view="details"] .c-dt{width:19%}
.fe-find-snippet{display:block;color:var(--dm);font-size:calc(11px * var(--ui-text-scale,1));margin:3px 0 1px 22px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fe-find-snippet mark{background:var(--ac);color:var(--bg);border-radius:2px;padding:0 1px}
.fe-find-badge{display:inline-block;color:var(--ac);border:1px solid var(--bd);border-radius:8px;padding:0 5px;font-size:calc(10px * var(--ui-text-scale,1));margin-left:22px}
#fe-find-error{color:#f85149;font-size:calc(11px * var(--ui-text-scale,1))}
#fe[data-view="details"] .fe-row .fe-find-badge{display:none}
tbody tr{border-bottom:1px solid var(--bg);transition:background .08s}
tbody tr:hover{background:var(--hover)}
tbody td{padding:5px 12px;vertical-align:middle}
td.c-sz{text-align:right;white-space:nowrap;color:var(--dm);font-variant-numeric:tabular-nums;font-size:calc(12px * var(--ui-text-scale,1))}
td.c-dt{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--dm);font-size:calc(12px * var(--ui-text-scale,1))}
td.c-tp{color:var(--dm);font-size:calc(11px * var(--ui-text-scale,1))}
.fe-lnk{display:flex;align-items:center;gap:8px;text-decoration:none;color:var(--tx)}
.fe-lnk svg{flex-shrink:0}
.fe-lnk:hover .fe-nm{color:var(--ac);text-decoration:underline}
.fe-nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dir .fe-nm{color:var(--dir)}
.par td.c-nm .fe-nm{color:var(--dm)}
.par:hover .fe-nm{color:var(--mt)}
.dotfile{opacity:.65}
.fe-group-hdr td{padding:5px 12px;font-size:calc(10.5px * var(--ui-text-scale,1));font-weight:600;
  text-transform:uppercase;letter-spacing:.08em;color:var(--dm);
  background:var(--s2);border-bottom:1px solid var(--bd);border-top:1px solid var(--bd)}
.fe-group-hdr-tile{width:100%;padding:6px 4px 2px;font-size:calc(10.5px * var(--ui-text-scale,1));font-weight:600;
  text-transform:uppercase;letter-spacing:.08em;color:var(--dm)}
#fe:not(.show-hidden) .fe-row.dotfile,
#fe:not(.show-hidden) .fe-tile.dotfile,
#fe:not(.show-hidden) .fe-tree-row.dotfile{display:none!important}
#fe[data-view="list"] .c-tp,#fe[data-view="list"] .c-tg,#fe[data-view="list"] .c-sz,#fe[data-view="list"] .c-dt{display:none}
#fe[data-view="list"] .c-nm{width:100%}
#fe[data-view="list"] tbody td{padding:4px 12px}
#fe-tiles{display:none;flex-wrap:wrap;gap:4px 6px;padding:10px 12px;align-content:flex-start;align-items:flex-start}
#fe[data-view="tiles"] #fe-table,#fe[data-view="icons"] #fe-table{display:none}
#fe[data-view="tree"] #fe-table{display:none}
#fe-tree{display:none;padding:6px 0}
#fe[data-view="tree"] #fe-tree{display:block}
#fe[data-view="tree"] #fe-tiles{display:none}
.fe-tree-row{display:flex;align-items:center;min-height:29px;padding-right:12px;gap:4px}
.fe-tree-row:hover{background:var(--hover)}
.fe-tree-row.selected{background:var(--act)}
.fe-tree-row.selected .fe-nm{color:var(--ac)}
.fe-tree-toggle,.fe-tree-spacer{width:20px;height:20px;flex:none}
.fe-tree-toggle{display:flex;align-items:center;justify-content:center;border:0;background:none;color:var(--dm);cursor:pointer;border-radius:4px}
.fe-tree-toggle:hover{background:var(--s2);color:var(--tx)}
.fe-tree-toggle svg{width:12px;height:12px;transform:rotate(-90deg)}
.fe-tree-toggle[aria-expanded="true"] svg{transform:none}
.fe-tree-link{display:flex;align-items:center;gap:8px;color:var(--tx);text-decoration:none;min-width:0}
.fe-tree-link svg{flex:none}
.fe-tree-link:hover .fe-nm{text-decoration:underline;color:var(--ac)}
.fe-tree-message{padding:4px 12px;color:var(--dm);font-size:calc(11px * var(--ui-text-scale,1))}
#fe[data-view="tiles"] #fe-tiles,#fe[data-view="icons"] #fe-tiles{display:flex}
.fe-tile{display:flex;flex-direction:column;align-items:center;gap:3px;
  padding:8px 6px 7px;border-radius:var(--r);text-decoration:none;
  color:var(--tx);border:1px solid transparent;transition:all .12s;
  width:96px;overflow:hidden;cursor:pointer;position:relative}
.fe-tile:hover{background:var(--hover);border-color:var(--bd)}
.fe-tile-ic{font-size:0;line-height:0}
.fe-tile-ic svg{display:block}
.fe-tile-nm{font-size:calc(11px * var(--ui-text-scale,1));text-align:center;overflow-wrap:anywhere;word-break:normal;max-width:100%;
  overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
  line-height:1.3}
.fe-tile-sz{font-size:calc(10px * var(--ui-text-scale,1));color:var(--dm)}
.fe-tile.dir .fe-tile-nm{color:var(--dir)}
.fe-tile.par .fe-tile-nm{color:var(--dm)}
#fe[data-view="tiles"] .fe-tile-ic svg{transform:scale(1.5);margin:4px}
#fe[data-view="icons"] .fe-tile{width:116px;padding:10px 8px 8px;gap:4px}
#fe[data-view="icons"] .fe-tile-ic svg{transform:scale(2);margin:8px 10px 6px}
#fe[data-view="icons"] .fe-tile-nm{font-size:calc(12px * var(--ui-text-scale,1))}
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
/* Row actions float over the name, so they sit on a solid surface; small circles like every icon button. */
.fe-act-btn{display:inline-grid;place-items:center;width:22px;height:22px;padding:0;border-radius:50%;
  background:var(--s1);border:1px solid var(--bd);color:var(--mt);cursor:pointer;
  transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease)}
.fe-act-btn:hover{background:var(--s3);color:var(--tx)}
.fe-row td.c-nm{position:relative}
#fe-statusbar{display:flex;align-items:center;gap:14px;min-height:28px;padding:0 6px 0 14px;
  background:var(--s1);border-top:1px solid var(--bd);flex-shrink:0;font-size:calc(12px * var(--ui-text-scale,1));color:var(--mt);white-space:nowrap;overflow:hidden}
#fe-status-meta{display:flex;align-items:center;gap:14px}
.fe-meta-item{display:inline-flex;align-items:center;gap:5px}
.fe-meta-item svg{color:var(--dm)}
.fe-status-grow{flex:1}
#fe-fp-reload{display:inline-flex;align-items:center;gap:6px;color:var(--dm)}
.fe-live-dot{width:6px;height:6px;border-radius:50%;background:var(--green)}
#fe-status-path{min-width:0;max-width:60%;overflow:hidden;text-overflow:ellipsis;direction:rtl;text-align:left;
  height:22px;padding:0 8px;border:0;border-radius:6px;background:none;color:var(--mt);font:inherit;cursor:copy;
  transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease)}
#fe-status-path:hover{background:var(--shade);color:var(--tx)}
#fe-tip{
  position:fixed;pointer-events:none;z-index:200;
  background:var(--s2);border:1px solid var(--bd);border-radius:var(--r);
  padding:9px 12px;font-size:calc(11.5px * var(--ui-text-scale,1));line-height:1.7;color:var(--tx);
  max-width:380px;overflow-wrap:anywhere;word-break:break-word;
  box-shadow:0 4px 20px #000a;opacity:0;
  transition:opacity .15s ease-out;
}
#fe-tip.show{opacity:1;transition:opacity .18s ease-in .06s}
.tip-header{display:flex;align-items:center;gap:7px;margin-bottom:4px}
.tip-icon{flex-shrink:0;display:flex;align-items:center}
.tip-icon svg{display:block}
.tip-name{font-weight:600;font-size:calc(12px * var(--ui-text-scale,1));word-break:break-all;color:var(--tx)}
.tip-line{color:var(--mt);font-size:calc(11px * var(--ui-text-scale,1));line-height:1.6}
.tip-warn{color:var(--dm);font-size:calc(10.5px * var(--ui-text-scale,1));margin-top:3px;border-top:1px solid var(--bd);padding-top:3px}
#fe-toast{
  position:fixed;bottom:32px;left:50%;transform:translateX(-50%) translateY(6px);
  background:#1f2937;color:#e5e7eb;padding:8px 18px;border-radius:20px;
  font-size:calc(12px * var(--ui-text-scale,1));opacity:0;transition:all .22s;pointer-events:none;white-space:nowrap;
  border:1px solid #374151;z-index:200
}
#fe-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
/* The label for anything with a title (tooltip.ts); same surface as the row card #fe-tip. */
#fe-hint{position:fixed;top:0;left:0;z-index:300;max-width:320px;pointer-events:none;
  background:var(--s2);color:var(--tx);border:1px solid var(--bd);border-radius:var(--r);
  box-shadow:0 4px 14px #0006;padding:4px 8px;
  font-size:calc(12px * var(--ui-text-scale,1));line-height:1.4;white-space:pre-line;
  opacity:0;transition:opacity .12s ease-out}
#fe-hint.on{opacity:1}
@media (prefers-reduced-motion:reduce){#fe-hint{transition:none}}
#fe-toast.act{pointer-events:auto}
.fe-toast-act{background:none;border:none;color:#79b8ff;cursor:pointer;font:inherit;padding:0;text-decoration:underline}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--bd);border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:var(--dm)}
#fe.compact tbody td{padding:2px 12px}
#fe.compact .fe-tile{padding:6px 6px 5px;gap:3px}
.fe-dlg{position:fixed;inset:0;z-index:400;display:flex;align-items:center;justify-content:center}
.fe-dlg-bg{position:absolute;inset:0;background:#00000088;backdrop-filter:blur(2px)}
.fe-dlg-box{position:relative;z-index:1;background:var(--s1);border:1px solid var(--bd);border-radius:10px;
  width:min(760px,calc(100vw - 40px));max-height:84vh;display:flex;flex-direction:column;box-shadow:0 24px 64px #000d;outline:none}
#fe-settings-modal .fe-dlg-box{width:min(900px,calc(100vw - 40px))}
.fe-dlg-title{display:flex;align-items:center;gap:11px;padding:14px 16px 12px;background:var(--s2);flex:none;border-radius:10px 10px 0 0}
.fe-dlg-mark{flex:none;width:26px;height:26px;border-radius:6px;display:grid;place-items:center;
  background:var(--act);color:var(--ac);border:1px solid var(--ac)}
.fe-dlg-tx{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}
.fe-dlg-tx b{font-size:calc(14px * var(--ui-text-scale,1));font-weight:600;line-height:1.2;color:var(--tx);letter-spacing:-.01em}
.fe-dlg-tx i{font-size:calc(11px * var(--ui-text-scale,1));line-height:1.2;font-style:normal;color:var(--dm)}
.fe-dlg-close{display:inline-grid;place-items:center;width:26px;height:26px;padding:0;background:none;border:none;color:var(--dm);cursor:pointer;border-radius:50%;transition:color var(--t-fast) var(--ease),background var(--t-fast) var(--ease)}
.fe-dlg-close:hover{background:var(--shade);color:var(--tx)}
.fe-dlg-tabs{display:flex;gap:3px;padding:0 16px;background:var(--s2);border-bottom:1px solid var(--bd);flex:none;align-items:stretch;overflow-x:auto}
.fe-dlg-tab{display:flex;flex-direction:column;gap:2px;background:none;border:none;border-bottom:2px solid transparent;border-radius:6px 6px 0 0;
  padding:9px 13px 8px;color:var(--mt);cursor:pointer;text-align:left;line-height:1;white-space:nowrap;transition:background .1s,color .1s,border-color .1s}
.fe-dlg-tab-main{display:flex;align-items:center;gap:5px;min-width:0}
.fe-dlg-tab-main svg{flex:none;width:13px;height:13px}
#fe-settings-modal .fe-dlg-tabs{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:0;overflow:visible;padding:0 8px}
#fe-settings-modal .fe-dlg-tab{min-width:0;padding:9px 7px 8px;white-space:normal}
#fe-settings-modal .fe-dlg-tab i{line-height:1.15;white-space:normal}
.fe-dlg-tab b{font-size:calc(12.5px * var(--ui-text-scale,1));font-weight:600;color:inherit}
.fe-dlg-tab i{font-size:calc(10.5px * var(--ui-text-scale,1));font-style:normal;color:var(--dm);opacity:.85}
.fe-dlg-tab:hover{color:var(--tx);background:var(--s1)}
.fe-dlg-tab.on{background:var(--s1);color:var(--tx);border-bottom-color:var(--ac)}
.fe-dlg-tab.on i{opacity:1}
.fe-dlg-pane{display:none;padding:18px 22px 22px;overflow:auto;min-height:0}
.fe-dlg-pane.on{display:flex;flex-direction:column;gap:20px}
.fe-dlg-pane .fe-pbn{display:inline-flex;align-items:center;justify-content:center;gap:5px}
.fe-dlg-pane .fe-pbn svg{flex:none;width:13px;height:13px}
.fe-dlg-pane .fe-md{max-width:none;padding:0}
.fe-dlg-pane .fe-md h2{font-size:1.15em;border:0;padding:0}
.fe-dlg-pane .fe-md>:first-child{margin-top:0}
.fe-st-section{display:flex;flex-direction:column;gap:10px}
.fe-st-title{font-size:calc(11px * var(--ui-text-scale,1));font-weight:600;text-transform:uppercase;letter-spacing:.08em;
  color:var(--dm);padding-bottom:4px;border-bottom:1px solid var(--bd)}
.fe-st-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.fe-st-lbl{font-size:calc(12px * var(--ui-text-scale,1));color:var(--mt);min-width:90px;flex-shrink:0}
.fe-st-radio{display:flex;align-items:center;gap:6px;font-size:calc(13px * var(--ui-text-scale,1));color:var(--tx);cursor:pointer}
.fe-st-radio input{accent-color:var(--ac);cursor:pointer}
.fe-st-check{display:flex;align-items:center;gap:7px;font-size:calc(13px * var(--ui-text-scale,1));color:var(--tx);cursor:pointer}
.fe-st-check input{accent-color:var(--ac);cursor:pointer;width:14px;height:14px}
.fe-st-select{background:var(--s2);border:1px solid var(--bd);color:var(--tx);
  padding:4px 8px;border-radius:var(--r);font-size:calc(12px * var(--ui-text-scale,1));outline:none;cursor:pointer}
.fe-st-input{background:var(--bg);border:1px solid var(--bd);color:var(--tx);
  padding:4px 8px;border-radius:var(--r);font-size:calc(12px * var(--ui-text-scale,1));outline:none;width:100%;
  font-family:inherit;box-sizing:border-box}
.fe-st-input:focus{border-color:var(--ac)}
.fe-st-rules-hint{font-size:calc(11px * var(--ui-text-scale,1));color:var(--dm);font-style:italic}
.fe-st-rules-cols{display:grid;grid-template-columns:16px 22px 1fr 58px 32px 24px;
  gap:6px;padding:0 2px 4px;align-items:center;font-size:calc(10px * var(--ui-text-scale,1));color:var(--dm)}
.fe-st-col-lbl{font-size:calc(10px * var(--ui-text-scale,1));color:var(--dm);font-weight:500}
.fe-st-rule{display:grid;grid-template-columns:16px 22px 1fr 58px 32px 24px;
  gap:6px;align-items:center;padding:5px 2px;border-bottom:1px solid var(--bd)}
.fe-st-rule:last-child{border-bottom:none}
.fe-st-rule input[type="checkbox"]{accent-color:var(--ac);cursor:pointer;width:13px;height:13px}
.fe-st-rule-preview{display:flex;align-items:center;justify-content:center;height:20px}
.fe-st-rule-pattern,.fe-st-rule-label{
  background:var(--bg);border:1px solid var(--bd);color:var(--tx);
  padding:3px 6px;border-radius:var(--r);font-size:calc(11px * var(--ui-text-scale,1));
  font-family:'SF Mono',Consolas,monospace;outline:none;transition:border-color .15s;width:100%}
.fe-st-rule-pattern:focus,.fe-st-rule-label:focus{border-color:var(--ac)}
.fe-st-rule-label{text-align:center}
.fe-st-rule-color{border:1px solid var(--bd);background:none;cursor:pointer;
  width:28px;height:24px;padding:1px;border-radius:4px;flex-shrink:0}
.fe-st-rule-del{background:none;border:none;color:var(--dm);cursor:pointer;
  padding:3px 5px;font-size:calc(12px * var(--ui-text-scale,1));border-radius:3px;line-height:1;transition:color .1s,background .1s;text-align:center}
.fe-st-rule-del:hover{color:#f85149;background:var(--hover)}
.fe-st-rules-empty{font-size:calc(12px * var(--ui-text-scale,1));color:var(--dm);padding:8px 2px;font-style:italic}
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
.fe-st-ai-state{font-size:calc(12.5px * var(--ui-text-scale,1));font-weight:600;color:var(--tx)}
.fe-st-ai-grid{display:grid;grid-template-columns:auto 1fr;gap:3px 12px;font-size:calc(11.5px * var(--ui-text-scale,1))}
.fe-st-ai-grid .k{color:var(--dm)}
.fe-st-ai-grid .v{color:var(--tx);font-family:'SF Mono',Menlo,Consolas,monospace;font-size:calc(11px * var(--ui-text-scale,1));
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fe-st-ai-grid .v.warm-yes{color:var(--green)}
.fe-st-ai-grid .v.warm-no{color:var(--gold)}
.fe-st-ai-controls{display:flex;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap}
.fe-st-ai-controls .fe-st-select{flex:1;min-width:120px}
.fe-st-ai-hint{font-size:calc(11px * var(--ui-text-scale,1));color:var(--dm);margin-top:8px;line-height:1.5}
.fe-st-ai-hint code{background:var(--bg);border:1px solid var(--bd);border-radius:3px;padding:0 4px;
  font-family:'SF Mono',Menlo,Consolas,monospace;font-size:calc(10.5px * var(--ui-text-scale,1));color:var(--mt)}
.fe-row.selected td{background:var(--act)}
.fe-row.selected .fe-nm{color:var(--ac)}
.fe-tile.selected{background:var(--act);border-color:var(--ac)}
#fe-qlook{position:fixed;inset:0;z-index:350;display:flex;align-items:center;justify-content:center}
#fe-ql-bg{position:absolute;inset:0;background:#0009;backdrop-filter:blur(2px)}
#fe-ql-dialog{position:relative;z-index:1;background:var(--s1);border:1px solid var(--bd);
  border-radius:10px;width:min(1100px,calc(100vw - 64px));height:min(84vh,1000px);
  max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);
  display:flex;flex-direction:column;box-shadow:0 24px 64px #000d;overflow:hidden}
#fe-ql-rz{position:absolute;right:0;bottom:0;width:16px;height:16px;cursor:nwse-resize;z-index:2;
  background:linear-gradient(135deg,transparent 50%,var(--bd) 50%,var(--bd) 60%,transparent 60%,transparent 75%,var(--bd) 75%,var(--bd) 85%,transparent 85%)}
#fe-ql-rz:hover{background:linear-gradient(135deg,transparent 50%,var(--ac) 50%)}
#fe-ql-rz-side{display:none;position:absolute;left:0;top:0;width:6px;height:100%;cursor:col-resize;z-index:2}
#fe-ql-rz-side:hover{background:linear-gradient(90deg,var(--ac),transparent)}
#fe-qlook.side{position:relative;inset:auto;z-index:1;flex:none;width:420px;max-width:80vw;
  border-left:1px solid var(--bd);align-items:stretch;justify-content:stretch}
#fe-qlook.side #fe-ql-bg,#fe-qlook.side #fe-ql-rz{display:none}
#fe-qlook.side #fe-ql-rz-side{display:block}
#fe-qlook.side #fe-ql-dialog{width:100%;height:100%;max-width:none;max-height:none;border:none;border-radius:0;box-shadow:none}
#fe-tabs{display:flex;align-items:stretch;gap:4px;padding:6px 8px 0 6px;background:var(--s1);border-bottom:1px solid var(--bd);
  overflow-x:auto;flex-shrink:0;min-height:34px;scrollbar-width:none}
#fe-tabs::-webkit-scrollbar{display:none}
.fe-tab-list{position:sticky;right:0;flex-shrink:0;align-self:center;background:var(--s1);border:1px solid var(--bd);color:var(--mt);cursor:pointer;
  font-size:calc(11px * var(--ui-text-scale,1));padding:2px 6px;border-radius:5px;margin-left:4px}
.fe-tab-list:hover{border-color:var(--ac);color:var(--ac)}
.fe-tab-list svg{display:block}
.fe-tab.pinned{padding:5px 6px;min-width:0}
.fe-tab.pinned .fe-tab-lbl,.fe-tab.pinned .fe-tab-more{display:none}
#fe-tabs.empty{padding-top:4px}
.fe-tab{display:flex;align-items:center;gap:6px;padding:5px 8px 5px 10px;min-height:29px;font-size:calc(12px * var(--ui-text-scale,1));color:var(--mt);text-decoration:none;
  background:var(--s2);border:1px solid var(--bd);border-bottom:none;border-radius:7px 7px 0 0;white-space:nowrap;max-width:200px;min-width:64px;flex:0 1 auto;position:relative;top:1px;
  transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease)}
.fe-tab:hover{background:var(--s3);color:var(--tx)}
.fe-tab.on{background:var(--bg);color:var(--tx)}
.fe-tab.temp{background:none;border-color:transparent}
.fe-tab.temp.on{background:var(--bg);border-color:var(--bd)}
.fe-tab.temp .fe-tab-lbl{font-style:italic}
.fe-tab.drag-over{border-left:2px solid var(--ac)}
.fe-tab-lbl{display:flex;overflow:hidden;min-width:0}
.fe-tab-head{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.fe-tab-tail{white-space:nowrap;flex-shrink:0}
.fe-tab-x,.fe-tab-more{display:inline-grid;place-items:center;width:18px;height:18px;padding:0;background:none;border:none;color:var(--dm);cursor:pointer;font-size:calc(10px * var(--ui-text-scale,1));border-radius:50%;opacity:0;line-height:1;transition:opacity var(--t-fast),background var(--t-fast)}
.fe-tab-more{font-size:calc(12px * var(--ui-text-scale,1));letter-spacing:1px}
.fe-tab:hover .fe-tab-x,.fe-tab.on .fe-tab-x,.fe-tab:hover .fe-tab-more{opacity:1}
.fe-tab-x:hover{background:var(--shade2);color:#f85149}
.fe-tab-more:hover{background:var(--shade2);color:var(--tx)}
.fe-tab.pinned::before{content:'';width:5px;height:5px;border-radius:50%;background:var(--ac);flex-shrink:0}
.fe-tab-ico{display:flex;flex-shrink:0}
.fe-tab-ico svg{width:11px;height:12px}
.fe-tab-menu{position:fixed}
#fe.fe-file-page #fe-toolbar,#fe.fe-file-page #fe-sg-panel,#fe.fe-file-page #fe-filter-bar,#fe.fe-file-page #fe-scroll{display:none!important}
#fe-fp-bar{display:flex;align-items:center;gap:6px;padding:7px 14px;background:var(--s2);border-bottom:1px solid var(--bd);flex-shrink:0}
#fe-fp{display:flex;flex:1;min-height:0}
/* Contents: a rail on the right of the page. Depth shows as indent plus a
   small step in size and ink; folded, only its button remains. */
#fe-toc-rail{width:230px;flex-shrink:0;display:flex;flex-direction:column;min-height:0;border-left:1px solid var(--bd);background:var(--bg)}
#fe-toc-rail[hidden]{display:none}
.fe-toc-head{display:flex;align-items:center;gap:6px;padding:10px 8px 6px 16px;flex:none}
.fe-toc-title{flex:1;font-size:calc(11px * var(--ui-text-scale,1));font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--dm)}
#fe-toc-fold{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border:0;border-radius:50%;background:none;color:var(--mt);cursor:pointer}
#fe-toc-fold:hover{background:var(--shade);color:var(--tx)}
#fe-toc-fold svg{transition:transform var(--t-base) var(--ease)}
#fe-toc-rail.folded{width:40px}
#fe-toc-rail.folded .fe-toc-title,#fe-toc-rail.folded #fe-toc{display:none}
#fe-toc-rail.folded .fe-toc-head{padding:10px 8px;justify-content:center}
#fe-toc-rail.folded #fe-toc-fold svg{transform:rotate(180deg)}
#fe-toc{flex:1;min-height:0;overflow-y:auto;padding:2px 0 16px}
#fe-toc a{display:block;color:var(--mt);text-decoration:none;padding:3px 14px 3px 16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border-left:2px solid transparent;transition:color var(--t-fast) var(--ease),background var(--t-fast) var(--ease)}
#fe-toc a:hover{color:var(--tx);background:var(--hover)}
#fe-toc a.fe-toc-h1{font-size:calc(13px * var(--ui-text-scale,1));font-weight:600;color:var(--tx)}
#fe-toc a.fe-toc-h2{font-size:calc(12.5px * var(--ui-text-scale,1));padding-left:28px}
#fe-toc a.fe-toc-h3{font-size:calc(12px * var(--ui-text-scale,1));padding-left:40px}
#fe-toc a.fe-toc-h4{font-size:calc(11.5px * var(--ui-text-scale,1));padding-left:52px;color:var(--dm)}
@media (prefers-reduced-motion:reduce){#fe-toc-fold svg{transition:none}}
/* Find in file, at the right end of the file bar. */
#fe-ff{display:inline-flex;align-items:center;gap:4px;height:26px;padding:0 3px 0 8px;border:1px solid var(--bd);border-radius:var(--r);background:var(--bg);color:var(--dm)}
#fe-ff:focus-within{border-color:var(--ac)}
#fe-ff[hidden]{display:none}
#fe-ff-q{width:150px;border:0;outline:0;background:none;color:var(--tx);font:inherit;font-size:calc(12px * var(--ui-text-scale,1))}
#fe-ff-n{font-size:calc(11px * var(--ui-text-scale,1));color:var(--dm);white-space:nowrap;font-variant-numeric:tabular-nums}
#fe-ff-n.none{color:var(--nc-red)}
#fe-fp-bar #fe-ff button{height:20px;width:20px}
mark.fe-ff-hit{background:color-mix(in srgb,var(--gold) 35%,transparent);color:inherit;border-radius:2px}
mark.fe-ff-hit.on{background:var(--gold);color:#0d1117}
#fe-page{flex:1;min-width:0;overflow:auto;font-size:calc(12px * var(--ui-text-scale,1))}
#fe-page .fe-md{max-width:none;margin:0;padding:28px 48px 80px;font-size:calc(15px * var(--ui-text-scale,1));line-height:var(--rd-lh,1.65)}
#fe.fe-column-xl #fe-page .fe-md{max-width:150ch;margin:0 auto}
#fe.fe-column-lg #fe-page .fe-md{max-width:130ch;margin:0 auto}
#fe.fe-column-md #fe-page .fe-md{max-width:110ch;margin:0 auto}
#fe-page .fe-md blockquote > .fe-md{padding:0;margin:0;max-width:none}
.fe-md-alert{--al:#4493f8;border-left:3px solid var(--al);padding:.6em 1em;border-radius:4px;background:color-mix(in srgb,var(--al) 9%,transparent)}
.fe-md-alert-title{font-weight:600;color:var(--al);margin:0 0 4px!important}
.fe-md-alert-tip{--al:#3fb950}.fe-md-alert-important{--al:#ab7df8}.fe-md-alert-warning{--al:#d29922}.fe-md-alert-caution{--al:#f85149}
#fe[data-theme="light"] .fe-md-alert{--al:#0969da}
#fe[data-theme="light"] .fe-md-alert-tip{--al:#1a7f37}#fe[data-theme="light"] .fe-md-alert-important{--al:#8250df}
#fe[data-theme="light"] .fe-md-alert-warning{--al:#9a6700}#fe[data-theme="light"] .fe-md-alert-caution{--al:#d1242f}
.fe-md-footnotes{border-top:1px solid var(--bd);margin-top:2em;padding-top:.8em;font-size:.88em;color:var(--mt)}
.fe-md-fnref a,.fe-md-fnback{text-decoration:none}
#fe-page .fe-md code,#fe-page .fe-md-pre,#fe-ql-body .fe-md code,#fe-ql-body .fe-md-pre{font-size:calc(var(--rd-code,13px) * var(--ui-text-scale,1))}
#fe.fe-notips #fe-tip{display:none!important}
#fe-fp-column:hover{border-color:var(--ac);color:var(--ac)}
#fe-toc a.on{color:var(--ac);background:var(--shade);border-left-color:var(--ac)}
.fe-crumb-file{color:var(--tx);font-weight:500}
#fe-fp-meta{font-size:calc(11px * var(--ui-text-scale,1));color:var(--dm);margin-right:auto;white-space:nowrap}
#fe-nt-list .fe-nt-hit{display:block;padding:0 10px 4px 32px;font-size:calc(10.5px * var(--ui-text-scale,1));color:var(--dm);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* Editing in place: coloured, numbered source in the reading column. The
   painted copy (#fe-fe-paint) and the textarea share font, padding and
   wrapping exactly, so the caret sits over its own text. */
#fe-fe{flex:1;min-width:0;display:flex;flex-direction:column;min-height:0;position:relative}
#fe-fe-banner{display:flex;align-items:center;gap:8px;padding:8px 14px;border-bottom:1px solid var(--bd);background:var(--s1)}
#fe-fe-scroll{flex:1;min-height:0;overflow:auto;cursor:text}
#fe-fe-col{max-width:980px;margin:0 auto;padding:28px 28px 120px}
#fe-fe-src{position:relative}
#fe-fe-src[hidden]{display:none}
#fe-fe-paint,#fe-fe-ta{margin:0;font-family:var(--mono);font-size:calc(var(--rd-code,13px) * var(--ui-text-scale,1));line-height:1.7;
  white-space:pre-wrap;overflow-wrap:anywhere;tab-size:4;letter-spacing:0}
#fe-fe-paint{padding:0;color:var(--tx);pointer-events:none}
.fe-fe-row{display:grid;grid-template-columns:52px minmax(0,1fr)}
.fe-fe-ln{color:var(--dm);text-align:right;padding-right:16px;user-select:none}
/* The caret's line, so every click shows where it landed. */
.fe-fe-row.cur{background:color-mix(in srgb,var(--ac) 8%,transparent);border-radius:3px}
.fe-fe-row.cur .fe-fe-ln{color:var(--tx)}
#fe-fe-ta{position:absolute;top:0;left:0;width:100%;padding:0 0 0 52px;border:0;outline:0;resize:none;overflow:hidden;
  background:transparent;color:transparent;caret-color:var(--ac)}
#fe-fe-ta::selection{background:color-mix(in srgb,var(--ac) 40%,transparent);color:transparent}
#fe-fe-view{padding:0;max-width:none}
#fe-fe-pill{position:absolute;top:12px;right:18px;z-index:5;display:flex;align-items:center;gap:2px;padding:3px;
  background:var(--s1);border:1px solid var(--bd);border-radius:999px;box-shadow:0 6px 20px rgb(0 0 0 / .25)}
#fe-fe-pill .btn[data-variant="solid"]{border-radius:999px;padding:0 12px}
#fe-fe-state{display:inline-flex;align-items:center;gap:5px;padding:0 8px 0 10px;font-size:calc(12px * var(--ui-text-scale,1));color:var(--mt);
  transition:color var(--t-fast) var(--ease)}
#fe-fe-state.saved{color:var(--green)}
#fe-fe-state svg{width:13px;height:13px}
.fe-fe-dot{width:6px;height:6px;border-radius:50%;background:var(--ac)}
#fe-allow{position:fixed;z-index:320;width:340px;padding:14px;background:var(--s1);border:1px solid var(--bd2);border-radius:10px;
  box-shadow:0 12px 32px rgb(0 0 0 / .3);animation:fe-pop var(--t-base) var(--ease)}
#fe-allow p{color:var(--mt);font-size:calc(12px * var(--ui-text-scale,1));margin:6px 0 12px;line-height:1.5}
#fe-allow code{font:calc(11.5px * var(--ui-text-scale,1)) var(--mono);background:var(--s2);padding:1px 4px;border-radius:4px;overflow-wrap:anywhere}
.fe-allow-title{display:flex;align-items:center;gap:8px;font-weight:600}
.fe-allow-acts{display:flex;gap:6px;justify-content:flex-end}
#fe-allow.fe-allow-note{border-color:color-mix(in srgb,var(--nc-red) 50%,var(--bd2))}
#fe-fp-edit.busy{opacity:.6;cursor:progress}
@keyframes fe-pop{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){#fe-allow{animation:none}}
#fe-fp-reload{font-size:calc(11px * var(--ui-text-scale,1));color:var(--dm)}
#fe-ed-bar{display:flex;align-items:center;gap:4px;padding:6px 10px;border-bottom:1px solid var(--bd);background:var(--s2);flex-shrink:0;flex-wrap:wrap}
#fe-ed-bar .fe-pbn{padding:2px 7px;font-size:calc(11px * var(--ui-text-scale,1));display:inline-flex;align-items:center;gap:5px}
.fe-ed-hint{margin-left:auto;font-size:calc(10.5px * var(--ui-text-scale,1));color:var(--dm);white-space:nowrap}
#fe-ed-hist{display:flex;flex-direction:column;gap:2px;padding:6px 10px;border-bottom:1px solid var(--bd);background:var(--s2);max-height:180px;overflow:auto;flex-shrink:0;font-size:calc(11px * var(--ui-text-scale,1));color:var(--dm)}
.fe-hist-row{display:grid;grid-template-columns:minmax(120px,160px) 1fr auto;gap:10px;align-items:baseline;text-align:left;background:none;border:1px solid transparent;border-radius:5px;padding:3px 6px;color:var(--tx);cursor:pointer;font:inherit}
.fe-hist-row:hover,.fe-hist-row.active{border-color:var(--ac);background:var(--act)}
.fe-hist-row code{color:var(--dm)}
.fe-hist-head{display:flex;gap:8px;align-items:center;padding:8px 12px;border-bottom:1px solid var(--bd);color:var(--dm);font-size:calc(11px * var(--ui-text-scale,1))}
#fe-ql-body.fe-editing{display:flex;flex-direction:column}
.fe-ed{display:flex;flex:1;min-height:0}
.fe-md img{max-width:100%;border-radius:6px}
#fe-ed-src{flex:1;min-width:0;resize:none;border:none;border-right:1px solid var(--bd);background:var(--s1);color:var(--tx);
  font:calc(12.5px * var(--ui-text-scale,1))/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;padding:14px 16px;outline:none;tab-size:2}
#fe-ed-view{flex:1;min-width:0;overflow:auto}
#fe-qlook.side .fe-ed{flex-direction:column}
#fe-qlook.side #fe-ed-src{border-right:none;border-bottom:1px solid var(--bd);min-height:40%}
#fe-ed-conflict{display:flex;align-items:center;gap:8px;padding:8px 14px;border-bottom:1px solid var(--bd)}
#fe-ed-meta{display:flex;align-items:center;gap:6px;padding:7px 10px;border-bottom:1px solid var(--bd);background:var(--s1);flex-shrink:0;flex-wrap:wrap}
.fe-chip-title{flex:1 1 180px;min-width:120px;background:var(--bg);border:1px solid var(--bd);color:var(--tx);border-radius:5px;padding:3px 8px;font:inherit;font-weight:600}
.fe-chip-title:focus{outline:none;border-color:var(--ac)}
button.fe-chip-title{display:flex;align-items:center;gap:6px;text-align:left;cursor:text;min-width:0}
button.fe-chip-title:hover{border-color:var(--ac)}
button.fe-chip-title svg{flex:none;width:12px;height:12px;color:var(--dm)}
textarea.fe-chip-title{flex:1 1 100%;resize:none;overflow:hidden;line-height:1.35;min-height:28px}
.fe-chip,.fe-chip-btn{display:inline-flex;align-items:center;gap:5px}
.fe-chip{border:1px solid var(--bd);border-radius:999px;padding:1px 4px 1px 8px;font-size:calc(11px * var(--ui-text-scale,1));color:var(--mt);background:var(--bg)}
.fe-chip svg,.fe-chip-btn svg{flex:none;width:12px;height:12px}
.fe-chip-static{padding-right:8px}
.fe-chip-x{background:none;border:0;color:var(--dm);cursor:pointer;display:grid;place-items:center;padding:2px;border-radius:50%}
.fe-chip-x:hover{color:var(--ac)}
#fe-ed-meta .fe-pbn{padding:2px 8px;font-size:calc(11px * var(--ui-text-scale,1))}
.fe-cdot{flex:none}
.fe-pmenu{position:fixed;z-index:2147483000;width:250px;background:var(--s1);border:1px solid var(--bd);border-radius:8px;padding:8px;box-shadow:0 8px 24px rgba(0,0,0,.35);display:flex;flex-direction:column;gap:6px}
.fe-pmenu .fe-pbn{display:inline-flex;align-items:center;gap:6px;text-align:left}
.fe-pmenu .fe-pbn svg{flex:none;width:12px;height:12px}
.fe-pm-lbl{font-size:calc(10.5px * var(--ui-text-scale,1));color:var(--mt);text-transform:uppercase;letter-spacing:.04em}
.fe-pm-colors{display:grid;grid-template-columns:1fr 1fr;gap:4px}
.fe-pm-tags{display:flex;flex-wrap:wrap;gap:4px}
.fe-pm-add{display:flex;gap:4px}
.fe-pm-add input{flex:1;min-width:0;background:var(--bg);border:1px solid var(--bd);color:var(--tx);border-radius:5px;padding:3px 7px;font:inherit}
.fe-pm-add input:focus{outline:none;border-color:var(--ac)}
.fe-nt-main{display:flex;flex-direction:column;min-width:0;flex:1 1 0;gap:1px}
.fe-mid{display:flex;min-width:0;max-width:100%;overflow:hidden}
.fe-mid-h{overflow:hidden;text-overflow:ellipsis;white-space:pre;min-width:0}
.fe-mid-t{white-space:pre;flex:none}
.fe-nt-label{flex:none;display:flex;min-width:0;white-space:nowrap;overflow:hidden;line-height:1.3}
.fe-nt-label.editing{display:block;white-space:normal;overflow:visible;overflow-wrap:anywhere}
.fe-nt-item .fe-nt-acts{position:absolute;right:0;top:50%;transform:translateY(-50%);display:flex;align-items:center;
  background:var(--hover);border-radius:4px;opacity:0;pointer-events:none;transition:opacity .1s}
.fe-nt-item:hover .fe-nt-acts,.fe-nt-item:focus-within .fe-nt-acts{opacity:1;pointer-events:auto}
.fe-nt-tags{font-size:calc(10.5px * var(--ui-text-scale,1));color:var(--mt);display:flex;gap:6px;flex-wrap:wrap}
.fe-nt-tags span{display:inline-flex;align-items:center;gap:3px}
.fe-nt-tags svg{width:10px;height:10px;flex:none}
.fe-nt-flags{display:inline-flex;align-items:center;gap:4px;flex:none}
.fe-nt-flags svg{width:12px;height:12px}
.fe-nt-pin{color:var(--gold)}
.fe-nt-props{background:none;border:0;color:var(--dm);cursor:pointer;padding:4px;display:grid;place-items:center;opacity:0;flex:none}
.fe-nt-item:hover .fe-nt-props,.fe-nt-props:focus-visible{opacity:1}
.fe-nt-props:hover{color:var(--ac)}
.fe-nt-props svg{width:14px;height:14px}
.fe-nt-item .fe-si-link{padding-left:14px}
.fe-nt-tab{background:none;border:0;color:var(--dm);cursor:pointer;padding:4px;display:grid;place-items:center;opacity:0;flex:none}
.fe-nt-item:hover .fe-nt-tab,.fe-nt-tab:focus-visible{opacity:1}
.fe-nt-tab:hover{color:var(--ac)}
.fe-nt-tab svg{width:14px;height:14px}
#fe-nt-add{background:none;border:1px solid var(--bd);color:var(--mt);cursor:pointer;border-radius:4px;
  width:18px;height:18px;line-height:1;font-size:calc(13px * var(--ui-text-scale,1));padding:0;display:flex;align-items:center;justify-content:center}
#fe-sv-add{margin-left:auto}
#fe-nt-add:hover{border-color:var(--ac);color:var(--ac)}
.fe-sh a{color:inherit;text-decoration:none}
.fe-sh a:hover{color:var(--ac)}
#fe-ql-hdr{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--bd);flex-shrink:0}
#fe-ql-icon svg{display:block}
/* Docked, the header keeps its name readable and its close button inside the panel: buttons go icon-only. */
#fe-qlook.side #fe-ql-hdr > button > span,#fe-qlook.side #fe-ql-hdr > a:not(#fe-ql-name) > span{display:none}
#fe-qlook.side #fe-ql-hdr{gap:5px;padding:8px 10px}
/* Docked, the header's labelled buttons lose their labels and become icon circles. */
#fe-qlook.side #fe-ql-hdr > button,#fe-qlook.side #fe-ql-hdr > #fe-ql-open{width:26px;padding:0;border-radius:50%}
#fe-qlook.side #fe-ql-hdr > *{flex-shrink:0}
#fe-qlook.side #fe-ql-name,#fe-qlook.side #fe-ql-meta{flex-shrink:1;min-width:0}
#fe-qlook.side #fe-ed-bar > button > span{display:none}
#fe-qlook.side .fe-ed-hint{display:none}
#fe-ql-name{font-weight:600;font-size:calc(13px * var(--ui-text-scale,1));overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:inherit;text-decoration:none}
#fe-ql-name:hover{color:var(--ac);text-decoration:underline}
#fe-ql-meta{font-size:calc(11px * var(--ui-text-scale,1));color:var(--dm);flex:1;white-space:nowrap}
#fe-ql-body{flex:1;overflow:auto;font-size:calc(12px * var(--ui-text-scale,1))}
#fe-ql-body:has(> .fe-ql-htmlbar){display:flex;flex-direction:column}
.fe-ql-htmlbar{display:flex;gap:4px;padding:6px 10px;border-bottom:1px solid var(--bd);flex:none}
.fe-ql-html{flex:1;min-height:0;width:100%;border:0;background:#fff}
/* The preview panel reads at the same reader sizes as the file page; dialogs keep the base size. */
#fe-ql-body .fe-md{font-size:calc(15px * var(--ui-text-scale,1));line-height:var(--rd-lh,1.65)}
#fe-ql-ai{display:flex;align-items:center;gap:6px;padding:7px 14px;
  border-bottom:1px solid var(--bd);background:var(--s2);flex-shrink:0}
#fe-ql-ai-chip{display:flex;align-items:center;gap:5px;font-size:calc(10.5px * var(--ui-text-scale,1));color:var(--dm);
  margin-right:4px;white-space:nowrap}
#fe-ql-ai-chip .dot{width:7px;height:7px;border-radius:50%;background:var(--dm);flex-shrink:0}
#fe-ql-ai-chip.ready .dot{background:var(--green)}
#fe-ql-ai-chip.cold .dot{background:var(--gold)}
#fe-ql-ai-chip.down .dot{background:#f85149}
#fe-ql-ai-q{flex:1;min-width:80px;background:var(--bg);border:1px solid var(--bd);color:var(--tx);
  padding:4px 9px;border-radius:5px;font-size:calc(11.5px * var(--ui-text-scale,1));outline:none;transition:border-color .15s}
#fe-ql-ai-q:focus{border-color:var(--ac)}
#fe-ql-ai-q:disabled{opacity:.45}
#fe-ql-ai-q::placeholder{color:var(--dm)}
#fe-ql-ai-out{border-bottom:1px solid var(--bd);max-height:42%;overflow-y:auto;flex-shrink:0;background:var(--s1)}
#fe-ql-ai-out-body{padding:10px 16px 4px;font-size:calc(12.5px * var(--ui-text-scale,1));line-height:1.6;white-space:pre-wrap}
#fe-ql-ai-out-body .fe-md{padding:0;white-space:normal}
#fe-ql-ai-out-meta{padding:2px 16px 8px;font-size:calc(10px * var(--ui-text-scale,1));color:var(--dm)}
.fe-ql-center{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:10px}
.fe-ql-note{font-size:calc(11.5px * var(--ui-text-scale,1));color:var(--dm);padding:6px 14px}
.fe-ql-note.err{color:#f85149}
.fe-ql-imgwrap{display:flex;flex-direction:column;height:100%}
.fe-ql-imgbar{display:flex;align-items:center;gap:4px;padding:6px 10px;border-bottom:1px solid var(--bd);background:var(--s2);flex-shrink:0;flex-wrap:wrap}
.fe-ql-imgbar .fe-pbn{padding:2px 7px;font-size:calc(11px * var(--ui-text-scale,1));display:inline-flex;align-items:center;gap:5px}
.fe-ql-imgbar .fe-pbn svg{flex:none;width:13px;height:13px}
.fe-ql-imgstage{flex:1;min-height:0;overflow:auto;display:flex}
.fe-ql-imgsizer{position:relative;margin:auto;flex:none}
.fe-ql-img{position:absolute;left:50%;top:50%;max-width:none;max-height:none;border-radius:4px;transform-origin:center}
.fe-ql-imgwrap .fe-ql-dim{padding:4px 12px;border-top:1px solid var(--bd);text-align:center;flex-shrink:0}
.fe-ql-dim{font-size:calc(11px * var(--ui-text-scale,1));color:var(--dm);font-variant-numeric:tabular-nums}
.fe-ql-pdf{width:100%;height:100%;border:none}
.fe-ql-media-wrap{display:flex;align-items:center;justify-content:center;height:100%;padding:16px}
.fe-ql-media{max-width:100%;max-height:100%;border-radius:4px;background:#000}
.fe-ql-center audio{width:min(480px,90%)}
.fe-ql-font{padding:20px 26px;overflow:auto;line-height:1.5}
.fe-ql-font>div{margin:6px 0;word-break:break-word;border-bottom:1px solid var(--s2);padding-bottom:6px}
.fe-code-wrap{display:flex;font:calc(11.5px * var(--ui-text-scale,1))/1.55 'SF Mono',Menlo,Consolas,monospace;min-height:100%}
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
.tok-num{color:#f2cc60}
.tok-var{color:#d2a8ff}
.tok-deco{color:#e2b340}
.tok-fn{color:#d2a8ff}.tok-regex{color:#a5d6a7}
.tok-key{color:#79c0ff}.tok-section{color:#d2a8ff}
.tok-add{color:#3fb950}.tok-del{color:#f85149}
#fe[data-theme="light"] .tok-str{color:#0a7d33}
#fe[data-theme="light"] .tok-kw,#fe[data-theme="light"] .tok-kw-ctrl{color:#cf222e}
#fe[data-theme="light"] .tok-type{color:#1b7c83}
#fe[data-theme="light"] .tok-builtin{color:#953800}
#fe[data-theme="light"] .tok-lit{color:#8250df}
#fe[data-theme="light"] .tok-num{color:#9a6700}
#fe[data-theme="light"] .tok-var{color:#8250df}
#fe[data-theme="light"] .tok-deco{color:#9a6700}
#fe[data-theme="light"] .tok-fn{color:#8250df}
#fe[data-theme="light"] .tok-regex{color:#116329}
#fe[data-theme="light"] .tok-key{color:#0550ae}
#fe[data-theme="light"] .tok-section{color:#8250df}
#fe[data-theme="light"] .tok-add{color:#1a7f37}
#fe[data-theme="light"] .tok-del{color:#cf222e}
.fe-ql-table{border-collapse:collapse;width:100%;font:calc(11.5px * var(--ui-text-scale,1)) 'SF Mono',Menlo,Consolas,monospace}
.fe-ql-table th{position:sticky;top:0;background:var(--s2);padding:6px 10px;text-align:left;
  border-bottom:1px solid var(--bd);cursor:pointer;white-space:nowrap;color:var(--mt);font-weight:600;z-index:1}
.fe-ql-table th:hover{color:var(--tx)}
.fe-ql-table th.sorted{color:var(--ac)}
.fe-ql-table td{padding:4px 10px;border-bottom:1px solid var(--s2);white-space:nowrap;
  max-width:340px;overflow:hidden;text-overflow:ellipsis}
.fe-ql-table th.num,.fe-ql-table td.num{text-align:right;font-variant-numeric:tabular-nums}
.fe-ql-table tbody tr:hover{background:var(--hover)}
.fe-jt-root,.fe-jl-root{padding:10px 14px;font:calc(11.5px * var(--ui-text-scale,1))/1.6 'SF Mono',Menlo,Consolas,monospace}
.fe-jt summary,.fe-jl-line summary{cursor:pointer;list-style:none}
.fe-jt summary::-webkit-details-marker,.fe-jl-line summary::-webkit-details-marker{display:none}
.fe-jt summary svg,.fe-jl-line summary svg{color:var(--dm);flex-shrink:0;vertical-align:-2px;transform:rotate(-90deg)}
.fe-jt[open]>summary>svg,.fe-jl-line[open]>summary>svg{transform:none}
.fe-jt summary svg{margin-right:4px}
.fe-jt summary:hover{background:var(--hover)}
.fe-jt-kids{padding-left:16px;border-left:1px solid var(--s3);margin-left:4px}
.fe-jt-key{color:#79c0ff}
#fe[data-theme="light"] .fe-jt-key{color:#0550ae}
.fe-jt-colon{color:var(--dm)}
.fe-jt-badge{color:var(--dm);font-size:calc(10.5px * var(--ui-text-scale,1))}
.fe-jt-row{padding-left:12px}
.fe-jl-line{border-bottom:1px solid var(--s2);padding:2px 0}
.fe-jl-line summary{display:flex;gap:8px;align-items:baseline}
.fe-jl-n{color:var(--dm);min-width:28px;text-align:right;user-select:none;font-size:calc(10.5px * var(--ui-text-scale,1));flex-shrink:0}
.fe-jl-prev{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--mt)}
.fe-jl-line.bad{display:flex;gap:8px;align-items:baseline}
.fe-jl-err{color:#f85149;font-size:calc(10px * var(--ui-text-scale,1));border:1px solid #f8514940;border-radius:3px;padding:0 4px;flex-shrink:0}
.fe-md{padding:14px 22px 20px;font-size:calc(13px * var(--ui-text-scale,1));line-height:1.65;max-width:760px;color:var(--tx)}
/* Reading rhythm: every block owns the space below it, in em, so one scale
   holds in the file page, preview, notes, dialogs and AI answers alike. */
.fe-md>*,.fe-md-alert>*,.fe-md blockquote>*{margin:0 0 .9em}
.fe-md>:last-child,.fe-md-alert>:last-child,.fe-md blockquote>:last-child{margin-bottom:0}
.fe-md h1,.fe-md h2,.fe-md h3,.fe-md h4,.fe-md h5,.fe-md h6{font-weight:600;line-height:1.3;margin:1.6em 0 .5em;color:var(--tx)}
.fe-md>h1:first-child,.fe-md>h2:first-child,.fe-md>h3:first-child,.fe-md>.fe-md-fm+h1,.fe-md>.fe-md-fm+h2{margin-top:0}
.fe-md h1{font-size:1.75em;padding-bottom:.3em;border-bottom:1px solid var(--bd)}
.fe-md h2{font-size:1.4em;padding-bottom:.3em;border-bottom:1px solid var(--bd)}
.fe-md h3{font-size:1.15em}
.fe-md h4,.fe-md h5,.fe-md h6{font-size:1em}
.fe-md h5,.fe-md h6{color:var(--mt)}
.fe-md ul,.fe-md ol{padding-left:1.6em}
.fe-md li{margin:0}
.fe-md li+li{margin-top:.35em}
.fe-md li>p{margin:0}
.fe-md li>p+p,.fe-md li>p+ul,.fe-md li>p+ol,.fe-md li>ul,.fe-md li>ol,.fe-md li>.fe-md-code,.fe-md li>.fe-md-pre{margin:.35em 0 0}
.fe-md li::marker{color:var(--mt)}
.fe-md code{background:var(--s2);border:0;padding:.12em .4em;border-radius:4px;font-family:var(--mono);font-size:.86em}
.fe-md a code{color:inherit}
.fe-md-code{border:1px solid var(--bd);border-radius:6px;background:var(--s1);overflow:hidden}
.fe-md-code-bar{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:4px 6px 0 12px;background:none}
.fe-md-lang{font:600 calc(10.5px * var(--ui-text-scale,1))/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--dm)}
.fe-md-copy{position:relative;display:inline-grid;place-items:center;width:24px;height:24px;padding:0;border:0;border-radius:50%;
  background:none;color:var(--dm);cursor:pointer;transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease)}
.fe-md-copy:hover{background:var(--shade);color:var(--tx)}
.fe-md-copy:focus-visible{outline:2px solid var(--ac);outline-offset:1px}
.fe-md-copy svg{width:14px;height:14px}
.fe-md-copy.copied{color:var(--green)}
.fe-md-pre{background:var(--s1);border:1px solid var(--bd);border-radius:6px;padding:.75em 1em;
  overflow-x:auto;font-family:var(--mono);font-size:.86em;line-height:1.55;white-space:pre;color:var(--tx)}
.fe-md-code .fe-md-pre{border:none;border-radius:0;margin:0;padding-top:.4em}
.fe-md-mermaid{padding:14px;border:1px solid var(--bd);border-radius:6px;
  background:var(--s1);overflow-x:auto;text-align:center}
.fe-md-mermaid svg{display:block;max-width:100%;height:auto;margin:auto}
.fe-md-mermaid-source[hidden]{display:none}
.fe-md-mermaid-source{margin:8px 0 0;padding:10px;text-align:left;white-space:pre-wrap;
  background:var(--s2);border-radius:4px;font:calc(11.5px * var(--ui-text-scale,1))/1.55 var(--mono)}
.fe-md-anchor{margin-left:8px;color:var(--dm);font-weight:400;text-decoration:none;opacity:0;transition:opacity var(--t-fast)}
.fe-md-anchor::before{content:'#'}
.fe-md h1:hover .fe-md-anchor,.fe-md h2:hover .fe-md-anchor,.fe-md h3:hover .fe-md-anchor,.fe-md h4:hover .fe-md-anchor,.fe-md h5:hover .fe-md-anchor,.fe-md h6:hover .fe-md-anchor{opacity:1}
.fe-md-fm{display:grid;grid-template-columns:max-content 1fr;gap:3px 14px;padding:10px 14px;background:var(--s1);border:1px solid var(--bd);border-radius:6px;font-size:calc(12.5px * var(--ui-text-scale,1))}
.fe-md-fm dt{color:var(--dm);font-weight:600}
.fe-md-fm dd{margin:0;color:var(--tx)}
.fe-md li.fe-task{list-style:none;margin-left:-1.3em;padding-left:0}
.fe-md li.fe-task input{accent-color:var(--ac);margin-right:6px;vertical-align:-2px}
.fe-md-tablewrap{overflow-x:auto}
.fe-md img{display:block;margin-left:auto;margin-right:auto;cursor:zoom-in;max-width:100%;border-radius:6px}
.fe-md blockquote{border-left:3px solid var(--bd2);padding:0 1em;color:var(--mt)}
.fe-md blockquote .fe-md{padding:0}
.fe-md a{color:var(--ac);text-decoration:none}
.fe-md a:hover{text-decoration:underline}
.fe-md hr{border:none;border-top:1px solid var(--bd);margin:1.6em 0}
.fe-md strong{font-weight:600}
.fe-md-table{border-collapse:separate;border-spacing:0;margin:0;font-size:.93em;border:1px solid var(--bd);border-radius:6px;overflow:hidden}
.fe-md-table th,.fe-md-table td{border:0;border-bottom:1px solid var(--bd);padding:.55em .9em;text-align:left;vertical-align:top}
.fe-md-table tbody tr:last-child td{border-bottom:0}
.fe-md-table th{background:var(--s1);font-weight:600;font-size:.8em;letter-spacing:.05em;text-transform:uppercase;color:var(--mt)}
#fe-ctx,.fe-ctx{position:fixed;z-index:360;background:var(--s1);border:1px solid var(--bd);border-radius:var(--r);
  min-width:180px;box-shadow:0 8px 24px #0009;display:none;padding:4px 0}
.fe-ctx-item{display:flex;align-items:center;gap:8px;padding:6px 12px;color:var(--tx);
  font-size:calc(12px * var(--ui-text-scale,1));cursor:pointer;white-space:nowrap}
.fe-ctx-item:hover{background:var(--hover)}
.fe-ctx-key{margin-left:auto;color:var(--dm);font-size:calc(10px * var(--ui-text-scale,1));padding-left:16px}
.fe-ctx-sep{height:1px;background:var(--bd);margin:4px 0}
.fe-tab-ico svg{width:15px;height:16px}
.fe-tab-x,.fe-tab-more{opacity:.6}
.fe-tab:focus-visible,.fe-tab-x:focus-visible,.fe-tab-more:focus-visible{outline:2px solid var(--mt);outline-offset:-2px}
@media (max-width:900px){
  #fe-side{width:clamp(200px,26vw,240px)}
  #fe-toc-rail:not(.folded){width:clamp(150px,22vw,190px)}
  #fe-ff-q{width:110px}
  #fe-page .fe-md{padding:20px 18px 60px}
  #fe-fp-bar{flex-wrap:wrap;padding:7px 10px}
}
@container fe-main (max-width:760px){
  #fe-toolbar{flex-wrap:wrap}
  #fe-count{flex-basis:100%}
  #fe-tb-right{width:100%;flex-wrap:wrap;justify-content:flex-start}
}
@media (max-width:700px){
  #fe-settings-modal .fe-dlg-tab{padding:7px 3px 6px;text-align:center}
  #fe-settings-modal .fe-dlg-tab-main{flex-direction:column;gap:2px}
  #fe-settings-modal .fe-dlg-tab b{font-size:calc(10.5px * var(--ui-text-scale,1))}
  #fe-settings-modal .fe-dlg-tab i{display:none}
}
`;

  // src/file-editor.ts
  var AUTOSAVE_MS = 800;
  function splitHighlighted(html) {
    const out = [];
    const open = [];
    let line = "";
    const re = /<span[^>]*>|<\/span>|\n|[^<\n]+|</g;
    for (const m of html.match(re) ?? []) {
      if (m === "\n") {
        out.push(line + "</span>".repeat(open.length));
        line = open.join("");
      } else if (m.startsWith("<span")) {
        open.push(m);
        line += m;
      } else if (m === "</span>") {
        open.pop();
        line += m;
      } else line += m;
    }
    out.push(line);
    return out;
  }
  function editableRoot(path, folders, home = "") {
    for (const raw of folders ?? []) {
      let f = raw.trim().replace(/\/+$/, "");
      if (!f) continue;
      if (f === "~" || f.startsWith("~/")) {
        if (!home) continue;
        f = home + f.slice(1);
      }
      if (path.startsWith(f + "/")) return f;
      if (path === f) return f.slice(0, f.lastIndexOf("/"));
    }
    return null;
  }
  async function openFileEditor(box, host) {
    let doc;
    try {
      doc = await notes.fileRead(host.root, host.rel);
    } catch (err) {
      host.status(`cannot edit: ${err.message}`);
      return null;
    }
    const isMd = host.ext === "md" || host.ext === "mdx";
    box.innerHTML = `
    <div id="fe-fe-banner" style="display:none"></div>
    <div id="fe-fe-scroll">
      <div id="fe-fe-col">
        <div id="fe-fe-src">
          <pre id="fe-fe-paint" aria-hidden="true"></pre>
          <textarea id="fe-fe-ta" spellcheck="false" aria-label="File text"></textarea>
        </div>
        ${isMd ? '<div id="fe-fe-view" class="fe-md" hidden></div>' : ""}
      </div>
    </div>
    <div id="fe-fe-pill" role="toolbar" aria-label="Editing">
      <span id="fe-fe-state"></span>
      ${isMd ? `<button type="button" class="btn" data-icon data-hover-shade data-act="preview" title="Preview (\u2318\u21E7P)">${UI_ICON.eye}</button>` : ""}
      <button type="button" class="btn" data-variant="solid" data-act="done" title="Back to reading (Esc)">Done</button>
    </div>`;
    const ta = box.querySelector("#fe-fe-ta");
    const paintEl = box.querySelector("#fe-fe-paint");
    const src = box.querySelector("#fe-fe-src");
    const view = box.querySelector("#fe-fe-view");
    const state = box.querySelector("#fe-fe-state");
    const banner = box.querySelector("#fe-fe-banner");
    ta.value = doc.text;
    const buf = attachBuffer(ta, `file:${host.root}/${host.rel}`);
    let base = doc.text;
    let saving = false;
    let previewing = false;
    let timer = 0;
    const isDirty = () => ta.value !== base;
    let curRow = -1;
    const markLine = () => {
      let i = 0;
      for (let p = ta.value.indexOf("\n"); p !== -1 && p < ta.selectionStart; p = ta.value.indexOf("\n", p + 1)) i++;
      if (i === curRow) return;
      paintEl.children[curRow]?.classList.remove("cur");
      paintEl.children[i]?.classList.add("cur");
      curRow = i;
    };
    const paintSource = () => {
      const rows = splitHighlighted(highlightCode(ta.value, host.ext));
      paintEl.innerHTML = rows.map((r, i) => `<div class="fe-fe-row"><span class="fe-fe-ln">${i + 1}</span><span class="fe-fe-code">${r || " "}</span></div>`).join("");
      ta.style.height = "0";
      ta.style.height = paintEl.offsetHeight + "px";
      curRow = -1;
      markLine();
    };
    const paint = () => {
      const dirty = isDirty();
      state.innerHTML = saving ? "Saving\u2026" : dirty ? '<span class="fe-fe-dot"></span>Edited' : `${UI_ICON.check}Saved`;
      state.className = saving ? "busy" : dirty ? "dirty" : "saved";
      if (view && previewing) view.innerHTML = renderMarkdown(ta.value, host.href);
    };
    const setPreview = (on) => {
      if (!view) return;
      previewing = on;
      view.hidden = !on;
      src.hidden = on;
      box.querySelector('[data-act="preview"]')?.classList.toggle("on", on);
      paint();
      if (!on) ta.focus();
    };
    const write = async (expect) => {
      saving = true;
      paint();
      try {
        const text = ta.value;
        const r = await notes.fileWrite(host.root, host.rel, text, expect);
        doc = { text, mtime: r.mtime };
        base = text;
        banner.style.display = "none";
        host.saved(text);
      } catch (err) {
        const e = err;
        if (e.code === "notes_conflict") showConflict();
        else host.status(`not saved: ${e.message}`);
      } finally {
        saving = false;
        paint();
      }
    };
    const save = () => {
      clearTimeout(timer);
      if (!saving && isDirty()) void write(doc.mtime);
    };
    const later = () => {
      clearTimeout(timer);
      timer = window.setTimeout(save, AUTOSAVE_MS);
    };
    function showConflict() {
      banner.style.display = "";
      banner.innerHTML = `<span>${esc(host.rel.split("/").pop())} changed on disk since you opened it.</span>
      <button class="fe-pbn" data-act="reload" title="Drop your changes and load the file as it is now">Load from disk</button>
      <button class="fe-pbn" data-act="overwrite" title="Save your text over the newer file (the newer one is kept as a backup)">Keep mine</button>`;
    }
    const external = async () => {
      try {
        const now = await notes.fileRead(host.root, host.rel);
        if (now.mtime === doc.mtime) return;
        if (!isDirty()) {
          doc = now;
          base = now.text;
          buf.snap();
          ta.value = now.text;
          buf.snap();
          paintSource();
          paint();
        } else showConflict();
      } catch {
      }
    };
    const close = async () => {
      clearTimeout(timer);
      if (isDirty() && !saving && banner.style.display === "none") await write(doc.mtime);
      if (isDirty() && !confirm("Your last changes are not saved. Leave anyway?")) return;
      clearInterval(watch);
      document.removeEventListener("selectionchange", onSelection);
      box.innerHTML = "";
      host.closed();
    };
    box.addEventListener("click", async (e) => {
      const act = e.target.closest("[data-act]")?.dataset.act;
      if (act === "save") save();
      else if (act === "done") void close();
      else if (act === "preview") setPreview(!previewing);
      else if (act === "reload") {
        const now = await notes.fileRead(host.root, host.rel);
        doc = now;
        base = now.text;
        buf.snap();
        ta.value = now.text;
        banner.style.display = "none";
        paintSource();
        paint();
      } else if (act === "overwrite") {
        const now = await notes.fileRead(host.root, host.rel);
        void write(now.mtime);
      }
    });
    ta.addEventListener("input", () => {
      paintSource();
      paint();
      later();
    });
    const onSelection = () => {
      if (document.activeElement === ta) markLine();
    };
    document.addEventListener("selectionchange", onSelection);
    for (const ev of ["selectionchange", "mouseup", "keyup", "focus"]) ta.addEventListener(ev, markLine);
    box.querySelector("#fe-fe-scroll").addEventListener("mousedown", (e) => {
      const me = e;
      if (me.button !== 0 || previewing || me.target === ta) return;
      me.preventDefault();
      const rows = [...paintEl.children];
      let line = rows.findIndex((r) => r.getBoundingClientRect().bottom > me.clientY);
      const lines = ta.value.split("\n");
      let pos = ta.value.length;
      if (line !== -1) {
        pos = 0;
        for (let i = 0; i < line; i++) pos += lines[i].length + 1;
        pos += lines[line]?.length ?? 0;
      }
      ta.focus({ preventScroll: true });
      ta.setSelectionRange(pos, pos);
      markLine();
    });
    box.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setPreview(!previewing);
      } else if (e.key === "Escape" && previewing) {
        e.preventDefault();
        setPreview(false);
      }
    });
    ta.addEventListener("keydown", (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.shiftKey && e.key.toLowerCase() === "p") return;
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      } else if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) buf.redo();
        else buf.undo();
      } else if (e.key === "Escape") {
        e.preventDefault();
        void close();
      } else if (e.key === "Tab") {
        e.preventDefault();
        buf.snap();
        const r = indentLines(ta.value, { start: ta.selectionStart, end: ta.selectionEnd }, e.shiftKey);
        ta.value = r.text;
        ta.setSelectionRange(r.start, r.end);
        paintSource();
        paint();
        later();
      }
      e.stopPropagation();
    });
    const watch = setInterval(() => {
      if (document.visibilityState === "visible" && !saving) void external();
    }, 2e3);
    window.addEventListener("beforeunload", (e) => {
      if (box.isConnected && isDirty()) e.preventDefault();
    });
    paintSource();
    paint();
    ta.focus();
    return { dirty: isDirty, close: () => void close() };
  }

  // src/find-in-page.ts
  var MAX_HITS = 2e3;
  function attachFind(page, input, count, prev, next) {
    let hits = [];
    let cur = -1;
    const unmark = () => {
      for (const m of page.querySelectorAll("mark.fe-ff-hit")) m.replaceWith(document.createTextNode(m.textContent || ""));
      page.normalize();
      hits = [];
      cur = -1;
    };
    const show = () => {
      const q = input.value;
      count.textContent = !q ? "" : hits.length ? `${cur + 1} of ${hits.length}${hits.length >= MAX_HITS ? "+" : ""}` : "No match";
      count.classList.toggle("none", !!q && !hits.length);
      prev.toggleAttribute("disabled", hits.length < 2);
      next.toggleAttribute("disabled", hits.length < 2);
      hits.forEach((h, i) => h.classList.toggle("on", i === cur));
    };
    const go = (i) => {
      if (!hits.length) return;
      cur = (i + hits.length) % hits.length;
      show();
      hits[cur].scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    };
    const mark = () => {
      unmark();
      const q = input.value.toLowerCase();
      if (!q) {
        show();
        return;
      }
      const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => n.parentElement?.closest("script,style,svg,textarea") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
      });
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const node of nodes) {
        if (hits.length >= MAX_HITS) break;
        const text = node.data;
        const lower = text.toLowerCase();
        let at = lower.indexOf(q);
        if (at === -1) continue;
        const frag = document.createDocumentFragment();
        let from = 0;
        while (at !== -1 && hits.length < MAX_HITS) {
          frag.append(text.slice(from, at));
          const m = document.createElement("mark");
          m.className = "fe-ff-hit";
          m.textContent = text.slice(at, at + q.length);
          frag.append(m);
          hits.push(m);
          from = at + q.length;
          at = lower.indexOf(q, from);
        }
        frag.append(text.slice(from));
        node.replaceWith(frag);
      }
      const top = page.getBoundingClientRect().top;
      const first = hits.findIndex((h) => h.getBoundingClientRect().top >= top);
      go(first === -1 ? 0 : first);
      if (!hits.length) show();
    };
    input.addEventListener("input", mark);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        go(cur + (e.shiftKey ? -1 : 1));
      } else if (e.key === "Escape") {
        e.preventDefault();
        input.value = "";
        mark();
        input.blur();
      }
      e.stopPropagation();
    });
    prev.addEventListener("click", () => go(cur - 1));
    next.addEventListener("click", () => go(cur + 1));
    return {
      refresh: () => {
        if (input.value) mark();
      },
      clear: () => {
        input.value = "";
        unmark();
        show();
      },
      focus: () => {
        input.focus();
        input.select();
      }
    };
  }

  // src/file-page.ts
  var SCROLL_KEY = "bfb-page-scroll-v1";
  var TOC_KEY = "bfb-page-toc-v1";
  var COLUMN_KEY = "bfb-page-column-v2";
  var COLUMN_MODES = ["unset", "xl", "lg", "md"];
  var COLUMN_WIDTHS = { unset: "full", xl: "150ch", lg: "130ch", md: "110ch" };
  function columnMode(value) {
    if (value === true || value === "1") return "md";
    return COLUMN_MODES.includes(value) ? value : "unset";
  }
  function savedColumnMode(fallback) {
    return columnMode(kvGet(COLUMN_KEY) ?? kvGet("bfb-page-column-v1") ?? fallback);
  }
  var RELOAD_MS = 2e3;
  function parseExcludedExtensions(value) {
    return [...new Set(value.split(/[\s,]+/).map((x) => x.replace(/^\*?\./, "").toLowerCase()).filter((x) => /^[a-z0-9][a-z0-9_-]*$/.test(x)))];
  }
  function filePageExt(pathname) {
    if (pathname.endsWith("/")) return null;
    const name = decodeURIComponent(pathname.split("/").pop() || "");
    const bare = name.toLowerCase();
    const ext2 = ["dockerfile", "containerfile", "makefile", "gitignore"].includes(bare) ? bare : name.includes(".") ? name.split(".").pop().toLowerCase() : "";
    if (!ext2) return null;
    if (CODE_EXTS.has(ext2) || TABLE_EXTS.has(ext2) || JSONL_EXTS.has(ext2) || ext2 === "json") return ext2;
    return null;
  }
  function filePagesEnabled(ext2, settings) {
    const mode = settings.renderFilePages || "all";
    const excluded = Array.isArray(settings.excludedFileExtensions) ? settings.excludedFileExtensions : ["pdf", "html", "htm"];
    return !(excluded.includes(ext2.toLowerCase()) || mode === "off" || mode === "not-md" && (ext2 === "md" || ext2 === "mdx"));
  }
  function renderBody(text, ext2, href) {
    if (TABLE_EXTS.has(ext2)) {
      const rows = parseDSV(text, ext2 === "tsv" ? "	" : ",");
      return rows.length ? renderDSVTable(rows[0], rows.slice(1), numericCols(rows)) : '<div class="fe-ql-note">Empty file.</div>';
    }
    if (JSONL_EXTS.has(ext2)) return renderJsonl(text);
    if (ext2 === "json") return renderJsonTree(text);
    if (ext2 === "md" || ext2 === "mdx") return `<div class="fe-md">${renderMarkdown(text, href)}</div>`;
    return renderCode(text, ext2);
  }
  function buildToc(page, toc) {
    const heads = [...page.querySelectorAll(".fe-md h1, .fe-md h2, .fe-md h3, .fe-md h4")];
    toc.innerHTML = heads.map((h) => {
      const text = (h.textContent || "").replace(/#$/, "").trim();
      return `<a href="#${esc(h.id)}" class="fe-toc-${h.tagName.toLowerCase()}" data-id="${esc(h.id)}" title="${esc(text)}">${esc(text)}</a>`;
    }).join("");
    return heads.length;
  }
  function spy(page, toc) {
    const heads = [...page.querySelectorAll(".fe-md h1, .fe-md h2, .fe-md h3, .fe-md h4")];
    const top = page.getBoundingClientRect().top + 40;
    let current = heads[0] ?? null;
    for (const h of heads) {
      if (h.getBoundingClientRect().top <= top) current = h;
      else break;
    }
    if (heads.length && page.scrollTop + page.clientHeight >= page.scrollHeight - 2) current = heads[heads.length - 1];
    const picked = toc.dataset.pin ? document.getElementById(toc.dataset.pin) : null;
    if (picked) {
      const r = picked.getBoundingClientRect(), p = page.getBoundingClientRect();
      if (r.top >= p.top - 1 && r.top < p.bottom) current = picked;
    }
    let on = null;
    toc.querySelectorAll("a").forEach((a) => {
      const hit = !!current && a.dataset.id === current.id;
      a.classList.toggle("on", hit);
      if (hit) on = a;
    });
    const box = toc;
    const row = on;
    if (row) {
      const r = row.getBoundingClientRect(), b = box.getBoundingClientRect();
      if (r.top < b.top || r.bottom > b.bottom) box.scrollTop += r.top - b.top - box.clientHeight / 3;
    }
  }
  function scrollMemory() {
    try {
      return JSON.parse(kvGet(SCROLL_KEY) || "{}");
    } catch {
      return {};
    }
  }
  function rememberScroll(path, top) {
    const m = scrollMemory();
    m[path] = top;
    const keys = Object.keys(m);
    if (keys.length > 200) for (const k of keys.slice(0, keys.length - 200)) delete m[k];
    kvSet(SCROLL_KEY, JSON.stringify(m));
  }
  function renderFileContent() {
    return `
      <div id="fe-fp-bar">
        <span id="fe-fp-meta"></span>
        <button id="fe-fp-column" title="Cycle reading width"><svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true"><rect x="1.5" y="1.5" width="10" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M4 1.5v10M9 1.5v10" stroke="currentColor" stroke-width="1.1"/></svg><span class="fe-fp-column-label">Full width</span></button>
        <button id="fe-fp-edit" title="Edit this file (e)"><svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true"><path d="M8.5 2.5l2 2L4.5 10.5H2.5v-2z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>Edit</button>
        <button id="fe-fp-raw" title="Raw text (r)"><svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true"><path d="M4.5 3 1.5 6.5 4.5 10M8.5 3l3 3.5-3 3.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>Raw</button>
        <button id="fe-fp-copy" title="Copy file contents"><svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M2 9H1.5V2a.5.5 0 0 1 .5-.5h7V2" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>Copy</button>
        <span id="fe-ff" title="Find in this file (/) \xB7 Enter next \xB7 Shift+Enter previous \xB7 Esc clears">
          <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true"><circle cx="5.5" cy="5.5" r="3.8" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M8.4 8.4 11.5 11.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
          <input id="fe-ff-q" type="text" placeholder="Find in file" spellcheck="false" autocomplete="off" aria-label="Find in this file" title="Find in this file (/)">
          <span id="fe-ff-n" aria-live="polite"></span>
          <button id="fe-ff-prev" data-icon data-size="sm" title="Previous match (Shift+Enter)" disabled><svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true"><path d="M2.5 7 5.5 4l3 3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          <button id="fe-ff-next" data-icon data-size="sm" title="Next match (Enter)" disabled><svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true"><path d="M2.5 4l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        </span>
      </div>
      <div id="fe-fp">
        <div id="fe-page"></div>
        <div id="fe-fe" style="display:none"></div>
        <aside id="fe-toc-rail" hidden>
          <div class="fe-toc-head"><span class="fe-toc-title">On this page</span>
            <button id="fe-toc-fold" type="button" title="Collapse the contents"><svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true"><path d="M5 3l3.5 3.5L5 10" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>
          <nav id="fe-toc"></nav>
        </aside>
      </div>`;
  }
  function mountFileContent(opts) {
    const { ext: ext2, rawPath, href } = opts;
    let text = opts.text;
    const page = document.getElementById("fe-page");
    const toc = document.getElementById("fe-toc");
    const rail = document.getElementById("fe-toc-rail");
    const foldBtn = document.getElementById("fe-toc-fold");
    const rawBtn = document.getElementById("fe-fp-raw");
    const colBtn = document.getElementById("fe-fp-column");
    const meta = document.getElementById("fe-fp-meta");
    const findBox = document.getElementById("fe-ff");
    const find = attachFind(
      page,
      document.getElementById("fe-ff-q"),
      document.getElementById("fe-ff-n"),
      document.getElementById("fe-ff-prev"),
      document.getElementById("fe-ff-next")
    );
    const isMd = ext2 === "md" || ext2 === "mdx";
    let raw = false;
    let headings = 0;
    let tocOpen = kvGet(TOC_KEY) !== "0";
    let column = savedColumnMode(opts.column);
    const fe = document.getElementById("fe");
    const paintMeta = () => {
      const fm = fileMeta(text, ext2, rawPath);
      meta.textContent = fm.kind;
      const row = document.getElementById("fe-status-meta");
      if (row) row.innerHTML = metaChips(fm);
      const count = document.getElementById("fe-count");
      if (count) count.textContent = metaSummary(fm);
    };
    paintMeta();
    const paint = () => {
      for (const mode of COLUMN_MODES) fe.classList.toggle(`fe-column-${mode}`, column === mode);
      colBtn.classList.toggle("on", column !== "unset");
      colBtn.querySelector(".fe-fp-column-label").textContent = column === "unset" ? "Full width" : `${column.toUpperCase()} width`;
      const next = COLUMN_MODES[(COLUMN_MODES.indexOf(column) + 1) % COLUMN_MODES.length];
      colBtn.title = `Reading width: ${column === "unset" ? "full" : `${column.toUpperCase()} (${COLUMN_WIDTHS[column]})`}. Click for ${next === "unset" ? "full" : `${next.toUpperCase()} (${COLUMN_WIDTHS[next]})`}`;
      colBtn.style.display = isMd && !raw ? "" : "none";
      rail.hidden = !isMd || raw || headings < 2 || !!editor;
      rail.classList.toggle("folded", !tocOpen);
      foldBtn.title = tocOpen ? "Collapse the contents" : "Show the contents";
      foldBtn.setAttribute("aria-expanded", String(tocOpen));
      findBox.hidden = !!editor;
    };
    const render2 = () => {
      paintMeta();
      const top = page.scrollTop;
      page.innerHTML = raw ? renderCode(text, JSONL_EXTS.has(ext2) ? "json" : ext2) : renderBody(text, ext2, href);
      headings = !raw && isMd ? buildToc(page, toc) : 0;
      page.scrollTop = top;
      rawBtn.classList.toggle("on", raw);
      paint();
      spy(page, toc);
      find.refresh();
    };
    let editor = null;
    render2();
    foldBtn.addEventListener("click", () => {
      tocOpen = !tocOpen;
      kvSet(TOC_KEY, tocOpen ? "1" : "0");
      paint();
      if (tocOpen) spy(page, toc);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || editor) return;
      const ae = document.activeElement;
      if (ae && ["INPUT", "TEXTAREA", "SELECT"].includes(ae.tagName)) return;
      e.preventDefault();
      find.focus();
    });
    colBtn.addEventListener("click", () => {
      column = COLUMN_MODES[(COLUMN_MODES.indexOf(column) + 1) % COLUMN_MODES.length];
      kvSet(COLUMN_KEY, column);
      paint();
    });
    page.addEventListener("scroll", () => {
      if (isMd && !raw) spy(page, toc);
    });
    toc.addEventListener("click", (e) => {
      const a = e.target.closest("a[data-id]");
      const target = a && document.getElementById(a.dataset.id);
      if (!target) return;
      e.preventDefault();
      const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
      toc.dataset.pin = a.dataset.id;
      target.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
      history.replaceState(null, "", "#" + encodeURIComponent(a.dataset.id));
      spy(page, toc);
    });
    const unpin = () => {
      delete toc.dataset.pin;
    };
    page.addEventListener("wheel", unpin, { passive: true });
    page.addEventListener("pointerdown", unpin);
    page.addEventListener("keydown", unpin);
    const remembered = scrollMemory()[rawPath];
    if (remembered) page.scrollTop = remembered;
    else if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
    let scrollTimer = null;
    page.addEventListener("scroll", () => {
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => rememberScroll(rawPath, page.scrollTop), 300);
    });
    const toggleRaw = () => {
      if (!editor) {
        raw = !raw;
        render2();
      }
    };
    const editBox = document.getElementById("fe-fe");
    const editBtn = document.getElementById("fe-fp-edit");
    const status = (t) => {
      document.getElementById("fe-status-text").textContent = t;
    };
    const home = rawPath.match(/^\/Users\/[^/]+/)?.[0] ?? "";
    let root = editableRoot(rawPath, opts.editableFolders, home);
    const folder = rawPath.slice(0, rawPath.lastIndexOf("/"));
    editBtn.title = "Edit this file (e)";
    const askToAllow = () => new Promise((resolve) => {
      document.getElementById("fe-allow")?.remove();
      const pop = document.createElement("div");
      pop.id = "fe-allow";
      pop.setAttribute("role", "dialog");
      pop.setAttribute("aria-label", "Allow editing");
      const short = home && folder.startsWith(home + "/") ? "~" + folder.slice(home.length) : folder;
      pop.innerHTML = `<div class="fe-allow-title">${UI_ICON.lock}Allow editing here?</div>
      <p>Saves write to <code>${esc(short)}</code>. Each save keeps the old text for 14 days.</p>
      <div class="fe-allow-acts"><button type="button" class="btn" data-hover-shade data-a="cancel">Cancel</button>
      <button type="button" class="btn" data-variant="outline" data-a="file">Just this file</button>
      <button type="button" class="btn" data-variant="solid" data-a="folder">Allow folder</button></div>`;
      document.getElementById("fe").appendChild(pop);
      const r = editBtn.getBoundingClientRect();
      pop.style.top = `${r.bottom + 8}px`;
      pop.style.left = `${Math.max(8, Math.min(r.right - pop.offsetWidth, innerWidth - pop.offsetWidth - 8))}px`;
      const done = (ok) => {
        pop.remove();
        document.removeEventListener("keydown", onKey, true);
        document.removeEventListener("pointerdown", onAway, true);
        resolve(ok);
      };
      const onKey = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          done(false);
        }
      };
      const onAway = (e) => {
        if (!pop.contains(e.target) && e.target !== editBtn) done(false);
      };
      document.addEventListener("keydown", onKey, true);
      document.addEventListener("pointerdown", onAway, true);
      pop.addEventListener("click", (e) => {
        const a = e.target.closest("[data-a]")?.dataset.a;
        if (!a) return;
        if (a === "cancel") {
          done(false);
          return;
        }
        const s = getSettings();
        s.editableFolders = [.../* @__PURE__ */ new Set([...s.editableFolders ?? [], a === "folder" ? folder : rawPath])];
        saveSettings(s);
        root = editableRoot(rawPath, s.editableFolders, home);
        done(!!root);
      });
      pop.querySelector('[data-a="folder"]').focus();
    });
    const noteAtButton = (msg) => {
      document.getElementById("fe-allow")?.remove();
      const pop = document.createElement("div");
      pop.id = "fe-allow";
      pop.className = "fe-allow-note";
      pop.setAttribute("role", "alert");
      pop.innerHTML = `<div class="fe-allow-title">${UI_ICON.lock}Cannot edit this file</div><p>${esc(msg)}</p>`;
      document.getElementById("fe").appendChild(pop);
      const r = editBtn.getBoundingClientRect();
      pop.style.top = `${r.bottom + 8}px`;
      pop.style.left = `${Math.max(8, Math.min(r.right - pop.offsetWidth, innerWidth - pop.offsetWidth - 8))}px`;
      const away = () => {
        pop.remove();
        document.removeEventListener("pointerdown", away, true);
      };
      document.addEventListener("pointerdown", away, true);
      setTimeout(away, 8e3);
    };
    const edit2 = async () => {
      if (editor || editBtn.classList.contains("busy")) return;
      if (!root && !await askToAllow()) return;
      if (!root) return;
      editBtn.classList.add("busy");
      page.style.display = "none";
      editBox.style.display = "";
      find.clear();
      editBtn.classList.add("on");
      editor = await openFileEditor(editBox, {
        root,
        rel: rawPath.slice(root.length + 1),
        ext: ext2,
        href,
        status: (t) => {
          status(t);
          if (t.startsWith("cannot edit: ")) noteAtButton(t.slice(13));
        },
        saved: (fresh) => {
          text = fresh;
          paintMeta();
        },
        // the pill shows Saved
        // The file may have changed while editing (a reload from disk), so read it again.
        closed: () => {
          editor = null;
          editBox.style.display = "none";
          page.style.display = "";
          editBtn.classList.remove("on");
          fetchFileText(href).then((fresh) => {
            text = fresh;
            paintMeta();
          }).catch(() => {
          }).finally(render2);
        }
      });
      editBtn.classList.remove("busy");
      paint();
      if (!editor) {
        editBox.style.display = "none";
        page.style.display = "";
        editBtn.classList.remove("on");
        render2();
      }
    };
    editBtn.addEventListener("click", () => void edit2());
    rawBtn.addEventListener("click", toggleRaw);
    document.getElementById("fe-fp-copy").addEventListener("click", () => {
      copyToClipboard(text).then((ok) => {
        document.getElementById("fe-status-text").textContent = ok ? "copied" : "copy failed";
      });
    });
    const reloadEl = document.getElementById("fe-fp-reload");
    const live = (ok, label) => {
      reloadEl.innerHTML = `<span class="fe-live-dot"${ok ? "" : ' style="background:var(--dm)"'}></span>${label}`;
    };
    setInterval(() => {
      if (document.visibilityState !== "visible" || editor) return;
      fetchFileText(href).then((fresh) => {
        if (fresh === text) return;
        text = fresh;
        paintMeta();
        render2();
        live(true, "reloaded " + (/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      }).catch(() => live(false, "not watching"));
    }, RELOAD_MS);
    return {
      toggleRaw,
      edit: () => void edit2(),
      setText(fresh) {
        text = fresh;
        paintMeta();
        render2();
      }
    };
  }

  // src/tabs.ts
  var EMPTY = { list: [], active: null };
  function labelFor(path) {
    return path.split("/").filter(Boolean).pop() || "/";
  }
  function kindOf(path) {
    return path.endsWith("/") ? "folder" : "file";
  }
  var newId = () => Math.random().toString(36).slice(2, 10);
  var pinnedCount = (s) => s.list.filter((t) => t.pinned).length;
  function openTab(s, path, background = false) {
    const found = s.list.find((t) => t.path === path);
    if (found) return background ? s : { ...s, active: found.id };
    const tab = { id: newId(), path, kind: kindOf(path), label: labelFor(path), pinned: false };
    const i = s.list.findIndex((t) => t.id === s.active);
    const list = [...s.list];
    list.splice(Math.max(i < 0 ? list.length : i + 1, pinnedCount(s)), 0, tab);
    return { list, active: background ? s.active : tab.id };
  }
  function closeTab(s, id) {
    const i = s.list.findIndex((t) => t.id === id);
    if (i < 0) return s;
    const list = s.list.filter((t) => t.id !== id);
    let active = s.active;
    if (active === id) active = list[Math.min(i, list.length - 1)]?.id ?? null;
    return { list, active };
  }
  function closeOthers(s, id) {
    if (!s.list.some((t) => t.id === id)) return s;
    const list = s.list.filter((t) => t.pinned || t.id === id);
    return { list, active: list.some((t) => t.id === s.active) ? s.active : id };
  }
  function activate(s, id) {
    return s.list.some((t) => t.id === id) ? { ...s, active: id } : s;
  }
  function togglePin(s, id) {
    const t = s.list.find((x) => x.id === id);
    if (!t) return s;
    const rest = s.list.filter((x) => x.id !== id);
    const at = rest.filter((x) => x.pinned).length;
    rest.splice(at, 0, { ...t, pinned: !t.pinned });
    return { ...s, list: rest };
  }
  function step(s, dir) {
    if (!s.list.length) return null;
    const i = s.list.findIndex((t) => t.id === s.active);
    const j = i < 0 ? dir > 0 ? 0 : s.list.length - 1 : (i + dir + s.list.length) % s.list.length;
    return s.list[j];
  }
  function moveTab(s, id, toId) {
    const from = s.list.findIndex((t2) => t2.id === id), to = s.list.findIndex((t2) => t2.id === toId);
    if (from < 0 || to < 0 || from === to || s.list[from].pinned !== s.list[to].pinned) return s;
    const list = [...s.list];
    const [t] = list.splice(from, 1);
    list.splice(to, 0, t);
    return { ...s, list };
  }
  function isTabState(v) {
    const s = v;
    return !!s && Array.isArray(s.list) && s.list.every((t) => t && typeof t.id === "string" && typeof t.path === "string") && (s.active === null || typeof s.active === "string");
  }
  function normalize(s) {
    return { active: s.active, list: s.list.map((t) => ({ ...t, kind: t.kind ?? kindOf(t.path), label: t.label ?? labelFor(t.path), pinned: !!t.pinned })) };
  }
  var RECOVERY_MAX_AGE = 24 * 60 * 60 * 1e3;
  function isStale(e, now, maxAge = RECOVERY_MAX_AGE) {
    return now - e.at > maxAge || !e.state.list.length;
  }
  function insertTab(s, tab, index) {
    if (s.list.some((t) => t.path === tab.path)) return s;
    const list = [...s.list];
    const at = Math.min(Math.max(index, pinnedCount(s)), list.length);
    list.splice(at, 0, { ...tab, pinned: false });
    return { ...s, list };
  }
  function splitLabel(label) {
    if (label.length <= 12) return { head: label, tail: "" };
    const n = Math.min(7, label.length);
    return { head: label.slice(0, label.length - n), tail: label.slice(label.length - n) };
  }
  function displayLabels(list) {
    const count = /* @__PURE__ */ new Map();
    for (const t of list) count.set(t.label, (count.get(t.label) ?? 0) + 1);
    return list.map((t) => {
      if ((count.get(t.label) ?? 0) < 2) return t.label;
      const parts = t.path.split("/").filter(Boolean);
      return parts.length >= 2 ? parts[parts.length - 2] + "/" + t.label : t.label;
    });
  }

  // src/strip.ts
  var SESSION_KEY = "bfb-strip-v2";
  var RECOVERY_PREFIX = "bfb-strip-v2:";
  var storageArea = () => typeof chrome !== "undefined" && chrome.storage?.local || null;
  function readSession() {
    try {
      const v = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
      return v && typeof v.sid === "string" && isTabState(v.state) ? { sid: v.sid, state: normalize(v.state), closed: Array.isArray(v.closed) ? v.closed : [] } : null;
    } catch {
      return null;
    }
  }
  function writeSession(sid, state, closed) {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ sid, state, closed }));
    } catch {
    }
  }
  function writeRecovery(sid, state, closed) {
    const area2 = storageArea();
    if (!area2) return;
    try {
      if (!state.list.length) area2.remove(RECOVERY_PREFIX + sid, () => void chrome.runtime.lastError);
      else area2.set({ [RECOVERY_PREFIX + sid]: { state, at: Date.now(), closed } }, () => void chrome.runtime.lastError);
    } catch {
    }
  }
  function readRecoveries() {
    return new Promise((resolve) => {
      const area2 = storageArea();
      if (!area2) return resolve({});
      try {
        area2.get(null, (all) => {
          const out = {};
          for (const [k, v] of Object.entries(all || {})) {
            if (!k.startsWith(RECOVERY_PREFIX)) continue;
            const e = v;
            if (e && isTabState(e.state) && typeof e.at === "number") out[k.slice(RECOVERY_PREFIX.length)] = { state: normalize(e.state), at: e.at, closed: !!e.closed };
          }
          resolve(out);
        });
      } catch {
        resolve({});
      }
    });
  }
  function mountStrip(host) {
    const { el: el2, rawPath, toast } = host;
    const hereIn = (s) => s.list.find((t) => t.path === rawPath);
    const activateHere = (s) => {
      const h = hereIn(s);
      return h ? activate(s, h.id) : { ...s, active: null };
    };
    let sid = "";
    let state = EMPTY;
    let closed = [];
    let drag = null;
    function commit(next) {
      state.list.forEach((t, i) => {
        if (!next.list.some((x) => x.id === t.id)) closed.push({ tab: t, index: i });
      });
      if (closed.length > 20) closed = closed.slice(-20);
      state = next;
      writeSession(sid, state, closed);
      writeRecovery(sid, state, false);
      render2();
    }
    function reopenClosed() {
      const last = closed.pop();
      if (!last) return;
      writeSession(sid, state, closed);
      const open = state.list.find((t) => t.path === last.tab.path);
      if (open) {
        goTab(open.id);
        return;
      }
      commit(insertTab(state, last.tab, last.index));
      toast(`Reopened ${last.tab.label}`);
    }
    const fileUrl = (p) => "file://" + p.split("/").map(encodeURIComponent).join("/");
    function hrefFor(t) {
      return fileUrl(t.path);
    }
    function goTab(id) {
      const t = state.list.find((x) => x.id === id);
      if (!t) return;
      const s = t.path !== rawPath && rawPath && !hereIn(state) ? openTab(state, rawPath, true) : state;
      commit(activate(s, id));
      if (t.path !== rawPath) location.href = pageHref(hrefFor(t));
    }
    function closeHere() {
      const here = hereIn(state);
      if (!here) return;
      const next = closeTab(state, here.id);
      commit(next);
      const to = next.list.find((t) => t.id === next.active);
      if (to && to.path !== rawPath) location.href = pageHref(hrefFor(to));
    }
    function closeById(id) {
      if (hereIn(state)?.id === id) closeHere();
      else commit(closeTab(state, id));
    }
    const menu = document.createElement("div");
    menu.className = "fe-ctx fe-tab-menu";
    menu.style.display = "none";
    (el2.closest("#fe") ?? document.body).appendChild(menu);
    const closeMenu = () => {
      menu.style.display = "none";
    };
    function openMenu2(t, anchor) {
      const saved = getSaved().some((p) => p.path === t.path);
      menu.innerHTML = [
        `<div class="fe-ctx-item" data-act="copy">Copy path</div>`,
        `<div class="fe-ctx-item" data-act="save">${saved ? "Unsave" : "Save"}</div>`,
        `<div class="fe-ctx-item" data-act="pin">${t.pinned ? "Unpin" : "Pin"}<span class="fe-ctx-key">p</span></div>`,
        `<div class="fe-ctx-sep"></div>`,
        `<div class="fe-ctx-item" data-act="close">Close<span class="fe-ctx-key">w</span></div>`,
        `<div class="fe-ctx-item" data-act="others">Close others</div>`
      ].join("");
      menu.dataset.id = t.id;
      menu.style.display = "block";
      const r = anchor.getBoundingClientRect();
      menu.style.left = Math.min(r.left, window.innerWidth - menu.offsetWidth - 8) + "px";
      menu.style.top = r.bottom + 4 + "px";
    }
    menu.addEventListener("click", (e) => {
      const item = e.target.closest(".fe-ctx-item");
      closeMenu();
      if (item?.dataset.go) {
        goTab(item.dataset.go);
        return;
      }
      const t = state.list.find((x) => x.id === menu.dataset.id);
      if (!item || !t) return;
      const act = item.dataset.act;
      if (act === "copy") void copyToClipboard(t.path).then((ok) => toast(ok ? "Copied path" : "Copy failed"));
      else if (act === "save") {
        const was = getSaved().some((p) => p.path === t.path);
        saveSaved(was ? removePlace(getSaved(), t.path) : upsertPlace(getSaved(), { path: t.path, label: t.label }));
        host.onSavedChange?.();
        toast(was ? "Removed from Saved" : "Saved");
      } else if (act === "pin") commit(togglePin(state, t.id));
      else if (act === "close") closeById(t.id);
      else if (act === "others") commit(closeOthers(state, t.id));
    });
    document.addEventListener("click", (e) => {
      if (menu.style.display !== "none" && !menu.contains(e.target)) closeMenu();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMenu();
    });
    function lblHtml(label) {
      const { head, tail } = splitLabel(label);
      return `<span class="fe-tab-lbl"><span class="fe-tab-head">${esc(head)}</span>${tail ? `<span class="fe-tab-tail">${esc(tail)}</span>` : ""}</span>`;
    }
    function tabHtml(t, i, on, label) {
      const ico = t.kind === "file" ? `<span class="fe-tab-ico">${icoFile(t.label.includes(".") ? t.label.split(".").pop().toLowerCase() : "")}</span>` : `<span class="fe-tab-ico">${icoFolder(t.label)}</span>`;
      const tip = `${t.path}
${i < 9 ? `${i + 1} jumps \xB7 ` : ""}click switches \xB7 ${t.pinned ? "pinned (p unpins)" : "middle-click closes"} \xB7 drag reorders`;
      return `<a class="fe-tab${on ? " on" : ""}${t.pinned ? " pinned" : ""}"${on ? ' aria-current="page"' : ""} draggable="true" data-id="${esc(t.id)}" href="${esc(hrefFor(t))}" title="${esc(tip)}">
      ${ico}${lblHtml(label)}
      <button class="fe-tab-more" data-id="${esc(t.id)}" title="Copy path \xB7 save \xB7 pin \xB7 close others">\u2026</button>
      ${t.pinned ? "" : `<button class="fe-tab-x" data-id="${esc(t.id)}" title="Close (w)">\u2715</button>`}
    </a>`;
    }
    function render2() {
      const here = hereIn(state);
      const labels = displayLabels(state.list);
      const rows = state.list.map((t, i) => tabHtml(t, i, t.id === here?.id, labels[i]));
      if (!here) {
        const ico = kindOf(rawPath) === "file" ? `<span class="fe-tab-ico">${icoFile(labelFor(rawPath).split(".").pop().toLowerCase())}</span>` : `<span class="fe-tab-ico">${icoFolder(labelFor(rawPath))}</span>`;
        rows.push(`<a class="fe-tab on temp" data-id="" href="file://${esc(rawPath)}" title="Not kept yet \xB7 t or double-click keeps \xB7 p pins">${ico}${lblHtml(labelFor(rawPath))}</a>`);
      }
      if (state.list.length > 1) rows.push(`<button class="fe-tab-list" title="All tabs">${CHEVRON_DOWN}</button>`);
      el2.innerHTML = rows.join("");
      el2.classList.toggle("empty", state.list.length === 0);
      el2.querySelector(".fe-tab.on")?.scrollIntoView({ inline: "nearest", block: "nearest" });
      el2.querySelector(".fe-tab-list")?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        menu.innerHTML = state.list.map((t, i) => `<div class="fe-ctx-item" data-go="${esc(t.id)}">${esc(labels[i])}</div>`).join("");
        menu.dataset.id = "";
        menu.style.display = "block";
        const r = e.currentTarget.getBoundingClientRect();
        menu.style.left = Math.min(r.left, window.innerWidth - menu.offsetWidth - 8) + "px";
        menu.style.top = r.bottom + 4 + "px";
      });
      el2.querySelectorAll(".fe-tab").forEach((a) => {
        a.addEventListener("click", (e) => {
          if (e.target.closest("button")) return;
          if (e.metaKey || e.ctrlKey || e.shiftKey) return;
          e.preventDefault();
          if (e.detail > 1) return;
          if (a.dataset.id) goTab(a.dataset.id);
        });
        a.addEventListener("dblclick", (e) => {
          e.preventDefault();
          if (!a.dataset.id) commit(openTab(state, rawPath));
        });
        a.addEventListener("auxclick", (e) => {
          if (e.button !== 1) return;
          e.preventDefault();
          const t = state.list.find((x) => x.id === a.dataset.id);
          if (t && !t.pinned) closeById(t.id);
        });
        a.addEventListener("dragstart", () => {
          drag = a.dataset.id || null;
        });
        a.addEventListener("dragover", (e) => {
          e.preventDefault();
          a.classList.add("drag-over");
        });
        a.addEventListener("dragleave", () => a.classList.remove("drag-over"));
        a.addEventListener("drop", (e) => {
          e.preventDefault();
          a.classList.remove("drag-over");
          if (drag && a.dataset.id && drag !== a.dataset.id) commit(moveTab(state, drag, a.dataset.id));
          drag = null;
        });
      });
      el2.querySelectorAll(".fe-tab-x").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          closeById(btn.dataset.id);
        });
      });
      el2.querySelectorAll(".fe-tab-more").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const t = state.list.find((x) => x.id === btn.dataset.id);
          if (t) openMenu2(t, btn);
        });
      });
    }
    function handleKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return false;
      const here = hereIn(state);
      if (e.key === "t") {
        commit(openTab(state, rawPath));
        return true;
      }
      if (e.key === "w") {
        if (here && !here.pinned) closeHere();
        return true;
      }
      if (e.key === "T") {
        reopenClosed();
        return true;
      }
      if (e.key === "p") {
        const s = here ? state : openTab(state, rawPath);
        commit(togglePin(s, here?.id ?? s.active));
        return true;
      }
      if (e.key === "[" || e.key === "]") {
        const t = step({ ...state, active: here?.id ?? null }, e.key === "]" ? 1 : -1);
        if (t) goTab(t.id);
        return true;
      }
      if (/^[1-9]$/.test(e.key)) {
        const t = state.list[parseInt(e.key) - 1];
        if (t) {
          goTab(t.id);
          return true;
        }
      }
      return false;
    }
    async function closedSets() {
      const all = await readRecoveries();
      const now = Date.now();
      const area2 = storageArea();
      for (const [k, e] of Object.entries(all)) if (isStale(e, now)) {
        try {
          area2?.remove(RECOVERY_PREFIX + k, () => void chrome.runtime.lastError);
        } catch {
        }
        delete all[k];
      }
      return Object.entries(all).filter(([k, e]) => k !== sid && e.closed).sort((a, b) => b[1].at - a[1].at).map(([k, e]) => ({ id: k, at: e.at, labels: e.state.list.map((t) => labelFor(t.path)) }));
    }
    async function restoreSet(id) {
      const old = (await readRecoveries())[id];
      if (!old) {
        toast("That tab set is gone");
        return;
      }
      const area2 = storageArea();
      try {
        area2?.remove(RECOVERY_PREFIX + id, () => void chrome.runtime.lastError);
      } catch {
      }
      let merged = old.state;
      for (const t of state.list) merged = insertTab(merged, t, merged.list.length);
      commit(activateHere(merged));
      const n = old.state.list.length;
      toast(`Restored ${n} tab${n === 1 ? "" : "s"}`, 6e3, {
        label: "undo",
        run: () => {
          let back = state;
          for (const t of old.state.list) back = closeTab(back, t.id);
          commit(back);
          try {
            area2?.set({ [RECOVERY_PREFIX + id]: old }, () => void chrome.runtime.lastError);
          } catch {
          }
        }
      });
    }
    const stored = readSession();
    if (stored) {
      sid = stored.sid;
      closed = stored.closed;
      state = stored.state;
      commit(activateHere(stored.state));
    } else {
      sid = Math.random().toString(36).slice(2, 12);
      writeSession(sid, state, closed);
      render2();
    }
    window.addEventListener("pagehide", () => writeRecovery(sid, state, true));
    return {
      handleKey,
      open: (path, background = false) => commit(openTab(state, path, background)),
      go: (path) => {
        let s = state;
        if (rawPath && !s.list.some((t) => t.path === rawPath)) s = openTab(s, rawPath, true);
        commit(openTab(s, path));
        if (path !== rawPath) location.href = pageHref(fileUrl(path));
      },
      state: () => state,
      closedSets,
      restoreSet
    };
  }

  // src/toast.ts
  function makeToast(el2) {
    let tid;
    return (msg, ms = 2400, action) => {
      el2.textContent = msg;
      if (action) {
        const btn = document.createElement("button");
        btn.className = "fe-toast-act";
        btn.textContent = action.label;
        btn.title = action.label;
        btn.addEventListener("click", () => {
          action.run();
          el2.classList.remove("show");
        });
        el2.append(" \xB7 ", btn);
        ms = Math.max(ms, 6e3);
      }
      el2.classList.toggle("act", !!action);
      el2.classList.add("show");
      clearTimeout(tid);
      tid = setTimeout(() => el2.classList.remove("show"), ms);
    };
  }

  // src/help.ts
  var HELP_TABS = [
    { key: "keys", label: "Keyboard", hint: "every shortcut", md: `
| Key | Action |
|-----|--------|
| \u2191 / \u2193 | Move selection |
| Enter | Open |
| Backspace \xB7 \u2318\u2191 | Go to parent folder |
| Space | Preview selected file (Space again closes) |
| \u2318F | Focus the filter (again \u2192 browser find) |
| \u2318A | Select all |
| \u2318C | Copy selected path(s) |
| Esc | Close a dialog or the preview / clear the filter |
| ? \xB7 , | Open this Help \xB7 open Settings |
| t \xB7 w \xB7 p | Keep this folder or file as a tab \xB7 close it \xB7 pin it |
| [ \xB7 ] \xB7 1-9 | Previous / next tab \xB7 jump to a tab (in a dialog: switch its tabs) |
| T (shift-t) | Reopen the last closed tab, at its place |
| n | New note (when a Notes folder is set) |
| r | Raw / rendered, on a file page |

Single-letter keys work when nothing is focused. Chrome owns \u2318T and \u2318W, so
the tab keys are bare letters.
` },
    { key: "explorer", label: "Explorer", hint: "views, finding, opening", md: `
## Views & zoom

Switch layout from the toolbar: **Details** (table), **List** (compact),
**Tree** (expand folders in place), **Tiles**, or **Large Icons**. Your choice is remembered. The **zoom** slider
(50\u2013320%) scales the whole list.

The **\u2261** button at the top left shows or hides the sidebar, and dragging the
sidebar's right edge resizes it. To scale the whole interface, sidebar and text
included, set **Interface size** in **Settings \u2192 Appearance**.

## Finding files

- **Quick filter** \u2014 type in the **Filter** box (top-right), or press **\u2318F** to jump to it. Press **\u2318F** again to fall through to Chrome's own find.
- **Text inside files** \u2014 open the **Filter** panel; the second row reads text files allowed by the name and type fields, up to 2 MB each. **Text regex** changes only content matching. Results show a first-match snippet and match count. **Run** or Enter starts a scan; **Cancel** keeps a labelled partial result. Changing the query stops the old scan. **Save view** keeps these fields in a Saved link.
- **Deep search** \u2014 the folder button beside the filter box includes subfolders. Names show their path from this folder, so **src/main.ts** matches **main**. The scan skips node_modules, .git and dot-folders (unless hidden files are shown), stops at 5000 items, and uses the selected depth limit (1, 2, 4, or 8).
- **Sort** \u2014 click a column header, or open the **Sort** panel to sort by name, size, type, extension, or modified date, and to **group** (folders-first, files-first, by extension, or by type).
- **Filter** panel \u2014 match names by text or regex, or show only folders / files / one extension.
- **Hidden files** \u2014 the eye button toggles dotfiles.

## Selecting & opening

- Click a file to look at it in the panel; the address bar stays put. Click a folder to go there. **Double-click** a file to open its page in this tab.
- **\u2325-click** keeps a folder or file as a strip tab, in the background. **Middle-click** opens it in a new Chrome tab. Both work on sidebar rows and path segments too. A click on a sidebar row opens it as a strip tab, switching to the tab that already has it.
- **\u2191 / \u2193** move the selection, **Enter** opens, **Backspace** or **\u2318\u2191** goes up.
- **Multi-select**: **shift-click** or **\u2318/Ctrl-click** toggles a row, **\u21E7\u2318-click** selects a range, **\u2318A** selects all. **\u2318C** copies the selected paths.
- **Right-click** an item for Copy path, Copy name, Open in terminal \u2014 plus Preview for previewable files. With several items selected, the menu offers bulk Copy paths / Copy names.

## Breadcrumbs

Click any path segment to jump there. The chevron button next to a segment opens a
dropdown of that folder's contents with its own filter box \u2014 type to narrow,
**Enter** opens the first match.

## Terminal

The terminal button opens the current folder in your terminal. With the optional
native host it launches Ghostty directly; otherwise it copies a \`cd\` command to
your clipboard. Choose your terminal in **Settings \u2192 Terminal**.

## File pages

A file opened directly in the tab (markdown, code, json, jsonl, tsv/csv, txt)
renders like the preview instead of Chrome's plain text, inside the same
shell as a folder: the sidebar, the strip and the path bar stay where they
are. The main column shows a heading table of contents for markdown, **r**
for raw, a remembered scroll position, and a re-render whenever the file
changes on disk. **Settings \u2192 Files** can limit this to non-markdown files or
turn it off. **Settings \u2192 Exclusions** opens .pdf, .html, and .htm in
Chrome's native file page by default. Remove .html or .htm to show source.
` },
    { key: "preview", label: "Preview and Notes", hint: "panel, editor, AI", md: `
## File preview (Quick Look)

Click a file, or select it and press **Space**, to open a preview \u2014 **Space**
again, or **Esc**, closes it. **\u2191 / \u2193** (or **\u2190 / \u2192**) step between previewable
files; the **copy** button copies the raw contents. Files over 8 MB ask before
loading.

The preview is a floating window by default; drag its bottom-right corner to
resize it. The dock button in its header moves it to a **side panel** next to
the listing, where the left edge drags to set the width. Both the choice and
the sizes are remembered.

The file name in the preview header, **open raw**, and every link inside a
rendered markdown file open in a **new tab**, so the explorer stays put.

Renders by type:

| Type | Shown as |
|------|----------|
| Code (\`.sh\`, \`.ts\`, \`.py\`, \`.go\`, \`.rs\`, \`.sql\`, \`.yaml\`, \u2026) | Syntax-highlighted, with line numbers |
| \`.tsv\` / \`.csv\` | Sortable table (numeric columns detected) |
| \`.json\` / \`.jsonl\` | Collapsible tree |
| \`.md\` / \`.mdx\` | Rendered markdown with Mermaid diagrams (relative images/links resolved) |
| Images | Fit-to-view, with pixel dimensions |
| PDF \xB7 audio/video \xB7 fonts | Embedded viewer / player / glyph specimen |
| Plain text & extensionless (\`.txt\`, \`.log\`, \`LICENSE\`, \`Makefile\`) | Plain text with line numbers |

## Notes

The sidebar shows **Notes** even before setup. **Choose folder** picks a local
folder (or type it in **Settings \u2192 Notes**); its \`.md\` files then appear with
pinned notes first. The filter matches titles, tags and the notes' text. **n** or **+** starts an empty note. The panel becomes an
editor with the source on the left and the render on the right: a toolbar for
bold, italic, code, lists, tasks, tables and images; \u2325\u2191\u2193 moves lines and
\u2325\u21E7\u2191\u2193 duplicates them; Tab indents; Enter continues a list; a pasted or
dropped image is saved under \`attachments/\`. **\u2318S** saves immediately; a
1.5-second pause autosaves, and closing the editor starts a pending save.
The name shows an unsaved dot or an error if writing fails. An untitled note
takes its first heading or first text line as its file name on the first save.
If another program changed the file, choose **Reload from disk** or
**Overwrite**. Rename by double-click; \u2715 moves the note into \`.trash/\`.
The tab button on a note row opens a rendered file page in this page's strip;
the editor stays in the preview panel. The folder is plain Markdown that
Obsidian and other Markdown tools can read.

## AI assistant (optional)

If you have the local-models **\`lm\`** CLI and its native host installed, the
preview gains an **AI bar**: **Summarize**, **Explain** (**Describe** for tables),
and an **Ask** box. Answers stream in; closing the overlay cancels them.

Pick the model and toggle **Keep warm** in **Settings \u2192 AI**. It's fully local \u2014
nothing is sent anywhere. Without the CLI installed, the bar simply doesn't
appear and everything else works normally.
` },
    { key: "tabs", label: "Tabs and Saved", hint: "open now, kept for later", md: `
## Tabs

The strip above the toolbar is the working set of this Chrome tab: folders
and files, kept through refresh and navigation, gone when the Chrome tab
closes. Open the same folder again within a day and the strip comes back with
an undo. After a Chrome crash, Chrome's own session restore brings the strip
back with the tab. The place you are in shows as an italic tab until you keep it: press
**t** or double-click it. **w** closes the current tab, **p** pins it (pinned
tabs sit first and have no \u2715), **[** and **]** move between tabs, **1** to
**9** jump. **Shift-T** reopens the last closed tab at its place. Drag to
reorder. **Middle-click** a tab to close it (pinned tabs stay). Hover a tab
for **\u2026**: copy path, save, pin, close, close others.
Navigation is real, so the address bar is always the active tab's location.

## Saved

One list of your folders, files and saved views. A click opens the row as a
strip tab, or switches to the tab that already has it; **\u2325-click** keeps it
in the background. The \u2605 in the path bar saves or unsaves the current
folder; **+** saves it and opens the name for editing.
**Double-click** a label to rename, drag to reorder, \u2715 to remove. Hover a row
and press **#** to type tags (comma separated); tagged rows group under their
first tag, and clicking the coloured dot on a tag heading changes its colour.
The filter box at the top matches label, path and tag; Esc clears it. Old
Bookmarks and My Places entries were merged in.

Tabs are what is open right now; Saved is the long-term list, the way browser
tabs sit above browser bookmarks.

## The sidebar: Places, Notes, History

The thin rail on the left picks what the sidebar shows; \u2191 and \u2193 move between
them when the rail has focus, and the choice is remembered.

- **Places**: where you can go. Home, the folders under it, Applications and Root.
- **Notes**: what you kept. Saved folders and files, saved views, and your notes.
- **History**: what you opened lately, and tabs from Chrome tabs you closed.

Click a list's title to collapse it. Collapse choices survive a reload.
**Settings \u2192 Appearance** can switch History off.
` },
    { key: "how", label: "How it works", hint: "the model, storage, what runs where", md: `
## The model

Four things, three actions, one key each. Learn the three actions once and
every surface behaves the same way.

- **Place** is a folder. It lives in tabs (open now), in Saved (kept), in
  History, and in the sidebar's Places.
- **File** is something inside a folder, shown in the listing and in search
  results.
- **Note** is a file you write here, in the Notes section, which is a Place you
  write in.
- **View** is how a Place is shown: its sort, group, filter and layout.

- **Go** (Enter, or a click) moves to a thing. A Place navigates, a File opens
  natively, a Note opens in the editor, a tab switches.
- **Look** (Space) sees a thing without leaving. A File previews, a Note reads
  in the panel. Space again stops looking.
- **Keep** (\u2605 or **+**, and **t** for the open Place) makes a thing stay. A
  Place joins Saved, the open Place becomes a tab, a Note saves with **\u2318S**.

Tabs are what is open right now; Saved is the long-term list, the way browser
tabs sit above browser bookmarks.

## Where your state lives

Everything is stored on your machine, in the browser, and nothing leaves it.

- **Settings, the Saved list, tags, view, theme and reader sizes** live in
  the extension's own storage (\`chrome.storage.local\`) under \`bfb-\` keys, so
  every folder and tab sees the same values. Older copies in the page's
  localStorage are read once and left in place. Settings and Saved export and import as one
  JSON file in **Settings \u2192 Data**.
- **The tab strip** lives in sessionStorage, so it belongs to one Chrome tab and
  survives refresh and navigation. When a Chrome tab closes, its tabs are kept
  for a day and listed under **History** as "3 tabs: \u2026"; a click adds them to the
  strip you are in. Nothing comes back on its own. **History** also lists the
  files and folders you opened lately.
- **Reading choices** (the column toggle, the ToC, a file page's scroll
  position) live in the same storage, so they persist across reloads.

## What runs where

- The extension replaces Chrome's plain file listing with this UI. No page is
  fetched from a server.
- Reading a file for a preview or a file page goes through the extension's
  background worker, because a page cannot read \`file://\` URLs on its own.
- The terminal button, the notes editor and the AI bar use optional native
  hosts you install once. Without them the terminal button copies a command and
  the AI bar does not appear; notes need their host to write files.

## What you can do

Browse and open in four views with zoom. Preview any file type in a floating or
docked panel, or open a file directly as a rendered page with a table of
contents. Keep folders and files as tabs and as Saved bookmarks with tags.
Write notes in a live editor. Filter by name or regex, search the text inside
files, and search every subfolder. Save a search as a reusable view. Every
action is on the keyboard; press **?** for the full list.
` },
    { key: "reference", label: "Reference", hint: "keys, gestures, how it fits", md: `
Single-letter keys work only when no text field is focused and no dialog is open.
\u2318 / Ctrl and middle clicks reach the browser, except on rows where \u2318 and \u21E7 select.
**Esc** closes the topmost overlay (a menu, then a dialog, then the preview), and
clears the filter box when it has focus.

## Listing keys

| Key | Action |
|-----|--------|
| \u2191 \u2193 | move the selection |
| Enter | open the selection |
| Space | preview the selection (a toast on a folder) |
| Backspace \xB7 \u2318\u2191 | parent folder |
| \u2318A \xB7 \u2318C | select all \xB7 copy the selected paths |
| \u2318F | focus the filter; again falls through to the browser's find |
| ? \xB7 , | open Help \xB7 open Settings |
| n \xB7 r | new note (with a Notes folder) \xB7 raw or rendered (file page) |
| t \xB7 w \xB7 p | keep \xB7 close \xB7 pin the current tab |
| T | reopen the last closed tab |
| [ \xB7 ] \xB7 1-9 | previous \xB7 next \xB7 jump to a tab |

## Listing rows and tiles

A click on a file opens it in the panel with the address unchanged, but only when
the file is previewable and "Click on a file" is set to look (the default). A
non-previewable file, or the go setting, navigates. A folder always navigates.

| Gesture | Action |
|---------|--------|
| double-click | go to the file page |
| \u2325-click | keep as a background tab |
| middle-click | browser tab |
| \u21E7 / \u2318-click \xB7 \u21E7\u2318-click | toggle in the selection \xB7 range |
| right-click | Preview, Copy path, Copy name, Open in terminal |
| hover | a tip, plus a separate eye (preview) and copy buttons |

## Strip tabs

| Gesture | Action |
|---------|--------|
| click | switch (kept or pinned); a temporary tab does nothing |
| double-click | keep a temporary tab |
| middle-click | close a kept tab; pinned and temporary stay |
| \u2318 / \u21E7-click | browser tab or window |
| drag | reorder within the pinned or unpinned block |
| hover \u2026 \xB7 hover \u2715 | menu (copy, save, pin, close, close others) \xB7 close |

## Sidebar

| Gesture | Action |
|---------|--------|
| click | open as a strip tab (or the editor for a note) and go |
| double-click | rename |
| \u2325-click | keep a background tab |
| middle / \u2318-click | browser tab |
| hover # \xB7 hover \u2715 | tags \xB7 remove, or a note to trash |
| drag \xB7 tag dot | reorder \xB7 cycle the colour |

## Path bar and toolbar

\u2261 shows or hides the sidebar, and its right edge drags to resize. A crumb goes;
its chevron button opens a dropdown you can type to narrow. \u2605 saves the place. The terminal
button opens here, and \u21E7-click copies the command. The rest: theme, Help, Settings,
the four views, Sort, Filter, hidden files, and a zoom slider that scales the list.

## Preview panel

| Gesture or key | Action |
|----------------|--------|
| scrim \xB7 \u2715 \xB7 Esc \xB7 Space | close |
| \u2191 \u2193 \u2190 \u2192 | previous, next previewable file |
| open \xB7 Enter | go to the file page |
| + tab \xB7 t | keep as a background strip tab |
| copy | copy the whole file |
| dock \xB7 grips | float or dock to the side \xB7 resize |
| header name \xB7 open raw \xB7 links | new browser tab |

The strip keys still work while the preview is open. A file over 8 MB asks before
loading. With a local model installed, an AI bar adds Summarize, Explain, and Ask.

## Notes editor

\u2318S saves (a pause autosaves). \u2318B, \u2318I, \u2318E are bold, italic, code. \u2325\u2191\u2193 move a line
and \u2325\u21E7\u2191\u2193 duplicate it. Tab and \u21E7Tab indent. Enter continues a list. \u2318Z and \u2318\u21E7Z (or
\u2318Y) undo and redo. The toolbar adds list, task, table, and image, which have no
key. **open** and **+ tab** act on the note.

## File page

**r** toggles raw, a copy button, and ToC links jump. Backspace or \u2318\u2191 go to the
folder, and \u2318F uses the browser's find. Two buttons toggle a table-of-contents
rail and a reading-width control that cycles through full, XL, LG, and MD. The page reloads itself every couple of
seconds and re-renders when the file changes on disk.

## How the parts fit

- The address bar is always the active tab's location; navigation is real.
- A listing click looks or goes by the "Click on a file" setting; a sidebar click
  always goes; \u2325 keeps a background tab in both.
- A file page is the explorer with the file in the main column, so nothing moves.
- The folder you are in is a temporary (italic) tab until you keep it; opening a
  place from the sidebar keeps that folder as a tab so you do not lose it.
- A dialog over the preview takes Esc first, then the preview; focus returns.
- Text size and Interface size scale the whole interface; list zoom changes the
  folder listing separately.

## Good to know

- Many controls are mouse-only: the sort, filter, view, hidden, zoom, theme, and
  terminal controls, the sidebar, and rename have no key, and the context menu is
  right-click only.
- The toast message is always dark, in both themes.
- A saved bookmark to a file whose name contains a # may be read as a search view.
- Dragging reorders tabs and saved rows; it does not move or copy files.
` }
  ];

  // src/find.ts
  var EMPTY_FIND = { scope: "here", name: "", regex: false, exts: [], text: "", caseSensitive: false, textRegex: false, maxDepth: 8 };
  function isEmptyFind(q) {
    return q.scope === "here" && !q.name && !q.exts.length && !q.text;
  }
  var ext = (e) => e.isDir ? "" : e.name.includes(".") ? e.name.split(".").pop().toLowerCase() : "";
  var TEXT_MAX_BYTES = 2 * 1024 * 1024;
  function isTextCandidate(e) {
    if (e.isDir || e.isParent) return false;
    const x = ext(e);
    if (!(CODE_EXTS.has(x) || TABLE_EXTS.has(x) || JSONL_EXTS.has(x) || x === "json")) return false;
    return e.rawBytes < 0 || e.rawBytes <= TEXT_MAX_BYTES;
  }
  function textPatternError(q) {
    if (!q.textRegex || !q.text) return null;
    if (q.text.length > 160) return "Text regex is limited to 160 characters";
    try {
      new RegExp(q.text, q.caseSensitive ? "gu" : "giu");
      return null;
    } catch {
      return "Invalid text regex";
    }
  }
  function scanContent(text, q) {
    if (!q.text) return null;
    const pattern = q.textRegex ? new RegExp(q.text, q.caseSensitive ? "gu" : "giu") : null;
    const needle = q.caseSensitive ? q.text : q.text.toLowerCase();
    let count = 0, first = null;
    let lineStart = 0, lineNumber = 1;
    while (lineStart <= text.length) {
      const breakAt = text.indexOf("\n", lineStart);
      const end = breakAt < 0 ? text.length : breakAt;
      const line2 = text.slice(lineStart, end);
      if (pattern) {
        pattern.lastIndex = 0;
        let match;
        while (match = pattern.exec(line2)) {
          count++;
          if (!first) first = { line: line2, at: match.index, length: match[0].length, number: lineNumber };
          if (!match[0].length) {
            const codePoint = line2.codePointAt(pattern.lastIndex);
            pattern.lastIndex += codePoint !== void 0 && codePoint > 65535 ? 2 : 1;
          }
        }
      } else {
        const hay = q.caseSensitive ? line2 : line2.toLowerCase();
        for (let at = hay.indexOf(needle); at >= 0; at = hay.indexOf(needle, at + Math.max(1, needle.length))) {
          count++;
          if (!first) first = { line: line2, at, length: q.text.length, number: lineNumber };
        }
      }
      if (breakAt < 0) break;
      lineStart = breakAt + 1;
      lineNumber++;
    }
    if (!first) return null;
    const from = Math.max(0, first.at - 60);
    const to = Math.min(first.line.length, from + 180);
    const line = (from ? "\u2026" : "") + first.line.slice(from, to) + (to < first.line.length ? "\u2026" : "");
    const start = first.at - from + (from ? 1 : 0);
    return { count, line, start, end: Math.min(line.length, start + first.length), lineNumber: first.number };
  }
  async function searchContents(files, read, q, onProgress, isCancelled = () => false, concurrency = 4, match = async (text, query) => scanContent(text, query)) {
    const hits = /* @__PURE__ */ new Map();
    let scanned = 0, failed = 0, next = 0;
    const worker = async () => {
      while (next < files.length && !isCancelled()) {
        const f = files[next++];
        try {
          const text = await read(f.href);
          if (isCancelled()) break;
          const hit = await match(text, q);
          if (isCancelled()) break;
          if (hit) hits.set(f.href, hit);
        } catch {
          failed++;
        }
        if (isCancelled()) break;
        scanned++;
        onProgress?.(scanned, files.length);
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, worker));
    return { hits, scanned, failed, cancelled: isCancelled() };
  }
  function findToHash(q) {
    return isEmptyFind(q) ? "" : "#find=" + encodeURIComponent(JSON.stringify(q));
  }
  function findFromHash(hash) {
    const m = hash.match(/^#find=(.+)$/);
    if (!m) return null;
    try {
      const q = JSON.parse(decodeURIComponent(m[1]));
      return { ...EMPTY_FIND, ...q, exts: Array.isArray(q.exts) ? q.exts : [], maxDepth: [1, 2, 4, 8].includes(q.maxDepth) ? q.maxDepth : 8 };
    } catch {
      return null;
    }
  }
  function isViewPath(path) {
    return path.includes("#find=");
  }
  function describeFind(q) {
    const bits = [];
    if (q.name) bits.push(q.regex ? `/${q.name}/` : q.name);
    if (q.exts.length) bits.push("." + q.exts.join(" ."));
    if (q.text) bits.push(q.textRegex ? `/${q.text}/` : `"${q.text}"`);
    const what = bits.join(" ") || "everything";
    return q.scope === "deep" ? `${what} in subfolders` : what;
  }

  // src/render.ts
  function tagChips(e, ctx) {
    if (e.isParent || !ctx.tagsOf) return "";
    return ctx.tagsOf(fullPath(ctx.rawPath, e)).map((t) => `<span class="fe-chip" style="--chip:${esc(t.color)}" title="Tag: ${esc(t.name)}">${esc(t.name)}</span>`).join("");
  }
  function buildTipData(e, ctx) {
    if (e.isParent) {
      return JSON.stringify({ icon: "", name: "Parent Directory", lines: ["Navigate up one level"] });
    }
    const fp = fullPath(ctx.rawPath, e);
    const lines = [`Path: ${fp}`, `Type: ${fmtType(e)}`];
    if (!e.isDir) lines.push(`Size: ${fmtSize(e.rawBytes)}`);
    lines.push(`Modified: ${fmtDate(e.dateMs, ctx.settings, e.dateStr)}`);
    if (e.isHidden) lines.push("Hidden file (dotfile)");
    lines.push(e.isDir ? "Click opens \xB7 \u2325-click keeps a tab \xB7 middle-click: Chrome tab" : "Click looks \xB7 double-click opens \xB7 \u2325-click keeps a tab \xB7 middle-click: Chrome tab");
    const tip = {
      icon: getIcon(e, ctx.iconRules),
      name: e.name,
      lines
    };
    return JSON.stringify(tip);
  }
  function itemActions(e, rawPath) {
    if (e.isParent) return "";
    const dPath = esc(fullPath(rawPath, e)), dName = esc(e.name);
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
  function renderHitSnippet(hit) {
    return `<span class="fe-find-snippet" title="First match on line ${hit.lineNumber}">${esc(hit.line.slice(0, hit.start))}<mark>${esc(hit.line.slice(hit.start, hit.end))}</mark>${esc(hit.line.slice(hit.end))}</span>`;
  }
  function renderRow(e, ctx, idx = -1, hit) {
    const tipData = buildTipData(e, ctx);
    return `<tr class="fe-row${e.isDir ? " dir" : ""}${e.isParent ? " par" : ""}${e.isHidden ? " dotfile" : ""}"
             data-name="${esc(e.name.toLowerCase())}"
             data-idx="${idx}"
             data-tip="${esc(tipData)}">
    <td class="c-nm"><a href="${esc(e.href)}" class="fe-lnk">${getIcon(e, ctx.iconRules)}<span class="fe-nm">${esc(e.isParent ? "Parent Directory" : e.name)}</span></a>${hit ? renderHitSnippet(hit) + `<span class="fe-find-badge">${hit.count}</span>` : ""}${itemActions(e, ctx.rawPath)}</td>
    <td class="c-tp">${fmtType(e)}</td>
    <td class="c-tg">${tagChips(e, ctx)}</td>
    <td class="c-sz">${e.isDir ? "\u2014" : fmtSize(e.rawBytes)}</td>
    <td class="c-dt">${fmtDate(e.dateMs, ctx.settings, e.dateStr)}</td>
    <td class="c-match">${hit ? hit.count : ""}</td>
  </tr>`;
  }
  function renderTile(e, ctx, idx = -1, hit) {
    const tipData = buildTipData(e, ctx);
    const isImg = !e.isDir && !e.isParent && IMG_EXTS.has(getExt(e));
    const iconHtml = isImg ? `<span class="fe-tile-img-wrap"><img class="fe-tile-thumb" src="${esc(e.href)}" loading="lazy" alt="" onerror="this.closest('.fe-tile-img-wrap').classList.add('err')">${getIcon(e, ctx.iconRules)}</span>` : getIcon(e, ctx.iconRules);
    return `<a href="${esc(e.href)}" class="fe-tile${e.isDir ? " dir" : ""}${e.isParent ? " par" : ""}${e.isHidden ? " dotfile" : ""}"
            data-name="${esc(e.name.toLowerCase())}"
            data-idx="${idx}"
            data-tip="${esc(tipData)}">
    <span class="fe-tile-ic">${iconHtml}</span>
    <span class="fe-tile-nm">${esc(e.isParent ? ".." : e.name)}</span>
    ${hit ? `<span class="fe-find-badge">${hit.count}</span>${renderHitSnippet(hit)}` : ""}
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
  function renderSavedList(saved, tags, rawPath, filter = "") {
    if (!saved.length) return `<div class="fe-hint">Nothing saved yet.<br>Click \u2606 in the path bar, or + to name this folder.</div>`;
    saved = filterSaved(saved, filter);
    if (!saved.length) return `<div class="fe-hint">No saved item matches.</div>`;
    const color = (name) => tags.find((t) => t.name === name)?.color ?? "#8b949e";
    const VIEW_ICON = `<svg width="14" height="14" viewBox="0 0 14 14"><path d="M1.5 2h11l-4.2 5v4.5l-2.6-1.3V7z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>`;
    const row = (p) => `
    <div class="fe-bm-item fe-pl-item${isViewPath(p.path) ? " fe-view" : ""}" draggable="true" data-path="${esc(p.path)}">
      <span class="fe-drag-h" title="Drag to reorder">${PI.drag}</span>
      <a href="${isViewPath(p.path) ? "file://" + esc(p.path) : fileHref(p.path)}" class="fe-si-link${p.path === rawPath ? " active" : ""}" title="${esc(isViewPath(p.path) ? "Saved view in " + p.path.split("#")[0] : p.path)}">
        ${isViewPath(p.path) ? VIEW_ICON : PI.folder}<span class="fe-sl fe-pl-label" title="Double-click to rename">${esc(p.label)}</span>
        <span class="fe-pl-dots">${(p.tags ?? []).map((t) => `<i class="fe-sv-mini" style="background:${esc(color(t))}" title="${esc(t)}"></i>`).join("")}</span>
      </a>
      <span class="fe-pl-tags" title="Tags, comma separated"></span>
      <button class="fe-tag-btn" data-path="${esc(p.path)}" title="Tags">#</button>
      <button class="fe-rm-btn" data-path="${esc(p.path)}" title="Remove">\u2715</button>
    </div>`;
    return groupByTag(saved, tags).map((g) => {
      const head = g.tag ? `<div class="fe-sv-tag"><i class="fe-sv-dot" data-tag="${esc(g.tag.name)}" style="background:${esc(g.tag.color)}" title="Click to change colour"></i>${esc(g.tag.name)}</div>` : "";
      return head + g.items.map(row).join("");
    }).join("");
  }
  function renderCrumbs(rawPath, segments) {
    const crumbs = [{ label: "/", href: "file:///" }];
    let acc = "/";
    for (const seg of segments) {
      acc += seg + "/";
      crumbs.push({ label: seg, href: fileHref(acc) });
    }
    return crumbs.map(
      (c, i) => `<a href="${esc(c.href)}" class="fe-crumb" title="Go to ${esc(decodeURIComponent(c.href.slice(7)))}">${esc(c.label)}</a><button class="fe-crumb-dd" data-url="${esc(c.href)}" title="Browse ${esc(c.href)}">${CHEVRON_DOWN}</button>` + (i < crumbs.length - 1 ? `<span class="fe-sep">\u203A</span>` : "")
    ).join("");
  }

  // src/page.ts
  function renderPage(p) {
    const { initTheme, initView, initZoom, initHidden, fileMode, rawPath, folderPath, fileName, segments, settings, curIsBookmarked, dirs, files, extOpts, recentsHTML } = p;
    const ALL_ENTRIES = p.entries;
    const ctx0 = p.ctx;
    const VIEW_MODES = [
      { id: "details", label: "Details", ico: `<svg width="13" height="11" viewBox="0 0 13 11"><path d="M1 1h11M1 4h11M1 7h11M1 10h7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>` },
      { id: "list", label: "List", ico: `<svg width="13" height="11" viewBox="0 0 13 11"><circle cx="2" cy="2" r="1.1" fill="currentColor"/><path d="M5 2h7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="2" cy="5.5" r="1.1" fill="currentColor"/><path d="M5 5.5h7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="2" cy="9" r="1.1" fill="currentColor"/><path d="M5 9h7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>` },
      { id: "tree", label: "Tree", ico: `<svg width="13" height="13" viewBox="0 0 13 13"><path d="M2 1.5v8h3M2 5.5h3M6 4.5h6M6 9.5h6" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="5.5" cy="4.5" r=".8" fill="currentColor"/><circle cx="5.5" cy="9.5" r=".8" fill="currentColor"/></svg>` },
      { id: "tiles", label: "Tiles", ico: `<svg width="13" height="13" viewBox="0 0 13 13"><rect x="1" y="1" width="4.5" height="4.5" rx=".8" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="7.5" y="1" width="4.5" height="4.5" rx=".8" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="1" y="7.5" width="4.5" height="4.5" rx=".8" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="7.5" y="7.5" width="4.5" height="4.5" rx=".8" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>` },
      { id: "icons", label: "Large Icons", ico: `<svg width="13" height="13" viewBox="0 0 13 13"><rect x="1" y="1" width="5" height="5" rx="1" fill="currentColor" opacity=".6"/><rect x="7" y="1" width="5" height="5" rx="1" fill="currentColor" opacity=".6"/><rect x="1" y="7" width="5" height="5" rx="1" fill="currentColor" opacity=".6"/><rect x="7" y="7" width="5" height="5" rx="1" fill="currentColor" opacity=".6"/></svg>` }
    ];
    const VIEW_LABELS = {
      details: "Full table \u2014 Name, Type, Size, Modified",
      list: "Compact single-column rows",
      tree: "Expand folders without leaving this page",
      tiles: "Medium icon grid with filename below",
      icons: "Large icon grid"
    };
    const viewBtnsHTML = VIEW_MODES.map(
      (v) => `<button class="fe-view-btn" data-icon data-view="${v.id}" title="${v.label} view \u2014 ${VIEW_LABELS[v.id]}${v.id === initView ? " (active)" : ""}">${v.ico}</button>`
    ).join("");
    const home = homeDir(rawPath);
    const PLACES = [
      ...home ? [
        { label: "Home", icon: "home", sub: "" },
        { label: "Desktop", icon: "desk", sub: "Desktop/" },
        { label: "Documents", icon: "docs", sub: "Documents/" },
        { label: "Downloads", icon: "down", sub: "Downloads/" },
        { label: "Pictures", icon: "pics", sub: "Pictures/" },
        { label: "Screenshots", icon: "scrnsh", sub: "Pictures/Screenshots/" },
        { label: "Code", icon: "code", sub: "Code/" },
        { label: "Versable", icon: "folder", sub: "Code/Versable/" },
        { label: "enhancement-product", icon: "folder", sub: "Code/Versable/enhancement-product/" },
        { label: "resumes", icon: "docs", sub: "Code/Claude/resumes/" }
      ].map((p2) => ({ label: p2.label, icon: p2.icon, href: fileHref(home + "/" + p2.sub) })) : [],
      { label: "Applications", icon: "apps", href: "file:///Applications/" },
      { label: "Root /", icon: "root", href: "file:///" }
    ];
    const lensHead = (title, sub, actions = "") => `<div class="fe-lens-h"><span class="fe-lens-t"><b>${title}</b><i>${sub}</i></span>${actions}</div>`;
    const railBtn = (lens, label, icon2, hint, hidden = false) => `<button type="button" class="fe-rail-btn" role="tab" data-lens="${lens}" id="fe-rail-${lens}" aria-controls="fe-lens-${lens}" title="${hint}"${hidden ? " hidden" : ""}>${icon2}<em>${label}</em></button>`;
    const SETTINGS_DIALOG = {
      id: "fe-settings-modal",
      mark: PI.gear,
      title: "Settings",
      subtitle: "Stored in this browser profile",
      tabs: [
        { key: "appearance", label: "Appearance", hint: "Theme and layout", icon: UI_ICON.appearance, body: `
        <div class="fe-st-section">
          <div class="fe-st-title">Theme</div>
          <div class="fe-st-row">
            <label class="fe-st-radio"><input type="radio" name="bfb-theme" value="dark" title="Dark theme"> Dark</label>
            <label class="fe-st-radio"><input type="radio" name="bfb-theme" value="light" title="Light theme"> Light</label>
          </div>
        </div>
        <div class="fe-st-section">
          <div class="fe-st-title">Appearance</div>
          <div class="fe-st-row">
            <span class="fe-st-lbl">Default view</span>
            <select id="fe-st-defview" class="fe-st-select" title="View a folder opens in">
              <option value="details">Details</option>
              <option value="list">List</option>
              <option value="tree">Tree</option>
              <option value="tiles">Tiles</option>
              <option value="icons">Large Icons</option>
            </select>
          </div>
          <div class="fe-st-row">
            <span class="fe-st-lbl">Sort</span>
            <select id="fe-st-sort" class="fe-st-select" title="Order every folder opens in; the Sort panel and column headers change it too">
              <option value="">As listed</option>
              <option value="name">Name</option>
              <option value="date">Modified</option>
              <option value="size">Size</option>
              <option value="type">Type</option>
              <option value="ext">Extension</option>
            </select>
            <select id="fe-st-sort-dir" class="fe-st-select" title="Direction">
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </div>
          <div class="fe-st-row">
            <span class="fe-st-lbl">Group</span>
            <select id="fe-st-group" class="fe-st-select" title="Grouping every folder opens with">
              <option value="none">None</option>
              <option value="folders-first">Folders first</option>
              <option value="files-first">Files first</option>
              <option value="ext">By extension</option>
              <option value="type">By type</option>
            </select>
          </div>
          <div class="fe-st-row">
            <span class="fe-st-lbl">Interface size</span>
            <select id="fe-st-uiscale" class="fe-st-select" title="Scale the whole interface, sidebar and text included">
              <option value="90">90%</option>
              <option value="100">100%</option>
              <option value="110">110%</option>
              <option value="125">125%</option>
              <option value="150">150%</option>
            </select>
          </div>
          <div class="fe-st-row">
            <label class="fe-st-lbl" for="fe-st-rd-size">Text size</label>
            <select id="fe-st-rd-size" class="fe-st-select" title="Text size throughout the app">${[13, 14, 15, 16, 17].map((n) => `<option value="${n}">${n} px</option>`).join("")}</select>
          </div>
          <div class="fe-st-row">
            <label class="fe-st-check"><input type="checkbox" id="fe-st-compact" title="Tighter rows and tiles"> Compact mode</label>
          </div>
          <div class="fe-st-row">
            <label class="fe-st-check"><input type="checkbox" id="fe-st-sidebar" title="Places, Notes and History on the left"> Show sidebar</label>
            <label class="fe-st-check"><input type="checkbox" id="fe-st-sec-recent" title="Folders and files you opened lately, and closed tabs"> History</label>
          </div>
          <div class="fe-st-row">
            <label class="fe-st-check"><input type="checkbox" id="fe-st-tooltips" title="Native tooltips on every control"> Tooltips</label>
            <button id="fe-st-keys" class="fe-pbn" title="Open Help on the Keyboard tab">${UI_ICON.keyboard}Keyboard shortcuts</button>
          </div>
          <div class="fe-st-row">
            <span class="fe-st-lbl">Date format</span>
            <select id="fe-st-datefmt" class="fe-st-select" title="How the Modified column reads">
              <option value="short">Short \u2014 Apr 17</option>
              <option value="full">Full \u2014 April 17, 2025</option>
            </select>
          </div>
        </div>
` },
        { key: "preview", label: "Preview", hint: "Panel and tabs", icon: UI_ICON.preview, body: `
        <div class="fe-st-section">
          <div class="fe-st-title">Panel</div>
          <div class="fe-st-row">
            <span class="fe-st-lbl">Placement</span>
            <select id="fe-st-panel" class="fe-st-select" title="Where the preview opens">
              <option value="modal">Floating window</option>
              <option value="side">Docked to the side</option>
            </select>
            <button id="fe-st-panel-reset" class="fe-pbn" title="Forget the dragged sizes">${UI_ICON.reset}Reset sizes</button>
          </div>
          <div class="fe-st-row">
            <span class="fe-st-lbl">Click on a file</span>
            <select id="fe-st-click" class="fe-st-select" title="What a plain click on a file does">
              <option value="look">Look: open the panel</option>
              <option value="go">Go: open its page</option>
            </select>
          </div>
        </div>
        <div class="fe-st-section">
          <div class="fe-st-title">Tabs</div>
          <div class="fe-st-row">
          </div>
        </div>` },
        { key: "files", label: "Files", hint: "Reader and icons", icon: UI_ICON.files, body: `
        <div class="fe-st-section">
          <div class="fe-st-title">Reader</div>
          <div class="fe-st-row">
            <label class="fe-st-lbl" for="fe-st-rd-column">Reading width</label>
            <select id="fe-st-rd-column" class="fe-st-select" title="Starting width for Markdown file pages">
              <option value="unset">Full width</option><option value="xl">XL width \xB7 150ch</option><option value="lg">LG width \xB7 130ch</option><option value="md">MD width \xB7 110ch</option>
            </select>
          </div>
          <div class="fe-st-row">
            <span class="fe-st-lbl">Line height</span>
            <select id="fe-st-rd-lh" class="fe-st-select" title="Line height on file pages">${["1.5", "1.65", "1.8"].map((n) => `<option value="${n}">${n}</option>`).join("")}</select>
            <span class="fe-st-lbl">Code size</span>
            <select id="fe-st-rd-code" class="fe-st-select" title="Code size on file pages">${[12, 13, 14].map((n) => `<option value="${n}">${n} px</option>`).join("")}</select>
          </div>
        </div>
        <div class="fe-st-section">
          <div class="fe-st-title">File pages</div>
          <div class="fe-st-row">
            <span class="fe-st-lbl" title="A file opened directly in the tab renders like the preview">Render file pages</span>
            <select id="fe-st-filepages" class="fe-st-select" title="Which files opened directly get the rendered page">
              <option value="all">All text files</option>
              <option value="not-md">All except markdown</option>
              <option value="off">Off (Chrome's plain text)</option>
            </select>
          </div>
        </div>
        <div class="fe-st-section">
          <div class="fe-st-title" style="display:flex;align-items:center;justify-content:space-between">
            <span>Custom Icon Rules</span>
            <button id="fe-st-add-rule" class="fe-pbn" title="Add an icon rule">${UI_ICON.add}Add rule</button>
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
          <button id="fe-st-reset-rules" class="fe-pbn" style="margin-top:8px;align-self:flex-start;color:#f85149;border-color:#f8514940" title="Replace every rule with the built-in set">${UI_ICON.reset}Reset to defaults</button>
        </div>
` },
        { key: "exclusions", label: "Exclusions", hint: "Native pages", icon: UI_ICON.exclusions, body: `
        <div class="fe-st-section">
          <div class="fe-st-title">Open with Chrome</div>
          <div class="fe-st-hint">These extensions keep their native file page when opened. The preview panel still works.</div>
          <div class="fe-st-row">
            <label class="fe-st-lbl" for="fe-st-excluded-exts">File extensions</label>
            <input id="fe-st-excluded-exts" class="fe-st-input" type="text" placeholder=".pdf, .html, .htm" spellcheck="false" title="Extensions Chrome opens natively, separated by commas or spaces">
            <button id="fe-st-excluded-reset" class="fe-pbn" title="Restore the default excluded extensions">${UI_ICON.reset}Restore defaults</button>
          </div>
          <div class="fe-st-hint">Changes apply when a file is opened next. PDF stays native even if removed here, because it has no text renderer.</div>
        </div>
` },
        { key: "notes", label: "Notes", hint: "Notes folder", icon: UI_ICON.notes, body: `
        <div class="fe-st-section">
          <div class="fe-st-title">Notes</div>
          <div class="fe-st-row">
            <span class="fe-st-lbl" title="A folder of .md files. See docs/notes-contract.md">Notes folder</span>
            <input type="text" id="fe-st-notes-root" class="fe-st-input" placeholder="/Users/you/Notes" spellcheck="false" title="Absolute path of the notes folder">
            <button id="fe-st-notes-pick" class="fe-pbn" title="Pick the notes folder in the system chooser">${UI_ICON.folderOpen}<span>Choose</span></button>
          </div>
          <div class="fe-st-hint" id="fe-st-notes-hint" style="color:var(--dm);margin-top:-4px"></div>
        </div>
        <div class="fe-st-section">
          <div class="fe-st-title">Editing</div>
          <div class="fe-st-row">
            <span class="fe-st-lbl" title="Text files inside these folders show an Edit button (e) on their page">Editable folders</span>
            <input type="text" id="fe-st-edit-roots" class="fe-st-input" placeholder="~/Code, ~/Documents/notes" spellcheck="false" title="Comma-separated absolute folders; ~ means home">
          </div>
          <div class="fe-st-hint" style="color:var(--dm);margin-top:-4px">Every save keeps the previous text for 14 days in ~/Library/Application Support/BetterFileBrowser/backups.</div>
        </div>
` },
        { key: "terminal", label: "Terminal", hint: "Open with", icon: UI_ICON.terminal, body: `
        <div class="fe-st-section">
          <div class="fe-st-title">Terminal</div>
          <div class="fe-st-row">
            <span class="fe-st-lbl" title="Which terminal app to open when clicking the terminal button">Open with</span>
            <select id="fe-st-terminal" class="fe-st-select" title="Terminal app to open current folder in">
              <option value="ghostty">Ghostty</option>
              <option value="terminal">Terminal.app</option>
              <option value="iterm">iTerm2</option>
              <option value="wezterm">WezTerm</option>
              <option value="kitty">Kitty</option>
              <option value="custom">Custom command (copied, not run)</option>
            </select>
          </div>
          <div class="fe-st-row" id="fe-st-term-custom-row" style="display:none">
            <input type="text" id="fe-st-term-custom" class="fe-st-input" placeholder='open -a MyTerm "\${p}"' title='Shell command template. Use \${p} as placeholder for the folder path.'>
          </div>
          <div class="fe-st-hint" id="fe-st-term-hint" style="color:var(--dm);margin-top:-4px"></div>
        </div>
` },
        { key: "data", label: "Data", hint: "Export and import", icon: UI_ICON.data, body: `
        <div class="fe-st-section">
          <div class="fe-st-title">Settings and Saved list</div>
          <div class="fe-st-row">
            <button id="fe-st-export" class="fe-pbn" title="Copy everything this extension stores as JSON">${UI_ICON.export}Export</button>
            <button id="fe-st-import" class="fe-pbn" title="Load a JSON export and reload">${UI_ICON.import}Import</button>
            <input type="file" id="fe-st-import-file" accept="application/json" style="display:none" title="The JSON export to load">
          </div>
          <textarea id="fe-st-export-out" class="fe-st-input" style="display:none;width:100%;height:120px;font:11px 'SF Mono',Menlo,monospace" spellcheck="false" title="The export, also on the clipboard"></textarea>
        </div>` },
        { key: "ai", label: "AI", hint: "Local model", icon: UI_ICON.ai, body: `
        <div class="fe-st-section">
          <div class="fe-st-title" style="display:flex;align-items:center;justify-content:space-between">
            <span>Local Model (AI)</span>
            <button id="fe-st-ai-refresh" class="fe-pbn" title="Re-check the lm server status">${UI_ICON.reset}Refresh</button>
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
` }
      ]
    };
    const HELP_DIALOG = {
      id: "fe-help-modal",
      mark: PI.help,
      title: "Help",
      subtitle: "Better File Browser \xB7 everything runs on your machine",
      tabs: HELP_TABS.map((t) => ({ key: t.key, label: t.label, hint: t.hint, body: `<div class="fe-md">${renderMarkdown(t.md)}</div>` }))
    };
    const PAGE_HTML = `
<div id="fe" data-theme="${initTheme}" data-view="${initView}"${fileMode ? ' class="fe-file-page"' : ""}>

  <div id="fe-bar">
    <button id="fe-side-toggle" data-icon title="Show or hide the sidebar"><svg width="15" height="15" viewBox="0 0 15 15"><path d="M2 4h11M2 7.5h11M2 11h11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg></button>
    <div id="fe-bc">${renderCrumbs(folderPath, segments)}${fileMode ? `<span class="fe-sep">\u203A</span><span class="fe-crumb fe-crumb-file">${esc(fileName)}</span>` : ""}</div>
    <button id="fe-term-btn" data-icon title="Open in terminal (${settings.terminalApp || "ghostty"}), click opens the current folder, shift-click copies the command"><svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="1" width="12" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M3.5 5l3 2-3 2M8 9h3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    <button id="fe-bm-btn" data-icon class="${curIsBookmarked ? "on" : ""}" title="${curIsBookmarked ? `Remove this ${fileMode ? "file" : "folder"} from Saved` : `Save this ${fileMode ? "file" : "folder"} (sidebar)`}">
      <svg width="13" height="13" viewBox="0 0 13 13"><path id="fe-bm-path" d="M2.5 1h8v11l-4-2.8L2.5 12z" fill="${curIsBookmarked ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
    </button>
    <button id="fe-theme-btn" data-icon title="Toggle theme \u2014 currently ${initTheme === "light" ? "Light" : "Dark"}">
      <svg id="fe-sun" width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="2.8" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.9 2.9l1 1M10.1 10.1l1 1M10.1 2.9l-1 1M3.9 10.1l-1 1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
      <svg id="fe-moon" width="14" height="14" viewBox="0 0 14 14"><path d="M11.5 8.5A5 5 0 0 1 5.5 2.5a5 5 0 1 0 6 6z" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>
    </button>
    <button id="fe-help-btn" data-icon title="Help (press ?), what's here and how to use it">
      <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M5.2 5.2a1.9 1.9 0 1 1 2.6 1.8c-.6.3-.8.6-.8 1.2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="7" cy="10.3" r="0.9" fill="currentColor"/></svg>
    </button>
    <button id="fe-settings-btn" data-icon title="Settings (press ,), theme, views, terminal, icon rules">
      <svg width="14" height="14" viewBox="0 0 14 14"><path d="M8.5 1H5.5L4.5 2.8 2.5 4 1 5.5v3L2.5 10l2 1.2L5.5 13h3l1-1.8 2-1.2L13 8.5v-3L11.5 4l-2-1.2z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><circle cx="7" cy="7" r="2" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>
    </button>
  </div>

  <div id="fe-body">
    <nav id="fe-side">
      <div id="fe-rail" role="tablist" aria-label="Sidebar" aria-orientation="vertical">
        ${railBtn("places", "Places", PI.home, "Places: Home, your folders, Applications and Root")}
        ${railBtn("notes", "Notes", PI.docs, "Notes: saved places, saved views and your notes")}
        ${railBtn("history", "History", PI.recent, "History: folders and files you opened lately, and closed tabs", !!settings.hideRecent)}
      </div>
      <div id="fe-lenses">
      <div class="fe-lens" id="fe-lens-places" data-lens="places" role="tabpanel" aria-labelledby="fe-rail-places" hidden>
        ${lensHead("Places", "Where you can go")}
        <div class="fe-sec" data-sec="places">
        ${PLACES.map(
      (p2) => `<a href="${p2.href}" class="fe-si${p2.href.replace(/\/$/, "") === "file://" + rawPath.replace(/\/$/, "") ? " active" : ""}" title="${esc(p2.label)}
${esc(p2.href)}">${PI[p2.icon] ?? PI.folder}<span class="fe-sl">${esc(p2.label)}</span></a>`
    ).join("")}
        </div>
      </div>
      <div class="fe-lens" id="fe-lens-notes" data-lens="notes" role="tabpanel" aria-labelledby="fe-rail-notes" hidden>
      ${lensHead("Notes", "Saved places, views and notes")}
      <div class="fe-sec" data-collapse="saved">
        <div class="fe-sh" style="justify-content:space-between"><span class="fe-sh-label">Saved</span>
          <button id="fe-sv-add" title="Save this ${fileMode ? "file" : "folder"} and name it">+</button></div>
        <input id="fe-sv-filter" type="text" placeholder="Filter saved" spellcheck="false" autocomplete="off" title="Matches label, path and tag">
        <div id="fe-sv-list">${renderSavedList(getSaved(), getTags(), rawPath)}</div>
      </div>
      <div class="fe-sec" id="fe-notes-sec" data-collapse="notes">
        <div class="fe-sh" style="justify-content:space-between"><span class="fe-sh-label">Notes</span><a id="fe-notes-root" title="Open the notes folder" aria-label="Open the notes folder">${PI.folder}</a>
          <button id="fe-nt-add" title="New note (n)">+</button></div>
        <input id="fe-nt-filter" type="text" placeholder="Filter notes" spellcheck="false" autocomplete="off" title="Matches title, file name, colour and tag. #work matches tags only." style="display:none">
        <div id="fe-nt-list"></div>
      </div>
      </div>
      <div class="fe-lens" id="fe-lens-history" data-lens="history" role="tabpanel" aria-labelledby="fe-rail-history" hidden>
        ${lensHead("History", "Recent folders, files and closed tabs")}
        ${recentsHTML}
      </div>
      </div>
    </nav>
    <div id="fe-side-rz" title="Drag to resize the sidebar"></div>

    <div id="fe-main">
      <div id="fe-tabs" title="Tabs of this Chrome tab (t keeps this one, w closes, p pins, [ ] switch, 1-9 jump)"></div>
      ${fileMode ? renderFileContent() : ""}
      <div id="fe-toolbar">
        <span id="fe-count">${fileMode ? "" : `${dirs} folder${dirs !== 1 ? "s" : ""}, ${files} file${files !== 1 ? "s" : ""}`}</span>
        <div id="fe-tb-right">
          <button id="fe-sg-btn" title="Sort &amp; Group \u2014 Click to toggle sort/group panel">
            <svg width="13" height="12" viewBox="0 0 13 12"><path d="M1 2h11M2 5h9M3.5 8h6M5.5 11h3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
            Sort
          </button>
          <button id="fe-filter-btn" data-icon title="Filter \u2014 Filter by filename pattern or file type">
            <svg width="13" height="12" viewBox="0 0 13 12"><path d="M1 2h11l-4.5 5v4l-2-1V7z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
          </button>
          <button id="fe-hidden-btn" data-icon class="${initHidden ? "on" : ""}" title="Hidden files: ${initHidden ? "showing" : "hiding"} dotfiles \xB7 click to toggle">
            <svg width="13" height="13" viewBox="0 0 13 13"><path d="M1 6.5C2.5 3 4.8 1.5 6.5 1.5S10.5 3 12 6.5C10.5 10 8.2 11.5 6.5 11.5S2.5 10 1 6.5z" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="6.5" cy="6.5" r="2" fill="${initHidden ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.3"/></svg>
          </button>
          <div id="fe-zoom-wrap" title="Zoom: ${initZoom}% \xB7 drag to scale the list (50 to 320%)">
            <svg width="11" height="11" viewBox="0 0 11 11"><circle cx="4.5" cy="4.5" r="3.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M7.5 7.5L10 10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
            <input type="range" id="fe-zoom" min="50" max="320" value="${initZoom}" step="5" title="Zoom: ${initZoom}% \xB7 drag to scale">
            <span id="fe-zoom-val">${initZoom}%</span>
          </div>
          <div id="fe-view-group">${viewBtnsHTML}</div>
          <button id="fe-deep-btn" data-icon title="Deep search: include every subfolder in the filter">
            <svg width="13" height="13" viewBox="0 0 13 13"><path d="M1 2.5h4l1 1.2h6v7H1z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M3.5 6h3l.8 1h2.7v2.5H3.5z" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/></svg>
          </button>
          <input id="fe-search" type="text" placeholder="Filter" autocomplete="off" spellcheck="false" title="Quick filter \u2014 Type to filter files by name in any view"/>
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
          <input id="fe-filter-q" type="text" placeholder="Pattern" autocomplete="off" spellcheck="false" title="Filter by name \u2014 supports plain text or regex (enable .* button)"/>
          <button id="fe-regex-btn" class="fe-pbn" title="Toggle regex mode \u2014 when active, pattern is treated as a regular expression">.*</button>
          <span class="fe-panel-lbl" style="margin-left:12px">Type</span>
          <select id="fe-type-filter" title="Filter by file type \u2014 show only folders, files, or a specific extension">
            <option value="all">All types</option>
            <option value="folders">Folders only</option>
            <option value="files">Files only</option>
            ${extOpts}
          </select>
        </div>
        <div class="fe-panel-row">
          <span class="fe-panel-lbl">Text inside files</span>
          <input id="fe-find-text" type="text" placeholder="Words to look for" autocomplete="off" spellcheck="false" title="Reads text files (up to 2 MB each) in this folder, or every subfolder when deep search is on. Enter runs."/>
          <label class="fe-st-check" title="Use a regular expression for text inside files (advanced)"><input type="checkbox" id="fe-find-text-regex" title="Text regex"> Text regex</label>
          <label class="fe-st-check" title="Match case"><input type="checkbox" id="fe-find-case" title="Match case"> Aa</label>
          <label id="fe-find-depth-wrap" class="fe-st-check" style="display:none" title="Maximum subfolder depth to scan">Depth
            <select id="fe-find-depth" title="Maximum subfolder depth"><option value="1">1</option><option value="2">2</option><option value="4">4</option><option value="8" selected>8</option></select>
          </label>
          <button id="fe-find-run" class="fe-pbn" title="Run the text search (Enter)">Run</button>
          <button id="fe-find-cancel" class="fe-pbn" style="display:none" title="Stop scanning">Cancel</button>
          <span id="fe-find-status"></span>
          <span id="fe-find-error" role="alert"></span>
          <button id="fe-find-save" class="fe-pbn" style="margin-left:auto" title="Keep this search as a Saved view: this folder plus these fields">\u2606 Save view</button>
        </div>
      </div>

      <div id="fe-scroll" style="zoom:${initZoom / 100}">
        <table id="fe-table">
          <thead>
            <tr>
              <th class="c-nm" data-ck="nm" data-sort="name" title="Sort by name \xB7 again flips \xB7 drag the edge to resize">Name <span class="si">\u2195</span><span class="fe-col-rz" title="Drag to resize this column"></span></th>
              <th class="c-tp" data-ck="tp" title="Type \xB7 drag the edge to resize">Type<span class="fe-col-rz" title="Drag to resize this column"></span></th>
              <th class="c-tg" data-ck="tg" title="Tags of saved files and folders \xB7 drag the edge to resize">Tags<span class="fe-col-rz" title="Drag to resize this column"></span></th>
              <th class="c-sz" data-ck="sz" data-sort="size" title="Sort by size \xB7 again flips">Size <span class="si">\u2195</span><span class="fe-col-rz" title="Drag to resize this column"></span></th>
              <th class="c-dt" data-ck="dt" data-sort="date" title="Sort by modified date \xB7 again flips">Modified <span class="si">\u2195</span></th>
              <th class="c-match" title="Number of content matches">Matches</th>
            </tr>
          </thead>
          <tbody id="fe-tbody">${renderRows(ALL_ENTRIES, ctx0)}</tbody>
        </table>
        <div id="fe-tiles">${renderTiles(ALL_ENTRIES, ctx0)}</div>
        <div id="fe-tree"></div>
      </div>

      <div id="fe-statusbar">
        ${fileMode ? '<span id="fe-status-meta"></span>' : ""}
        <span id="fe-status-text">${fileMode ? "" : `${dirs} folder${dirs !== 1 ? "s" : ""}, ${files} file${files !== 1 ? "s" : ""}`}</span>
        <span class="fe-status-grow"></span>
        ${fileMode ? '<span id="fe-fp-reload" title="Re-rendered when the file changes on disk"><span class="fe-live-dot"></span>live</span>' : ""}
        <button type="button" id="fe-status-path" title="Click to copy the path"><bdi>${esc(rawPath)}</bdi></button>
      </div>
    </div>
  </div>

  <div id="fe-crumb-menu"></div>
  <div id="fe-tip"></div>
  <div id="fe-toast"></div>

  ${renderDialog(SETTINGS_DIALOG)}
  ${renderDialog(HELP_DIALOG)}
</div>`;
    return PAGE_HTML;
  }

  // src/el.ts
  function el(id) {
    return document.getElementById(id);
  }
  function els(selector, root = document) {
    return [...root.querySelectorAll(selector)];
  }

  // src/chrome.ts
  function initChrome(app) {
    const { fe, settings, toast } = app;
    el("fe-status-path").addEventListener("click", () => {
      void copyToClipboard(app.rawPath).then((ok) => toast(ok ? "Copied the path" : "Copy failed"));
    });
    el("fe-theme-btn").addEventListener("click", () => {
      const next = fe.dataset.theme === "dark" ? "light" : "dark";
      fe.dataset.theme = next;
      kvSet(THEME_KEY, next);
    });
    function getTermCmd(path) {
      const term = settings.terminalApp || "ghostty";
      const tpl = term === "custom" ? settings.terminalCmd || 'cd "${p}"' : TERMINAL_CMDS[term] || TERMINAL_CMDS.ghostty;
      return tpl.replace(/\$\{p\}/g, path);
    }
    function fallbackCopy(path) {
      const cmd = getTermCmd(path);
      navigator.clipboard.writeText(cmd).catch(() => {
      });
      toast(`Copied: ${cmd}`);
    }
    app.openInTerminal = (path) => {
      const term = settings.terminalApp || "ghostty";
      if (term !== "custom") {
        chrome.runtime.sendMessage(
          { type: "bfb-native-oneshot", host: "com.better_file_browser.ghostty", payload: { action: "open_terminal", path, app: term } },
          (res) => {
            if (chrome.runtime.lastError || !res?.ok) fallbackCopy(path);
          }
        );
        return;
      }
      fallbackCopy(path);
    };
    el("fe-term-btn").addEventListener("click", (e) => {
      if (e.shiftKey) fallbackCopy(app.folderPath);
      else app.openInTerminal(app.folderPath);
    });
    const crumbMenu = el("fe-crumb-menu");
    let crumbMenuUrl = null;
    function closeCrumbMenu() {
      crumbMenu.style.display = "none";
      crumbMenuUrl = null;
    }
    el("fe-bc").addEventListener("click", async (e) => {
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
        crumbMenu.innerHTML = `<div class="fe-dd-search-wrap"><input class="fe-dd-search" type="text" placeholder="Filter" autocomplete="off" spellcheck="false" title="Type to narrow \xB7 Enter opens the first match \xB7 Esc closes"></div><div class="fe-dd-items">${entries.map(
          (en) => `<a href="${esc(en.href)}" class="fe-dd-item${en.isDir ? " dir" : ""}" data-name="${esc(en.name.toLowerCase())}" title="${esc(decodeURIComponent(en.href.slice(7)))}">${getIcon(en, app.iconRules)}<span>${esc(en.name)}</span></a>`
        ).join("")}</div>`;
        const ddSearch = crumbMenu.querySelector(".fe-dd-search");
        ddSearch.focus();
        ddSearch.addEventListener("input", () => {
          const q = ddSearch.value.toLowerCase();
          crumbMenu.querySelectorAll(".fe-dd-item").forEach((it) => {
            it.style.display = !q || it.dataset.name.includes(q) ? "" : "none";
          });
        });
        ddSearch.addEventListener("keydown", (ke) => {
          if (ke.key === "Escape") {
            ke.stopPropagation();
            closeCrumbMenu();
          } else if (ke.key === "Enter") {
            const first = [...crumbMenu.querySelectorAll(".fe-dd-item")].find((it) => it.style.display !== "none");
            if (first) location.href = pageHref(first.href);
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
    const side = el("fe-side");
    const rz = el("fe-side-rz");
    el("fe-side-toggle").addEventListener("click", () => {
      settings.showSidebar = !settings.showSidebar;
      saveSettings(settings);
      side.style.display = rz.style.display = settings.showSidebar ? "" : "none";
      const box = document.getElementById("fe-st-sidebar");
      if (box) box.checked = settings.showSidebar;
    });
    rz.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      rz.classList.add("drag");
      const startX = e.clientX;
      const startW = side.getBoundingClientRect().width;
      const move = (m) => {
        side.style.width = Math.max(210, Math.min(520, startW + m.clientX - startX)) + "px";
      };
      const up = () => {
        rz.classList.remove("drag");
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        settings.sidebarWidth = Math.round(side.getBoundingClientRect().width);
        settings.sidebarRail = true;
        saveSettings(settings);
      };
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
    });
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
  function applyFilter(entries, config, regexMatches = /* @__PURE__ */ new Set()) {
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
          if (!regexMatches.has(e.href)) return false;
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

  // src/deep-search.ts
  var DEFAULT_SKIP_DIRS = /* @__PURE__ */ new Set(["node_modules", ".git", ".svn", ".hg", "__pycache__", ".venv", "venv"]);
  var CONCURRENCY = 4;
  function relativeName(href, rootUrl) {
    const rel = href.startsWith(rootUrl) ? href.slice(rootUrl.length) : href;
    let out;
    try {
      out = decodeURIComponent(rel);
    } catch {
      out = rel;
    }
    return out.replace(/\/$/, "");
  }
  async function crawl(rootUrl, listDir, opts = {}, isCancelled = () => false) {
    const maxDepth = opts.maxDepth ?? 8;
    const maxEntries = opts.maxEntries ?? 5e3;
    const skip = opts.skipDirs ?? DEFAULT_SKIP_DIRS;
    const entries = [];
    let folders = 0, truncated = false;
    let queue = [{ url: rootUrl, depth: 0 }];
    while (queue.length && !isCancelled() && entries.length < maxEntries) {
      const batch = queue.splice(0, CONCURRENCY);
      const listed = await Promise.all(batch.map(async (b) => {
        try {
          return { b, kids: await listDir(b.url) };
        } catch {
          return { b, kids: [] };
        }
      }));
      for (const { b, kids } of listed) {
        folders++;
        for (const k of kids) {
          if (k.isParent) continue;
          if (entries.length >= maxEntries) {
            truncated = true;
            break;
          }
          const name = relativeName(k.href, rootUrl);
          const hiddenSeg = name.split("/").some((s) => s.startsWith("."));
          entries.push({ ...k, name, isHidden: hiddenSeg });
          if (!k.isDir) continue;
          if (skip.has(k.name) || !opts.includeHidden && k.name.startsWith(".")) continue;
          if (b.depth + 1 > maxDepth) {
            truncated = true;
            continue;
          }
          queue.push({ url: k.href, depth: b.depth + 1 });
        }
      }
      opts.onProgress?.(folders, entries.length);
    }
    return { entries, folders, truncated, cancelled: isCancelled() };
  }

  // src/name-filter.ts
  async function filterNames(entries, pattern, signal) {
    const response = await fetch(chrome.runtime.getURL("search-worker.js"), { signal });
    if (!response.ok) throw new Error(`Name matching worker HTTP ${response.status}`);
    const script = await response.text();
    if (signal.aborted) throw new Error("Name matching stopped");
    const url = URL.createObjectURL(new Blob([script], { type: "text/javascript" }));
    let worker;
    try {
      worker = new Worker(url);
    } finally {
      URL.revokeObjectURL(url);
    }
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (result, error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
        worker.terminate();
        if (error) reject(error);
        else resolve(new Set(result));
      };
      const abort = () => finish(void 0, new Error("Name matching stopped"));
      const timer = setTimeout(() => finish(void 0, new Error("Name regex timed out")), 500);
      signal.addEventListener("abort", abort, { once: true });
      worker.onerror = () => finish(void 0, new Error("Name matching worker failed"));
      worker.onmessage = (event) => {
        if (event.data.type !== "name-result") return;
        finish(event.data.matched, event.data.error ? new Error(event.data.error) : void 0);
      };
      if (signal.aborted) abort();
      else worker.postMessage({ type: "names", entries, pattern });
    });
  }

  // src/search-session.ts
  var SearchFileReader = class {
    constructor() {
      this.port = chrome.runtime.connect({ name: "bfb-search-fetch" });
      this.pending = /* @__PURE__ */ new Map();
      this.next = 0;
      this.closed = false;
      this.read = (href) => new Promise((resolve, reject) => {
        if (this.closed) {
          reject(new Error("search stopped"));
          return;
        }
        const id = ++this.next;
        this.pending.set(id, { resolve, reject });
        try {
          this.port.postMessage({ type: "read", id, url: new URL(href, location.href).href });
        } catch (error) {
          this.pending.delete(id);
          reject(new Error(String(error)));
        }
      });
      this.port.onMessage.addListener((msg) => {
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        if (msg.ok) p.resolve(msg.text ?? "");
        else p.reject(new Error(msg.error ?? "read failed"));
      });
      this.port.onDisconnect.addListener(() => this.close());
    }
    close() {
      if (this.closed) return;
      this.closed = true;
      try {
        this.port.disconnect();
      } catch {
      }
      for (const p of this.pending.values()) p.reject(new Error("search stopped"));
      this.pending.clear();
    }
  };
  var SearchSession = class _SearchSession extends SearchFileReader {
    constructor(worker) {
      super();
      this.matches = /* @__PURE__ */ new Map();
      this.matchId = 0;
      this.dead = false;
      this.failure = null;
      this.match = (text, query) => new Promise((resolve, reject) => {
        if (this.dead) {
          reject(new Error(this.failure ?? "search stopped"));
          return;
        }
        const id = ++this.matchId;
        this.matches.set(id, { resolve, reject });
        try {
          this.worker.postMessage({ id, text, query });
        } catch (error) {
          this.matches.delete(id);
          reject(new Error(String(error)));
        }
      });
      this.worker = worker;
      this.worker.onmessage = (event) => {
        const msg = event.data;
        const p = this.matches.get(msg.id);
        if (!p) return;
        if (msg.started) {
          p.timer = setTimeout(() => this.failMatches(new Error("Text matching timed out")), 2e3);
          return;
        }
        if (p.timer) clearTimeout(p.timer);
        this.matches.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error));
        else p.resolve(msg.hit ?? null);
      };
      this.worker.onerror = () => this.failMatches(new Error("Text matching worker failed"));
    }
    static async open() {
      const response = await fetch(chrome.runtime.getURL("search-worker.js"));
      if (!response.ok) throw new Error(`Search worker HTTP ${response.status}`);
      const script = await response.text();
      const url = URL.createObjectURL(new Blob([script], { type: "text/javascript" }));
      try {
        return new _SearchSession(new Worker(url));
      } finally {
        URL.revokeObjectURL(url);
      }
    }
    failMatches(error) {
      if (this.dead) return;
      this.dead = true;
      this.failure = error.message;
      this.worker?.terminate();
      for (const p of this.matches.values()) {
        if (p.timer) clearTimeout(p.timer);
        p.reject(error);
      }
      this.matches.clear();
    }
    close() {
      super.close();
      this.failMatches(new Error("search stopped"));
    }
  };

  // src/listing.ts
  function initListing(app, all, init) {
    const { fe, toast, rawPath } = app;
    const ls = {
      all,
      visible: all,
      baseStatus: "",
      sort: getSortConfig(),
      group: getGroupMode(),
      filter: { q: "", regex: false, type: "all" },
      deepOn: false,
      deepEntries: null,
      deepFolders: 0,
      deepTruncated: false,
      deepScanning: false,
      deepSeq: 0,
      contentHits: null,
      contentText: "",
      findSeq: 0,
      pendingFindText: null,
      selSet: /* @__PURE__ */ new Set(),
      selIdx: -1,
      anchor: -1
    };
    const ctx = () => {
      const colour = new Map(getTags().map((t) => [t.name, t.color]));
      const byPath = new Map(getSaved().filter((p) => p.tags?.length).map((p) => [p.path.replace(/\/+$/, ""), p.tags]));
      return {
        rawPath,
        iconRules: app.iconRules,
        settings: app.settings,
        tagsOf: (path) => (byPath.get(path.replace(/\/+$/, "")) ?? []).map((name) => ({ name, color: colour.get(name) ?? "#8b949e" }))
      };
    };
    const nonPar = all.filter((e) => !e.isParent);
    const dirs = nonPar.filter((e) => e.isDir).length;
    const files = nonPar.filter((e) => !e.isDir).length;
    const hidden = nonPar.filter((e) => e.isHidden).length;
    const treeExpanded = /* @__PURE__ */ new Set();
    const treeChildren = /* @__PURE__ */ new Map();
    const treeLoading = /* @__PURE__ */ new Set();
    const treeErrors = /* @__PURE__ */ new Set();
    const treeReaders = /* @__PURE__ */ new Map();
    const treeRootUrl = new URL("./", location.href).href;
    let findSession = null;
    let deepReader = null;
    let nameMatches = null;
    let nameFilterAbort = null;
    let nameFilterReady = Promise.resolve();
    let nameFilterFailure = "";
    ls.baseStatus = `${dirs} folder${dirs !== 1 ? "s" : ""}, ${files} file${files !== 1 ? "s" : ""}`;
    function renderTree(entries, parent) {
      const rows = [];
      const add = (en, depth) => {
        const idx = ls.visible.length;
        ls.visible.push(en);
        const name = en.isParent ? "Parent Directory" : en.name.split("/").pop();
        const expanded = treeExpanded.has(en.href);
        const hit = ls.contentHits?.get(en.href);
        rows.push(`<div class="fe-tree-row${en.isHidden ? " dotfile" : ""}${en.isDir ? " dir" : ""}" data-idx="${idx}" style="padding-left:${10 + depth * 20}px">
        ${en.isDir && !en.isParent ? `<button class="fe-tree-toggle" data-url="${esc(en.href)}" aria-label="${expanded ? "Collapse" : "Expand"} ${esc(name)}" aria-expanded="${expanded}">${CHEVRON_DOWN}</button>` : '<span class="fe-tree-spacer"></span>'}
        <a href="${esc(en.href)}" class="fe-tree-link">${getIcon(en, app.iconRules)}<span class="fe-nm">${esc(name)}</span></a>${hit ? `<span class="fe-find-badge">${hit.count}</span>${renderHitSnippet(hit)}` : ""}
      </div>`);
        if (!en.isDir || !expanded) return;
        if (treeLoading.has(en.href)) {
          rows.push(`<div class="fe-tree-message" style="padding-left:${34 + (depth + 1) * 20}px">Loading\u2026</div>`);
          return;
        }
        if (treeErrors.has(en.href)) {
          rows.push(`<div class="fe-tree-message" style="padding-left:${34 + (depth + 1) * 20}px">Could not read folder. Collapse and expand to retry.</div>`);
          return;
        }
        const children = treeChildren.get(en.href);
        if (!children) return;
        if (!children.length) rows.push(`<div class="fe-tree-message" style="padding-left:${34 + (depth + 1) * 20}px">Empty folder</div>`);
        for (const child of applySort(applyFilter(children, ls.filter, nameMatches ?? void 0), ls.sort)) {
          if (!ls.contentHits || ls.contentHits.has(child.href) || child.isDir) add(child, depth + 1);
        }
      };
      parent.forEach((en) => add(en, 0));
      entries.forEach((en) => add(en, 0));
      el("fe-tree").innerHTML = rows.join("");
    }
    function applyAll() {
      const parent = all.filter((e) => e.isParent);
      let entries = ls.deepOn && ls.deepEntries ? ls.deepEntries : nonPar;
      entries = applyFilter(entries, ls.filter, nameMatches ?? void 0);
      if (ls.contentHits) entries = entries.filter((e) => ls.contentHits.has(e.href));
      entries = applySort(entries, ls.sort);
      const c = ctx();
      const tbody = el("fe-tbody");
      const tiles = el("fe-tiles");
      ls.visible = [];
      const rowParts = [], tileParts = [];
      const pushEntry = (e) => {
        const idx = ls.visible.length;
        ls.visible.push(e);
        const hit = ls.contentHits?.get(e.href);
        rowParts.push(renderRow(e, c, idx, hit));
        tileParts.push(renderTile(e, c, idx, hit));
      };
      parent.forEach(pushEntry);
      if (ls.group !== "none") {
        for (const g of buildGroups(entries, ls.group)) {
          rowParts.push(`<tr class="fe-group-hdr"><td colspan="6">${esc(g.label)}</td></tr>`);
          tileParts.push(`<div class="fe-group-hdr-tile">${esc(g.label)}</div>`);
          g.items.forEach(pushEntry);
        }
      } else {
        entries.forEach(pushEntry);
      }
      tbody.innerHTML = rowParts.join("");
      tiles.innerHTML = tileParts.join("");
      fe.classList.toggle("fe-has-find-hits", !!ls.contentHits);
      if (fe.dataset.view === "tree") {
        ls.visible = [];
        renderTree(entries, parent);
      }
      const shown = fe.dataset.view === "tree" ? entries.length : ls.visible.filter((en) => !en.isParent).length;
      const filtered = !!ls.filter.q || ls.filter.type !== "all";
      if (ls.contentHits) {
        ls.baseStatus = `${shown} file${shown !== 1 ? "s" : ""} containing "${ls.contentText}"${ls.deepOn ? ` in ${ls.deepFolders} folders` : ""}`;
      } else if (ls.deepOn) {
        ls.baseStatus = ls.deepScanning ? `Scanning\u2026 ${ls.deepFolders} folder${ls.deepFolders !== 1 ? "s" : ""}` : `${shown} of ${ls.deepEntries?.length ?? 0} items in ${ls.deepFolders} folders${ls.deepTruncated ? " (capped)" : ""}`;
      } else {
        ls.baseStatus = filtered ? `${shown} of ${nonPar.length} item${nonPar.length !== 1 ? "s" : ""} shown` : `${dirs} folder${dirs !== 1 ? "s" : ""}, ${files} file${files !== 1 ? "s" : ""}`;
      }
      if (!app.fileMode) el("fe-count").textContent = ls.baseStatus;
      sel.setSel(-1);
    }
    app.applyAll = applyAll;
    app.setOrder = (sort, group) => {
      ls.sort = { ...sort };
      ls.group = group;
      syncSortUi();
      applyAll();
    };
    function refreshNameMatches() {
      nameFilterAbort?.abort();
      nameFilterAbort = null;
      nameFilterFailure = "";
      if (!ls.filter.regex || !ls.filter.q) {
        nameMatches = null;
        nameFilterReady = Promise.resolve();
        applyAll();
        return;
      }
      nameMatches = /* @__PURE__ */ new Set();
      applyAll();
      const controller = new AbortController();
      nameFilterAbort = controller;
      const entries = [...nonPar, ...ls.deepEntries ?? [], ...[...treeChildren.values()].flat()];
      nameFilterReady = filterNames(entries, ls.filter.q, controller.signal).then((matches) => {
        if (nameFilterAbort !== controller) return;
        nameMatches = matches;
        nameFilterAbort = null;
        applyAll();
      }).catch((error) => {
        if (nameFilterAbort !== controller) return;
        nameMatches = /* @__PURE__ */ new Set();
        nameFilterAbort = null;
        nameFilterFailure = String(error instanceof Error ? error.message : error);
        applyAll();
        el("fe-count").textContent = nameFilterFailure;
      });
    }
    const sel = {
      entryShown: (en) => !en.isHidden || fe.classList.contains("show-hidden"),
      selectable: (i) => {
        const en = ls.visible[i];
        return !!en && !en.isParent && sel.entryShown(en);
      },
      setSel(i) {
        ls.selSet.clear();
        ls.selIdx = i;
        ls.anchor = i;
        if (i >= 0) ls.selSet.add(i);
        paintSel();
        scrollToLead();
      },
      toggleSel(i) {
        if (ls.selSet.has(i)) ls.selSet.delete(i);
        else ls.selSet.add(i);
        ls.selIdx = i;
        ls.anchor = i;
        paintSel();
      },
      rangeSel(target) {
        const a = ls.anchor >= 0 ? ls.anchor : target;
        ls.selSet.clear();
        selectionRange(a, target).filter(sel.selectable).forEach((i) => ls.selSet.add(i));
        ls.selIdx = target;
        paintSel();
        scrollToLead();
      },
      selectAll() {
        ls.selSet.clear();
        for (let i = 0; i < ls.visible.length; i++) if (sel.selectable(i)) ls.selSet.add(i);
        if (ls.selSet.size && ls.selIdx < 0) ls.selIdx = [...ls.selSet][0];
        paintSel();
      },
      moveSel(step2) {
        let i = ls.selIdx;
        for (let n = 0; n < ls.visible.length; n++) {
          i += step2;
          if (i < 0 || i >= ls.visible.length) return;
          if (sel.entryShown(ls.visible[i])) {
            sel.setSel(i);
            return;
          }
        }
      },
      copySelection() {
        const paths = [...ls.selSet].sort((a, b) => a - b).map((i) => fullPath(rawPath, ls.visible[i]));
        if (!paths.length) return;
        copyToClipboard(paths.join("\n")).then(() => toast(`Copied ${paths.length} path${paths.length !== 1 ? "s" : ""}`));
      },
      tryPreview(en) {
        if (canPreview(en)) {
          sel.setSel(ls.visible.indexOf(en));
          openPreview(en);
        } else if (en.isDir || en.isParent) toast("Folders have no preview. Press Enter to open");
        else toast("No preview for this file type");
      },
      previewStep(step2) {
        let i = ls.selIdx;
        for (let n = 0; n < ls.visible.length; n++) {
          i += step2;
          if (i < 0 || i >= ls.visible.length) return;
          const en = ls.visible[i];
          if (sel.entryShown(en) && canPreview(en)) {
            sel.setSel(i);
            openPreview(en);
            return;
          }
        }
      }
    };
    function paintSel() {
      els("#fe-scroll .selected").forEach((x) => x.classList.remove("selected"));
      ls.selSet.forEach((i) => els(`#fe-scroll [data-idx="${i}"]`).forEach((x) => x.classList.add("selected")));
      const t = el("fe-status-text");
      if (ls.selSet.size > 1) {
        t.textContent = `${ls.selSet.size} selected`;
      } else {
        const en = ls.selIdx >= 0 ? ls.visible[ls.selIdx] : null;
        t.textContent = en && !en.isParent ? en.isDir ? `${en.name}/` : `${en.name} \xB7 ${fmtSize(en.rawBytes)}` : app.fileMode ? "" : ls.baseStatus;
      }
    }
    function scrollToLead() {
      if (ls.selIdx < 0) return;
      els(`#fe-scroll [data-idx="${ls.selIdx}"]`).forEach((x) => {
        if (x.offsetParent) x.scrollIntoView({ block: "nearest" });
      });
    }
    els(".fe-view-btn").forEach((btn) => {
      if (btn.dataset.view === init.view) btn.classList.add("active");
      btn.addEventListener("click", () => {
        els(".fe-view-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        fe.dataset.view = btn.dataset.view;
        kvSet(VIEW_KEY, btn.dataset.view);
        applyAll();
      });
    });
    el("fe-tree").addEventListener("click", (e) => {
      const toggle = e.target.closest(".fe-tree-toggle");
      if (!toggle) return;
      e.preventDefault();
      e.stopPropagation();
      const url = toggle.dataset.url;
      if (treeExpanded.delete(url)) {
        treeReaders.get(url)?.close();
        treeReaders.delete(url);
        treeLoading.delete(url);
        applyAll();
        return;
      }
      treeExpanded.add(url);
      if (treeChildren.has(url) || treeLoading.has(url)) {
        applyAll();
        return;
      }
      treeErrors.delete(url);
      treeLoading.add(url);
      applyAll();
      const absoluteUrl = new URL(url, location.href).href;
      const reader = new SearchFileReader();
      treeReaders.set(url, reader);
      reader.read(absoluteUrl).then((html) => {
        if (treeReaders.get(url) !== reader) return;
        const children = parseListing(html, absoluteUrl).map((child) => {
          const rel = child.href.startsWith(treeRootUrl) ? decodeURIComponent(child.href.slice(treeRootUrl.length)).replace(/\/$/, "") : child.name;
          return { ...child, name: rel, isHidden: rel.split("/").some((part) => part.startsWith(".")) };
        });
        treeChildren.set(url, children);
        if (ls.filter.regex && ls.filter.q) refreshNameMatches();
      }).catch(() => {
        if (treeReaders.get(url) === reader) treeErrors.add(url);
      }).finally(() => {
        reader.close();
        if (treeReaders.get(url) !== reader) return;
        treeReaders.delete(url);
        treeLoading.delete(url);
        if (fe.dataset.view === "tree") applyAll();
      });
    });
    const hiddenBtn = el("fe-hidden-btn");
    if (init.hidden) fe.classList.add("show-hidden");
    hiddenBtn.addEventListener("click", () => {
      const on = fe.classList.toggle("show-hidden");
      hiddenBtn.classList.toggle("on", on);
      hiddenBtn.title = `Hidden files: ${on ? "showing" : "hiding"} dotfiles \xB7 click to toggle`;
      kvSet(HIDDEN_KEY, String(on));
      toast(on ? `Showing ${hidden} hidden file${hidden !== 1 ? "s" : ""}` : "Hidden files concealed");
    });
    const zoomEl = el("fe-zoom");
    const zoomVal = el("fe-zoom-val");
    const scroll = el("fe-scroll");
    const scrollKey = "bfb-scroll:" + rawPath;
    try {
      const top = Number(sessionStorage.getItem(scrollKey));
      if (top) scroll.scrollTop = top;
    } catch {
    }
    scroll.addEventListener("scroll", () => {
      try {
        sessionStorage.setItem(scrollKey, String(scroll.scrollTop));
      } catch {
      }
    });
    zoomEl.addEventListener("input", () => {
      const z = parseInt(zoomEl.value);
      scroll.style.zoom = String(z / 100);
      zoomVal.textContent = z + "%";
      zoomEl.title = `Zoom: ${z}% \xB7 drag to scale`;
      el("fe-zoom-wrap").title = `Zoom: ${z}% \xB7 drag to scale the list (50 to 320%)`;
      kvSet(ZOOM_KEY, String(z));
    });
    function syncSortUi() {
      const { col, dir } = ls.sort;
      els("#fe-sort-cols .fe-pbn").forEach((b) => b.classList.toggle("active", b.dataset.col === (col ?? "name")));
      el("fe-sort-dir").textContent = dir === "asc" ? "\u2191 Asc" : "\u2193 Desc";
      els("th[data-sort]").forEach((h) => {
        const on = h.dataset.sort === col;
        h.classList.toggle("sorted", on);
        h.querySelector(".si").textContent = on ? dir === "asc" ? "\u2191" : "\u2193" : "\u2195";
      });
      els("#fe-group-btns .fe-pbn").forEach((b) => b.classList.toggle("active", b.dataset.group === ls.group));
      saveSortConfig(ls.sort);
      saveGroupMode(ls.group);
    }
    function setSortCol(col) {
      if (ls.sort.col === col) ls.sort.dir = ls.sort.dir === "asc" ? "desc" : "asc";
      else {
        ls.sort.col = col;
        ls.sort.dir = "asc";
      }
      syncSortUi();
      applyAll();
    }
    els("th[data-sort]").forEach((th) => th.addEventListener("click", () => setSortCol(th.dataset.sort)));
    const w0 = getColWidths();
    els("thead th[data-ck]").forEach((th) => {
      const px2 = w0[th.dataset.ck];
      if (px2) th.style.width = px2 + "px";
    });
    els(".fe-col-rz").forEach((handle) => {
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
          const widths = getColWidths();
          widths[key] = Math.max(48, startW + ev.clientX - startX);
          saveColWidths(widths);
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      });
    });
    const sgPanel = el("fe-sg-panel");
    el("fe-sg-btn").addEventListener("click", () => {
      const open = sgPanel.style.display === "none";
      sgPanel.style.display = open ? "" : "none";
      el("fe-sg-btn").classList.toggle("on", open);
    });
    els("#fe-sort-cols .fe-pbn").forEach((btn) => btn.addEventListener("click", () => setSortCol(btn.dataset.col)));
    el("fe-sort-dir").addEventListener("click", () => {
      ls.sort.dir = ls.sort.dir === "asc" ? "desc" : "asc";
      if (!ls.sort.col) ls.sort.col = "name";
      syncSortUi();
      applyAll();
    });
    els("#fe-group-btns .fe-pbn").forEach((btn) => btn.addEventListener("click", () => {
      ls.group = btn.dataset.group;
      syncSortUi();
      applyAll();
    }));
    syncSortUi();
    const filterBar = el("fe-filter-bar");
    el("fe-filter-btn").addEventListener("click", () => {
      const open = filterBar.style.display === "none";
      filterBar.style.display = open ? "" : "none";
      el("fe-filter-btn").classList.toggle("on", open);
      if (open) el("fe-filter-q").focus();
    });
    el("fe-filter-q").addEventListener("input", function() {
      stopFind();
      ls.filter.q = this.value;
      refreshNameMatches();
    });
    el("fe-regex-btn").addEventListener("click", function() {
      stopFind();
      ls.filter.regex = !ls.filter.regex;
      this.classList.toggle("active", ls.filter.regex);
      this.title = ls.filter.regex ? "Regex mode on" : "Toggle regex mode";
      refreshNameMatches();
    });
    el("fe-type-filter").addEventListener("change", function() {
      stopFind();
      ls.filter.type = this.value;
      applyAll();
    });
    const findText = el("fe-find-text");
    const findCase = el("fe-find-case");
    const findRegex = el("fe-find-text-regex");
    const findDepth = el("fe-find-depth");
    const findStatus = el("fe-find-status");
    const findError = el("fe-find-error");
    const findCancel = el("fe-find-cancel");
    function stopFind() {
      ls.findSeq++;
      findSession?.close();
      findSession = null;
      ls.pendingFindText = null;
      ls.contentHits = null;
      findCancel.style.display = "none";
      findStatus.textContent = "";
    }
    function currentFind() {
      const type = ls.filter.type;
      return {
        scope: ls.deepOn ? "deep" : "here",
        name: ls.filter.q,
        regex: ls.filter.regex,
        exts: ["all", "folders", "files"].includes(type) ? [] : [type],
        text: findText.value.trim(),
        caseSensitive: findCase.checked,
        textRegex: findRegex.checked,
        maxDepth: Number(findDepth.value) || 8
      };
    }
    async function runFind(text) {
      findSession?.close();
      const seq = ++ls.findSeq;
      findSession = null;
      ls.contentText = text;
      findError.textContent = "";
      ls.contentHits = null;
      applyAll();
      if (!text) {
        findStatus.textContent = "";
        findCancel.style.display = "none";
        return;
      }
      const query = { ...currentFind(), text };
      const patternError = textPatternError(query);
      if (patternError) {
        findError.textContent = patternError;
        findStatus.textContent = "";
        findCancel.style.display = "none";
        return;
      }
      if (ls.deepOn && ls.deepScanning) {
        ls.pendingFindText = text;
        findStatus.textContent = "waiting for the folder scan\u2026";
        findCancel.style.display = "";
        findCancel.onclick = () => {
          ls.pendingFindText = null;
          ls.deepSeq++;
          deepReader?.close();
          deepReader = null;
          ls.deepScanning = false;
          ls.deepOn = false;
          deepBtn.classList.remove("on");
          el("fe-find-depth-wrap").style.display = "none";
          findCancel.style.display = "none";
          findStatus.textContent = "stopped before scanning";
          applyAll();
        };
        return;
      }
      if (ls.filter.regex && ls.filter.q) {
        await nameFilterReady;
        if (seq !== ls.findSeq) return;
        if (nameFilterFailure) {
          findError.textContent = nameFilterFailure;
          findCancel.style.display = "none";
          return;
        }
      }
      const source = ls.deepOn && ls.deepEntries ? ls.deepEntries : nonPar;
      const candidates = applyFilter(source, ls.filter, nameMatches ?? void 0).filter(isTextCandidate);
      findStatus.textContent = `scanning 0/${candidates.length}`;
      findCancel.style.display = "";
      let session;
      let cancelled = false;
      findCancel.onclick = () => {
        cancelled = true;
        session?.close();
        findStatus.textContent = "stopping\u2026";
      };
      try {
        session = await SearchSession.open();
      } catch (error) {
        if (seq !== ls.findSeq) return;
        findCancel.style.display = "none";
        findError.textContent = `Search could not start: ${String(error)}`;
        return;
      }
      if (seq !== ls.findSeq) {
        session.close();
        return;
      }
      if (cancelled) session.close();
      findSession = session;
      const r = await searchContents(
        candidates,
        session.read,
        query,
        (d, t) => {
          if (seq === ls.findSeq) findStatus.textContent = `scanning ${d}/${t}`;
        },
        () => cancelled || session.dead || seq !== ls.findSeq,
        4,
        session.match
      );
      const failure = session.failure;
      session.close();
      if (findSession === session) findSession = null;
      if (seq !== ls.findSeq) return;
      findCancel.style.display = "none";
      ls.contentHits = r.hits;
      findStatus.textContent = `${r.hits.size} matching file${r.hits.size === 1 ? "" : "s"} of ${r.scanned} scanned${r.failed ? `, ${r.failed} unreadable or timed out` : ""}${r.cancelled ? " (partial, stopped)" : ""}`;
      if (failure && failure !== "search stopped") findError.textContent = failure;
      applyAll();
    }
    el("fe-find-run").addEventListener("click", () => void runFind(findText.value.trim()));
    findText.addEventListener("input", () => {
      stopFind();
      findError.textContent = "";
      applyAll();
    });
    findRegex.addEventListener("change", () => {
      stopFind();
      findError.textContent = "";
      applyAll();
    });
    findCase.addEventListener("change", () => {
      stopFind();
      applyAll();
    });
    findText.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void runFind(findText.value.trim());
      } else if (e.key === "Escape") {
        e.stopPropagation();
        findText.value = "";
        void runFind("");
      }
    });
    el("fe-find-save").addEventListener("click", () => {
      const q = currentFind();
      const hash = findToHash(q);
      if (!hash) {
        toast("Set a name, type, text or deep scope first");
        return;
      }
      saveSaved(upsertPlace(getSaved(), { path: rawPath + hash, label: describeFind(q) }));
      app.refreshSaved();
      toast("View saved");
    });
    function applyFindFromHash() {
      const q = findFromHash(location.hash);
      if (!q) return;
      ls.filter.q = q.name;
      ls.filter.regex = q.regex;
      ls.filter.type = q.exts.length === 1 ? q.exts[0] : "all";
      el("fe-filter-q").value = q.name;
      el("fe-search").value = q.name;
      el("fe-regex-btn").classList.toggle("active", q.regex);
      el("fe-type-filter").value = ls.filter.type;
      findText.value = q.text;
      findCase.checked = q.caseSensitive;
      findRegex.checked = q.textRegex;
      findDepth.value = String(q.maxDepth);
      filterBar.style.display = "";
      el("fe-filter-btn").classList.add("on");
      if (q.scope === "deep" !== ls.deepOn) deepBtn.click();
      ls.contentHits = null;
      refreshNameMatches();
      if (q.text) {
        if (ls.deepOn && (ls.deepScanning || !ls.deepEntries)) ls.pendingFindText = q.text;
        else void runFind(q.text);
      }
    }
    window.addEventListener("hashchange", applyFindFromHash);
    const deepBtn = el("fe-deep-btn");
    const searchEl = el("fe-search");
    function startDeepCrawl() {
      deepReader?.close();
      const seq = ++ls.deepSeq;
      ls.deepScanning = true;
      let reader;
      try {
        reader = new SearchFileReader();
      } catch (error) {
        ls.deepScanning = false;
        findError.textContent = `Folder scan could not start: ${String(error)}`;
        return;
      }
      deepReader = reader;
      let scanFailures = 0;
      crawl(
        treeRootUrl,
        (url) => reader.read(url).then((html) => parseListing(html, url)).catch((error) => {
          scanFailures++;
          if (seq === ls.deepSeq) findError.textContent = `Could not read ${scanFailures} folder${scanFailures === 1 ? "" : "s"}: ${String(error)}`;
          throw error;
        }),
        {
          maxDepth: Number(findDepth.value) || 8,
          includeHidden: fe.classList.contains("show-hidden"),
          onProgress: (f) => {
            if (seq === ls.deepSeq) {
              ls.deepFolders = f;
              applyAll();
            }
          }
        },
        () => seq !== ls.deepSeq
      ).then((r) => {
        reader.close();
        if (deepReader === reader) deepReader = null;
        if (seq !== ls.deepSeq) return;
        ls.deepEntries = r.entries;
        ls.deepFolders = r.folders;
        ls.deepTruncated = r.truncated;
        ls.deepScanning = false;
        refreshNameMatches();
        if (r.truncated) toast(`Deep search reached the ${findDepth.value}-level or 5000-item limit`);
        if (ls.pendingFindText !== null) {
          const t = ls.pendingFindText;
          ls.pendingFindText = null;
          void runFind(t);
        }
      });
    }
    deepBtn.addEventListener("click", () => {
      stopFind();
      ls.deepOn = !ls.deepOn;
      deepBtn.classList.toggle("on", ls.deepOn);
      el("fe-find-depth-wrap").style.display = ls.deepOn ? "" : "none";
      searchEl.placeholder = ls.deepOn ? "Search subfolders" : "Filter";
      if (ls.deepOn) {
        if (!ls.deepEntries) startDeepCrawl();
        else refreshNameMatches();
        searchEl.focus();
      } else {
        ls.deepSeq++;
        deepReader?.close();
        deepReader = null;
        ls.deepScanning = false;
        refreshNameMatches();
      }
    });
    findDepth.addEventListener("change", () => {
      stopFind();
      ls.deepEntries = null;
      if (ls.deepOn) startDeepCrawl();
      else applyAll();
    });
    searchEl.addEventListener("input", function() {
      stopFind();
      ls.filter.q = this.value;
      el("fe-filter-q").value = this.value;
      refreshNameMatches();
    });
    searchEl.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      if (searchEl.value) {
        searchEl.value = "";
        ls.filter.q = "";
        el("fe-filter-q").value = "";
        refreshNameMatches();
      }
      searchEl.blur();
    });
    window.addEventListener("pagehide", () => {
      nameFilterAbort?.abort();
      findSession?.close();
      deepReader?.close();
      for (const reader of treeReaders.values()) reader.close();
      treeReaders.clear();
    });
    return { ls, sel, applyAll, applyFindFromHash };
  }

  // src/listing-input.ts
  function initListingInput(app, listing) {
    const { fe, toast, rawPath } = app;
    const { ls, sel } = listing;
    const scroll = el("fe-scroll");
    const copyText = (val) => {
      copyToClipboard(val).then(() => toast(`Copied: ${val}`));
    };
    let lookTimer = null;
    const entryAt = (e) => {
      const holder = e.target.closest("[data-idx]");
      return holder ? ls.visible[parseInt(holder.dataset.idx)] ?? null : null;
    };
    scroll.addEventListener("click", (e) => {
      const pv = e.target.closest(".fe-act-pv");
      if (pv) {
        e.preventDefault();
        e.stopPropagation();
        const en2 = ls.all.find((x) => x.name === pv.dataset.pv);
        if (en2) {
          sel.setSel(ls.visible.indexOf(en2));
          openPreview(en2);
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
      const en = entryAt(e);
      if (!en) return;
      const i = ls.visible.indexOf(en);
      e.preventDefault();
      if (en.isParent) {
        location.href = pageHref(en.href);
        return;
      }
      if (e.altKey) {
        app.strip.open(fullPath(rawPath, en), true);
        return;
      }
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        if (!sel.selectable(i)) return;
        if (e.shiftKey && (e.metaKey || e.ctrlKey)) sel.rangeSel(i);
        else sel.toggleSel(i);
        return;
      }
      if (en.isDir) {
        location.href = pageHref(en.href);
        return;
      }
      if (!sel.selectable(i)) return;
      sel.setSel(i);
      if (!canPreview(en) || app.settings.clickOpens === "go") {
        location.href = pageHref(en.href);
        return;
      }
      if (lookTimer) clearTimeout(lookTimer);
      if (e.detail > 1) return;
      lookTimer = setTimeout(() => {
        lookTimer = null;
        openPreview(en);
      }, 220);
    });
    scroll.addEventListener("dblclick", (e) => {
      const en = entryAt(e);
      if (!en || en.isDir || en.isParent || e.altKey || e.shiftKey || e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      if (lookTimer) {
        clearTimeout(lookTimer);
        lookTimer = null;
      }
      location.href = pageHref(en.href);
    });
    scroll.addEventListener("auxclick", (e) => {
      if (e.button !== 1 || e.target.closest("a")) return;
      const en = entryAt(e);
      if (!en) return;
      e.preventDefault();
      window.open(en.href, "_blank");
    });
    const tip = el("fe-tip");
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
    function showTip(target, ev) {
      try {
        const d = JSON.parse(target.getAttribute("data-tip") ?? "{}");
        const iconHtml = d.icon ? `<span class="tip-icon">${d.icon}</span>` : "";
        const linesHtml = (d.lines || []).map((l) => `<div class="tip-line">${esc(l)}</div>`).join("");
        const warnHtml = d.warn ? `<div class="tip-warn">\u26A0 ${esc(d.warn)}</div>` : "";
        tip.innerHTML = `<div class="tip-header">${iconHtml}<span class="tip-name">${esc(d.name || "")}</span></div>${linesHtml}${warnHtml}`;
      } catch {
        tip.innerHTML = `<div class="tip-name">${esc(target.getAttribute("data-tip") ?? "")}</div>`;
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
    const ctxMenu = document.createElement("div");
    ctxMenu.id = "fe-ctx";
    ctxMenu.style.display = "none";
    fe.appendChild(ctxMenu);
    const closeCtx = () => {
      ctxMenu.style.display = "none";
    };
    scroll.addEventListener("contextmenu", (e) => {
      const holder = e.target.closest("[data-idx]");
      if (!holder) return;
      const idx = parseInt(holder.dataset.idx);
      const en = ls.visible[idx];
      if (!en || en.isParent) return;
      e.preventDefault();
      const multi = ls.selSet.size > 1 && ls.selSet.has(idx);
      if (!multi) sel.setSel(idx);
      ctxMenu.innerHTML = multi ? [
        `<div class="fe-ctx-item" data-act="cp-paths">Copy ${ls.selSet.size} paths</div>`,
        `<div class="fe-ctx-item" data-act="cp-names">Copy ${ls.selSet.size} names</div>`
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
      const en = ls.visible[parseInt(ctxMenu.dataset.idx)];
      closeCtx();
      if (!en) return;
      const fp = fullPath(rawPath, en);
      if (item.dataset.act === "pv") openPreview(en);
      else if (item.dataset.act === "cp-path") copyText(fp);
      else if (item.dataset.act === "cp-name") copyText(en.name);
      else if (item.dataset.act === "term") app.openInTerminal(en.isDir ? fp : rawPath);
      else if (item.dataset.act === "cp-paths") sel.copySelection();
      else if (item.dataset.act === "cp-names") {
        const names = [...ls.selSet].sort((a, b) => a - b).map((i) => ls.visible[i].name).join("\n");
        copyToClipboard(names).then(() => toast(`Copied ${ls.selSet.size} names`));
      }
    });
    document.addEventListener("click", (e) => {
      if (ctxMenu.style.display !== "none" && !ctxMenu.contains(e.target)) closeCtx();
    });
    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "f") {
        if (app.fileMode) return;
        const s = el("fe-search");
        if (document.activeElement !== s) {
          e.preventDefault();
          s.focus({ preventScroll: true });
          s.select();
        }
        return;
      }
      const ae = document.activeElement;
      if (ae && ["INPUT", "TEXTAREA", "SELECT"].includes(ae.tagName)) return;
      if (el("fe-settings-modal").style.display !== "none") return;
      if (el("fe-help-modal").style.display !== "none") return;
      if (e.key === "?") {
        e.preventDefault();
        app.openHelp();
        return;
      }
      if (e.key === "," && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        app.openSettings();
        return;
      }
      if (e.metaKey && e.key === "ArrowUp") {
        e.preventDefault();
        app.goUp();
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
          sel.previewStep(1);
        } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
          e.preventDefault();
          sel.previewStep(-1);
        } else if (e.key === "Enter") {
          const en = previewEntry();
          if (en) location.href = pageHref(en.href);
        } else if (e.key === "t" && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          keepPreviewedAsTab();
        } else if (["[", "]", "1", "2", "3", "4", "5", "6", "7", "8", "9"].includes(e.key) && app.strip.handleKey(e)) e.preventDefault();
        return;
      }
      if (app.filePage && e.key === "r" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        app.filePage.toggleRaw();
      } else if (app.filePage && e.key === "e" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        app.filePage.edit();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        sel.moveSel(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        sel.moveSel(-1);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        sel.selectAll();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c" && ls.selSet.size) {
        e.preventDefault();
        sel.copySelection();
      } else if (e.key === "Enter" && ls.selIdx >= 0) {
        location.href = pageHref(ls.visible[ls.selIdx].href);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        app.goUp();
      } else if (e.key === " " && ls.selIdx >= 0) {
        e.preventDefault();
        sel.tryPreview(ls.visible[ls.selIdx]);
      } else if (e.key === "n" && !e.metaKey && !e.ctrlKey && app.settings.notesRoot) {
        e.preventDefault();
        app.newNote();
      } else if (app.strip.handleKey(e)) e.preventDefault();
    });
  }

  // src/sidebar.ts
  var LENS_KEY = "bfb-lens-v1";
  function initLenses(app) {
    const rail = el("fe-rail");
    const btns = els("#fe-rail .fe-rail-btn");
    const lenses = els("#fe-lenses .fe-lens");
    const show = (lens) => {
      const usable = btns.filter((b) => !b.hidden).map((b) => b.dataset.lens);
      const pick = usable.includes(lens) ? lens : "notes";
      for (const b of btns) {
        const on = b.dataset.lens === pick;
        b.classList.toggle("on", on);
        b.setAttribute("aria-selected", String(on));
        b.tabIndex = on ? 0 : -1;
      }
      for (const l of lenses) l.hidden = l.dataset.lens !== pick;
    };
    app.showLens = (lens, hideHistory) => {
      if (hideHistory !== void 0) el("fe-rail-history").hidden = hideHistory;
      show(lens ?? kvGet(LENS_KEY) ?? "notes");
    };
    rail.addEventListener("click", (e) => {
      const b = e.target.closest(".fe-rail-btn");
      if (!b) return;
      kvSet(LENS_KEY, b.dataset.lens);
      show(b.dataset.lens);
    });
    rail.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const usable = btns.filter((b) => !b.hidden);
      const i = usable.findIndex((b) => b.classList.contains("on"));
      const next = usable[(i + (e.key === "ArrowDown" ? 1 : -1) + usable.length) % usable.length];
      e.preventDefault();
      kvSet(LENS_KEY, next.dataset.lens);
      show(next.dataset.lens);
      next.focus();
    });
    onKvChange((key) => {
      if (key === LENS_KEY) show(kvGet(LENS_KEY) ?? "notes");
    });
    show(kvGet(LENS_KEY) ?? "notes");
  }
  function initSidebar(app) {
    const { rawPath, settings, toast } = app;
    initLenses(app);
    const collapseKey = "bfb-sidebar-collapsed-v1";
    const sections = els("#fe-side .fe-sec[data-collapse]");
    const collapsed = () => {
      try {
        const value = JSON.parse(kvGet(collapseKey) || "[]");
        return new Set(Array.isArray(value) ? value.filter((v) => typeof v === "string") : []);
      } catch {
        return /* @__PURE__ */ new Set();
      }
    };
    const applyCollapsed = (keys) => {
      for (const section of sections) {
        const key = section.dataset.collapse;
        const isCollapsed = keys.has(key);
        section.classList.toggle("fe-collapsed", isCollapsed);
        const toggle = section.querySelector(".fe-sh-collapse");
        const label = toggle.dataset.label;
        toggle.setAttribute("aria-expanded", String(!isCollapsed));
        toggle.setAttribute("aria-label", `${isCollapsed ? "Expand" : "Collapse"} ${label}`);
        if (settings.tooltips !== false) toggle.title = `${isCollapsed ? "Expand" : "Collapse"} ${label}`;
        else toggle.removeAttribute("title");
      }
    };
    for (const section of sections) {
      const header = section.querySelector(":scope > .fe-sh");
      const labelNode = header.querySelector(".fe-sh-label");
      const label = labelNode.textContent.trim();
      const key = section.dataset.collapse;
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "fe-sh-collapse";
      toggle.id = `fe-sec-toggle-${key}`;
      toggle.dataset.label = label;
      toggle.innerHTML = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="m2.5 4.5 3.5 3.5 3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      toggle.append(labelNode);
      toggle.addEventListener("click", () => {
        const keys = collapsed();
        if (section.classList.contains("fe-collapsed")) keys.delete(key);
        else keys.add(key);
        kvSet(collapseKey, JSON.stringify([...keys]));
        applyCollapsed(keys);
      });
      header.prepend(toggle);
    }
    applyCollapsed(collapsed());
    onKvChange((key) => {
      if (key === collapseKey) applyCollapsed(collapsed());
    });
    const svList = el("fe-sv-list");
    const svFilter = el("fe-sv-filter");
    let dragSrc = null;
    function syncStar() {
      const on = getSaved().some((p) => p.path === rawPath);
      const btn = el("fe-bm-btn");
      btn.classList.toggle("on", on);
      btn.title = on ? "Remove this folder from Saved" : "Save this folder (sidebar)";
      el("fe-bm-path").setAttribute("fill", on ? "currentColor" : "none");
    }
    function refreshSaved() {
      svList.innerHTML = renderSavedList(getSaved(), getTags(), rawPath, svFilter.value);
      attachSavedEvents();
      syncStar();
    }
    app.refreshSaved = refreshSaved;
    svFilter.addEventListener("input", refreshSaved);
    svFilter.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        svFilter.value = "";
        refreshSaved();
        svFilter.blur();
      }
    });
    function inlineEdit(target, onSave, onCancel) {
      const orig = target.textContent || "";
      target.contentEditable = "true";
      target.classList.add("editing");
      target.focus();
      const range = document.createRange();
      range.selectNodeContents(target);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      let done = false;
      const finish = (save) => {
        if (done) return;
        done = true;
        const val = (target.textContent || "").trim();
        target.contentEditable = "false";
        target.classList.remove("editing");
        if (save && val !== orig) onSave(val);
        else onCancel?.();
        refreshSaved();
      };
      target.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          finish(true);
        } else if (e.key === "Escape") {
          e.preventDefault();
          target.textContent = orig;
          finish(false);
        }
        e.stopPropagation();
      });
      target.addEventListener("blur", () => finish(true), { once: true });
    }
    let clickTimer = null;
    function attachSavedEvents() {
      els(".fe-rm-btn", svList).forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          e.preventDefault();
          saveSaved(removePlace(getSaved(), btn.dataset.path));
          refreshSaved();
          toast("Removed from Saved");
        });
      });
      els(".fe-pl-label", svList).forEach((lbl) => {
        lbl.addEventListener("dblclick", (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (clickTimer) {
            clearTimeout(clickTimer);
            clickTimer = null;
          }
          const path = lbl.closest(".fe-pl-item").dataset.path;
          inlineEdit(lbl, (val) => {
            if (val) saveSaved(renamePlace(getSaved(), path, val));
          });
        });
      });
      els(".fe-tag-btn", svList).forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          e.preventDefault();
          const item = btn.closest(".fe-pl-item");
          const path = item.dataset.path;
          const tagsEl = item.querySelector(".fe-pl-tags");
          tagsEl.textContent = (getSaved().find((p) => p.path === path)?.tags ?? []).join(", ");
          tagsEl.classList.add("show");
          inlineEdit(tagsEl, (val) => saveSaved(setTags(getSaved(), path, parseTags(val))));
        });
      });
      els(".fe-sv-dot", svList).forEach((dot) => {
        dot.addEventListener("click", (e) => {
          e.stopPropagation();
          e.preventDefault();
          saveTags(cycleTagColor(getTags(), dot.dataset.tag));
          refreshSaved();
        });
      });
      els(".fe-pl-item", svList).forEach((item) => {
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
          saveSaved(movePlace(getSaved(), dragSrc.dataset.path, item.dataset.path));
          refreshSaved();
        });
      });
    }
    function addCurrentFolder(rename) {
      const label = rawPath.split("/").filter(Boolean).pop() || "/";
      saveSaved(upsertPlace(getSaved(), { path: rawPath, label }));
      refreshSaved();
      toast("Saved");
      if (!rename) return;
      const fresh = els(".fe-pl-item", svList).find((i) => i.dataset.path === rawPath);
      const lbl = fresh?.querySelector(".fe-pl-label");
      if (lbl) lbl.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    }
    el("fe-sv-add").addEventListener("click", () => addCurrentFolder(true));
    el("fe-bm-btn").addEventListener("click", () => {
      if (getSaved().some((p) => p.path === rawPath)) {
        saveSaved(removePlace(getSaved(), rawPath));
        refreshSaved();
        toast("Removed from Saved");
      } else addCurrentFolder(false);
    });
    attachSavedEvents();
    syncStar();
    const ntList = el("fe-nt-list");
    const ntHint = el("fe-st-notes-hint");
    function notesRoot() {
      return (settings.notesRoot || "").replace(/\/$/, "");
    }
    const ntFilter = el("fe-nt-filter");
    let allNotes = [];
    let bodyHits = /* @__PURE__ */ new Map();
    const shownNotes = () => {
      const byMeta = filterNotes(allNotes, ntFilter.value);
      return [...byMeta, ...allNotes.filter((n) => bodyHits.has(n.rel) && !byMeta.includes(n))];
    };
    function renderNotes(root) {
      const shown = shownNotes();
      ntHint.textContent = ntFilter.value.trim() ? `${shown.length} of ${allNotes.length} notes in ${root}` : `${allNotes.length} note${allNotes.length !== 1 ? "s" : ""} in ${root}`;
      ntList.innerHTML = shown.length ? shown.map((n) => `
          <div class="fe-bm-item fe-nt-item${n.pinned ? " pinned" : ""}" data-rel="${esc(n.rel)}">
            <a href="file://${esc(root + "/" + n.rel)}" class="fe-si-link" title="${esc(n.rel)}">
              ${PI.docs ?? PI.folder}${noteRowText(n)}
            </a>${bodyHits.has(n.rel) ? `<span class="fe-nt-hit" title="${esc(bodyHits.get(n.rel))}">${esc(bodyHits.get(n.rel))}</span>` : ""}
            <span class="fe-nt-acts">
              <button class="fe-nt-props" data-rel="${esc(n.rel)}" title="Colour, pin and tags" aria-label="Colour, pin and tags for ${esc(n.title || noteTitle(n.rel))}">${UI_ICON.palette}</button>
              <button class="fe-nt-tab" data-rel="${esc(n.rel)}" title="Open in a page tab" aria-label="Open ${esc(n.title || noteTitle(n.rel))} in a page tab">${UI_ICON.tab}</button>
              <button class="fe-rm-btn" data-rel="${esc(n.rel)}" title="Move to .trash">\u2715</button>
            </span>
          </div>`).join("") : allNotes.length ? `<div class="fe-hint">No note matches "${esc(ntFilter.value.trim())}".</div>` : `<div class="fe-hint">No notes yet.<br>Press n or + to write one.</div>`;
      attachNoteEvents(root);
    }
    let searchTimer = null;
    ntFilter.addEventListener("input", () => {
      const root = notesRoot();
      if (!root) return;
      const q = ntFilter.value.trim();
      bodyHits = /* @__PURE__ */ new Map();
      renderNotes(root);
      if (searchTimer) clearTimeout(searchTimer);
      if (!q || q.startsWith("#")) return;
      searchTimer = setTimeout(() => {
        notes.search(root, q).then((hits) => {
          if (ntFilter.value.trim() !== q) return;
          bodyHits = new Map(hits.map((h) => [h.rel, h.line]));
          renderNotes(root);
        }).catch(() => {
        });
      }, 250);
    });
    ntFilter.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        ntFilter.value = "";
        ntFilter.dispatchEvent(new Event("input"));
        ntFilter.blur();
      }
    });
    function refreshNotes() {
      const root = notesRoot();
      ntFilter.style.display = root ? "" : "none";
      if (!root) {
        ntHint.textContent = "";
        el("fe-notes-root").removeAttribute("href");
        ntList.innerHTML = `<div class="fe-hint">Choose a folder to store your notes.<br><button id="fe-nt-pick" class="fe-hint-action fe-icon-act" title="Pick the notes folder in the system chooser">${UI_ICON.folderOpen}<span>Choose folder</span></button><br><button id="fe-nt-setup" class="fe-hint-action" title="Type the notes folder in Settings">Type it in Settings</button></div>`;
        el("fe-nt-pick").addEventListener("click", () => app.pickNotesFolder());
        el("fe-nt-setup").addEventListener("click", () => {
          app.openSettings("notes");
          el("fe-st-notes-root").focus();
        });
        return;
      }
      el("fe-notes-root").href = "file://" + root + "/";
      notes.list(root).then((unsorted) => {
        allNotes = sharedOrder(unsorted);
        renderNotes(root);
      }).catch((err) => {
        ntHint.textContent = err.message;
        ntList.innerHTML = `<div class="fe-hint">${esc(err.code === "unavailable" ? "Notes host not installed. Run native/install.sh." : err.message)}</div>`;
      });
    }
    app.refreshNotes = refreshNotes;
    function noteRowText(n) {
      const tags = (n.tags ?? []).length ? `<span class="fe-nt-tags">${n.tags.map((t) => `<span>${UI_ICON.tag}${esc(t)}</span>`).join("")}</span>` : "";
      const flags = colorName(n.color) || n.pinned ? `<span class="fe-nt-flags">${colorName(n.color) ? colorDot(colorName(n.color)) : ""}${n.pinned ? `<span class="fe-nt-pin" title="Pinned">${UI_ICON.pin}</span>` : ""}</span>` : "";
      return `${flags}<span class="fe-nt-main"><span class="fe-sl fe-nt-label" title="${esc(noteName(n))}&#10;Double-click to rename (F2)">${midHtml(noteName(n))}</span>${tags}</span>`;
    }
    const noteName = (n) => n.title || noteTitle(n.rel);
    const notePath = (root, rel) => root.replace(/\/$/, "") + "/" + rel;
    function stepNote(root, rel, dir) {
      const shown = shownNotes();
      const pool = shown.some((n) => n.rel === rel) ? shown : allNotes;
      const at = pool.findIndex((n) => n.rel === rel);
      const next = at < 0 ? void 0 : pool[at + dir];
      if (!next) {
        toast(dir > 0 ? "That is the last note" : "That is the first note");
        return;
      }
      openNoteRel(root, next.rel);
    }
    function renameNote(root, rel, reopen) {
      const row = els(".fe-nt-item", ntList).find((i) => i.dataset.rel === rel);
      const label = row?.querySelector(".fe-nt-label");
      if (!label) {
        toast("That note is not in the list. Clear the filter first.");
        return;
      }
      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
      }
      row.scrollIntoView({ block: "nearest" });
      const meta = allNotes.find((n) => n.rel === rel);
      label.textContent = meta ? noteName(meta) : noteTitle(rel);
      inlineEdit(label, (val) => {
        notes.read(root, rel).then(async (doc) => {
          const titled = setTitle(doc.text, val);
          let now = rel;
          if (titled !== null) await notes.write(root, rel, titled, doc.mtime);
          else {
            now = rel.replace(/[^/]+$/, slugForTitle(val));
            await notes.rename(root, rel, now);
          }
          refreshNotes();
          if (reopen) openNoteRel(root, now);
        }).catch((err) => toast(err.message));
      }, () => renderNotes(root));
    }
    function deleteNote(root, rel) {
      if (editingRel() === rel) discardEditor();
      notes.delete(root, rel).then(() => {
        refreshNotes();
        toast("Moved to .trash");
      }).catch((err) => toast(err.message));
    }
    function openNoteRel(root, rel) {
      const actions = {
        step: (r, dir) => stepNote(root, r, dir),
        rename: (r) => {
          void saveEditor().then(() => renameNote(root, r, true));
        },
        del: (r) => deleteNote(root, r)
      };
      notes.read(root, rel).then((doc) => openNote(root, doc, refreshNotes, actions)).catch((err) => toast(err.message));
    }
    function openProps(root, rel, anchor) {
      notes.read(root, rel).then((doc) => openPropsMenu(anchor, readProps(rel, doc.text), async (c) => {
        const cur = await notes.read(root, rel);
        const next = applyChange(cur.text, c);
        if (frontmatterDrift(cur.text, next, changedKeys(c)).length) {
          toast("Not saved: that would change other properties");
          return;
        }
        try {
          await notes.write(root, rel, next, cur.mtime);
        } catch (err) {
          toast(err.message);
          return;
        }
        refreshNotes();
        return readProps(rel, next);
      })).catch((err) => toast(err.message));
    }
    const ntMenu = document.createElement("div");
    ntMenu.id = "fe-nt-ctx";
    ntMenu.className = "fe-ctx";
    ntMenu.style.display = "none";
    (document.getElementById("fe") ?? document.body).appendChild(ntMenu);
    const closeNtMenu = () => {
      ntMenu.style.display = "none";
    };
    function openNtMenu(root, item, x, y) {
      const rel = item.dataset.rel;
      ntMenu.innerHTML = [
        `<div class="fe-ctx-item" data-act="open">${UI_ICON.files}<span>Open</span><span class="fe-ctx-key">Enter</span></div>`,
        `<div class="fe-ctx-item" data-act="tab">${UI_ICON.tab}<span>Open in a page tab</span></div>`,
        `<div class="fe-ctx-item" data-act="rename">${UI_ICON.rename}<span>Rename</span><span class="fe-ctx-key">F2</span></div>`,
        `<div class="fe-ctx-item" data-act="props">${UI_ICON.palette}<span>Colour, pin and tags</span></div>`,
        `<div class="fe-ctx-sep"></div>`,
        `<div class="fe-ctx-item" data-act="cp-path">${UI_ICON.copy}<span>Copy path</span></div>`,
        `<div class="fe-ctx-item" data-act="cp-title">${UI_ICON.copy}<span>Copy title</span></div>`,
        `<div class="fe-ctx-sep"></div>`,
        `<div class="fe-ctx-item" data-act="delete">${UI_ICON.trash}<span>Move to .trash</span><span class="fe-ctx-key">Delete</span></div>`
      ].join("");
      ntMenu.dataset.rel = rel;
      ntMenu.dataset.root = root;
      ntMenu.style.display = "block";
      ntMenu.style.left = Math.min(x, window.innerWidth - ntMenu.offsetWidth - 8) + "px";
      ntMenu.style.top = Math.min(y, window.innerHeight - ntMenu.offsetHeight - 8) + "px";
    }
    ntMenu.addEventListener("click", (e) => {
      const item = e.target.closest(".fe-ctx-item");
      if (!item) return;
      const { rel, root } = ntMenu.dataset;
      closeNtMenu();
      const row = els(".fe-nt-item", ntList).find((i) => i.dataset.rel === rel);
      const meta = allNotes.find((n) => n.rel === rel);
      switch (item.dataset.act) {
        case "open":
          openNoteRel(root, rel);
          break;
        case "tab":
          app.strip.go(notePath(root, rel));
          break;
        case "rename":
          renameNote(root, rel, false);
          break;
        case "props":
          if (row) openProps(root, rel, row.querySelector(".fe-nt-props"));
          break;
        case "cp-path":
          void copyToClipboard(notePath(root, rel)).then((ok) => toast(ok ? "Copied path" : "Copy failed"));
          break;
        case "cp-title":
          void copyToClipboard(meta ? noteName(meta) : noteTitle(rel)).then((ok) => toast(ok ? "Copied title" : "Copy failed"));
          break;
        case "delete":
          deleteNote(root, rel);
          break;
      }
    });
    document.addEventListener("click", (e) => {
      if (ntMenu.style.display !== "none" && !ntMenu.contains(e.target)) closeNtMenu();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && ntMenu.style.display !== "none") closeNtMenu();
    });
    ntList.addEventListener("keydown", (e) => {
      const item = e.target.closest(".fe-nt-item");
      if (!item || e.target.isContentEditable || e.metaKey || e.ctrlKey || e.altKey) return;
      const root = notesRoot();
      const rel = item.dataset.rel;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const rows = els(".fe-nt-item", ntList);
        const to = rows[rows.indexOf(item) + (e.key === "ArrowDown" ? 1 : -1)];
        if (to) {
          e.preventDefault();
          to.querySelector(".fe-si-link").focus();
        }
      } else if (e.key === "F2") {
        e.preventDefault();
        renameNote(root, rel, false);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        const rows = els(".fe-nt-item", ntList);
        const keep = rows[rows.indexOf(item) + 1] ?? rows[rows.indexOf(item) - 1];
        deleteNote(root, rel);
        if (keep) {
          const keepRel = keep.dataset.rel;
          setTimeout(() => els(".fe-nt-item", ntList).find((i) => i.dataset.rel === keepRel)?.querySelector(".fe-si-link")?.focus(), 400);
        }
      }
    });
    function attachNoteEvents(root) {
      els(".fe-nt-item", ntList).forEach((item) => {
        const rel = item.dataset.rel;
        item.querySelector(".fe-si-link").addEventListener("click", (e) => {
          if (e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return;
          e.preventDefault();
          if (e.detail > 1) return;
          if (clickTimer) clearTimeout(clickTimer);
          clickTimer = setTimeout(() => {
            clickTimer = null;
            openNoteRel(root, rel);
          }, 250);
        });
        item.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          openNtMenu(root, item, e.clientX, e.clientY);
        });
        item.querySelector(".fe-nt-label").addEventListener("dblclick", (e) => {
          e.preventDefault();
          e.stopPropagation();
          renameNote(root, rel, false);
        });
        item.querySelector(".fe-rm-btn").addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          deleteNote(root, rel);
        });
        item.querySelector(".fe-nt-props").addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          openProps(root, rel, e.currentTarget);
        });
        item.querySelector(".fe-nt-tab").addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          app.strip.go(notePath(root, rel));
        });
      });
    }
    app.newNote = () => {
      const root = notesRoot();
      if (!root) {
        app.openSettings("notes");
        el("fe-st-notes-root").focus();
        return;
      }
      const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[-:T]/g, "").slice(0, 14);
      const rel = `untitled-${stamp}.md`;
      notes.create(root, rel, "").then(() => openNoteRel(root, rel)).catch((err) => toast(err.message));
    };
    app.pickNotesFolder = () => {
      notes.pick(notesRoot() || void 0).then((root) => {
        if (!root) return;
        settings.notesRoot = root;
        saveSettings(settings);
        const field = document.getElementById("fe-st-notes-root");
        if (field) field.value = root;
        refreshNotes();
      }).catch((err) => toast(err.code === "unavailable" ? "Notes host not installed. Run native/install.sh." : err.message));
    };
    el("fe-nt-add").addEventListener("click", () => app.newNote());
    refreshNotes();
    const anchorPath = (a) => decodeURIComponent((a.getAttribute("href") || "").slice(7));
    for (const host of [el("fe-side"), el("fe-bc"), el("fe-crumb-menu")]) {
      host.addEventListener("click", (e) => {
        const a = e.target.closest('a[href^="file://"]');
        if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        const path = anchorPath(a);
        if (e.altKey) {
          e.preventDefault();
          app.strip.open(isViewPath(path) ? path.split("#")[0] : path, true);
          return;
        }
        if (host.id !== "fe-side" || a.closest("#fe-nt-list") || isViewPath(path)) return;
        e.preventDefault();
        if (e.detail > 1) return;
        if (a.closest(".fe-pl-item")) {
          if (clickTimer) clearTimeout(clickTimer);
          clickTimer = setTimeout(() => {
            clickTimer = null;
            app.strip.go(path);
          }, 250);
        } else {
          app.strip.go(path);
        }
      });
    }
  }

  // src/settings-ui.ts
  function initSettingsUi(app) {
    const { fe, settings, toast } = app;
    function renderRulesList() {
      const list = el("fe-st-rules-list");
      if (!app.iconRules.length) {
        list.innerHTML = '<div class="fe-st-rules-empty">No rules yet. Click "+ Add rule" to create one.</div>';
        return;
      }
      list.innerHTML = app.iconRules.map((rule, i) => `
      <div class="fe-st-rule" data-idx="${i}">
        <input type="checkbox" class="fe-st-rule-en" title="Enable" ${rule.enabled ? "checked" : ""}>
        <div class="fe-st-rule-preview">${icoCustom(rule.label, rule.color)}</div>
        <input type="text" class="fe-st-rule-pattern" value="${esc(rule.pattern)}" placeholder="Regex" title="Regex (case-insensitive)">
        <input type="text" class="fe-st-rule-label"   value="${esc(rule.label)}"   placeholder="LBL"   maxlength="4" title="Badge text (\u22644 chars)">
        <input type="color" class="fe-st-rule-color"  value="${esc(rule.color)}"        title="Icon color">
        <button class="fe-st-rule-del" data-idx="${i}" title="Delete" aria-label="Delete icon rule">${UI_ICON.close}</button>
      </div>`).join("");
    }
    function updateTermHint() {
      const term = settings.terminalApp || "ghostty";
      const hint = document.getElementById("fe-st-term-hint");
      if (!hint) return;
      const cmd = term === "custom" ? settings.terminalCmd || "" : TERMINAL_CMDS[term] || "";
      hint.textContent = cmd ? `Command: ${cmd.replace(/\$\{p\}/g, app.folderPath)}` : "";
    }
    const settingsDlg = mountDialog("fe-settings-modal");
    function openSettings(tab) {
      els('input[name="bfb-theme"]').forEach((r) => {
        r.checked = r.value === (fe.dataset.theme || "dark");
      });
      el("fe-st-defview").value = getView();
      const order = getSortConfig();
      el("fe-st-sort").value = order.col ?? "";
      el("fe-st-sort-dir").value = order.dir;
      el("fe-st-group").value = getGroupMode();
      el("fe-st-compact").checked = !!settings.compactMode;
      el("fe-st-sidebar").checked = settings.showSidebar !== false;
      el("fe-st-datefmt").value = settings.dateFormat || "short";
      el("fe-st-terminal").value = settings.terminalApp || "ghostty";
      el("fe-st-term-custom-row").style.display = settings.terminalApp === "custom" ? "" : "none";
      el("fe-st-term-custom").value = settings.terminalCmd || "";
      el("fe-st-notes-root").value = settings.notesRoot || "";
      el("fe-st-edit-roots").value = (settings.editableFolders ?? []).join(", ");
      el("fe-st-filepages").value = settings.renderFilePages || "all";
      const excluded = Array.isArray(settings.excludedFileExtensions) ? settings.excludedFileExtensions : DEFAULT_SETTINGS.excludedFileExtensions ?? [];
      el("fe-st-excluded-exts").value = excluded.map((x) => "." + x).join(", ");
      el("fe-st-sec-recent").checked = !settings.hideRecent;
      el("fe-st-tooltips").checked = settings.tooltips !== false;
      el("fe-st-panel").value = getPreviewLayout().mode;
      el("fe-st-click").value = settings.clickOpens || "look";
      el("fe-st-rd-column").value = savedColumnMode(settings.readerColumn);
      el("fe-st-uiscale").value = String(settings.uiScale || 100);
      el("fe-st-rd-size").value = String(settings.readerSize || 15);
      el("fe-st-rd-lh").value = String(settings.readerLineHeight || 1.65);
      el("fe-st-rd-code").value = String(settings.readerCodeSize || 13);
      updateTermHint();
      renderRulesList();
      refreshAiStatus();
      settingsDlg.open(tab);
    }
    function refreshAiStatus() {
      const head = document.querySelector(".fe-st-ai-head");
      const state = document.querySelector(".fe-st-ai-state");
      const grid = el("fe-st-ai-grid");
      const hint = el("fe-st-ai-hint");
      const controls = el("fe-st-ai-controls");
      const modelSel = el("fe-st-ai-model");
      const warmBtn = el("fe-st-ai-warm");
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
        state.textContent = av.kind === "down" ? "Server down" : av.cold ? "Ready, cold: the first reply loads the model" : "Ready and warm";
        grid.innerHTML = [
          row("Default model", s.default_model || "\u2014"),
          row("Warm", s.warm ? "yes, model resident" : "no, loads on first use", s.warm ? "warm-yes" : "warm-no"),
          row("Latency", s.latency_class),
          row("Server", `${s.server}${s.host ? "  " + s.host : ""}`),
          s.toolkit_version ? row("Toolkit", `lm ${s.toolkit_version}`) : ""
        ].join("");
        if (av.kind === "ready" && s.available_models?.length) {
          const chosen = settings.aiModel || s.default_model;
          modelSel.innerHTML = s.available_models.map(
            (m) => `<option value="${esc(m)}"${m === chosen ? " selected" : ""}>${esc(m)}${m === s.default_model ? " (default)" : ""}</option>`
          ).join("");
          warmBtn.innerHTML = `${s.warm ? UI_ICON.unload : UI_ICON.warm}${s.warm ? "Unload (warm off)" : "Keep warm"}`;
          warmBtn.disabled = false;
          controls.style.display = "";
        }
        hint.innerHTML = av.kind === "down" ? `Ollama isn't responding. Start it, then Refresh.` : av.cold ? `Cold start: the first reply loads the model (about 2 to 3 s). "Keep warm" makes replies instant.` : `Model is resident, so replies are near-instant.`;
      });
    }
    el("fe-st-ai-refresh").addEventListener("click", refreshAiStatus);
    el("fe-st-ai-model").addEventListener("change", function() {
      settings.aiModel = this.value || void 0;
      saveSettings(settings);
    });
    el("fe-st-ai-warm").addEventListener("click", function() {
      const btn = this;
      const turnOn = btn.textContent !== "Unload (warm off)";
      btn.disabled = true;
      btn.textContent = turnOn ? "Warming\u2026" : "Unloading\u2026";
      llmWarm(turnOn).then((r) => {
        if (!r.ok) toast(r.message ? `Warm failed: ${r.message}` : "Warm failed");
        refreshAiStatus();
      });
    });
    el("fe-settings-btn").addEventListener("click", () => openSettings());
    const helpDlg = mountDialog("fe-help-modal");
    el("fe-help-btn").addEventListener("click", () => helpDlg.open());
    el("fe-st-keys").addEventListener("click", () => {
      settingsDlg.close();
      helpDlg.open("keys");
    });
    app.openHelp = (tab) => helpDlg.open(tab);
    app.openSettings = openSettings;
    el("fe-st-sec-recent").addEventListener("change", function() {
      settings.hideRecent = !this.checked;
      saveSettings(settings);
      app.showLens?.(this.checked ? null : "notes", !this.checked);
    });
    el("fe-st-tooltips").addEventListener("change", function() {
      settings.tooltips = this.checked;
      saveSettings(settings);
      toast(this.checked ? "Tooltips back after a reload" : "Tooltips off after a reload");
    });
    el("fe-st-panel").addEventListener("change", function() {
      savePreviewLayout({ ...getPreviewLayout(), mode: this.value });
      toast("Applies to the next preview after a reload");
    });
    el("fe-st-panel-reset").addEventListener("click", () => {
      savePreviewLayout({ mode: getPreviewLayout().mode });
      toast("Panel sizes reset");
    });
    el("fe-st-click").addEventListener("change", function() {
      settings.clickOpens = this.value;
      saveSettings(settings);
    });
    el("fe-st-rd-column").addEventListener("change", function() {
      settings.readerColumn = this.value;
      saveSettings(settings);
      try {
        kvSet(COLUMN_KEY, this.value);
      } catch {
      }
    });
    el("fe-st-rd-size").addEventListener("change", function() {
      settings.readerSize = Number(this.value);
      saveSettings(settings);
      document.documentElement.style.setProperty("--ui-text-scale", String(settings.readerSize / 15));
    });
    const readerVar = (id, key, cssVar, unit) => {
      el(id).addEventListener("change", function() {
        settings[key] = Number(this.value);
        saveSettings(settings);
        fe.style.setProperty(cssVar, this.value + unit);
      });
    };
    readerVar("fe-st-rd-lh", "readerLineHeight", "--rd-lh", "");
    readerVar("fe-st-rd-code", "readerCodeSize", "--rd-code", "px");
    el("fe-st-export").addEventListener("click", () => {
      const out = {};
      for (const k of kvKeys().sort()) {
        try {
          out[k] = JSON.parse(kvGet(k));
        } catch {
          out[k] = kvGet(k);
        }
      }
      const text = JSON.stringify(out, null, 2);
      const ta = el("fe-st-export-out");
      ta.value = text;
      ta.style.display = "";
      ta.select();
      navigator.clipboard.writeText(text).then(() => toast("Export copied to the clipboard"), () => toast("Export shown below"));
    });
    el("fe-st-import").addEventListener("click", () => el("fe-st-import-file").click());
    el("fe-st-import-file").addEventListener("change", function() {
      const f = this.files?.[0];
      if (!f) return;
      f.text().then((text) => {
        const data = JSON.parse(text);
        let n = 0;
        for (const [k, v] of Object.entries(data)) if (k.startsWith("bfb-")) {
          kvSet(k, typeof v === "string" ? v : JSON.stringify(v));
          n++;
        }
        toast(`Imported ${n} keys, reloading`);
        setTimeout(() => location.reload(), 600);
      }).catch(() => toast("That file is not a JSON export"));
    });
    els('input[name="bfb-theme"]').forEach((r) => {
      r.addEventListener("change", () => {
        fe.dataset.theme = r.value;
        kvSet(THEME_KEY, r.value);
      });
    });
    el("fe-st-defview").addEventListener("change", function() {
      kvSet(VIEW_KEY, this.value);
    });
    const applyOrder = () => {
      const col = el("fe-st-sort").value || null;
      const dir = el("fe-st-sort-dir").value;
      app.setOrder({ col, dir }, el("fe-st-group").value);
    };
    ["fe-st-sort", "fe-st-sort-dir", "fe-st-group"].forEach((id) => el(id).addEventListener("change", applyOrder));
    el("fe-st-compact").addEventListener("change", function() {
      settings.compactMode = this.checked;
      saveSettings(settings);
      fe.classList.toggle("compact", this.checked);
    });
    el("fe-st-uiscale").addEventListener("change", function() {
      settings.uiScale = Number(this.value);
      saveSettings(settings);
      fe.style.zoom = settings.uiScale === 100 ? "" : String(settings.uiScale / 100);
    });
    el("fe-st-sidebar").addEventListener("change", function() {
      settings.showSidebar = this.checked;
      saveSettings(settings);
      el("fe-side").style.display = el("fe-side-rz").style.display = this.checked ? "" : "none";
    });
    el("fe-st-datefmt").addEventListener("change", function() {
      settings.dateFormat = this.value;
      saveSettings(settings);
      app.applyAll();
    });
    el("fe-st-terminal").addEventListener("change", function() {
      settings.terminalApp = this.value;
      saveSettings(settings);
      el("fe-st-term-custom-row").style.display = this.value === "custom" ? "" : "none";
      updateTermHint();
      const termBtn = document.getElementById("fe-term-btn");
      if (termBtn) termBtn.title = `Open in terminal (${this.options[this.selectedIndex].text}), click opens the current folder, shift-click copies the command`;
    });
    el("fe-st-filepages").addEventListener("change", function() {
      settings.renderFilePages = this.value;
      saveSettings(settings);
    });
    el("fe-st-excluded-exts").addEventListener("change", function() {
      settings.excludedFileExtensions = parseExcludedExtensions(this.value);
      this.value = settings.excludedFileExtensions.map((x) => "." + x).join(", ");
      saveSettings(settings);
    });
    el("fe-st-excluded-reset").addEventListener("click", () => {
      settings.excludedFileExtensions = [...DEFAULT_SETTINGS.excludedFileExtensions ?? []];
      el("fe-st-excluded-exts").value = settings.excludedFileExtensions.map((x) => "." + x).join(", ");
      saveSettings(settings);
    });
    el("fe-st-notes-pick").addEventListener("click", () => app.pickNotesFolder());
    el("fe-st-notes-root").addEventListener("change", function() {
      settings.notesRoot = this.value.trim() || void 0;
      saveSettings(settings);
      app.refreshNotes();
    });
    el("fe-st-edit-roots").addEventListener("change", function() {
      const list = this.value.split(",").map((s) => s.trim()).filter(Boolean);
      settings.editableFolders = list.length ? list : void 0;
      saveSettings(settings);
    });
    el("fe-st-term-custom").addEventListener("input", function() {
      settings.terminalCmd = this.value;
      saveSettings(settings);
      updateTermHint();
    });
    const rulesList = el("fe-st-rules-list");
    const ruleAt = (e) => {
      const row = e.target.closest(".fe-st-rule");
      if (!row) return null;
      const idx = parseInt(row.dataset.idx);
      return isNaN(idx) || idx >= app.iconRules.length ? null : [row, idx];
    };
    rulesList.addEventListener("change", (e) => {
      const hit = ruleAt(e);
      if (!hit) return;
      const [row, idx] = hit;
      const t = e.target;
      if (t.classList.contains("fe-st-rule-en")) app.iconRules[idx].enabled = t.checked;
      if (t.classList.contains("fe-st-rule-color")) {
        app.iconRules[idx].color = t.value;
        row.querySelector(".fe-st-rule-preview").innerHTML = icoCustom(app.iconRules[idx].label, app.iconRules[idx].color);
      }
      saveIconRules(app.iconRules);
      app.applyAll();
    });
    rulesList.addEventListener("input", (e) => {
      const hit = ruleAt(e);
      if (!hit) return;
      const [row, idx] = hit;
      const t = e.target;
      if (t.classList.contains("fe-st-rule-pattern")) app.iconRules[idx].pattern = t.value;
      if (t.classList.contains("fe-st-rule-label")) {
        app.iconRules[idx].label = t.value;
        row.querySelector(".fe-st-rule-preview").innerHTML = icoCustom(app.iconRules[idx].label, app.iconRules[idx].color);
      }
      saveIconRules(app.iconRules);
      app.applyAll();
    });
    rulesList.addEventListener("click", (e) => {
      const del = e.target.closest(".fe-st-rule-del");
      if (!del) return;
      const idx = parseInt(del.dataset.idx);
      if (!isNaN(idx)) {
        app.iconRules.splice(idx, 1);
        saveIconRules(app.iconRules);
        app.applyAll();
        renderRulesList();
      }
    });
    el("fe-st-add-rule").addEventListener("click", () => {
      app.iconRules.push({ id: "r" + Date.now(), pattern: "", label: "NEW", color: "#58a6ff", enabled: true });
      saveIconRules(app.iconRules);
      renderRulesList();
      const inputs = els(".fe-st-rule-pattern", rulesList);
      inputs[inputs.length - 1]?.focus();
    });
    el("fe-st-reset-rules").addEventListener("click", () => {
      app.iconRules = DEFAULT_ICON_RULES.map((r) => ({ ...r }));
      saveIconRules(app.iconRules);
      app.applyAll();
      renderRulesList();
      toast("Icon rules reset to defaults");
    });
  }

  // src/md-ui.ts
  function initMarkdownUi(toast) {
    const rendered = /* @__PURE__ */ new WeakMap();
    const pending = /* @__PURE__ */ new WeakSet();
    let sequence = 0;
    let queue = Promise.resolve();
    const theme = () => document.getElementById("fe")?.dataset.theme === "light" ? "light" : "dark";
    const renderDiagrams = () => {
      document.querySelectorAll(".fe-md-mermaid").forEach((block) => {
        if (pending.has(block) || rendered.get(block) === theme()) return;
        pending.add(block);
        queue = queue.then(async () => {
          if (!block.isConnected) return;
          const source = block.querySelector(".fe-md-mermaid-source")?.textContent || "";
          const view = block.querySelector(".fe-md-mermaid-view");
          if (!view) return;
          const currentTheme = theme();
          try {
            const { default: mermaid } = await import(chrome.runtime.getURL("vendor-mermaid.js"));
            mermaid.initialize({
              startOnLoad: false,
              securityLevel: "strict",
              htmlLabels: false,
              suppressErrorRendering: true,
              theme: currentTheme === "light" ? "default" : "dark"
            });
            const { svg: svg2 } = await mermaid.render(`fe-mermaid-${++sequence}`, source);
            if (block.isConnected) view.innerHTML = svg2;
          } catch {
            view.textContent = "Could not render this Mermaid diagram.";
            block.querySelector(".fe-md-mermaid-source")?.removeAttribute("hidden");
          }
          rendered.set(block, currentTheme);
        }).catch(() => {
        }).finally(() => {
          pending.delete(block);
          if (block.isConnected && rendered.get(block) !== theme()) renderDiagrams();
        });
      });
    };
    const fe = document.getElementById("fe");
    if (fe) {
      new MutationObserver(renderDiagrams).observe(fe, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["data-theme"]
      });
      renderDiagrams();
    }
    document.addEventListener("click", (e) => {
      const t = e.target;
      const copy = t.closest(".fe-md-copy");
      if (copy) {
        e.preventDefault();
        const pre = copy.closest(".fe-md-code")?.querySelector("pre");
        copyToClipboard(pre?.textContent || "").then((ok) => {
          if (!ok) {
            toast("Copy failed");
            return;
          }
          clearTimeout(Number(copy.dataset.timer));
          copy.classList.add("copied");
          copy.innerHTML = UI_ICON.check;
          copy.dataset.timer = String(window.setTimeout(() => {
            copy.classList.remove("copied");
            copy.innerHTML = UI_ICON.copy;
          }, 3e3));
        });
        return;
      }
      const img = t.closest(".fe-md img");
      if (img && !img.closest("a")) {
        e.preventDefault();
        window.open(img.src, "_blank");
      }
    });
  }

  // src/tooltip.ts
  var DELAY = 350;
  function initTooltips(root) {
    const tip = document.createElement("div");
    tip.id = "fe-hint";
    tip.setAttribute("role", "tooltip");
    root.appendChild(tip);
    let target = null;
    let lifted = "";
    let labelled = false;
    let timer = 0;
    function hide() {
      clearTimeout(timer);
      tip.classList.remove("on");
      if (target && lifted && !target.hasAttribute("title")) target.setAttribute("title", lifted);
      if (target && labelled) target.removeAttribute("aria-label");
      target = null;
      lifted = "";
      labelled = false;
    }
    function place() {
      if (!target) return;
      const r = target.getBoundingClientRect();
      const t = tip.getBoundingClientRect();
      let top = r.bottom + 6;
      if (top + t.height > innerHeight - 4) top = r.top - t.height - 6;
      const left = Math.min(Math.max(4, r.left + r.width / 2 - t.width / 2), innerWidth - t.width - 4);
      tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    }
    root.addEventListener("pointerover", (e) => {
      const el2 = e.target.closest("[title]");
      if (!el2 || el2 === target || !root.contains(el2)) return;
      hide();
      const text = el2.getAttribute("title")?.trim();
      if (!text) return;
      if (text === el2.textContent?.trim() && el2.scrollWidth <= el2.clientWidth) return;
      target = el2;
      lifted = text;
      el2.removeAttribute("title");
      if (!el2.hasAttribute("aria-label")) {
        el2.setAttribute("aria-label", text);
        labelled = true;
      }
      timer = window.setTimeout(() => {
        if (target !== el2) return;
        tip.textContent = text;
        tip.classList.add("on");
        place();
      }, DELAY);
    });
    root.addEventListener("pointerout", (e) => {
      if (target && !target.contains(e.relatedTarget)) hide();
    });
    root.addEventListener("pointerdown", hide, true);
    root.addEventListener("scroll", hide, true);
    document.addEventListener("keydown", hide, true);
  }

  // src/main.ts
  async function showClosedSets(strip, visible) {
    const box = document.getElementById("fe-rc-sets");
    if (!box) return;
    const section = box.closest(".fe-sec");
    const ago = (at) => {
      const m = Math.round((Date.now() - at) / 6e4);
      return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
    };
    let timer = 0;
    const later = (ms) => {
      clearTimeout(timer);
      timer = window.setTimeout(() => void paint(), ms);
    };
    async function paint() {
      const all = await strip.closedSets();
      const settle = 2500;
      const young = all.filter((s) => Date.now() - s.at < settle);
      if (young.length) later(settle - (Date.now() - Math.min(...young.map((s) => s.at))) + 100);
      const sets = all.filter((s) => !young.includes(s)).slice(0, 3);
      box.innerHTML = sets.map((s) => {
        const n = s.labels.length;
        return `<button type="button" class="fe-si fe-rc-set" data-set="${esc(s.id)}" title="Add these tabs to this strip: ${esc(s.labels.join(", "))}">${PI.tabset}<span class="fe-sl">${n} tab${n === 1 ? "" : "s"}: ${esc(s.labels.slice(0, 3).join(", "))}${n > 3 ? "\u2026" : ""}</span><span class="fe-rc-ago">${ago(s.at)}</span></button>`;
      }).join("");
      if (visible && (sets.length || section.querySelector("a.fe-si"))) section.style.display = "";
    }
    box.addEventListener("click", (e) => {
      const b = e.target.closest(".fe-rc-set");
      if (b) void strip.restoreSet(b.dataset.set).then(paint);
    });
    try {
      chrome.storage.onChanged.addListener((changes, name) => {
        if (name === "local" && Object.keys(changes).some((k) => k.startsWith("bfb-strip-v2:"))) later(300);
      });
    } catch {
    }
    await paint();
  }
  loadKv().catch(() => {
  }).then(function() {
    const preload = document.getElementById("bfb-preload");
    const settings = getSettings();
    const viewName = location.hash.startsWith("#view=") ? location.hash.slice(6) : "";
    const viewHref = viewName ? location.href.split("#")[0] + viewName : "";
    const fileExt = filePageExt(viewName ? location.pathname + viewName : location.pathname);
    const fileMode = !!fileExt && (!!viewName || filePagesEnabled(fileExt, settings));
    if (!fileMode && !document.title.startsWith("Index of")) {
      preload?.remove();
      return;
    }
    const isHtmlSource = fileMode && (fileExt === "html" || fileExt === "htm");
    const fetchSource = isHtmlSource || !!viewName;
    const fileText = fileMode ? fetchSource ? "Loading\u2026" : document.body.textContent || "" : "";
    const rawPath = decodeURIComponent(window.location.pathname + viewName);
    const segments = rawPath.split("/").filter(Boolean);
    const fileName = fileMode ? segments.pop() || "" : "";
    const folderPath = fileMode ? "/" + segments.join("/") + (segments.length ? "/" : "") : rawPath;
    const entries = fileMode ? [] : parseEntries();
    if (!fileMode && segments.length && !entries.some((e) => e.isParent)) {
      const parentSegs = segments.slice(0, -1);
      entries.unshift({
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
    const nonPar = entries.filter((e) => !e.isParent);
    const dirs = nonPar.filter((e) => e.isDir).length;
    const files = nonPar.filter((e) => !e.isDir).length;
    const allExts = [...new Set(nonPar.filter((e) => !e.isDir && getExt(e)).map(getExt))].sort();
    const extOpts = allExts.map((x) => `<option value="${x}">.${x}</option>`).join("");
    const iconRules = getIconRules();
    const initZoom = getZoom();
    const initView = getView();
    const initTheme = getTheme();
    const initHidden = getShowHidden();
    const recents = getRecents().filter((r) => r.path !== rawPath).slice(0, 10);
    pushRecent(rawPath);
    const recentsHTML = `
      <div class="fe-sec" data-sec="recent" data-collapse="recent">
        <div class="fe-sh"><span class="fe-sh-label">Opened lately</span></div>
        ${recents.length ? recents.map((r) => {
      const lbl = r.path.split("/").filter(Boolean).pop() || "/";
      return `<a href="file://${esc(r.path)}" class="fe-si" title="${esc(r.path)}">${PI.recent}<span class="fe-sl">${esc(lbl)}</span></a>`;
    }).join("") : '<div class="fe-hint">Nothing yet. Folders and files you open show up here.</div>'}
        <div id="fe-rc-sets"></div>
      </div>`;
    const html = renderPage({
      initTheme,
      initView,
      initZoom,
      initHidden,
      fileMode,
      rawPath,
      folderPath,
      fileName,
      segments,
      settings,
      curIsBookmarked: getSaved().some((p) => p.path === rawPath),
      dirs,
      files,
      extOpts,
      recentsHTML,
      entries,
      ctx: { rawPath, iconRules, settings }
    });
    const dirName = fileMode ? fileName : segments[segments.length - 1] || "/";
    const shortDir = dirName.length > 20 ? dirName.slice(0, 20) + "\u2026" : dirName;
    document.title = `${shortDir} | Better File Browser`;
    document.head.innerHTML = `<meta charset="utf-8"><title>${document.title}</title><link rel="icon" type="image/svg+xml" href="${chrome.runtime.getURL("assets/favicon.svg")}">`;
    document.body.innerHTML = html;
    const styleEl = document.createElement("style");
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);
    preload?.remove();
    const fe = el("fe");
    if (settings.sidebarWidth && !settings.sidebarRail) {
      settings.sidebarWidth += 52;
      settings.sidebarRail = true;
      saveSettings(settings);
    }
    if (settings.sidebarWidth) el("fe-side").style.width = settings.sidebarWidth + "px";
    if (!settings.showSidebar) {
      el("fe-side").style.display = "none";
      el("fe-side-rz").style.display = "none";
    }
    if (settings.uiScale && settings.uiScale !== 100) fe.style.zoom = String(settings.uiScale / 100);
    if (settings.compactMode) fe.classList.add("compact");
    document.documentElement.style.setProperty("--ui-text-scale", String((settings.readerSize || 15) / 15));
    fe.style.setProperty("--rd-lh", String(settings.readerLineHeight || 1.65));
    fe.style.setProperty("--rd-code", `${settings.readerCodeSize || 13}px`);
    if (settings.tooltips === false) fe.classList.add("fe-notips");
    const app = {
      fileMode,
      rawPath,
      folderPath,
      fileName,
      fe,
      settings,
      iconRules,
      toast: makeToast(el("fe-toast")),
      strip: null,
      filePage: null,
      applyAll: () => {
      },
      setOrder: () => {
      },
      refreshSaved: () => {
      },
      refreshNotes: () => {
      },
      newNote: () => {
      },
      pickNotesFolder: () => {
      },
      openInTerminal: () => {
      },
      openHelp: () => {
      },
      openSettings: () => {
      },
      goUp: () => {
        if (fileMode) {
          location.href = "file://" + folderPath;
          return;
        }
        const up = entries.find((x) => x.isParent);
        if (up) location.href = up.href;
        else if (rawPath !== "/") location.href = "file:///";
      }
    };
    initPreview({ iconRules: () => app.iconRules, aiModel: () => settings.aiModel, keepTab: (path) => {
      app.strip.open(path, true);
      app.toast("Kept as a tab");
    }, saveError: (message) => app.toast(message), toast: (message) => app.toast(message) });
    app.strip = mountStrip({ el: el("fe-tabs"), rawPath, toast: app.toast, onSavedChange: () => app.refreshSaved() });
    void showClosedSets(app.strip, !settings.hideRecent);
    if (fileMode) {
      const href = viewHref || location.href;
      app.filePage = mountFileContent({ ext: fileExt, text: fileText, rawPath, href, column: settings.readerColumn, editableFolders: settings.editableFolders });
      if (fetchSource) fetchFileText(href).then((text) => app.filePage?.setText(text)).catch(() => {
        app.filePage?.setText("Could not read this file.");
      });
    }
    document.addEventListener("mousedown", (e) => {
      const a = e.target.closest?.('a[href^="file://"]');
      if (a) {
        const v = pageHref(a.href);
        if (v !== a.href) a.href = v;
      }
    }, true);
    window.addEventListener("hashchange", () => {
      if (location.hash.startsWith("#view=") || viewName) location.reload();
    });
    initChrome(app);
    initMarkdownUi(app.toast);
    installColumnResize();
    const listing = initListing(app, entries, { view: initView, zoom: initZoom, hidden: initHidden });
    initListingInput(app, listing);
    initSettingsUi(app);
    initSidebar(app);
    listing.applyAll();
    listing.applyFindFromHash();
    if (settings.tooltips === false) {
      const strip = () => document.querySelectorAll("[title]").forEach((x) => x.removeAttribute("title"));
      strip();
      new MutationObserver(strip).observe(fe, { childList: true, subtree: true });
    } else {
      initTooltips(document.body);
    }
  });
})();
