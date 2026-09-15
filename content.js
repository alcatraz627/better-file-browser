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
  function readList(key) {
    try {
      const v = JSON.parse(localStorage.getItem(key) ?? "[]");
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }
  function getSaved() {
    if (localStorage.getItem(SAVED_KEY) !== null) return readList(SAVED_KEY);
    const merged = mergeLegacy(readList(BM_KEY), readList(PLACES_KEY));
    localStorage.setItem(SAVED_KEY, JSON.stringify(merged));
    return merged;
  }
  function saveSaved(list) {
    localStorage.setItem(SAVED_KEY, JSON.stringify(list));
    localStorage.setItem(TAGS_KEY, JSON.stringify(reconcileTags(list, readList(TAGS_KEY))));
  }
  function getTags() {
    return reconcileTags(getSaved(), readList(TAGS_KEY));
  }
  function saveTags(tags) {
    localStorage.setItem(TAGS_KEY, JSON.stringify(tags));
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
  var SORT_COLS = ["name", "size", "date", "type", "ext"];
  var GROUP_MODES = ["none", "folders-first", "files-first", "ext", "type"];
  function getSortConfig() {
    try {
      const s = JSON.parse(localStorage.getItem(SORT_KEY) ?? "null");
      if (s && SORT_COLS.includes(s.col) && (s.dir === "asc" || s.dir === "desc")) return { col: s.col, dir: s.dir };
    } catch {
    }
    return { col: null, dir: "asc" };
  }
  function saveSortConfig(s) {
    localStorage.setItem(SORT_KEY, JSON.stringify(s));
  }
  function getGroupMode() {
    const g = localStorage.getItem(GROUP_KEY);
    return g && GROUP_MODES.includes(g) ? g : "none";
  }
  function saveGroupMode(g) {
    localStorage.setItem(GROUP_KEY, g);
  }
  var px = (v) => typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : void 0;
  function getPreviewLayout() {
    try {
      const l = JSON.parse(localStorage.getItem(PREVIEW_LAYOUT_KEY) ?? "null");
      if (l && (l.mode === "modal" || l.mode === "side"))
        return { mode: l.mode, modalW: px(l.modalW), modalH: px(l.modalH), sideW: px(l.sideW) };
    } catch {
    }
    return { mode: "modal" };
  }
  function savePreviewLayout(l) {
    localStorage.setItem(PREVIEW_LAYOUT_KEY, JSON.stringify(l));
  }
  function getView() {
    return localStorage.getItem(VIEW_KEY) ?? "details";
  }
  function getTheme() {
    return localStorage.getItem(THEME_KEY) ?? "dark";
  }
  function getZoom() {
    const z = parseInt(localStorage.getItem(ZOOM_KEY) ?? "100");
    return Number.isFinite(z) ? z : 100;
  }
  function getShowHidden() {
    return localStorage.getItem(HIDDEN_KEY) === "true";
  }

  // src/dialog.ts
  function renderDialog(d) {
    return `
  <div id="${esc(d.id)}" class="fe-dlg" style="display:none">
    <div class="fe-dlg-bg"></div>
    <div class="fe-dlg-box" role="dialog" aria-labelledby="${esc(d.id)}-title" tabindex="-1">
      <div class="fe-dlg-title">
        <span class="fe-dlg-mark">${d.mark}</span>
        <span class="fe-dlg-tx"><b id="${esc(d.id)}-title">${esc(d.title)}</b><i>${esc(d.subtitle)}</i></span>
        <button class="fe-dlg-close" title="Close (Esc)">\u2715</button>
      </div>
      <div class="fe-dlg-tabs" role="tablist">
        ${d.tabs.map((t) => `<button class="fe-dlg-tab" role="tab" data-tab="${esc(t.key)}" title="${esc(t.label)} \xB7 [ ] switch tabs \xB7 Esc closes"><b>${esc(t.label)}</b>${t.hint ? `<i>${esc(t.hint)}</i>` : ""}</button>`).join("")}
      </div>
      ${d.tabs.map((t) => `<div class="fe-dlg-pane" role="tabpanel" data-tab="${esc(t.key)}">${t.body}</div>`).join("")}
    </div>
  </div>`;
  }
  var focusBefore = null;
  function rememberFocus() {
    focusBefore = document.activeElement;
  }
  function restoreFocus() {
    const el2 = focusBefore;
    focusBefore = null;
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
        localStorage.setItem(memory, tab);
      } catch {
      }
    }
    function open(tab) {
      rememberFocus();
      hooks.onOpen?.();
      let last = "";
      try {
        last = localStorage.getItem(memory) || "";
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
  function highlightCode(src, ext2) {
    const langKey = EXT_LANG[ext2.toLowerCase()] ?? "plain";
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
      const el2 = node;
      const tag = el2.tagName.toLowerCase();
      const kids = Array.from(el2.childNodes).map(walk).join("");
      if (!HTML_TAGS.has(tag)) return kids;
      let attrs = "";
      for (const a of Array.from(el2.attributes)) {
        if (!HTML_ATTRS.has(a.name)) continue;
        let val = a.value;
        if (a.name === "src" || a.name === "href") {
          if (badUrl(val)) continue;
          val = resolveMdUrl(baseUrl, val);
        }
        attrs += ` ${a.name}="${esc(val)}"`;
      }
      if (tag === "a" && /^https?:/i.test(resolveMdUrl(baseUrl, el2.getAttribute("href") ?? ""))) {
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
  function headingId(text, seen) {
    let id = text.trim().toLowerCase().replace(/[^a-z0-9À-ɏͰ-﷏]+/g, "-").replace(/^-+|-+$/g, "") || "section";
    const n = seen.get(id) ?? 0;
    seen.set(id, n + 1);
    if (n) id += "-" + n;
    return id;
  }
  function renderMarkdown(src, baseUrl = "") {
    const lines = src.replace(/\r\n/g, "\n").split("\n");
    const out = [];
    let para = [];
    const seenIds = /* @__PURE__ */ new Map();
    let i = 0;
    if (lines[0] === "---") {
      const end = lines.slice(1, 60).findIndex((l) => l === "---");
      if (end >= 0) {
        const rows = lines.slice(1, end + 1).map((l) => l.match(/^([\w.-]+)\s*:\s*(.*)$/)).filter(Boolean);
        if (rows.length) out.push(`<dl class="fe-md-fm">${rows.map((m) => `<dt>${esc(m[1])}</dt><dd>${mdInline(m[2], baseUrl)}</dd>`).join("")}</dl>`);
        i = end + 2;
      }
    }
    const flush = () => {
      if (para.length) {
        out.push(`<p>${mdInline(para.join(" "), baseUrl)}</p>`);
        para = [];
      }
    };
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
        out.push(`<div class="fe-md-code"><div class="fe-md-code-bar"><span class="fe-md-lang">${esc(fence[1] || "text")}</span><button class="fe-md-copy" title="Copy this block">copy</button></div><pre class="fe-md-pre">${fence[1] ? highlightCode(code, fence[1]) : esc(code)}</pre></div>`);
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
          const task = m[3].match(/^\[( |x|X)\]\s+(.*)$/);
          items.push(task ? `<li class="fe-task" style="margin-left:${depth * 18}px"><input type="checkbox" disabled${task[1] === " " ? "" : " checked"}> ${mdInline(task[2], baseUrl)}</li>` : `<li style="margin-left:${depth * 18}px">${mdInline(m[3], baseUrl)}</li>`);
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
        out.push(`<div class="fe-md-tablewrap"><table class="fe-md-table"><thead><tr>${head.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
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
    delete: (root, rel) => call({ op: "delete", root, rel })
  };
  function slugForTitle(title) {
    const s = title.replace(/^#+\s*/, "").trim().toLowerCase().replace(/[^a-z0-9À-ɏͰ-﷏]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
    return (s || "untitled") + ".md";
  }
  function noteTitle(rel, text) {
    if (text) {
      const fm = text.match(/^---\n([\s\S]*?)\n---/);
      const t = fm?.[1].match(/^title:\s*(.+)$/m)?.[1].trim().replace(/^["']|["']$/g, "");
      if (t) return t;
      const h = text.match(/^#\s+(.+)$/m)?.[1].trim();
      if (h) return h;
    }
    return rel.split("/").pop().replace(/\.md$/i, "").replace(/[-_]+/g, " ");
  }
  function newNoteText(title, now = /* @__PURE__ */ new Date()) {
    const iso = now.toISOString();
    return `---
title: ${title}
tags: []
created: ${iso}
updated: ${iso}
---

# ${title}

`;
  }
  function stampUpdated(text, now = /* @__PURE__ */ new Date()) {
    const m = text.match(/^---\n([\s\S]*?)\n---/);
    if (!m) return text;
    const iso = now.toISOString();
    const fm = /^updated:.*$/m.test(m[1]) ? m[1].replace(/^updated:.*$/m, `updated: ${iso}`) : m[1] + `
updated: ${iso}`;
    return text.replace(m[0], `---
${fm}
---`);
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
    if (currentEntry && deps.keepTab) deps.keepTab(decodeURIComponent(new URL(currentEntry.href, location.href).pathname));
  }
  var deps;
  var overlay;
  var layout = getPreviewLayout();
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
        <a id="fe-ql-name" target="_blank" rel="noopener" title="Open natively in a new tab (\u2318-click / middle-click also work)"></a>
        <span id="fe-ql-meta"></span>
        <button id="fe-ql-copy" title="Copy full file contents to clipboard" disabled>
          <svg width="11" height="12" viewBox="0 0 11 12"><rect x="3" y="3" width="7" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M1 1h6v1" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
          <span>copy</span>
        </button>
        <a id="fe-ql-open" target="_blank" rel="noopener" title="Open raw file in a new tab">open raw \u2197</a>
        <button id="fe-ql-go" title="Open in this tab (Enter)">open</button>
        <button id="fe-ql-tab" title="Keep as a strip tab (t)">+ tab</button>
        <button id="fe-ql-dock" title="Dock the preview to the side">
          <svg width="13" height="13" viewBox="0 0 13 13"><rect x="1" y="1.5" width="11" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M8 1.5v10" stroke="currentColor" stroke-width="1.3"/></svg>
        </button>
        <button id="fe-ql-close" title="Close (Esc)">\u2715</button>
      </div>
      <div id="fe-ql-rz" title="Drag to resize"></div>
      <div id="fe-ql-rz-side" title="Drag to resize"></div>
      <div id="fe-ql-ai" style="display:none">
        <span id="fe-ql-ai-chip"><span class="dot"></span><span id="fe-ql-ai-chip-txt"></span></span>
        <button class="fe-ql-ai-btn" id="fe-ql-ai-sum" title="TL;DR of this file (local model)">Summarize</button>
        <button class="fe-ql-ai-btn" id="fe-ql-ai-exp" title="Explain this file, or describe a table (local model)"></button>
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
    document.getElementById("fe-ql-go").addEventListener("click", () => {
      if (currentEntry) location.href = currentEntry.href;
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
  function editHeader(status) {
    if (!edit) return;
    const nameEl = document.getElementById("fe-ql-name");
    nameEl.textContent = (edit.dirty ? "\u25CF " : "") + noteTitle(edit.rel, edit.text);
    document.getElementById("fe-ql-meta").textContent = `${edit.rel} \xB7 ${status}`;
  }
  var stripFrontMatter = (t) => t.replace(/^---\n[\s\S]*?\n---\n?/, "");
  function openNote(root, doc, onSaved) {
    if (edit && edit.dirty) void saveNote();
    currentEntry = null;
    reqSeq++;
    edit = { root, rel: doc.rel, mtime: doc.mtime, text: doc.text, dirty: false, saving: false, timer: null, onSaved };
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
    <div id="fe-ed-bar">
      <button class="fe-pbn" data-act="bold" title="Bold (\u2318B)"><b>B</b></button>
      <button class="fe-pbn" data-act="italic" title="Italic (\u2318I)"><i>I</i></button>
      <button class="fe-pbn" data-act="code" title="Code (\u2318E)">\u2039\u203A</button>
      <button class="fe-pbn" data-act="list" title="Bullet list">\u2022 list</button>
      <button class="fe-pbn" data-act="task" title="Task list">\u2610 task</button>
      <button class="fe-pbn" data-act="table" title="Insert a table">table</button>
      <button class="fe-pbn" data-act="image" title="Insert an image (or paste / drop one)">image</button>
      <input type="file" id="fe-ed-file" accept="image/*" style="display:none">
      <span class="fe-ed-hint">\u2325\u2191\u2193 move line \xB7 \u2325\u21E7\u2191\u2193 duplicate \xB7 \u21E5 indent \xB7 Enter continues lists</span>
    </div>
    <div class="fe-ed"><textarea id="fe-ed-src" spellcheck="true"></textarea><div id="fe-ed-view" class="fe-md"></div></div>`;
    const ta = document.getElementById("fe-ed-src");
    const view = document.getElementById("fe-ed-view");
    ta.value = doc.text;
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
      if (name === "list") prefixLines("- ");
      if (name === "task") prefixLines("- [ ] ");
      if (name === "table") buf.insert((ta.value.slice(0, ta.selectionStart).endsWith("\n") || !ta.selectionStart ? "" : "\n") + tableSnippet());
      if (name === "image") document.getElementById("fe-ed-file").click();
    };
    document.getElementById("fe-ed-bar").querySelectorAll("[data-act]").forEach((b) => b.addEventListener("mousedown", (e) => {
      e.preventDefault();
      act(b.dataset.act);
    }));
    const addImage = async (file) => {
      const st = edit;
      if (!st || st.root !== root) return;
      const ext2 = (file.type.split("/")[1] || "png").replace("jpeg", "jpg");
      const rel = `attachments/${slugForTitle(noteTitle(st.rel, st.text)).replace(/\.md$/, "")}-${Date.now().toString(36)}.${ext2}`;
      const b64 = await new Promise((res) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(",")[1] || "");
        r.readAsDataURL(file);
      });
      try {
        await notes.writeBinary(root, rel, b64);
        const depth = st.rel.split("/").length - 1;
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
      view.innerHTML = renderMarkdown(stripFrontMatter(ta.value), nameEl.href);
    };
    renderView();
    let viewTimer = null;
    ta.addEventListener("input", () => {
      if (!edit) return;
      edit.text = ta.value;
      edit.dirty = true;
      currentText = ta.value;
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
    editHeader("saved");
    ta.focus();
  }
  async function saveNote() {
    const st = edit;
    if (!st || st.saving) return;
    if (st.timer) {
      clearTimeout(st.timer);
      st.timer = null;
    }
    st.saving = true;
    const text = stampUpdated(st.text);
    try {
      const r = await notes.write(st.root, st.rel, text, st.mtime);
      st.mtime = r.mtime;
      st.dirty = false;
      const want = slugForTitle(noteTitle(st.rel, st.text));
      if (/^untitled-/.test(st.rel.split("/").pop()) && !/^untitled/.test(want)) {
        const to = st.rel.replace(/[^/]+$/, want);
        try {
          await notes.rename(st.root, st.rel, to);
          st.rel = to;
        } catch {
        }
      }
      if (edit === st) editHeader("saved " + (/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
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
              notes.read(st.root, st.rel).then((d) => openNote(st.root, d, st.onSaved));
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
      }
    } finally {
      st.saving = false;
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
    currentEntry = e;
    const seq = ++reqSeq;
    const ext2 = getExt(e);
    document.getElementById("fe-ql-icon").innerHTML = getIcon(e, deps.iconRules());
    const nameEl = document.getElementById("fe-ql-name");
    nameEl.textContent = e.name;
    nameEl.href = e.href;
    document.getElementById("fe-ql-meta").textContent = [e.rawBytes >= 0 ? fmtSize(e.rawBytes) : "", ext2 ? "." + ext2 : ""].filter(Boolean).join(" \xB7 ");
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
  function restoreScroll(body) {
    const top = currentEntry ? scrollMemo.get(currentEntry.href) : void 0;
    if (top) body.scrollTop = top;
  }

  // src/styles.ts
  var CSS = `
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
html:has(#fe[data-theme="light"]){
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
#fe-sv-add{background:none;border:1px solid var(--bd);color:var(--mt);cursor:pointer;border-radius:4px;
  width:18px;height:18px;line-height:1;font-size:13px;padding:0;display:flex;align-items:center;justify-content:center}
#fe-sv-add:hover{border-color:var(--ac);color:var(--ac)}
#fe-sv-filter{display:block;width:calc(100% - 20px);margin:0 10px 4px;box-sizing:border-box;background:var(--s1);border:1px solid var(--bd);color:var(--tx);
  padding:3px 8px;border-radius:var(--r);font-size:11px;outline:none;transition:border-color .15s}
#fe-sv-filter:focus{border-color:var(--ac)}
#fe-sv-filter::placeholder{color:var(--dm)}
.fe-pl-label.editing,.fe-pl-tags.editing{outline:1px solid var(--ac);border-radius:3px;background:var(--s2);padding:0 3px;cursor:text}
.fe-sv-tag{display:flex;align-items:center;gap:7px;padding:8px 14px 3px;font-size:10.5px;font-weight:600;
  text-transform:uppercase;letter-spacing:.07em;color:var(--dm)}
.fe-sv-dot{width:9px;height:9px;border-radius:50%;cursor:pointer;flex-shrink:0;box-shadow:0 0 0 1px #0004}
.fe-sv-dot:hover{transform:scale(1.25)}
.fe-pl-dots{display:flex;gap:3px;margin-left:auto;padding-right:2px}
.fe-sv-mini{width:6px;height:6px;border-radius:50%;display:inline-block}
.fe-pl-tags{display:none;font-size:11px;color:var(--mt);min-width:60px;max-width:110px;white-space:nowrap;overflow:hidden}
.fe-pl-tags.show{display:inline-block}
.fe-tag-btn{background:none;border:none;color:var(--dm);cursor:pointer;padding:4px 4px;font-size:12px;opacity:0;transition:opacity .1s,color .1s;flex-shrink:0}
.fe-bm-item:hover .fe-tag-btn{opacity:1}
.fe-tag-btn:hover{color:var(--ac)}
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
#fe-deep-btn.on{border-color:var(--ac);color:var(--ac);background:var(--act)}
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
#fe-find-text{background:var(--s2);border:1px solid var(--bd);color:var(--tx);padding:4px 8px;border-radius:5px;font-size:12px;width:260px;outline:none}
#fe-find-text:focus{border-color:var(--ac)}
#fe-find-status{font-size:11px;color:var(--mt);margin-left:4px}
.fe-view .fe-si-link svg{color:var(--ac);opacity:.9}
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
#fe-tiles{display:none;flex-wrap:wrap;gap:4px 6px;padding:10px 12px;align-content:flex-start;align-items:flex-start}
#fe[data-view="tiles"] #fe-table,#fe[data-view="icons"] #fe-table{display:none}
#fe[data-view="tiles"] #fe-tiles,#fe[data-view="icons"] #fe-tiles{display:flex}
.fe-tile{display:flex;flex-direction:column;align-items:center;gap:3px;
  padding:8px 6px 7px;border-radius:var(--r);text-decoration:none;
  color:var(--tx);border:1px solid transparent;transition:all .12s;
  width:96px;overflow:hidden;cursor:pointer;position:relative}
.fe-tile:hover{background:var(--hover);border-color:var(--bd)}
.fe-tile-ic{font-size:0;line-height:0}
.fe-tile-ic svg{display:block}
.fe-tile-nm{font-size:11px;text-align:center;overflow-wrap:anywhere;word-break:normal;max-width:100%;
  overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
  line-height:1.3}
.fe-tile-sz{font-size:10px;color:var(--dm)}
.fe-tile.dir .fe-tile-nm{color:var(--dir)}
.fe-tile.par .fe-tile-nm{color:var(--dm)}
#fe[data-view="tiles"] .fe-tile-ic svg{transform:scale(1.5);margin:4px}
#fe[data-view="icons"] .fe-tile{width:116px;padding:10px 8px 8px;gap:4px}
#fe[data-view="icons"] .fe-tile-ic svg{transform:scale(2);margin:8px 10px 6px}
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
.fe-dlg-title{display:flex;align-items:center;gap:11px;padding:14px 16px 12px;background:var(--s2);flex:none;border-radius:10px 10px 0 0}
.fe-dlg-mark{flex:none;width:26px;height:26px;border-radius:6px;display:grid;place-items:center;
  background:var(--act);color:var(--ac);border:1px solid var(--ac)}
.fe-dlg-tx{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}
.fe-dlg-tx b{font-size:14px;font-weight:600;line-height:1.2;color:var(--tx);letter-spacing:-.01em}
.fe-dlg-tx i{font-size:11px;line-height:1.2;font-style:normal;color:var(--dm)}
.fe-dlg-close{background:none;border:none;color:var(--dm);cursor:pointer;font-size:14px;padding:3px 7px;border-radius:4px;line-height:1;transition:color .1s,background .1s}
.fe-dlg-close:hover{background:var(--hover);color:var(--tx)}
.fe-dlg-tabs{display:flex;gap:3px;padding:0 16px;background:var(--s2);border-bottom:1px solid var(--bd);flex:none;align-items:stretch;overflow-x:auto}
.fe-dlg-tab{display:flex;flex-direction:column;gap:2px;background:none;border:none;border-bottom:2px solid transparent;border-radius:6px 6px 0 0;
  padding:9px 13px 8px;color:var(--mt);cursor:pointer;text-align:left;line-height:1;white-space:nowrap;transition:background .1s,color .1s,border-color .1s}
.fe-dlg-tab b{font-size:12.5px;font-weight:600;color:inherit}
.fe-dlg-tab i{font-size:10.5px;font-style:normal;color:var(--dm);opacity:.85}
.fe-dlg-tab:hover{color:var(--tx);background:var(--s1)}
.fe-dlg-tab.on{background:var(--s1);color:var(--tx);border-bottom-color:var(--ac)}
.fe-dlg-tab.on i{opacity:1}
.fe-dlg-pane{display:none;padding:18px 22px 22px;overflow:auto;min-height:0}
.fe-dlg-pane.on{display:flex;flex-direction:column;gap:20px}
.fe-dlg-pane .fe-md{max-width:none;padding:0}
.fe-dlg-pane .fe-md h2{font-size:15px;margin-top:6px}
.fe-dlg-pane .fe-md>:first-child{margin-top:0}
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
#fe-tabs{display:flex;align-items:stretch;gap:2px;padding:6px 10px 0;background:var(--s1);border-bottom:1px solid var(--bd);
  overflow-x:auto;flex-shrink:0;min-height:34px;scrollbar-width:none;
  mask-image:linear-gradient(90deg,transparent 0,#000 10px,#000 calc(100% - 10px),transparent)}
#fe-tabs::-webkit-scrollbar{display:none}
.fe-tab-list{position:sticky;right:0;flex-shrink:0;align-self:center;background:var(--s1);border:1px solid var(--bd);color:var(--mt);cursor:pointer;
  font-size:11px;padding:2px 6px;border-radius:5px;margin-left:4px}
.fe-tab-list:hover{border-color:var(--ac);color:var(--ac)}
.fe-tab.pinned{padding:5px 6px;min-width:0}
.fe-tab.pinned .fe-tab-lbl,.fe-tab.pinned .fe-tab-more{display:none}
#fe-tabs.empty{padding-top:4px}
.fe-tab{display:flex;align-items:center;gap:6px;padding:5px 8px 5px 12px;font-size:12px;color:var(--mt);text-decoration:none;
  border:1px solid transparent;border-bottom:none;border-radius:6px 6px 0 0;white-space:nowrap;max-width:200px;min-width:64px;flex:0 1 auto;position:relative;top:1px}
.fe-tab:hover{background:var(--hover);color:var(--tx)}
.fe-tab.on{background:var(--s2);color:var(--tx);border-color:var(--bd)}
.fe-tab.temp .fe-tab-lbl{font-style:italic;color:var(--mt)}
.fe-tab.drag-over{border-left:2px solid var(--ac)}
.fe-tab-lbl{overflow:hidden;text-overflow:ellipsis}
.fe-tab-x,.fe-tab-more{background:none;border:none;color:var(--dm);cursor:pointer;font-size:10px;padding:1px 4px;border-radius:3px;opacity:0;line-height:1}
.fe-tab-more{font-size:12px;letter-spacing:1px}
.fe-tab:hover .fe-tab-x,.fe-tab.on .fe-tab-x,.fe-tab:hover .fe-tab-more{opacity:1}
.fe-tab-x:hover{background:var(--s3);color:#f85149}
.fe-tab-more:hover{background:var(--s3);color:var(--tx)}
.fe-tab.pinned::before{content:'';width:5px;height:5px;border-radius:50%;background:var(--ac);flex-shrink:0}
.fe-tab-ico{display:flex;flex-shrink:0}
.fe-tab-ico svg{width:11px;height:12px}
.fe-tab-menu{position:fixed}
#fe.fe-file-page #fe-toolbar,#fe.fe-file-page #fe-sg-panel,#fe.fe-file-page #fe-filter-bar,#fe.fe-file-page #fe-scroll{display:none!important}
#fe-fp-bar{display:flex;align-items:center;gap:6px;padding:7px 14px;background:var(--s2);border-bottom:1px solid var(--bd);flex-shrink:0}
#fe-fp{display:flex;flex:1;min-height:0}
#fe-toc{width:220px;flex-shrink:0;overflow-y:auto;background:var(--s1);border-right:1px solid var(--bd);padding:10px 0;font-size:12px}
#fe-toc a{display:block;color:var(--mt);text-decoration:none;padding:3px 14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#fe-toc a:hover{color:var(--ac);background:var(--hover)}
#fe-toc a.fe-toc-h2{padding-left:24px}#fe-toc a.fe-toc-h3{padding-left:34px}#fe-toc a.fe-toc-h4{padding-left:44px}
#fe-page{flex:1;min-width:0;overflow:auto;font-size:12px}
#fe-page .fe-md{max-width:none;margin:0;padding:28px 48px 80px;font-size:var(--rd-size,15px);line-height:var(--rd-lh,1.65)}
#fe.fe-column #fe-page .fe-md{max-width:80ch;margin:0 auto}
#fe-page .fe-md h1{font-size:26px;margin:8px 0 16px;padding-bottom:8px}
#fe-page .fe-md h2{font-size:21px;margin:32px 0 12px;padding-bottom:6px}
#fe-page .fe-md h3{font-size:17px;margin:24px 0 8px}
#fe-page .fe-md h4,#fe-page .fe-md h5,#fe-page .fe-md h6{font-size:15px;margin:18px 0 6px}
#fe-page .fe-md p{margin:12px 0}
#fe-page .fe-md ul,#fe-page .fe-md ol{margin:10px 0;padding-left:28px}
#fe-page .fe-md li{margin:5px 0}
#fe-page .fe-md code{font-size:var(--rd-code,13px)}
#fe-page .fe-md-pre{font-size:var(--rd-code,13px);line-height:1.5}
#fe.fe-notips #fe-tip{display:none!important}
#fe-page .fe-md-table{font-size:14px}
#fe-page .fe-md-table th,#fe-page .fe-md-table td{padding:7px 13px}
#fe-fp-toc,#fe-fp-column{background:none;border:1px solid var(--bd);color:var(--mt);cursor:pointer;font-size:11px;padding:3px 8px;border-radius:5px}
#fe-fp-toc:hover,#fe-fp-column:hover{border-color:var(--ac);color:var(--ac)}
#fe-fp-toc.on,#fe-fp-column.on{border-color:var(--ac);color:var(--ac);background:var(--act)}
#fe-toc a.on{color:var(--ac);border-left:2px solid var(--ac);padding-left:12px}
.fe-crumb-file{color:var(--tx);font-weight:500}
#fe-fp-meta{font-size:11px;color:var(--dm);margin-right:auto;white-space:nowrap}
#fe-fp-raw,#fe-fp-copy{background:none;border:1px solid var(--bd);color:var(--mt);cursor:pointer;font-size:11px;padding:3px 8px;border-radius:5px}
#fe-fp-raw:hover,#fe-fp-copy:hover{border-color:var(--ac);color:var(--ac)}
#fe-fp-raw.on{border-color:var(--ac);color:var(--ac);background:var(--act)}
#fe-fp-reload{font-size:11px;color:var(--dm)}
#fe-ed-bar{display:flex;align-items:center;gap:4px;padding:6px 10px;border-bottom:1px solid var(--bd);background:var(--s2);flex-shrink:0;flex-wrap:wrap}
#fe-ed-bar .fe-pbn{padding:2px 7px;font-size:11px}
.fe-ed-hint{margin-left:auto;font-size:10.5px;color:var(--dm);white-space:nowrap}
#fe-ql-body.fe-editing{display:flex;flex-direction:column}
.fe-ed{display:flex;flex:1;min-height:0}
.fe-md img{max-width:100%;border-radius:6px}
#fe-ed-src{flex:1;min-width:0;resize:none;border:none;border-right:1px solid var(--bd);background:var(--s1);color:var(--tx);
  font:12.5px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;padding:14px 16px;outline:none;tab-size:2}
#fe-ed-view{flex:1;min-width:0;overflow:auto}
#fe-qlook.side .fe-ed{flex-direction:column}
#fe-qlook.side #fe-ed-src{border-right:none;border-bottom:1px solid var(--bd);min-height:40%}
#fe-ed-conflict{display:flex;align-items:center;gap:8px;padding:8px 14px;border-bottom:1px solid var(--bd)}
.fe-nt-item .fe-si-link{padding-left:14px}
#fe-nt-add{background:none;border:1px solid var(--bd);color:var(--mt);cursor:pointer;border-radius:4px;
  width:18px;height:18px;line-height:1;font-size:13px;padding:0;display:flex;align-items:center;justify-content:center}
#fe-nt-add:hover{border-color:var(--ac);color:var(--ac)}
.fe-sh a{color:inherit;text-decoration:none}
.fe-sh a:hover{color:var(--ac)}
#fe-ql-dock{background:none;border:1px solid var(--bd);color:var(--mt);cursor:pointer;padding:3px 7px;border-radius:5px;line-height:1;display:flex;align-items:center}
#fe-ql-dock:hover{border-color:var(--ac);color:var(--ac)}
#fe-ql-dock.on{color:var(--ac);border-color:var(--ac)}
#fe-ql-hdr{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--bd);flex-shrink:0}
#fe-ql-icon svg{display:block}
#fe-ql-name{font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:inherit;text-decoration:none}
#fe-ql-name:hover{color:var(--ac);text-decoration:underline}
#fe-ql-meta{font-size:11px;color:var(--dm);flex:1;white-space:nowrap}
#fe-ql-open{font-size:11px;color:var(--ac);text-decoration:none;padding:3px 8px;border:1px solid var(--bd);border-radius:5px;white-space:nowrap}
#fe-ql-go,#fe-ql-tab{font-size:11px;color:var(--mt);background:none;cursor:pointer;padding:3px 8px;border:1px solid var(--bd);border-radius:5px;white-space:nowrap}
#fe-ql-go:hover,#fe-ql-tab:hover{border-color:var(--ac);color:var(--ac)}
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
.fe-md-code{margin:10px 0;border:1px solid var(--bd);border-radius:6px;background:var(--s2);overflow:hidden}
.fe-md-code-bar{display:flex;align-items:center;justify-content:space-between;padding:3px 10px;border-bottom:1px solid var(--bd);background:var(--s1)}
.fe-md-lang{font:600 10.5px/1 'SF Mono',Menlo,Consolas,monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--dm)}
.fe-md-copy{background:none;border:1px solid var(--bd);color:var(--mt);cursor:pointer;font-size:10.5px;padding:1px 7px;border-radius:4px}
.fe-md-copy:hover{border-color:var(--ac);color:var(--ac)}
.fe-md-pre{background:var(--s2);border:1px solid var(--bd);border-radius:6px;padding:10px 12px;
  overflow-x:auto;font:11.5px/1.55 'SF Mono',Menlo,Consolas,monospace;margin:10px 0;white-space:pre}
.fe-md-code .fe-md-pre{border:none;border-radius:0;margin:0}
.fe-md-anchor{margin-left:8px;color:var(--dm);font-weight:400;text-decoration:none;opacity:0;transition:opacity .1s}
.fe-md-anchor::before{content:'#'}
.fe-md h1:hover .fe-md-anchor,.fe-md h2:hover .fe-md-anchor,.fe-md h3:hover .fe-md-anchor,.fe-md h4:hover .fe-md-anchor,.fe-md h5:hover .fe-md-anchor,.fe-md h6:hover .fe-md-anchor{opacity:1}
.fe-md-fm{display:grid;grid-template-columns:max-content 1fr;gap:3px 14px;margin:0 0 18px;padding:10px 14px;background:var(--s2);border:1px solid var(--bd);border-radius:6px;font-size:12.5px}
.fe-md-fm dt{color:var(--dm);font-weight:600}
.fe-md-fm dd{margin:0;color:var(--tx)}
.fe-md li.fe-task{list-style:none;margin-left:-20px!important;padding-left:0}
.fe-md li.fe-task input{accent-color:var(--ac);margin-right:6px;vertical-align:-2px}
.fe-md-tablewrap{overflow-x:auto;margin:10px 0}
.fe-md-table tbody tr:nth-child(even){background:var(--s1)}
.fe-md img{display:block;margin:12px auto;cursor:zoom-in}
.fe-md blockquote{border-left:3px solid var(--bd);padding:1px 12px;color:var(--mt);margin:8px 0}
.fe-md blockquote .fe-md{padding:0}
.fe-md ul,.fe-md ol{padding-left:24px;margin:7px 0}
.fe-md li{margin:3px 0}
.fe-md a{color:var(--ac);text-decoration:none}
.fe-md a:hover{text-decoration:underline}
.fe-md img{max-width:100%;border-radius:6px}
.fe-md hr{border:none;border-top:1px solid var(--bd);margin:14px 0}
.fe-md-table{border-collapse:collapse;margin:0;font-size:12.5px}
.fe-md-table th,.fe-md-table td{border:1px solid var(--bd);padding:5px 11px;text-align:left}
.fe-md-table th{background:var(--s2);font-weight:600}
#fe-ctx,.fe-ctx{position:fixed;z-index:360;background:var(--s1);border:1px solid var(--bd);border-radius:var(--r);
  min-width:180px;box-shadow:0 8px 24px #0009;display:none;padding:4px 0}
.fe-ctx-item{display:flex;align-items:center;gap:8px;padding:6px 12px;color:var(--tx);
  font-size:12px;cursor:pointer;white-space:nowrap}
.fe-ctx-item:hover{background:var(--hover)}
.fe-ctx-key{margin-left:auto;color:var(--dm);font-size:10px;padding-left:16px}
.fe-ctx-sep{height:1px;background:var(--bd);margin:4px 0}
`;

  // src/file-page.ts
  var SCROLL_KEY = "bfb-page-scroll-v1";
  var TOC_KEY = "bfb-page-toc-v1";
  var COLUMN_KEY = "bfb-page-column-v1";
  var RELOAD_MS = 2e3;
  function filePageExt(pathname) {
    if (pathname.endsWith("/")) return null;
    const name = decodeURIComponent(pathname.split("/").pop() || "");
    const ext2 = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
    if (!ext2) return null;
    if (CODE_EXTS.has(ext2) || TABLE_EXTS.has(ext2) || JSONL_EXTS.has(ext2) || ext2 === "json") return ext2;
    return null;
  }
  function filePagesEnabled(ext2, settings) {
    const mode = settings.renderFilePages || "all";
    return !(mode === "off" || mode === "not-md" && (ext2 === "md" || ext2 === "mdx"));
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
  function buildToc(page, toc, open) {
    const heads = [...page.querySelectorAll(".fe-md h1, .fe-md h2, .fe-md h3, .fe-md h4")];
    const items = heads.map((h) => {
      const text = (h.textContent || "").replace(/#$/, "").trim();
      return `<a href="#${esc(h.id)}" class="fe-toc-${h.tagName.toLowerCase()}" data-id="${esc(h.id)}" title="Jump to this heading">${esc(text)}</a>`;
    });
    toc.innerHTML = items.join("");
    toc.style.display = items.length > 1 && open ? "" : "none";
  }
  function spy(page, toc) {
    const heads = [...page.querySelectorAll(".fe-md h1, .fe-md h2, .fe-md h3, .fe-md h4")];
    const top = page.getBoundingClientRect().top + 40;
    let current = null;
    for (const h of heads) {
      if (h.getBoundingClientRect().top <= top) current = h;
      else break;
    }
    toc.querySelectorAll("a").forEach((a) => a.classList.toggle("on", !!current && a.dataset.id === current.id));
  }
  function scrollMemory() {
    try {
      return JSON.parse(localStorage.getItem(SCROLL_KEY) || "{}");
    } catch {
      return {};
    }
  }
  function rememberScroll(path, top) {
    const m = scrollMemory();
    m[path] = top;
    const keys = Object.keys(m);
    if (keys.length > 200) for (const k of keys.slice(0, keys.length - 200)) delete m[k];
    localStorage.setItem(SCROLL_KEY, JSON.stringify(m));
  }
  function renderFileContent() {
    return `
      <div id="fe-fp-bar">
        <span id="fe-fp-meta"></span>
        <button id="fe-fp-toc" title="Show or hide the table of contents">toc</button>
        <button id="fe-fp-column" title="Reading column: narrow the text to 80 characters">column</button>
        <button id="fe-fp-raw" title="Raw text (r)">raw</button>
        <button id="fe-fp-copy" title="Copy file contents">copy</button>
      </div>
      <div id="fe-fp">
        <nav id="fe-toc" style="display:none"></nav>
        <div id="fe-page"></div>
      </div>`;
  }
  function mountFileContent(opts) {
    const { ext: ext2, rawPath, href } = opts;
    let text = opts.text;
    const page = document.getElementById("fe-page");
    const toc = document.getElementById("fe-toc");
    const rawBtn = document.getElementById("fe-fp-raw");
    const tocBtn = document.getElementById("fe-fp-toc");
    const colBtn = document.getElementById("fe-fp-column");
    const meta = document.getElementById("fe-fp-meta");
    const isMd = ext2 === "md" || ext2 === "mdx";
    let raw = false;
    let tocOpen = localStorage.getItem(TOC_KEY) !== "0";
    const columnStored = localStorage.getItem(COLUMN_KEY);
    let column = columnStored === null ? !!opts.column : columnStored === "1";
    const fe = document.getElementById("fe");
    meta.textContent = fmtSize(new Blob([text]).size);
    const paint = () => {
      fe.classList.toggle("fe-column", column);
      colBtn.classList.toggle("on", column);
      tocBtn.classList.toggle("on", tocOpen);
      tocBtn.style.display = isMd && !raw ? "" : "none";
      colBtn.style.display = isMd && !raw ? "" : "none";
    };
    const render2 = () => {
      const top = page.scrollTop;
      page.innerHTML = raw ? renderCode(text, "txt") : renderBody(text, ext2, href);
      if (!raw && isMd) buildToc(page, toc, tocOpen);
      else toc.style.display = "none";
      page.scrollTop = top;
      rawBtn.classList.toggle("on", raw);
      paint();
      spy(page, toc);
    };
    render2();
    tocBtn.addEventListener("click", () => {
      tocOpen = !tocOpen;
      localStorage.setItem(TOC_KEY, tocOpen ? "1" : "0");
      render2();
    });
    colBtn.addEventListener("click", () => {
      column = !column;
      localStorage.setItem(COLUMN_KEY, column ? "1" : "0");
      paint();
    });
    page.addEventListener("scroll", () => {
      if (isMd && !raw) spy(page, toc);
    });
    const remembered = scrollMemory()[rawPath];
    if (remembered) page.scrollTop = remembered;
    else if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
    let scrollTimer = null;
    page.addEventListener("scroll", () => {
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => rememberScroll(rawPath, page.scrollTop), 300);
    });
    const toggleRaw = () => {
      raw = !raw;
      render2();
    };
    rawBtn.addEventListener("click", toggleRaw);
    document.getElementById("fe-fp-copy").addEventListener("click", () => {
      copyToClipboard(text).then((ok) => {
        document.getElementById("fe-status-text").textContent = ok ? "copied" : "copy failed";
      });
    });
    const reloadEl = document.getElementById("fe-fp-reload");
    setInterval(() => {
      if (document.visibilityState !== "visible") return;
      fetchFileText(href).then((fresh) => {
        if (fresh === text) return;
        text = fresh;
        meta.textContent = fmtSize(new Blob([text]).size);
        render2();
        reloadEl.textContent = "reloaded " + (/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      }).catch(() => {
        reloadEl.textContent = "not watching (cannot read file)";
      });
    }, RELOAD_MS);
    return { toggleRaw };
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
  function pickRecovery(entries, now, maxAge = RECOVERY_MAX_AGE) {
    let best = null;
    for (const [sid, e] of Object.entries(entries)) {
      if (!e.closed || !e.state.list.length || now - e.at > maxAge) continue;
      if (best === null || e.at > entries[best].at) best = sid;
    }
    return best;
  }
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
    const area = storageArea();
    if (!area) return;
    try {
      if (!state.list.length) area.remove(RECOVERY_PREFIX + sid, () => void chrome.runtime.lastError);
      else area.set({ [RECOVERY_PREFIX + sid]: { state, at: Date.now(), closed } }, () => void chrome.runtime.lastError);
    } catch {
    }
  }
  function readRecoveries() {
    return new Promise((resolve) => {
      const area = storageArea();
      if (!area) return resolve({});
      try {
        area.get(null, (all) => {
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
      return h ? activate(s, h.id) : s;
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
      commit(insertTab(state, last.tab, last.index));
      toast(`Reopened ${last.tab.label}`);
    }
    function hrefFor(t) {
      return "file://" + t.path;
    }
    function goTab(id) {
      const t = state.list.find((x) => x.id === id);
      if (!t) return;
      commit(activate(state, id));
      if (t.path !== rawPath) location.href = hrefFor(t);
    }
    function closeHere() {
      const here = hereIn(state);
      if (!here) return;
      const next = closeTab(state, here.id);
      commit(next);
      const to = next.list.find((t) => t.id === next.active);
      if (to && to.path !== rawPath) location.href = hrefFor(to);
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
    function openMenu(t, anchor) {
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
    function tabHtml(t, i, on, label) {
      const ico = t.kind === "file" ? `<span class="fe-tab-ico">${icoFile(t.label.includes(".") ? t.label.split(".").pop().toLowerCase() : "")}</span>` : t.pinned ? `<span class="fe-tab-ico">${icoFolder(t.label)}</span>` : "";
      const tip = `${t.path}
${i < 9 ? `${i + 1} jumps \xB7 ` : ""}click switches \xB7 ${t.pinned ? "pinned (p unpins)" : "middle-click closes"} \xB7 drag reorders`;
      return `<a class="fe-tab${on ? " on" : ""}${t.pinned ? " pinned" : ""}" draggable="true" data-id="${esc(t.id)}" href="${esc(hrefFor(t))}" title="${esc(tip)}">
      ${ico}<span class="fe-tab-lbl">${esc(label)}</span>
      <button class="fe-tab-more" data-id="${esc(t.id)}" title="Copy path \xB7 save \xB7 pin \xB7 close others">\u2026</button>
      ${t.pinned ? "" : `<button class="fe-tab-x" data-id="${esc(t.id)}" title="Close (w)">\u2715</button>`}
    </a>`;
    }
    function render2() {
      const here = hereIn(state);
      const labels = displayLabels(state.list);
      const rows = state.list.map((t, i) => tabHtml(t, i, t.id === here?.id, labels[i]));
      if (!here) {
        const ico = kindOf(rawPath) === "file" ? `<span class="fe-tab-ico">${icoFile(labelFor(rawPath).split(".").pop().toLowerCase())}</span>` : "";
        rows.push(`<a class="fe-tab on temp" data-id="" href="file://${esc(rawPath)}" title="Not kept yet \xB7 t or double-click keeps \xB7 p pins">${ico}<span class="fe-tab-lbl">${esc(labelFor(rawPath))}</span></a>`);
      }
      if (state.list.length > 1) rows.push(`<button class="fe-tab-list" title="All tabs">\u2304</button>`);
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
          if (t) openMenu(t, btn);
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
    async function recover() {
      const all = await readRecoveries();
      const now = Date.now();
      const area = storageArea();
      for (const [k, e] of Object.entries(all)) if (isStale(e, now)) {
        try {
          area?.remove(RECOVERY_PREFIX + k, () => void chrome.runtime.lastError);
        } catch {
        }
        delete all[k];
      }
      const pick = pickRecovery(all, now);
      if (!pick) return;
      const old = all[pick];
      try {
        area?.remove(RECOVERY_PREFIX + pick, () => void chrome.runtime.lastError);
      } catch {
      }
      commit(activateHere(old.state));
      const n = old.state.list.length;
      toast(`Restored ${n} tab${n === 1 ? "" : "s"}`, 6e3, {
        label: "undo",
        run: () => {
          commit(EMPTY);
          try {
            area?.set({ [RECOVERY_PREFIX + pick]: old }, () => void chrome.runtime.lastError);
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
      if (host.restore !== false) void recover();
    }
    window.addEventListener("pagehide", () => writeRecovery(sid, state, true));
    return {
      handleKey,
      open: (path, background = false) => commit(openTab(state, path, background)),
      go: (path) => {
        commit(openTab(state, path));
        if (path !== rawPath) location.href = "file://" + path;
      },
      state: () => state
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
| t \xB7 w \xB7 p | Keep this folder or file as a tab \xB7 close it \xB7 pin it |
| [ \xB7 ] \xB7 1-9 | Previous / next tab \xB7 jump to a tab (in a dialog: switch its tabs) |
| n | New note (when a Notes folder is set) |
| r | Raw / rendered, on a file page |

Single-letter keys work when nothing is focused. Chrome owns \u2318T and \u2318W, so
the tab keys are bare letters.
` },
    { key: "explorer", label: "Explorer", hint: "views, finding, opening", md: `
## Views & zoom

Switch layout from the toolbar: **Details** (table), **List** (compact),
**Tiles**, or **Large Icons**. Your choice is remembered. The **zoom** slider
(50\u2013320%) scales the whole list.

## Finding files

- **Quick filter** \u2014 type in the **Filter\u2026** box (top-right), or press **\u2318F** to jump to it. Press **\u2318F** again to fall through to Chrome's own find.
- **Text inside files** \u2014 open the **Filter** panel; the second row reads the text files the name and type fields allow (2 MB each at most) and keeps only the ones containing your words. Enter or **Run** starts it, **Cancel** stops it, and the results stay until you run again or clear the field. **Save view** keeps the folder plus these fields as a Saved row with a funnel icon; opening it brings the search back.
- **Deep search** \u2014 the folder button beside the filter box includes every subfolder. Names show their path from this folder, so **src/main.ts** matches **main**. The scan skips node_modules, .git and dot-folders (unless hidden files are shown), stops at 8 levels or 5000 items, and runs once per page.
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

Click any path segment to jump there. The **\u25BE** next to a segment opens a
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
turn it off.
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
| \`.md\` / \`.mdx\` | Rendered markdown (relative images/links resolved) |
| Images | Fit-to-view, with pixel dimensions |
| PDF \xB7 audio/video \xB7 fonts | Embedded viewer / player / glyph specimen |
| Plain text & extensionless (\`.txt\`, \`.log\`, \`LICENSE\`, \`Makefile\`) | Plain text with line numbers |

## Notes

Set a **Notes folder** in **Settings \u2192 Notes** and a Notes section lists its
\`.md\` files newest first. **n** or **+** starts a note. The panel becomes an
editor with the source on the left and the render on the right: a toolbar for
bold, italic, code, lists, tasks, tables and images; \u2325\u2191\u2193 moves lines and
\u2325\u21E7\u2191\u2193 duplicates them; Tab indents; Enter continues a list; a pasted or
dropped image is saved under \`attachments/\`. **\u2318S** saves, a pause autosaves,
and an untitled note takes its first heading as its file name. Rename by
double-click; \u2715 moves the note into \`.trash/\`. The folder is plain markdown
that Obsidian and any markdown tool can read.

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
**9** jump. Drag to reorder. **Middle-click** a tab to close it (pinned
tabs stay). Hover a tab for **\u2026**: copy path, save, pin, close, close others.
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

## Recent, Finder Favorites, System

Folders you visited lately, and quick jumps (Root, Home, \u2026).
` }
  ];

  // src/find.ts
  var EMPTY_FIND = { scope: "here", name: "", regex: false, exts: [], text: "", caseSensitive: false };
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
  async function searchContents(files, read, q, onProgress, isCancelled = () => false, concurrency = 4) {
    const hits = /* @__PURE__ */ new Map();
    let scanned = 0, failed = 0, next = 0;
    const needle = q.caseSensitive ? q.text : q.text.toLowerCase();
    const worker = async () => {
      while (next < files.length && !isCancelled()) {
        const f = files[next++];
        try {
          const text = await read(f.href);
          const hay = q.caseSensitive ? text : text.toLowerCase();
          let count = 0, at = hay.indexOf(needle);
          while (at >= 0) {
            count++;
            at = hay.indexOf(needle, at + needle.length);
          }
          if (count) {
            const first = hay.indexOf(needle);
            const ls = text.lastIndexOf("\n", first) + 1;
            let le = text.indexOf("\n", first);
            if (le < 0) le = text.length;
            hits.set(f.href, { count, line: text.slice(ls, le).trim().slice(0, 160) });
          }
        } catch {
          failed++;
        }
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
      return { ...EMPTY_FIND, ...q, exts: Array.isArray(q.exts) ? q.exts : [] };
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
    if (q.text) bits.push(`"${q.text}"`);
    const what = bits.join(" ") || "everything";
    return q.scope === "deep" ? `${what} in subfolders` : what;
  }

  // src/render.ts
  function buildTipData(e, ctx) {
    if (e.isParent) {
      return JSON.stringify({ icon: "", name: "Parent Directory", lines: ["Navigate up one level"] });
    }
    const fp = fullPath(ctx.rawPath, e);
    const lines = [`Path: ${fp}`, `Type: ${fmtType(e)}`];
    if (!e.isDir) lines.push(`Size: ${fmtSize(e.rawBytes)}`);
    lines.push(`Modified: ${fmtDate(e.dateMs, ctx.settings, e.dateStr)}`);
    if (e.isHidden) lines.push("Hidden file (dotfile)");
    if (IMG_EXTS.has(getExt(e))) lines.push("Image \u2014 dimensions require native host");
    lines.push(e.isDir ? "Click opens \xB7 \u2325-click keeps a tab \xB7 middle-click: Chrome tab" : "Click looks \xB7 double-click opens \xB7 \u2325-click keeps a tab \xB7 middle-click: Chrome tab");
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
  function renderRow(e, ctx, idx = -1) {
    const tipData = buildTipData(e, ctx);
    return `<tr class="fe-row${e.isDir ? " dir" : ""}${e.isParent ? " par" : ""}${e.isHidden ? " dotfile" : ""}"
             data-name="${esc(e.name.toLowerCase())}"
             data-idx="${idx}"
             data-tip="${esc(tipData)}">
    <td class="c-nm"><a href="${esc(e.href)}" class="fe-lnk">${getIcon(e, ctx.iconRules)}<span class="fe-nm">${esc(e.isParent ? "Parent Directory" : e.name)}</span></a>${itemActions(e, ctx.rawPath)}</td>
    <td class="c-tp">${fmtType(e)}</td>
    <td class="c-sz">${e.isDir ? "\u2014" : fmtSize(e.rawBytes)}</td>
    <td class="c-dt">${fmtDate(e.dateMs, ctx.settings, e.dateStr)}</td>
  </tr>`;
  }
  function renderTile(e, ctx, idx = -1) {
    const tipData = buildTipData(e, ctx);
    const isImg = !e.isDir && !e.isParent && IMG_EXTS.has(getExt(e));
    const iconHtml = isImg ? `<span class="fe-tile-img-wrap"><img class="fe-tile-thumb" src="${esc(e.href)}" loading="lazy" alt="" onerror="this.closest('.fe-tile-img-wrap').classList.add('err')">${getIcon(e, ctx.iconRules)}</span>` : getIcon(e, ctx.iconRules);
    return `<a href="${esc(e.href)}" class="fe-tile${e.isDir ? " dir" : ""}${e.isParent ? " par" : ""}${e.isHidden ? " dotfile" : ""}"
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
  function renderSavedList(saved, tags, rawPath, filter = "") {
    if (!saved.length) return `<div class="fe-hint">Nothing saved yet.<br>Click \u2606 in the path bar, or + to name this folder.</div>`;
    saved = filterSaved(saved, filter);
    if (!saved.length) return `<div class="fe-hint">No saved item matches.</div>`;
    const color = (name) => tags.find((t) => t.name === name)?.color ?? "#8b949e";
    const VIEW_ICON = `<svg width="14" height="14" viewBox="0 0 14 14"><path d="M1.5 2h11l-4.2 5v4.5l-2.6-1.3V7z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>`;
    const row = (p) => `
    <div class="fe-bm-item fe-pl-item${isViewPath(p.path) ? " fe-view" : ""}" draggable="true" data-path="${esc(p.path)}">
      <span class="fe-drag-h">${PI.drag}</span>
      <a href="file://${esc(p.path)}" class="fe-si-link${p.path === rawPath ? " active" : ""}" title="${esc(isViewPath(p.path) ? "Saved view in " + p.path.split("#")[0] : p.path)}">
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
      crumbs.push({ label: seg, href: "file://" + acc });
    }
    return crumbs.map(
      (c, i) => `<a href="${esc(c.href)}" class="fe-crumb" title="Go to ${esc(decodeURIComponent(c.href.slice(7)))}">${esc(c.label)}</a><button class="fe-crumb-dd" data-url="${esc(c.href)}" title="Browse ${esc(c.href)}">\u25BE</button>` + (i < crumbs.length - 1 ? `<span class="fe-sep">\u203A</span>` : "")
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
    const SETTINGS_DIALOG = {
      id: "fe-settings-modal",
      mark: PI.gear,
      title: "Settings",
      subtitle: "Stored in this browser profile",
      tabs: [
        { key: "appearance", label: "Appearance", hint: "theme, view, density", body: `
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
              <option value="tiles">Tiles</option>
              <option value="icons">Large Icons</option>
            </select>
          </div>
          <div class="fe-st-row">
            <label class="fe-st-check"><input type="checkbox" id="fe-st-compact" title="Tighter rows and tiles"> Compact mode</label>
          </div>
          <div class="fe-st-row">
            <label class="fe-st-check"><input type="checkbox" id="fe-st-sidebar" title="Saved, Notes, Recent and Favorites on the left"> Show sidebar</label>
          </div>
          <div class="fe-st-row">
            <span class="fe-st-lbl">Sidebar sections</span>
            <label class="fe-st-check"><input type="checkbox" id="fe-st-sec-recent" title="Folders you visited lately"> Recent</label>
            <label class="fe-st-check"><input type="checkbox" id="fe-st-sec-favorites" title="Finder Favorites"> Favorites</label>
            <label class="fe-st-check"><input type="checkbox" id="fe-st-sec-system" title="Root and Home"> System</label>
          </div>
          <div class="fe-st-row">
            <label class="fe-st-check"><input type="checkbox" id="fe-st-tooltips" title="Native tooltips on every control"> Tooltips</label>
            <button id="fe-st-keys" class="fe-pbn" title="Open Help on the Keyboard tab">Keyboard shortcuts</button>
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
        { key: "preview", label: "Preview", hint: "panel, click, tabs", body: `
        <div class="fe-st-section">
          <div class="fe-st-title">Panel</div>
          <div class="fe-st-row">
            <span class="fe-st-lbl">Placement</span>
            <select id="fe-st-panel" class="fe-st-select" title="Where the preview opens">
              <option value="modal">Floating window</option>
              <option value="side">Docked to the side</option>
            </select>
            <button id="fe-st-panel-reset" class="fe-pbn" title="Forget the dragged sizes">Reset sizes</button>
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
            <label class="fe-st-check"><input type="checkbox" id="fe-st-strip-restore" title="Bring back the strip of a Chrome tab closed within a day"> Restore closed strips</label>
          </div>
        </div>` },
        { key: "files", label: "Files", hint: "file pages, reader, icon rules", body: `
        <div class="fe-st-section">
          <div class="fe-st-title">Reader</div>
          <div class="fe-st-row">
            <label class="fe-st-check"><input type="checkbox" id="fe-st-rd-column" title="Start file pages in the 80-character reading column"> Reading column by default</label>
          </div>
          <div class="fe-st-row">
            <span class="fe-st-lbl">Text size</span>
            <select id="fe-st-rd-size" class="fe-st-select" title="Body size on file pages">${[13, 14, 15, 16, 17].map((n) => `<option value="${n}">${n} px</option>`).join("")}</select>
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
            <button id="fe-st-add-rule" class="fe-pbn" title="Add an icon rule">+ Add rule</button>
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
          <button id="fe-st-reset-rules" class="fe-pbn" style="margin-top:8px;align-self:flex-start;color:#f85149;border-color:#f8514940" title="Replace every rule with the built-in set">Reset to defaults</button>
        </div>
` },
        { key: "notes", label: "Notes", hint: "the notes folder", body: `
        <div class="fe-st-section">
          <div class="fe-st-title">Notes</div>
          <div class="fe-st-row">
            <span class="fe-st-lbl" title="A folder of .md files. See docs/notes-contract.md">Notes folder</span>
            <input type="text" id="fe-st-notes-root" class="fe-st-input" placeholder="/Users/you/Notes" spellcheck="false" title="Absolute path of the notes folder">
          </div>
          <div class="fe-st-hint" id="fe-st-notes-hint" style="font-size:11px;color:var(--dm);margin-top:-4px"></div>
        </div>
` },
        { key: "terminal", label: "Terminal", hint: "which app opens", body: `
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
` },
        { key: "data", label: "Data", hint: "export, import", body: `
        <div class="fe-st-section">
          <div class="fe-st-title">Settings and Saved list</div>
          <div class="fe-st-row">
            <button id="fe-st-export" class="fe-pbn" title="Copy everything this extension stores as JSON">Export</button>
            <button id="fe-st-import" class="fe-pbn" title="Load a JSON export and reload">Import</button>
            <input type="file" id="fe-st-import-file" accept="application/json" style="display:none" title="The JSON export to load">
          </div>
          <textarea id="fe-st-export-out" class="fe-st-input" style="display:none;width:100%;height:120px;font:11px 'SF Mono',Menlo,monospace" spellcheck="false" title="The export, also on the clipboard"></textarea>
        </div>` },
        { key: "ai", label: "AI", hint: "local model", body: `
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
    <div id="fe-bc">${renderCrumbs(folderPath, segments)}${fileMode ? `<span class="fe-sep">\u203A</span><span class="fe-crumb fe-crumb-file">${esc(fileName)}</span>` : ""}</div>
    <button id="fe-term-btn" title="Open in terminal (${settings.terminalApp || "ghostty"}) \u2014 Click to open current folder \xB7 Shift+click copies command"><svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="1" width="12" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M3.5 5l3 2-3 2M8 9h3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    <button id="fe-bm-btn" class="${curIsBookmarked ? "on" : ""}" title="${curIsBookmarked ? `Remove this ${fileMode ? "file" : "folder"} from Saved` : `Save this ${fileMode ? "file" : "folder"} (sidebar)`}">
      <svg width="13" height="13" viewBox="0 0 13 13"><path id="fe-bm-path" d="M2.5 1h8v11l-4-2.8L2.5 12z" fill="${curIsBookmarked ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
    </button>
    <button id="fe-theme-btn" title="Toggle theme \u2014 currently ${initTheme === "light" ? "Light" : "Dark"}">
      <svg id="fe-sun" width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="2.8" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.9 2.9l1 1M10.1 10.1l1 1M10.1 2.9l-1 1M3.9 10.1l-1 1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
      <svg id="fe-moon" width="14" height="14" viewBox="0 0 14 14"><path d="M11.5 8.5A5 5 0 0 1 5.5 2.5a5 5 0 1 0 6 6z" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>
    </button>
    <button id="fe-help-btn" title="Help \u2014 what's here and how to use it">
      <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M5.2 5.2a1.9 1.9 0 1 1 2.6 1.8c-.6.3-.8.6-.8 1.2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="7" cy="10.3" r="0.9" fill="currentColor"/></svg>
    </button>
    <button id="fe-settings-btn" title="Settings \u2014 customize theme, views, terminal, icon rules">
      <svg width="14" height="14" viewBox="0 0 14 14"><path d="M8.5 1H5.5L4.5 2.8 2.5 4 1 5.5v3L2.5 10l2 1.2L5.5 13h3l1-1.8 2-1.2L13 8.5v-3L11.5 4l-2-1.2z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><circle cx="7" cy="7" r="2" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>
    </button>
  </div>

  <div id="fe-body">
    <nav id="fe-side">
      <div class="fe-sec">
        <div class="fe-sh" style="justify-content:space-between">Saved
          <button id="fe-sv-add" title="Save this ${fileMode ? "file" : "folder"} and name it">+</button></div>
        <input id="fe-sv-filter" type="text" placeholder="Filter saved\u2026" spellcheck="false" autocomplete="off" title="Matches label, path and tag">
        <div id="fe-sv-list">${renderSavedList(getSaved(), getTags(), rawPath)}</div>
      </div>
      <div class="fe-sec" id="fe-notes-sec" style="display:none">
        <div class="fe-sh" style="justify-content:space-between"><a id="fe-notes-root" title="Open the notes folder">Notes</a>
          <button id="fe-nt-add" title="New note (n)">+</button></div>
        <div id="fe-nt-list"></div>
      </div>${recentsHTML}
      <div class="fe-sec" data-sec="favorites"${settings.hideFavorites ? ' style="display:none"' : ""}>
        <div class="fe-sh">Finder Favorites</div>
        ${FINDER_FAVORITES.map(
      (p2) => `<a href="${p2.href}" class="fe-si${p2.href.replace(/\/$/, "") === "file://" + rawPath.replace(/\/$/, "") ? " active" : ""}" title="${p2.label}
${p2.href}">${PI[p2.icon] ?? PI.folder}<span class="fe-sl">${p2.label}</span></a>`
    ).join("")}
      </div>
      <div class="fe-sec" data-sec="system"${settings.hideSystem ? ' style="display:none"' : ""}>
        <div class="fe-sh">System</div>
        <a href="file:///" class="fe-si" title="Root
file:///">${PI.root}<span class="fe-sl">Root /</span></a>
        <a href="file:///Users/alcatraz627/" class="fe-si" title="Home
file:///Users/alcatraz627/">${PI.home}<span class="fe-sl">Home</span></a>
      </div>
    </nav>

    <div id="fe-main">
      <div id="fe-tabs" title="Tabs of this Chrome tab (t keeps this one, w closes, p pins, [ ] switch, 1-9 jump)"></div>
      ${fileMode ? renderFileContent() : ""}
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
          <button id="fe-hidden-btn" class="${initHidden ? "on" : ""}" title="Hidden files: ${initHidden ? "showing" : "hiding"} dotfiles \xB7 click to toggle">
            <svg width="13" height="13" viewBox="0 0 13 13"><path d="M1 6.5C2.5 3 4.8 1.5 6.5 1.5S10.5 3 12 6.5C10.5 10 8.2 11.5 6.5 11.5S2.5 10 1 6.5z" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="6.5" cy="6.5" r="2" fill="${initHidden ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.3"/></svg>
          </button>
          <div id="fe-zoom-wrap" title="Zoom: ${initZoom}% \xB7 drag to scale the list (50 to 320%)">
            <svg width="11" height="11" viewBox="0 0 11 11"><circle cx="4.5" cy="4.5" r="3.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M7.5 7.5L10 10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
            <input type="range" id="fe-zoom" min="50" max="320" value="${initZoom}" step="5" title="Zoom: ${initZoom}% \xB7 drag to scale">
            <span id="fe-zoom-val">${initZoom}%</span>
          </div>
          <div id="fe-view-group">${viewBtnsHTML}</div>
          <button id="fe-deep-btn" title="Deep search: include every subfolder in the filter">
            <svg width="13" height="13" viewBox="0 0 13 13"><path d="M1 2.5h4l1 1.2h6v7H1z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M3.5 6h3l.8 1h2.7v2.5H3.5z" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/></svg>
          </button>
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
        <div class="fe-panel-row">
          <span class="fe-panel-lbl">Text inside files</span>
          <input id="fe-find-text" type="text" placeholder="words to look for\u2026" autocomplete="off" spellcheck="false" title="Reads text files (up to 2 MB each) in this folder, or every subfolder when deep search is on. Enter runs."/>
          <label class="fe-st-check" title="Match case"><input type="checkbox" id="fe-find-case" title="Match case"> Aa</label>
          <button id="fe-find-run" class="fe-pbn" title="Run the text search (Enter)">Run</button>
          <button id="fe-find-cancel" class="fe-pbn" style="display:none" title="Stop scanning">Cancel</button>
          <span id="fe-find-status"></span>
          <button id="fe-find-save" class="fe-pbn" style="margin-left:auto" title="Keep this search as a Saved view: this folder plus these fields">\u2606 Save view</button>
        </div>
      </div>

      <div id="fe-scroll" style="zoom:${initZoom / 100}">
        <table id="fe-table">
          <thead>
            <tr>
              <th class="c-nm" data-ck="nm" data-sort="name" title="Sort by name \xB7 again flips \xB7 drag the edge to resize">Name <span class="si">\u2195</span><span class="fe-col-rz"></span></th>
              <th class="c-tp" data-ck="tp" title="Type \xB7 drag the edge to resize">Type<span class="fe-col-rz"></span></th>
              <th class="c-sz" data-ck="sz" data-sort="size" title="Sort by size \xB7 again flips">Size <span class="si">\u2195</span><span class="fe-col-rz"></span></th>
              <th class="c-dt" data-ck="dt" data-sort="date" title="Sort by modified date \xB7 again flips">Modified <span class="si">\u2195</span></th>
            </tr>
          </thead>
          <tbody id="fe-tbody">${renderRows(ALL_ENTRIES, ctx0)}</tbody>
        </table>
        <div id="fe-tiles">${renderTiles(ALL_ENTRIES, ctx0)}</div>
      </div>

      <div id="fe-statusbar">
        <span id="fe-status-text">${fileMode ? esc(fileName) : `${dirs} folder${dirs !== 1 ? "s" : ""}, ${files} file${files !== 1 ? "s" : ""}`}</span>
        ${fileMode ? '<span id="fe-fp-reload" title="Re-rendered when the file changes on disk">watching for changes</span>' : ""}
        <span id="fe-status-path">${esc(rawPath)}</span>
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
    el("fe-theme-btn").addEventListener("click", () => {
      const next = fe.dataset.theme === "dark" ? "light" : "dark";
      fe.dataset.theme = next;
      localStorage.setItem(THEME_KEY, next);
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
      if ((settings.terminalApp || "ghostty") === "ghostty") {
        chrome.runtime.sendMessage(
          { type: "bfb-native-oneshot", host: "com.better_file_browser.ghostty", payload: { action: "open_terminal", path } },
          (res) => {
            if (chrome.runtime.lastError || !res?.ok) fallbackCopy(path);
          }
        );
        return;
      }
      fallbackCopy(path);
    };
    el("fe-term-btn").addEventListener("click", () => app.openInTerminal(app.folderPath));
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
        crumbMenu.innerHTML = `<div class="fe-dd-search-wrap"><input class="fe-dd-search" type="text" placeholder="Filter\u2026" autocomplete="off" spellcheck="false" title="Type to narrow \xB7 Enter opens the first match \xB7 Esc closes"></div><div class="fe-dd-items">${entries.map(
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
    const ctx = () => ({ rawPath, iconRules: app.iconRules, settings: app.settings });
    const nonPar = all.filter((e) => !e.isParent);
    const dirs = nonPar.filter((e) => e.isDir).length;
    const files = nonPar.filter((e) => !e.isDir).length;
    const hidden = nonPar.filter((e) => e.isHidden).length;
    ls.baseStatus = `${dirs} folder${dirs !== 1 ? "s" : ""}, ${files} file${files !== 1 ? "s" : ""}`;
    function applyAll() {
      const parent = all.filter((e) => e.isParent);
      let entries = ls.deepOn && ls.deepEntries ? ls.deepEntries : nonPar;
      entries = applyFilter(entries, ls.filter);
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
        rowParts.push(renderRow(e, c, idx));
        tileParts.push(renderTile(e, c, idx));
      };
      parent.forEach(pushEntry);
      if (ls.group !== "none") {
        for (const g of buildGroups(entries, ls.group)) {
          rowParts.push(`<tr class="fe-group-hdr"><td colspan="4">${esc(g.label)}</td></tr>`);
          tileParts.push(`<div class="fe-group-hdr-tile">${esc(g.label)}</div>`);
          g.items.forEach(pushEntry);
        }
      } else {
        entries.forEach(pushEntry);
      }
      tbody.innerHTML = rowParts.join("");
      tiles.innerHTML = tileParts.join("");
      const shown = ls.visible.filter((en) => !en.isParent).length;
      const filtered = !!ls.filter.q || ls.filter.type !== "all";
      if (ls.contentHits) {
        ls.baseStatus = `${shown} file${shown !== 1 ? "s" : ""} containing "${ls.contentText}"${ls.deepOn ? ` in ${ls.deepFolders} folders` : ""}`;
      } else if (ls.deepOn) {
        ls.baseStatus = ls.deepScanning ? `Scanning\u2026 ${ls.deepFolders} folder${ls.deepFolders !== 1 ? "s" : ""}` : `${shown} of ${ls.deepEntries?.length ?? 0} items in ${ls.deepFolders} folders${ls.deepTruncated ? " (capped)" : ""}`;
      } else {
        ls.baseStatus = filtered ? `${shown} of ${nonPar.length} item${nonPar.length !== 1 ? "s" : ""} shown` : `${dirs} folder${dirs !== 1 ? "s" : ""}, ${files} file${files !== 1 ? "s" : ""}`;
      }
      el("fe-count").textContent = ls.baseStatus;
      sel.setSel(-1);
    }
    app.applyAll = applyAll;
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
        t.textContent = en && !en.isParent ? en.isDir ? `${en.name}/` : `${en.name} \xB7 ${fmtSize(en.rawBytes)}` : ls.baseStatus;
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
        localStorage.setItem(VIEW_KEY, btn.dataset.view);
      });
    });
    const hiddenBtn = el("fe-hidden-btn");
    if (init.hidden) fe.classList.add("show-hidden");
    hiddenBtn.addEventListener("click", () => {
      const on = fe.classList.toggle("show-hidden");
      hiddenBtn.classList.toggle("on", on);
      hiddenBtn.title = `Hidden files: ${on ? "showing" : "hiding"} dotfiles \xB7 click to toggle`;
      localStorage.setItem(HIDDEN_KEY, String(on));
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
      localStorage.setItem(ZOOM_KEY, String(z));
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
      ls.filter.q = this.value;
      applyAll();
    });
    el("fe-regex-btn").addEventListener("click", function() {
      ls.filter.regex = !ls.filter.regex;
      this.classList.toggle("active", ls.filter.regex);
      this.title = ls.filter.regex ? "Regex mode on" : "Toggle regex mode";
      applyAll();
    });
    el("fe-type-filter").addEventListener("change", function() {
      ls.filter.type = this.value;
      applyAll();
    });
    const findText = el("fe-find-text");
    const findCase = el("fe-find-case");
    const findStatus = el("fe-find-status");
    const findCancel = el("fe-find-cancel");
    function currentFind() {
      const type = ls.filter.type;
      return {
        scope: ls.deepOn ? "deep" : "here",
        name: ls.filter.q,
        regex: ls.filter.regex,
        exts: ["all", "folders", "files"].includes(type) ? [] : [type],
        text: findText.value.trim(),
        caseSensitive: findCase.checked
      };
    }
    async function runFind(text) {
      const seq = ++ls.findSeq;
      ls.contentText = text;
      if (!text) {
        ls.contentHits = null;
        findStatus.textContent = "";
        findCancel.style.display = "none";
        applyAll();
        return;
      }
      if (ls.deepOn && ls.deepScanning) {
        ls.pendingFindText = text;
        findStatus.textContent = "waiting for the folder scan\u2026";
        return;
      }
      const source = ls.deepOn && ls.deepEntries ? ls.deepEntries : nonPar;
      const candidates = applyFilter(source, ls.filter).filter(isTextCandidate);
      findStatus.textContent = `scanning 0/${candidates.length}`;
      findCancel.style.display = "";
      const r = await searchContents(
        candidates,
        fetchFileText,
        { ...currentFind(), text },
        (d, t) => {
          if (seq === ls.findSeq) findStatus.textContent = `scanning ${d}/${t}`;
        },
        () => seq !== ls.findSeq
      );
      if (seq !== ls.findSeq) return;
      findCancel.style.display = "none";
      ls.contentHits = r.hits;
      findStatus.textContent = `${r.hits.size} of ${r.scanned} files${r.failed ? `, ${r.failed} unreadable` : ""}${r.cancelled ? " (stopped)" : ""}`;
      applyAll();
    }
    el("fe-find-run").addEventListener("click", () => void runFind(findText.value.trim()));
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
    findCancel.addEventListener("click", () => {
      ls.findSeq++;
      findCancel.style.display = "none";
      findStatus.textContent = "stopped";
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
      filterBar.style.display = "";
      el("fe-filter-btn").classList.add("on");
      if (q.scope === "deep" !== ls.deepOn) deepBtn.click();
      ls.contentHits = null;
      if (q.text) {
        if (ls.deepOn && (ls.deepScanning || !ls.deepEntries)) ls.pendingFindText = q.text;
        else void runFind(q.text);
      }
      applyAll();
    }
    window.addEventListener("hashchange", applyFindFromHash);
    const deepBtn = el("fe-deep-btn");
    const searchEl = el("fe-search");
    function startDeepCrawl() {
      const seq = ++ls.deepSeq;
      ls.deepScanning = true;
      crawl(
        new URL(location.href).href,
        (url) => fetchFileText(url).then((html) => parseListing(html, url)),
        {
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
        if (seq !== ls.deepSeq) return;
        ls.deepEntries = r.entries;
        ls.deepFolders = r.folders;
        ls.deepTruncated = r.truncated;
        ls.deepScanning = false;
        applyAll();
        if (r.truncated) toast("Deep search capped: too many items or folders too deep");
        if (ls.pendingFindText !== null) {
          const t = ls.pendingFindText;
          ls.pendingFindText = null;
          void runFind(t);
        }
      });
    }
    deepBtn.addEventListener("click", () => {
      ls.deepOn = !ls.deepOn;
      deepBtn.classList.toggle("on", ls.deepOn);
      searchEl.placeholder = ls.deepOn ? "Search subfolders\u2026" : "Filter\u2026";
      if (ls.deepOn) {
        if (!ls.deepEntries) startDeepCrawl();
        else applyAll();
        searchEl.focus();
      } else {
        ls.deepSeq++;
        ls.deepScanning = false;
        applyAll();
      }
    });
    searchEl.addEventListener("input", function() {
      ls.filter.q = this.value;
      el("fe-filter-q").value = this.value;
      applyAll();
    });
    searchEl.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      if (searchEl.value) {
        searchEl.value = "";
        ls.filter.q = "";
        el("fe-filter-q").value = "";
        applyAll();
      }
      searchEl.blur();
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
        location.href = en.href;
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
        location.href = en.href;
        return;
      }
      if (!sel.selectable(i)) return;
      sel.setSel(i);
      if (!canPreview(en) || app.settings.clickOpens === "go") {
        location.href = en.href;
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
      location.href = en.href;
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
          s.focus();
          s.select();
        }
        return;
      }
      const ae = document.activeElement;
      if (ae && ["INPUT", "TEXTAREA", "SELECT"].includes(ae.tagName)) return;
      if (el("fe-settings-modal").style.display !== "none") return;
      if (el("fe-help-modal").style.display !== "none") return;
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
          if (en) location.href = en.href;
        } else if (e.key === "t" && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          keepPreviewedAsTab();
        } else if (["[", "]", "1", "2", "3", "4", "5", "6", "7", "8", "9"].includes(e.key) && app.strip.handleKey(e)) e.preventDefault();
        return;
      }
      if (app.filePage && e.key === "r" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        app.filePage.toggleRaw();
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
        location.href = ls.visible[ls.selIdx].href;
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
  function initSidebar(app) {
    const { rawPath, settings, toast } = app;
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
    function inlineEdit(target, onSave) {
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
    const ntSec = el("fe-notes-sec");
    const ntList = el("fe-nt-list");
    const ntHint = el("fe-st-notes-hint");
    function notesRoot() {
      return (settings.notesRoot || "").replace(/\/$/, "");
    }
    function refreshNotes() {
      const root = notesRoot();
      ntSec.style.display = root ? "" : "none";
      if (!root) {
        ntHint.textContent = "";
        return;
      }
      el("fe-notes-root").href = "file://" + root + "/";
      notes.list(root).then((list) => {
        ntHint.textContent = `${list.length} note${list.length !== 1 ? "s" : ""} in ${root}`;
        ntList.innerHTML = list.length ? list.map((n) => `
          <div class="fe-bm-item fe-nt-item" data-rel="${esc(n.rel)}">
            <a href="file://${esc(root + "/" + n.rel)}" class="fe-si-link" title="${esc(n.rel)}">
              ${PI.docs ?? PI.folder}<span class="fe-sl fe-nt-label" title="Double-click to rename">${esc(noteTitle(n.rel))}</span>
            </a>
            <button class="fe-rm-btn" data-rel="${esc(n.rel)}" title="Move to .trash">\u2715</button>
          </div>`).join("") : `<div class="fe-hint">No notes yet.<br>Press n or + to write one.</div>`;
        attachNoteEvents(root);
      }).catch((err) => {
        ntHint.textContent = err.message;
        ntList.innerHTML = `<div class="fe-hint">${esc(err.code === "unavailable" ? "Notes host not installed. Run native/install.sh." : err.message)}</div>`;
      });
    }
    app.refreshNotes = refreshNotes;
    function openNoteRel(root, rel) {
      notes.read(root, rel).then((doc) => openNote(root, doc, refreshNotes)).catch((err) => toast(err.message));
    }
    function attachNoteEvents(root) {
      els(".fe-nt-item", ntList).forEach((item) => {
        const rel = item.dataset.rel;
        item.querySelector(".fe-si-link").addEventListener("click", (e) => {
          if (e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return;
          e.preventDefault();
          openNoteRel(root, rel);
        });
        item.querySelector(".fe-nt-label").addEventListener("dblclick", (e) => {
          e.preventDefault();
          e.stopPropagation();
          inlineEdit(e.currentTarget, (val) => {
            const to = rel.replace(/[^/]+$/, slugForTitle(val));
            notes.rename(root, rel, to).then(refreshNotes).catch((err) => toast(err.message));
          });
        });
        item.querySelector(".fe-rm-btn").addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          notes.delete(root, rel).then(() => {
            refreshNotes();
            toast("Moved to .trash");
          }).catch((err) => toast(err.message));
        });
      });
    }
    app.newNote = () => {
      const root = notesRoot();
      if (!root) {
        toast("Set a Notes folder in Settings first");
        return;
      }
      const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[-:T]/g, "").slice(0, 14);
      const rel = `untitled-${stamp}.md`;
      notes.create(root, rel, newNoteText("Untitled")).then(() => openNoteRel(root, rel)).catch((err) => toast(err.message));
    };
    el("fe-nt-add").addEventListener("click", () => app.newNote());
    refreshNotes();
    const anchorPath = (a) => decodeURIComponent((a.getAttribute("href") || "").slice(7));
    for (const host of [el("fe-side"), el("fe-bc"), el("fe-crumb-menu")]) {
      host.addEventListener("click", (e) => {
        const a = e.target.closest('a[href^="file://"]');
        if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || e.detail > 1) return;
        const path = anchorPath(a);
        if (e.altKey) {
          e.preventDefault();
          app.strip.open(path.split("#")[0], true);
          return;
        }
        if (host.id !== "fe-side" || a.closest("#fe-nt-list") || path.includes("#")) return;
        e.preventDefault();
        app.strip.go(path);
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
        <input type="text" class="fe-st-rule-pattern" value="${esc(rule.pattern)}" placeholder="regex\u2026" title="Regex (case-insensitive)">
        <input type="text" class="fe-st-rule-label"   value="${esc(rule.label)}"   placeholder="LBL"   maxlength="4" title="Badge text (\u22644 chars)">
        <input type="color" class="fe-st-rule-color"  value="${esc(rule.color)}"        title="Icon color">
        <button class="fe-st-rule-del" data-idx="${i}" title="Delete">\u2715</button>
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
    function openSettings() {
      els('input[name="bfb-theme"]').forEach((r) => {
        r.checked = r.value === (fe.dataset.theme || "dark");
      });
      el("fe-st-defview").value = getView();
      el("fe-st-compact").checked = !!settings.compactMode;
      el("fe-st-sidebar").checked = settings.showSidebar !== false;
      el("fe-st-datefmt").value = settings.dateFormat || "short";
      el("fe-st-terminal").value = settings.terminalApp || "ghostty";
      el("fe-st-term-custom-row").style.display = settings.terminalApp === "custom" ? "" : "none";
      el("fe-st-term-custom").value = settings.terminalCmd || "";
      el("fe-st-notes-root").value = settings.notesRoot || "";
      el("fe-st-filepages").value = settings.renderFilePages || "all";
      el("fe-st-sec-recent").checked = !settings.hideRecent;
      el("fe-st-sec-favorites").checked = !settings.hideFavorites;
      el("fe-st-sec-system").checked = !settings.hideSystem;
      el("fe-st-tooltips").checked = settings.tooltips !== false;
      el("fe-st-panel").value = getPreviewLayout().mode;
      el("fe-st-click").value = settings.clickOpens || "look";
      el("fe-st-strip-restore").checked = settings.stripRestore !== false;
      el("fe-st-rd-column").checked = !!settings.readerColumn;
      el("fe-st-rd-size").value = String(settings.readerSize || 15);
      el("fe-st-rd-lh").value = String(settings.readerLineHeight || 1.65);
      el("fe-st-rd-code").value = String(settings.readerCodeSize || 13);
      updateTermHint();
      renderRulesList();
      refreshAiStatus();
      settingsDlg.open();
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
          warmBtn.textContent = s.warm ? "Unload (warm off)" : "Keep warm";
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
    el("fe-settings-btn").addEventListener("click", openSettings);
    const helpDlg = mountDialog("fe-help-modal");
    el("fe-help-btn").addEventListener("click", () => helpDlg.open());
    el("fe-st-keys").addEventListener("click", () => {
      settingsDlg.close();
      helpDlg.open("keys");
    });
    const secToggle = (id, key, sec) => {
      el(id).addEventListener("change", function() {
        settings[key] = !this.checked;
        saveSettings(settings);
        const node = document.querySelector(`#fe-side .fe-sec[data-sec="${sec}"]`);
        if (node) node.style.display = this.checked ? "" : "none";
      });
    };
    secToggle("fe-st-sec-recent", "hideRecent", "recent");
    secToggle("fe-st-sec-favorites", "hideFavorites", "favorites");
    secToggle("fe-st-sec-system", "hideSystem", "system");
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
    el("fe-st-strip-restore").addEventListener("change", function() {
      settings.stripRestore = this.checked;
      saveSettings(settings);
    });
    el("fe-st-rd-column").addEventListener("change", function() {
      settings.readerColumn = this.checked;
      saveSettings(settings);
    });
    const readerVar = (id, key, cssVar, unit) => {
      el(id).addEventListener("change", function() {
        settings[key] = Number(this.value);
        saveSettings(settings);
        fe.style.setProperty(cssVar, this.value + unit);
      });
    };
    readerVar("fe-st-rd-size", "readerSize", "--rd-size", "px");
    readerVar("fe-st-rd-lh", "readerLineHeight", "--rd-lh", "");
    readerVar("fe-st-rd-code", "readerCodeSize", "--rd-code", "px");
    el("fe-st-export").addEventListener("click", () => {
      const out = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k.startsWith("bfb-")) {
          try {
            out[k] = JSON.parse(localStorage.getItem(k));
          } catch {
            out[k] = localStorage.getItem(k);
          }
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
          localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
          n++;
        }
        toast(`Imported ${n} keys, reloading`);
        setTimeout(() => location.reload(), 600);
      }).catch(() => toast("That file is not a JSON export"));
    });
    els('input[name="bfb-theme"]').forEach((r) => {
      r.addEventListener("change", () => {
        fe.dataset.theme = r.value;
        localStorage.setItem(THEME_KEY, r.value);
      });
    });
    el("fe-st-defview").addEventListener("change", function() {
      localStorage.setItem(VIEW_KEY, this.value);
    });
    el("fe-st-compact").addEventListener("change", function() {
      settings.compactMode = this.checked;
      saveSettings(settings);
      fe.classList.toggle("compact", this.checked);
    });
    el("fe-st-sidebar").addEventListener("change", function() {
      settings.showSidebar = this.checked;
      saveSettings(settings);
      el("fe-side").style.display = this.checked ? "" : "none";
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
      if (termBtn) termBtn.title = `Open in ${this.options[this.selectedIndex].text}`;
    });
    el("fe-st-filepages").addEventListener("change", function() {
      settings.renderFilePages = this.value;
      saveSettings(settings);
    });
    el("fe-st-notes-root").addEventListener("change", function() {
      settings.notesRoot = this.value.trim() || void 0;
      saveSettings(settings);
      app.refreshNotes();
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
    document.addEventListener("click", (e) => {
      const t = e.target;
      const copy = t.closest(".fe-md-copy");
      if (copy) {
        e.preventDefault();
        const pre = copy.closest(".fe-md-code")?.querySelector("pre");
        copyToClipboard(pre?.textContent || "").then((ok) => toast(ok ? "Copied the block" : "Copy failed"));
        return;
      }
      const img = t.closest(".fe-md img");
      if (img && !img.closest("a")) {
        e.preventDefault();
        window.open(img.src, "_blank");
      }
    });
  }

  // src/main.ts
  (function() {
    const preload = document.getElementById("bfb-preload");
    const settings = getSettings();
    const fileExt = filePageExt(location.pathname);
    const fileMode = !!fileExt && filePagesEnabled(fileExt, settings);
    if (!fileMode && !document.title.startsWith("Index of")) {
      preload?.remove();
      return;
    }
    const fileText = fileMode ? document.body.textContent || "" : "";
    const rawPath = decodeURIComponent(window.location.pathname);
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
    const recents = getRecents().filter((r) => r.path !== folderPath).slice(0, 6);
    pushRecent(folderPath);
    const recentsHTML = recents.length ? `
      <div class="fe-sec" data-sec="recent"${settings.hideRecent ? ' style="display:none"' : ""}>
        <div class="fe-sh">Recent</div>
        ${recents.map((r) => {
      const lbl = r.path.split("/").filter(Boolean).pop() || "/";
      return `<a href="file://${esc(r.path)}" class="fe-si" title="${esc(r.path)}">${PI.recent}<span class="fe-sl">${esc(lbl)}</span></a>`;
    }).join("")}
      </div>` : "";
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
    const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="%230d1117"/><path d="M3 12.5A1.5 1.5 0 0 1 4.5 11h5.5l2.5 3H28a1.5 1.5 0 0 1 1.5 1.5V24A1.5 1.5 0 0 1 28 25.5H4.5A1.5 1.5 0 0 1 3 24z" fill="%234a9eff"/><path d="M9 18.5h14M9 22h9" stroke="white" stroke-width="2" stroke-linecap="round" opacity="0.75"/></svg>`;
    document.head.innerHTML = `<meta charset="utf-8"><title>${document.title}</title><link rel="icon" href="data:image/svg+xml,${faviconSvg}">`;
    document.body.innerHTML = html;
    const styleEl = document.createElement("style");
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);
    preload?.remove();
    const fe = el("fe");
    if (!settings.showSidebar) el("fe-side").style.display = "none";
    if (settings.compactMode) fe.classList.add("compact");
    fe.style.setProperty("--rd-size", `${settings.readerSize || 15}px`);
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
      refreshSaved: () => {
      },
      refreshNotes: () => {
      },
      newNote: () => {
      },
      openInTerminal: () => {
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
    } });
    app.strip = mountStrip({ el: el("fe-tabs"), rawPath, toast: app.toast, onSavedChange: () => app.refreshSaved(), restore: settings.stripRestore !== false });
    if (fileMode) app.filePage = mountFileContent({ ext: fileExt, text: fileText, rawPath, href: location.href, column: !!settings.readerColumn });
    initChrome(app);
    initMarkdownUi(app.toast);
    const listing = initListing(app, entries, { view: initView, zoom: initZoom, hidden: initHidden });
    initListingInput(app, listing);
    initSettingsUi(app);
    initSidebar(app);
    if (listing.ls.sort.col || listing.ls.group !== "none") listing.applyAll();
    listing.applyFindFromHash();
    if (settings.tooltips === false) {
      const strip = () => document.querySelectorAll("[title]").forEach((x) => x.removeAttribute("title"));
      strip();
      new MutationObserver(strip).observe(fe, { childList: true, subtree: true });
    }
  })();
})();
