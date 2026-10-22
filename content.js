"use strict";
(() => {
  // src/parse.ts
  function nameOf(href, text) {
    const last = href.replace(/[?#].*$/, "").replace(/\/$/, "").split("/").pop() ?? "";
    try {
      return decodeURIComponent(last) || text;
    } catch {
      return text;
    }
  }
  var COMPANION = /\.bfb[^./]*\.json$/;
  function isHiddenName(name, isDir) {
    return name.startsWith(".") || !isDir && COMPANION.test(name);
  }
  function parseEntries() {
    const table = document.querySelector("table") || document.getElementById("listing-table");
    if (!table) return [];
    return Array.from(table.querySelectorAll("tr")).slice(1).flatMap((row2) => {
      const cells = row2.querySelectorAll("td");
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
      const name = isParent ? ".." : nameOf(href, isDir ? rawName.replace(/\/$/, "") : rawName);
      const isHidden = !isParent && isHiddenName(name, isDir);
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
          isHidden: isHiddenName(name, isDir),
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
    return Array.from(table.querySelectorAll("tr")).slice(1).flatMap((row2) => {
      const cells = row2.querySelectorAll("td");
      if (cells.length < 2) return [];
      const link = cells[0]?.querySelector("a");
      if (!link) return [];
      const rawName = link.textContent.trim();
      const rel = link.getAttribute("href");
      if (rel === "../") return [];
      const href = new URL(rel, baseUrl).href;
      const isDir = rel?.endsWith("/") ?? false;
      const name = nameOf(rel, isDir ? rawName.replace(/\/$/, "") : rawName);
      const isHidden = isHiddenName(name, isDir);
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
  var DOWNLOAD_EXTS = /* @__PURE__ */ new Set(["yaml", "yml", "sql", "csv", "tsv", "xml"]);
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
  var DOTFILE_KINDS = /* @__PURE__ */ new Set(["env", "gitignore", "dockerignore", "npmrc", "editorconfig"]);
  function getExt(e) {
    if (e.isDir || e.isParent) return "";
    const bare = e.name.split("/").pop().toLowerCase();
    if (["dockerfile", "containerfile", "makefile", "gitignore"].includes(bare)) return bare;
    if (bare.startsWith(".") && bare.indexOf(".", 1) === -1) return DOTFILE_KINDS.has(bare.slice(1)) ? bare.slice(1) : "";
    const ext2 = bare.includes(".") ? bare.split(".").pop() : "";
    return ext2.length > 10 ? "" : ext2;
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
  function samePlace(a, b) {
    return a.replace(/\/+$/, "") === b.replace(/\/+$/, "");
  }
  function dedupePlaces(list3) {
    return list3.filter((p, i3) => list3.findIndex((q) => samePlace(q.path, p.path)) === i3);
  }
  function upsertPlace(list3, place) {
    if (list3.some((p) => samePlace(p.path, place.path))) return list3;
    return [...list3, place];
  }
  function removePlace(list3, path) {
    return list3.filter((p) => !samePlace(p.path, path));
  }
  function renamePlace(list3, path, label) {
    return list3.map((p) => p.path === path ? { ...p, label } : p);
  }
  function movePlace(list3, fromPath, toPath) {
    const from = list3.findIndex((p) => p.path === fromPath);
    const to = list3.findIndex((p) => p.path === toPath);
    if (from < 0 || to < 0 || from === to) return list3;
    const next = [...list3];
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
  function setTags(list3, path, tags) {
    return list3.map((p) => p.path === path ? { ...p, tags: tags.length ? tags : void 0 } : p);
  }
  var TAG_COLORS = ["#58a6ff", "#3fb950", "#d29922", "#f778ba", "#a371f7", "#f0883e", "#39c5cf", "#8b949e"];
  function reconcileTags(list3, tags) {
    const used = [];
    for (const p of list3) for (const t of p.tags ?? []) if (!used.includes(t)) used.push(t);
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
      const i3 = TAG_COLORS.indexOf(t.color);
      return { ...t, color: TAG_COLORS[(i3 + 1) % TAG_COLORS.length] };
    });
  }
  function filterSaved(list3, text) {
    const words = text.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return list3;
    return list3.filter((p) => {
      const tags = (p.tags ?? []).map((t) => t.toLowerCase());
      const hay = `${p.label} ${p.path} ${tags.join(" ")}`.toLowerCase();
      return words.every((w) => w.startsWith("#") ? w.length > 1 && tags.some((t) => t.includes(w.slice(1))) : hay.includes(w));
    });
  }
  function groupByTag(list3, tags) {
    const groups = [{ tag: null, items: list3.filter((p) => !p.tags?.length) }];
    for (const tag of tags) {
      const items = list3.filter((p) => p.tags?.[0] === tag.name);
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
      for (let i3 = 0; i3 < localStorage.length; i3++) {
        const k = localStorage.key(i3);
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
  var PALETTE_KEY = "bfb-palette";
  var PALETTES = ["slate", "violet", "sand", "ink", "ocean", "forest", "ember", "nord"];
  var DENSITY_KEY = "bfb-density";
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
    syncHtmlGuard(s);
  }
  function filePagesEnabled(ext2, settings) {
    const mode = settings.renderFilePages || "all";
    const excluded = Array.isArray(settings.excludedFileExtensions) ? settings.excludedFileExtensions : ["pdf", "html", "htm"];
    return !(excluded.includes(ext2.toLowerCase()) || mode === "off" || mode === "not-md" && (ext2 === "md" || ext2 === "mdx"));
  }
  var HTML_GUARD_KEY = "bfbHtmlTakeover";
  function syncHtmlGuard(s) {
    try {
      localStorage.setItem(HTML_GUARD_KEY, ["html", "htm"].filter((x) => filePagesEnabled(x, s)).join(" "));
    } catch {
    }
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
    if (kvGet(SAVED_KEY) !== null) return dedupePlaces(readList(SAVED_KEY));
    const merged = mergeLegacy(readList(BM_KEY), readList(PLACES_KEY));
    kvSet(SAVED_KEY, JSON.stringify(merged));
    return merged;
  }
  var isSaved = (path) => getSaved().some((p) => samePlace(p.path, path));
  function toggleSaved(path, label) {
    const list3 = getSaved();
    const was = list3.some((p) => samePlace(p.path, path));
    saveSaved(was ? removePlace(list3, path) : upsertPlace(list3, { path, label }));
    return !was;
  }
  function saveSaved(list3) {
    list3 = dedupePlaces(list3);
    kvSet(SAVED_KEY, JSON.stringify(list3));
    kvSet(TAGS_KEY, JSON.stringify(reconcileTags(list3, readList(TAGS_KEY))));
  }
  function getTags() {
    return reconcileTags(getSaved(), readList(TAGS_KEY));
  }
  function saveTags(tags) {
    kvSet(TAGS_KEY, JSON.stringify(tags));
  }
  function getRecents() {
    try {
      const list3 = JSON.parse(kvGet(RECENTS_KEY) ?? "[]");
      return Array.isArray(list3) ? list3.filter((r) => typeof r?.path === "string") : [];
    } catch {
      return [];
    }
  }
  function pushRecent(path) {
    const list3 = getRecents().filter((r) => r.path !== path);
    list3.unshift({ path, ts: Date.now() });
    kvSet(RECENTS_KEY, JSON.stringify(list3.slice(0, 40)));
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
  var FOLDED_KEY = "bfb-saved-folded-v1";
  function getFoldedGroups() {
    try {
      return new Set(JSON.parse(kvGet(FOLDED_KEY) ?? "[]"));
    } catch {
      return /* @__PURE__ */ new Set();
    }
  }
  function saveFoldedGroups(s) {
    kvSet(FOLDED_KEY, JSON.stringify([...s]));
  }
  function setHomeDir(home) {
    if (!/^\/Users\/[^/]+$/.test(home) || home === "/Users/Shared") return false;
    kvSet(HOME_KEY, home);
    return true;
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
    return viewPref.get();
  }
  function getPalette() {
    return palettePref.get();
  }
  var DENSITY_NAMES = ["Overview", "Large", "Standard", "Detailed", "Full detail"];
  function getDensity() {
    return densityPref.get();
  }
  function getShowHidden() {
    return hiddenPref.get();
  }
  function getPanelSize(key) {
    try {
      return kvGet(`bfb-panel-size:${key}`) || "";
    } catch {
      return "";
    }
  }
  function savePanelSize(key, size) {
    try {
      kvSet(`bfb-panel-size:${key}`, size);
    } catch {
    }
  }
  function getDialogPlace(id) {
    try {
      return kvGet(`bfb-dialog-place:${id}`) === "side" ? "side" : "window";
    } catch {
      return "window";
    }
  }
  function saveDialogPlace(id, place) {
    try {
      kvSet(`bfb-dialog-place:${id}`, place);
    } catch {
    }
  }
  function sessionGet(id) {
    try {
      return sessionStorage.getItem(id);
    } catch {
      return null;
    }
  }
  function sessionSet(id, v) {
    try {
      sessionStorage.setItem(id, v);
    } catch {
    }
  }
  function makePref(id, read2, write, where = "profile") {
    const tab = where === "tab";
    return {
      get: () => read2(tab ? sessionGet(id) : kvGet(id)),
      set: (v) => {
        const s = write(v);
        if (tab) sessionSet(id, s);
        else kvSet(id, s);
      },
      onChange: (fn) => {
        if (!tab) onKvChange((k) => {
          if (k === id) fn();
        });
      }
    };
  }
  var textPref = (id, init = "", where) => makePref(id, (r) => r ?? init, (v) => v, where);
  var choicePref = (id, choices, init) => makePref(id, (r) => choices.includes(r ?? "") ? r : init, (v) => v);
  var flagPref = (id, init, on = "1", off = "0") => makePref(id, (r) => r === on ? true : r === off ? false : init, (v) => v ? on : off);
  function jsonPref(id, init, valid = () => true, where) {
    const fresh = () => JSON.parse(JSON.stringify(init));
    return makePref(id, (r) => {
      if (r === null) return fresh();
      try {
        const v = JSON.parse(r);
        return valid(v) ? v : fresh();
      } catch {
        return fresh();
      }
    }, (v) => JSON.stringify(v), where);
  }
  var numberPref = (id, init, ok = Number.isFinite) => makePref(id, (r) => {
    const n = parseInt(r ?? "");
    return ok(n) ? n : init;
  }, (v) => String(v));
  var viewPref = textPref(VIEW_KEY, "details");
  var palettePref = choicePref(PALETTE_KEY, PALETTES, "slate");
  var densityPref = numberPref(DENSITY_KEY, 3, (n) => n >= 1 && n <= 5);
  var hiddenPref = flagPref(HIDDEN_KEY, false, "true", "false");
  var setPref = (id) => makePref(id, (r) => {
    try {
      const v = JSON.parse(r || "[]");
      return new Set(Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
    } catch {
      return /* @__PURE__ */ new Set();
    }
  }, (v) => JSON.stringify([...v]));
  function exportAll() {
    const out = {};
    for (const k of kvKeys().sort()) {
      const raw = kvGet(k);
      try {
        out[k] = JSON.parse(raw);
      } catch {
        out[k] = raw;
      }
    }
    return out;
  }
  function importAll(data) {
    let n = 0;
    for (const [k, val] of Object.entries(data)) if (k.startsWith("bfb-")) {
      kvSet(k, typeof val === "string" ? val : JSON.stringify(val));
      n++;
    }
    return n;
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
  async function fileRead(root, rel) {
    for (let attempt = 0; ; attempt++) {
      const parts = [];
      let mtime = -1, offset = 0, torn = false;
      while (offset != null) {
        const f = await call({ op: "fileRead", root, rel, offset });
        if (mtime !== -1 && f.mtime !== mtime) {
          torn = true;
          break;
        }
        mtime = f.mtime;
        parts.push(f.text);
        offset = f.next;
      }
      if (!torn) return { text: parts.join(""), mtime };
      if (attempt >= 3) throw new NotesError("notes_io", "the file kept changing while it was read");
    }
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
    /// The system chooser: a folder, or with kind 'any' a file or a folder (a folder ends in /). Empty when cancelled.
    pick: (start, kind) => call({ op: "pick", start, kind }).then((f) => f.root),
    /// The account's home folder, so Places can offer Home before any visit under it.
    home: () => call({ op: "home" }).then((f) => f.home),
    history: (root, rel) => call({ op: "history", root, rel }).then((f) => f),
    version: (root, rel, sha) => call({ op: "version", root, rel, sha }),
    /// Notes whose text holds every word of the query, each with its first matching line.
    search: (root, query) => call({ op: "search", root, query }).then((f) => f.hits),
    /// Any text file inside a folder allowed for editing; root is that folder.
    fileRead,
    /// A file's modified time and size, without reading it.
    fileStat: (root, rel) => call({ op: "fileStat", root, rel }),
    /// Every comment thread on a document, each with where it sits in the text now (bfb-docs).
    commentsRead: (root, rel) => call({ op: "commentsRead", root, rel }),
    /// Apply comment operations as the owner; the document itself is never written.
    commentsWrite: (root, rel, ops) => call({ op: "commentsWrite", root, rel, ops }),
    /// Every document with comments, from the bfb-docs index.
    docsIndex: () => call({ op: "docsIndex" }).then((f) => f.docs ?? []),
    /// Agent sessions claude-ipc sees as live or idle, for offering @claude:<alias>.
    people: () => call({ op: "people" }).then((f) => f.peers ?? []),
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
    const line2 = `title: ${JSON.stringify(title)}`;
    const fm = /^title:.*$/m.test(m[1]) ? m[1].replace(/^title:.*$/m, () => line2) : `${line2}
${m[1]}`;
    return text.replace(m[0], () => `---
${fm}
---`);
  }
  function setFirstLine(text, title) {
    const m = text.match(/^(\s*)([^\n]*)/);
    if (!m || !m[2].trim()) return null;
    const marks = m[2].match(/^#{1,6}[ \t]+/)?.[0];
    if (marks) return m[1] + marks + title + text.slice(m[0].length);
    return `# ${title}

` + text;
  }
  function nameIsId(rel) {
    return /^\d{8}-\d{6}(-[0-9a-f]{4})?\.md$/i.test(rel.split("/").pop() ?? "");
  }
  function retitle(text, title) {
    const { head, body } = splitNote(text);
    if (head && /^title:/m.test(head)) return setTitle(text, title);
    const lined = setFirstLine(body, title);
    if (lined !== null) return head + lined;
    return head ? setTitle(text, title) : null;
  }
  function settleClash(text, keep) {
    const out = [];
    let first = [], second = [];
    let part = "out";
    for (const line2 of text.split("\n")) {
      if (part === "out" && (line2.startsWith("<<<<<<< ") || line2 === "<<<<<<<")) {
        part = "first";
        first = [];
        second = [];
      } else if (part === "out") out.push(line2);
      else if (part === "first" && line2 === "=======") part = "second";
      else if (part === "first") first.push(line2);
      else if (line2.startsWith(">>>>>>> ") || line2 === ">>>>>>>") {
        part = "out";
        out.push(...keep === "second" ? second : keep === "first" ? first : [...first, ...second]);
      } else second.push(line2);
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
    for (const line2 of fmLines(head)) {
      const i3 = line2.indexOf(":");
      if (i3 > 0) f[line2.slice(0, i3).trim()] = unquoteYaml(line2.slice(i3 + 1).trim());
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
    const line2 = value === null ? null : `${key}: ${value}`;
    const { head, body } = splitNote(text);
    if (!head) return line2 === null ? text : `---
${line2}
---
${text}`;
    const lines = fmLines(head);
    const at = lines.findIndex((l) => l.slice(0, Math.max(l.indexOf(":"), 0)).trim() === key);
    if (at >= 0) {
      if (line2 === null) lines.splice(at, 1);
      else lines[at] = line2;
    } else if (line2 !== null) {
      const rank = KEY_ORDER.indexOf(key);
      let pos = lines.length;
      if (rank >= 0) {
        const later = lines.findIndex((l) => {
          const r = KEY_ORDER.indexOf(l.slice(0, Math.max(l.indexOf(":"), 0)).trim());
          return r < 0 || r > rank;
        });
        if (later >= 0) pos = later;
      }
      lines.splice(pos, 0, line2);
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
    return a.length === b.length && a.every((l, i3) => l === b[i3]) ? [] : [...a.filter((l) => !b.includes(l)).map((l) => `- ${l}`), ...b.filter((l) => !a.includes(l)).map((l) => `+ ${l}`)];
  }
  function sharedOrder(list3) {
    const made = (n) => n.created ?? n.mtime;
    return [...list3].sort((x, y) => {
      if (!!x.pinned !== !!y.pinned) return x.pinned ? -1 : 1;
      if (!x.pos !== !y.pos) return x.pos ? 1 : -1;
      if (!x.pos) return made(y) - made(x) || (x.rel < y.rel ? -1 : x.rel > y.rel ? 1 : 0);
      return x.pos < y.pos ? -1 : x.pos > y.pos ? 1 : x.rel < y.rel ? -1 : x.rel > y.rel ? 1 : 0;
    });
  }
  function filterNotes(list3, query) {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return list3;
    return list3.filter((n) => {
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

  // src/resize.ts
  function startDrag(e, cursor, move, end) {
    e.preventDefault();
    const x0 = e.clientX, y0 = e.clientY;
    const target = e.target;
    try {
      target.setPointerCapture?.(e.pointerId);
    } catch {
    }
    document.body.style.cursor = cursor;
    document.body.classList.add("fe-resizing");
    const onMove = (ev) => move(ev.clientX - x0, ev.clientY - y0);
    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      document.body.style.cursor = "";
      document.body.classList.remove("fe-resizing");
      end();
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  }
  function resizable(handle, s) {
    const dir = s.dir ?? 1;
    handle.classList.add("rz");
    handle.dataset.axis = s.axis;
    handle.tabIndex = 0;
    handle.setAttribute("role", "separator");
    handle.setAttribute("aria-orientation", "vertical");
    handle.setAttribute("aria-label", s.label);
    const cursor = s.axis === "xy" ? "nwse-resize" : "col-resize";
    handle.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      const { w, h } = s.size();
      handle.classList.add("drag");
      startDrag(e, cursor, (dx, dy) => s.apply(w + dx * dir, h + dy), () => {
        handle.classList.remove("drag");
        s.commit?.();
      });
    });
    handle.addEventListener("click", (e) => e.stopPropagation());
    handle.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      s.reset?.();
      s.commit?.();
    });
    handle.addEventListener("keydown", (e) => {
      const step2 = e.shiftKey ? 64 : 16;
      const dx = e.key === "ArrowRight" ? step2 : e.key === "ArrowLeft" ? -step2 : 0;
      const dy = s.axis === "xy" ? e.key === "ArrowDown" ? step2 : e.key === "ArrowUp" ? -step2 : 0 : 0;
      if (!dx && !dy) return;
      e.preventDefault();
      e.stopPropagation();
      const { w, h } = s.size();
      s.apply(w + dx * dir, h + dy);
      s.commit?.();
    });
  }

  // src/control-icons.ts
  var line = (body, size = 14) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  var svg = (body) => line(body);
  var SPARKLE = '<path d="M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0l1.58 6.14a2 2 0 0 0 1.44 1.44l6.14 1.58a.5.5 0 0 1 0 .96l-6.14 1.58a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z"/><path d="M20 3v4M22 5h-4"/>';
  var COPY = '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>';
  var HISTORY = '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>';
  var FILE_TEXT = '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M16 13H8M16 17H8M10 9H8"/>';
  var UI_ICON = {
    appearance: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>'),
    preview: svg('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/>'),
    files: svg(FILE_TEXT),
    exclusions: svg('<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M9 12h6"/>'),
    notes: svg('<path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8z"/><path d="M15 3v4a2 2 0 0 0 2 2h4"/>'),
    tab: svg('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18M12 13v5M9.5 15.5h5"/>'),
    terminal: svg('<path d="m7 11 2-2-2-2M11 13h4"/><rect width="18" height="18" x="3" y="3" rx="2"/>'),
    data: svg('<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5M3 12a9 3 0 0 0 18 0"/>'),
    ai: svg(SPARKLE),
    keyboard: svg('<rect width="20" height="16" x="2" y="4" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/>'),
    reset: svg(HISTORY),
    add: svg('<path d="M5 12h14M12 5v14"/>'),
    export: svg('<path d="M12 15V3M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>'),
    import: svg('<path d="M12 3v12M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/>'),
    warm: svg('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>'),
    unload: svg('<path d="M2 12h20M12 2v20m-8.5-15L20.5 17M20.5 7 3.5 17M9 4l3 2 3-2M9 20l3-2 3 2"/>'),
    close: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
    more: svg('<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'),
    // Text formatting in the note editor.
    fmtBold: svg('<path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"/>'),
    fmtItalic: svg('<path d="M19 4h-9M14 20H5M15 4 9 20"/>'),
    fmtCode: svg('<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>'),
    fmtStrike: svg('<path d="M16 4H9a3 3 0 0 0-2.83 4M14 12a4 4 0 0 1 0 8H6M4 12h16"/>'),
    fmtHeading: svg('<path d="M6 12h12M6 20V4M18 20V4"/>'),
    fmtQuote: svg('<path d="M17 6H3M21 12H8M21 18H8M3 12v6"/>'),
    fmtOlist: svg('<path d="M10 12h11M10 18h11M10 6h11M4 10h2M4 6h1v4M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>'),
    list: svg('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'),
    task: svg('<path d="m3 17 2 2 4-4M3 7l2 2 4-4M13 6h8M13 12h8M13 18h8"/>'),
    table: svg('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18M3 15h18M12 3v18"/>'),
    image: svg('<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>'),
    versions: svg(HISTORY + '<path d="M12 7v5l4 2"/>'),
    external: svg('<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'),
    pin: svg('<path d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>'),
    tag: svg('<path d="M12.59 2.59A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.42l8.7 8.7a2.43 2.43 0 0 0 3.42 0l6.58-6.58a2.43 2.43 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r="1" fill="currentColor"/>'),
    palette: svg('<path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.84-.44-1.13-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67h2c3.05 0 5.55-2.5 5.55-5.55C21.97 6.01 17.46 2 12 2z"/><circle cx="13.5" cy="6.5" r="1" fill="currentColor"/><circle cx="17.5" cy="10.5" r="1" fill="currentColor"/><circle cx="8.5" cy="7.5" r="1" fill="currentColor"/><circle cx="6.5" cy="12.5" r="1" fill="currentColor"/>'),
    zoomIn: svg('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35M11 8v6M8 11h6"/>'),
    zoomOut: svg('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35M8 11h6"/>'),
    actualSize: svg('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="m7.5 9 1.5-1v8M15 9l1.5-1v8M12 10.5v.01M12 14.5v.01"/>'),
    rotate: svg('<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>'),
    flip: svg('<path d="m3 7 5 5-5 5zM21 7l-5 5 5 5zM12 2v2M12 8v2M12 14v2M12 20v2"/>'),
    fit: svg('<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>'),
    size: svg('<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>'),
    rename: svg('<path d="M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z"/><path d="m15 5 4 4"/>'),
    trash: svg('<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/>'),
    prev: svg('<path d="m15 18-6-6 6-6"/>'),
    next: svg('<path d="m9 18 6-6-6-6"/>'),
    folderOpen: svg('<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>'),
    copy: svg(COPY),
    check: svg('<path d="M20 6 9 17l-5-5"/>'),
    eye: svg('<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>'),
    lock: svg('<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
    clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    send: svg('<path d="M12 19V5M5 12l7-7 7 7"/>'),
    file: svg('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>'),
    comment: svg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
    contents: svg('<path d="M15 12H3M17 18H3M21 6H3"/>'),
    info: svg('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'),
    circle: svg('<circle cx="12" cy="12" r="9"/>'),
    at: svg('<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>'),
    stack: svg('<path d="m12.83 2.18 8.58 3.9a1 1 0 0 1 0 1.83l-8.58 3.9a2 2 0 0 1-1.66 0L2.6 7.91a1 1 0 0 1 0-1.83l8.58-3.9a2 2 0 0 1 1.66 0z"/><path d="m22 12.5-9.17 4.16a2 2 0 0 1-1.66 0L2 12.5"/>'),
    link: svg('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),
    bot: svg('<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2M20 14h2M15 13v2M9 13v2"/>'),
    copyImage: svg(COPY)
  };
  var LINE_ICON = {
    home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .71-1.53l7-6a2 2 0 0 1 2.58 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/>',
    docs: FILE_TEXT,
    recent: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    ask: SPARKLE,
    desk: '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8M12 17v4"/>',
    down: '<path d="M12 15V3M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>',
    code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
    pics: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
    apps: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
    root: '<path d="M22 12H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11zM6 16h.01M10 16h.01"/>',
    scrnsh: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="m8 12 3 3 5-6"/>',
    bm: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
    tabset: '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65M22 12.65l-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/>',
    gear: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>'
  };
  var VIEW_ICONS = [
    { id: "details", label: "Details", ico: `<svg width="13" height="11" viewBox="0 0 13 11"><path d="M1 1h11M1 4h11M1 7h11M1 10h7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>` },
    { id: "list", label: "List", ico: `<svg width="13" height="11" viewBox="0 0 13 11"><circle cx="2" cy="2" r="1.1" fill="currentColor"/><path d="M5 2h7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="2" cy="5.5" r="1.1" fill="currentColor"/><path d="M5 5.5h7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="2" cy="9" r="1.1" fill="currentColor"/><path d="M5 9h7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>` },
    { id: "tree", label: "Tree", ico: `<svg width="13" height="13" viewBox="0 0 13 13"><path d="M2 1.5v8h3M2 5.5h3M6 4.5h6M6 9.5h6" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="5.5" cy="4.5" r=".8" fill="currentColor"/><circle cx="5.5" cy="9.5" r=".8" fill="currentColor"/></svg>` },
    { id: "tiles", label: "Tiles", ico: `<svg width="13" height="13" viewBox="0 0 13 13"><rect x="1" y="1" width="4.5" height="4.5" rx=".8" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="7.5" y="1" width="4.5" height="4.5" rx=".8" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="1" y="7.5" width="4.5" height="4.5" rx=".8" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="7.5" y="7.5" width="4.5" height="4.5" rx=".8" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>` },
    { id: "icons", label: "Large Icons", ico: `<svg width="13" height="13" viewBox="0 0 13 13"><rect x="1" y="1" width="5" height="5" rx="1" fill="currentColor" opacity=".6"/><rect x="7" y="1" width="5" height="5" rx="1" fill="currentColor" opacity=".6"/><rect x="1" y="7" width="5" height="5" rx="1" fill="currentColor" opacity=".6"/><rect x="7" y="7" width="5" height="5" rx="1" fill="currentColor" opacity=".6"/></svg>` }
  ];

  // src/layer.ts
  var CLOSES = {
    popover: { esc: true, outside: true, anchor: true, scroll: true, blur: true },
    hovercard: { esc: true, scroll: true },
    transient: {},
    command: { esc: true, outside: true },
    dialog: { esc: true },
    float: { esc: true }
  };
  var MODAL = { command: true, dialog: true, float: true };
  var stack = [];
  var topLayer = typeof HTMLElement !== "undefined" && typeof HTMLElement.prototype.showPopover === "function";
  var wired = false;
  var anchorClosed = null;
  var pressTarget = null;
  var opened = 0;
  var FOCUSABLE = 'button:not([disabled]),[href],input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';
  function openLayer(el2, opts) {
    wire();
    if (opts.anchor && anchorClosed === opts.anchor) {
      anchorClosed = null;
      return { el: el2, kind: opts.kind, open: false, close() {
      }, place() {
      } };
    }
    const existing = stack.find((l) => l.el === el2);
    existing?.close("replaced");
    if (opts.group) stack.filter((l) => l.opts.group === opts.group).forEach((l) => l.close("replaced"));
    const host = document.getElementById("fe") ?? document.body;
    const added = !el2.isConnected;
    if (added) host.appendChild(el2);
    el2.dataset.layer = opts.kind;
    if (opts.role) el2.setAttribute("role", opts.role);
    if (opts.label) el2.setAttribute("aria-label", opts.label);
    if (MODAL[opts.kind]) el2.setAttribute("aria-modal", "true");
    if (topLayer) {
      el2.setAttribute("popover", "manual");
      el2.showPopover();
    }
    const anchor = opts.anchor ?? null;
    anchor?.setAttribute("aria-expanded", "true");
    if (anchor && el2.id) anchor.setAttribute("aria-controls", el2.id);
    let open = true;
    const layer = {
      el: el2,
      kind: opts.kind,
      opts,
      returnTo: document.activeElement,
      at: null,
      seq: 0,
      get open() {
        return open;
      },
      place: () => position(el2, opts),
      close(why = "api") {
        if (!open) return;
        open = false;
        const i3 = stack.indexOf(layer);
        if (i3 >= 0) stack.splice(i3, 1);
        anchor?.setAttribute("aria-expanded", "false");
        const hadFocus = el2.contains(document.activeElement);
        if (topLayer && el2.matches(":popover-open")) el2.hidePopover();
        el2.removeAttribute("popover");
        delete el2.dataset.layer;
        if (added) el2.remove();
        if (hadFocus || document.activeElement === document.body) {
          const back = anchor ?? layer.returnTo;
          if (back?.isConnected) back.focus({ preventScroll: true });
        }
        opts.onClose?.(why);
      }
    };
    stack.push(layer);
    layer.seq = ++opened;
    position(el2, opts);
    layer.at = (anchor ?? opts.origin)?.getBoundingClientRect() ?? null;
    const f = opts.focus ?? (MODAL[opts.kind] ? "first" : "none");
    if (f === "first") el2.querySelector(FOCUSABLE)?.focus({ preventScroll: true });
    else if (f instanceof HTMLElement) f.focus({ preventScroll: true });
    return layer;
  }
  function raise(el2) {
    if (!topLayer) return;
    if (el2.matches(":popover-open")) {
      const since = Number(el2.dataset.raised);
      if (!stack.some((l) => l.seq > since) || el2.contains(document.activeElement)) return;
    }
    el2.dataset.raised = String(opened);
    if (!el2.hasAttribute("popover")) el2.setAttribute("popover", "manual");
    if (el2.matches(":popover-open")) el2.hidePopover();
    el2.showPopover();
    void el2.offsetWidth;
  }
  function lower(el2) {
    if (topLayer && el2.matches(":popover-open")) el2.hidePopover();
    el2.removeAttribute("popover");
    delete el2.dataset.raised;
  }
  function topmost() {
    return stack[stack.length - 1] ?? null;
  }
  function escTaken() {
    return stack.some((l) => CLOSES[l.kind].esc);
  }
  function position(el2, o) {
    const place = o.place ?? (o.point ? "point" : o.anchor ? "below" : "none");
    if (place === "none") return;
    el2.style.position = "fixed";
    el2.style.margin = "0";
    el2.style.inset = "auto";
    const gap = o.offset ?? 4, pad = 8;
    const w = el2.offsetWidth, h = el2.offsetHeight;
    let x, y;
    if (place === "point" && o.point) {
      x = o.point.x;
      y = o.point.y;
    } else {
      const r = (o.anchor ?? el2).getBoundingClientRect();
      if (place === "right") {
        x = r.right + gap;
        y = r.top;
      } else {
        x = o.align === "end" ? r.right - w : r.left;
        const below = r.bottom + gap, above = r.top - gap - h;
        y = place === "above" ? above >= pad ? above : below : below + h <= innerHeight - pad || above < pad ? below : above;
      }
    }
    el2.style.left = `${Math.max(pad, Math.min(x, innerWidth - w - pad))}px`;
    el2.style.top = `${Math.max(pad, Math.min(y, innerHeight - h - pad))}px`;
  }
  function wire() {
    if (wired) return;
    wired = true;
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      stack.filter((l) => l.kind === "hovercard").forEach((l) => l.close("esc"));
      const top = [...stack].reverse().find((l) => CLOSES[l.kind].esc);
      if (!top) return;
      e.preventDefault();
      e.stopPropagation();
      top.close("esc");
    }, true);
    document.addEventListener("pointerdown", (e) => {
      pressTarget = e.target;
      const t = e.target;
      const top = stack[stack.length - 1];
      if (!top || top.el.contains(t)) return;
      const anchor = top.opts.anchor;
      if (anchor?.contains(t)) {
        if (CLOSES[top.kind].anchor) {
          top.close("anchor");
          anchorClosed = anchor;
        }
        return;
      }
      anchorClosed = null;
      if (CLOSES[top.kind].outside) top.close("outside");
    }, true);
    document.addEventListener("click", (e) => {
      if (anchorClosed) setTimeout(() => {
        anchorClosed = null;
      });
      const top = stack[stack.length - 1], bd = top?.opts.backdrop;
      if (bd && e.target === bd && pressTarget === bd) top.close("outside");
    }, true);
    document.addEventListener("keydown", () => {
      anchorClosed = null;
    }, true);
    document.addEventListener("scroll", (e) => {
      const t = e.target;
      for (const l of [...stack]) {
        if (!CLOSES[l.kind].scroll || l.el.contains(t)) continue;
        const a = l.opts.anchor ?? l.opts.origin;
        if (a && l.at) {
          const r = a.getBoundingClientRect();
          if (Math.abs(r.top - l.at.top) < 2 && Math.abs(r.left - l.at.left) < 2) continue;
        }
        l.close("scroll");
      }
    }, true);
    document.addEventListener("focusin", (e) => {
      const t = e.target;
      for (const l of [...stack]) if (CLOSES[l.kind].blur && !l.el.contains(t) && !l.opts.anchor?.contains(t)) l.close("blur");
    });
  }
  function rovingFocus(root, items, o = {}) {
    const axis = o.axis ?? "vertical";
    const onKey = (e) => {
      if (e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const t = e.target;
      if (t.isContentEditable || t.matches("textarea, select, input:not([type=checkbox], [type=radio], [type=button], [type=submit])")) return;
      const list3 = [...root.querySelectorAll(items)].filter((x) => !x.hasAttribute("disabled") && x.offsetParent !== null);
      if (!list3.length) return;
      const i3 = list3.indexOf(document.activeElement);
      const next = axis !== "horizontal" && e.key === "ArrowDown" || axis !== "vertical" && e.key === "ArrowRight";
      const prev = axis !== "horizontal" && e.key === "ArrowUp" || axis !== "vertical" && e.key === "ArrowLeft";
      let to = -1;
      if (e.key === "Home") to = 0;
      else if (e.key === "End") to = list3.length - 1;
      else if (next) to = i3 < 0 ? 0 : i3 + 1 >= list3.length ? o.wrap === false ? i3 : 0 : i3 + 1;
      else if (prev) to = i3 <= 0 ? o.wrap === false ? 0 : list3.length - 1 : i3 - 1;
      if (to < 0) return;
      e.preventDefault();
      e.stopPropagation();
      list3[to].focus();
      o.onMove?.(list3[to]);
    };
    root.addEventListener("keydown", onKey);
    return () => root.removeEventListener("keydown", onKey);
  }
  function focusTrap(root, o = {}) {
    const onKey = (e) => {
      if (e.key !== "Tab" || !root.isConnected || getComputedStyle(root).display === "none" || o.when && !o.when()) return;
      const ae = document.activeElement;
      if (ae?.closest('textarea, [contenteditable="true"]')) return;
      const inside = !!ae && root.contains(ae);
      const layer = ae?.closest("[data-layer]");
      if (!inside && layer && !layer.contains(root)) return;
      const seen = /* @__PURE__ */ new Set();
      const stops = [...root.querySelectorAll(FOCUSABLE)].filter((x) => {
        if (x.offsetParent === null || x.disabled || x.tabIndex < 0) return false;
        const r = x;
        if (r.type !== "radio" || !r.name) return true;
        if (seen.has(r.name)) return false;
        seen.add(r.name);
        return true;
      }).map((x) => {
        const r = x;
        return r.type === "radio" && r.name ? root.querySelector(`input[type=radio][name="${CSS.escape(r.name)}"]:checked`) ?? x : x;
      });
      if (!stops.length) return;
      const first = stops[0], last = stops[stops.length - 1];
      const here = (s) => s === ae || ae?.type === "radio" && s.name === ae.name;
      const to = !inside ? e.shiftKey ? last : first : e.shiftKey ? here(first) ? last : null : here(last) ? first : null;
      if (!to) return;
      e.preventDefault();
      to.focus();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }

  // src/keymap.ts
  var GROUPS = [
    { name: "Anywhere", icon: "apps" },
    { name: "Go", icon: "home" },
    { name: "Listing", icon: "folder" },
    { name: "View", icon: "pics" },
    { name: "Tabs", icon: "tabset" },
    { name: "Sidebar", icon: "bm" },
    { name: "Preview", icon: "search" },
    { name: "File page", icon: "docs" },
    { name: "Editor", icon: "code" },
    { name: "Menus and dialogs", icon: "gear" }
  ];
  var KEYMAP = [
    // Anywhere
    { id: "palette", group: "Anywhere", title: "Command palette", keys: ["\u2318K"], own: true, over: true },
    { id: "keys", group: "Anywhere", title: "Keyboard map", keys: ["?"], own: true, over: true },
    { id: "settings", group: "Anywhere", title: "Settings", keys: [","], own: true, over: true },
    { id: "hints", group: "Anywhere", title: "Show keys on screen", keys: ["hold \u2325"], own: true, over: true },
    { id: "area-next", group: "Anywhere", title: "Next area", keys: ["F6", "\u2303`"], own: true, over: true },
    { id: "area-prev", group: "Anywhere", title: "Previous area", keys: ["\u21E7F6", "\u2303\u21E7`"], own: true, over: true },
    { id: "sidebar", group: "Anywhere", title: "Sidebar on or off", keys: ["\\"], own: true, over: true },
    { id: "theme", group: "Anywhere", title: "Dark or light", keys: ["\u21E7L"], own: true, over: true },
    { id: "esc", group: "Anywhere", title: "Close, or step back", keys: ["Esc"] },
    // Go
    { id: "up", group: "Go", title: "Parent folder", keys: ["\u232B", "\u2318\u2191"], own: true, over: ["\u2318\u2191"] },
    { id: "home", group: "Go", title: "Home", keys: ["g h"], own: true },
    { id: "path", group: "Go", title: "Type a path", keys: ["l"], own: true },
    { id: "goto-bg", group: "Go", title: "Open the typed path as a background tab", keys: ["\u2325\u21A9"], scope: "goto", own: true, field: true },
    { id: "open-pick", group: "Go", title: "Open a file or folder", keys: ["o"], own: true },
    { id: "save", group: "Go", title: "Save or unsave folder", keys: ["b"], own: true },
    { id: "terminal", group: "Go", title: "Terminal here", keys: ["`"], own: true },
    { id: "terminal-copy", group: "Go", title: "Copy terminal command", keys: ["\u21E7`"], own: true },
    { id: "to-listing", group: "Go", title: "Focus the listing", keys: ["g l"], own: true },
    { id: "area-leave", group: "Go", title: "Close the sidebar over the page, or go back to the listing", keys: ["Esc"], own: true, over: true },
    { id: "crumb-menu", group: "Go", title: "Folder menu of a path crumb", keys: ["\u2193"], scope: "bar", own: true },
    { id: "to-sidebar", group: "Go", title: "Focus the sidebar", keys: ["g s"], own: true },
    { id: "to-tabs", group: "Go", title: "Focus the tabs", keys: ["g t"], own: true },
    { id: "to-toolbar", group: "Go", title: "Focus the toolbar", keys: ["g b"], own: true },
    { id: "to-path", group: "Go", title: "Focus the path bar", keys: ["g p"], own: true },
    { id: "lens-places", group: "Go", title: "Places", keys: ["g 1"], own: true },
    { id: "lens-saved", group: "Go", title: "Saved", keys: ["g 2"], own: true },
    { id: "lens-notes", group: "Go", title: "Notes", keys: ["g 3"], own: true },
    { id: "lens-recent", group: "Go", title: "History", keys: ["g 4"], own: true },
    { id: "lens-search", group: "Go", title: "Search", keys: ["g 5"], own: true },
    { id: "lens-ask", group: "Go", title: "Ask", keys: ["g 6"], own: true },
    { id: "lens-docs", group: "Go", title: "Comments", keys: ["g 7"], own: true },
    // Listing
    { id: "move", group: "Listing", title: "Move", keys: ["\u2191", "\u2193"], scope: "listing", own: true },
    { id: "extend-up", group: "Listing", title: "Select upward", keys: ["\u21E7\u2191"], scope: "listing", own: true },
    { id: "extend-down", group: "Listing", title: "Select downward", keys: ["\u21E7\u2193"], scope: "listing", own: true },
    { id: "first", group: "Listing", title: "First item", keys: ["Home"], scope: "listing", own: true },
    { id: "last", group: "Listing", title: "Last item", keys: ["End"], scope: "listing", own: true },
    { id: "page-up", group: "Listing", title: "Page up", keys: ["PgUp"], scope: "listing", own: true },
    { id: "page-down", group: "Listing", title: "Page down", keys: ["PgDn"], scope: "listing", own: true },
    { id: "open", group: "Listing", title: "Open", keys: ["\u21A9"], scope: "listing", own: true },
    { id: "open-bg", group: "Listing", title: "Keep as a background tab", keys: ["\u2325\u21A9"], scope: "listing", own: true },
    { id: "open-chrome", group: "Listing", title: "Open in a Chrome tab", keys: ["\u2318\u21A9"], scope: "listing", own: true },
    { id: "look", group: "Listing", title: "Preview", keys: ["Space"], scope: "listing", own: true },
    { id: "tree-open", group: "Listing", title: "Expand folder (Tree)", keys: ["\u2192"], scope: "tree", own: true },
    { id: "tree-close", group: "Listing", title: "Collapse folder (Tree)", keys: ["\u2190"], scope: "tree", own: true },
    { id: "menu", group: "Listing", title: "Item menu", keys: ["x", "\u21E7F10"], scope: "listing", own: true },
    { id: "select-all", group: "Listing", title: "Select all", keys: ["\u2318A"], scope: "listing", own: true },
    { id: "copy-paths", group: "Listing", title: "Copy selected paths", keys: ["\u2318C"], scope: "listing", own: true },
    { id: "copy-path", group: "Listing", title: "Copy path", keys: ["y"], scope: "listing", own: true },
    { id: "copy-name", group: "Listing", title: "Copy name", keys: ["\u21E7Y"], scope: "listing", own: true },
    { id: "filter", group: "Listing", title: "Filter", keys: ["/", "\u2318F"], own: true },
    { id: "new-note", group: "Listing", title: "New note", keys: ["n"], own: true },
    // View
    { id: "view-details", group: "View", title: "Details", keys: ["v d"], own: true },
    { id: "view-list", group: "View", title: "List", keys: ["v l"], own: true },
    { id: "view-tree", group: "View", title: "Tree", keys: ["v t"], own: true },
    { id: "view-tiles", group: "View", title: "Tiles", keys: ["v i"], own: true },
    { id: "view-icons", group: "View", title: "Large icons", keys: ["v g"], own: true },
    { id: "sort-name", group: "View", title: "Sort by name", keys: ["s n"], own: true },
    { id: "sort-date", group: "View", title: "Sort by modified", keys: ["s m"], own: true },
    { id: "sort-size", group: "View", title: "Sort by size", keys: ["s z"], own: true },
    { id: "sort-type", group: "View", title: "Sort by type", keys: ["s t"], own: true },
    { id: "sort-rev", group: "View", title: "Reverse the order", keys: ["s r"], own: true },
    { id: "group", group: "View", title: "Next grouping", keys: ["s g"], own: true },
    { id: "filter-panel", group: "View", title: "Filter panel", keys: ["f"], own: true },
    { id: "deep", group: "View", title: "Include subfolders", keys: ["\u21E7D"], scope: "listing", own: true },
    { id: "hidden", group: "View", title: "Hidden files", keys: ["."], own: true },
    { id: "zoom-in", group: "View", title: "Less detail, bigger items", keys: ["="], own: true },
    { id: "zoom-out", group: "View", title: "More detail, smaller items", keys: ["-"], own: true },
    { id: "zoom-reset", group: "View", title: "Standard detail", keys: ["0"], own: true },
    // Tabs
    { id: "tab-keep", group: "Tabs", title: "Keep this place", keys: ["t"], own: true },
    { id: "tab-close", group: "Tabs", title: "Close", keys: ["w"], own: true },
    { id: "tab-pin", group: "Tabs", title: "Pin", keys: ["p"], own: true },
    { id: "tab-step", group: "Tabs", title: "Previous or next", keys: ["[", "]"], own: true, over: true },
    { id: "tab-jump", group: "Tabs", title: "Jump to 1 to 9", keys: ["1\u20269"], own: true, over: true },
    { id: "tab-reopen", group: "Tabs", title: "Reopen closed", keys: ["\u21E7T"], own: true },
    { id: "tab-left", group: "Tabs", title: "Move tab left", keys: ["\u21E7["], own: true },
    { id: "tab-right", group: "Tabs", title: "Move tab right", keys: ["\u21E7]"], own: true },
    { id: "tab-list", group: "Tabs", title: "All tabs", keys: ["g a"], own: true },
    { id: "tab-focus-move", group: "Tabs", title: "Move between tabs", keys: ["\u2190", "\u2192"], scope: "tabs" },
    { id: "tab-focus-shift", group: "Tabs", title: "Drag the focused tab", keys: ["\u21E7\u2190", "\u21E7\u2192"], scope: "tabs", own: true },
    { id: "tab-focus-close", group: "Tabs", title: "Close the focused tab", keys: ["\u232B"], scope: "tabs", own: true },
    { id: "tab-focus-menu", group: "Tabs", title: "Menu of the focused tab", keys: ["\u21E7F10"], scope: "tabs", own: true },
    // Sidebar
    { id: "side-move", group: "Sidebar", title: "Move", keys: ["\u2191", "\u2193"], scope: "sidebar" },
    { id: "side-lens", group: "Sidebar", title: "Switch lens (on the bar)", keys: ["\u2190", "\u2192"], scope: "sidebar" },
    { id: "side-open", group: "Sidebar", title: "Open as a tab", keys: ["\u21A9"], scope: "sidebar" },
    { id: "side-bg", group: "Sidebar", title: "Background tab", keys: ["\u2325\u21A9"], scope: "sidebar", own: true },
    { id: "side-rename", group: "Sidebar", title: "Rename", keys: ["F2"], scope: "sidebar", own: true },
    { id: "side-tags", group: "Sidebar", title: "Tags", keys: ["#"], scope: "sidebar" },
    { id: "side-remove", group: "Sidebar", title: "Remove", keys: ["\u232B"], scope: "sidebar", own: true },
    { id: "side-rail", group: "Sidebar", title: "To the lens bar", keys: ["\u2190"], scope: "sidebar", own: true },
    { id: "side-into", group: "Sidebar", title: "Into the open lens (on the bar)", keys: ["\u2325\u2193"], scope: "sidebar", own: true },
    { id: "side-fold", group: "Sidebar", title: "Fold a group", keys: ["Space"], scope: "sidebar" },
    { id: "lens-filter", group: "Sidebar", title: "Filter this list", keys: ["/"], scope: "sidebar", own: true },
    { id: "lens-tags", group: "Sidebar", title: "Tag chips", keys: ["g #"], own: true },
    { id: "side-look", group: "Sidebar", title: "Preview a file", keys: ["Space"], scope: "sidebar", own: true },
    { id: "side-chrome", group: "Sidebar", title: "Open in a Chrome tab", keys: ["\u2318\u21A9"], scope: "sidebar", own: true },
    { id: "side-props", group: "Sidebar", title: "Note colour, pin and tags", keys: ["#"], scope: "sidebar", own: true },
    // Preview
    { id: "pv-close", group: "Preview", title: "Close", keys: ["Space", "Esc"], scope: "preview", own: true },
    { id: "pv-step", group: "Preview", title: "Previous or next file", keys: ["\u2191", "\u2193", "\u2190", "\u2192"], scope: "preview", own: true },
    { id: "pv-open", group: "Preview", title: "Open the page", keys: ["\u21A9"], scope: "preview", own: true },
    { id: "pv-tab", group: "Preview", title: "Keep as a tab", keys: ["t"], scope: "preview", own: true },
    { id: "pv-dock", group: "Preview", title: "Dock or float", keys: ["d"], scope: "preview", own: true },
    { id: "pv-copy", group: "Preview", title: "Copy contents", keys: ["c"], scope: "preview", own: true },
    { id: "pv-ask", group: "Preview", title: "Ask about it", keys: ["a"], scope: "preview", own: true },
    // File page
    { id: "fp-raw", group: "File page", title: "Raw or rendered", keys: ["r"], scope: "file", own: true },
    { id: "fp-edit", group: "File page", title: "Edit", keys: ["e"], scope: "file", own: true },
    { id: "fp-find", group: "File page", title: "Find in file", keys: ["/"], scope: "file", own: true },
    { id: "fp-comment", group: "File page", title: "Comment on the selection or paragraph", keys: ["c"], scope: "file", own: true },
    { id: "fp-cm-reply", group: "File page", title: "Reply to the comment", keys: ["\u21E7R"], scope: "file", own: true },
    { id: "fp-toc", group: "File page", title: "Contents", keys: ["\u21E7O"], scope: "file", own: true },
    { id: "fp-width", group: "File page", title: "Reading width", keys: ["\u21E7W"], scope: "file", own: true },
    { id: "fp-comments", group: "File page", title: "Comments panel", keys: ["\u21E7C"], scope: "file", own: true },
    { id: "fp-cm-step", group: "File page", title: "Previous or next comment", keys: ["\u2325\u2191", "\u2325\u2193"], scope: "file", own: true },
    { id: "fp-cm-clear", group: "File page", title: "Let go of the comment being looked at or written", keys: ["Esc"], scope: "file", own: true },
    { id: "fp-cm-post", group: "File page", title: "Post, or post a reply", keys: ["\u2318\u21A9", "\u2318\u21E7\u21A9"], scope: "file" },
    // Editor
    { id: "ed-save", group: "Editor", title: "Save", keys: ["\u2318S"], scope: "editor" },
    { id: "ed-bold", group: "Editor", title: "Bold, italic, code", keys: ["\u2318B", "\u2318I", "\u2318E"], scope: "editor" },
    { id: "ed-move", group: "Editor", title: "Move line", keys: ["\u2325\u2191", "\u2325\u2193"], scope: "editor" },
    { id: "ed-dup", group: "Editor", title: "Copy line", keys: ["\u2325\u21E7\u2191", "\u2325\u21E7\u2193"], scope: "editor" },
    { id: "ed-indent", group: "Editor", title: "Indent", keys: ["\u21E5", "\u21E7\u21E5"], scope: "editor" },
    { id: "ed-undo", group: "Editor", title: "Undo, redo", keys: ["\u2318Z", "\u2318\u21E7Z"], scope: "editor" },
    { id: "ed-link", group: "Editor", title: "Link", keys: ["\u2318K"], scope: "editor" },
    { id: "ed-more", group: "Editor", title: "Strike, heading, quote, numbered list", keys: ["\u2318\u21E7X", "\u2318\u21E7H", "\u2318\u21E7.", "\u2318\u21E77"], scope: "editor" },
    { id: "ed-mode", group: "Editor", title: "Raw, split or rich", keys: ["\u2318\u21E7P"], scope: "editor" },
    { id: "note-rename", group: "Editor", title: "Rename this note", keys: ["F2"], scope: "editor", own: true, field: true },
    { id: "note-delete", group: "Editor", title: "Move this note to .trash", keys: ["\u2318\u21E7\u232B"], scope: "editor", own: true, field: true },
    // Menus and dialogs
    { id: "menu-move", group: "Menus and dialogs", title: "Move in a menu", keys: ["\u2191", "\u2193"], scope: "menu", own: true },
    { id: "menu-pick", group: "Menus and dialogs", title: "Pick", keys: ["\u21A9"], scope: "menu", own: true },
    { id: "dlg-tabs", group: "Menus and dialogs", title: "Dialog pages", keys: ["[", "]"], scope: "dialog", own: true },
    { id: "dlg-fields", group: "Menus and dialogs", title: "Next control", keys: ["\u21E5"], scope: "dialog" },
    { id: "dlg-choice", group: "Menus and dialogs", title: "Change a choice", keys: ["\u2190", "\u2192"], scope: "dialog" }
  ];
  var SHIFTED = { "?": "/", "{": "[", "}": "]", "#": "3", "~": "`", "_": "-", "+": "=", "<": ",", ">": ".", '"': "'", ":": ";", "|": "\\" };
  var NAMED = {
    "\u2318": "meta",
    "\u21E7": "shift",
    "\u2325": "alt",
    "\u2303": "ctrl",
    "\u2191": "up",
    "\u2193": "down",
    "\u2190": "left",
    "\u2192": "right",
    "\u21A9": "enter",
    "\u232B": "backspace",
    "\u21E5": "tab",
    esc: "esc",
    space: "space",
    home: "left",
    end: "right",
    pgup: "up",
    pgdn: "down"
  };
  function capsFor(key) {
    if (key === "1\u20269") return ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
    const out = /* @__PURE__ */ new Set();
    for (const part of key.replace(/^hold /, "").split(" ")) {
      if (/^(home|end|pgup|pgdn)$/i.test(part)) {
        out.add("fn");
        out.add(NAMED[part.toLowerCase()]);
        continue;
      }
      if (/^F\d+$/.test(part)) {
        out.add(part.toLowerCase());
        continue;
      }
      if (/^(esc|space)$/i.test(part)) {
        out.add(part.toLowerCase());
        continue;
      }
      let rest = part;
      while (rest && "\u2318\u21E7\u2325\u2303".includes(rest[0]) && rest.length > 1) {
        out.add(NAMED[rest[0]]);
        rest = rest.slice(1);
      }
      const m = /^⇧(F\d+)$/.exec(part);
      if (m) {
        out.add(m[1].toLowerCase());
        continue;
      }
      if (/^F\d+$/.test(rest)) {
        out.add(rest.toLowerCase());
        continue;
      }
      if (NAMED[rest]) {
        out.add(NAMED[rest]);
        continue;
      }
      if (SHIFTED[rest]) {
        out.add("shift");
        out.add(SHIFTED[rest]);
        continue;
      }
      if (/^[A-Z]$/.test(rest) && !part.startsWith("\u2318")) {
        out.add("shift");
        out.add(rest.toLowerCase());
        continue;
      }
      out.add(rest.toLowerCase());
    }
    return [...out];
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
  var CHEVRON_RIGHT = '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="m4.5 2.5 3 3.5-3 3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var DISCLOSE = '<svg class="chev" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="m2.5 4.5 3.5 3 3.5-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
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
  var RULE_GLYPHS = {
    image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3-3a2 2 0 0 0-3 0L6 21"/>',
    archive: '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    test: '<path d="M9 2v6L4 18a2 2 0 0 0 1.8 3h12.4a2 2 0 0 0 1.8-3L15 8V2M8 2h8M7 14h10"/>',
    box: '<path d="M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8"/>',
    cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9"/>',
    db: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5M3 12a9 3 0 0 0 18 0"/>',
    code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
    terminal: '<path d="m4 17 6-6-6-6M12 19h8"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
    star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
    bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
    bug: '<rect width="8" height="14" x="8" y="6" rx="4"/><path d="M19 7l-3 2M5 7l3 2M19 19l-3-2M5 19l3-2M20 13h-4M4 13h4M10 4l1 2M14 4l-1 2"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    video: '<rect width="14" height="12" x="2" y="6" rx="2"/><path d="m22 8-6 4 6 4z"/>',
    chart: '<path d="M3 3v18h18M7 16v-4M12 16V8M17 16v-7"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3z"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
    branch: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="8" r="3"/><path d="M6 9v6M18 11a6 6 0 0 1-6 6H9"/>',
    bot: '<rect width="16" height="12" x="4" y="8" rx="2"/><path d="M12 8V4H8M2 14h2M20 14h2M15 13v2M9 13v2"/>',
    sparkle: '<path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z"/>',
    heart: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z"/>'
  };
  function icoCustom(label, color, glyph) {
    const c = safeColor(color);
    const sheet = `<path d="M2 0.5h8l5.5 5.5V17a.5.5 0 0 1-.5.5H2a.5.5 0 0 1-.5-.5V1A.5.5 0 0 1 2 0.5z" fill="${c}" fill-opacity="0.12" stroke="${c}" stroke-width="1.1"/>
    <path d="M10 0.5L15.5 6H10z" fill="${c}" fill-opacity="0.75"/>`;
    if (glyph && RULE_GLYPHS[glyph]) {
      return `<svg width="16" height="18" viewBox="0 0 16 18" xmlns="http://www.w3.org/2000/svg">${sheet}
    <svg x="3" y="7" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${RULE_GLYPHS[glyph]}</svg></svg>`;
    }
    const lbl = String(label || "?").slice(0, 4);
    const safe = lbl.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `<svg width="16" height="18" viewBox="0 0 16 18" xmlns="http://www.w3.org/2000/svg">${sheet}
    <text x="8" y="14.5" text-anchor="middle" font-family="'SF Mono',Menlo,Consolas,monospace" font-size="4.5" font-weight="700" fill="${c}">${safe}</text>
  </svg>`;
  }
  function getIcon(e, iconRules) {
    if (e.isParent) return icoParent();
    if (iconRules) {
      for (const rule of iconRules) {
        if (!rule.enabled) continue;
        try {
          if (new RegExp(rule.pattern, "i").test(e.name)) return icoCustom(rule.label, rule.color, rule.glyph);
        } catch {
        }
      }
    }
    if (e.isDir) return icoFolder(e.name);
    const ext2 = e.name.includes(".") ? e.name.split(".").pop() : "";
    return icoFile(ext2 || "\u2014");
  }
  var PI = {
    ...Object.fromEntries(Object.entries(LINE_ICON).map(([k, body]) => [k, line(body)])),
    drag: `<svg width="10" height="14" viewBox="0 0 10 14"><circle cx="3" cy="3" r="1.2" fill="currentColor"/><circle cx="3" cy="7" r="1.2" fill="currentColor"/><circle cx="3" cy="11" r="1.2" fill="currentColor"/><circle cx="7" cy="3" r="1.2" fill="currentColor"/><circle cx="7" cy="7" r="1.2" fill="currentColor"/><circle cx="7" cy="11" r="1.2" fill="currentColor"/></svg>`
  };

  // src/empty-state.ts
  function emptyHtml(state, text, o = {}) {
    const hint = o.hintHtml ?? (o.hint ? esc(o.hint) : "");
    const acts = (o.actions ?? []).map((a) => `<button type="button" class="btn" data-size="sm" data-variant="outline"${a.id ? ` id="${a.id}"` : ""}${a.a ? ` data-a="${a.a}"` : ""} title="${esc(a.title)}">${a.icon ?? ""}<span>${esc(a.label)}</span></button>`).join("");
    return `<div class="empty" data-state="${state}"${o.inline ? " data-inline" : ' role="status"'}${o.style ? ` style="${o.style}"` : ""}>` + (o.icon ? `<span class="empty-ico">${o.icon}</span>` : "") + `<p class="empty-t">${esc(text)}</p>` + (hint ? `<p class="empty-h">${hint}</p>` : "") + (acts ? `<div class="empty-a">${acts}</div>` : "") + `</div>`;
  }
  var CLEAR = { a: "clear", label: "Clear filter", title: "Show everything again" };

  // src/commands.ts
  var bound = /* @__PURE__ */ new Map();
  function bind(id, run, when2) {
    bound.set(id, { run, when: when2 });
  }
  function canRun(id) {
    const b = bound.get(id);
    return !!b && (!b.when || b.when());
  }
  function runCommand(id, key) {
    if (!canRun(id)) return false;
    bound.get(id).run(key);
    return true;
  }
  var NAMED2 = {
    ArrowUp: "\u2191",
    ArrowDown: "\u2193",
    ArrowLeft: "\u2190",
    ArrowRight: "\u2192",
    Enter: "\u21A9",
    Backspace: "\u232B",
    Delete: "\u232B",
    Escape: "Esc",
    " ": "Space",
    Tab: "\u21E5",
    PageUp: "PgUp",
    PageDown: "PgDn",
    Home: "Home",
    End: "End"
  };
  var SHIFT_OF = { "{": "[", "}": "]", "~": "`" };
  var MAC = typeof navigator === "undefined" || /Mac|iPhone|iPad/.test(navigator.platform);
  function keyToken(ev) {
    const e = MAC ? ev : { key: ev.key, code: ev.code, shiftKey: ev.shiftKey, altKey: ev.altKey, metaKey: ev.metaKey || ev.ctrlKey, ctrlKey: false };
    const named = NAMED2[e.key];
    let k = named ?? e.key;
    let shift = e.shiftKey;
    if (named) {
    } else if (SHIFT_OF[k]) {
      k = SHIFT_OF[k];
      shift = true;
    } else if (/^[a-z]$/i.test(k)) {
      if (/^[A-Z]$/.test(k) && !e.metaKey) shift = true;
      k = shift || e.metaKey ? k.toUpperCase() : k.toLowerCase();
    } else if (k.length === 1) shift = false;
    if (e.altKey && /^Key[A-Z]$/.test(e.code)) k = e.code.slice(3);
    return (e.metaKey ? "\u2318" : "") + (e.ctrlKey ? "\u2303" : "") + (e.altKey ? "\u2325" : "") + (shift ? "\u21E7" : "") + k;
  }
  var contextOf = () => ({ scopes: /* @__PURE__ */ new Set(["any"]), typing: false, blocked: false });
  function setContext(fn) {
    contextOf = fn;
  }
  var OWN = KEYMAP.filter((d) => d.own);
  var DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
  var keysOf = (d) => d.keys.flatMap((k) => k === "1\u20269" ? DIGITS : [k]);
  var MOVING = /* @__PURE__ */ new Set(["\u2191", "\u2193", "\u2190", "\u2192", "\u21A9", "Space", "\u232B", "Home", "End"]);
  var PREVIEW_KEYS = new Set(KEYMAP.filter((d) => d.scope === "preview").flatMap((d) => keysOf(d)));
  var baseOf = (tok) => tok.replace(/^[⌘⌃⌥⇧]+/, "");
  var live = (d, ctx, tok = "") => {
    const scope = d.scope ?? "any";
    if (scope === "preview" && ctx.widget && MOVING.has(baseOf(tok))) return false;
    if (scope !== "any") return ctx.scopes.has(scope);
    if (!ctx.scopes.has("any")) return false;
    if (ctx.widget && MOVING.has(baseOf(tok))) return false;
    if (!ctx.scopes.has("preview") || d.over === true || !!tok && !!d.over?.includes(tok)) return true;
    return !!ctx.docked && !!tok && !PREVIEW_KEYS.has(tok);
  };
  var pending = "";
  var pendingTimer = null;
  var pill = null;
  function setPending(p) {
    pending = p;
    if (pendingTimer) clearTimeout(pendingTimer);
    if (!p) {
      pill?.remove();
      pill = null;
      return;
    }
    pendingTimer = setTimeout(() => setPending(""), 1600);
    if (!pill) {
      pill = document.createElement("div");
      pill.className = "fe-chord";
      (document.getElementById("fe") ?? document.body).appendChild(pill);
      raise(pill);
    }
    const next = OWN.filter((d) => canRun(d.id) && d.keys.some((k) => k.startsWith(p + " ")));
    pill.innerHTML = `<kbd>${esc(p)}</kbd><span>then</span>${next.slice(0, 8).map((d) => `<span class="fe-chord-o"><kbd>${esc(d.keys.find((k) => k.startsWith(p + " ")).slice(p.length + 1))}</kbd>${esc(d.title)}</span>`).join("")}`;
  }
  function dispatch(e) {
    const ctx = contextOf();
    const tok = keyToken(e);
    const ae = document.activeElement;
    if (tok === "\u2318K" && !(ae?.tagName === "TEXTAREA" || ae?.isContentEditable)) {
      e.preventDefault();
      return runCommand("palette");
    }
    if (ctx.blocked || tok === "Esc" && escTaken()) {
      setPending("");
      return false;
    }
    if (ctx.typing) {
      setPending("");
      const d2 = OWN.find((x) => x.field && keysOf(x).includes(tok) && live(x, ctx, tok) && canRun(x.id));
      if (d2) {
        e.preventDefault();
        e.stopImmediatePropagation();
        runCommand(d2.id, tok);
        return true;
      }
      return false;
    }
    if (pending) {
      const want = `${pending} ${tok}`;
      setPending("");
      const seq2 = OWN.filter((x) => x.keys.includes(want) && live(x, ctx, want) && canRun(x.id));
      const d2 = seq2.find((x) => (x.scope ?? "any") !== "any") ?? seq2[0];
      if (d2 && runCommand(d2.id, want)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return true;
      }
      return false;
    }
    const all = OWN.filter((x) => keysOf(x).includes(tok) && live(x, ctx, tok) && canRun(x.id));
    const d = all.find((x) => (x.scope ?? "any") !== "any") ?? all[0];
    if (d) {
      e.preventDefault();
      e.stopImmediatePropagation();
      runCommand(d.id, tok);
      return true;
    }
    if (!e.metaKey && !e.ctrlKey && !e.altKey && OWN.some((x) => live(x, ctx, tok + " ") && canRun(x.id) && x.keys.some((k) => k.startsWith(tok + " ")))) {
      e.preventDefault();
      e.stopImmediatePropagation();
      setPending(tok);
      return true;
    }
    return false;
  }
  var sources = [];
  function addPaletteSource(fn) {
    sources.push(fn);
  }
  var TABS = [
    { id: "all", label: "All", icon: PI.apps },
    { id: "actions", label: "Actions", icon: UI_ICON.keyboard },
    { id: "tabs", label: "Tabs", icon: PI.tabset },
    { id: "saved", label: "Saved", icon: PI.bm },
    { id: "recent", label: "Recent", icon: PI.recent },
    { id: "notes", label: "Notes", icon: UI_ICON.notes },
    { id: "here", label: "Here", icon: PI.folder },
    { id: "comments", label: "Comments", icon: UI_ICON.comment },
    { id: "chats", label: "Chats", icon: UI_ICON.ai }
  ];
  var TAB_OF_GROUP = { Tabs: "tabs", Saved: "saved", Recent: "recent", Notes: "notes", "This folder": "here", Comments: "comments", Chats: "chats" };
  var tabOf = (it) => it.tab ?? TAB_OF_GROUP[it.group] ?? "actions";
  var ACTION_ICON = {
    keys: UI_ICON.keyboard,
    settings: PI.gear,
    hints: UI_ICON.keyboard,
    sidebar: UI_ICON.preview,
    theme: UI_ICON.appearance,
    esc: UI_ICON.close,
    up: UI_ICON.prev,
    home: PI.home,
    path: UI_ICON.link,
    "goto-bg": UI_ICON.link,
    "note-rename": UI_ICON.rename,
    "note-delete": UI_ICON.trash,
    "open-pick": UI_ICON.folderOpen,
    save: PI.bm,
    terminal: UI_ICON.terminal,
    "terminal-copy": UI_ICON.copy,
    "area-next": UI_ICON.stack,
    "area-prev": UI_ICON.stack,
    "to-listing": UI_ICON.list,
    "to-sidebar": UI_ICON.preview,
    "to-tabs": UI_ICON.tab,
    "to-toolbar": UI_ICON.stack,
    "to-path": UI_ICON.link,
    "lens-places": PI.home,
    "lens-saved": PI.bm,
    "lens-notes": UI_ICON.notes,
    "lens-recent": PI.recent,
    "lens-search": PI.search,
    "lens-ask": UI_ICON.ai,
    "lens-docs": UI_ICON.comment,
    "open-bg": UI_ICON.tab,
    "open-chrome": UI_ICON.external,
    menu: UI_ICON.list,
    "select-all": UI_ICON.task,
    "copy-paths": UI_ICON.copy,
    "copy-path": UI_ICON.copy,
    "copy-name": UI_ICON.copy,
    filter: PI.search,
    "new-note": UI_ICON.add,
    "tree-open": UI_ICON.folderOpen,
    "tree-close": PI.folder,
    deep: UI_ICON.stack,
    "view-details": UI_ICON.table,
    "view-list": UI_ICON.list,
    "view-tree": UI_ICON.contents,
    "view-tiles": PI.apps,
    "view-icons": UI_ICON.image,
    "sort-name": UI_ICON.contents,
    "sort-date": UI_ICON.clock,
    "sort-size": UI_ICON.data,
    "sort-type": UI_ICON.file,
    "sort-rev": UI_ICON.rotate,
    group: UI_ICON.stack,
    "filter-panel": PI.search,
    hidden: UI_ICON.eye,
    "zoom-in": UI_ICON.zoomIn,
    "zoom-out": UI_ICON.zoomOut,
    "zoom-reset": UI_ICON.actualSize,
    "tab-keep": UI_ICON.tab,
    "tab-close": UI_ICON.close,
    "tab-pin": UI_ICON.pin,
    "tab-step": UI_ICON.next,
    "tab-reopen": UI_ICON.reset,
    "tab-left": UI_ICON.prev,
    "tab-right": UI_ICON.next,
    "tab-list": UI_ICON.list,
    "pv-dock": UI_ICON.preview,
    "pv-copy": UI_ICON.copy,
    "pv-ask": UI_ICON.ai,
    "pv-tab": UI_ICON.tab,
    "pv-open": UI_ICON.external,
    "fp-raw": UI_ICON.fmtCode,
    "fp-edit": UI_ICON.rename,
    "fp-find": PI.search,
    "fp-toc": UI_ICON.contents,
    "fp-width": UI_ICON.fit,
    "fp-comments": UI_ICON.comment,
    "fp-comment": UI_ICON.comment,
    "fp-cm-reply": UI_ICON.comment,
    "fp-cm-step": UI_ICON.comment
  };
  var iconFor = (d) => ACTION_ICON[d.id] ?? PI[GROUPS.find((g) => g.name === d.group)?.icon ?? "apps"] ?? "";
  function score(text, q) {
    if (!q) return 1;
    const t = text.toLowerCase(), s = q.toLowerCase();
    const at = t.indexOf(s);
    if (at >= 0) return 1e3 - at - (t.length - s.length) * 0.1 + (at === 0 || t[at - 1] === " " ? 200 : 0);
    let i3 = 0, gaps = 0, last = -1;
    for (const ch of s) {
      const j = t.indexOf(ch, last + 1);
      if (j < 0) return 0;
      gaps += j - last - 1;
      last = j;
      i3++;
    }
    return 100 - gaps;
  }
  var paletteEl = null;
  function paletteOpen() {
    return !!paletteEl;
  }
  function openPalette(prefill = "") {
    if (paletteEl) {
      paletteEl.querySelector("input")?.focus();
      return;
    }
    const ctx = contextOf();
    const cmds = KEYMAP.filter((d) => d.id !== "palette" && canRun(d.id) && (d.scope === void 0 || d.scope === "any" || ctx.scopes.has(d.scope))).map((d) => ({ title: d.title, keys: d.keys, group: d.group, tab: "actions", icon: iconFor(d), run: () => runCommand(d.id) }));
    const items = [...cmds];
    const late = [];
    for (const f of sources) {
      try {
        const r = f();
        if (Array.isArray(r)) items.push(...r);
        else late.push(r);
      } catch {
      }
    }
    const box = document.createElement("div");
    box.className = "fe-pal-wrap";
    box.innerHTML = `<div class="fe-pal" role="dialog" aria-label="Command palette">
    <div class="fe-pal-q"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input type="text" placeholder="Type a command or a place" spellcheck="false" autocomplete="off" aria-label="Command or place"><kbd>esc</kbd></div>
    <div class="fe-pal-tabs" role="tablist"></div>
    <div class="fe-pal-list" role="listbox"></div>
    <div class="fe-pal-foot"><span><kbd>\u2191</kbd><kbd>\u2193</kbd> move</span><span><kbd>\u21A9</kbd> run</span><span><kbd>\u2325\u21A9</kbd> background tab</span><span><kbd>\u21E5</kbd><kbd>\u21E7\u21E5</kbd> tabs</span></div>
  </div>`;
    paletteEl = box;
    const input = box.querySelector("input");
    const tabsEl = box.querySelector(".fe-pal-tabs");
    const list3 = box.querySelector(".fe-pal-list");
    let shown = [];
    let at = 0;
    let tab = "all";
    const matches = (it, q) => Math.max(score(it.title, q), score(it.sub ?? "", q) * 0.6, q ? score((it.keys ?? []).join(" "), q) * 0.9 : 0);
    const paint = () => {
      const q = input.value.trim();
      const counts = /* @__PURE__ */ new Map();
      for (const it of items) if (matches(it, q) > 0) {
        const t = tabOf(it);
        counts.set(t, (counts.get(t) ?? 0) + 1);
        counts.set("all", (counts.get("all") ?? 0) + 1);
      }
      tabsEl.innerHTML = TABS.map((t) => `<button type="button" role="tab" class="fe-pal-tab${t.id === tab ? " on" : ""}${counts.get(t.id) ? "" : " is-empty"}" data-tab="${t.id}" aria-selected="${t.id === tab}" tabindex="-1">${t.icon}<span>${t.label}</span>${counts.get(t.id) ? `<i>${counts.get(t.id)}</i>` : ""}</button>`).join("");
      tabsEl.querySelector(".on")?.scrollIntoView({ inline: "nearest", block: "nearest" });
      shown = items.filter((it) => tab === "all" || tabOf(it) === tab).map((it) => ({ it, s: matches(it, q) })).filter((x) => x.s > 0).sort((a, b) => q ? b.s - a.s : 0).slice(0, 80).map((x) => x.it);
      at = Math.min(at, Math.max(0, shown.length - 1));
      let lastGroup = "";
      list3.innerHTML = shown.length ? shown.map((it, i3) => {
        const head = !q && it.group !== lastGroup ? `<div class="fe-pal-g sect" data-level="group">${esc(it.group)}</div>` : "";
        lastGroup = it.group;
        return `${head}<div class="row fe-pal-i${i3 === at ? " on" : ""}" role="option" aria-selected="${i3 === at}" data-i="${i3}" data-tab="${tabOf(it)}">${it.icon ?? ""}<span class="fe-pal-t">${esc(it.title)}</span>${it.sub ? `<span class="fe-pal-s">${esc(it.sub)}</span>` : ""}${(it.keys ?? []).slice(0, 1).map((k) => `<kbd>${esc(k)}</kbd>`).join("")}</div>`;
      }).join("") : late.length && tab !== "all" && !counts.get(tab) ? emptyHtml("loading", "Loading\u2026") : emptyHtml("filtered", "Nothing matches", { hint: "Try fewer letters, or another tab" });
      list3.querySelector(".on")?.scrollIntoView({ block: "nearest" });
    };
    const setTab = (t) => {
      tab = t;
      at = 0;
      paint();
    };
    const fire2 = (i3, alt = false) => {
      const it = shown[i3];
      if (!it) return;
      layer.close("pick");
      if (alt && it.runAlt) it.runAlt();
      else it.run();
    };
    input.addEventListener("input", () => {
      at = 0;
      paint();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        at = (at + (e.key === "ArrowDown" ? 1 : -1) + shown.length) % Math.max(1, shown.length);
        paint();
      } else if (e.key === "Enter") {
        e.preventDefault();
        fire2(at, e.altKey);
      } else if (e.key === "Tab") {
        e.preventDefault();
        const ids = TABS.map((t) => t.id);
        const live2 = ids.filter((id) => id === "all" || tabsEl.querySelector(`[data-tab="${id}"]:not(.is-empty)`));
        const i3 = live2.indexOf(tab);
        setTab(live2[(i3 + (e.shiftKey ? -1 : 1) + live2.length) % live2.length]);
      }
      e.stopPropagation();
    });
    tabsEl.addEventListener("click", (e) => {
      const b = e.target.closest(".fe-pal-tab");
      if (b) {
        setTab(b.dataset.tab);
        input.focus();
      }
    });
    list3.addEventListener("mousemove", (e) => {
      const row2 = e.target.closest(".fe-pal-i");
      if (row2 && Number(row2.dataset.i) !== at) {
        at = Number(row2.dataset.i);
        list3.querySelectorAll(".fe-pal-i").forEach((r) => {
          r.classList.toggle("on", r === row2);
          r.setAttribute("aria-selected", String(r === row2));
        });
      }
    });
    list3.addEventListener("click", (e) => {
      const row2 = e.target.closest(".fe-pal-i");
      if (row2) fire2(Number(row2.dataset.i), e.altKey);
    });
    input.value = prefill;
    paint();
    for (const p of late) p.then((r) => {
      if (paletteEl !== box) return;
      items.push(...r);
      paint();
    }).catch(() => {
    });
    const layer = openLayer(box, { kind: "command", place: "none", focus: input, backdrop: box, onClose: () => {
      paletteEl = null;
    } });
  }

  // src/panel-size.ts
  var ORDER = ["md", "lg", "xl"];
  var NAME = { md: "medium", lg: "large", xl: "extra large" };
  function panelSize(key) {
    const v = getPanelSize(key);
    return ORDER.includes(v) ? v : "md";
  }
  var SIZE_BTN = (id) => `<button id="${id}" class="btn" data-icon title="Size">${UI_ICON.size}</button>`;
  function wireSize(btn, panel, key, onChange) {
    const set2 = (s) => {
      if (s === "md") delete panel.dataset.size;
      else panel.dataset.size = s;
      const next = ORDER[(ORDER.indexOf(s) + 1) % ORDER.length];
      btn.title = `Size: ${NAME[s]} \xB7 click for ${NAME[next]}`;
      btn.classList.toggle("on", s !== "md");
    };
    set2(panelSize(key));
    btn.addEventListener("click", () => {
      const s = ORDER[(ORDER.indexOf(panelSize(key)) + 1) % ORDER.length];
      set2(s);
      savePanelSize(key, s);
      onChange?.(s);
    });
    return { set: (s) => {
      set2(s);
      savePanelSize(key, s);
    } };
  }

  // src/el.ts
  function el(id) {
    return document.getElementById(id);
  }
  function els(selector, root = document) {
    return [...root.querySelectorAll(selector)];
  }

  // src/motion.ts
  var reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  var EASE = "cubic-bezier(.2,.8,.2,1)";
  var running = null;
  var folding = /* @__PURE__ */ new WeakMap();
  function foldTo(box, flip, done) {
    const prev = folding.get(box);
    if (prev) {
      prev.anim.cancel();
      prev.end();
    }
    if (reduced()) {
      flip();
      done?.();
      return;
    }
    const from = box.offsetHeight;
    flip();
    const to = box.offsetHeight;
    flip();
    const closing = to < from;
    if (!closing) flip();
    box.style.overflow = "hidden";
    const anim = box.animate(
      [{ height: from + "px", opacity: closing ? 1 : 0.4 }, { height: to + "px", opacity: closing ? 0.4 : 1 }],
      { duration: 200, easing: EASE }
    );
    const end = () => {
      folding.delete(box);
      box.style.overflow = "";
      if (closing) flip();
      done?.();
    };
    folding.set(box, { anim, end });
    anim.onfinish = () => {
      if (folding.get(box)?.anim === anim) end();
    };
  }
  var wanted = null;
  function sidebarShown() {
    return wanted ?? el("fe-side").style.display !== "none";
  }
  function setSidebarShown(show) {
    wanted = show;
    const side = el("fe-side"), rz = el("fe-side-rz");
    running?.cancel();
    running = null;
    const shown = side.style.display !== "none";
    if (show === shown) return;
    if (reduced()) {
      side.style.display = rz.style.display = show ? "" : "none";
      return;
    }
    if (show) side.style.display = rz.style.display = "";
    const w = side.offsetWidth;
    const open = [{ width: "0px", opacity: 0, marginRight: "-10px" }, { width: w + "px", opacity: 1, marginRight: "0px" }];
    running = side.animate(show ? open : [...open].reverse(), { duration: 220, easing: EASE });
    running.onfinish = () => {
      running = null;
      if (!show) side.style.display = rz.style.display = "none";
    };
  }

  // src/dialog.ts
  var mounted = [];
  var openOne = () => mounted.find((d) => d.isOpen());
  bind("dlg-tabs", (key) => openOne()?.step(key === "[" ? -1 : 1), () => !!openOne());
  var tile = (t, size = "") => `<span class="fe-dlg-tile ${size}" style="--tone:${t.tone ?? "var(--ac)"}" aria-hidden="true">${t.icon}</span>`;
  function renderDialog(d) {
    return `
  <div id="${esc(d.id)}" class="fe-dlg" style="display:none">
    <div class="fe-dlg-bg scrim"></div>
    <div class="fe-dlg-box panel" role="dialog" aria-labelledby="${esc(d.id)}-title" tabindex="-1">
      <div class="sect fe-dlg-title" data-level="page">
        <span class="fe-dlg-mark">${d.mark}</span>
        <span class="sect-tx"><b id="${esc(d.id)}-title">${esc(d.title)}</b><i>${esc(d.subtitle)}</i></span>
      </div>
      <div class="fe-dlg-acts"><button class="btn fe-dlg-place" data-icon title="Open in the sidebar">${UI_ICON.preview}</button>${SIZE_BTN(`${esc(d.id)}-size`)}<button class="btn fe-dlg-close" data-icon title="Close (Esc)">${UI_ICON.close}</button></div>
      <div class="fe-dlg-tabs" role="tablist">
        ${d.tabs.map((t) => `<button class="fe-dlg-tab" role="tab" data-tab="${esc(t.key)}" title="${esc(t.label)} \xB7 [ ] switch tabs \xB7 Esc closes"><span class="fe-dlg-tab-main">${t.icon ? tile(t) : ""}<b>${esc(t.label)}</b></span>${t.hint ? `<i>${esc(t.hint)}</i>` : ""}</button>`).join("")}
      </div>
      ${d.tabs.map((t) => `<div class="fe-dlg-pane" role="tabpanel" data-tab="${esc(t.key)}">${t.icon ? `<header class="sect fe-dlg-ph" data-level="page">${tile(t, "lg")}<div class="sect-tx"><h2>${esc(t.label)}</h2>${t.desc || t.hint ? `<p>${esc(t.desc || t.hint)}</p>` : ""}</div></header>` : ""}${t.body}</div>`).join("")}
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
  function sidePane() {
    const side = document.getElementById("fe-side");
    if (!side) return null;
    let pane = document.getElementById("fe-side-pane");
    if (!pane) {
      pane = document.createElement("div");
      pane.id = "fe-side-pane";
      pane.hidden = true;
      side.appendChild(pane);
    }
    return pane;
  }
  function closeSideDialog() {
    const d = mounted.find((m) => m.inSide());
    d?.close();
    return !!d;
  }
  function mountDialog(id, hooks = {}) {
    const root = document.getElementById(id);
    const box = root.querySelector(".fe-dlg-box");
    const tabs = [...root.querySelectorAll(".fe-dlg-tab")];
    const panes = [...root.querySelectorAll(".fe-dlg-pane")];
    const lastTab = textPref(`bfb-dialog-tab:${id}`);
    const placeBtn = root.querySelector(".fe-dlg-place");
    wireSize(root.querySelector(`#${id}-size`), box, id);
    let place = getDialogPlace(id);
    const inSide = () => box.parentElement?.id === "fe-side-pane" && !box.parentElement.hidden;
    const isOpen = () => root.style.display !== "none" || inSide();
    let unfolded = false;
    function show(tab) {
      if (!tabs.some((t) => t.dataset.tab === tab)) tab = tabs[0]?.dataset.tab ?? "";
      tabs.forEach((t) => t.classList.toggle("on", t.dataset.tab === tab));
      panes.forEach((p) => {
        p.classList.toggle("on", p.dataset.tab === tab);
        if (p.dataset.tab === tab) p.scrollTop = 0;
      });
      lastTab.set(tab);
    }
    const paintPlace = () => {
      placeBtn.title = place === "side" ? "Open as a window" : "Open in the sidebar";
      placeBtn.classList.toggle("on", place === "side");
    };
    paintPlace();
    let layer = null;
    function open(tab) {
      hooks.onOpen?.();
      show(tab ?? lastTab.get());
      const pane = place === "side" ? sidePane() : null;
      if (pane) {
        mounted.find((m) => m.inSide() && m.box !== box)?.close();
        if (!sidebarShown()) {
          setSidebarShown(true);
          unfolded = true;
        }
        box.dataset.dock = "";
        pane.appendChild(box);
        pane.hidden = false;
        box.focus();
        return;
      }
      root.style.display = "flex";
      if (layer?.open) {
        box.focus();
        return;
      }
      layer = openLayer(root, { kind: "dialog", place: "none", focus: box, backdrop: root.querySelector(".fe-dlg-bg"), onClose: () => {
        root.style.display = "none";
        hooks.onClose?.();
      } });
    }
    function close() {
      if (inSide()) {
        const pane = box.parentElement;
        pane.hidden = true;
        delete box.dataset.dock;
        root.appendChild(box);
        if (unfolded) {
          unfolded = false;
          setSidebarShown(false);
        }
        hooks.onClose?.();
        return;
      }
      layer?.close("api");
    }
    placeBtn.addEventListener("click", () => {
      const tab = tabs.find((t) => t.classList.contains("on"))?.dataset.tab;
      close();
      place = place === "side" ? "window" : "side";
      saveDialogPlace(id, place);
      paintPlace();
      open(tab);
    });
    tabs.forEach((t) => t.addEventListener("click", () => show(t.dataset.tab)));
    root.querySelector(".fe-dlg-close").addEventListener("click", close);
    focusTrap(box, { when: () => isOpen() && !inSide() });
    const step2 = (dir) => {
      const i3 = tabs.findIndex((t) => t.classList.contains("on"));
      show(tabs[(i3 + dir + tabs.length) % tabs.length].dataset.tab);
    };
    const owns = () => root.style.display !== "none" || inSide() && box.contains(document.activeElement);
    mounted.push({ isOpen: owns, step: step2, inSide, close, box });
    return { open, close, isOpen, show };
  }

  // src/col-resize.ts
  var COL_HANDLE = '<span class="fe-col-rz rz" data-axis="x" title="Drag to resize this column \xB7 double-click to reset"></span>';
  var MIN_W = 40;
  var EDGE = 5;
  var installed = false;
  var cellsOf = (table) => [...table.querySelectorAll("thead th")];
  function edgeAt(e) {
    const t = e.target;
    const handle = t?.closest?.("table.fe-rz .fe-col-rz");
    if (handle) return { table: handle.closest("table"), th: handle.closest("th") };
    const cell = t?.closest?.("table.fe-rz td, table.fe-rz th");
    if (!cell) return null;
    const r = cell.getBoundingClientRect();
    if (r.right - e.clientX > EDGE || r.right - e.clientX < -1) return null;
    const table = cell.closest("table");
    const th = cellsOf(table)[cell.cellIndex + cell.colSpan - 1];
    return th ? { table, th } : null;
  }
  function freeze(table) {
    if (table.classList.contains("fe-rz-fixed")) return;
    const ths = cellsOf(table);
    const widths = ths.map((h) => h.getBoundingClientRect().width);
    ths.forEach((h, i3) => {
      h.style.width = widths[i3] + "px";
    });
    table.style.width = widths.reduce((a, b) => a + b, 0) + "px";
    table.classList.add("fe-rz-fixed");
  }
  function fitColumns(table) {
    const box = table.parentElement;
    if (!box || table.classList.contains("fe-rz-fixed") || table.scrollWidth <= box.clientWidth + 1) return;
    const ths = cellsOf(table);
    if (ths.length < 2) return;
    const rows = [...table.querySelectorAll("tbody tr")].slice(0, 200);
    const ctx = document.createElement("canvas").getContext("2d");
    const textW = (el2) => {
      if (!el2) return 0;
      ctx.font = getComputedStyle(el2).font;
      return ctx.measureText((el2.textContent ?? "").trim()).width;
    };
    const pad = (el2) => {
      if (!el2) return 0;
      const cs = getComputedStyle(el2);
      return parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    };
    const want = ths.map((th, i3) => {
      const ws = rows.map((r) => textW(r.cells[i3])).sort((a, b) => a - b);
      const p90 = ws.length ? ws[Math.min(ws.length - 1, Math.floor(ws.length * 0.9))] : 0;
      const body = p90 + pad(rows[0]?.cells[i3]) + 4;
      const head = textW(th) + pad(th) + 18;
      return Math.max(56, Math.min(420, Math.ceil(Math.max(head, body))));
    });
    const total = want.reduce((a, b) => a + b, 0);
    const spare = box.clientWidth - total;
    const widths = spare > 0 ? want.map((w) => w + spare * (w / total)) : want;
    ths.forEach((h, i3) => {
      h.style.width = Math.round(widths[i3]) + "px";
    });
    table.style.width = Math.round(widths.reduce((a, b) => a + b, 0)) + "px";
    table.classList.add("fe-rz-fixed", "fe-rz-fit");
  }
  function installColumnResize() {
    if (installed) return;
    installed = true;
    const fitAll = (root) => requestAnimationFrame(() => root.querySelectorAll("table.fe-rz:not(.fe-rz-fixed)").forEach(fitColumns));
    new MutationObserver((muts) => {
      for (const m of muts) for (const n of m.addedNodes) {
        if (n instanceof Element && (n.matches("table.fe-rz") || n.querySelector("table.fe-rz"))) fitAll(n.parentNode ?? n);
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
    fitAll(document);
    document.addEventListener("pointermove", (e) => {
      if (document.body.classList.contains("fe-resizing")) return;
      const cell = e.target?.closest?.("table.fe-rz td, table.fe-rz th");
      const table = cell?.closest("table");
      document.querySelectorAll("table.fe-col-edge").forEach((x) => {
        if (x !== table) x.classList.remove("fe-col-edge");
      });
      table?.classList.toggle("fe-col-edge", !!edgeAt(e));
    }, { passive: true });
    document.addEventListener("click", (e) => {
      if (edgeAt(e)) e.stopPropagation();
    }, true);
    document.addEventListener("dblclick", (e) => {
      const hit = edgeAt(e);
      if (!hit) return;
      e.stopPropagation();
      const { table } = hit;
      table.classList.remove("fe-rz-fixed", "fe-rz-fit");
      table.style.width = "";
      cellsOf(table).forEach((th) => {
        th.style.width = "";
      });
      fitColumns(table);
    }, true);
    document.addEventListener("pointerdown", (e) => {
      const hit = edgeAt(e);
      if (!hit || e.button !== 0) return;
      e.stopPropagation();
      const { table, th } = hit;
      freeze(table);
      const startW = parseFloat(th.style.width);
      const startTable = parseFloat(table.style.width);
      th.querySelector(".fe-col-rz")?.classList.add("drag");
      startDrag(e, "col-resize", (dx) => {
        const w = Math.max(MIN_W, startW + dx);
        th.style.width = w + "px";
        table.style.width = startTable + (w - startW) + "px";
      }, () => th.querySelector(".fe-col-rz")?.classList.remove("drag"));
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
    codeChars: 2e6,
    tableRows: 5e3,
    jsonlLines: 2e3,
    treeNodes: 2e4
  };
  function unrenderableNote(text) {
    if (!text.trim()) return '<div class="notice fe-ql-note">Empty file.</div>';
    if (sniffBinary(text)) return '<div class="notice fe-ql-note">Binary file, no text to show.</div>';
    return "";
  }
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
    const parts = rules.map((r, i3) => {
      kinds[i3] = r.kind;
      return `(?<g${i3}>${r.pattern})`;
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
      for (let i3 = 0; i3 < kinds.length; i3++) if (g[`g${i3}`] !== void 0) {
        kind = kinds[i3];
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
  var CODE_BLOCK = 200;
  function renderCode(src, ext2) {
    let truncNote = "";
    if (src.length > RENDER_CAPS.codeChars) {
      src = src.slice(0, RENDER_CAPS.codeChars);
      truncNote = `<div class="notice fe-ql-note">Showing first ${RENDER_CAPS.codeChars.toLocaleString()} characters. Open the raw file for the rest.</div>`;
    }
    const rows = splitHighlighted(highlightCode(src, ext2));
    const gut = String(rows.length).length + 1;
    const blocks = [];
    for (let s = 0; s < rows.length; s += CODE_BLOCK) {
      const part = rows.slice(s, s + CODE_BLOCK).map((r, i3) => `<div class="fe-cl"><span class="fe-cl-n">${s + i3 + 1}</span><span class="fe-cl-t">${r || " "}</span></div>`).join("");
      blocks.push(`<div class="fe-cl-blk" style="--n:${Math.min(CODE_BLOCK, rows.length - s)}">${part}</div>`);
    }
    return `${truncNote}<div class="fe-code-wrap" style="--gut:${gut}ch"><div class="fe-code">${blocks.join("")}</div></div>`;
  }
  function splitHighlighted(html) {
    const out = [];
    const open = [];
    let line2 = "";
    const re = /<span[^>]*>|<\/span>|\n|[^<\n]+|</g;
    for (const m of html.match(re) ?? []) {
      if (m === "\n") {
        out.push(line2 + "</span>".repeat(open.length));
        line2 = open.join("");
      } else if (m.startsWith("<span")) {
        open.push(m);
        line2 += m;
      } else if (m === "</span>") {
        open.pop();
        line2 += m;
      } else line2 += m;
    }
    out.push(line2);
    return out;
  }
  function codeLines(html) {
    const rows = splitHighlighted(html);
    return rows.map((r, i3) => `<span class="fe-md-l">${r}${i3 < rows.length - 1 ? "\n" : ""}</span>`).join("");
  }
  function parseDSV(text, delim) {
    const rows = [];
    let row2 = [];
    let cell = "";
    let inQ = false;
    for (let i3 = 0; i3 < text.length; i3++) {
      const ch = text[i3];
      if (inQ) {
        if (ch === '"') {
          if (text[i3 + 1] === '"') {
            cell += '"';
            i3++;
          } else inQ = false;
        } else cell += ch;
      } else if (ch === '"' && cell === "") {
        inQ = true;
      } else if (ch === delim) {
        row2.push(cell);
        cell = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i3 + 1] === "\n") i3++;
        row2.push(cell);
        cell = "";
        rows.push(row2);
        row2 = [];
      } else cell += ch;
    }
    if (cell !== "" || row2.length) {
      row2.push(cell);
      rows.push(row2);
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
      truncNote = `<div class="notice fe-ql-note">Showing first ${RENDER_CAPS.tableRows.toLocaleString()} of ${dataRows.length.toLocaleString()} rows.</div>`;
    }
    const width = rows.reduce((w, r) => Math.max(w, r.length), header.length);
    const cols = Array.from({ length: width }, (_, i3) => header[i3] ?? `(${i3 + 1})`);
    const ths = cols.map((h, i3) => {
      const arrow = sort?.col === i3 ? sort.dir === "asc" ? " \u2191" : " \u2193" : "";
      return `<th data-col="${i3}" class="${numCols.has(i3) ? "num" : ""}${sort?.col === i3 ? " sorted" : ""}" title="Click to sort">${esc(h)}${arrow}${COL_HANDLE}</th>`;
    }).join("");
    const trs = rows.map(
      (r) => `<tr>${cols.map((_, i3) => `<td class="${numCols.has(i3) ? "num" : ""}">${esc(r[i3] ?? "")}</td>`).join("")}</tr>`
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
  var linkHome = "";
  function setLinkHome(home) {
    linkHome = home.replace(/\/$/, "");
  }
  var underHome = (path) => !!linkHome && (path === linkHome || path.startsWith(linkHome + "/"));
  var opensNewTab = (url) => /^https?:/i.test(url) || /^file:\/\//i.test(url) && underHome(url.slice(7));
  function resolveMdUrl(base, url) {
    if (underHome(url)) return localFileUrl(url);
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
      if (tag === "a" && opensNewTab(resolveMdUrl(baseUrl, el2.getAttribute("href") ?? ""))) {
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
    for (let i3 = 0; i3 < s.length; i3++) {
      if (s[i3] === "`") {
        let end2 = i3;
        while (s[end2] === "`") end2++;
        const count = end2 - i3;
        if (!codeTicks) codeTicks = count;
        else if (codeTicks === count) codeTicks = 0;
        source += s.slice(i3, end2);
        i3 = end2 - 1;
        continue;
      }
      if (s[i3] !== "<" || codeTicks || !/^<\/?[a-z][\w-]*\b/i.test(s.slice(i3))) {
        source += s[i3];
        continue;
      }
      let end = i3 + 1, quote = "";
      for (; end < s.length; end++) {
        if (quote) {
          if (s[end] === quote) quote = "";
        } else if (s[end] === '"' || s[end] === "'") quote = s[end];
        else if (s[end] === ">") break;
      }
      if (end === s.length) {
        source += s[i3];
        continue;
      }
      const raw = s.slice(i3, end + 1);
      const name = raw.match(/^<\/?([a-z][\w-]*)/i)[1].toLowerCase();
      if (!HTML_TAGS.has(name)) {
        source += raw;
        i3 = end;
        continue;
      }
      const safe = sanitizeHtml(raw.startsWith("</") ? `<${name}></${name}>` : `${raw}${VOID_TAGS.has(name) ? "" : `</${name}>`}`, baseUrl);
      const tag = raw.startsWith("</") ? `</${name}>` : safe.slice(0, safe.indexOf(">") + 1);
      htmlTags.push(tag);
      source += `\uE000${htmlTags.length - 1}\uE001`;
      i3 = end;
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
      return `<a href="${u}"${opensNewTab(u) ? ' target="_blank" rel="noopener"' : ""}>${t}</a>`;
    });
    out = out.replace(/&lt;((?:https?|file):\/\/[^\s<>]+?)&gt;/gi, "$1");
    out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
    out = out.split(/(<code>[\s\S]*?<\/code>|<[^>]+>|\b(?:https?|file):\/\/\S+)/).map((part, i3) => i3 % 2 ? part : part.replace(/(^|[^\w])__([^_\s][^_]*?)__(?!\w)/g, "$1<strong>$2</strong>").replace(/(^|[^\w])_([^_\s][^_]*?)_(?!\w)/g, "$1<em>$2</em>")).join("");
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
    if (!(linkHome && html.includes(linkHome)) && !/(?:https?|file):\/\//i.test(html)) return html;
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
        const start = linkHome ? value.indexOf(linkHome, cursor) : -1;
        if (start < 0) break;
        const afterHome = value[start + linkHome.length];
        if (start && /[\w/:]/.test(value[start - 1]) || afterHome && afterHome !== "/" && !/\s|[),.;!?]/.test(afterHome)) {
          replacement.append(value.slice(cursor, start + 1));
          cursor = start + 1;
          continue;
        }
        let end = start + linkHome.length;
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
  function frontMatterRows(lines) {
    const rows = [];
    const unquote = (s) => s.trim().replace(/^(["'])(.*)\1$/, "$2");
    for (const l of lines) {
      const kv = /^([\w.-]+)\s*:\s*(.*)$/.exec(l);
      const item = /^\s+-\s+(.*)$/.exec(l);
      const last = rows[rows.length - 1];
      if (kv) {
        const v = kv[2].trim();
        const flow = /^\[(.*)\]$/.exec(v);
        rows.push(flow ? { key: kv[1], value: "", items: flow[1].split(",").map(unquote).filter(Boolean) } : { key: kv[1], value: unquote(v) });
      } else if (item && last) {
        (last.items ??= []).push(unquote(item[1]));
      } else if (/^\s+\S/.test(l) && last && !last.items) {
        last.value = (/^[|>][-+]?$/.test(last.value) ? "" : last.value + " ") + l.trim();
      }
    }
    return rows;
  }
  var FM_PATH = /^(~\/|\.{1,2}\/|\/)?[\w@.-]+(\/[\w@.-]+)*\/?$/;
  var fmPath = (v) => FM_PATH.test(v) && !/^\d/.test(v) && (v.includes("/") || /\.[a-z][\w]{0,5}$/i.test(v));
  function fmValue(v, baseUrl) {
    return fmPath(v) ? `<span class="fe-fm-path" data-fm-path="${esc(v)}">${esc(v)}</span>` : mdInline(v, baseUrl);
  }
  function renderMarkdown(src, baseUrl = "", inner = false, nested = false) {
    let lines = src.replace(/\r\n/g, "\n").split("\n");
    const out = [];
    let para = [];
    const seenIds = /* @__PURE__ */ new Map();
    const notes2 = /* @__PURE__ */ new Map();
    let srcLine = lines.map((_, k) => k + 1);
    if (!inner) {
      let inFence = false;
      const keep = [];
      lines = lines.filter((l, k) => {
        if (/^ {0,3}(`{3,}|~{3,})/.test(l)) inFence = !inFence;
        const m = !inFence && l.match(/^\[\^([^\]\s]+)\]:\s*(.*)$/);
        if (m) {
          notes2.set(m[1], m[2]);
          return false;
        }
        keep.push(k + 1);
        return true;
      });
      srcLine = keep;
    }
    const marking = !inner && !nested;
    const mark = (from, start) => {
      if (!marking) return;
      const a = srcLine[from] ?? from + 1, b = srcLine[Math.max(from, i3 - 1)] ?? i3;
      for (let k = start; k < out.length; k++) if (!/^<[^>]* data-sl=/.test(out[k])) out[k] = out[k].replace(/^(<[a-z][a-z0-9]*\b[^>]*?)>/, `$1 data-sl="${a}-${b}">`);
    };
    let i3 = 0;
    if (!inner && lines[0] === "---") {
      const end = lines.slice(1, 60).findIndex((l) => l === "---");
      if (end >= 0) {
        const rows = frontMatterRows(lines.slice(1, end + 1));
        if (rows.length) out.push(`<dl class="fe-md-fm" data-fm-base="${esc(baseUrl)}">${rows.map((r) => `<dt>${esc(r.key)}</dt><dd>${r.items ? `<span class="fe-fm-items">${r.items.map((v) => fmPath(v) ? `<span class="fe-fm-item">${fmValue(v, baseUrl)}</span>` : `<span class="fe-fm-item chip" data-size="sm" data-tone="quiet"><span>${esc(v)}</span></span>`).join("")}</span>` : fmValue(r.value, baseUrl)}</dd>`).join("")}</dl>`);
        i3 = end + 2;
      }
    }
    let paraFrom = 0, paraTo = 0;
    const flush = () => {
      if (!para.length) return;
      const text = para.map((l, k) => k < para.length - 1 && /( {2,}|\\)$/.test(l) ? l.replace(/( {2,}|\\)$/, "") + "\uE002" : l.trim()).join(" ");
      out.push(`<p${marking ? ` data-sl="${srcLine[paraFrom]}-${srcLine[paraTo]}"` : ""}>${mdInline(text, baseUrl).replace(/\uE002 ?/g, "<br>")}</p>`);
      para = [];
    };
    while (i3 < lines.length) {
      const line2 = lines[i3];
      const from = i3, outAt = out.length;
      const fence = line2.match(/^( {0,3})(`{3,}|~{3,})([^\r\n]*)$/);
      if (fence) {
        flush();
        const buf = [];
        i3++;
        const marker = fence[2][0], width = fence[2].length, indent = fence[1].length;
        const close = new RegExp(`^ {0,3}${marker === "`" ? "`" : "~"}{${width},}\\s*$`);
        while (i3 < lines.length && !close.test(lines[i3])) {
          buf.push(lines[i3++].replace(new RegExp(`^ {0,${indent}}`), ""));
        }
        if (i3 < lines.length) i3++;
        const code = buf.join("\n");
        const language = fence[3].trim().split(/\s+/)[0] || "";
        if (language.toLowerCase() === "mermaid") {
          out.push(`<div class="fe-md-mermaid"><pre class="fe-md-mermaid-source" hidden>${esc(code)}</pre><div class="fe-md-mermaid-view">Rendering diagram\u2026</div></div>`);
        } else {
          out.push(`<div class="fe-md-code"><div class="bar fe-md-code-bar" data-inset><span class="fe-md-lang">${esc(language || "text")}</span><button type="button" class="btn fe-md-copy" data-icon data-size="sm" title="Copy this block" aria-label="Copy this block">${UI_ICON.copy}</button></div><pre class="fe-md-pre fe-md-lines">${codeLines(highlightCode(code, language || "md"))}</pre></div>`);
        }
        mark(from, outAt);
        continue;
      }
      const h = line2.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        flush();
        const n = h[1].length;
        const id = headingId(h[2].replace(/[*_`]/g, ""), seenIds);
        out.push(`<h${n} id="${esc(id)}">${mdInline(h[2], baseUrl)}<a class="fe-md-anchor" href="#${esc(id)}" title="Link to this heading"></a></h${n}>`);
        i3++;
        mark(from, outAt);
        continue;
      }
      if (/^\s*<[a-zA-Z!/]/.test(line2)) {
        flush();
        const buf = [];
        while (i3 < lines.length && !/^\s*$/.test(lines[i3])) buf.push(lines[i3++]);
        out.push(`<div class="fe-md-html">${sanitizeHtml(buf.join("\n"), baseUrl)}</div>`);
        mark(from, outAt);
        continue;
      }
      if (para.length === 0 && /^\s*(?:\*{3,}|-{3,}|_{3,})\s*$/.test(line2)) {
        flush();
        out.push("<hr>");
        i3++;
        mark(from, outAt);
        continue;
      }
      if (/^\s*>/.test(line2)) {
        flush();
        const buf = [];
        while (i3 < lines.length && /^\s*>/.test(lines[i3])) buf.push(lines[i3++].replace(/^\s*>\s?/, ""));
        const alert = buf[0]?.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/i);
        if (alert) {
          const kind = alert[1].toUpperCase();
          out.push(`<div class="fe-md-alert fe-md-alert-${kind.toLowerCase()}"><p class="fe-md-alert-title">${ALERTS[kind]}</p>${renderMarkdown(buf.slice(1).join("\n"), baseUrl, true)}</div>`);
        } else out.push(`<blockquote>${renderMarkdown(buf.join("\n"), baseUrl, false, true)}</blockquote>`);
        mark(from, outAt);
        continue;
      }
      const li = line2.match(LIST_ITEM);
      if (li && (li[3] !== void 0 || para.length === 0)) {
        flush();
        const baseIndent = li[1].length;
        const ordered = /\d/.test(li[2]);
        const items = [];
        let loose = false;
        while (i3 < lines.length) {
          const m = lines[i3].match(LIST_ITEM);
          if (!m || m[1].length !== baseIndent || /\d/.test(m[2]) !== ordered) break;
          const contentIndent = m[1].length + m[2].length + 1;
          const body = [m[3] ?? ""];
          i3++;
          while (i3 < lines.length) {
            const l = lines[i3];
            if (/^\s*$/.test(l)) {
              const next = lines.slice(i3 + 1).find((x) => !/^\s*$/.test(x));
              if (next !== void 0 && next.match(/^\s*/)[0].length >= contentIndent) {
                body.push("");
                i3++;
                loose = true;
                continue;
              }
              break;
            }
            const ind = l.match(/^\s*/)[0].length;
            if (ind >= contentIndent || ind > baseIndent && LIST_ITEM.test(l)) {
              body.push(l.slice(Math.min(ind, contentIndent)));
              i3++;
              continue;
            }
            if (!LIST_ITEM.test(l) && body[body.length - 1] !== "" && !/^\s*(#|>|```|~~~|\|)/.test(l)) {
              body.push(l.trim());
              i3++;
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
          if (i3 < lines.length && /^\s*$/.test(lines[i3]) && lines[i3 + 1]?.match(LIST_ITEM)?.[1].length === baseIndent) {
            i3++;
            loose = true;
          }
        }
        const start = ordered ? parseInt(li[2], 10) : 1;
        out.push(ordered ? `<ol${start !== 1 ? ` start="${start}"` : ""}>${items.join("")}</ol>` : `<ul>${items.join("")}</ul>`);
        mark(from, outAt);
        continue;
      }
      if (line2.includes("|") && i3 + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*\s*$/.test(lines[i3 + 1])) {
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
        const head = cells(line2);
        i3 += 2;
        const rows = [];
        while (i3 < lines.length && lines[i3].includes("|")) rows.push(cells(lines[i3++]));
        out.push(`<div class="fe-md-tablewrap"><table class="fe-md-table fe-rz"><thead><tr>${head.map((c) => `<th>${c}${COL_HANDLE}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${Array.from({ length: head.length }, (_, n) => `<td>${r[n] ?? ""}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
        mark(from, outAt);
        continue;
      }
      if (/^\s*$/.test(line2)) {
        flush();
        i3++;
        continue;
      }
      if (!para.length) paraFrom = i3;
      paraTo = i3;
      para.push(line2.replace(/^\s+/, ""));
      i3++;
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
      const entries = isArr ? v.map((x, i3) => [String(i3), x]) : Object.entries(v);
      const badge = isArr ? `[${entries.length}]` : `{${entries.length}}`;
      if (!entries.length) return `<div class="fe-jt-row">${keyHtml}<span class="fe-jt-badge">${isArr ? "[]" : "{}"}</span></div>`;
      const open = depth < 2 ? " open" : "";
      return `<details class="fe-jt"${open}><summary>${DISCLOSE}${keyHtml}<span class="fe-jt-badge">${badge}</span></summary><div class="fe-jt-kids">${entries.map(([k, x]) => jsonNode(k, x, depth + 1, budget)).join("")}</div></details>`;
    }
    return `<div class="fe-jt-row">${keyHtml}${jsonLeaf(v)}</div>`;
  }
  function renderJsonTree(text) {
    let v;
    try {
      v = JSON.parse(text);
    } catch (err) {
      return `<div class="notice fe-ql-note">Not strict JSON, shown as text: ${esc(err.message)}</div>${renderCode(text, "jsonc")}`;
    }
    return `<div class="fe-jt-root">${jsonNode(null, v, 0, { n: RENDER_CAPS.treeNodes })}</div>`;
  }
  function renderValueTree(v) {
    return `<div class="fe-jt-root">${jsonNode(null, v, 0, { n: RENDER_CAPS.treeNodes })}</div>`;
  }
  function renderJsonl(text) {
    const lines = text.split("\n").map((l, i3) => ({ l, n: i3 + 1 })).filter((x) => x.l.trim() !== "");
    let truncNote = "";
    let shown = lines;
    if (lines.length > RENDER_CAPS.jsonlLines) {
      shown = lines.slice(0, RENDER_CAPS.jsonlLines);
      truncNote = `<div class="notice fe-ql-note">Showing first ${RENDER_CAPS.jsonlLines.toLocaleString()} of ${lines.length.toLocaleString()} lines.</div>`;
    }
    const body = shown.map(({ l: line2, n }) => {
      try {
        const v = JSON.parse(line2);
        const compact = JSON.stringify(v);
        const preview = compact.length > 140 ? compact.slice(0, 140) + "\u2026" : compact;
        return `<details class="fe-jl-line"><summary>${DISCLOSE}<span class="fe-jl-n">${n}</span><span class="fe-jl-prev">${esc(preview)}</span></summary><div class="fe-jt-kids">${jsonNode(null, v, 1, { n: 2e3 })}</div></details>`;
      } catch {
        return `<div class="fe-jl-line bad"><span class="fe-jl-n">${n}</span><span class="fe-jl-err">not JSON</span><span class="fe-jl-prev">${esc(line2.slice(0, 200))}</span></div>`;
      }
    }).join("");
    return `${truncNote}<div class="fe-jl-root">${body}</div>`;
  }

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
      const rows = parseDSV(text, e === "tsv" ? "	" : ",").filter((r) => r.some((c) => c.trim()));
      const cols = rows.reduce((w, r) => Math.max(w, r.length), 0);
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
    const pick = (k) => m.items.find((i3) => i3.key === k)?.value;
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
    return m.items.map((i3) => `<span class="fe-meta-item" title="${esc(i3.label)}">${icon(i3.key)}${esc(i3.value)}</span>`).join("");
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
    for (let i3 = 0; i3 < attempts; i3++) {
      if (!chrome.runtime?.id) throw new FileFetchError("context-invalidated", "extension reloaded under this page");
      let res;
      try {
        res = await relayOnce(url);
      } catch (e) {
        throw new FileFetchError("context-invalidated", String(e));
      }
      if (res === null) {
        await sleep(delayMs * (i3 + 1));
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
  async function fileExists(rawUrl) {
    const url = new URL(rawUrl, location.href).href;
    for (let i3 = 0; i3 < 2; i3++) {
      if (!chrome.runtime?.id) return false;
      let res;
      try {
        res = await relayOnce(url);
      } catch {
        return false;
      }
      if (res) return res.ok;
      await sleep(150);
    }
    return false;
  }

  // src/note-meta-ui.ts
  var colorDot = (c) => `<svg class="fe-cdot" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">` + (c ? `<circle cx="6" cy="6" r="4.5" fill="var(--nc-${c})"/>` : `<circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" stroke-width="1.2"/>`) + `</svg>`;
  var openMenu = null;
  function closePropsMenu() {
    openMenu?.close("api");
    openMenu = null;
  }
  function openPropsMenu(anchor, props, apply) {
    closePropsMenu();
    const menu = document.createElement("div");
    menu.className = "fe-pmenu";
    let cur = props;
    const render2 = () => {
      menu.innerHTML = `
      <button data-size="sm" class="btn fe-pm-pin${cur.pinned ? " active" : ""}" data-pm="pin" role="menuitem">${UI_ICON.pin}<span>${cur.pinned ? "unpin" : "pin to top"}</span></button>
      <div class="fe-pm-lbl">Colour</div>
      <div class="fe-pm-colors">
        <button data-size="sm" class="btn${cur.color === null ? " active" : ""}" data-pm="color" data-color="" role="menuitem">${colorDot(null)}<span>none</span></button>
        ${NOTE_COLORS.map((c) => `<button data-size="sm" class="btn${cur.color === c ? " active" : ""}" data-pm="color" data-color="${c}" role="menuitem">${colorDot(c)}<span>${c}</span></button>`).join("")}
      </div>
      <div class="fe-pm-lbl">tags</div>
      <div class="fe-pm-tags">
        ${cur.tags.map((t) => `<span class="chip">${UI_ICON.tag}<span>${esc(t)}</span><button class="btn" data-icon data-size="xs" data-tone="danger" data-pm="untag" data-tag="${esc(t)}" title="Remove tag ${esc(t)}" aria-label="Remove tag ${esc(t)}">${UI_ICON.close}</button></span>`).join("")}
      </div>
      <form class="fe-pm-add"><input class="tb" data-size="sm" type="text" placeholder="new tag" autocomplete="off" spellcheck="false" maxlength="32"><button class="btn" data-size="sm" type="submit">${UI_ICON.add}<span>add</span></button></form>`;
    };
    const run = async (c) => {
      const r = await apply(c);
      if (r) cur = r;
      render2();
      openMenu?.place();
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
    openMenu = openLayer(menu, { kind: "popover", anchor, role: "menu", group: "menu", focus: menu.querySelector(".fe-pm-add input") });
  }
  function mountMetaBar(host, o) {
    const draw = () => {
      const p = o.props();
      host.innerHTML = `
      ${o.titleEditable() ? `<button id="fe-meta-title" class="fe-chip-title" data-title="${esc(p.title)}" title="${esc(p.title)}&#10;Click to edit the whole title" aria-label="Note title: ${esc(p.title)}. Click to edit.">${UI_ICON.rename}${midHtml(p.title)}</button>` : `<span class="chip" title="This note has no properties block yet; its title is its first line">${UI_ICON.notes}<span>${esc(p.title)}</span></span>`}
      <button data-size="sm" class="btn fe-chip-btn${p.pinned ? " active" : ""}" data-m="pin" title="${p.pinned ? "Unpin this note" : "Pin this note to the top of the list"}">${UI_ICON.pin}<span>${p.pinned ? "Pinned" : "Pin"}</span></button>
      <button data-size="sm" class="btn fe-chip-btn${p.color ? " active" : ""}" data-m="color" title="Set this note's colour">${colorDot(p.color)}<span>${p.color ? p.color[0].toUpperCase() + p.color.slice(1) : "Colour"}</span></button>
      ${p.tags.map((t) => `<span class="chip">${UI_ICON.tag}<span>${esc(t)}</span><button class="btn" data-icon data-size="xs" data-tone="danger" data-m="untag" data-tag="${esc(t)}" title="Remove tag ${esc(t)}" aria-label="Remove tag ${esc(t)}">${UI_ICON.close}</button></span>`).join("")}
      <button class="btn fe-chip-btn" data-size="sm" data-m="tag" title="Add a tag">${UI_ICON.add}<span>Tag</span></button>`;
      const btn = host.querySelector("#fe-meta-title");
      btn?.addEventListener("click", () => {
        const box = document.createElement("textarea");
        box.id = "fe-meta-title-edit";
        box.className = "tb fe-chip-title";
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
  var BTN = (act, icon2, text, title) => `<button class="btn" data-img="${act}" title="${esc(title)}">${icon2}<span>${text}</span></button>`;
  function mountImageTools(wrap, o) {
    wrap.innerHTML = `
    <div class="bar fe-ql-imgbar" role="toolbar" aria-label="Image tools">
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
  var BUF_CHARS = 8e6;
  var bufHist = /* @__PURE__ */ new Map();
  function diffText(a, b) {
    let p = 0;
    const max = Math.min(a.length, b.length);
    while (p < max && a.charCodeAt(p) === b.charCodeAt(p)) p++;
    let s = 0;
    while (s < max - p && a.charCodeAt(a.length - 1 - s) === b.charCodeAt(b.length - 1 - s)) s++;
    return { at: p, len: a.length - p - s, ins: b.slice(p, b.length - s) };
  }
  var applyPatch = (t, p) => t.slice(0, p.at) + p.ins + t.slice(p.at + p.len);
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
    const changed = lines.map((l, i3) => {
      let d;
      if (outdent) {
        const n = l.startsWith(unit) ? unit.length : l.startsWith(" ") ? 1 : 0;
        d = -n;
        l = l.slice(n);
      } else {
        l = unit + l;
        d = unit.length;
      }
      if (i3 === 0) firstDelta = d;
      total += d;
      return l;
    });
    const out = text.slice(0, from) + changed.join("\n") + text.slice(to);
    return { text: out, start: Math.max(from, sel.start + firstDelta), end: Math.max(from, sel.end + total) };
  }
  function continueList(text, sel) {
    const from = text.lastIndexOf("\n", sel.start - 1) + 1;
    const line2 = text.slice(from, sel.start);
    const m = line2.match(/^(\s*)([-*+]|\d+[.)])\s(\[[ xX]\]\s)?(.*)$/);
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
    const head = "| " + Array.from({ length: cols }, (_, i3) => `Column ${i3 + 1}`).join(" | ") + " |";
    const sep = "|" + Array.from({ length: cols }, () => " --- |").join("");
    const body = Array.from({ length: rows }, () => "|" + Array.from({ length: cols }, () => "   |").join("")).join("\n");
    return `${head}
${sep}
${body}
`;
  }
  function attachBuffer(el2, id, io = { get: () => el2.value, set: (v) => {
    el2.value = v;
  } }) {
    const h = bufHist.get(id) ?? { cur: "", past: [], future: [], timer: null };
    bufHist.set(id, h);
    h.cur = io.get() ?? "";
    h.past = [];
    h.future = [];
    const snap = () => {
      const now = io.get() ?? "";
      if (now === h.cur) return;
      h.past.push(diffText(now, h.cur));
      h.cur = now;
      let chars = h.past.reduce((n, p) => n + p.ins.length, 0);
      while (h.past.length > BUF_CAP || h.past.length > 1 && chars > BUF_CHARS) chars -= h.past.shift().ins.length;
      h.future = [];
    };
    const record = () => {
      if (h.timer) clearTimeout(h.timer);
      h.timer = setTimeout(snap, BUF_COALESCE);
    };
    const put = (v) => {
      h.cur = v;
      io.set(v);
      el2.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const step2 = (from, to) => {
      const prev = applyPatch(h.cur, from.pop());
      to.push(diffText(prev, h.cur));
      put(prev);
    };
    const undo = () => {
      if (h.timer) clearTimeout(h.timer);
      snap();
      if (!h.past.length) return false;
      step2(h.past, h.future);
      return true;
    };
    const redo = () => {
      if (!h.future.length) return false;
      step2(h.future, h.past);
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
    return { undo, redo, snap, depth: () => h.past.length + 1, insert: (t) => insertAtCursor(el2, t) };
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
  function llmModels() {
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
        settle({ tiers: [], gemini: [] });
        return;
      }
      const timer = setTimeout(() => {
        try {
          port.disconnect();
        } catch {
        }
        settle({ tiers: [], gemini: [] });
      }, 2e4);
      port.onMessage.addListener((msg) => {
        if (msg?.t !== "models" && msg?.t !== "error" && msg?.t !== "native-gone") return;
        clearTimeout(timer);
        try {
          port.disconnect();
        } catch {
        }
        settle(msg.t === "models" ? { tiers: msg.tiers ?? [], gemini: msg.gemini ?? [] } : { tiers: [], gemini: [] });
      });
      port.onDisconnect.addListener(() => {
        clearTimeout(timer);
        settle({ tiers: [], gemini: [] });
      });
      port.postMessage({ op: "models" });
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
    server_down: "The local model is not running. Start it with lm in a terminal.",
    model_missing: "The model is not available on the server.",
    ctx_too_large: "This file is too large for the model.",
    timeout: "The model took too long and was stopped.",
    invalid_args: "Invalid request.",
    cancelled: "Cancelled.",
    host_no_lm: "The lm CLI was not found on this machine.",
    unavailable: "Local AI is not set up. Settings, AI shows how.",
    disconnected: "The AI host disconnected unexpectedly.",
    gemini_unavailable: "Gemini did not answer. Check lm gemini in a terminal, or pick a local model."
  };

  // src/ask-history.ts
  var historyPref = jsonPref("bfb-ask-history-v1", {}, (v) => !!v && typeof v === "object");
  var CHATS_PER_SUBJECT = 20;
  var SUBJECTS = 100;
  var ANSWER_MAX = 2e4;
  function read() {
    return historyPref.get();
  }
  function allChats() {
    return Object.entries(read()).flatMap(([subject, list3]) => list3.map((chat) => ({ subject, chat }))).sort((a, b) => b.chat.at - a.chat.at);
  }
  function chatsFor(subject) {
    return (read()[subject] ?? []).slice().sort((a, b) => b.at - a.at);
  }
  function addTurn(subject, chatId, turn) {
    const store = read();
    const list3 = store[subject] ?? [];
    let chat = list3.find((c) => c.id === chatId);
    if (!chat) {
      chat = { id: chatId, at: turn.at, title: turn.q.slice(0, 80), turns: [] };
      list3.push(chat);
    }
    chat.turns.push({ ...turn, a: turn.a.slice(0, ANSWER_MAX) });
    chat.at = turn.at;
    store[subject] = list3.sort((a, b) => b.at - a.at).slice(0, CHATS_PER_SUBJECT);
    const subjects = Object.keys(store);
    if (subjects.length > SUBJECTS) {
      const last = (k) => Math.max(...store[k].map((c) => c.at));
      subjects.sort((a, b) => last(a) - last(b)).slice(0, subjects.length - SUBJECTS).forEach((k) => {
        delete store[k];
      });
    }
    historyPref.set(store);
    return chat;
  }
  function deleteChat(subject, chatId) {
    const store = read();
    store[subject] = (store[subject] ?? []).filter((c) => c.id !== chatId);
    if (!store[subject].length) delete store[subject];
    historyPref.set(store);
  }
  function withHistory(turns, question, maxChars = 4e3) {
    if (!turns.length) return question;
    const parts = [];
    let used = 0;
    for (const t of turns.slice(-4).reverse()) {
      const block = `Q: ${t.q}
A: ${t.a}`;
      if (used + block.length > maxChars) break;
      parts.unshift(block);
      used += block.length;
    }
    return parts.length ? `Earlier in this chat:
${parts.join("\n\n")}

Now: ${question}` : question;
  }

  // src/nav.ts
  function go(href, how = "here", o = {}) {
    if (how === "chrome-tab") {
      window.open(href, "_blank");
      return;
    }
    location.href = (o.exact ? href : pageHref(href)) + (o.hash ?? "");
  }
  function reload() {
    location.reload();
  }
  function markPlace(hash) {
    history.replaceState(null, "", hash);
  }

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
  function previewedPath() {
    return currentEntry ? decodeURIComponent(new URL(currentEntry.href, location.href).pathname) : edit ? edit.root.replace(/\/$/, "") + "/" + edit.rel : null;
  }
  function keepPreviewedAsTab() {
    const path = previewedPath();
    if (path && deps.keepTab) deps.keepTab(path);
  }
  function syncSaveBtn() {
    const p = previewedPath(), b = document.getElementById("fe-ql-save");
    if (!b) return;
    const on = !!p && isSaved(p);
    b.classList.toggle("on", on);
    b.title = on ? "Remove from Saved" : "Save this file";
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
    <div id="fe-ql-bg" class="scrim"></div>
    <div id="fe-ql-dialog" class="panel">
      <div id="fe-ql-hdr" class="bar">
        <span id="fe-ql-icon"></span>
        <a id="fe-ql-name" target="_blank" rel="noopener" title="Open natively in a new tab (\u2318-click / middle-click also work)"></a>
        <span id="fe-ql-meta"></span>
        <button id="fe-ql-copy" class="btn" title="Copy full file contents to clipboard" disabled>
          <svg width="11" height="12" viewBox="0 0 11 12"><rect x="3" y="3" width="7" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M1 1h6v1" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
          <span>Copy</span>
        </button>
        <a id="fe-ql-open" class="btn" target="_blank" rel="noopener" title="The raw file, in a new tab">${UI_ICON.external}<span>Raw</span></a>
        <button id="fe-ql-go" class="btn" title="Open in this tab (Enter)">${UI_ICON.files}<span>Open</span></button>
        <button id="fe-ql-tab" class="btn" title="Keep as a strip tab (t)">${UI_ICON.tab}<span>Tab</span></button>
        <button id="fe-ql-save" class="btn" data-icon title="Save this file">${PI.bm}</button>
        <button id="fe-ql-term" class="btn" data-icon title="Open its folder in the terminal">${UI_ICON.terminal}</button>
        ${SIZE_BTN("fe-ql-size")}
        <button id="fe-ql-dock" class="btn" data-icon title="Dock the preview to the side">
          <svg width="13" height="13" viewBox="0 0 13 13"><rect x="1" y="1.5" width="11" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M8 1.5v10" stroke="currentColor" stroke-width="1.3"/></svg>
        </button>
        <button id="fe-ql-close" class="btn" data-icon title="Close (Esc)">${UI_ICON.close}</button>
      </div>
      <div id="fe-ql-rz" title="Drag to resize"></div>
      <div id="fe-ql-rz-side" title="Drag to resize"></div>
      <div id="fe-ql-ai" style="display:none">
        <span id="fe-ql-ai-chip"><span class="dot"></span><span id="fe-ql-ai-chip-txt"></span></span>
        <button class="btn fe-ql-ai-btn" id="fe-ql-ai-sum" title="TL;DR of this file (local model)">Summarize</button>
        <button class="btn fe-ql-ai-btn" id="fe-ql-ai-exp" title="Explain this file, or describe a table (local model)"></button>
        <input id="fe-ql-ai-q" class="tb" type="text" placeholder="Ask about this file" autocomplete="off" spellcheck="false">
        <button class="btn fe-ql-ai-btn" id="fe-ql-ai-ask" title="Answer grounded in this file only">Ask</button>
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
      if (currentEntry) go(currentEntry.href);
      else if (edit) go(fileHref(edit.root.replace(/\/$/, "") + "/" + edit.rel));
    });
    document.getElementById("fe-ql-tab").addEventListener("click", keepPreviewedAsTab);
    document.getElementById("fe-ql-save").addEventListener("click", () => {
      const p = previewedPath();
      if (!p) return;
      const now = toggleSaved(p, p.split("/").pop() || p);
      syncSaveBtn();
      deps.savedChanged?.();
      deps.toast?.(now ? "Saved" : "Removed from Saved");
    });
    document.getElementById("fe-ql-term").addEventListener("click", () => {
      const p = previewedPath();
      if (p) deps.openInTerminal?.(p.replace(/\/[^/]*$/, "") || "/");
    });
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
    focusTrap(overlay, { when: () => layout.mode !== "side" });
    const dialog = document.getElementById("fe-ql-dialog");
    const sizer = wireSize(document.getElementById("fe-ql-size"), dialog, "preview", () => applyLayout());
    resizable(document.getElementById("fe-ql-rz"), {
      axis: "xy",
      label: "Resize the preview",
      size: () => {
        const r = dialog.getBoundingClientRect();
        return { w: r.width, h: r.height };
      },
      apply: (w, h) => {
        const r = dialog.getBoundingClientRect();
        layout.modalW = Math.min(window.innerWidth - r.left - 8, Math.max(360, w));
        layout.modalH = Math.min(window.innerHeight - r.top - 8, Math.max(240, h));
        if (dialog.dataset.size) sizer.set("md");
        applyLayout();
      },
      reset: () => {
        delete layout.modalW;
        delete layout.modalH;
        if (dialog.dataset.size) sizer.set("md");
        applyLayout();
      },
      commit: () => savePreviewLayout(layout)
    });
    resizable(document.getElementById("fe-ql-rz-side"), {
      axis: "x",
      dir: -1,
      label: "Resize the preview",
      size: () => ({ w: overlay.getBoundingClientRect().width, h: 0 }),
      apply: (w) => {
        layout.sideW = Math.min(window.innerWidth * 0.8, Math.max(280, w));
        applyLayout();
      },
      reset: () => {
        delete layout.sideW;
        applyLayout();
      },
      commit: () => savePreviewLayout(layout)
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
    dialog.toggleAttribute("data-dock", side);
    overlay.querySelectorAll("#fe-ql-hdr > .btn").forEach((b) => {
      if (!b.querySelector(":scope > span")) return;
      if (side) {
        b.dataset.icon = "";
        b.dataset.dockIcon = "";
      } else if ("dockIcon" in b.dataset) {
        delete b.dataset.icon;
        delete b.dataset.dockIcon;
      }
    });
    const host = side ? document.getElementById("fe-body") : document.getElementById("fe");
    if (host && overlay.parentElement !== host) host.appendChild(overlay);
    overlay.style.width = side && layout.sideW ? `min(${layout.sideW}px, max(280px, calc(100vw - 600px)))` : "";
    const own = !side && !dialog.dataset.size;
    dialog.style.width = own && layout.modalW ? `min(${layout.modalW}px, calc(100vw - 16px))` : "";
    dialog.style.height = own && layout.modalH ? `min(${layout.modalH}px, calc(100vh - 16px))` : "";
    if (side) lower(overlay);
    else if (overlay.style.display !== "none") raise(overlay);
    if (overlay.style.display !== "none") deps.dockRoom?.(side);
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
    deps.dockRoom?.(false);
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
  var aiChat = { href: "", id: "" };
  var AI_ASKED = { summarize: "Summarize", explain: "Explain", describe: "Describe" };
  function runAi(intent, question) {
    if (currentText === null || !currentEntry) return;
    const entry = currentEntry;
    if (aiChat.href !== entry.href) aiChat = { href: entry.href, id: "pv-" + Date.now().toString(36) };
    aiCancel?.();
    const seq2 = ++aiSeq;
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
          if (seq2 !== aiSeq) return;
          full += t;
          body.textContent = full;
        },
        onDone: (info) => {
          if (seq2 !== aiSeq) return;
          aiCancel = null;
          body.innerHTML = renderMarkdown(full);
          try {
            const path = decodeURIComponent(new URL(entry.href).pathname);
            addTurn(path, aiChat.id, { q: question || AI_ASKED[intent] || intent, a: full, model: info.model, ms: info.ms, at: Date.now() });
          } catch {
          }
          meta.textContent = `${info.model} \xB7 ${(info.ms / 1e3).toFixed(1)}s` + (info.truncated ? " \xB7 input truncated to fit the model" : "");
        },
        onError: (code, message) => {
          if (seq2 !== aiSeq) return;
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
    nameEl.hidden = true;
    document.getElementById("fe-ql-meta").textContent = `${edit.dirty ? "\u25CF " : ""}${edit.rel} \xB7 ${status}`;
  }
  var stripFrontMatter = (t) => t.replace(/^---\n[\s\S]*?\n---\n?/, "");
  function noteAction(name) {
    if (!edit?.actions) return false;
    if (name === "rename") edit.actions.rename(edit.rel, true);
    else edit.actions.del(edit.rel);
    return true;
  }
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
    nameEl.href = fileHref(root.replace(/\/$/, "") + "/" + doc.rel);
    document.getElementById("fe-ql-open").href = nameEl.href;
    resetAiUi();
    document.getElementById("fe-ql-ai").style.display = "none";
    const copyBtn = document.getElementById("fe-ql-copy");
    copyBtn.style.display = "";
    copyBtn.disabled = false;
    if (overlay.style.display === "none") rememberFocus();
    overlay.style.display = "flex";
    deps.dockRoom?.(layout.mode === "side");
    if (layout.mode !== "side") raise(overlay);
    syncSaveBtn();
    const body = document.getElementById("fe-ql-body");
    body.classList.add("fe-editing");
    body.innerHTML = `
    <div id="fe-ed-meta"></div>
    <div id="fe-ed-bar" class="bar">
      <button class="btn" data-icon data-act="bold" title="Bold (\u2318B)">${UI_ICON.fmtBold}</button>
      <button class="btn" data-icon data-act="italic" title="Italic (\u2318I)">${UI_ICON.fmtItalic}</button>
      <button class="btn" data-icon data-act="code" title="Code (\u2318E)">${UI_ICON.fmtCode}</button>
      <button class="btn" data-icon data-act="strike" title="Strikethrough (\u2318\u21E7X)">${UI_ICON.fmtStrike}</button>
      <button class="btn" data-act="heading" title="Heading: each press adds a level, up to ###, then clears (\u2318\u21E7H)" data-icon>${UI_ICON.fmtHeading}</button>
      <button class="btn" data-icon data-act="link" title="Link (\u2318K)">${UI_ICON.link}</button>
      <button class="btn" data-icon data-act="quote" title="Quote (\u2318\u21E7.)">${UI_ICON.fmtQuote}</button>
      <button class="btn" data-icon data-act="olist" title="Numbered list (\u2318\u21E77)">${UI_ICON.fmtOlist}</button>
      <button class="btn" data-icon data-act="list" title="Bullet list">${UI_ICON.list}</button>
      <button class="btn" data-icon data-act="task" title="Task list">${UI_ICON.task}</button>
      <button class="btn" data-icon data-act="table" title="Insert a table">${UI_ICON.table}</button>
      <button class="btn" data-icon data-act="image" title="Insert an image (or paste / drop one)">${UI_ICON.image}</button>
      <span class="bar-sep" aria-hidden="true"></span>
      <button class="btn" data-act="versions" title="Every save of this note, from the folder's git history">${UI_ICON.versions}<span>Versions</span></button>
      ${actions ? `<button class="btn" data-act="prev" title="Previous note in the list (\u2325\u2318\u2191)">${UI_ICON.prev}<span>Previous</span></button>
      <button class="btn" data-act="next" title="Next note in the list (\u2325\u2318\u2193)">${UI_ICON.next}<span>Next</span></button>
      <button class="btn" data-act="rename" title="Rename this note (F2)">${UI_ICON.rename}<span>Rename</span></button>
      <button class="btn" data-act="delete" title="Move this note to .trash (\u2318\u21E7\u232B)">${UI_ICON.trash}<span>Delete</span></button>` : ""}
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
        const line2 = ta.value.slice(from, to);
        const level = line2.match(/^(#{1,6}) /)?.[1].length ?? 0;
        const next = level >= 3 ? line2.replace(/^#{1,6} /, "") : "#".repeat(level + 1) + " " + line2.replace(/^#{1,6} /, "");
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
      hist.innerHTML = emptyHtml("loading", "Reading versions\u2026", { inline: true });
      try {
        const { versions: vs, repo } = await notes.history(root, edit?.rel ?? doc.rel);
        if (!vs.length) {
          hist.innerHTML = emptyHtml("empty", "No versions yet", { inline: true, hint: repo === false ? "The notes folder is not a git repository; Switchboard makes it one on its first save." : "This note has not been committed to the notes folder's git history." });
          return;
        }
        hist.innerHTML = vs.slice(0, 30).map((v) => `<button class="row fe-hist-row" data-sha="${v.sha}"><span>${whenText(v.when)}</span><span>${escHtml(v.reason)}</span><code>${v.sha}</code></button>`).join("") + (vs.length > 30 ? `<span class="fe-ed-hint">and ${vs.length - 30} older</span>` : "");
        hist.querySelectorAll(".fe-hist-row").forEach((b) => b.addEventListener("click", () => void showVersion(b.dataset.sha)));
      } catch (err) {
        hist.innerHTML = emptyHtml("failed", "Versions could not be read", { inline: true, hint: err.message, actions: [{ a: "retry", label: "Try again", title: "Read the versions again" }] });
        hist.querySelector('[data-a="retry"]')?.addEventListener("click", () => {
          hist.style.display = "none";
          void toggleVersions();
        });
      }
    };
    const showVersion = async (sha) => {
      hist.querySelectorAll(".fe-hist-row").forEach((b) => b.classList.toggle("active", b.dataset.sha === sha));
      try {
        const v = await notes.version(root, edit?.rel ?? doc.rel, sha);
        view.innerHTML = `<div class="fe-hist-head"><span>version ${sha}</span><button class="btn" id="fe-hist-use" title="Put this text in the editor; today's text stays in the versions">Use this version</button><button class="btn" id="fe-hist-back">Back to now</button></div>` + renderMarkdown(stripFrontMatter(v.text), nameEl.href);
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
        `<div id="fe-ed-clash" class="notice fe-ql-note">Two versions, keep: <button class="btn" data-keep="first">${UI_ICON.files}<span>${esc(sides[0])}</span></button> <button class="btn" data-keep="second">${UI_ICON.files}<span>${esc(sides[1])}</span></button> <button class="btn" data-keep="both">${UI_ICON.notes}<span>both</span></button></div>`
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
    const change = (fn, keys2) => {
      if (/^<{7} /m.test(st.text)) {
        editHeader("settle the two versions before changing properties");
        return false;
      }
      st.head = fn(st.head);
      keys2.forEach((k) => st.touched.add(k));
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
      if (edit === st) {
        editHeader(st.dirty ? "unsaved" : "saved " + (/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
        st.redrawMeta?.();
      }
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
              `<div id="fe-ed-conflict" class="notice fe-ql-note" data-tone="danger">Another program changed this note. <button id="fe-ed-reload" class="btn" title="Replace the editor text with the file on disk">Reload from disk</button> <button id="fe-ed-force" class="btn" title="Write the editor text over the disk copy">Overwrite</button></div>`
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
    const seq2 = ++reqSeq;
    const ext2 = getExt(e);
    document.getElementById("fe-ql-icon").innerHTML = getIcon(e, deps.iconRules());
    const nameEl = document.getElementById("fe-ql-name");
    nameEl.hidden = false;
    nameEl.textContent = e.name;
    nameEl.href = e.href;
    document.getElementById("fe-ql-meta").textContent = [kindName(ext2), e.rawBytes >= 0 ? fmtSize(e.rawBytes) : ""].filter(Boolean).join(" \xB7 ");
    document.getElementById("fe-ql-open").href = e.href;
    const body = document.getElementById("fe-ql-body");
    if (overlay.style.display === "none") rememberFocus();
    overlay.style.display = "flex";
    deps.dockRoom?.(layout.mode === "side");
    if (layout.mode !== "side") raise(overlay);
    syncSaveBtn();
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
        <div class="notice fe-ql-note">This file is ${fmtSize(e.rawBytes)}, so it may render slowly.</div>
        <button id="fe-ql-force" class="btn" title="Render despite the size">Load anyway</button>
      </div>`;
      document.getElementById("fe-ql-force").addEventListener("click", () => fetchAndRender(e, ext2, seq2));
      return;
    }
    fetchAndRender(e, ext2, seq2);
  }
  function fetchAndRender(e, ext2, seq2) {
    const body = document.getElementById("fe-ql-body");
    body.innerHTML = `<div class="fe-ql-center"><div class="notice fe-ql-note">Loading\u2026</div></div>`;
    fetchFileText(e.href).then((text) => {
      if (seq2 !== reqSeq) return;
      currentText = text;
      document.getElementById("fe-ql-copy").disabled = false;
      document.getElementById("fe-ql-meta").textContent = metaSummary(fileMeta(text, ext2, e.href, e.rawBytes >= 0 ? e.rawBytes : void 0));
      render(text, ext2);
    }).catch((err) => {
      if (seq2 !== reqSeq) return;
      console.error("[BFB] preview failed:", e.href, err);
      const stale = err instanceof FileFetchError && err.code === "context-invalidated";
      body.innerHTML = stale ? `<div class="fe-ql-center"><div class="notice fe-ql-note" data-tone="danger">The extension was reloaded; this page needs a refresh.</div><button id="fe-ql-retry" class="btn" title="Reload this page">Refresh page</button></div>` : `<div class="fe-ql-center"><div class="notice fe-ql-note" data-tone="danger">Could not read file.</div><button id="fe-ql-retry" class="btn" title="Try reading the file again">Retry</button></div>`;
      document.getElementById("fe-ql-retry").addEventListener("click", () => {
        if (stale) reload();
        else fetchAndRender(e, ext2, seq2);
      });
    });
  }
  function render(text, ext2) {
    const body = document.getElementById("fe-ql-body");
    const note2 = unrenderableNote(text);
    if (note2) {
      if (sniffBinary(text)) document.getElementById("fe-ql-ai").style.display = "none";
      body.innerHTML = `<div class="fe-ql-center">${note2}</div>`;
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
      body.innerHTML = `<div class="fe-ql-center">${unrenderableNote("")}</div>`;
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
    const btn = (v, label, on) => `<button class="btn${on ? " on" : ""}" data-v="${v}" title="${v === "page" ? "Show the rendered page" : "Show the HTML source"}">${label}</button>`;
    body.innerHTML = `<div class="bar fe-ql-htmlbar">${btn("page", "Page", !htmlSource)}${btn("src", "Source", htmlSource)}</div>` + (htmlSource ? renderCode(text, "html") : '<iframe class="fe-ql-html" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"></iframe>');
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
  var CSS2 = `
*{box-sizing:border-box;margin:0;padding:0}
/* Palettes (design-system.md, Soft round 2): Slate is the default; Violet,
   Sand and Ink are picked in Settings. Each palette sets only the surface,
   text and accent colours below, so every rule reads the same tokens.
   Selection and hover are washes mixed from the accent, so they follow it. */
:root{
  --bg:#0f1316;--s1:#151b1f;--s2:#1c2328;--s3:#253039;
  --bd:#243038;--bd2:#34434d;--tx:#e7eef1;--mt:#a3b2ba;--dm:#7f9099;
  --ac:#3cc6c0;--tx-on-ac:#0f1316;--dir:#a3b2ba;
  --shade:rgb(139 148 158 / .14);--shade2:rgb(139 148 158 / .24);
  --gold:#d29922;--green:#3fb950;
  --hover:color-mix(in srgb,var(--tx) 6%,transparent);--on:color-mix(in srgb,var(--ac) 18%,transparent);--r-sm:6px;
  --card:color-mix(in srgb,var(--s1),var(--s2) 62%);--side:var(--s1);
  --t-fast:120ms;--t-base:180ms;--t-slow:260ms;--ease:cubic-bezier(.2,.8,.2,1);
  --mono:'SF Mono',Menlo,Consolas,monospace;
  --nc-red:#ff6b6b;--nc-orange:#ffa94d;--nc-yellow:#ffd43b;--nc-green:#51cf66;--nc-teal:#38d9a9;--nc-blue:#4dabf7;--nc-purple:#b197fc;--nc-pink:#f783ac;
}
/* The html:has twin of each rule paints the page behind #fe to match. */
#fe[data-theme="light"],html:has(#fe[data-theme="light"]){
  --bg:#eef3f5;--s1:#ffffff;--s2:#eaf0f2;--s3:#dde6ea;
  --bd:#dbe4e8;--bd2:#c5d2d8;--tx:#17232a;--mt:#4f6370;--dm:#6b7f8a;
  --ac:#0b7a76;--tx-on-ac:#ffffff;--dir:#5d717c;
  --shade:rgb(110 119 129 / .10);--shade2:rgb(110 119 129 / .18);
  --hover:color-mix(in srgb,var(--tx) 5%,transparent);--on:color-mix(in srgb,var(--ac) 14%,transparent);
  --card:var(--s1);--side:color-mix(in srgb,var(--s1),var(--bg) 45%);
  --nc-red:#d92d2d;--nc-orange:#d9730d;--nc-yellow:#b58900;--nc-green:#2b8a3e;--nc-teal:#0c8f78;--nc-blue:#1971c2;--nc-purple:#7048e8;--nc-pink:#c2255c;
}
#fe[data-palette="violet"],html:has(#fe[data-palette="violet"]){
  --bg:#101014;--s1:#17171d;--s2:#1f1f27;--s3:#292933;
  --bd:#2a2a33;--bd2:#3a3a46;--tx:#ececf1;--mt:#a9a9b8;--dm:#85859c;
  --ac:#9d7cff;--tx-on-ac:#101014;--dir:#a9a9b8;
}
#fe[data-palette="violet"][data-theme="light"],html:has(#fe[data-palette="violet"][data-theme="light"]){
  --bg:#f4f4f7;--s1:#ffffff;--s2:#f0f0f5;--s3:#e6e6ee;
  --bd:#e3e3ea;--bd2:#cfcfdb;--tx:#1c1c24;--mt:#5d5d70;--dm:#76768c;
  --ac:#6d4aff;--tx-on-ac:#ffffff;--dir:#6e6e84;
}
#fe[data-palette="sand"],html:has(#fe[data-palette="sand"]){
  --bg:#13110f;--s1:#1b1815;--s2:#24201c;--s3:#2f2a24;
  --bd:#2f2a25;--bd2:#433b33;--tx:#efe9e2;--mt:#b8ab9c;--dm:#958778;
  --ac:#e8789a;--tx-on-ac:#13110f;--dir:#b8ab9c;
}
#fe[data-palette="sand"][data-theme="light"],html:has(#fe[data-palette="sand"][data-theme="light"]){
  --bg:#f6f2ec;--s1:#fffdfa;--s2:#f2ece4;--s3:#e8e0d5;
  --bd:#e6ddd1;--bd2:#d3c6b6;--tx:#2a221b;--mt:#6b5d4f;--dm:#867767;
  --ac:#c2406b;--tx-on-ac:#ffffff;--dir:#7a6a5a;
}
#fe[data-palette="ink"],html:has(#fe[data-palette="ink"]){
  --bg:#0c0c0d;--s1:#141415;--s2:#1b1b1d;--s3:#252527;
  --bd:#242426;--bd2:#353538;--tx:#f2f2f3;--mt:#a8a8ad;--dm:#86868c;
  --ac:#f2f2f3;--tx-on-ac:#0c0c0d;--dir:#a8a8ad;
}
#fe[data-palette="ink"][data-theme="light"],html:has(#fe[data-palette="ink"][data-theme="light"]){
  --bg:#f5f5f5;--s1:#ffffff;--s2:#f0f0f0;--s3:#e5e5e5;
  --bd:#e4e4e4;--bd2:#cfcfcf;--tx:#141414;--mt:#5c5c5c;--dm:#777777;
  --ac:#141414;--tx-on-ac:#ffffff;--dir:#666666;
}
/* Button, the one button part (docs/system/button.md). Class btn.
   data-variant: plain (the default), shade, surface (a solid fill for a
   button floating over content), outline, solid.
   data-size: xs 18, sm 22, md 28 (the default), lg 32.
   data-icon: an icon alone, square at its size and round.
   data-shape="pill": a text button with round ends, for a pill bar.
   data-mono: a code glyph label (.* or Aa).
   A Toggle is a button that stays on; it may wrap a hidden check box.
   data-tone: danger (red on hover), accent (accent text at rest).
   On: .on, .active, aria-pressed or aria-expanded="true". Busy:
   aria-busy="true" (a spinner in place of the content). Done: data-done
   (green text; the caller removes it after a moment). A disabled button
   keeps its rest look and loses every hover. */
.btn{--btn-h:var(--ctl-md);display:inline-flex;align-items:center;justify-content:center;gap:var(--sp-3);height:var(--btn-h);padding:0 var(--sp-4);flex-shrink:0;
  border:1px solid transparent;border-radius:var(--row-r);background:none;color:var(--mt);font:inherit;font-size:var(--type-ui);
  line-height:1;white-space:nowrap;text-decoration:none;cursor:pointer;box-sizing:border-box;
  transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease),border-color var(--t-fast) var(--ease),opacity var(--t-fast) var(--ease)}
.btn[hidden]{display:none}
.btn[data-size="xs"]{--btn-h:var(--ctl-xs);--btn-ic:10px;padding:0 var(--sp-2);font-size:var(--type-micro)}
.btn[data-size="sm"]{--btn-h:var(--ctl-sm);--btn-ic:12px;padding:0 var(--sp-3);font-size:var(--type-small)}
.btn[data-size="lg"]{--btn-h:var(--ctl-lg);--btn-ic:16px;padding:0 var(--sp-5)}
.btn[data-icon]{width:var(--btn-h);padding:0;border-radius:var(--r-full)}
.btn[data-shape="pill"]{padding:0 var(--sp-5);border-radius:var(--r-full)}
.btn svg{flex:none;width:var(--btn-ic,14px);height:var(--btn-ic,14px)}
.btn[data-variant="shade"],.btn[data-shade]{background:var(--shade)}
.btn[data-variant="surface"]{background:var(--s1);border-color:var(--bd)}
.btn[data-variant="outline"]{border-color:var(--bd2)}
.btn[data-variant="solid"]{background:var(--ac);color:var(--tx-on-ac)}
.btn[data-tone="accent"]{color:var(--ac)}
.btn:not(:disabled):not([aria-disabled="true"]):hover{color:var(--tx);background:var(--hover)}
.btn:not(:disabled):not([aria-disabled="true"]):is([data-variant="shade"],[data-shade]):hover{background:var(--shade2)}
.btn:not(:disabled):not([aria-disabled="true"])[data-variant="surface"]:hover{background:var(--s3)}
.btn:not(:disabled):not([aria-disabled="true"])[data-variant="outline"]:hover{border-color:var(--mt)}
.btn:not(:disabled):not([aria-disabled="true"])[data-variant="solid"]:hover{background:var(--ac);color:var(--tx-on-ac);filter:brightness(1.1)}
.btn:not(:disabled):not([aria-disabled="true"])[data-tone="danger"]:hover{color:var(--tone-danger)}
.btn.kb{color:var(--tx);background:var(--hover)}
.btn.on,.btn.active,.btn[aria-pressed="true"],.btn[aria-expanded="true"],.btn:has(> input:checked){color:var(--ac);background:var(--on)}
.btn[data-variant="outline"]:is(.on,.active,[aria-pressed="true"],:has(> input:checked)){border-color:color-mix(in srgb,var(--ac) 45%,transparent)}
/* A toggle can wrap a native check box, laid invisibly over the whole button. */
.btn:has(> input){position:relative}
.btn > input[type="checkbox"]{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}
.btn:has(> input:focus-visible){outline:2px solid var(--ac);outline-offset:1px}
.btn[data-mono]{font-family:var(--mono)}
.btn:not(:disabled):not([data-variant="solid"]):active{background:var(--s3)}
.btn[data-variant="solid"]:not(:disabled):active{filter:brightness(.95)}
.btn:disabled,.btn[aria-disabled="true"]{opacity:.45;cursor:default}
.btn:focus-visible{outline:2px solid var(--ac);outline-offset:1px}
.btn[aria-busy="true"]{position:relative;cursor:progress;color:transparent}
.btn[aria-busy="true"] > *{visibility:hidden}
.btn[aria-busy="true"]::after{content:'';position:absolute;width:var(--btn-ic,14px);height:var(--btn-ic,14px);border:2px solid var(--mt);border-right-color:transparent;border-radius:var(--r-full);animation:fe-spin var(--t-slow) linear infinite}
.btn[data-done],.btn[data-done]:not(:disabled):not([aria-disabled="true"]):hover{color:var(--tone-ok)}
/* Toolbar, the one bar (docs/system/toolbar.md). Class bar. A bar along a
   page or panel is 40px with 12px sides; its controls are md. data-inset: a
   toolbar inside content (a code block, a comment, a lens) keeps the gap
   but takes its size from its place. Controls sit 4px apart; a bar-sep
   between groups makes 12px. */
.bar{display:flex;align-items:center;gap:var(--sp-2);box-sizing:border-box;flex-shrink:0}
.bar:not([data-inset]){min-height:var(--bar-h);padding:5px var(--sp-5)}
.bar-sep{flex:none;width:1px;height:16px;margin:0 var(--sp-2);background:var(--bd)}
/* SectionTitle, the one heading for a part of the page (docs/system/section-title.md).
   Class sect with data-level: group (a small capital label over a list or
   card), panel (a panel's or rail's title, with its icon and count), page (a
   dialog or page header: a tile, a title and a line under it). Actions sit
   at the end in sect-acts. The place sets padding. */
/* ListRow: one line in any list (sidebar, menus, dropdowns, palette, key
   map, contents, versions). Hover and the keyboard cursor share one wash; the
   selected, current or active row takes the accent wash with body text and an
   accent icon. The place sets its own height and padding where it differs
   (docs/system/list-row.md). */
.row{display:flex;align-items:center;gap:var(--row-gap);min-width:0;min-height:var(--row-h);padding:0 var(--row-px);
  border-radius:var(--row-r);font-size:var(--row-fs);color:var(--mt);text-decoration:none;
  transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease)}
.row:hover,.row.kb,.row:focus-visible{background:var(--hover);color:var(--tx)}
.row:is(.active,.on,.selected,[aria-selected="true"],[aria-current="page"]),.row:has(> .active){background:var(--on);color:var(--tx)}
.row:is(.active,.on,.selected,[aria-selected="true"],[aria-current="page"]) svg,.row:has(> .active) svg{color:var(--ac);opacity:1}
/* EmptyState: what a list shows in place of rows while it loads, when it is
   empty, when a filter hides everything, or when it could not be read. Inline
   sits among rows (menus, sidebar, a tree level); the default is centered in
   the space the list would fill (docs/system/empty-state.md). */
.empty{display:flex;flex-direction:column;align-items:center;gap:var(--sp-2);padding:var(--sp-8) var(--sp-5) var(--sp-7);
  text-align:center;color:var(--tx);font-size:var(--fs-md);line-height:1.5}
.empty p{margin:0}
.empty-h{color:var(--dm);font-size:var(--fs-sm)}
.empty-h kbd{font:inherit;font-family:var(--mono);padding:0 var(--sp-2);border:1px solid var(--bd2);border-radius:var(--sp-2)}
.empty-ico{display:inline-grid;place-items:center;width:34px;height:34px;margin-bottom:var(--sp-2);border-radius:50%;background:var(--s2);color:var(--dm)}
.empty-ico svg{width:16px;height:16px}
.empty-a{display:flex;flex-wrap:wrap;justify-content:center;gap:var(--sp-3);margin-top:var(--sp-3)}
.empty[data-inline]{align-items:flex-start;text-align:left;gap:var(--sp-1);padding:var(--sp-3) var(--row-px);font-size:var(--fs-sm)}
.empty[data-inline] .empty-a{justify-content:flex-start;margin-top:var(--sp-2)}
.empty:is([data-inline],[data-state="loading"]) .empty-t{color:var(--dm)}
#fe-empty[hidden]{display:none}
/* Disclosure: the chevron on anything that folds turns right when folded,
   read from aria-expanded on its button or a closed <details> around its
   summary. */
.chev{width:12px;height:12px;flex:none;transition:transform var(--t-fast) var(--ease)}
:is([aria-expanded="false"],details:not([open]) > summary) > .chev{transform:rotate(-90deg)}
.sect{display:flex;align-items:center;gap:var(--sp-3);min-width:0;margin:0}
.sect-tx{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
.sect-acts{display:inline-flex;align-items:center;gap:var(--sp-2);margin-left:auto}
.sect[data-level="group"]{font-size:var(--type-micro);font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--dm)}
.sect[data-level="panel"]{font-size:var(--type-ui);font-weight:600;color:var(--tx)}
.sect[data-level="page"]{gap:var(--sp-5)}
.sect[data-level="page"] .sect-tx > :first-child{margin:0;font-size:var(--fs-xl);font-weight:650;line-height:1.25;color:var(--tx);letter-spacing:-.01em}
.sect[data-level="page"] .sect-tx > :nth-child(2){margin:0;font-size:var(--fs-md);font-style:normal;font-weight:400;line-height:1.35;color:var(--dm)}
/* Panel: a bounded surface with a head, a scrolling body and an optional
   foot, floating over the page or docked into it. Scrim: the dimmed page
   behind a floating panel. (docs/system/panel.md) */
.panel{display:flex;flex-direction:column;min-width:0;min-height:0;overflow:hidden;outline:none;
  background:var(--card);border:1px solid var(--pop-bd);border-radius:var(--pop-r);box-shadow:var(--pop-sh)}
.panel[data-dock]{border:0;border-radius:0;box-shadow:none}
.scrim{position:absolute;inset:0;background:rgb(0 0 0 / .55);backdrop-filter:blur(2px);animation:fe-fade var(--t-base) var(--ease)}
.panel:not([data-dock]){animation:fe-rise var(--t-base) var(--ease)}
/* Card: a bounded group inside a panel or a page. The place sets padding. */
.card{background:var(--card);border:1px solid var(--bd);border-radius:var(--row-r)}
/* Notice, a line that tells the reader about the page itself
   (docs/system/notice.md): empty, cut short, could not render, changed on
   disk. Class notice; data-tone danger, warn or ok; buttons in it act on it. */
.notice{display:flex;align-items:center;flex-wrap:wrap;gap:var(--sp-3);padding:var(--sp-3) var(--sp-5);color:var(--dm);font-size:var(--type-small);line-height:1.4}
.notice[data-tone="danger"]{color:var(--tone-danger)}
.notice[data-tone="warn"]{color:var(--tone-warn)}
.notice[data-tone="ok"]{color:var(--tone-ok)}
/* Resize handle (docs/system/resize.md). Class rz, set by resizable(). A
   thin hit area whose 2px accent line grows in on hover, drag or focus, the
   sidebar's look everywhere. data-axis="xy" is a corner grip, which keeps
   two faint lines at rest so it can be found. */
.rz{flex-shrink:0;cursor:col-resize;user-select:none;touch-action:none;outline:0;
  background:linear-gradient(var(--ac),var(--ac)) center/0 100% no-repeat;transition:background-size var(--t-fast) var(--ease)}
.rz:hover,.rz.drag,.rz:focus-visible{background-size:2px 100%}
.rz[data-axis="xy"]{cursor:nwse-resize;background:linear-gradient(135deg,transparent 50%,var(--bd) 50%,var(--bd) 60%,transparent 60%,transparent 75%,var(--bd) 75%,var(--bd) 85%,transparent 85%)}
.rz[data-axis="xy"]:hover,.rz[data-axis="xy"].drag,.rz[data-axis="xy"]:focus-visible{background:linear-gradient(var(--ac),var(--ac)) right bottom/100% 2px no-repeat,linear-gradient(var(--ac),var(--ac)) right bottom/2px 100% no-repeat}
body.fe-resizing{user-select:none}
table.fe-col-edge,table.fe-col-edge *{cursor:col-resize}
/* TextBox, the one text field (docs/system/textbox.md). Class tb, on an
   input or textarea. data-size: sm 22, md 28 (the default), lg 32. A textarea
   grows from one control high. Invalid: aria-invalid="true". */
.tb{--tb-h:var(--ctl-md);display:block;width:100%;height:var(--tb-h);margin:0;padding:0 var(--sp-4);box-sizing:border-box;
  border:1px solid var(--bd2);border-radius:var(--row-r);background:var(--bg);color:var(--tx);font:inherit;font-size:var(--type-ui);outline:0;
  transition:border-color var(--t-fast) var(--ease)}
.tb[data-size="sm"]{--tb-h:var(--ctl-sm);padding:0 var(--sp-3);font-size:var(--type-small)}
.tb[data-size="lg"]{--tb-h:var(--ctl-lg);padding:0 var(--sp-5)}
textarea.tb{height:auto;min-height:var(--tb-h);padding:var(--sp-3) var(--sp-4);line-height:1.45;resize:vertical}
.tb::placeholder{color:var(--dm)}
.tb:hover{border-color:color-mix(in srgb,var(--mt) 60%,var(--bd2))}
.tb:focus{border-color:var(--ac)}
.tb[aria-invalid="true"]{border-color:var(--tone-danger)}
.tb:disabled{opacity:.45;cursor:default}
.tb[data-mono]{font-family:var(--mono)}
/* A search field shows a magnifier at its start. */
.tb[data-lead="search"]{padding-left:var(--sp-8);background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m20 20-3.5-3.5'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:var(--sp-4) 50%}
@keyframes fe-spin{to{transform:rotate(1turn)}}
html,body{height:100%;background:var(--bg);color:var(--tx);
  font:var(--fs-lg)/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;overflow:hidden}
body{opacity:1!important}
#fe{display:flex;flex-direction:column;height:100vh;background:var(--bg);color:var(--tx)}
#fe-bar{background:var(--s1);border-bottom:1px solid var(--bd);flex-shrink:0}
#fe-bc{display:flex;align-items:center;gap:1px;flex:1;overflow:hidden;white-space:nowrap;min-width:0;align-self:stretch;cursor:text}
#fe-bc[hidden]{display:none}
#fe-bc > *{cursor:default}
#fe-bc-edit{flex:1;min-width:0;display:flex}
#fe-bc-edit input{flex:1;min-width:0}

/* A long folder name (a hash, a generated id) shortens so the path around it stays readable. */
.fe-crumb{color:var(--mt);text-decoration:none;padding:2px 5px;border-radius:4px;
  font-size:var(--fs-md);flex-shrink:0;transition:background .1s,color .1s;
  max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}
.fe-cg{display:inline-flex;align-items:center;flex-shrink:0;min-width:0}
.fe-cg[hidden]{display:none}
.fe-crumb.cur{color:var(--tx);font-weight:500}
/* The current folder and a file name keep their full width while middle
   folders fold; past that they shorten, but never below a readable share. */
.fe-crumb.cur,.fe-crumb-file{flex-shrink:0;max-width:45%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fe-cg:has(.cur){flex-shrink:0;max-width:45%}
.fe-cg:has(.cur) .fe-crumb.cur{max-width:100%}
.fe-crumb-more{flex:none}
#fe-bar .fe-crumb-more[hidden]{display:none}
.fe-crumb:hover{background:var(--hover);color:var(--tx)}
.fe-sep{color:var(--dm);font-size:var(--fs-sm);flex-shrink:0;padding:0 1px}
#fe-bar .fe-crumb-dd{background:none;border:none;color:var(--dm);cursor:pointer;
  padding:0 2px;font-size:var(--fs-xs);border-radius:3px;line-height:1;opacity:0.35;
  transition:opacity .1s,color .1s,background .1s;flex-shrink:0;min-width:0}
#fe-bar .fe-crumb-dd:hover{background:var(--hover);color:var(--ac);opacity:1;border:none}
#fe-bar .fe-crumb-dd svg{display:block}
#fe-crumb-menu{
  position:fixed;z-index:300;
  background:var(--s1);border:1px solid var(--bd);border-radius:var(--r-sm);
  min-width:220px;max-width:340px;max-height:340px;overflow:hidden;
  box-shadow:0 8px 24px #0009;padding:4px 0;
}
#fe-crumb-menu:not([data-layer]){display:none}
.fe-dd-search-wrap{padding:5px 8px 7px;border-bottom:1px solid var(--bd)}
.fe-dd-search{width:100%}

.fe-dd-items{max-height:288px;overflow-y:auto;padding:2px 0}
.fe-dd-item{display:flex;align-items:center;gap:8px;padding:6px 12px;
  color:var(--tx);text-decoration:none;font-size:var(--fs-md);white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis;transition:background .08s}
.fe-dd-item.dir{color:var(--dir)}
.fe-dd-item svg{flex-shrink:0}
#fe-bm-btn.on,#fe-bm-btn.on:hover{color:var(--gold)}
#fe-theme-btn #fe-sun{display:none}
#fe-theme-btn #fe-moon{display:block}
#fe[data-theme="light"] #fe-theme-btn #fe-sun{display:block}
#fe[data-theme="light"] #fe-theme-btn #fe-moon{display:none}
#fe-body{display:flex;flex:1;overflow:hidden}
#fe-side{position:relative;width:272px;flex-shrink:0;background:var(--s1);border-right:1px solid var(--bd);display:flex;flex-direction:column;min-height:0;overflow:hidden}
/* The lens bar sits on top: icons in a row, the open lens grown to show its
   name; the wheel over the bar moves between lenses. The lens fills the rest. */
#fe-rail{flex:none;display:flex;align-items:center;gap:1px;padding:6px 6px;border-bottom:1px solid var(--bd);overflow:hidden}
.fe-rail-btn{flex:0 1 auto;min-width:26px;height:var(--ctl-lg);display:flex;align-items:center;justify-content:center;gap:0;padding:0 5px;border:0;border-radius:8px;background:none;color:var(--mt);cursor:pointer;
  font:inherit;position:relative;z-index:1;transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease)}
.fe-rail-btn[hidden]{display:none}
.fe-rail-btn svg{width:16px;height:16px;flex:none}
.fe-rail-btn em{font-style:normal;font-size:var(--fs-md);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:0;opacity:0}
.fe-rail-btn.on{flex:1 0 auto;gap:6px;padding:0 9px}
.fe-rail-btn.on em{max-width:110px;opacity:1}
/* The open lens's highlight. It sits inside its button, so it always fits it;
   a lens switch slides it over from the old button. */
.fe-rail-hl{position:absolute;inset:0;z-index:-1;border-radius:8px;pointer-events:none;transform-origin:0 0}
.fe-rail-btn.on .fe-rail-hl{background:color-mix(in srgb,var(--ac) 16%,transparent)}
.fe-rail-btn.on:hover .fe-rail-hl{background:color-mix(in srgb,var(--ac) 22%,transparent)}
#fe-rail.tight .fe-rail-btn:not(.on){flex:1 1 0;min-width:22px;padding:0 2px}
#fe-rail.tight .fe-rail-btn.on{padding:0 6px;gap:5px}
#fe-rail.tighter .fe-rail-btn{flex:1 1 0;min-width:22px;padding:0 3px}
#fe-rail.tighter .fe-rail-btn.on{gap:0}
#fe-rail.tighter .fe-rail-btn em{display:none}
.fe-rail-btn:hover{background:var(--hover);color:var(--tx)}
.fe-rail-btn.on,.fe-rail-btn.on:hover{background:none;color:var(--tx)}
.fe-rail-btn:focus-visible{outline:2px solid var(--ac);outline-offset:1px}
#fe-lenses{flex:1;min-width:0;overflow-y:auto;padding:6px 0}
.fe-lens[hidden]{display:none}
.fe-doc-row{display:flex;align-items:center;gap:10px;width:calc(100% - 12px);margin:1px 6px;padding:6px 10px;border:0;border-radius:var(--row-r);background:none;color:var(--tx);font:inherit;text-align:left;cursor:pointer}
.fe-doc-tx{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.3}
.fe-doc-name,.fe-doc-dir{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fe-doc-name{font-size:var(--row-fs)}
.fe-docs-top[hidden]{display:none}
.fe-doc-dir{font-size:var(--fs-sm);color:var(--dm)}
.fe-doc-me{display:inline-flex;color:var(--ac)}
.fe-doc-me svg{width:13px;height:13px}
.fe-doc-due{font-size:var(--fs-sm);color:var(--tx);padding:0 6px;border-radius:999px;background:color-mix(in srgb,var(--nc-orange) 16%,transparent)}
.fe-doc-n{flex:none}
.fe-row-cm{flex:none}
#fe-side-rz{width:10px}
.fe-sec{margin-bottom:4px}
.fe-sec.fe-collapsed>:not(.fe-sh){display:none!important}
.fe-sh{padding:10px 14px 5px}
#fe-side .fe-sh{justify-content:flex-start!important}
.fe-sh-collapse{min-height:24px;min-width:0;display:flex;align-items:center;gap:6px;padding:0;border:0;background:none;color:inherit;cursor:pointer;font:inherit;letter-spacing:inherit;text-transform:inherit;text-align:left}
.fe-sh-collapse:hover{color:var(--tx)}
.fe-si{display:flex;align-items:center;gap:10px;padding:8px 14px;
  color:var(--mt);text-decoration:none;transition:background .1s,color .1s}
button.fe-si{width:100%;border:0;background:none;font:inherit;text-align:left;cursor:pointer}
.fe-rc-ago{font-size:var(--fs-sm);color:var(--dm);flex-shrink:0}
.fe-si svg{flex-shrink:0;opacity:.7;width:19px;height:19px}
.fe-sl{font-size:var(--fs-lg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;flex:1}
.fe-hint{font-size:var(--fs-md);color:var(--dm);padding:6px 14px;font-style:italic;line-height:1.7}
.fe-bm-item{display:flex;align-items:center;gap:0;position:relative;user-select:none}
.fe-drag-h{padding:7px 4px 7px 10px;color:var(--dm);cursor:grab;opacity:0;transition:opacity .1s;flex-shrink:0;display:flex;align-items:center}
.fe-bm-item:hover .fe-drag-h{opacity:1}
.fe-bm-item.dragging{opacity:.4;background:var(--hover)}
.fe-bm-item.drag-over{border-top:2px solid var(--ac)}
.fe-si-link{display:flex;align-items:center;gap:10px;flex:1;padding:7px 6px 7px 4px;
  color:inherit;text-decoration:none;min-width:0;transition:color .1s}
.fe-si-link svg{flex-shrink:0;opacity:.7;width:19px;height:19px}
.fe-rm-btn{opacity:0;flex-shrink:0}
.fe-bm-item:hover .fe-rm-btn{opacity:1}

#fe-lens-filter,#fe-docs-q{display:block;width:calc(100% - 20px);margin:2px 10px 6px}

.fe-pl-label.editing,.fe-pl-tags.editing{outline:1px solid var(--ac);border-radius:3px;background:var(--s2);padding:0 3px;cursor:text}
.fe-sv-tag{gap:7px;padding:8px 14px 3px}
.fe-sv-dot{width:9px;height:9px;border-radius:50%;cursor:pointer;flex-shrink:0;box-shadow:0 0 0 1px #0004}
#fe-lens-filter[hidden],.fe-lens-tags[hidden]{display:none}
.fe-proxy-filter{display:none!important}
.fe-lens-tags{display:flex;flex-wrap:wrap;gap:4px;padding:0 10px 8px}
.fe-grp{margin:4px 8px;background:var(--s2);border-radius:10px;padding:0 0 4px}
.fe-grp:not([open]){padding-bottom:0}
.fe-grp > summary{list-style:none;cursor:pointer;padding:7px 8px 5px}
.fe-grp > summary::-webkit-details-marker{display:none}
.fe-grp-n{margin-left:auto;font-weight:500;color:var(--dm)}
.fe-sv-dot:hover{transform:scale(1.25)}
.fe-pl-dots{display:flex;align-items:center;gap:3px;margin-left:auto;padding-right:2px;flex:none}
.fe-sv-mini{width:6px;height:6px;border-radius:50%;display:inline-block}
.fe-sv-more{font-size:var(--fs-xs);color:var(--dm);line-height:6px}
.fe-pl-tags{display:none;font-size:var(--fs-sm);color:var(--mt);min-width:60px;max-width:110px;white-space:nowrap;overflow:hidden}
.fe-pl-tags.show{display:inline-block}
.fe-tag-btn{opacity:0;flex-shrink:0}
.fe-bm-item:hover .fe-tag-btn{opacity:1}

/* clip, not hidden: focusing a control past the edge must not scroll the pane sideways.
   The pane is a size container so its toolbar wraps by the pane's width, which a
   docked preview can make narrow in a wide window. */
#fe-main{flex:1;display:flex;flex-direction:column;overflow:clip;container:fe-main / inline-size;min-width:0}
#fe-toolbar{background:var(--s2);border-bottom:1px solid var(--bd);flex-shrink:0}
#fe-count{font-size:var(--fs-sm);color:var(--dm);flex:1;white-space:nowrap}
#fe-tb-right{display:flex;align-items:center;gap:4px}
#fe-sg-cur{font-variant-numeric:tabular-nums}
/* One "on" look across the toolbar: the accent tint the chosen view wears. */
/* Detail: a small slider between a big-square and a dense-rows icon, its stop named beside it. */
#fe-density-wrap{display:flex;align-items:center;gap:6px;color:var(--dm)}
.fe-density-end{display:inline-grid;place-items:center}
#fe-density{display:contents}
#fe-density input{order:1;flex:none;width:72px}
#fe-density-wrap .fe-density-end:last-of-type{order:2}
#fe-density output{order:3;min-width:72px;padding:0;background:none;font-family:inherit;font-size:var(--fs-sm);color:var(--mt);text-align:left}
/* One text box for the toolbar filter and the filter bar: the sidebar filter's
   look, with toggles (.*, Aa) as chips inside its right end. */
.fe-in-box{position:relative;display:inline-flex;align-items:center;flex:none}
.fe-in-box input[type="text"]{width:100%;margin:0}

.fe-tb-box{width:170px;margin-left:4px}
.fe-in-name{width:220px}
.fe-in-name input[type="text"]{padding-right:40px!important}
.fe-in-text{width:300px}
.fe-in-text input[type="text"]{padding-right:68px!important}
.fe-in-chips{position:absolute;right:4px;top:50%;transform:translateY(-50%);display:flex;gap:3px}
#fe-sg-panel,#fe-filter-bar{display:flex;flex-direction:column;gap:8px;
  padding:9px 14px;background:var(--s1);border-bottom:1px solid var(--bd);flex-shrink:0}
.fe-panel-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.fe-panel-lbl{min-width:52px;font-size:var(--fs-sm);color:var(--dm);font-weight:500;white-space:nowrap}
.fe-panel-sub{display:inline-flex;align-items:center;gap:8px}
.fe-panel-sub .fe-panel-lbl{min-width:0}
.fe-panel-gap{margin-left:14px}
#fe-filter-bar .fe-dd-btn,#fe-sg-panel .fe-dd-btn{min-width:150px}
#fe-find-depth .fe-dd-btn{min-width:100px}
#fe-find-status{font-size:var(--fs-sm);color:var(--mt);margin-left:4px}
.fe-view .fe-si-link svg{color:var(--ac);opacity:.9}
#fe-scroll{flex:1;overflow-y:auto;transform-origin:top left}
#fe-table{width:100%;border-collapse:collapse;table-layout:fixed}
thead{position:sticky;top:0;z-index:5;background:var(--s2)}
thead th{padding:6px 12px;text-align:left;font-size:var(--fs-sm);font-weight:600;
  text-transform:uppercase;letter-spacing:.07em;color:var(--dm);
  border-bottom:1px solid var(--bd);user-select:none;white-space:nowrap}
thead th{position:relative}
thead th[data-sort]{cursor:pointer}
thead th[data-sort]:hover{color:var(--tx)}
.fe-col-rz{position:absolute;top:0;right:0;width:7px;height:100%}
/* Rendered tables (markdown, CSV/TSV) share the handle; col-resize.ts fixes
   the layout on the first drag so one column moves at a time. */
.fe-md-table th{position:relative}
table.fe-rz-fixed{table-layout:fixed}
.fe-ql-table.fe-rz-fixed th,.fe-ql-table.fe-rz-fixed td{overflow:hidden;text-overflow:ellipsis}
.fe-md-table.fe-rz-fixed td,.fe-md-table.fe-rz-fixed th{overflow-wrap:anywhere}
.si{opacity:.35;font-size:var(--fs-xs)}
th.sorted .si{opacity:1;color:var(--ac)}
.c-nm{width:40%}.c-tp{width:14%}.c-tg{width:14%}.c-sz{width:11%;text-align:right}.c-dt{width:21%}
td.c-tg{white-space:nowrap;overflow:hidden}
/* Named chips give up width (ending in \u2026) before the +N count does. */
.fe-chips{display:flex;gap:var(--sp-2);min-width:0;overflow:hidden}
.fe-chips .chip{flex:0 1 auto;min-width:28px}
.fe-chips .fe-chip-more{flex:none;min-width:0}
.c-match{display:none;text-align:right;width:72px;color:var(--dm)}
#fe.fe-has-find-hits[data-view="details"] .c-match{display:table-cell}
#fe.fe-has-find-hits[data-view="details"] .c-nm{width:42%}
#fe.fe-has-find-hits[data-view="details"] .c-dt{width:19%}
.fe-find-snippet{display:block;color:var(--dm);font-size:var(--fs-sm);margin:3px 0 1px 22px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fe-find-snippet mark{background:var(--ac);color:var(--bg);border-radius:2px;padding:0 1px}
.fe-find-badge{margin-left:22px}
#fe-find-error{color:var(--tone-danger);font-size:var(--type-small)}
#fe[data-view="details"] .fe-row .fe-find-badge{display:none}
tbody tr{border-bottom:1px solid var(--bg);transition:background .08s}
tbody tr:hover{background:var(--hover)}
tbody td{padding:5px 12px;vertical-align:middle}
td.c-sz{text-align:right;white-space:nowrap;color:var(--dm);font-variant-numeric:tabular-nums;font-size:var(--fs-md)}
td.c-dt{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--dm);font-size:var(--fs-md)}
td.c-tp{color:var(--dm);font-size:var(--fs-sm)}
.fe-lnk{display:flex;align-items:center;gap:8px;text-decoration:none;color:var(--tx)}
.fe-lnk svg{flex-shrink:0}
.fe-lnk:hover .fe-nm{color:var(--ac);text-decoration:underline}
.fe-nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dir .fe-nm{color:var(--dir)}
.par td.c-nm .fe-nm{color:var(--dm)}
.par:hover .fe-nm{color:var(--mt)}
.dotfile{opacity:.65}
.fe-group-hdr td{padding:5px 12px;font-size:var(--fs-sm);font-weight:600;
  text-transform:uppercase;letter-spacing:.08em;color:var(--dm);
  background:var(--s2);border-bottom:1px solid var(--bd);border-top:1px solid var(--bd)}
.fe-group-hdr-tile{width:100%;padding:6px 4px 2px;font-size:var(--fs-sm);font-weight:600;
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
.fe-tree-toggle,.fe-tree-spacer{width:20px;height:20px;flex:none}
.fe-tree-toggle{display:flex;align-items:center;justify-content:center;border:0;background:none;color:var(--dm);cursor:pointer;border-radius:4px}
.fe-tree-toggle:hover{background:var(--s2);color:var(--tx)}
.fe-tree-link{display:flex;align-items:center;gap:8px;color:var(--tx);text-decoration:none;min-width:0}
.fe-tree-link svg{flex:none}
.fe-tree-link:hover .fe-nm{text-decoration:underline;color:var(--ac)}
#fe[data-view="tiles"] #fe-tiles,#fe[data-view="icons"] #fe-tiles{display:flex}
.fe-tile{display:flex;flex-direction:column;align-items:center;gap:3px;
  padding:8px 6px 7px;border-radius:var(--r-sm);text-decoration:none;
  color:var(--tx);border:1px solid transparent;transition:all .12s;
  width:96px;overflow:hidden;cursor:pointer;position:relative}
.fe-tile:hover{background:var(--hover);border-color:var(--bd)}
.fe-tile-ic{font-size:0;line-height:0}
.fe-tile-ic svg{display:block}
.fe-tile-nm{font-size:var(--fs-sm);text-align:center;overflow-wrap:anywhere;word-break:normal;max-width:100%;
  overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
  line-height:1.3}
.fe-tile-sz{font-size:var(--fs-xs);color:var(--dm)}
.fe-tile.dir .fe-tile-nm{color:var(--dir)}
.fe-tile.par .fe-tile-nm{color:var(--dm)}
#fe[data-view="tiles"] .fe-tile-ic svg{transform:scale(1.5);margin:4px}
#fe[data-view="icons"] .fe-tile{width:116px;padding:10px 8px 8px;gap:4px}
#fe[data-view="icons"] .fe-tile-ic svg{transform:scale(2);margin:8px 10px 6px}
#fe[data-view="icons"] .fe-tile-nm{font-size:var(--fs-md)}
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
.fe-tile-meta{display:none}

/* Detail levels (data-density 1 to 5, 3 is the standard look). Low numbers
   show fewer, bigger items with names only; high numbers show smaller items
   and add facts: type, date, tags and comments on tiles, columns on lists. */
#fe[data-density="1"][data-view="details"] tbody td{padding:12px 16px}
#fe[data-density="1"][data-view="details"] .fe-lnk{gap:12px;font-size:var(--fs-lg)}
#fe[data-density="1"][data-view="details"] .fe-lnk svg{transform:scale(1.45)}
#fe[data-density="1"][data-view="details"] :is(.c-tp,.c-tg,.c-sz,.c-dt){display:none}
#fe[data-density="1"][data-view="details"] .c-nm{width:100%}
#fe[data-density="2"][data-view="details"] tbody td{padding:9px 14px}
#fe[data-density="2"][data-view="details"] .fe-lnk svg{transform:scale(1.2)}
#fe[data-density="2"][data-view="details"] :is(.c-tp,.c-tg){display:none}
#fe[data-density="2"][data-view="details"] .c-nm{width:60%}
#fe[data-density="4"][data-view="details"] tbody td{padding:3px 12px}
#fe[data-density="5"][data-view="details"] tbody td{padding:1px 10px;font-size:var(--fs-sm)}
#fe[data-density="5"][data-view="details"] .fe-lnk svg{transform:scale(.85)}

#fe[data-density="1"][data-view="list"] tbody td{padding:11px 16px}
#fe[data-density="1"][data-view="list"] .fe-lnk{gap:12px;font-size:var(--fs-lg)}
#fe[data-density="1"][data-view="list"] .fe-lnk svg{transform:scale(1.45)}
#fe[data-density="2"][data-view="list"] tbody td{padding:8px 14px}
#fe[data-density="2"][data-view="list"] .fe-lnk svg{transform:scale(1.2)}
/* List gains columns as detail goes up: size and date, then type too. */
#fe[data-density="4"][data-view="list"] :is(.c-sz,.c-dt),
#fe[data-density="5"][data-view="list"] :is(.c-sz,.c-dt,.c-tp){display:table-cell}
#fe[data-density="4"][data-view="list"] .c-nm,#fe[data-density="5"][data-view="list"] .c-nm{width:auto}
#fe[data-density="4"][data-view="list"] tbody td{padding:3px 12px}
#fe[data-density="5"][data-view="list"] tbody td{padding:1px 10px;font-size:var(--fs-sm)}

#fe[data-density="1"] .fe-tree-row{min-height:42px;font-size:var(--fs-lg)}
#fe[data-density="1"] .fe-tree-link svg{transform:scale(1.4)}
#fe[data-density="2"] .fe-tree-row{min-height:35px}
#fe[data-density="4"] .fe-tree-row{min-height:24px}
#fe[data-density="5"] .fe-tree-row{min-height:20px;font-size:var(--fs-sm)}

/* Tiles and icons: big name-only tiles at 1 and 2; at 4 a type and date line;
   at 5 a card with the icon beside the name, type, size, date, tags, comments. */
#fe[data-density="1"] #fe-tiles,#fe[data-density="2"] #fe-tiles{gap:10px 12px;padding:14px 16px}
#fe[data-density="1"] .fe-tile-sz,#fe[data-density="2"] .fe-tile-sz{display:none}
#fe[data-density="1"][data-view="tiles"] .fe-tile{width:168px;padding:16px 10px 12px;gap:8px}
#fe[data-density="1"][data-view="tiles"] .fe-tile-ic svg{transform:scale(3.2);margin:22px}
#fe[data-density="1"][data-view="icons"] .fe-tile{width:220px;padding:20px 12px 14px;gap:10px}
#fe[data-density="1"][data-view="icons"] .fe-tile-ic svg{transform:scale(4.4);margin:32px}
#fe[data-density="1"] .fe-tile-nm{font-size:var(--fs-lg)}
#fe[data-density="1"][data-view="tiles"] .fe-tile-ic .fe-tile-img-wrap{width:148px;height:112px}
#fe[data-density="1"][data-view="icons"] .fe-tile-ic .fe-tile-img-wrap{width:196px;height:148px}
#fe[data-density="2"][data-view="tiles"] .fe-tile{width:128px;padding:12px 8px 10px;gap:6px}
#fe[data-density="2"][data-view="tiles"] .fe-tile-ic svg{transform:scale(2.3);margin:14px}
#fe[data-density="2"][data-view="icons"] .fe-tile{width:160px;padding:14px 10px 10px;gap:8px}
#fe[data-density="2"][data-view="icons"] .fe-tile-ic svg{transform:scale(3);margin:20px}
#fe[data-density="2"] .fe-tile-nm{font-size:var(--fs-md)}
#fe[data-density="2"][data-view="tiles"] .fe-tile-ic .fe-tile-img-wrap{width:108px;height:84px}
#fe[data-density="2"][data-view="icons"] .fe-tile-ic .fe-tile-img-wrap{width:140px;height:108px}
#fe[data-density="4"] .fe-tile-meta{display:flex;flex-direction:column;align-items:center;gap:1px;max-width:100%;font-size:var(--fs-xs);color:var(--dm)}
#fe[data-density="4"] .fe-tile-meta > span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#fe[data-density="4"] .fe-tile-tags{display:none!important}
#fe[data-density="5"][data-view="tiles"] #fe-tiles{gap:4px 6px}
#fe[data-density="5"][data-view="tiles"] .fe-tile{display:grid;grid-template-columns:auto 1fr;grid-template-rows:auto auto 1fr;column-gap:10px;row-gap:1px;
  align-items:start;justify-items:start;width:250px;padding:8px 10px;text-align:left}
#fe[data-density="5"][data-view="tiles"] .fe-tile-ic{grid-row:1 / span 3;align-self:center}
#fe[data-density="5"][data-view="tiles"] .fe-tile-ic svg{transform:scale(1.6);margin:6px}
#fe[data-density="5"][data-view="tiles"] .fe-tile-ic .fe-tile-img-wrap{width:44px;height:36px}
#fe[data-density="5"][data-view="tiles"] .fe-tile-nm{text-align:left;-webkit-line-clamp:1;font-size:var(--fs-md)}
#fe[data-density="5"][data-view="tiles"] .fe-tile-sz{grid-column:2;font-size:var(--fs-xs)}
#fe[data-density="5"][data-view="tiles"] .fe-tile-meta{grid-column:2;display:flex;flex-wrap:wrap;align-items:center;gap:2px 8px;font-size:var(--fs-xs);color:var(--dm)}
#fe[data-density="5"][data-view="tiles"] .fe-tile-tags{display:flex;align-items:center;gap:4px}
#fe[data-density="5"][data-view="tiles"] .fe-tile-tags .fe-chips{max-width:150px}
/* Icons keep their centred shape at 5: a smaller icon over the name and every fact. */
#fe[data-density="5"][data-view="icons"] .fe-tile{width:112px;padding:8px 6px 7px;gap:3px}
#fe[data-density="5"][data-view="icons"] .fe-tile-ic svg{transform:scale(1.5);margin:5px 8px 4px}
#fe[data-density="5"][data-view="icons"] .fe-tile-ic .fe-tile-img-wrap{width:72px;height:56px}
#fe[data-density="5"][data-view="icons"] .fe-tile-nm{font-size:var(--fs-sm)}
#fe[data-density="5"][data-view="icons"] .fe-tile-meta{display:flex;flex-direction:column;align-items:center;gap:1px;max-width:100%;font-size:var(--fs-xs);color:var(--dm)}
#fe[data-density="5"][data-view="icons"] .fe-tile-meta > span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#fe[data-density="5"][data-view="icons"] .fe-tile-tags{display:flex;justify-content:center;gap:4px}
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
  border-radius:0 0 var(--r-sm) var(--r-sm);
  opacity:0;transition:opacity .14s;pointer-events:none}
.fe-tile:hover .fe-acts{opacity:1;pointer-events:auto}
#fe[data-view="list"] .fe-tile .fe-acts{
  position:absolute;right:6px;top:50%;transform:translateY(-50%);
  background:none;border-radius:0;padding:0;width:auto;left:auto}

.fe-row td.c-nm{position:relative}
#fe-statusbar{background:var(--s1);border-top:1px solid var(--bd);flex-shrink:0;font-size:var(--fs-md);color:var(--mt);white-space:nowrap;overflow:hidden}
#fe-status-meta{display:flex;align-items:center;gap:var(--sp-5)}
.fe-meta-item{display:inline-flex;align-items:center;gap:5px}
.fe-meta-item svg{color:var(--dm)}
.fe-status-grow{flex:1}
#fe-fp-reload{color:var(--green);animation:fe-fade-in var(--t-base) var(--ease)}
#fe-fp-reload[hidden]{display:none}
#fe-fp-reload.off{color:var(--dm)}
@keyframes fe-fade-in{from{opacity:0}to{opacity:1}}
/* The path reads as a link: pointer, accent and underline on hover; a click copies it. */
#fe-status-path{min-width:0;max-width:60%;overflow:hidden;text-overflow:ellipsis;direction:rtl;text-align:left;
  height:22px;padding:0;border:0;background:none;color:var(--mt);font:inherit;cursor:pointer;
  text-decoration:underline transparent;text-underline-offset:3px;transition:color var(--t-fast) var(--ease),text-decoration-color var(--t-fast) var(--ease)}
#fe-status-path:hover{color:var(--ac);text-decoration-color:currentColor}
#fe-tip{
  position:fixed;pointer-events:none;z-index:200;
  background:var(--s2);border:1px solid var(--bd);border-radius:var(--r-sm);
  padding:9px 12px;font-size:var(--fs-md);line-height:1.7;color:var(--tx);
  max-width:380px;overflow-wrap:anywhere;word-break:break-word;
  box-shadow:0 4px 20px #000a;opacity:0;
  transition:opacity .15s ease-out;
}
#fe-tip.show{opacity:1;transition:opacity .18s ease-in .06s}
.tip-header{display:flex;align-items:center;gap:7px;margin-bottom:4px}
.tip-icon{flex-shrink:0;display:flex;align-items:center}
.tip-icon svg{display:block}
.tip-name{font-weight:600;font-size:var(--fs-md);word-break:break-all;color:var(--tx)}
.tip-line{color:var(--mt);font-size:var(--fs-sm);line-height:1.6}
.tip-warn{color:var(--dm);font-size:var(--fs-sm);margin-top:3px;border-top:1px solid var(--bd);padding-top:3px}
#fe-toast{
  position:fixed;bottom:32px;left:50%;transform:translateX(-50%) translateY(6px);
  background:#1f2937;color:#e5e7eb;padding:8px 18px;border-radius:20px;
  font-size:var(--fs-md);opacity:0;transition:all .22s;pointer-events:none;white-space:nowrap;
  border:1px solid #374151;z-index:200
}
#fe-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
/* The label for anything with a title (tooltip.ts); same surface as the row card #fe-tip. */
#fe-hint{position:fixed;top:0;left:0;z-index:300;max-width:320px;pointer-events:none;
  background:var(--s2);color:var(--tx);border:1px solid var(--bd);border-radius:var(--r-sm);
  box-shadow:0 4px 14px #0006;padding:4px 8px;
  font-size:var(--fs-md);line-height:1.4;white-space:pre-line;
  opacity:0;transition:opacity .12s ease-out}
#fe-hint.on{opacity:1}
/* A control's tooltip: icon and title, a lighter line, then its keys. */
#fe-hint.rich{white-space:normal;display:flex;flex-direction:column;gap:var(--sp-1);padding:var(--sp-3) var(--sp-5)}
.fe-hint-h{display:flex;align-items:center;gap:var(--sp-3)}
.fe-hint-h svg{width:1.15em;height:1.15em;flex:none;color:var(--ac)}
.fe-hint-h b{font-weight:600}
.fe-hint-s{color:var(--dm);font-size:var(--fs-xs)}
.fe-hint-k{display:flex;align-items:center;gap:var(--sp-2);margin-top:var(--sp-1)}
.fe-hint-k i{color:var(--dm);font-style:normal;font-size:var(--fs-xs)}
/* A problem on a line: the kind in its tone and the line number, then each
   message at reading size, since the message is the point. */
#fe-hint.problem{border-left:3px solid var(--tone-warn)}
#fe-hint.problem.err{border-left-color:var(--tone-danger)}
#fe-hint.problem .fe-hint-h b{color:var(--tone-warn)}
#fe-hint.problem.err .fe-hint-h b{color:var(--tone-danger)}
.fe-hint-ln{color:var(--dm);font-size:var(--fs-xs);font-variant-numeric:tabular-nums}
#fe-hint.problem .fe-hint-s{color:var(--tx);font-size:var(--fs-sm)}
/* Parts in the top layer (layer.ts) keep their own look and placement, not the
   browser's popover defaults; zero specificity, so every part's own rule wins. */
:where([popover]){inset:auto;margin:0;padding:0;border:0;background:none;color:inherit;width:auto;height:auto;overflow:visible}
@media (prefers-reduced-motion:reduce){#fe-hint{transition:none}}
#fe-toast.act.show{pointer-events:auto}
.fe-toast-act{background:none;border:none;color:#79b8ff;cursor:pointer;font:inherit;padding:0;text-decoration:underline}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--bd);border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:var(--dm)}
#fe.compact tbody td{padding:2px 12px}
#fe.compact .fe-tile{padding:6px 6px 5px;gap:3px}
/* Dialog: Settings and Help. A Panel over a Scrim with the title and the
   tabs down the left and one scrolling pane on the right. Every rule for it
   is here, and in the 700px block at the end (docs/system/dialog.md). */
.fe-dlg{position:fixed;inset:0;z-index:400;display:flex;align-items:center;justify-content:center;container:dlg/inline-size}
/* In the sidebar: the same box fills a pane over the lenses. */
#fe-side-pane{position:absolute;inset:0;display:flex;container:dlg/inline-size;background:var(--side)}
#fe-side-pane[hidden]{display:none}
.fe-dlg-box.panel[data-dock]{width:100%;height:100%;max-height:none}
.fe-dlg-box[data-dock] [id$="-size"]{display:none}
.fe-dlg-box{position:relative;z-index:1;display:grid;grid-template-columns:216px minmax(0,1fr);grid-template-rows:auto minmax(0,1fr);
  width:min(1000px,calc(100vw - 48px));height:min(780px,84vh)}
/* Large and extra large never come out smaller than the panel's own size. */
.fe-dlg-box[data-size="lg"]{width:max(min(1000px,calc(100vw - 48px)),85vw);height:max(min(780px,84vh),90vh)}
#fe-ql-dialog[data-size="lg"]{width:max(min(1100px,calc(100vw - 64px)),85vw);height:max(min(84vh,1000px),90vh)}
.fe-dlg-box[data-size="xl"],#fe-ql-dialog[data-size="xl"]{width:calc(100vw - 32px);height:calc(100vh - 32px)}
.fe-dlg-title{grid-column:1;grid-row:1;padding:18px 16px 10px;align-items:flex-start;background:var(--side);border-right:1px solid var(--bd)}
.fe-dlg-mark{flex:none;width:26px;height:26px;border-radius:8px;display:grid;place-items:center;background:var(--on);color:var(--ac)}
.fe-dlg-acts{position:absolute;top:14px;right:14px;z-index:5;display:flex;gap:var(--sp-2)}
.fe-dlg-tabs{grid-column:1;grid-row:2;display:flex;flex-direction:column;gap:2px;padding:4px 8px 12px;overflow:auto;background:var(--side);border-right:1px solid var(--bd)}
.fe-dlg-tab{display:flex;flex-direction:column;gap:3px;padding:8px 10px;border:0;border-radius:var(--row-r);background:none;color:var(--mt);
  cursor:pointer;text-align:left;line-height:1;transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease)}
.fe-dlg-tab:hover{background:var(--hover);color:var(--tx)}
.fe-dlg-tab.on{background:var(--on);color:var(--tx)}
.fe-dlg-tab-main{display:flex;align-items:center;gap:var(--row-gap);min-width:0}
.fe-dlg-tab b{font-size:var(--row-fs);font-weight:500;color:inherit}
.fe-dlg-tab i{padding-left:calc(22px + var(--row-gap));font-size:var(--fs-sm);font-style:normal;line-height:1.3;color:var(--dm);opacity:.85}
.fe-dlg-tab.on i{opacity:1}
.fe-dlg-tile{flex:none;display:inline-grid;place-items:center;width:22px;height:22px;border-radius:6px;color:#fff;
  background:linear-gradient(165deg,color-mix(in srgb,var(--tone) 88%,#fff),color-mix(in srgb,var(--tone) 80%,#000));
  box-shadow:inset 0 0 0 .5px rgb(255 255 255 / .2),0 1px 2px rgb(0 0 0 / .22)}
.fe-dlg-tile svg{width:13px;height:13px}
.fe-dlg-tile.lg{width:40px;height:40px;border-radius:11px;box-shadow:inset 0 0 0 .5px rgb(255 255 255 / .22),0 4px 12px color-mix(in srgb,var(--tone) 30%,transparent)}
.fe-dlg-tile.lg svg{width:22px;height:22px}
.fe-dlg-pane{grid-column:2;grid-row:1/span 2;display:none;min-height:0;padding:20px 24px 24px;overflow:auto;background:var(--side)}
.fe-dlg-pane.on{display:flex;flex-direction:column;gap:16px}
.fe-dlg-pane:has(> .fe-dlg-ph){padding-top:0}
.fe-dlg-ph{position:sticky;top:0;z-index:3;margin:0 -24px;padding:22px 96px 18px 24px;background:linear-gradient(var(--side) 82%,color-mix(in srgb,var(--side) 0%,transparent))}
.fe-dlg-pane .fe-md{max-width:none;padding:0}
.fe-dlg-pane .fe-md h2{font-size:1.15em;border:0;padding:0}
.fe-dlg-pane .fe-md>:first-child{margin-top:0;padding-right:36px}

.fe-st-input{width:100%}

.fe-st-rule{display:grid;grid-template-columns:16px 22px 1fr 58px 32px 24px;
  gap:6px;align-items:center;padding:5px 2px;border-bottom:1px solid var(--bd)}
.fe-st-rule:last-child{border-bottom:none}
.fe-st-rule input[type="checkbox"]{accent-color:var(--ac);cursor:pointer;width:13px;height:13px}
#fe-st-ai-card{background:var(--s2);border:1px solid var(--bd);border-radius:var(--r-sm);padding:11px 13px}
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
.fe-st-ai-state{font-size:var(--fs-md);font-weight:600;color:var(--tx)}
.fe-st-ai-grid{display:grid;grid-template-columns:auto 1fr;gap:3px 12px;font-size:var(--fs-md)}
.fe-st-ai-grid .k{color:var(--dm)}
.fe-st-ai-grid .v{color:var(--tx);font-family:'SF Mono',Menlo,Consolas,monospace;font-size:var(--fs-sm);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fe-st-ai-grid .v.warm-yes{color:var(--green)}
.fe-st-ai-grid .v.warm-no{color:var(--gold)}
.fe-st-ai-hint{font-size:var(--fs-sm);color:var(--dm);margin-top:8px;line-height:1.5}
.fe-st-ai-hint code{background:var(--bg);border:1px solid var(--bd);border-radius:3px;padding:0 4px;
  font-family:'SF Mono',Menlo,Consolas,monospace;font-size:var(--fs-sm);color:var(--mt)}
#fe-qlook{position:fixed;inset:0;z-index:350;display:flex;align-items:center;justify-content:center}
#fe-ql-dialog{position:relative;z-index:1;width:min(1100px,calc(100vw - 64px));height:min(84vh,1000px);max-width:calc(100vw - 16px);max-height:calc(100vh - 16px)}
#fe-ql-rz{position:absolute;right:0;bottom:0;width:16px;height:16px;z-index:2}
#fe-ql-rz-side{display:none;position:absolute;left:-3px;top:0;width:8px;height:100%;z-index:2}
#fe-qlook.side{position:relative;inset:auto;z-index:1;flex:none;width:420px;max-width:80vw;
  border-left:1px solid var(--bd);align-items:stretch;justify-content:stretch}
#fe-qlook.side #fe-ql-bg,#fe-qlook.side #fe-ql-rz,#fe-qlook.side #fe-ql-size{display:none}
#fe-qlook.side #fe-ql-rz-side{display:block}
#fe-qlook.side #fe-ql-dialog{width:100%;height:100%;max-width:none;max-height:none}
#fe-tabbar{display:flex;align-items:stretch;background:var(--s1);border-bottom:1px solid var(--bd);flex-shrink:0;min-height:34px}
/* The strip takes only the room its tabs need, so + and the path button sit
   right after the last tab; past the bar's width the tabs scroll and the
   buttons stay in view. */
#fe-tabs{display:flex;align-items:stretch;gap:4px;padding:6px 4px 0 6px;flex:0 1 auto;min-width:0;overflow-x:auto;scrollbar-width:none}
#fe-tabs-end{display:flex;align-items:center;gap:2px;padding:4px 8px 0 2px;flex:none}
#fe-goto{position:fixed;z-index:60;width:min(460px,calc(100vw - 16px));padding:8px;border-radius:var(--pop-r);
  background:var(--pop-bg);border:1px solid var(--pop-bd);box-shadow:var(--pop-sh);backdrop-filter:var(--pop-blur);-webkit-backdrop-filter:var(--pop-blur)}
#fe-goto input{width:100%}

.fe-goto-msg{margin:6px 2px 0;font-size:var(--fs-sm);color:var(--dm)}
#fe-tabs::-webkit-scrollbar{display:none}
/* The list of every tab: icon, name, and the digit that jumps to it. */
.fe-tab-menu .fe-ctx-item span:not(.fe-ctx-key){flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fe-tab-menu kbd{font:500 var(--fs-xs) var(--mono);color:var(--dm);padding-left:12px}
.fe-tab.pinned{padding:5px 6px;min-width:0}
.fe-tab.pinned .fe-tab-lbl,.fe-tab.pinned .fe-tab-more{display:none}
#fe-tabs.is-empty{padding-top:4px}
.fe-tab{display:flex;align-items:center;gap:6px;padding:5px 8px 5px 10px;min-height:29px;font-size:var(--fs-md);color:var(--mt);text-decoration:none;
  background:var(--s2);border:1px solid var(--bd);border-bottom:none;border-radius:7px 7px 0 0;white-space:nowrap;max-width:200px;min-width:112px;flex:0 1 auto;position:relative;top:1px;
  transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease)}
.fe-tab:hover{background:var(--s3);color:var(--tx)}
.fe-tab.on{background:var(--bg);color:var(--tx)}
.fe-tab.temp{background:none;border-color:transparent}
.fe-tab.temp.on{background:var(--bg);border-color:var(--bd)}
.fe-tab.temp.on{color:var(--mt)}
.fe-tab.drag-over{border-left:2px solid var(--ac)}
.fe-tab-lbl{display:flex;overflow:hidden;min-width:0}
.fe-tab-head{overflow:hidden;white-space:pre;min-width:0}
.fe-tab-tail{white-space:nowrap;flex-shrink:0}
.fe-tab-x,.fe-tab-more{opacity:0}

.fe-tab:hover .fe-tab-x,.fe-tab.on .fe-tab-x,.fe-tab:hover .fe-tab-more{opacity:1}

/* A tab you are not on gives its name the whole width: its menu and close
   buttons float over the end of the name, and only while it is hovered. */
.fe-tab:not(.on) .fe-tab-x,.fe-tab:not(.on) .fe-tab-more{position:absolute;top:50%;margin-top:calc(var(--btn-h) / -2);background:var(--s3)}
.fe-tab:not(.on) .fe-tab-x:hover,.fe-tab:not(.on) .fe-tab-more:hover{background:var(--bd2)}
.fe-tab:not(.on) .fe-tab-x{right:6px}
.fe-tab:not(.on) .fe-tab-more{right:26px}
.fe-tab:not(.on):not(:hover):not(:focus-within) .fe-tab-x,.fe-tab:not(.on):not(:hover):not(:focus-within) .fe-tab-more{visibility:hidden}

.fe-tab.pinned::before{content:'';width:5px;height:5px;border-radius:50%;background:var(--ac);flex-shrink:0}
.fe-tab-ico{display:flex;flex-shrink:0}
.fe-tab-ico svg{width:11px;height:12px}
.fe-tab-menu{position:fixed}
#fe.fe-file-page #fe-toolbar,#fe.fe-file-page #fe-sg-panel,#fe.fe-file-page #fe-filter-bar,#fe.fe-file-page #fe-scroll{display:none!important}
#fe-fp-bar{background:var(--s2);border-bottom:1px solid var(--bd);flex-shrink:0}
#fe-fp{display:flex;flex:1;min-height:0}
/* Contents and Comments float over the page as a translucent card, shown and
   hidden by the two buttons right of find. The text keeps clear of the card. */
#fe-fp{position:relative}
#fe-toc-rail{position:absolute;top:12px;right:16px;z-index:4;width:240px;max-height:calc(100% - 24px);display:flex;flex-direction:column;min-height:0;
  border:1px solid color-mix(in srgb,var(--bd) 80%,transparent);border-radius:12px;
  background:color-mix(in srgb,var(--card) 80%,transparent);backdrop-filter:blur(14px) saturate(1.2);-webkit-backdrop-filter:blur(14px) saturate(1.2);
  box-shadow:0 8px 24px rgb(0 0 0 / .12),0 1px 3px rgb(0 0 0 / .08);transition:width var(--t-base) var(--ease),border-radius var(--t-base) var(--ease)}
#fe-toc-rail[hidden]{display:none}
#fe-toc-rail.peek{box-shadow:var(--pop-sh)}
.fe-toc-head{display:flex;align-items:center;gap:6px;padding:10px 8px 6px 16px;flex:none}
#fe-toc{flex:1;min-height:0;overflow-y:auto;padding:2px 0 16px}
#fe-toc a{display:block;margin:1px 6px;border-radius:6px;color:var(--mt);text-decoration:none;padding:3px 10px 3px 10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;transition:color var(--t-fast) var(--ease),background var(--t-fast) var(--ease)}
#fe-toc a.fe-toc-h1{font-size:var(--fs-lg);font-weight:600;color:var(--tx)}
#fe-toc a.fe-toc-h2{font-size:var(--fs-md);padding-left:22px}
#fe-toc a.fe-toc-h3{font-size:var(--fs-md);padding-left:34px}
#fe-toc a.fe-toc-h4{font-size:var(--fs-md);padding-left:46px;color:var(--dm)}
/* The rail's two tabs, Contents and Comments. Comments needs more room, so
   the rail and the text column's right padding widen while it shows. */
.fe-rail-title{flex:1}
.fe-rail-ico{display:inline-flex;color:var(--mt)}
.fe-rail-ico svg{width:14px;height:14px}
.fe-rt{border:0;background:none;padding:3px 9px;border-radius:999px;font-size:var(--fs-md);font-weight:500;
  color:var(--mt);cursor:pointer;display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.fe-rt svg{width:13px;height:13px;opacity:.85}
.fe-rt:hover{color:var(--tx);background:var(--hover)}
.fe-rt.on{color:var(--tx);background:var(--on)}
.fe-rt[hidden]{display:none}
#fe-toc-rail[data-tab="cm"]{width:320px}
/* The editor's floating pill moves left of the comments rail instead of covering its tabs. */
#fe-fp:has(#fe-toc-rail[data-tab="cm"]:not([hidden])) #fe-fe-pill{right:352px}
/* The pane buttons right of find: icons only, the comment count as a small badge. */
.fe-fp-panes{display:inline-flex;gap:2px;flex:none}
#fe-fp-bar .fe-fp-panes button[hidden]{display:none}
#fe-fp-cm{position:relative}
#fe-fp-cm-n:empty{display:none}
#fe-fp-cm-n{position:absolute;top:-3px;right:-4px;min-width:14px;padding:0 4px;border-radius:999px;background:var(--ac);color:var(--tx-on-ac);font-size:10px;line-height:14px;text-align:center}
/* Comment threads: a quote, then each comment with who and when, then chips. */
#fe-cm{flex:1;min-height:0;display:flex;flex-direction:column;position:relative}
.fe-cm-top{flex:none;display:flex;align-items:center;gap:4px;padding:0 10px 8px}
.fe-cm-list{flex:1;min-height:0;overflow-y:auto;padding:2px 10px 14px}
#fe-cm[hidden]{display:none}
.fe-cm-filters{flex:1;display:flex;gap:2px;padding:2px;border-radius:10px;background:var(--bg);border:1px solid var(--bd)}
.fe-cm-filters button{flex:1;border:0;background:none;border-radius:8px;padding:3px 4px;font-size:var(--fs-sm);color:var(--mt);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:4px;white-space:nowrap}
.fe-cm-filters button svg{width:11px;height:11px;opacity:.75}
.fe-cm-fn{color:var(--dm)}
.fe-cm-ib{flex:none}

.fe-cm-filters button.on{background:var(--card);color:var(--tx);box-shadow:0 1px 2px rgb(0 0 0 / .18)}
.fe-cm-group{gap:6px;margin:14px 2px 6px;cursor:default}
.fe-cm-group span{font-weight:500;letter-spacing:0}
details.fe-cm-done > summary{cursor:pointer;list-style:none}
details.fe-cm-done > summary::-webkit-details-marker{display:none}
.fe-cm-th{position:relative;margin:0 0 8px;padding:10px 12px;cursor:pointer;
  transition:border-color var(--t-fast) var(--ease),box-shadow var(--t-fast) var(--ease)}
.fe-cm-th:hover{border-color:var(--bd2)}
.fe-cm-th.on{border-color:color-mix(in srgb,var(--ac) 60%,var(--bd));box-shadow:0 0 0 3px color-mix(in srgb,var(--ac) 14%,transparent)}
.fe-cm-th:focus-visible{outline:2px solid var(--ac);outline-offset:2px}
.fe-cm-q{margin:0 0 8px;padding:0 0 0 9px;border-left:2px solid color-mix(in srgb,var(--ac) 55%,transparent);font-size:var(--fs-sm);line-height:1.45;color:var(--mt);
  display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.fe-cm-state{display:flex;align-items:center;gap:5px;margin:-2px 0 8px;font-size:var(--fs-xs);color:color-mix(in srgb,var(--nc-orange) 75%,var(--mt));cursor:default}
.fe-cm-state svg{width:12px;height:12px;flex:none}
.fe-cm-c + .fe-cm-c{margin-top:9px;padding-top:9px;border-top:1px solid color-mix(in srgb,var(--bd) 70%,transparent)}
.fe-cm-who{display:flex;align-items:center;gap:6px;margin-bottom:3px}
.fe-cm-who b{display:inline-flex;align-items:center;gap:4px;font-size:var(--fs-md);font-weight:600;color:var(--tx)}
.fe-cm-who b.agent{color:var(--nc-purple)}
.fe-cm-who b svg{width:12px;height:12px}
.fe-cm-who time{font-size:var(--fs-sm);color:var(--dm)}
.fe-cm-tx{font-size:var(--fs-md);line-height:1.5;color:var(--tx);overflow-wrap:anywhere}
.fe-cm-tx code{font-size:.92em}
.fe-cm-tx p{margin:0}
.fe-cm-tx p + p,.fe-cm-tx ul + p,.fe-cm-tx p + ul{margin-top:.45em}
.fe-cm-tx ul{margin:.15em 0;padding-left:1.15em}
.fe-cm-own{margin-left:auto;display:inline-flex;opacity:0;transition:opacity var(--t-fast) var(--ease)}
.fe-cm-c:hover .fe-cm-own,.fe-cm-own:focus-within{opacity:1}

.fe-cm-c.gone .fe-cm-tx{color:var(--dm)}
.fe-cm-sug{margin-top:6px;font-size:var(--fs-sm);color:var(--mt)}
.fe-cm-diff{display:flex;flex-wrap:wrap;gap:4px;padding:6px 8px;border-radius:var(--row-r);background:var(--shade);line-height:1.5;overflow-wrap:anywhere}
.fe-cm-diff del{background:color-mix(in srgb,var(--nc-red) 14%,transparent);color:var(--mt);padding:0 3px;border-radius:3px}
.fe-cm-sug ins{text-decoration:none;background:color-mix(in srgb,var(--nc-green) 18%,transparent);padding:0 3px;border-radius:3px;color:var(--tx)}
.fe-cm-sug .fe-cm-tools{margin-top:6px}
.fe-cm-sug-state{display:inline-flex;align-items:center;gap:4px;margin-top:4px;font-size:var(--fs-xs);color:var(--dm)}
.fe-cm-sug-state svg{width:12px;height:12px}
.fe-cm-sug.rejected .fe-cm-diff{opacity:.6}
.fe-cm-sug-msg{display:flex;gap:6px;align-items:flex-start;margin:6px 0 0;font-size:var(--fs-sm);color:color-mix(in srgb,var(--nc-orange) 75%,var(--mt));line-height:1.4}
.fe-cm-sug-msg svg{flex:none;width:13px;height:13px;margin-top:2px}
.fe-cm-chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px}
.fe-cm-note{margin:0 2px 8px;font-size:var(--fs-sm);color:var(--dm);line-height:1.4}
.fe-cm-hint{color:var(--dm);font-size:var(--fs-sm)}
.fe-cm-hint kbd{font:inherit;font-family:var(--mono);padding:0 4px;border:1px solid var(--bd2);border-radius:4px}
/* Writing: the composer card, the reply box on the open thread, its tools. */
.fe-cm-new{cursor:default}
.fe-cm-box{margin-top:10px}
.fe-cm-new .fe-cm-box{margin-top:0}
.fe-cm-box textarea{display:block;width:100%;max-height:220px;resize:vertical}

.fe-cm-ac{position:absolute;z-index:10;max-width:calc(100% - 20px);box-sizing:border-box;padding:4px;border-radius:10px;
  background:var(--pop-bg);border:1px solid var(--pop-bd);box-shadow:var(--pop-sh);backdrop-filter:var(--pop-blur);-webkit-backdrop-filter:var(--pop-blur)}
.fe-cm-ac[hidden]{display:none}
.fe-cm-ac > div{padding:4px 8px;border-radius:6px;font-size:var(--fs-md);color:var(--tx);cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fe-cm-ac > div span{color:var(--dm);font-size:var(--fs-sm);margin-left:4px}
.fe-cm-ac > div:hover{background:var(--hover)}
.fe-cm-ac > div.on{background:var(--on)}
.fe-cm-tools{flex-wrap:wrap;margin-top:6px}
.fe-cm-grow{flex:1}
.fe-cm-date{width:auto;color-scheme:light dark}
.fe-cm-x{margin:0 -3px 0 1px}

/* The floating Comment button above a selection on the page. */
#fe-cm-add{position:fixed;z-index:30;height:28px;padding:0 10px;border-radius:999px;color:var(--tx);
  background:var(--pop-bg);border:1px solid var(--pop-bd);box-shadow:var(--pop-sh);backdrop-filter:var(--pop-blur);-webkit-backdrop-filter:var(--pop-blur)}
#fe-cm-add:hover{color:var(--ac)}
#fe-cm-add[hidden]{display:none}
#fe-cm-add svg{width:13px;height:13px}
/* In the editor, a row where an open comment starts carries a mark in the gutter. */
.fe-fe-row.cm .fe-fe-ln{position:relative}
.fe-fe-row.cm .fe-fe-ln::before{content:'';position:absolute;left:6px;top:.55em;width:9px;height:8px;border-radius:3px 3px 3px 0;background:var(--ac);cursor:pointer}
/* In the text: commented words get a wash, the open thread a stronger one,
   and each block with comments a count in the right margin. */
::highlight(bfb-cm){background-color:color-mix(in srgb,var(--ac) 9%,transparent)}
::highlight(bfb-cm-hover){background-color:color-mix(in srgb,var(--ac) 17%,transparent)}
::highlight(bfb-cm-on){background-color:color-mix(in srgb,var(--ac) 24%,transparent)}
#fe-page.fe-cm-pointing{cursor:pointer}
.fe-md [data-cm]{position:relative}
.fe-md [data-cm]::after{content:attr(data-cm);position:absolute;top:2px;right:-30px;min-width:20px;height:18px;padding:0 5px;border-radius:9px 9px 9px 2px;
  background:color-mix(in srgb,var(--ac) 22%,var(--card));color:var(--tx);font-size:var(--fs-xs);font-weight:600;line-height:18px;text-align:center;cursor:pointer}
/* Find in file, at the right end of the file bar. */
#fe-ff{display:inline-flex;align-items:center;gap:4px;height:28px;padding:0 3px 0 9px;border:1px solid var(--bd);border-radius:8px;
  background:color-mix(in srgb,var(--tx) 3%,var(--card));color:var(--dm);transition:border-color var(--t-fast) var(--ease),background var(--t-fast) var(--ease)}
#fe-ff:focus-within{border-color:color-mix(in srgb,var(--ac) 60%,var(--bd));background:var(--card)}
#fe-ff[hidden]{display:none}
#fe-ff-q{width:150px;border:0;outline:0;background:none;color:var(--tx);font:inherit;font-size:var(--fs-md)}
#fe-ff-n{flex:none;width:7.5ch;text-align:right;font-size:var(--fs-sm);color:var(--dm);white-space:nowrap;font-variant-numeric:tabular-nums}
#fe-ff-n.none{color:var(--mt);font-style:italic}
#fe-ff-n.part{text-decoration:underline dotted;text-underline-offset:3px;cursor:help}
mark.fe-ff-hit{background:color-mix(in srgb,var(--gold) 35%,transparent);color:inherit;border-radius:2px}
mark.fe-ff-hit.on{background:var(--gold);color:#0d1117}
#fe-page{flex:1;min-width:0;overflow:auto;font-size:var(--fs-md)}
#fe-page .fe-md{overflow-wrap:break-word;max-width:none;margin:0;padding:28px 48px 80px;font-size:var(--fs-xl);line-height:var(--rd-lh,1.65)}
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
.fe-crumb-file{color:var(--tx);font-weight:500}
#fe-fp-meta{font-size:var(--fs-sm);color:var(--dm);margin-right:auto;white-space:nowrap}
/* A text match sits on its own line under the title, inside the link, so the title keeps its width and the whole row opens the note. */
#fe-nt-list .fe-si-link:has(.fe-nt-hit){flex-wrap:wrap;row-gap:1px}
#fe-nt-list .fe-nt-hit{flex:1 0 100%;min-width:0;padding:0 0 2px 24px;font-size:var(--fs-sm);color:var(--dm);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* Editing in place: coloured, numbered source in the reading column. The
   painted copy (#fe-fe-paint) and the textarea share font, padding and
   wrapping exactly, so the caret sits over its own text. */
#fe-fe{flex:1;min-width:0;display:flex;flex-direction:column;min-height:0;position:relative}
#fe-fe-banner{border-bottom:1px solid var(--bd);background:var(--s1)}
#fe-fe-scroll{flex:1;min-height:0;overflow:auto;cursor:text}
/* The top padding clears the floating pill, so a long first line is never under it. */
#fe-fe-col{max-width:980px;margin:0 auto;padding:62px 28px 120px}
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
/* Large files: no wrapping, so every row is one line tall and only a window
   of rows is painted (#fe-fe-win, moved down to where the viewport is). */
.fe-fe-big #fe-fe-paint,.fe-fe-big #fe-fe-ta{white-space:pre;overflow-wrap:normal}
#fe-fe-win{will-change:transform}
#fe-fe-view{padding:0;max-width:none}
#fe-fe-pill{position:absolute;top:12px;right:18px;z-index:5;display:flex;align-items:center;gap:2px;padding:3px;
  background:var(--s1);border:1px solid var(--bd);border-radius:999px;box-shadow:0 6px 20px rgb(0 0 0 / .25)}
#fe-fe-state{display:inline-flex;align-items:center;gap:5px;padding:0 8px 0 10px;font-size:var(--fs-md);color:var(--mt);
  transition:color var(--t-fast) var(--ease)}
#fe-fe-state.saved{color:var(--green)}
#fe-fe-state.failed{color:var(--nc-red)}
#fe-fe-state.failed .fe-fe-dot{background:var(--nc-red)}
#fe-fe-state svg{width:13px;height:13px}
.fe-fe-dot{width:6px;height:6px;border-radius:50%;background:var(--ac)}
#fe-allow{position:fixed;z-index:320;width:340px;padding:14px;background:var(--s1);border:1px solid var(--bd2);border-radius:10px;
  box-shadow:0 12px 32px rgb(0 0 0 / .3);animation:fe-pop var(--t-base) var(--ease)}
#fe-allow p{color:var(--mt);font-size:var(--fs-md);margin:6px 0 12px;line-height:1.5}
#fe-allow code{font:var(--fs-md) var(--mono);background:var(--s2);padding:1px 4px;border-radius:4px;overflow-wrap:anywhere}
.fe-allow-title{display:flex;align-items:center;gap:8px;font-weight:600}
.fe-allow-acts{display:flex;gap:6px;justify-content:flex-end}
#fe-allow.fe-allow-note{border-color:color-mix(in srgb,var(--nc-red) 50%,var(--bd2))}
#fe-fp-edit.busy{opacity:.6;cursor:progress}
@keyframes fe-pop{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){#fe-allow{animation:none}}
#fe-fp-reload{font-size:var(--fs-sm);color:var(--dm)}
#fe-ed-bar{border-bottom:1px solid var(--bd);background:var(--s2);flex-shrink:0;flex-wrap:wrap}
.fe-ed-hint{flex:1 1 0;min-width:0;text-align:right;overflow:hidden;text-overflow:ellipsis;font-size:var(--fs-sm);color:var(--dm);white-space:nowrap}
#fe-ed-hist{display:flex;flex-direction:column;gap:2px;padding:6px 10px;border-bottom:1px solid var(--bd);background:var(--s2);max-height:180px;overflow:auto;flex-shrink:0;font-size:var(--fs-sm);color:var(--dm)}
.fe-hist-row{display:grid;grid-template-columns:minmax(120px,160px) 1fr auto;gap:10px;align-items:baseline;text-align:left;background:none;border:1px solid transparent;border-radius:5px;padding:3px 6px;color:var(--tx);cursor:pointer;font:inherit}
.fe-hist-row code{color:var(--dm)}
.fe-hist-head{display:flex;gap:8px;align-items:center;padding:8px 12px;border-bottom:1px solid var(--bd);color:var(--dm);font-size:var(--fs-sm)}
#fe-ql-body.fe-editing{display:flex;flex-direction:column}
.fe-ed{display:flex;flex:1;min-height:0}
.fe-md img{max-width:100%;border-radius:6px}
#fe-ed-src{flex:1;min-width:0;resize:none;border:none;border-right:1px solid var(--bd);background:var(--s1);color:var(--tx);
  font:var(--fs-md)/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;padding:14px 16px;outline:none;tab-size:2}
#fe-ed-view{flex:1;min-width:0;overflow:auto}
#fe-qlook.side .fe-ed{flex-direction:column}
#fe-qlook.side #fe-ed-src{border-right:none;border-bottom:1px solid var(--bd);min-height:40%}
#fe-ed-conflict{display:flex;align-items:center;gap:8px;padding:8px 14px;border-bottom:1px solid var(--bd)}
#fe-ed-meta{display:flex;align-items:center;gap:6px;padding:7px 10px;border-bottom:1px solid var(--bd);background:var(--s1);flex-shrink:0;flex-wrap:wrap}
.fe-chip-title{flex:1 1 180px;min-width:120px;font-weight:600}
button.fe-chip-title{display:flex;align-items:center;gap:6px;text-align:left;cursor:text;min-width:0}
button.fe-chip-title:hover{border-color:var(--ac)}
button.fe-chip-title svg{flex:none;width:12px;height:12px;color:var(--dm)}
textarea.fe-chip-title{flex:1 1 100%;resize:none;overflow:hidden;line-height:1.35;min-height:28px}
.fe-cdot{flex:none}
.fe-pmenu{position:fixed;z-index:2147483000;width:250px;background:var(--s1);border:1px solid var(--bd);border-radius:8px;padding:8px;box-shadow:0 8px 24px rgba(0,0,0,.35);display:flex;flex-direction:column;gap:6px}
.fe-pmenu .btn{justify-content:flex-start}
.fe-pm-lbl{font-size:var(--fs-sm);color:var(--mt);text-transform:uppercase;letter-spacing:.04em}
.fe-pm-colors{display:grid;grid-template-columns:1fr 1fr;gap:4px}
.fe-pm-tags{display:flex;flex-wrap:wrap;gap:4px}
.fe-pm-add{display:flex;gap:4px}
.fe-pm-add input{flex:1;min-width:0}

.fe-nt-main{display:flex;flex-direction:column;min-width:0;flex:1 1 0;gap:1px}
.fe-mid{display:flex;min-width:0;max-width:100%;overflow:hidden}
.fe-mid-h{overflow:hidden;text-overflow:ellipsis;white-space:pre;min-width:0}
.fe-mid-t{white-space:pre;flex:none}
.fe-nt-label{flex:none;display:flex;min-width:0;white-space:nowrap;overflow:hidden;line-height:1.3}
.fe-nt-label.editing{display:block;white-space:normal;overflow:visible;overflow-wrap:anywhere}
.fe-nt-item .fe-nt-acts{position:absolute;right:0;top:50%;transform:translateY(-50%);display:flex;align-items:center;
  background:var(--hover);border-radius:4px;opacity:0;pointer-events:none;transition:opacity .1s}
.fe-nt-item:hover .fe-nt-acts,.fe-nt-item:focus-within .fe-nt-acts{opacity:1;pointer-events:auto}
.fe-nt-tags{font-size:var(--fs-sm);color:var(--mt);display:flex;gap:6px;flex-wrap:wrap}
.fe-nt-tags span{display:inline-flex;align-items:center;gap:3px}
.fe-nt-tags svg{width:10px;height:10px;flex:none}
.fe-nt-flags{display:inline-flex;align-items:center;gap:4px;flex:none}
.fe-nt-flags svg{width:12px;height:12px}
.fe-nt-pin{color:var(--gold)}
.fe-nt-props{opacity:0;flex:none}
.fe-nt-item:hover .fe-nt-props,.fe-nt-props:focus-visible{opacity:1}

.fe-nt-item .fe-si-link{padding-left:14px}
.fe-nt-tab{opacity:0;flex:none}
.fe-nt-item:hover .fe-nt-tab,.fe-nt-tab:focus-visible{opacity:1}

.fe-sh a{color:inherit;text-decoration:none}
.fe-sh a:hover{color:var(--ac)}
#fe-ql-hdr{border-bottom:1px solid var(--bd);flex-shrink:0}
#fe-ql-icon svg{display:block}
/* Docked, the header keeps its name readable and its close button inside the panel: buttons go icon-only. */
#fe-qlook.side #fe-ql-hdr > button > span,#fe-qlook.side #fe-ql-hdr > a:not(#fe-ql-name) > span{display:none}

/* Docked, the header's labelled buttons lose their labels and become icon circles. */
#fe-qlook.side #fe-ql-hdr > *{flex-shrink:0}
#fe-qlook.side #fe-ql-name,#fe-qlook.side #fe-ql-meta{flex-shrink:1;min-width:0}
#fe-qlook.side #fe-ed-bar > button > span{display:none}
#fe-qlook.side .fe-ed-hint{display:none}
#fe-ql-name{font-weight:600;font-size:var(--fs-lg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:inherit;text-decoration:none}
#fe-ql-name:hover{color:var(--ac);text-decoration:underline}
#fe-ql-meta{font-size:var(--fs-sm);color:var(--dm);flex:1;white-space:nowrap;min-width:0;overflow:hidden;text-overflow:ellipsis}
#fe-ql-name{min-width:0;flex-shrink:1}
#fe-ql-body{flex:1;overflow:auto;font-size:var(--fs-md)}
#fe-ql-body:has(> .fe-ql-htmlbar){display:flex;flex-direction:column}
.fe-ql-htmlbar{border-bottom:1px solid var(--bd);flex:none}
.fe-ql-html{flex:1;min-height:0;width:100%;border:0;background:#fff}
/* The preview panel reads at the same reader sizes as the file page; dialogs keep the base size. */
#fe-ql-body .fe-md{font-size:var(--fs-xl);line-height:var(--rd-lh,1.65)}
#fe-ql-ai{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:7px 14px;
  border-bottom:1px solid var(--bd);background:var(--s2);flex-shrink:0}
#fe-ql-ai-chip{display:flex;align-items:center;gap:5px;font-size:var(--fs-sm);color:var(--dm);
  margin-right:4px;white-space:nowrap}
#fe-ql-ai-chip .dot{width:7px;height:7px;border-radius:50%;background:var(--dm);flex-shrink:0}
#fe-ql-ai-chip.ready .dot{background:var(--green)}
#fe-ql-ai-chip.cold .dot{background:var(--gold)}
#fe-ql-ai-chip.down .dot{background:#f85149}
#fe-ql-ai-q{flex:1;min-width:140px}

#fe-ql-ai-q:disabled{opacity:.45}

#fe-ql-ai-out{border-bottom:1px solid var(--bd);max-height:42%;overflow-y:auto;flex-shrink:0;background:var(--s1)}
#fe-ql-ai-out-body{padding:10px 16px 4px;font-size:var(--fs-md);line-height:1.6;white-space:pre-wrap}
#fe-ql-ai-out-body .fe-md{padding:0;white-space:normal}
#fe-ql-ai-out-meta{padding:2px 16px 8px;font-size:var(--fs-xs);color:var(--dm)}
.fe-ql-center{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:10px}
.fe-ql-imgwrap{display:flex;flex-direction:column;height:100%}
.fe-ql-imgbar{border-bottom:1px solid var(--bd);background:var(--s2);flex-shrink:0;flex-wrap:wrap}
.fe-ql-imgstage{flex:1;min-height:0;overflow:auto;display:flex}
.fe-ql-imgsizer{position:relative;margin:auto;flex:none}
.fe-ql-img{position:absolute;left:50%;top:50%;max-width:none;max-height:none;border-radius:4px;transform-origin:center}
.fe-ql-imgwrap .fe-ql-dim{padding:4px 12px;border-top:1px solid var(--bd);text-align:center;flex-shrink:0}
.fe-ql-dim{font-size:var(--fs-sm);color:var(--dm);font-variant-numeric:tabular-nums}
.fe-ql-pdf{width:100%;height:100%;border:none}
.fe-ql-media-wrap{display:flex;align-items:center;justify-content:center;height:100%;padding:16px}
.fe-ql-media{max-width:100%;max-height:100%;border-radius:4px;background:#000}
.fe-ql-center audio{width:min(480px,90%)}
.fe-ql-font{padding:20px 26px;overflow:auto;line-height:1.5}
.fe-ql-font>div{margin:6px 0;word-break:break-word;border-bottom:1px solid var(--s2);padding-bottom:6px}
.fe-code-wrap{font:var(--fs-md)/1.55 'SF Mono',Menlo,Consolas,monospace;min-height:100%}
.fe-code{padding:10px 14px 14px 0;width:max-content;min-width:100%}
.fe-cl-blk{content-visibility:auto;contain-intrinsic-size:auto calc(var(--n) * 1.55em)}
.fe-cl{display:grid;grid-template-columns:calc(var(--gut,4ch) + 22px) minmax(0,1fr)}
.fe-cl-n{position:sticky;left:0;padding:0 10px 0 12px;text-align:right;color:var(--dm);user-select:none;background:var(--card)}
.fe-cl-t{white-space:pre;padding-left:10px}
/* Wrap (Settings, and the file bar toggle): long lines fold inside the page. */
#fe[data-wrap="on"] .fe-code{width:auto}
#fe[data-wrap="on"] .fe-cl-t{white-space:pre-wrap;overflow-wrap:anywhere}
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
.fe-ql-table{border-collapse:collapse;width:100%;font:var(--fs-md) 'SF Mono',Menlo,Consolas,monospace}
.fe-ql-table th{position:sticky;top:0;background:var(--s2);padding:6px 10px;text-align:left;
  border-bottom:1px solid var(--bd);cursor:pointer;white-space:nowrap;color:var(--mt);font-weight:600;z-index:1}
.fe-ql-table th:hover{color:var(--tx)}
.fe-ql-table th.sorted{color:var(--ac)}
.fe-ql-table td{padding:4px 10px;border-bottom:1px solid var(--s2);white-space:pre;
  max-width:340px;overflow:hidden;text-overflow:ellipsis}
.fe-ql-table th.num,.fe-ql-table td.num{text-align:right;font-variant-numeric:tabular-nums}
.fe-ql-table tbody tr:hover{background:var(--hover)}
.fe-jt-root,.fe-jl-root{padding:10px 14px;font:var(--fs-md)/1.6 'SF Mono',Menlo,Consolas,monospace}
.fe-jt summary,.fe-jl-line summary{cursor:pointer;list-style:none}
.fe-jt summary::-webkit-details-marker,.fe-jl-line summary::-webkit-details-marker{display:none}
.fe-jt summary svg,.fe-jl-line summary svg{color:var(--dm);vertical-align:-2px}
.fe-jt summary svg{margin-right:4px}
.fe-jt summary:hover{background:var(--hover)}
.fe-jt-kids{padding-left:16px;border-left:1px solid var(--s3);margin-left:4px}
.fe-jt-key{color:#79c0ff}
#fe[data-theme="light"] .fe-jt-key{color:#0550ae}
.fe-jt-colon{color:var(--dm)}
.fe-jt-badge{color:var(--dm);font-size:var(--fs-sm)}
.fe-jt-row{padding-left:12px}
.fe-jl-line{border-bottom:1px solid var(--s2);padding:2px 0}
.fe-jl-line summary{display:flex;gap:8px;align-items:baseline}
.fe-jl-n{color:var(--dm);min-width:28px;text-align:right;user-select:none;font-size:var(--fs-sm);flex-shrink:0}
.fe-jl-prev{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--mt)}
.fe-jl-line.bad{display:flex;gap:8px;align-items:baseline}
.fe-jl-err{color:#f85149;font-size:var(--fs-xs);border:1px solid #f8514940;border-radius:3px;padding:0 4px;flex-shrink:0}
.fe-md{padding:14px 22px 20px;font-size:var(--fs-lg);line-height:1.65;max-width:760px;color:var(--tx)}
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
.fe-md-code{border:1px solid var(--bd);border-radius:8px;background:color-mix(in srgb,var(--card),var(--tx) 3.5%);overflow:hidden}
.fe-md-code-bar{justify-content:space-between;padding:4px 6px 0 12px;background:none}
.fe-md-lang{font:600 var(--fs-sm)/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--dm)}
.fe-md-pre{background:var(--s1);border:1px solid var(--bd);border-radius:6px;padding:.75em 1em;
  overflow-x:auto;font-family:var(--mono);font-size:.86em;line-height:1.55;white-space:pre;color:var(--tx)}
.fe-md-code .fe-md-pre{border:none;border-radius:0;margin:0;padding-top:.4em;background:none}
.fe-md-code{background:color-mix(in srgb,var(--s1),#000 6%)}
.fe-md-lines{counter-reset:ln;padding-left:.2em}
.fe-md-l{display:block;width:max-content;min-width:100%;box-sizing:border-box;padding-right:1em;border-radius:3px;counter-increment:ln}
.fe-md-l::before{content:counter(ln);display:inline-block;width:2.2em;margin-right:1em;text-align:right;color:var(--dm);opacity:.6;user-select:none}
.fe-md-l:hover{background:color-mix(in srgb,var(--tx) 6%,transparent)}
.fe-md-mermaid{padding:14px;border:1px solid var(--bd);border-radius:6px;
  background:var(--s1);overflow-x:auto;text-align:center}
.fe-md-mermaid svg{display:block;max-width:100%;height:auto;margin:auto}
.fe-md-mermaid-source[hidden]{display:none}
.fe-md-mermaid-source{margin:8px 0 0;padding:10px;text-align:left;white-space:pre-wrap;
  background:var(--s2);border-radius:4px;font:var(--fs-md)/1.55 var(--mono)}
.fe-md-anchor{margin-left:8px;color:var(--dm);font-weight:400;text-decoration:none;opacity:0;transition:opacity var(--t-fast)}
.fe-md-anchor::before{content:'#'}
.fe-md h1:hover .fe-md-anchor,.fe-md h2:hover .fe-md-anchor,.fe-md h3:hover .fe-md-anchor,.fe-md h4:hover .fe-md-anchor,.fe-md h5:hover .fe-md-anchor,.fe-md h6:hover .fe-md-anchor{opacity:1}
.fe-md-fm{display:grid;grid-template-columns:max-content 1fr;gap:3px 14px;padding:10px 14px;background:var(--s1);border:1px solid var(--bd);border-radius:6px;font-size:var(--fs-md)}
.fe-md-fm dt{color:var(--dm);font-weight:600}
.fe-md-fm dd{margin:0;color:var(--tx)}
.fe-md-fm-warn{grid-column:1/-1;display:flex;flex-direction:column;align-items:flex-start;gap:var(--sp-1);margin-top:var(--sp-2);padding:var(--sp-2) 0 0;border-top:1px solid var(--bd)}
.fe-md-fm-note{font-size:var(--fs-sm);color:var(--dm)}
.fe-fm-items{display:flex;flex-wrap:wrap;gap:var(--sp-1) var(--sp-3)}
a.fe-fm-path{color:var(--ac);text-decoration:none}
a.fe-fm-path:hover{text-decoration:underline}
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
.fe-md-table thead{position:static;background:none}
.fe-md-table thead th{background:color-mix(in srgb,var(--s1),var(--tx) 5%);font-weight:600;font-size:inherit;letter-spacing:0;text-transform:none;color:var(--tx);
  white-space:normal;user-select:text;padding:.55em .9em}
#fe-ctx,.fe-ctx{position:fixed;z-index:360;background:var(--s1);border:1px solid var(--bd);border-radius:var(--r-sm);
  min-width:180px;box-shadow:0 8px 24px #0009;padding:4px 0}
.fe-ctx:not([data-layer]){display:none}
.fe-ctx-item{display:flex;align-items:center;gap:8px;padding:6px 12px;color:var(--tx);
  font-size:var(--fs-md);cursor:pointer;white-space:nowrap}
.fe-ctx-key{margin-left:auto;color:var(--dm);font-size:var(--fs-xs);padding-left:16px}
.fe-ctx-sep{height:1px;background:var(--bd);margin:4px 0}
.fe-tab-ico svg{width:15px;height:16px}
.fe-tab-x,.fe-tab-more{opacity:.6}
.fe-tab:focus-visible,.fe-tab-x:focus-visible,.fe-tab-more:focus-visible{outline:2px solid var(--mt);outline-offset:-2px}
@media (max-width:900px){
  #fe-side{width:clamp(200px,26vw,240px)}
  #fe-toc-rail{width:clamp(150px,22vw,190px)}
  #fe-ff-q{width:110px}
  #fe-page .fe-md{padding:20px 18px 60px}
  #fe-fp-bar{flex-wrap:wrap}
}
@container fe-main (max-width:760px){
  #fe-toolbar{flex-wrap:wrap}
  #fe-count{flex-basis:100%}
  #fe-tb-right{width:100%;flex-wrap:wrap;justify-content:flex-start}
}
/* Soft (design-system.md): the sidebar, the main pane and a docked preview
   float as cards on the page background; rows are 36px with no lines, and
   selection is a wash with rounded ends, never a ring. The sidebar's resize
   handle is the 10px gutter between cards and shows a thin line on hover. */
#fe-body{padding:10px;background:var(--bg)}
#fe-side,#fe-main,#fe-qlook.side{border:1px solid var(--bd);border-radius:12px;overflow:hidden}
/* The page is the lightest surface, the sidebar one step below it, and the
   page background the deepest; bars inside the page share its colour and are
   set apart by a hairline, not a grey band. */
#fe-side{background:var(--side)}
#fe-main,#fe-toolbar,#fe-fp-bar,#fe-statusbar,thead{background:var(--card)}
#fe-tabbar,#fe-tabs{background:var(--side)}
.fe-tab.on{background:var(--card)}
#fe-qlook.side{margin-left:10px}
#fe-table{border-collapse:separate;border-spacing:0}
#fe-table tbody tr{border-bottom:0}
#fe-table tbody tr:hover{background:none}
#fe-table tbody tr:hover td{background:var(--hover)}
#fe-table tbody tr.selected td{background:var(--on)}
#fe-table tbody td{height:36px}
#fe.compact #fe-table tbody td{height:28px}
/* Row height per detail level; it wins over Compact, which only sets level 3. */
#fe[data-density="1"] #fe-table tbody td{height:52px}
#fe[data-density="2"] #fe-table tbody td{height:44px}
#fe[data-density="4"] #fe-table tbody td{height:28px}
#fe[data-density="5"] #fe-table tbody td{height:23px}
#fe-table tbody td:first-child{border-radius:8px 0 0 8px}
#fe-table tbody td:last-child{border-radius:0 8px 8px 0}
#fe-scroll{padding:0 6px}
.fe-row.selected .fe-nm{color:var(--tx)}
.fe-tile.selected{background:var(--on);border-color:transparent}

/* One row and one floating surface. Every list row (Places, Saved, Notes,
   History, the path menu, context menus) shares a height, inset, corner,
   icon size, text size and hover wash; in the sidebar a row sits 6px in from
   the card edge, in a menu the menu's own 6px padding gives the same inset.
   Every popover, menu, tip and the Contents card share one surface. Notes
   rows grow to fit a tag line but keep the inset and corners. */
:root{--fs-xs:calc(10px * var(--ui-text-scale,1));--fs-sm:calc(11px * var(--ui-text-scale,1));--fs-md:calc(12px * var(--ui-text-scale,1));--fs-lg:calc(13px * var(--ui-text-scale,1));--fs-xl:calc(15px * var(--ui-text-scale,1));--row-h:32px;--row-r:8px;--row-px:10px;--row-gap:10px;--row-ic:16px;--row-fs:var(--fs-lg);
  --pop-r:12px;--pop-pad:6px;--pop-bg:color-mix(in srgb,var(--card) 90%,transparent);--pop-bd:var(--bd2);
  --pop-sh:0 12px 32px rgb(0 0 0 / .34),0 1px 3px rgb(0 0 0 / .2);--pop-blur:blur(16px) saturate(1.2)}
#fe[data-theme="light"],html:has(#fe[data-theme="light"]){--pop-bg:color-mix(in srgb,var(--card) 94%,transparent);--pop-bd:var(--bd);
  --pop-sh:0 10px 28px rgb(16 24 32 / .12),0 1px 3px rgb(16 24 32 / .08)}
/* The component system's scales (docs/plan/component-system.md, sections 4
   and 5). Declared on #fe too, so tokens built from palette colours pick up
   the light theme's values rather than the root's. */
:root,#fe{
  --sp-1:2px;--sp-2:4px;--sp-3:6px;--sp-4:8px;--sp-5:12px;--sp-6:16px;--sp-7:20px;--sp-8:24px;--sp-9:32px;
  --ctl-xs:18px;--ctl-sm:22px;--ctl-md:28px;--ctl-lg:32px;--bar-h:40px;
  --r-xs:4px;--r-full:999px;
  --z-sticky:5;--z-panel:30;--z-popover:300;--z-overlay:400;--z-command:500;--z-toast:600;--z-tip:700;--z-step:10;
  --tone-ok:var(--nc-green);--tone-warn:var(--nc-orange);--tone-danger:var(--nc-red);--tone-info:var(--nc-blue);
  --type-micro:var(--fs-sm);--type-small:var(--fs-md);--type-ui:var(--fs-lg);--type-ui-strong:var(--fs-lg);--type-title:var(--fs-xl)}
@media (prefers-reduced-motion:reduce){:root,#fe{--t-fast:0ms;--t-base:0ms;--t-slow:0ms}}
.fe-si,.fe-bm-item,.fe-dd-item,.fe-ctx-item{min-height:var(--row-h);margin:0 6px;padding:0 var(--row-px);gap:var(--row-gap);
  border-radius:var(--row-r);font-size:var(--row-fs);transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease)}
.fe-dd-item,.fe-ctx-item{margin:0}
button.fe-si{width:auto;display:flex}
.fe-si > svg,.fe-si-link > svg,.fe-dd-item > svg,.fe-ctx-item > svg{width:var(--row-ic);height:var(--row-ic);flex:none}
.fe-sl{font-size:var(--row-fs)}
.fe-si-link{padding:0;gap:var(--row-gap);min-height:var(--row-h)}
.fe-nt-item .fe-si-link{padding:6px 0}
.fe-pl-item .fe-drag-h{position:absolute;left:-7px;top:0;bottom:0;padding:0;width:8px;justify-content:center}

/* A note row's actions float over the end of the title on a solid fade, so
   nothing moves under the pointer on hover. In a narrow sidebar only delete
   shows; colour and open-in-tab stay in the right-click menu. */
.fe-nt-item .fe-nt-acts{right:4px;border-radius:0 var(--row-r) var(--row-r) 0;padding-left:14px;
  --fade:var(--hover);background:linear-gradient(to right,transparent,var(--fade) 14px),linear-gradient(to right,transparent,var(--side) 14px)}
.fe-nt-item:has(> .fe-si-link.active) .fe-nt-acts{--fade:var(--on)}
.fe-nt-item:has(.editing) .fe-nt-acts{display:none}

#fe-lenses{container:lens/inline-size}
@container lens (max-width:200px){.fe-nt-props,.fe-nt-tab{display:none!important}}
/* A tag group is a plain section: one header row (chevron, colour, name,
   count) at the row inset, and its rows exactly like every other row. */
.fe-grp{margin:6px 0 0;padding:0;background:none;border-radius:0}
.fe-grp:not([open]){padding:0}
.fe-grp .fe-bm-item{margin:0 6px}
.fe-grp > summary{min-height:28px;margin:0 6px;padding:0 var(--row-px);border-radius:var(--row-r);gap:8px;
  font-size:var(--fs-sm);letter-spacing:.06em;transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease)}
.fe-grp > summary:hover{background:var(--hover);color:var(--tx)}
.fe-grp > summary svg{width:12px;height:12px;opacity:.8}
.fe-sh{padding:10px 16px 4px}
.fe-hint{padding:6px 16px}
#fe-lens-filter,#fe-docs-q{width:calc(100% - 12px);margin:2px 6px 8px}
.fe-lens-tags{padding:0 6px 8px}
/* Saved and Notes: the lens's own buttons, icon only, left of one search
   box that carries a Names/Deep switch; the tag chips scroll in a row below. */
.fe-lens-tools{padding:2px 6px 8px}
.fe-lens-ib{flex:none}

a.fe-lens-ib:not([href]){opacity:.45;pointer-events:none}
.fe-lens-box{position:relative;flex:1;min-width:0;margin-left:4px}
.fe-lens-box #fe-lens-filter{width:100%;margin:0;padding-right:64px}
.fe-lens-depth{position:absolute;right:4px;top:50%;transform:translateY(-50%)}
#fe-lens-tags{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none}
#fe-lens-tags .fe-lens-tag{flex:none;white-space:nowrap}
/* A saved row is one quiet line: the name, then a tag count that gives way to
   the row's icon buttons on hover. Path and tags live in the hover card. */
.fe-pl-meta{display:inline-flex;align-items:center;gap:2px;margin-left:auto;padding-right:2px;flex:none;font-size:var(--fs-xs);color:var(--dm)}
.fe-pl-meta svg{width:11px!important;height:11px!important;opacity:1}
.fe-pl-item:hover .fe-pl-meta,.fe-pl-item:focus-within .fe-pl-meta{display:none}
.fe-pl-item .fe-tag-btn,.fe-pl-item .fe-rm-btn{display:none;opacity:1}

.fe-pl-item:has(.fe-pl-hit){flex-wrap:wrap}
.fe-pl-hit{flex-basis:100%;padding:0 0 5px 29px;margin-top:-4px;font-size:var(--fs-sm);color:var(--dm);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#fe-sv-card{position:fixed;z-index:60;pointer-events:none;width:230px;padding:8px 10px;display:flex;flex-direction:column;gap:4px;border:1px solid var(--pop-bd);border-radius:10px;
  background:var(--pop-bg);box-shadow:var(--pop-sh);backdrop-filter:var(--pop-blur);-webkit-backdrop-filter:var(--pop-blur);font-size:var(--fs-sm);color:var(--mt);line-height:1.45;animation:fe-rise var(--t-fast) var(--ease)}
#fe-sv-card[hidden]{display:none}
#fe-sv-card b{color:var(--tx);font-size:var(--fs-md);font-weight:600;overflow-wrap:anywhere}
.fe-svc-path{overflow-wrap:anywhere}
.fe-svc-tags{display:flex;flex-wrap:wrap;gap:4px;padding-top:2px}
.fe-svc-hint{color:var(--dm);font-size:var(--fs-xs)}
/* A note row: a colour bar and tinted icon for a coloured note, the title with
   its tags as small chips beneath, and the pin in the end slot until hover. */
.fe-nt-item.coloured::before{content:'';position:absolute;left:0;top:7px;bottom:7px;width:3px;border-radius:2px;background:var(--c)}
.fe-nt-item.coloured .fe-si-link > svg{color:var(--c);opacity:1}
.fe-nt-item.two .fe-si-link{align-items:flex-start}
.fe-nt-item.two .fe-si-link > svg{margin-top:1px}
.fe-nt-main{gap:4px}
.fe-nt-tags{gap:4px;flex-wrap:nowrap;overflow:hidden}
.fe-nt-tag{display:inline-flex;align-items:center;gap:4px;height:17px;padding:0 6px;border:1px solid var(--bd2);border-radius:999px;font-size:var(--fs-xs);color:var(--mt);white-space:nowrap;flex:none}
.fe-nt-tag i{width:6px;height:6px;border-radius:50%;flex:none}
.fe-nt-item .fe-nt-pin{display:inline-flex;margin-left:auto;padding-right:4px;color:var(--gold);flex:none}
.fe-nt-item .fe-nt-pin svg{width:12px!important;height:12px!important;opacity:1}
.fe-nt-item:hover .fe-nt-pin,.fe-nt-item:focus-within .fe-nt-pin{visibility:hidden}

.fe-nt-grp{gap:7px;width:calc(100% - 12px);height:26px;margin:8px 6px 2px;padding:0 var(--row-px);border:0;border-radius:var(--row-r);background:none;cursor:pointer;
  font-family:inherit;text-align:left}
.fe-nt-grp:first-child{margin-top:0}
.fe-nt-grp:hover{background:var(--hover);color:var(--tx)}
.fe-nt-grp .fe-grp-n{letter-spacing:0}
.fe-nt-grp-pin{display:inline-flex;color:var(--gold)}
.fe-nt-grp-pin svg{width:12px;height:12px}
#fe-crumb-menu,#fe-ctx,.fe-ctx,.fe-pmenu,#fe-tip,#fe-hint,#fe-allow,#fe-toc-rail,#fe-fe-pill,#fe-toast{
  background:var(--pop-bg);border:1px solid var(--pop-bd);box-shadow:var(--pop-sh);
  backdrop-filter:var(--pop-blur);-webkit-backdrop-filter:var(--pop-blur);color:var(--tx)}
#fe-crumb-menu,#fe-ctx,.fe-ctx,.fe-pmenu,#fe-tip,#fe-allow,#fe-toc-rail{border-radius:var(--pop-r)}
#fe-crumb-menu,#fe-ctx,.fe-ctx{padding:var(--pop-pad)}
#fe-hint{border-radius:var(--row-r);padding:5px 10px}
.fe-dd-search-wrap{padding:0 0 6px;margin-bottom:4px}

.fe-dd-items{padding:0}
.fe-ctx-sep{margin:4px 4px}
.fe-toast-act{color:var(--ac)}
/* Contents is a quiet card, with a faint rail per heading level so the
   hierarchy reads at a glance. */
#fe-toc-rail{box-shadow:0 1px 2px rgb(0 0 0 / .05),0 4px 14px rgb(0 0 0 / .06)}
#fe-toc a{margin:0 6px;position:relative}
#fe-toc a.fe-toc-h2,#fe-toc a.fe-toc-h3,#fe-toc a.fe-toc-h4{--rail:color-mix(in srgb,var(--bd2) 55%,transparent)}
#fe-toc a.fe-toc-h2::before,#fe-toc a.fe-toc-h3::before,#fe-toc a.fe-toc-h4::before{content:'';position:absolute;inset:0 auto 0 0;width:44px;pointer-events:none;
  background:linear-gradient(var(--rail),var(--rail)) 13px 0/1px 100% no-repeat}
#fe-toc a.fe-toc-h3::before,#fe-toc a.fe-toc-h4::before{background:linear-gradient(var(--rail),var(--rail)) 13px 0/1px 100% no-repeat,linear-gradient(var(--rail),var(--rail)) 25px 0/1px 100% no-repeat}
#fe-toc a.fe-toc-h4::before{background:linear-gradient(var(--rail),var(--rail)) 13px 0/1px 100% no-repeat,linear-gradient(var(--rail),var(--rail)) 25px 0/1px 100% no-repeat,linear-gradient(var(--rail),var(--rail)) 37px 0/1px 100% no-repeat}

/* Motion. Things that appear fade and settle from a few pixels away; a
   folded group's body eases its height; the lens that takes over the
   sidebar slides in from the side it was picked on. One duration family
   (--t-fast, --t-base) and one ease. Reduced motion snaps everything. */
@keyframes fe-rise{from{opacity:0;transform:translateY(-4px) scale(.985)}to{opacity:1;transform:none}}
@keyframes fe-fade{from{opacity:0}to{opacity:1}}
@keyframes fe-lens-in{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:none}}
@keyframes fe-dock-in{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:none}}
#fe-crumb-menu,#fe-ctx,.fe-ctx,.fe-pmenu{animation:fe-rise var(--t-fast) var(--ease);transform-origin:top left}
.fe-lens:not([hidden]){animation:fe-lens-in var(--t-base) var(--ease)}
#fe-qlook.side{animation:fe-dock-in var(--t-base) var(--ease)}
.fe-sh-collapse svg{transition:transform var(--t-fast) var(--ease)}
/* Settings and Help read as a page: the title across the top, the sections
   listed on the left the way the sidebar lists lenses, the pane on the right.
   In Settings each row names the setting, says what it changes and keeps its
   control on the right; rows sit in cards by subject. */
.fe-set-h{justify-content:space-between;min-height:40px;padding:8px 16px 4px}
.fe-set{display:flex;align-items:center;gap:16px;min-height:52px;padding:8px 16px;border-top:1px solid color-mix(in srgb,var(--bd) 70%,transparent)}
.fe-set-h + .fe-set{border-top:0}
.fe-set-tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.fe-set-l{font-size:var(--row-fs);color:var(--tx)}
.fe-set-d{font-size:var(--fs-md);color:var(--dm);line-height:1.35}
.fe-set-c{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex:none;max-width:62%}
.fe-set-c .fe-st-input{width:260px;max-width:100%}
.fe-set-note{padding:2px 16px 10px;font-size:var(--fs-md);color:var(--dm);line-height:1.5}
.fe-set-note:empty{display:none}
.fe-set-card #fe-st-rules-list{margin:0 16px}
.fe-set-danger{color:var(--nc-red)}

.fe-switch{appearance:none;-webkit-appearance:none;position:relative;flex:none;width:34px;height:20px;margin:0;border-radius:10px;
  background:var(--s3);cursor:pointer;transition:background var(--t-fast) var(--ease)}
.fe-switch::after{content:'';position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;
  box-shadow:0 1px 2px rgb(0 0 0 / .3);transition:transform var(--t-fast) var(--ease),background var(--t-fast) var(--ease)}
.fe-switch:checked{background:var(--ac)}
.fe-switch:checked::after{transform:translateX(14px);background:var(--tx-on-ac)}
.fe-switch:focus-visible{outline:2px solid var(--ac);outline-offset:2px}
.fe-set-sws{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}
.fe-set-sw{position:relative;display:flex;flex-direction:column;align-items:center;gap:5px;padding:6px 8px;border-radius:10px;cursor:pointer;
  font-size:var(--fs-md);color:var(--mt);transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease)}
.fe-set-sw:hover{background:var(--hover)}
.fe-set-sw:has(input:checked){background:var(--on);color:var(--tx)}
.fe-set-sw input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}
.fe-set-sw-chip{width:40px;height:26px;border-radius:7px;background:linear-gradient(135deg,var(--b) 55%,var(--a) 55%);box-shadow:inset 0 0 0 1px var(--bd2)}
/* Editing: the reading width applies to Raw and Rich; Split gives each side
   half the pane and its own scroll. Problems mark their row in the gutter. */
#fe-fe-col{max-width:none}
#fe.fe-column-xl #fe-fe-col{max-width:150ch}
#fe.fe-column-lg #fe-fe-col{max-width:130ch}
#fe.fe-column-md #fe-fe-col{max-width:110ch}
[data-mode="split"] #fe-fe-scroll{overflow:hidden}
#fe [data-mode="split"] #fe-fe-col{max-width:none;height:100%;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);padding:0}
/* Spacing on the text side is border, not padding: the typing layer is placed
   against the padding box, so padding would shift it off the painted text. */
[data-mode="split"] #fe-fe-src{overflow:auto;padding:0 20px 120px 0;border-top:24px solid transparent;border-left:12px solid transparent}
[data-mode="split"] #fe-fe-view{overflow:auto;padding:60px 28px 120px;border-left:1px solid var(--bd)}
#fe-fe-diag[hidden]{display:none}
.fe-fe-rich{padding:0}
[data-mode="rich"] #fe-fe-view,[data-mode="split"] #fe-fe-view{animation:fe-fade var(--t-base) var(--ease)}
.fe-html-frame{display:block;width:100%;height:calc(100vh - 210px);min-height:320px;border:1px solid var(--bd);border-radius:8px;background:#fff}
.fe-yaml-sep{border:0;border-top:1px dashed var(--bd);margin:12px 0}
.fe-fe-row.err,.fe-cl.err{background:color-mix(in srgb,var(--nc-red) 8%,transparent)}
.fe-fe-row.warn,.fe-cl.warn{background:color-mix(in srgb,var(--nc-orange) 7%,transparent)}
.fe-fe-row.err .fe-fe-ln,.fe-cl.err .fe-cl-n{color:var(--nc-red);font-weight:600}
.fe-fe-row.warn .fe-fe-ln,.fe-cl.warn .fe-cl-n{color:var(--nc-orange);font-weight:600}
.fe-fe-row.err .fe-fe-code,.fe-cl.err .fe-cl-t{text-decoration:underline wavy color-mix(in srgb,var(--nc-red) 70%,transparent);text-underline-offset:3px}
.fe-cl.flash{background:var(--on);transition:background 1s var(--ease)}
.fe-fe-modes,.fe-fe-modes .fe-seg-b{border-radius:var(--r-full)}
#fe-fe-pill .fe-fe-diag{border-radius:999px;padding:0 10px;font-size:var(--fs-md)}
.fe-fe-diag.error{color:var(--nc-red)}
.fe-fe-diag.warn{color:var(--nc-orange)}
.fe-diag{margin:0 0 14px;font-size:var(--fs-md)}
.fe-diag > summary{cursor:pointer;padding:8px 12px;font-weight:600;list-style:none}
.fe-diag.error > summary{color:var(--nc-red)}
.fe-diag.warn > summary{color:var(--nc-orange)}
.fe-diag-row{display:flex;gap:10px;width:100%;padding:5px 12px;border:0;background:none;color:var(--mt);font:inherit;text-align:left;cursor:pointer;border-top:1px solid color-mix(in srgb,var(--bd) 70%,transparent)}
.fe-diag-row:hover{background:var(--hover);color:var(--tx)}
.fe-diag-ln{flex:none;min-width:3ch;text-align:right;font-family:var(--mono);color:var(--dm)}
.fe-diag-row.error .fe-diag-ln{color:var(--nc-red)}
.fe-diag-row.warn .fe-diag-ln{color:var(--nc-orange)}
.fe-diag-more{display:block;padding:5px 12px 8px;color:var(--dm)}
#fe-page > .fe-diag{margin:16px 48px 0}
/* Search and Ask lenses: a form at the row inset, results as ordinary rows. */
.fe-tl-form{display:flex;flex-direction:column;gap:6px;margin:2px 6px 8px}
.fe-tl-input{width:100%;resize:vertical}

.fe-tl-opts{display:flex;gap:12px;padding:0 4px}
.fe-srch-hit{align-items:flex-start;padding-top:6px;padding-bottom:6px}
.fe-srch-hit > svg{margin-top:1px}
.fe-srch-tx{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
.fe-srch-snip{font-size:var(--fs-md);color:var(--dm);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fe-srch-snip mark{background:color-mix(in srgb,var(--ac) 28%,transparent);color:var(--tx);border-radius:3px;padding:0 1px}
/* Ask: a top row (model chip, new chat, history), the chat, and a composer
   pinned to the bottom of the lens. */
#fe-lens-ask:not([hidden]){display:flex;flex-direction:column;min-height:100%}
#fe-ask{flex:1;display:flex;flex-direction:column}
.fe-ask-top{position:relative;display:flex;align-items:center;gap:2px;margin:0 10px 8px 14px}
.fe-ask-sp{flex:1}
.fe-ask-model{position:relative;display:inline-flex;min-width:0;max-width:100%}
.fe-ask-model > .dot{position:absolute;left:10px;top:50%;margin-top:-3.5px;pointer-events:none}
.fe-ask-model .fe-dd-btn{min-width:0;max-width:190px;padding-left:var(--sp-8)}
.fe-ask-model .dot,.fe-ask-status .dot{width:7px;height:7px;border-radius:50%;flex:none;background:var(--dm)}
.dot.ready{background:var(--green)}
.dot.cold{background:var(--gold)}
.dot.down,.dot.unavailable{background:var(--nc-red)}
.fe-ask-ib{position:relative}

.fe-ask-n{position:absolute;top:1px;right:0}
.fe-ask-status{display:flex;align-items:center;gap:8px;margin:0 16px 8px;font-size:var(--fs-sm);line-height:1.4;color:var(--mt)}
.fe-ask-status[hidden]{display:none}
.fe-ask-cloud{display:flex;align-items:center;gap:6px;margin:0 16px 8px;font-size:var(--fs-sm);color:var(--mt)}
.fe-ask-cloud[hidden]{display:none}
.fe-ask-cloud svg{width:12px;height:12px;flex:none;color:var(--gold)}
#fe-ask-thread{display:flex;flex-direction:column;gap:14px;padding:4px 12px 12px 14px}
.fe-ask-turn{display:flex;flex-direction:column;gap:6px}
.fe-ask-q{align-self:flex-end;max-width:88%;padding:6px 10px;border-radius:12px 12px 4px 12px;background:color-mix(in srgb,var(--ac) 16%,transparent);color:var(--tx);font-size:var(--fs-md);line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}
.fe-ask-a.fe-md{padding:0;font-size:var(--fs-md);line-height:1.55;max-width:none}
/* renderMarkdown wraps its output in its own .fe-md, which must not pad again. */
.fe-ask-a .fe-md{padding:0;font-size:inherit;max-width:none}
.fe-ask-wait{color:var(--dm)}
.fe-ask-meta{font-size:var(--fs-xs);color:var(--dm)}
.fe-ask-meta:empty{display:none}
.fe-ask-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:16px;color:var(--dm);font-size:var(--fs-md);text-align:center}
.fe-ask-empty[hidden]{display:none}
.fe-ask-empty p{margin:0}
.fe-ask-quick{display:flex;flex-wrap:wrap;justify-content:center;gap:6px}
.fe-ask-form{position:sticky;bottom:0;margin-top:auto;padding:8px 10px 10px;background:linear-gradient(to bottom,transparent,var(--side) 14px)}
.fe-ask-box{display:flex;flex-direction:column;gap:4px;padding:8px 8px 6px 10px;border:1px solid var(--bd2);border-radius:14px;background:var(--bg);transition:border-color var(--t-fast) var(--ease)}
.fe-ask-box:focus-within{border-color:var(--ac)}
#fe-ask-q{width:100%;min-height:22px;max-height:140px;padding:0;border:0;outline:0;resize:none;background:none;color:var(--tx);font:inherit;font-size:var(--fs-md);line-height:1.45}
#fe-ask-q::placeholder{color:var(--dm)}
.fe-ask-foot{display:flex;align-items:center;gap:8px}
.fe-ask-ctx{flex:1;min-width:0;display:inline-flex;align-items:center;gap:4px;font-size:var(--fs-xs);color:var(--dm)}
.fe-ask-ctx span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fe-ask-ctx svg{width:11px;height:11px;flex:none}
.fe-ask-send{flex:none}

.fe-ask-send.stop svg{display:none}
.fe-ask-send.stop::before{content:'';width:9px;height:9px;border-radius:2px;background:currentColor}
.fe-ask-hist{position:absolute;right:0;top:32px;z-index:20;width:240px;max-height:320px;overflow-y:auto;padding:4px;border:1px solid var(--pop-bd,var(--bd2));border-radius:10px;background:var(--pop-bg,var(--s2));box-shadow:var(--pop-sh);backdrop-filter:var(--pop-blur);-webkit-backdrop-filter:var(--pop-blur)}
.fe-ask-hist[hidden]{display:none}
.fe-ask-h{display:flex;align-items:center;border-radius:var(--row-r)}
.fe-ask-h-open{flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:1px;padding:6px 8px;border:0;background:none;color:var(--tx);font:inherit;text-align:left;cursor:pointer}
.fe-ask-h-t{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:var(--fs-md)}
.fe-ask-h-m{font-size:var(--fs-xs);color:var(--dm)}
.fe-ask-h-del{opacity:0}
.fe-ask-h:hover .fe-ask-h-del,.fe-ask-h-del:focus-visible{opacity:1}
/* Review fixes: Settings follows the page order (panel a step below, cards
   on top), fields share one look, path chevrons show on hover only, and
   the palette swatch previews the theme in use. */

#fe-bar .fe-crumb-dd{opacity:1;color:var(--dm);padding:3px 1px}
#fe-bar .fe-crumb-dd:hover{color:var(--tx)}
#fe-statusbar{min-width:0;overflow:hidden;white-space:nowrap}
#fe[data-theme="light"] .fe-set-sw:nth-child(1) .fe-set-sw-chip{--b:#eaf0f2;--a:#0e8f8a}
#fe[data-theme="light"] .fe-set-sw:nth-child(2) .fe-set-sw-chip{--b:#f0f0f5;--a:#6d4aff}
#fe[data-theme="light"] .fe-set-sw:nth-child(3) .fe-set-sw-chip{--b:#f2ece4;--a:#c2406b}
#fe[data-theme="light"] .fe-set-sw:nth-child(4) .fe-set-sw-chip{--b:#f0f0f0;--a:#141414}
/* Settings and Help as a desktop settings window: the title and the tabs
   down the left, each tab a coloured tile; each page opens with a header
   (large tile, title, what the page covers) that stays put while the page
   scrolls; sections are small headings over grouped cards. Hierarchy comes
   from weight, colour, case and space, inside the five-step type scale. */


.fe-set-group{display:flex;flex-direction:column;gap:8px}
.fe-set-group > .fe-set-h{min-height:22px;padding:0 4px 0 6px}
.fe-set-card{overflow:hidden}
.fe-set-card > .fe-set:first-child{border-top:0}
.fe-set-card > .fe-set-note:first-child{padding-top:12px}
.fe-set-card #fe-st-reset-rules{margin:10px 16px 12px}
#fe-st-ai-card{background:none;border:0;border-radius:0;padding:14px 16px}
/* Theme and palette pickers: a small window drawn in the colours each one
   picks. Palette windows follow the current mode; mode windows show both. */
.fe-set-sws{gap:6px}
.fe-set-sw{gap:6px;padding:6px}
.fe-set-thumb{position:relative;display:block;width:68px;height:46px;border-radius:8px;overflow:hidden;background:var(--b);
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--t) 14%,transparent),0 1px 3px rgb(0 0 0 / .18);
  --t:#fff;--c:color-mix(in srgb,var(--b) 78%,#000);transition:box-shadow var(--t-fast) var(--ease)}
.fe-set-thumb i{position:absolute;display:block}
.fe-set-thumb .sb{left:0;top:0;bottom:0;width:18px;background:var(--c)}
.fe-set-thumb .r1,.fe-set-thumb .r2{left:25px;height:4px;border-radius:2px;background:var(--t);opacity:.42}
.fe-set-thumb .r1{top:11px;width:32px}
.fe-set-thumb .r2{top:20px;width:22px;opacity:.26}
.fe-set-thumb .pill{left:25px;bottom:9px;width:20px;height:7px;border-radius:4px;background:var(--a)}
.fe-set-sw:has(input:checked) .fe-set-thumb{box-shadow:0 0 0 2px var(--ac),0 1px 3px rgb(0 0 0 / .18)}
.fe-set-sw:has(.fe-set-thumb):has(input:checked){background:none}
.fe-set-sw:has(.fe-set-thumb):hover{background:none}
.fe-set-sw:has(.fe-set-thumb):hover .fe-set-thumb{box-shadow:0 0 0 2px color-mix(in srgb,var(--ac) 45%,transparent),0 1px 3px rgb(0 0 0 / .18)}
.fe-set-sw:has(.fe-set-thumb):has(input:checked):hover .fe-set-thumb{box-shadow:0 0 0 2px var(--ac),0 1px 3px rgb(0 0 0 / .18)}
.fe-set-sw:has(input:focus-visible) .fe-set-thumb{outline:2px solid var(--ac);outline-offset:3px}
.fe-set-thumb[data-p="slate"]{--a:#3cc6c0;--b:#1c2328}
.fe-set-thumb[data-p="violet"]{--a:#9d7cff;--b:#1f1f27}
.fe-set-thumb[data-p="sand"]{--a:#e8789a;--b:#24201c}
.fe-set-thumb[data-p="ink"]{--a:#f2f2f3;--b:#1b1b1d}
#fe[data-theme="light"] .fe-set-thumb[data-p]{--t:#000;--c:color-mix(in srgb,var(--b) 90%,#000)}
#fe[data-theme="light"] .fe-set-thumb[data-p="slate"]{--a:#0e8f8a;--b:#eef3f5}
#fe[data-theme="light"] .fe-set-thumb[data-p="violet"]{--a:#6d4aff;--b:#f3f3f8}
#fe[data-theme="light"] .fe-set-thumb[data-p="sand"]{--a:#c2406b;--b:#f5efe7}
#fe[data-theme="light"] .fe-set-thumb[data-p="ink"]{--a:#141414;--b:#f4f4f4}
#fe .fe-set-thumb[data-mode="dark"]{--a:var(--ac);--b:#1c2328;--t:#fff;--c:#131a1e}
#fe .fe-set-thumb[data-mode="light"]{--a:var(--ac);--b:#f4f6f8;--t:#000;--c:#e2e7eb}
/* Very narrow: the sidebar shrinks to its rail and a picked lens floats over
   the page; the path bar keeps its last folder in view. */
@media (max-width:520px){
  #fe #fe-side{width:54px!important;max-width:none;overflow:visible;position:relative;z-index:30;flex-direction:row}
  #fe-rail{flex-direction:column;padding:8px 0;border-bottom:0}
  .fe-rail-btn.on{flex-grow:0}
  .fe-rail-btn em{display:none}
  #fe-side-rz{display:none}
  #fe-lenses{display:none}
  #fe-side.open #fe-lenses{display:block;position:absolute;top:0;bottom:0;left:58px;width:min(260px,calc(100vw - 80px));
    background:var(--side);border:1px solid var(--pop-bd);border-radius:12px;box-shadow:var(--pop-sh);animation:fe-lens-in var(--t-base) var(--ease)}
  #fe-rail{border-right:0}
  #fe-bc{justify-content:flex-end}
}
@container fe-main (max-width:480px){
  #fe-page .fe-md{padding:16px 14px 48px}
  #fe-page .fe-md h1{font-size:1.45em}
  #fe-page > .fe-diag{margin:12px 14px 0}
}
#fe-table tbody tr.fe-spacer td{padding:0;border:0;background:none!important}
.fe-st-ai-head.down .dot,.fe-st-ai-head.off .dot{background:var(--nc-red)}
@media (prefers-reduced-motion:reduce){
  #fe *,#fe *::before,#fe *::after{animation-duration:1ms!important;animation-iteration-count:1!important;transition-duration:1ms!important}
}

/* Narrow windows keep the reading column usable: the listing drops its
   lesser columns, Contents gives way to the text, and the sidebar is held
   to a share of the width (max-width beats a dragged inline width). */
@container fe-main (max-width:560px){
  .c-tp,.c-tg{display:none}
}
@container fe-main (max-width:400px){
  .c-dt{display:none}
}
/* A narrow window keeps the card out of the text until it is asked for;
   then it floats over the right side (the peek state, set in file-page.ts). */
@media (max-width:760px){
  #fe-toc-rail:not(.peek){display:none}
  #fe-toc-rail.peek{width:min(300px,calc(100% - 24px));right:12px}
}
@media (max-width:640px){
  #fe-side{max-width:42vw}
  #fe-side{width:clamp(180px,30vw,220px)}
  #fe-body{padding:6px}
  #fe-side-rz{width:6px}
  #fe-qlook.side{margin-left:6px}
}
/* A narrow dialog, in a small window or in the sidebar: the tabs run across the top. */
@container dlg (max-width:700px){
  .fe-dlg-box{grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto minmax(0,1fr)}
  .fe-dlg-title{border-right:0}
  .fe-dlg-tabs{grid-row:2;flex-direction:row;border-right:0;border-bottom:1px solid var(--bd)}
  .fe-dlg-tab{flex:none}
  .fe-dlg-tab i{display:none}
  .fe-dlg-pane{grid-column:1;grid-row:3}
  /* Settings rows stack: the label, then the control the full width. Written
     one step more specific than the wide rules in styles-ui.ts, which come later. */
  .fe-set-card .fe-set{flex-direction:column;align-items:stretch;gap:var(--sp-4)}
  .fe-set > .fe-set-c{max-width:none;justify-content:flex-start}
  .fe-set-c .fe-set-sws.grid4{grid-template-columns:repeat(auto-fill,minmax(68px,1fr));justify-content:start}
  .fe-set-c .fe-set-sws{width:100%;justify-content:flex-start}
  /* Help: one column of cards; the page header needs no room for the buttons. */
  .fe-dlg-pane .fe-hcs{grid-template-columns:minmax(0,1fr)}
  .fe-dlg-ph{padding-right:var(--sp-8)}
  .fe-km-g .fe-km-i{flex-wrap:wrap;padding-block:var(--sp-2)}
  .fe-km-i .fe-km-k{flex-wrap:wrap;margin-left:auto}
}
`;

  // src/styles-ui.ts
  var UI_CSS = `
/* Palettes beyond the first four: dark tokens, then light. */
#fe[data-palette="ocean"],html:has(#fe[data-palette="ocean"]){
  --bg:#0d1219;--s1:#131a24;--s2:#19222f;--s3:#222d3d;--bd:#222c3a;--bd2:#313e50;--tx:#e6edf5;--mt:#a1b0c2;--dm:#7d8ca0;--ac:#4da3ff;--tx-on-ac:#0d1219;--dir:#a1b0c2}
#fe[data-palette="ocean"][data-theme="light"],html:has(#fe[data-palette="ocean"][data-theme="light"]){
  --bg:#eef3f9;--s1:#ffffff;--s2:#e9eff7;--s3:#dbe5f1;--bd:#d9e2ee;--bd2:#c2cfdf;--tx:#152030;--mt:#4b5d75;--dm:#687a92;--ac:#1f6fd1;--tx-on-ac:#ffffff;--dir:#5b6d85}
#fe[data-palette="forest"],html:has(#fe[data-palette="forest"]){
  --bg:#0e1310;--s1:#141b16;--s2:#1a231d;--s3:#232e26;--bd:#232d26;--bd2:#334136;--tx:#e6efe8;--mt:#a3b3a7;--dm:#7f9184;--ac:#5fc77a;--tx-on-ac:#0e1310;--dir:#a3b3a7}
#fe[data-palette="forest"][data-theme="light"],html:has(#fe[data-palette="forest"][data-theme="light"]){
  --bg:#f0f4ef;--s1:#ffffff;--s2:#eaf0e9;--s3:#dde6dc;--bd:#dbe3d9;--bd2:#c3d0c1;--tx:#18241a;--mt:#4d6151;--dm:#697d6c;--ac:#247338;--tx-on-ac:#ffffff;--dir:#5a6e5d}
#fe[data-palette="ember"],html:has(#fe[data-palette="ember"]){
  --bg:#14100d;--s1:#1c1612;--s2:#251d17;--s3:#30261e;--bd:#30261f;--bd2:#45372b;--tx:#f2e9e1;--mt:#bba99a;--dm:#988676;--ac:#ff8a3d;--tx-on-ac:#14100d;--dir:#bba99a}
#fe[data-palette="ember"][data-theme="light"],html:has(#fe[data-palette="ember"][data-theme="light"]){
  --bg:#f8f2ec;--s1:#fffcf9;--s2:#f4ebe2;--s3:#eadccf;--bd:#e8dccf;--bd2:#d6c3b0;--tx:#2b1f15;--mt:#6c5847;--dm:#88725f;--ac:#a64a0e;--tx-on-ac:#ffffff;--dir:#7a6553}
#fe[data-palette="nord"],html:has(#fe[data-palette="nord"]){
  --bg:#1f232b;--s1:#262b34;--s2:#2c323c;--s3:#353c48;--bd:#353c47;--bd2:#444c59;--tx:#e5e9f0;--mt:#aeb6c4;--dm:#8a93a3;--ac:#88c0d0;--tx-on-ac:#1f232b;--dir:#aeb6c4}
#fe[data-palette="nord"][data-theme="light"],html:has(#fe[data-palette="nord"][data-theme="light"]){
  --bg:#eceff4;--s1:#ffffff;--s2:#e5e9f0;--s3:#d8dee9;--bd:#d8dee9;--bd2:#c2cad6;--tx:#2e3440;--mt:#4c566a;--dm:#67728a;--ac:#4b6c96;--tx-on-ac:#ffffff;--dir:#5c667a}
.fe-set-thumb[data-p="ocean"]{--a:#4da3ff;--b:#19222f}
.fe-set-thumb[data-p="forest"]{--a:#5fc77a;--b:#1a231d}
.fe-set-thumb[data-p="ember"]{--a:#ff8a3d;--b:#251d17}
.fe-set-thumb[data-p="nord"]{--a:#88c0d0;--b:#2c323c}
#fe[data-theme="light"] .fe-set-thumb[data-p="ocean"]{--a:#1f6fd1;--b:#eef3f9}
#fe[data-theme="light"] .fe-set-thumb[data-p="forest"]{--a:#2e8b47;--b:#f0f4ef}
#fe[data-theme="light"] .fe-set-thumb[data-p="ember"]{--a:#c85a12;--b:#f8f2ec}
#fe[data-theme="light"] .fe-set-thumb[data-p="nord"]{--a:#5e81ac;--b:#eceff4}
/* System: half dark, half light. */
#fe .fe-set-thumb[data-mode="system"]{--a:var(--ac);--b:#1c2328;--t:#fff;--c:#131a1e;background:linear-gradient(135deg,#1c2328 50%,#f4f6f8 50%)}
#fe .fe-set-thumb[data-mode="system"] .sb{background:linear-gradient(135deg,#131a1e 50%,#e2e7eb 50%)}


/* Settings rows: a wide row puts its control under the label. */
.fe-set.wide{flex-direction:column;align-items:stretch;gap:10px}
.fe-set.wide .fe-set-c{max-width:none;justify-content:flex-start}
.fe-set.wide .fe-set-tx:has(.fe-set-l:empty){gap:0}
.fe-set-c{max-width:70%;flex-wrap:wrap}
#fe-st-term-hint{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--mono);font-size:var(--fs-sm)}
.fe-set-sws.grid4{display:grid;grid-template-columns:repeat(4,max-content);gap:4px 8px;justify-content:end}

/* Icon button: no fill until hovered. */
.fe-ibtn{flex:none}




/* Segmented: a row of buttons with one on (docs/system/segmented.md). The
   group is one control high, md 28 (the default) or lg 32 with data-size;
   its items are 4px shorter, rounded squares inside it. An item with only
   an icon is square. */
.fe-seg{--seg-h:var(--ctl-md);display:inline-flex;align-items:stretch;gap:2px;height:var(--seg-h);padding:2px;box-sizing:border-box;border-radius:var(--row-r);
  background:color-mix(in srgb,var(--tx) 6%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--bd2) 60%,transparent)}
.fe-seg[data-size="lg"]{--seg-h:var(--ctl-lg)}
.fe-seg-b{display:inline-flex;align-items:center;justify-content:center;gap:var(--sp-3);min-width:calc(var(--seg-h) - 4px);padding:0 var(--sp-4);border:0;border-radius:var(--r-sm);
  background:none;color:var(--mt);font:inherit;font-size:var(--type-ui);font-weight:500;cursor:pointer;white-space:nowrap;box-sizing:border-box;
  transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease)}
.fe-seg-b.ico{width:calc(var(--seg-h) - 4px);padding:0}
.fe-seg-b svg{flex:none;width:14px;height:14px}
.fe-seg-b:hover{color:var(--tx);background:var(--hover)}
.fe-seg-b.on,.fe-seg-b.on:hover{color:var(--ac);background:var(--on)}
.fe-seg-b:focus-visible{outline:2px solid var(--ac);outline-offset:1px}

/* A slider that steps through set values, with the value beside it. */
.fe-sld{display:inline-flex;align-items:center;gap:12px;width:240px;--pct:50%}
.fe-sld input{flex:1;min-width:0;height:20px;margin:0;background:none;appearance:none;-webkit-appearance:none;cursor:pointer}
.fe-sld input::-webkit-slider-runnable-track{height:4px;border-radius:2px;
  background:linear-gradient(90deg,var(--ac) var(--pct),color-mix(in srgb,var(--tx) 14%,transparent) var(--pct))}
.fe-sld input::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;margin-top:-6px;border-radius:50%;background:#fff;
  box-shadow:0 0 0 1px rgb(0 0 0 / .14),0 1px 3px rgb(0 0 0 / .3);transition:transform var(--t-fast) var(--ease)}
.fe-sld input:hover::-webkit-slider-thumb{transform:scale(1.12)}
.fe-sld input:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 3px color-mix(in srgb,var(--ac) 40%,transparent),0 1px 3px rgb(0 0 0 / .3)}
.fe-sld output{min-width:48px;padding:3px 7px;border-radius:6px;background:color-mix(in srgb,var(--tx) 6%,transparent);font:500 var(--fs-md) var(--mono);color:var(--tx);text-align:center}

/* A dropdown button and its list. */
.fe-dd{--dd-h:var(--ctl-md);display:inline-flex}
.fe-dd[data-size="lg"]{--dd-h:var(--ctl-lg)}
.fe-dd-btn{display:inline-flex;align-items:center;gap:8px;min-width:160px;height:var(--dd-h);padding:0 10px;border:1px solid var(--bd2);border-radius:var(--row-r);background:var(--bg);
  color:var(--tx);font:inherit;font-size:var(--type-ui);cursor:pointer;transition:border-color var(--t-fast) var(--ease)}
/* The same surface and hairline as a TextBox: fields and dropdowns read as one family. */
.fe-dd-btn:hover{border-color:color-mix(in srgb,var(--mt) 60%,var(--bd2))}
.fe-dd-btn[aria-expanded="true"]{border-color:var(--ac)}
.fe-dd-btn:focus-visible{outline:2px solid var(--ac);outline-offset:1px}
.fe-dd-cur{flex:1;display:flex;align-items:center;gap:8px;min-width:0;text-align:left}
.fe-dd-cur span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fe-dd-cur svg{flex:none;width:14px;height:14px;color:var(--mt)}
.fe-dd-btn > svg{flex:none;color:var(--dm)}
.fe-dd-none{color:var(--dm)}
.fe-dd-list{position:fixed;z-index:600;max-height:min(360px,60vh);overflow-y:auto;padding:5px;border-radius:var(--pop-r);
  background:var(--pop-bg);border:1px solid var(--pop-bd);box-shadow:var(--pop-sh);backdrop-filter:var(--pop-blur);-webkit-backdrop-filter:var(--pop-blur);animation:fe-rise var(--t-fast) var(--ease)}
.fe-dd-opt{display:flex;align-items:center;gap:9px;min-height:32px;padding:0 10px;border-radius:7px;color:var(--tx);font-size:var(--row-fs);cursor:pointer;white-space:nowrap}
.fe-dd-opt svg{flex:none;width:14px;height:14px;color:var(--mt)}
.fe-dd-l{flex:1}
.fe-dd-h{color:var(--dm);font-size:var(--fs-sm);padding-left:14px}
.fe-dd-g{padding:var(--sp-4) var(--sp-5) var(--sp-2);color:var(--dm);font-size:var(--fs-sm);font-weight:600}
.fe-dd-g:first-child{padding-top:var(--sp-2)}
/* Chip: a short label in a pill (docs/system/chip.md). Class chip. Tags,
   filters and facts. --chip carries a tag's colour for the border, the dot
   and the fill. data-size: sm 18 for listing rows, md 22 (the default).
   data-fill: a soft fill instead of a border. data-tone: due, done, quiet.
   A button chip is a filter: on with .on or aria-pressed. A removable chip
   ends in an xs Button. */
.chip{--chip-h:var(--ctl-sm);display:inline-flex;align-items:center;gap:var(--sp-2);max-width:100%;height:var(--chip-h);padding:0 var(--sp-4);box-sizing:border-box;
  border:1px solid color-mix(in srgb,var(--chip,var(--bd2)) 55%,transparent);border-radius:var(--r-full);background:none;color:var(--mt);
  font:inherit;font-size:var(--type-small);line-height:1;white-space:nowrap;vertical-align:middle}
.chip[data-size="sm"]{--chip-h:var(--ctl-xs);padding:0 var(--sp-3);font-size:var(--fs-sm)}
.chip > svg{flex:none;width:12px;height:12px}
.chip > i{flex:none;width:6px;height:6px;border-radius:var(--r-full)}
.chip > span{min-width:0;overflow:hidden;text-overflow:ellipsis}
.chip:has(> .btn:last-child){padding-right:var(--sp-1)}
.chip[data-fill]{border-color:transparent;background:color-mix(in srgb,var(--chip,var(--ac)) 16%,transparent);color:var(--tx)}
.chip[data-tone="due"]{--chip:var(--nc-orange)}
.chip[data-tone="done"]{--chip:var(--nc-green)}
.chip[data-tone="quiet"]{background:var(--s2);color:var(--mt)}
.chip[data-mono]{font-family:var(--mono)}
.chip[data-add]{border-style:dashed}
button.chip{cursor:pointer;transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease),border-color var(--t-fast) var(--ease)}
button.chip:not(:disabled):hover{color:var(--tx);background:var(--hover)}
button.chip[data-add]:not(:disabled):hover{border-style:solid;border-color:var(--ac)}
.chip.on,.chip[aria-pressed="true"],button.chip.on:hover{color:var(--tx);background:color-mix(in srgb,var(--chip,var(--ac)) 22%,transparent)}
button.chip:focus-visible{outline:2px solid var(--ac);outline-offset:1px}
button.chip:disabled{opacity:.45;cursor:default}
/* Badge: a count in a small pill (docs/system/badge.md). Class badge.
   data-size: sm 14 on an icon's corner, md 18 (the default). data-tone:
   soft (the default), solid, quiet. Empty, it hides. */
.badge{--badge-h:18px;display:inline-flex;align-items:center;justify-content:center;gap:var(--sp-1);min-width:var(--badge-h);height:var(--badge-h);padding:0 var(--sp-2);
  box-sizing:border-box;border-radius:var(--r-full);background:color-mix(in srgb,var(--ac) 16%,transparent);color:var(--tx);
  font-size:var(--fs-xs);font-weight:500;line-height:1;font-variant-numeric:tabular-nums;white-space:nowrap;vertical-align:middle}
.badge[data-size="sm"]{--badge-h:14px;padding:0 3px}
.badge svg{flex:none;width:10px;height:10px}
.badge[data-tone="solid"]{background:var(--ac);color:var(--tx-on-ac)}
.badge[data-tone="quiet"]{background:var(--s2);color:var(--dm)}
.badge:empty{display:none}
/* Check: a box with a tick, and its label. Mixed shows a bar. */
.fe-check{display:inline-flex;align-items:center;gap:var(--sp-3);min-height:var(--ctl-sm);color:var(--mt);font-size:var(--type-small);cursor:pointer;user-select:none}
.fe-check:hover{color:var(--tx)}
.fe-check input{appearance:none;-webkit-appearance:none;display:grid;place-content:center;flex:none;width:14px;height:14px;margin:0;border:1px solid var(--bd2);border-radius:var(--r-xs);background:var(--card);cursor:pointer;
  transition:background var(--t-fast) var(--ease),border-color var(--t-fast) var(--ease)}
.fe-check:hover input{border-color:var(--mt)}
.fe-check input:checked,.fe-check input:indeterminate{background:var(--ac);border-color:var(--ac)}
.fe-check input:checked::after{content:'';width:7px;height:4px;margin-top:-2px;border:solid var(--tx-on-ac);border-width:0 0 2px 2px;transform:rotate(-45deg)}
.fe-check input:indeterminate::after{content:'';width:8px;height:2px;border-radius:1px;background:var(--tx-on-ac)}
.fe-check input:focus-visible{outline:2px solid var(--ac);outline-offset:1px}
.fe-check input:disabled{opacity:.45;cursor:default}

/* A list edited as chips. */
.fe-chipin{display:flex;flex-wrap:wrap;align-items:center;gap:5px;width:300px;max-width:100%;min-height:var(--ctl-lg);padding:var(--sp-1) var(--sp-3);box-sizing:border-box;border:1px solid var(--bd2);border-radius:var(--row-r);background:var(--bg);cursor:text}
.fe-set.wide .fe-chipin{width:100%}
.fe-chipin:focus-within{border-color:var(--ac)}
.fe-chipin-in{flex:1;min-width:70px;height:24px;border:0;outline:0;background:none;color:var(--tx);font:var(--fs-md) var(--mono)}

/* App icons: a grid of 16 tiles. */
.fe-appicons{display:grid;grid-template-columns:repeat(8,1fr);gap:6px}
.fe-appicon{position:relative;display:flex;flex-direction:column;align-items:center;gap:5px;padding:8px 4px 6px;border-radius:10px;cursor:pointer;color:var(--mt);font-size:var(--fs-sm);
  transition:background var(--t-fast) var(--ease)}
.fe-appicon:hover{background:var(--hover)}
.fe-appicon input{position:absolute;opacity:0;pointer-events:none}
.fe-appicon img{width:40px;height:40px;border-radius:10px;box-shadow:0 1px 3px rgb(0 0 0 / .25);transition:transform var(--t-fast) var(--ease)}
.fe-appicon:hover img{transform:translateY(-1px) scale(1.04)}
.fe-appicon:has(input:checked){background:var(--on);color:var(--tx)}
.fe-appicon:has(input:checked) img{box-shadow:0 0 0 2px var(--ac),0 2px 6px rgb(0 0 0 / .25)}
.fe-appicon:has(input:focus-visible){outline:2px solid var(--ac);outline-offset:1px}

/* Icon rules. */
.fe-rule-sugg{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:12px 16px 4px}
.fe-rule-sugg:empty{display:none}
.fe-rule-sugg-l{font-size:var(--fs-sm);color:var(--dm);margin-right:2px}
.chip.fe-rule-add > svg{width:13px;height:15px}
#fe-st-rules-list{padding:6px 10px 10px}
.fe-rule{display:grid;grid-template-columns:auto auto 1fr auto auto;align-items:center;gap:10px;padding:6px;border-radius:9px}
.fe-rule:hover{background:var(--hover)}
.fe-rule.off .fe-rule-ico,.fe-rule.off .fe-st-rule-pattern{opacity:.45}
.fe-switch.sm{width:28px;height:16px;border-radius:8px}
.fe-switch.sm::after{width:12px;height:12px}
.fe-switch.sm:checked::after{transform:translateX(12px)}
.fe-rule-ico{display:grid;place-items:center;width:34px;height:34px;padding:0;border:1px solid var(--bd2);border-radius:9px;background:var(--card);cursor:pointer}
.fe-rule-ico:hover{border-color:var(--ac)}
.fe-rule-ico svg{width:18px;height:20px}
.fe-st-rule-pattern{width:100%}
.fe-rule-n{min-width:26px;padding:2px 6px;border-radius:10px;background:color-mix(in srgb,var(--tx) 7%,transparent);color:var(--mt);font:500 var(--fs-sm) var(--mono);text-align:center}
.fe-rule-pop{position:fixed;z-index:610;width:330px;padding:12px;border-radius:var(--pop-r);display:flex;flex-direction:column;gap:12px;
  background:var(--pop-bg);border:1px solid var(--pop-bd);box-shadow:var(--pop-sh);backdrop-filter:var(--pop-blur);-webkit-backdrop-filter:var(--pop-blur);animation:fe-rise var(--t-fast) var(--ease)}
.fe-rp-sec{display:flex;flex-direction:column;gap:6px}
.fe-rp-l{font-size:var(--fs-xs);font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--dm)}
.fe-rp-glyphs{display:grid;grid-template-columns:repeat(9,1fr);gap:3px}
.fe-rp-g{display:grid;place-items:center;height:34px;padding:0;border:0;border-radius:7px;background:none;cursor:pointer}
.fe-rp-g svg{width:20px;height:22px}
.fe-rp-g:hover{background:var(--hover)}
.fe-rp-g.on{background:var(--on);box-shadow:inset 0 0 0 1.5px var(--ac)}
.fe-rp-label{width:90px}
.fe-rp-sw{display:grid;grid-template-columns:repeat(8,1fr);gap:6px;align-items:center}
.fe-rp-c{width:26px;height:26px;padding:0;border:0;border-radius:50%;background:var(--c);cursor:pointer;box-shadow:inset 0 0 0 1px rgb(0 0 0 / .15);transition:transform var(--t-fast) var(--ease)}
.fe-rp-c:hover{transform:scale(1.1)}
.fe-rp-c.on{box-shadow:0 0 0 2px var(--card),0 0 0 4px var(--c)}
.fe-rp-c:focus-visible,.fe-rp-g:focus-visible{outline:2px solid var(--ac);outline-offset:1px}
.fe-rp-hex{grid-column:span 4}

/* AI: a status line on top, then the model controls and the list. */
.fe-ai-hero{display:flex;align-items:center;gap:14px;padding:16px 18px;border-radius:14px;background:linear-gradient(135deg,color-mix(in srgb,var(--nc-purple) 18%,var(--card)),var(--card));
  border:1px solid color-mix(in srgb,var(--nc-purple) 30%,var(--bd))}
.fe-ai-hero .fe-st-ai-head{margin:0}
.fe-ai-hero .fe-st-ai-blink,.fe-ai-hero .fe-st-ai-blink .dot{width:12px;height:12px}
.fe-ai-hero-tx{flex:1;display:flex;flex-direction:column;gap:3px;min-width:0}
.fe-ai-hero-tx b{font-size:var(--fs-xl);font-weight:650;color:var(--tx)}
.fe-ai-hero-tx span{font-size:var(--fs-md);color:var(--mt);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#fe-st-ai-grid{display:grid;grid-template-columns:auto 1fr;gap:4px 14px;padding:10px 16px 12px;border-top:1px solid color-mix(in srgb,var(--bd) 70%,transparent)}
#fe-st-ai-grid:empty{display:none}
.fe-st-ai-hint code{font-family:var(--mono)}
.fe-dm{color:var(--dm)}
.fe-ai-models{display:flex;flex-direction:column;padding:6px}
.fe-ai-m{display:flex;align-items:center;gap:10px;min-height:38px;padding:0 10px;border-radius:9px}
.fe-ai-m:hover{background:var(--hover)}
.fe-ai-m svg{flex:none;width:15px;height:15px;color:var(--mt)}
.fe-ai-m b{font-size:var(--row-fs);font-weight:550;color:var(--tx)}
.fe-ai-m-id{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:var(--fs-sm) var(--mono);color:var(--dm)}
.fe-ai-where{padding:2px 8px;border-radius:10px;font-size:var(--fs-sm);background:color-mix(in srgb,var(--nc-green) 16%,transparent);color:var(--nc-green)}
.fe-ai-where.cloud{background:color-mix(in srgb,var(--nc-blue) 16%,transparent);color:var(--nc-blue)}
.fe-ai-def{padding:2px 8px;border-radius:10px;font-size:var(--fs-sm);background:var(--on);color:var(--ac)}

/* The command palette. */
.fe-pal-wrap{position:fixed;inset:0;z-index:700;display:flex;justify-content:center;align-items:flex-start;padding-top:12vh;background:rgb(0 0 0 / .32);animation:fe-fade var(--t-fast) var(--ease)}
.fe-pal{width:min(640px,calc(100vw - 32px));max-height:min(560px,72vh);display:flex;flex-direction:column;border-radius:16px;overflow:hidden;
  background:var(--card);border:1px solid var(--pop-bd);box-shadow:0 24px 64px rgb(0 0 0 / .45),0 2px 8px rgb(0 0 0 / .25);animation:fe-rise var(--t-base) var(--ease)}
.fe-pal-q{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--bd);color:var(--dm)}
.fe-pal-q input{flex:1;border:0;outline:0;background:none;color:var(--tx);font:inherit;font-size:var(--fs-xl)}
.fe-pal-list{flex:1;overflow-y:auto;padding:6px}
/* Palette tabs: one per kind of entry, each with its own colour, which the
   entries of that kind share. */
.fe-pal-tabs{flex:none;display:flex;gap:var(--sp-1);padding:var(--sp-2) var(--sp-3);border-bottom:1px solid var(--bd);overflow-x:auto;scrollbar-width:none}
.fe-pal-tab{display:inline-flex;align-items:center;gap:var(--sp-2);flex:none;height:var(--ctl-md);padding:0 var(--sp-3);border:0;border-radius:var(--r-full);background:none;color:var(--mt);font:inherit;font-size:var(--fs-sm);cursor:pointer;transition:background var(--t-fast),color var(--t-fast)}
.fe-pal-tab svg{width:1.1em;height:1.1em;color:var(--tab-c,var(--mt))}
.fe-pal-tab i{font-style:normal;color:var(--dm);font-size:var(--fs-xs)}
.fe-pal-tab:hover{background:var(--hover);color:var(--tx)}
.fe-pal-tab.on{background:color-mix(in srgb,var(--tab-c,var(--ac)) 16%,transparent);color:var(--tx)}
.fe-pal-tab.is-empty{opacity:.45}
.fe-pal-tab[data-tab="actions"],.fe-pal-i[data-tab="actions"]{--tab-c:var(--ac)}
.fe-pal-tab[data-tab="tabs"],.fe-pal-i[data-tab="tabs"]{--tab-c:var(--nc-blue)}
.fe-pal-tab[data-tab="saved"],.fe-pal-i[data-tab="saved"]{--tab-c:var(--nc-yellow)}
.fe-pal-tab[data-tab="recent"],.fe-pal-i[data-tab="recent"]{--tab-c:var(--nc-purple)}
.fe-pal-tab[data-tab="notes"],.fe-pal-i[data-tab="notes"]{--tab-c:var(--nc-green)}
.fe-pal-tab[data-tab="here"],.fe-pal-i[data-tab="here"]{--tab-c:var(--dir)}
.fe-pal-tab[data-tab="comments"],.fe-pal-i[data-tab="comments"]{--tab-c:var(--nc-orange)}
.fe-pal-tab[data-tab="chats"],.fe-pal-i[data-tab="chats"]{--tab-c:var(--nc-pink)}
.fe-pal-g{padding:10px 10px 4px}
.fe-pal-i{display:flex;align-items:center;gap:10px;min-height:36px;padding:0 10px;border-radius:9px;color:var(--tx);font-size:var(--row-fs);cursor:pointer}
.fe-pal-i svg{flex:none;width:16px;height:16px;color:var(--tab-c,var(--mt))}
.fe-pal-t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fe-pal-s{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--dm);font-size:var(--fs-sm)}
.fe-pal-i kbd,.fe-pal kbd,.fe-chord kbd,.fe-hints kbd,#fe-hint kbd{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 6px;border-radius:5px;
  background:color-mix(in srgb,var(--tx) 8%,transparent);box-shadow:inset 0 -1px 0 color-mix(in srgb,var(--tx) 14%,transparent);color:var(--mt);font:600 var(--fs-xs) var(--mono);white-space:nowrap}
.fe-pal-i kbd{margin-left:auto}
.fe-pal-foot{display:flex;gap:16px;padding:8px 14px;border-top:1px solid var(--bd);font-size:var(--fs-sm);color:var(--dm)}
.fe-pal-foot span{display:inline-flex;align-items:center;gap:4px}

/* A key sequence waiting for its second key. */
.fe-chord{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:700;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px;max-width:min(720px,90vw);
  padding:8px 12px;border-radius:12px;background:var(--pop-bg);border:1px solid var(--pop-bd);box-shadow:var(--pop-sh);backdrop-filter:var(--pop-blur);-webkit-backdrop-filter:var(--pop-blur);
  font-size:var(--fs-md);color:var(--mt);animation:fe-rise var(--t-fast) var(--ease)}
.fe-chord > kbd{background:var(--ac);color:var(--tx-on-ac);box-shadow:none}
.fe-chord-o{display:inline-flex;align-items:center;gap:5px;color:var(--tx)}

/* Key badges while \u2325 is held. */
.fe-hints{position:fixed;inset:0;z-index:690;pointer-events:none}
.fe-hints > kbd{position:fixed;transform:translate(-50%,0);background:var(--ac);color:var(--tx-on-ac);box-shadow:0 2px 6px rgb(0 0 0 / .35);animation:fe-rise var(--t-fast) var(--ease)}
.fe-hints-tip{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:12px;
  background:var(--pop-bg);border:1px solid var(--pop-bd);box-shadow:var(--pop-sh);font-size:var(--fs-md);color:var(--mt)}

/* Where the keyboard is. */
.fe-area-flash{animation:fe-area .7s var(--ease)}
@keyframes fe-area{0%{box-shadow:inset 0 0 0 2px var(--ac)}100%{box-shadow:inset 0 0 0 2px transparent}}
#fe-side .fe-si:focus-visible,#fe-side .fe-si-link:focus-visible,#fe-side summary:focus-visible,#fe-side .fe-nt-grp:focus-visible,
#fe-tabs .fe-tab:focus-visible,#fe-bc a:focus-visible,#fe-bc button:focus-visible{outline:2px solid var(--ac);outline-offset:-2px;border-radius:var(--row-r)}

/* Help: the keyboard map. Keys with a use are tinted; hovering an action
   lights its keys, hovering a key lights its actions. */
.fe-km{display:flex;flex-direction:column;gap:14px}
.fe-km-board{display:flex;flex-direction:column;gap:5px;padding:14px;border-radius:14px;background:color-mix(in srgb,var(--tx) 4%,var(--card));
  border:1px solid var(--bd);position:sticky;top:-2px;z-index:2;box-shadow:0 8px 16px -12px rgb(0 0 0 / .4)}
.fe-km-row-k{display:flex;gap:5px}
.fe-km-cap{flex:var(--w,1) 1 0;min-width:0;height:34px;display:grid;place-items:center;border-radius:7px;font:500 var(--fs-sm) var(--mono);color:var(--dm);
  background:color-mix(in srgb,var(--tx) 5%,transparent);box-shadow:inset 0 -2px 0 color-mix(in srgb,#000 22%,transparent);transition:background .12s,color .12s,transform .12s}
.fe-km-cap.fn{height:22px;font-size:var(--fs-xs)}
.fe-km-cap.used{color:var(--tx);background:color-mix(in srgb,var(--ac) 12%,transparent);cursor:pointer}
.fe-km-cap.hl{background:var(--ac);color:var(--tx-on-ac);transform:translateY(1px);box-shadow:inset 0 -1px 0 rgb(0 0 0 / .25),0 0 0 3px color-mix(in srgb,var(--ac) 30%,transparent)}
.fe-km-cap.pin{outline:2px solid var(--ac);outline-offset:2px}
.fe-km-ud{flex:1 1 0;display:flex;flex-direction:column;gap:2px}
.fe-km-cap.half{height:16px;font-size:9px}
.fe-km-bar{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.fe-km-q{flex:1;min-width:200px;width:auto}
.fe-km-legend{font-size:var(--fs-sm);color:var(--dm);display:inline-flex;align-items:center;gap:4px}
.fe-km-list{columns:2 320px;column-gap:18px}
.fe-km-g{break-inside:avoid;margin-bottom:16px;padding:4px}
.fe-km-g h3{padding:8px 10px 6px}
.fe-km-g h3 svg{width:14px;height:14px}
.fe-km-i{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:32px;padding:0 10px;border-radius:8px;font-size:var(--row-fs);color:var(--tx)}
.fe-km-k{display:inline-flex;align-items:center;gap:3px;flex:none}
.fe-km-k kbd,.fe-hc-how kbd,.fe-km-legend kbd{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;padding:0 6px;border-radius:6px;
  background:color-mix(in srgb,var(--tx) 8%,transparent);box-shadow:inset 0 -1.5px 0 color-mix(in srgb,var(--tx) 16%,transparent);color:var(--tx);font:600 var(--fs-xs) var(--mono)}
.fe-km-then,.fe-km-or{font-style:normal;font-size:var(--fs-xs);color:var(--dm);padding:0 2px}

/* Help: cards. */
.fe-hs{display:flex;flex-direction:column;gap:10px}
.fe-hs h3{padding:0 2px}
.fe-hcs{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:8px}
.fe-hc{display:flex;align-items:center;gap:12px;min-height:62px;padding:10px 14px;
  transition:transform var(--t-fast) var(--ease),border-color var(--t-fast) var(--ease),box-shadow var(--t-fast) var(--ease)}
.fe-hc:hover{transform:translateY(-1px);border-color:color-mix(in srgb,var(--tone) 45%,var(--bd));box-shadow:0 6px 16px -10px color-mix(in srgb,var(--tone) 55%,transparent)}
.fe-hc-ico{flex:none;display:grid;place-items:center;width:36px;height:36px;border-radius:10px;color:var(--tone);background:color-mix(in srgb,var(--tone) 16%,transparent)}
.fe-hc-ico svg{width:18px;height:18px}
.fe-hc-tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.fe-hc-tx b{font-size:var(--fs-lg);font-weight:650;color:var(--tx)}
.fe-hc-tx span{font-size:var(--fs-md);color:var(--mt);line-height:1.35}
.fe-hc-how{flex:none;display:flex;align-items:center;gap:3px}
.fe-hc-tag{padding:2px 8px;border-radius:10px;font-size:var(--fs-sm);color:var(--tone);background:color-mix(in srgb,var(--tone) 14%,transparent)}
/* A journey card: a title, then its steps, each with its keys on the right. */
.fe-hj{display:flex;flex-direction:column;gap:8px;padding:12px 14px}
.fe-hj-h{display:flex;align-items:center;gap:10px}
.fe-hj-h .fe-hc-ico{width:28px;height:28px;border-radius:8px}
.fe-hj-h b{font-size:var(--fs-lg);font-weight:650;color:var(--tx)}
.fe-hj-steps{display:flex;flex-direction:column;gap:4px;margin:0;padding:0 0 0 38px;list-style:none;counter-reset:step}
.fe-hj-steps li{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:24px;font-size:var(--fs-md);color:var(--mt);counter-increment:step}
.fe-hj-steps li::before{content:counter(step);flex:none;width:16px;font-size:var(--fs-xs);color:var(--dm)}
.fe-hj-steps li > span:first-of-type{flex:1;min-width:0}
#fe-help-modal .fe-dlg-pane.on{gap:22px}
`;

  // src/goto.ts
  var lastPref = textPref("bfb-goto-last-v1");
  function absPath(input, home) {
    let p = input.trim().replace(/^['"]|['"]$/g, "");
    if (!p) return null;
    if (/^file:\/\//i.test(p)) {
      try {
        p = decodeURIComponent(new URL(p).pathname);
      } catch {
        return null;
      }
    }
    if (p === "~" || p.startsWith("~/")) {
      if (!home) return null;
      p = home + p.slice(1);
    }
    return p.startsWith("/") ? p.replace(/\/{2,}/g, "/") : null;
  }
  async function readable(path, waitMs = 9e3) {
    if (!path.endsWith("/")) return true;
    const timeout = new Promise((r) => setTimeout(() => r(false), waitMs));
    const read2 = fetchFileText(fileHref(path)).then(() => true, () => false);
    return Promise.race([read2, timeout]);
  }
  async function resolvePath(path) {
    const clean = path.replace(/\/+$/, "");
    if (!clean) return "/";
    const parent = clean.slice(0, clean.lastIndexOf("/") + 1) || "/";
    const name = clean.slice(clean.lastIndexOf("/") + 1);
    let listing;
    const dir = fileHref(parent);
    try {
      listing = await fetchFileText(dir);
    } catch {
      if (parent === "/") return path;
      return await resolvePath(parent) === null ? null : path;
    }
    const hit = parseListing(listing, dir).find((e) => e.name === name);
    return hit ? clean + (hit.isDir ? "/" : "") : null;
  }
  var submitOpen = null;
  function gotoBackground() {
    if (!submitOpen) return false;
    submitOpen(true);
    return true;
  }
  function mountGoto(btn, home, go2) {
    let box = null;
    let layer = null;
    const close = () => layer?.close("api");
    const open = () => {
      box = document.createElement("form");
      box.id = "fe-goto";
      const recents = getRecents().slice(0, 30);
      box.innerHTML = `<input class="tb" data-size="lg" type="text" list="fe-goto-list" spellcheck="false" autocomplete="off" placeholder="Path to a file or folder" aria-label="Path to a file or folder">
      <datalist id="fe-goto-list">${recents.map((r) => `<option value="${esc(r.path)}"></option>`).join("")}</datalist>
      <p class="fe-goto-msg" hidden></p>`;
      const form = box;
      const input = box.querySelector("input");
      input.value = lastPref.get();
      layer = openLayer(box, {
        kind: "popover",
        anchor: btn,
        offset: 6,
        role: "dialog",
        label: "Go to a path",
        focus: input,
        onClose: () => {
          lastPref.set(input.value);
          if (box === form) {
            box = null;
            submitOpen = null;
          }
          btn.classList.remove("on");
        }
      });
      if (!layer.open) {
        box = null;
        return;
      }
      input.select();
      btn.classList.add("on");
      const say = (text) => {
        const msg = box.querySelector(".fe-goto-msg");
        msg.hidden = false;
        msg.textContent = text;
      };
      const submit = async (background) => {
        const path = absPath(input.value, home());
        if (!path) {
          say("Paste a full path, such as ~/Code or /Users/you/notes.md");
          return;
        }
        lastPref.set(input.value);
        const found = await resolvePath(path);
        if (!found) {
          say(`Nothing at ${path}. Check the spelling, or pick a recent place below.`);
          return;
        }
        const slow = setTimeout(() => say("Checking that folder\u2026"), 600);
        const ok = await readable(found);
        clearTimeout(slow);
        if (!ok) {
          say(`The browser could not open ${found}. It may not have permission to read that folder.`);
          return;
        }
        close();
        go2(found, background);
      };
      submitOpen = (background) => void submit(background);
      box.addEventListener("submit", (e) => {
        e.preventDefault();
        void submit(false);
      });
      input.addEventListener("input", () => lastPref.set(input.value));
    };
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (box) close();
      else open();
    });
  }

  // src/theme.ts
  var themePref = choicePref(THEME_KEY, ["dark", "light", "system"], "dark");
  function themeMode() {
    return themePref.get();
  }
  var systemDark = () => matchMedia("(prefers-color-scheme: dark)").matches;
  function resolveTheme(mode) {
    return mode === "system" ? systemDark() ? "dark" : "light" : mode;
  }
  function setThemeMode(fe, mode, save = true) {
    fe.dataset.mode = mode;
    fe.dataset.theme = resolveTheme(mode);
    if (save) themePref.set(mode);
  }
  function followSystem(fe) {
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (fe.dataset.mode === "system") fe.dataset.theme = resolveTheme("system");
    });
  }
  var APP_ICONS = [
    { id: "classic", file: "01-classic.svg", name: "Classic" },
    { id: "stack", file: "02-stack.svg", name: "Stack" },
    { id: "tree", file: "03-tree.svg", name: "Tree" },
    { id: "lens", file: "04-lens.svg", name: "Lens" },
    { id: "panes", file: "05-panes.svg", name: "Panes" },
    { id: "map", file: "06-map.svg", name: "Map" },
    { id: "drawer", file: "07-drawer.svg", name: "Drawer" },
    { id: "tabs", file: "08-tabs.svg", name: "Tabs" },
    { id: "fan", file: "09-fan.svg", name: "Fan" },
    { id: "prompt", file: "10-prompt.svg", name: "Prompt" },
    { id: "orbit", file: "11-orbit.svg", name: "Orbit" },
    { id: "sprout", file: "12-sprout.svg", name: "Sprout" },
    { id: "grid", file: "13-grid.svg", name: "Grid" },
    { id: "starred", file: "14-starred.svg", name: "Starred" },
    { id: "mono-b", file: "15-mono-b.svg", name: "Mono B" },
    { id: "outline", file: "16-outline.svg", name: "Outline" }
  ];
  var appIconPref = textPref("bfb-app-icon", "classic");
  function appIconUrl(id = appIconPref.get()) {
    const icon2 = APP_ICONS.find((i3) => i3.id === id) ?? APP_ICONS[0];
    return chrome.runtime.getURL(`assets/app-icons/${icon2.file}`);
  }
  function setAppIcon(id) {
    appIconPref.set(id);
    const link = document.querySelector('link[rel="icon"]');
    if (link) link.href = appIconUrl(id);
    try {
      void chrome.runtime.sendMessage({ type: "bfb-app-icon", id });
    } catch {
    }
  }

  // src/chrome.ts
  function setUiScale(percent) {
    try {
      void chrome.runtime.sendMessage({ type: "bfb-zoom", factor: (percent || 100) / 100 });
    } catch {
    }
  }
  function initChrome(app) {
    const { fe, settings, toast } = app;
    el("fe-status-path").addEventListener("click", () => {
      void copyToClipboard(app.rawPath).then((ok) => toast(ok ? "Copied the path" : "Copy failed"));
    });
    el("fe-theme-btn").addEventListener("click", () => setThemeMode(fe, fe.dataset.theme === "dark" ? "light" : "dark"));
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
    let crumbLayer = null;
    function closeCrumbMenu() {
      crumbLayer?.close("api");
    }
    const bc = el("fe-bc"), more = el("fe-crumb-more");
    const openCrumbMenu = (btn, key, html) => {
      crumbMenu.innerHTML = html;
      crumbLayer = openLayer(crumbMenu, { kind: "popover", anchor: btn, role: "menu", group: "menu", onClose: () => {
        crumbMenuUrl = null;
      } });
      if (!crumbLayer.open) return false;
      crumbMenuUrl = key;
      return true;
    };
    const fitCrumbs = () => {
      const groups = [...bc.querySelectorAll(".fe-cg")];
      const pre = groups.filter((g) => g.hasAttribute("data-pre")).length;
      groups.forEach((g, i3) => {
        g.hidden = i3 < pre;
      });
      more.hidden = true;
      const n = groups.length, order = [];
      for (let i3 = pre + 2; i3 < n - 2; i3++) order.push(i3);
      for (const i3 of [pre + 1, n - 2]) if (i3 > pre && i3 < n - 1 && !order.includes(i3)) order.push(i3);
      for (const i3 of order) {
        if (bc.scrollWidth <= bc.clientWidth) break;
        groups[i3].hidden = true;
        more.hidden = false;
      }
      const first = groups.find((g, i3) => g.hidden && i3 >= pre) ?? (pre ? groups[pre] : void 0);
      if (pre) more.hidden = false;
      if (first) first.before(more);
    };
    fitCrumbs();
    new ResizeObserver(() => {
      closeCrumbMenu();
      fitCrumbs();
    }).observe(bc);
    const home = homeDir(app.rawPath);
    let edit2 = null;
    const endEdit = () => {
      if (!edit2) return;
      edit2.remove();
      edit2 = null;
      bc.hidden = false;
      fitCrumbs();
    };
    const startEdit = () => {
      if (edit2) return;
      closeCrumbMenu();
      const shown = home && (app.rawPath === home || app.rawPath.startsWith(home + "/")) ? "~" + app.rawPath.slice(home.length) : app.rawPath;
      edit2 = document.createElement("form");
      edit2.id = "fe-bc-edit";
      edit2.innerHTML = `<input class="tb" type="text" list="fe-bc-recent" spellcheck="false" autocomplete="off" aria-label="Path to a file or folder" title="Enter goes there \xB7 Esc cancels">
      <datalist id="fe-bc-recent">${getRecents().slice(0, 30).map((r) => `<option value="${esc(r.path)}"></option>`).join("")}</datalist>`;
      bc.after(edit2);
      bc.hidden = true;
      const input = edit2.querySelector("input");
      input.value = shown;
      input.focus();
      input.select();
      input.addEventListener("blur", () => setTimeout(() => {
        if (edit2 && !edit2.contains(document.activeElement)) endEdit();
      }, 120));
      input.addEventListener("keydown", (ke) => {
        if (ke.key === "Escape") {
          ke.preventDefault();
          ke.stopPropagation();
          endEdit();
        }
      });
      edit2.addEventListener("submit", async (se) => {
        se.preventDefault();
        const path = absPath(input.value, home);
        if (!path) {
          input.setAttribute("aria-invalid", "true");
          toast("Type a full path, such as ~/Code or /Users/you/notes.md");
          return;
        }
        const found = await resolvePath(path);
        if (!found) {
          input.setAttribute("aria-invalid", "true");
          toast(`Nothing at ${path}`);
          return;
        }
        const slow = setTimeout(() => toast("Checking that folder\u2026"), 600);
        const ok = await readable(found);
        clearTimeout(slow);
        if (!ok) {
          input.setAttribute("aria-invalid", "true");
          toast(`The browser could not open ${found}. It may not have permission to read it.`);
          return;
        }
        if (found.replace(/\/$/, "") === app.rawPath.replace(/\/$/, "")) {
          endEdit();
          return;
        }
        go(fileHref(found));
      });
      input.addEventListener("input", () => input.removeAttribute("aria-invalid"));
    };
    bc.title = "Click an empty part of the bar to type a path";
    bc.addEventListener("click", (e) => {
      if (e.target === bc) startEdit();
    });
    bc.addEventListener("click", async (e) => {
      if (e.target.closest("#fe-crumb-more")) {
        e.preventDefault();
        e.stopPropagation();
        if (crumbLayer?.open && crumbMenuUrl === "more") {
          closeCrumbMenu();
          return;
        }
        const hid = [...bc.querySelectorAll(".fe-cg[hidden] .fe-crumb")];
        openCrumbMenu(more, "more", `<div class="fe-dd-items">${hid.map((a) => {
          const href = a.getAttribute("href"), name = a.textContent;
          const icon2 = getIcon({ name, href, isDir: true, isParent: false, isHidden: false, rawBytes: -1, dateMs: NaN, dateStr: "" }, app.iconRules);
          return `<a href="${esc(href)}" class="row fe-dd-item dir" data-name="${esc(name.toLowerCase())}" title="${esc(decodeURIComponent(href.slice(7)))}">${icon2}<span>${esc(name)}</span></a>`;
        }).join("")}</div>`);
        return;
      }
      const btn = e.target.closest(".fe-crumb-dd");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const url = btn.dataset.url;
      if (crumbLayer?.open && crumbMenuUrl === url) {
        closeCrumbMenu();
        return;
      }
      if (!openCrumbMenu(btn, url, emptyHtml("loading", "Loading\u2026", { inline: true }))) return;
      const text = await fetchFileText(url).catch((err) => {
        console.error("[BFB] crumb dropdown failed:", url, err);
        return null;
      });
      if (text === null) {
        if (crumbMenuUrl === url) crumbMenu.innerHTML = emptyHtml("failed", "This folder could not be read", { inline: true });
        return;
      }
      if (crumbMenuUrl !== url) return;
      try {
        const entries = parseListing(text, url);
        if (!entries.length) {
          crumbMenu.innerHTML = emptyHtml("empty", "Empty folder", { inline: true });
          crumbLayer?.place();
          return;
        }
        crumbMenu.innerHTML = `<div class="fe-dd-search-wrap"><input class="tb fe-dd-search" data-lead="search" type="text" placeholder="Filter" autocomplete="off" spellcheck="false" title="Type to narrow \xB7 Enter opens the first match \xB7 Esc closes"></div><div class="fe-dd-items">${entries.map(
          (en) => `<a href="${esc(en.href)}" class="row fe-dd-item${en.isDir ? " dir" : ""}" data-name="${esc(en.name.toLowerCase())}" title="${esc(decodeURIComponent(en.href.slice(7)))}">${getIcon(en, app.iconRules)}<span>${esc(en.name)}</span></a>`
        ).join("")}</div>`;
        crumbLayer?.place();
        const ddSearch = crumbMenu.querySelector(".fe-dd-search");
        ddSearch.focus();
        ddSearch.addEventListener("input", () => {
          const q = ddSearch.value.toLowerCase();
          crumbMenu.querySelectorAll(".fe-dd-item").forEach((it) => {
            it.style.display = !q || it.dataset.name.includes(q) ? "" : "none";
          });
        });
        ddSearch.addEventListener("keydown", (ke) => {
          if (ke.key === "Enter") {
            const first = [...crumbMenu.querySelectorAll(".fe-dd-item")].find((it) => it.style.display !== "none");
            if (first) go(first.href);
          }
        });
      } catch (err) {
        console.error("[BFB] crumb dropdown parse error:", url, err);
        if (crumbMenuUrl === url) crumbMenu.innerHTML = emptyHtml("failed", "This folder could not be read", { inline: true });
      }
    });
    const side = el("fe-side");
    const rz = el("fe-side-rz");
    el("fe-side-toggle").addEventListener("click", () => {
      settings.showSidebar = !sidebarShown();
      saveSettings(settings);
      setSidebarShown(settings.showSidebar);
      const box = document.getElementById("fe-st-sidebar");
      if (box) box.checked = settings.showSidebar;
    });
    resizable(rz, {
      axis: "x",
      label: "Resize the sidebar",
      size: () => ({ w: side.getBoundingClientRect().width, h: 0 }),
      apply: (w) => {
        side.style.width = Math.max(210, Math.min(520, w)) + "px";
      },
      reset: () => {
        side.style.width = "";
      },
      commit: () => {
        settings.sidebarWidth = side.style.width ? Math.round(side.getBoundingClientRect().width) : void 0;
        settings.sidebarRail = true;
        saveSettings(settings);
      }
    });
  }

  // node_modules/yaml/browser/dist/nodes/identity.js
  var ALIAS = Symbol.for("yaml.alias");
  var DOC = Symbol.for("yaml.document");
  var MAP = Symbol.for("yaml.map");
  var PAIR = Symbol.for("yaml.pair");
  var SCALAR = Symbol.for("yaml.scalar");
  var SEQ = Symbol.for("yaml.seq");
  var NODE_TYPE = Symbol.for("yaml.node.type");
  var isAlias = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
  var isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
  var isMap = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
  var isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
  var isScalar = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR;
  var isSeq = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
  function isCollection(node) {
    if (node && typeof node === "object")
      switch (node[NODE_TYPE]) {
        case MAP:
        case SEQ:
          return true;
      }
    return false;
  }
  function isNode(node) {
    if (node && typeof node === "object")
      switch (node[NODE_TYPE]) {
        case ALIAS:
        case MAP:
        case SCALAR:
        case SEQ:
          return true;
      }
    return false;
  }
  var hasAnchor = (node) => (isScalar(node) || isCollection(node)) && !!node.anchor;

  // node_modules/yaml/browser/dist/visit.js
  var BREAK = Symbol("break visit");
  var SKIP = Symbol("skip children");
  var REMOVE = Symbol("remove node");
  function visit(node, visitor) {
    const visitor_ = initVisitor(visitor);
    if (isDocument(node)) {
      const cd = visit_(null, node.contents, visitor_, Object.freeze([node]));
      if (cd === REMOVE)
        node.contents = null;
    } else
      visit_(null, node, visitor_, Object.freeze([]));
  }
  visit.BREAK = BREAK;
  visit.SKIP = SKIP;
  visit.REMOVE = REMOVE;
  function visit_(key, node, visitor, path) {
    const ctrl = callVisitor(key, node, visitor, path);
    if (isNode(ctrl) || isPair(ctrl)) {
      replaceNode(key, path, ctrl);
      return visit_(key, ctrl, visitor, path);
    }
    if (typeof ctrl !== "symbol") {
      if (isCollection(node)) {
        path = Object.freeze(path.concat(node));
        for (let i3 = 0; i3 < node.items.length; ++i3) {
          const ci = visit_(i3, node.items[i3], visitor, path);
          if (typeof ci === "number")
            i3 = ci - 1;
          else if (ci === BREAK)
            return BREAK;
          else if (ci === REMOVE) {
            node.items.splice(i3, 1);
            i3 -= 1;
          }
        }
      } else if (isPair(node)) {
        path = Object.freeze(path.concat(node));
        const ck = visit_("key", node.key, visitor, path);
        if (ck === BREAK)
          return BREAK;
        else if (ck === REMOVE)
          node.key = null;
        const cv = visit_("value", node.value, visitor, path);
        if (cv === BREAK)
          return BREAK;
        else if (cv === REMOVE)
          node.value = null;
      }
    }
    return ctrl;
  }
  async function visitAsync(node, visitor) {
    const visitor_ = initVisitor(visitor);
    if (isDocument(node)) {
      const cd = await visitAsync_(null, node.contents, visitor_, Object.freeze([node]));
      if (cd === REMOVE)
        node.contents = null;
    } else
      await visitAsync_(null, node, visitor_, Object.freeze([]));
  }
  visitAsync.BREAK = BREAK;
  visitAsync.SKIP = SKIP;
  visitAsync.REMOVE = REMOVE;
  async function visitAsync_(key, node, visitor, path) {
    const ctrl = await callVisitor(key, node, visitor, path);
    if (isNode(ctrl) || isPair(ctrl)) {
      replaceNode(key, path, ctrl);
      return visitAsync_(key, ctrl, visitor, path);
    }
    if (typeof ctrl !== "symbol") {
      if (isCollection(node)) {
        path = Object.freeze(path.concat(node));
        for (let i3 = 0; i3 < node.items.length; ++i3) {
          const ci = await visitAsync_(i3, node.items[i3], visitor, path);
          if (typeof ci === "number")
            i3 = ci - 1;
          else if (ci === BREAK)
            return BREAK;
          else if (ci === REMOVE) {
            node.items.splice(i3, 1);
            i3 -= 1;
          }
        }
      } else if (isPair(node)) {
        path = Object.freeze(path.concat(node));
        const ck = await visitAsync_("key", node.key, visitor, path);
        if (ck === BREAK)
          return BREAK;
        else if (ck === REMOVE)
          node.key = null;
        const cv = await visitAsync_("value", node.value, visitor, path);
        if (cv === BREAK)
          return BREAK;
        else if (cv === REMOVE)
          node.value = null;
      }
    }
    return ctrl;
  }
  function initVisitor(visitor) {
    if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) {
      return Object.assign({
        Alias: visitor.Node,
        Map: visitor.Node,
        Scalar: visitor.Node,
        Seq: visitor.Node
      }, visitor.Value && {
        Map: visitor.Value,
        Scalar: visitor.Value,
        Seq: visitor.Value
      }, visitor.Collection && {
        Map: visitor.Collection,
        Seq: visitor.Collection
      }, visitor);
    }
    return visitor;
  }
  function callVisitor(key, node, visitor, path) {
    if (typeof visitor === "function")
      return visitor(key, node, path);
    if (isMap(node))
      return visitor.Map?.(key, node, path);
    if (isSeq(node))
      return visitor.Seq?.(key, node, path);
    if (isPair(node))
      return visitor.Pair?.(key, node, path);
    if (isScalar(node))
      return visitor.Scalar?.(key, node, path);
    if (isAlias(node))
      return visitor.Alias?.(key, node, path);
    return void 0;
  }
  function replaceNode(key, path, node) {
    const parent = path[path.length - 1];
    if (isCollection(parent)) {
      parent.items[key] = node;
    } else if (isPair(parent)) {
      if (key === "key")
        parent.key = node;
      else
        parent.value = node;
    } else if (isDocument(parent)) {
      parent.contents = node;
    } else {
      const pt = isAlias(parent) ? "alias" : "scalar";
      throw new Error(`Cannot replace node with ${pt} parent`);
    }
  }

  // node_modules/yaml/browser/dist/doc/directives.js
  var escapeChars = {
    "!": "%21",
    ",": "%2C",
    "[": "%5B",
    "]": "%5D",
    "{": "%7B",
    "}": "%7D"
  };
  var escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);
  var Directives = class _Directives {
    constructor(yaml, tags) {
      this.docStart = null;
      this.docEnd = false;
      this.yaml = Object.assign({}, _Directives.defaultYaml, yaml);
      this.tags = Object.assign({}, _Directives.defaultTags, tags);
    }
    clone() {
      const copy = new _Directives(this.yaml, this.tags);
      copy.docStart = this.docStart;
      return copy;
    }
    /**
     * During parsing, get a Directives instance for the current document and
     * update the stream state according to the current version's spec.
     */
    atDocument() {
      const res = new _Directives(this.yaml, this.tags);
      switch (this.yaml.version) {
        case "1.1":
          this.atNextDocument = true;
          break;
        case "1.2":
          this.atNextDocument = false;
          this.yaml = {
            explicit: _Directives.defaultYaml.explicit,
            version: "1.2"
          };
          this.tags = Object.assign({}, _Directives.defaultTags);
          break;
      }
      return res;
    }
    /**
     * @param onError - May be called even if the action was successful
     * @returns `true` on success
     */
    add(line2, onError) {
      if (this.atNextDocument) {
        this.yaml = { explicit: _Directives.defaultYaml.explicit, version: "1.1" };
        this.tags = Object.assign({}, _Directives.defaultTags);
        this.atNextDocument = false;
      }
      const parts = line2.trim().split(/[ \t]+/);
      const name = parts.shift();
      switch (name) {
        case "%TAG": {
          if (parts.length !== 2) {
            onError(0, "%TAG directive should contain exactly two parts");
            if (parts.length < 2)
              return false;
          }
          const [handle, prefix] = parts;
          this.tags[handle] = prefix;
          return true;
        }
        case "%YAML": {
          this.yaml.explicit = true;
          if (parts.length !== 1) {
            onError(0, "%YAML directive should contain exactly one part");
            return false;
          }
          const [version] = parts;
          if (version === "1.1" || version === "1.2") {
            this.yaml.version = version;
            return true;
          } else {
            const isValid = /^\d+\.\d+$/.test(version);
            onError(6, `Unsupported YAML version ${version}`, isValid);
            return false;
          }
        }
        default:
          onError(0, `Unknown directive ${name}`, true);
          return false;
      }
    }
    /**
     * Resolves a tag, matching handles to those defined in %TAG directives.
     *
     * @returns Resolved tag, which may also be the non-specific tag `'!'` or a
     *   `'!local'` tag, or `null` if unresolvable.
     */
    tagName(source, onError) {
      if (source === "!")
        return "!";
      if (source[0] !== "!") {
        onError(`Not a valid tag: ${source}`);
        return null;
      }
      if (source[1] === "<") {
        const verbatim = source.slice(2, -1);
        if (verbatim === "!" || verbatim === "!!") {
          onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
          return null;
        }
        if (source[source.length - 1] !== ">")
          onError("Verbatim tags must end with a >");
        return verbatim;
      }
      const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
      if (!suffix)
        onError(`The ${source} tag has no suffix`);
      const prefix = this.tags[handle];
      if (prefix) {
        try {
          return prefix + decodeURIComponent(suffix);
        } catch (error) {
          onError(String(error));
          return null;
        }
      }
      if (handle === "!")
        return source;
      onError(`Could not resolve tag: ${source}`);
      return null;
    }
    /**
     * Given a fully resolved tag, returns its printable string form,
     * taking into account current tag prefixes and defaults.
     */
    tagString(tag) {
      for (const [handle, prefix] of Object.entries(this.tags)) {
        if (tag.startsWith(prefix))
          return handle + escapeTagName(tag.substring(prefix.length));
      }
      return tag[0] === "!" ? tag : `!<${tag}>`;
    }
    toString(doc) {
      const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
      const tagEntries = Object.entries(this.tags);
      let tagNames;
      if (doc && tagEntries.length > 0 && isNode(doc.contents)) {
        const tags = {};
        visit(doc.contents, (_key, node) => {
          if (isNode(node) && node.tag)
            tags[node.tag] = true;
        });
        tagNames = Object.keys(tags);
      } else
        tagNames = [];
      for (const [handle, prefix] of tagEntries) {
        if (handle === "!!" && prefix === "tag:yaml.org,2002:")
          continue;
        if (!doc || tagNames.some((tn) => tn.startsWith(prefix)))
          lines.push(`%TAG ${handle} ${prefix}`);
      }
      return lines.join("\n");
    }
  };
  Directives.defaultYaml = { explicit: false, version: "1.2" };
  Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };

  // node_modules/yaml/browser/dist/doc/anchors.js
  function anchorIsValid(anchor) {
    if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
      const sa = JSON.stringify(anchor);
      const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
      throw new Error(msg);
    }
    return true;
  }
  function anchorNames(root) {
    const anchors = /* @__PURE__ */ new Set();
    visit(root, {
      Value(_key, node) {
        if (node.anchor)
          anchors.add(node.anchor);
      }
    });
    return anchors;
  }
  function findNewAnchor(prefix, exclude) {
    for (let i3 = 1; true; ++i3) {
      const name = `${prefix}${i3}`;
      if (!exclude.has(name))
        return name;
    }
  }
  function createNodeAnchors(doc, prefix) {
    const aliasObjects = [];
    const sourceObjects = /* @__PURE__ */ new Map();
    let prevAnchors = null;
    return {
      onAnchor: (source) => {
        aliasObjects.push(source);
        if (!prevAnchors)
          prevAnchors = anchorNames(doc);
        const anchor = findNewAnchor(prefix, prevAnchors);
        prevAnchors.add(anchor);
        return anchor;
      },
      /**
       * With circular references, the source node is only resolved after all
       * of its child nodes are. This is why anchors are set only after all of
       * the nodes have been created.
       */
      setAnchors: () => {
        for (const source of aliasObjects) {
          const ref = sourceObjects.get(source);
          if (typeof ref === "object" && ref.anchor && (isScalar(ref.node) || isCollection(ref.node))) {
            ref.node.anchor = ref.anchor;
          } else {
            const error = new Error("Failed to resolve repeated object (this should not happen)");
            error.source = source;
            throw error;
          }
        }
      },
      sourceObjects
    };
  }

  // node_modules/yaml/browser/dist/doc/applyReviver.js
  function applyReviver(reviver, obj, key, val) {
    if (val && typeof val === "object") {
      if (Array.isArray(val)) {
        for (let i3 = 0, len = val.length; i3 < len; ++i3) {
          const v0 = val[i3];
          const v1 = applyReviver(reviver, val, String(i3), v0);
          if (v1 === void 0)
            delete val[i3];
          else if (v1 !== v0)
            val[i3] = v1;
        }
      } else if (val instanceof Map) {
        for (const k of Array.from(val.keys())) {
          const v0 = val.get(k);
          const v1 = applyReviver(reviver, val, k, v0);
          if (v1 === void 0)
            val.delete(k);
          else if (v1 !== v0)
            val.set(k, v1);
        }
      } else if (val instanceof Set) {
        for (const v0 of Array.from(val)) {
          const v1 = applyReviver(reviver, val, v0, v0);
          if (v1 === void 0)
            val.delete(v0);
          else if (v1 !== v0) {
            val.delete(v0);
            val.add(v1);
          }
        }
      } else {
        for (const [k, v0] of Object.entries(val)) {
          const v1 = applyReviver(reviver, val, k, v0);
          if (v1 === void 0)
            delete val[k];
          else if (v1 !== v0)
            val[k] = v1;
        }
      }
    }
    return reviver.call(obj, key, val);
  }

  // node_modules/yaml/browser/dist/nodes/toJS.js
  function toJS(value, arg, ctx) {
    if (Array.isArray(value))
      return value.map((v, i3) => toJS(v, String(i3), ctx));
    if (value && typeof value.toJSON === "function") {
      if (!ctx || !hasAnchor(value))
        return value.toJSON(arg, ctx);
      const data = { aliasCount: 0, count: 1, res: void 0 };
      ctx.anchors.set(value, data);
      ctx.onCreate = (res2) => {
        data.res = res2;
        delete ctx.onCreate;
      };
      const res = value.toJSON(arg, ctx);
      if (ctx.onCreate)
        ctx.onCreate(res);
      return res;
    }
    if (typeof value === "bigint" && !ctx?.keep)
      return Number(value);
    return value;
  }

  // node_modules/yaml/browser/dist/nodes/Node.js
  var NodeBase = class {
    constructor(type) {
      Object.defineProperty(this, NODE_TYPE, { value: type });
    }
    /** Create a copy of this node.  */
    clone() {
      const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
      if (this.range)
        copy.range = this.range.slice();
      return copy;
    }
    /** A plain JavaScript representation of this node. */
    toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
      if (!isDocument(doc))
        throw new TypeError("A document argument is required");
      const ctx = {
        anchors: /* @__PURE__ */ new Map(),
        doc,
        keep: true,
        mapAsMap: mapAsMap === true,
        mapKeyWarned: false,
        maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
      };
      const res = toJS(this, "", ctx);
      if (typeof onAnchor === "function")
        for (const { count, res: res2 } of ctx.anchors.values())
          onAnchor(res2, count);
      return typeof reviver === "function" ? applyReviver(reviver, { "": res }, "", res) : res;
    }
  };

  // node_modules/yaml/browser/dist/nodes/Alias.js
  var Alias = class extends NodeBase {
    constructor(source) {
      super(ALIAS);
      this.source = source;
      Object.defineProperty(this, "tag", {
        set() {
          throw new Error("Alias nodes cannot have tags");
        }
      });
    }
    /**
     * Resolve the value of this alias within `doc`, finding the last
     * instance of the `source` anchor before this node.
     */
    resolve(doc) {
      let found = void 0;
      visit(doc, {
        Node: (_key, node) => {
          if (node === this)
            return visit.BREAK;
          if (node.anchor === this.source)
            found = node;
        }
      });
      return found;
    }
    toJSON(_arg, ctx) {
      if (!ctx)
        return { source: this.source };
      const { anchors, doc, maxAliasCount } = ctx;
      const source = this.resolve(doc);
      if (!source) {
        const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
        throw new ReferenceError(msg);
      }
      let data = anchors.get(source);
      if (!data) {
        toJS(source, null, ctx);
        data = anchors.get(source);
      }
      if (!data || data.res === void 0) {
        const msg = "This should not happen: Alias anchor was not resolved?";
        throw new ReferenceError(msg);
      }
      if (maxAliasCount >= 0) {
        data.count += 1;
        if (data.aliasCount === 0)
          data.aliasCount = getAliasCount(doc, source, anchors);
        if (data.count * data.aliasCount > maxAliasCount) {
          const msg = "Excessive alias count indicates a resource exhaustion attack";
          throw new ReferenceError(msg);
        }
      }
      return data.res;
    }
    toString(ctx, _onComment, _onChompKeep) {
      const src = `*${this.source}`;
      if (ctx) {
        anchorIsValid(this.source);
        if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
          const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
          throw new Error(msg);
        }
        if (ctx.implicitKey)
          return `${src} `;
      }
      return src;
    }
  };
  function getAliasCount(doc, node, anchors) {
    if (isAlias(node)) {
      const source = node.resolve(doc);
      const anchor = anchors && source && anchors.get(source);
      return anchor ? anchor.count * anchor.aliasCount : 0;
    } else if (isCollection(node)) {
      let count = 0;
      for (const item of node.items) {
        const c = getAliasCount(doc, item, anchors);
        if (c > count)
          count = c;
      }
      return count;
    } else if (isPair(node)) {
      const kc = getAliasCount(doc, node.key, anchors);
      const vc = getAliasCount(doc, node.value, anchors);
      return Math.max(kc, vc);
    }
    return 1;
  }

  // node_modules/yaml/browser/dist/nodes/Scalar.js
  var isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";
  var Scalar = class extends NodeBase {
    constructor(value) {
      super(SCALAR);
      this.value = value;
    }
    toJSON(arg, ctx) {
      return ctx?.keep ? this.value : toJS(this.value, arg, ctx);
    }
    toString() {
      return String(this.value);
    }
  };
  Scalar.BLOCK_FOLDED = "BLOCK_FOLDED";
  Scalar.BLOCK_LITERAL = "BLOCK_LITERAL";
  Scalar.PLAIN = "PLAIN";
  Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE";
  Scalar.QUOTE_SINGLE = "QUOTE_SINGLE";

  // node_modules/yaml/browser/dist/doc/createNode.js
  var defaultTagPrefix = "tag:yaml.org,2002:";
  function findTagObject(value, tagName, tags) {
    if (tagName) {
      const match = tags.filter((t) => t.tag === tagName);
      const tagObj = match.find((t) => !t.format) ?? match[0];
      if (!tagObj)
        throw new Error(`Tag ${tagName} not found`);
      return tagObj;
    }
    return tags.find((t) => t.identify?.(value) && !t.format);
  }
  function createNode(value, tagName, ctx) {
    if (isDocument(value))
      value = value.contents;
    if (isNode(value))
      return value;
    if (isPair(value)) {
      const map2 = ctx.schema[MAP].createNode?.(ctx.schema, null, ctx);
      map2.items.push(value);
      return map2;
    }
    if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) {
      value = value.valueOf();
    }
    const { aliasDuplicateObjects, onAnchor, onTagObj, schema: schema4, sourceObjects } = ctx;
    let ref = void 0;
    if (aliasDuplicateObjects && value && typeof value === "object") {
      ref = sourceObjects.get(value);
      if (ref) {
        if (!ref.anchor)
          ref.anchor = onAnchor(value);
        return new Alias(ref.anchor);
      } else {
        ref = { anchor: null, node: null };
        sourceObjects.set(value, ref);
      }
    }
    if (tagName?.startsWith("!!"))
      tagName = defaultTagPrefix + tagName.slice(2);
    let tagObj = findTagObject(value, tagName, schema4.tags);
    if (!tagObj) {
      if (value && typeof value.toJSON === "function") {
        value = value.toJSON();
      }
      if (!value || typeof value !== "object") {
        const node2 = new Scalar(value);
        if (ref)
          ref.node = node2;
        return node2;
      }
      tagObj = value instanceof Map ? schema4[MAP] : Symbol.iterator in Object(value) ? schema4[SEQ] : schema4[MAP];
    }
    if (onTagObj) {
      onTagObj(tagObj);
      delete ctx.onTagObj;
    }
    const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar(value);
    if (tagName)
      node.tag = tagName;
    else if (!tagObj.default)
      node.tag = tagObj.tag;
    if (ref)
      ref.node = node;
    return node;
  }

  // node_modules/yaml/browser/dist/nodes/Collection.js
  function collectionFromPath(schema4, path, value) {
    let v = value;
    for (let i3 = path.length - 1; i3 >= 0; --i3) {
      const k = path[i3];
      if (typeof k === "number" && Number.isInteger(k) && k >= 0) {
        const a = [];
        a[k] = v;
        v = a;
      } else {
        v = /* @__PURE__ */ new Map([[k, v]]);
      }
    }
    return createNode(v, void 0, {
      aliasDuplicateObjects: false,
      keepUndefined: false,
      onAnchor: () => {
        throw new Error("This should not happen, please report a bug.");
      },
      schema: schema4,
      sourceObjects: /* @__PURE__ */ new Map()
    });
  }
  var isEmptyPath = (path) => path == null || typeof path === "object" && !!path[Symbol.iterator]().next().done;
  var Collection = class extends NodeBase {
    constructor(type, schema4) {
      super(type);
      Object.defineProperty(this, "schema", {
        value: schema4,
        configurable: true,
        enumerable: false,
        writable: true
      });
    }
    /**
     * Create a copy of this collection.
     *
     * @param schema - If defined, overwrites the original's schema
     */
    clone(schema4) {
      const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
      if (schema4)
        copy.schema = schema4;
      copy.items = copy.items.map((it) => isNode(it) || isPair(it) ? it.clone(schema4) : it);
      if (this.range)
        copy.range = this.range.slice();
      return copy;
    }
    /**
     * Adds a value to the collection. For `!!map` and `!!omap` the value must
     * be a Pair instance or a `{ key, value }` object, which may not have a key
     * that already exists in the map.
     */
    addIn(path, value) {
      if (isEmptyPath(path))
        this.add(value);
      else {
        const [key, ...rest] = path;
        const node = this.get(key, true);
        if (isCollection(node))
          node.addIn(rest, value);
        else if (node === void 0 && this.schema)
          this.set(key, collectionFromPath(this.schema, rest, value));
        else
          throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
    }
    /**
     * Removes a value from the collection.
     * @returns `true` if the item was found and removed.
     */
    deleteIn(path) {
      const [key, ...rest] = path;
      if (rest.length === 0)
        return this.delete(key);
      const node = this.get(key, true);
      if (isCollection(node))
        return node.deleteIn(rest);
      else
        throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
    }
    /**
     * Returns item at `key`, or `undefined` if not found. By default unwraps
     * scalar values from their surrounding node; to disable set `keepScalar` to
     * `true` (collections are always returned intact).
     */
    getIn(path, keepScalar) {
      const [key, ...rest] = path;
      const node = this.get(key, true);
      if (rest.length === 0)
        return !keepScalar && isScalar(node) ? node.value : node;
      else
        return isCollection(node) ? node.getIn(rest, keepScalar) : void 0;
    }
    hasAllNullValues(allowScalar) {
      return this.items.every((node) => {
        if (!isPair(node))
          return false;
        const n = node.value;
        return n == null || allowScalar && isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
      });
    }
    /**
     * Checks if the collection includes a value with the key `key`.
     */
    hasIn(path) {
      const [key, ...rest] = path;
      if (rest.length === 0)
        return this.has(key);
      const node = this.get(key, true);
      return isCollection(node) ? node.hasIn(rest) : false;
    }
    /**
     * Sets a value in this collection. For `!!set`, `value` needs to be a
     * boolean to add/remove the item from the set.
     */
    setIn(path, value) {
      const [key, ...rest] = path;
      if (rest.length === 0) {
        this.set(key, value);
      } else {
        const node = this.get(key, true);
        if (isCollection(node))
          node.setIn(rest, value);
        else if (node === void 0 && this.schema)
          this.set(key, collectionFromPath(this.schema, rest, value));
        else
          throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
    }
  };

  // node_modules/yaml/browser/dist/stringify/stringifyComment.js
  var stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, "#");
  function indentComment(comment, indent) {
    if (/^\n+$/.test(comment))
      return comment.substring(1);
    return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
  }
  var lineComment = (str, indent, comment) => str.endsWith("\n") ? indentComment(comment, indent) : comment.includes("\n") ? "\n" + indentComment(comment, indent) : (str.endsWith(" ") ? "" : " ") + comment;

  // node_modules/yaml/browser/dist/stringify/foldFlowLines.js
  var FOLD_FLOW = "flow";
  var FOLD_BLOCK = "block";
  var FOLD_QUOTED = "quoted";
  function foldFlowLines(text, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
    if (!lineWidth || lineWidth < 0)
      return text;
    if (lineWidth < minContentWidth)
      minContentWidth = 0;
    const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
    if (text.length <= endStep)
      return text;
    const folds = [];
    const escapedFolds = {};
    let end = lineWidth - indent.length;
    if (typeof indentAtStart === "number") {
      if (indentAtStart > lineWidth - Math.max(2, minContentWidth))
        folds.push(0);
      else
        end = lineWidth - indentAtStart;
    }
    let split = void 0;
    let prev = void 0;
    let overflow = false;
    let i3 = -1;
    let escStart = -1;
    let escEnd = -1;
    if (mode === FOLD_BLOCK) {
      i3 = consumeMoreIndentedLines(text, i3, indent.length);
      if (i3 !== -1)
        end = i3 + endStep;
    }
    for (let ch; ch = text[i3 += 1]; ) {
      if (mode === FOLD_QUOTED && ch === "\\") {
        escStart = i3;
        switch (text[i3 + 1]) {
          case "x":
            i3 += 3;
            break;
          case "u":
            i3 += 5;
            break;
          case "U":
            i3 += 9;
            break;
          default:
            i3 += 1;
        }
        escEnd = i3;
      }
      if (ch === "\n") {
        if (mode === FOLD_BLOCK)
          i3 = consumeMoreIndentedLines(text, i3, indent.length);
        end = i3 + indent.length + endStep;
        split = void 0;
      } else {
        if (ch === " " && prev && prev !== " " && prev !== "\n" && prev !== "	") {
          const next = text[i3 + 1];
          if (next && next !== " " && next !== "\n" && next !== "	")
            split = i3;
        }
        if (i3 >= end) {
          if (split) {
            folds.push(split);
            end = split + endStep;
            split = void 0;
          } else if (mode === FOLD_QUOTED) {
            while (prev === " " || prev === "	") {
              prev = ch;
              ch = text[i3 += 1];
              overflow = true;
            }
            const j = i3 > escEnd + 1 ? i3 - 2 : escStart - 1;
            if (escapedFolds[j])
              return text;
            folds.push(j);
            escapedFolds[j] = true;
            end = j + endStep;
            split = void 0;
          } else {
            overflow = true;
          }
        }
      }
      prev = ch;
    }
    if (overflow && onOverflow)
      onOverflow();
    if (folds.length === 0)
      return text;
    if (onFold)
      onFold();
    let res = text.slice(0, folds[0]);
    for (let i4 = 0; i4 < folds.length; ++i4) {
      const fold = folds[i4];
      const end2 = folds[i4 + 1] || text.length;
      if (fold === 0)
        res = `
${indent}${text.slice(0, end2)}`;
      else {
        if (mode === FOLD_QUOTED && escapedFolds[fold])
          res += `${text[fold]}\\`;
        res += `
${indent}${text.slice(fold + 1, end2)}`;
      }
    }
    return res;
  }
  function consumeMoreIndentedLines(text, i3, indent) {
    let end = i3;
    let start = i3 + 1;
    let ch = text[start];
    while (ch === " " || ch === "	") {
      if (i3 < start + indent) {
        ch = text[++i3];
      } else {
        do {
          ch = text[++i3];
        } while (ch && ch !== "\n");
        end = i3;
        start = i3 + 1;
        ch = text[start];
      }
    }
    return end;
  }

  // node_modules/yaml/browser/dist/stringify/stringifyString.js
  var getFoldOptions = (ctx, isBlock2) => ({
    indentAtStart: isBlock2 ? ctx.indent.length : ctx.indentAtStart,
    lineWidth: ctx.options.lineWidth,
    minContentWidth: ctx.options.minContentWidth
  });
  var containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
  function lineLengthOverLimit(str, lineWidth, indentLength) {
    if (!lineWidth || lineWidth < 0)
      return false;
    const limit = lineWidth - indentLength;
    const strLen = str.length;
    if (strLen <= limit)
      return false;
    for (let i3 = 0, start = 0; i3 < strLen; ++i3) {
      if (str[i3] === "\n") {
        if (i3 - start > limit)
          return true;
        start = i3 + 1;
        if (strLen - start <= limit)
          return false;
      }
    }
    return true;
  }
  function doubleQuotedString(value, ctx) {
    const json = JSON.stringify(value);
    if (ctx.options.doubleQuotedAsJSON)
      return json;
    const { implicitKey } = ctx;
    const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
    const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
    let str = "";
    let start = 0;
    for (let i3 = 0, ch = json[i3]; ch; ch = json[++i3]) {
      if (ch === " " && json[i3 + 1] === "\\" && json[i3 + 2] === "n") {
        str += json.slice(start, i3) + "\\ ";
        i3 += 1;
        start = i3;
        ch = "\\";
      }
      if (ch === "\\")
        switch (json[i3 + 1]) {
          case "u":
            {
              str += json.slice(start, i3);
              const code = json.substr(i3 + 2, 4);
              switch (code) {
                case "0000":
                  str += "\\0";
                  break;
                case "0007":
                  str += "\\a";
                  break;
                case "000b":
                  str += "\\v";
                  break;
                case "001b":
                  str += "\\e";
                  break;
                case "0085":
                  str += "\\N";
                  break;
                case "00a0":
                  str += "\\_";
                  break;
                case "2028":
                  str += "\\L";
                  break;
                case "2029":
                  str += "\\P";
                  break;
                default:
                  if (code.substr(0, 2) === "00")
                    str += "\\x" + code.substr(2);
                  else
                    str += json.substr(i3, 6);
              }
              i3 += 5;
              start = i3 + 1;
            }
            break;
          case "n":
            if (implicitKey || json[i3 + 2] === '"' || json.length < minMultiLineLength) {
              i3 += 1;
            } else {
              str += json.slice(start, i3) + "\n\n";
              while (json[i3 + 2] === "\\" && json[i3 + 3] === "n" && json[i3 + 4] !== '"') {
                str += "\n";
                i3 += 2;
              }
              str += indent;
              if (json[i3 + 2] === " ")
                str += "\\";
              i3 += 1;
              start = i3 + 1;
            }
            break;
          default:
            i3 += 1;
        }
    }
    str = start ? str + json.slice(start) : json;
    return implicitKey ? str : foldFlowLines(str, indent, FOLD_QUOTED, getFoldOptions(ctx, false));
  }
  function singleQuotedString(value, ctx) {
    if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes("\n") || /[ \t]\n|\n[ \t]/.test(value))
      return doubleQuotedString(value, ctx);
    const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
    const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&
${indent}`) + "'";
    return ctx.implicitKey ? res : foldFlowLines(res, indent, FOLD_FLOW, getFoldOptions(ctx, false));
  }
  function quotedString(value, ctx) {
    const { singleQuote } = ctx.options;
    let qs;
    if (singleQuote === false)
      qs = doubleQuotedString;
    else {
      const hasDouble = value.includes('"');
      const hasSingle = value.includes("'");
      if (hasDouble && !hasSingle)
        qs = singleQuotedString;
      else if (hasSingle && !hasDouble)
        qs = doubleQuotedString;
      else
        qs = singleQuote ? singleQuotedString : doubleQuotedString;
    }
    return qs(value, ctx);
  }
  var blockEndNewlines;
  try {
    blockEndNewlines = new RegExp("(^|(?<!\n))\n+(?!\n|$)", "g");
  } catch {
    blockEndNewlines = /\n+(?!\n|$)/g;
  }
  function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
    const { blockQuote, commentString, lineWidth } = ctx.options;
    if (!blockQuote || /\n[\t ]+$/.test(value) || /^\s*$/.test(value)) {
      return quotedString(value, ctx);
    }
    const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
    const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.BLOCK_FOLDED ? false : type === Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
    if (!value)
      return literal ? "|\n" : ">\n";
    let chomp;
    let endStart;
    for (endStart = value.length; endStart > 0; --endStart) {
      const ch = value[endStart - 1];
      if (ch !== "\n" && ch !== "	" && ch !== " ")
        break;
    }
    let end = value.substring(endStart);
    const endNlPos = end.indexOf("\n");
    if (endNlPos === -1) {
      chomp = "-";
    } else if (value === end || endNlPos !== end.length - 1) {
      chomp = "+";
      if (onChompKeep)
        onChompKeep();
    } else {
      chomp = "";
    }
    if (end) {
      value = value.slice(0, -end.length);
      if (end[end.length - 1] === "\n")
        end = end.slice(0, -1);
      end = end.replace(blockEndNewlines, `$&${indent}`);
    }
    let startWithSpace = false;
    let startEnd;
    let startNlPos = -1;
    for (startEnd = 0; startEnd < value.length; ++startEnd) {
      const ch = value[startEnd];
      if (ch === " ")
        startWithSpace = true;
      else if (ch === "\n")
        startNlPos = startEnd;
      else
        break;
    }
    let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
    if (start) {
      value = value.substring(start.length);
      start = start.replace(/\n+/g, `$&${indent}`);
    }
    const indentSize = indent ? "2" : "1";
    let header = (startWithSpace ? indentSize : "") + chomp;
    if (comment) {
      header += " " + commentString(comment.replace(/ ?[\r\n]+/g, " "));
      if (onComment)
        onComment();
    }
    if (!literal) {
      const foldedValue = value.replace(/\n+/g, "\n$&").replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
      let literalFallback = false;
      const foldOptions = getFoldOptions(ctx, true);
      if (blockQuote !== "folded" && type !== Scalar.BLOCK_FOLDED) {
        foldOptions.onOverflow = () => {
          literalFallback = true;
        };
      }
      const body = foldFlowLines(`${start}${foldedValue}${end}`, indent, FOLD_BLOCK, foldOptions);
      if (!literalFallback)
        return `>${header}
${indent}${body}`;
    }
    value = value.replace(/\n+/g, `$&${indent}`);
    return `|${header}
${indent}${start}${value}${end}`;
  }
  function plainString(item, ctx, onComment, onChompKeep) {
    const { type, value } = item;
    const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
    if (implicitKey && value.includes("\n") || inFlow && /[[\]{},]/.test(value)) {
      return quotedString(value, ctx);
    }
    if (!value || /^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
      return implicitKey || inFlow || !value.includes("\n") ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
    }
    if (!implicitKey && !inFlow && type !== Scalar.PLAIN && value.includes("\n")) {
      return blockString(item, ctx, onComment, onChompKeep);
    }
    if (containsDocumentMarker(value)) {
      if (indent === "") {
        ctx.forceBlockIndent = true;
        return blockString(item, ctx, onComment, onChompKeep);
      } else if (implicitKey && indent === indentStep) {
        return quotedString(value, ctx);
      }
    }
    const str = value.replace(/\n+/g, `$&
${indent}`);
    if (actualString) {
      const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str);
      const { compat, tags } = ctx.doc.schema;
      if (tags.some(test) || compat?.some(test))
        return quotedString(value, ctx);
    }
    return implicitKey ? str : foldFlowLines(str, indent, FOLD_FLOW, getFoldOptions(ctx, false));
  }
  function stringifyString(item, ctx, onComment, onChompKeep) {
    const { implicitKey, inFlow } = ctx;
    const ss = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
    let { type } = item;
    if (type !== Scalar.QUOTE_DOUBLE) {
      if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value))
        type = Scalar.QUOTE_DOUBLE;
    }
    const _stringify = (_type) => {
      switch (_type) {
        case Scalar.BLOCK_FOLDED:
        case Scalar.BLOCK_LITERAL:
          return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
        case Scalar.QUOTE_DOUBLE:
          return doubleQuotedString(ss.value, ctx);
        case Scalar.QUOTE_SINGLE:
          return singleQuotedString(ss.value, ctx);
        case Scalar.PLAIN:
          return plainString(ss, ctx, onComment, onChompKeep);
        default:
          return null;
      }
    };
    let res = _stringify(type);
    if (res === null) {
      const { defaultKeyType, defaultStringType } = ctx.options;
      const t = implicitKey && defaultKeyType || defaultStringType;
      res = _stringify(t);
      if (res === null)
        throw new Error(`Unsupported default string type ${t}`);
    }
    return res;
  }

  // node_modules/yaml/browser/dist/stringify/stringify.js
  function createStringifyContext(doc, options) {
    const opt = Object.assign({
      blockQuote: true,
      commentString: stringifyComment,
      defaultKeyType: null,
      defaultStringType: "PLAIN",
      directives: null,
      doubleQuotedAsJSON: false,
      doubleQuotedMinMultiLineLength: 40,
      falseStr: "false",
      flowCollectionPadding: true,
      indentSeq: true,
      lineWidth: 80,
      minContentWidth: 20,
      nullStr: "null",
      simpleKeys: false,
      singleQuote: null,
      trueStr: "true",
      verifyAliasOrder: true
    }, doc.schema.toStringOptions, options);
    let inFlow;
    switch (opt.collectionStyle) {
      case "block":
        inFlow = false;
        break;
      case "flow":
        inFlow = true;
        break;
      default:
        inFlow = null;
    }
    return {
      anchors: /* @__PURE__ */ new Set(),
      doc,
      flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
      indent: "",
      indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
      inFlow,
      options: opt
    };
  }
  function getTagObject(tags, item) {
    if (item.tag) {
      const match = tags.filter((t) => t.tag === item.tag);
      if (match.length > 0)
        return match.find((t) => t.format === item.format) ?? match[0];
    }
    let tagObj = void 0;
    let obj;
    if (isScalar(item)) {
      obj = item.value;
      let match = tags.filter((t) => t.identify?.(obj));
      if (match.length > 1) {
        const testMatch = match.filter((t) => t.test);
        if (testMatch.length > 0)
          match = testMatch;
      }
      tagObj = match.find((t) => t.format === item.format) ?? match.find((t) => !t.format);
    } else {
      obj = item;
      tagObj = tags.find((t) => t.nodeClass && obj instanceof t.nodeClass);
    }
    if (!tagObj) {
      const name = obj?.constructor?.name ?? typeof obj;
      throw new Error(`Tag not resolved for ${name} value`);
    }
    return tagObj;
  }
  function stringifyProps(node, tagObj, { anchors, doc }) {
    if (!doc.directives)
      return "";
    const props = [];
    const anchor = (isScalar(node) || isCollection(node)) && node.anchor;
    if (anchor && anchorIsValid(anchor)) {
      anchors.add(anchor);
      props.push(`&${anchor}`);
    }
    const tag = node.tag ? node.tag : tagObj.default ? null : tagObj.tag;
    if (tag)
      props.push(doc.directives.tagString(tag));
    return props.join(" ");
  }
  function stringify(item, ctx, onComment, onChompKeep) {
    if (isPair(item))
      return item.toString(ctx, onComment, onChompKeep);
    if (isAlias(item)) {
      if (ctx.doc.directives)
        return item.toString(ctx);
      if (ctx.resolvedAliases?.has(item)) {
        throw new TypeError(`Cannot stringify circular structure without alias nodes`);
      } else {
        if (ctx.resolvedAliases)
          ctx.resolvedAliases.add(item);
        else
          ctx.resolvedAliases = /* @__PURE__ */ new Set([item]);
        item = item.resolve(ctx.doc);
      }
    }
    let tagObj = void 0;
    const node = isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
    if (!tagObj)
      tagObj = getTagObject(ctx.doc.schema.tags, node);
    const props = stringifyProps(node, tagObj, ctx);
    if (props.length > 0)
      ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
    const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : isScalar(node) ? stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
    if (!props)
      return str;
    return isScalar(node) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}
${ctx.indent}${str}`;
  }

  // node_modules/yaml/browser/dist/stringify/stringifyPair.js
  function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
    const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
    let keyComment = isNode(key) && key.comment || null;
    if (simpleKeys) {
      if (keyComment) {
        throw new Error("With simple keys, key nodes cannot have comments");
      }
      if (isCollection(key) || !isNode(key) && typeof key === "object") {
        const msg = "With simple keys, collection cannot be used as a key value";
        throw new Error(msg);
      }
    }
    let explicitKey = !simpleKeys && (!key || keyComment && value == null && !ctx.inFlow || isCollection(key) || (isScalar(key) ? key.type === Scalar.BLOCK_FOLDED || key.type === Scalar.BLOCK_LITERAL : typeof key === "object"));
    ctx = Object.assign({}, ctx, {
      allNullValues: false,
      implicitKey: !explicitKey && (simpleKeys || !allNullValues),
      indent: indent + indentStep
    });
    let keyCommentDone = false;
    let chompKeep = false;
    let str = stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
    if (!explicitKey && !ctx.inFlow && str.length > 1024) {
      if (simpleKeys)
        throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
      explicitKey = true;
    }
    if (ctx.inFlow) {
      if (allNullValues || value == null) {
        if (keyCommentDone && onComment)
          onComment();
        return str === "" ? "?" : explicitKey ? `? ${str}` : str;
      }
    } else if (allNullValues && !simpleKeys || value == null && explicitKey) {
      str = `? ${str}`;
      if (keyComment && !keyCommentDone) {
        str += lineComment(str, ctx.indent, commentString(keyComment));
      } else if (chompKeep && onChompKeep)
        onChompKeep();
      return str;
    }
    if (keyCommentDone)
      keyComment = null;
    if (explicitKey) {
      if (keyComment)
        str += lineComment(str, ctx.indent, commentString(keyComment));
      str = `? ${str}
${indent}:`;
    } else {
      str = `${str}:`;
      if (keyComment)
        str += lineComment(str, ctx.indent, commentString(keyComment));
    }
    let vsb, vcb, valueComment;
    if (isNode(value)) {
      vsb = !!value.spaceBefore;
      vcb = value.commentBefore;
      valueComment = value.comment;
    } else {
      vsb = false;
      vcb = null;
      valueComment = null;
      if (value && typeof value === "object")
        value = doc.createNode(value);
    }
    ctx.implicitKey = false;
    if (!explicitKey && !keyComment && isScalar(value))
      ctx.indentAtStart = str.length + 1;
    chompKeep = false;
    if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && isSeq(value) && !value.flow && !value.tag && !value.anchor) {
      ctx.indent = ctx.indent.substring(2);
    }
    let valueCommentDone = false;
    const valueStr = stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
    let ws = " ";
    if (keyComment || vsb || vcb) {
      ws = vsb ? "\n" : "";
      if (vcb) {
        const cs = commentString(vcb);
        ws += `
${indentComment(cs, ctx.indent)}`;
      }
      if (valueStr === "" && !ctx.inFlow) {
        if (ws === "\n")
          ws = "\n\n";
      } else {
        ws += `
${ctx.indent}`;
      }
    } else if (!explicitKey && isCollection(value)) {
      const vs0 = valueStr[0];
      const nl0 = valueStr.indexOf("\n");
      const hasNewline = nl0 !== -1;
      const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
      if (hasNewline || !flow) {
        let hasPropsLine = false;
        if (hasNewline && (vs0 === "&" || vs0 === "!")) {
          let sp0 = valueStr.indexOf(" ");
          if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") {
            sp0 = valueStr.indexOf(" ", sp0 + 1);
          }
          if (sp0 === -1 || nl0 < sp0)
            hasPropsLine = true;
        }
        if (!hasPropsLine)
          ws = `
${ctx.indent}`;
      }
    } else if (valueStr === "" || valueStr[0] === "\n") {
      ws = "";
    }
    str += ws + valueStr;
    if (ctx.inFlow) {
      if (valueCommentDone && onComment)
        onComment();
    } else if (valueComment && !valueCommentDone) {
      str += lineComment(str, ctx.indent, commentString(valueComment));
    } else if (chompKeep && onChompKeep) {
      onChompKeep();
    }
    return str;
  }

  // node_modules/yaml/browser/dist/log.js
  function warn(logLevel, warning) {
    if (logLevel === "debug" || logLevel === "warn") {
      if (typeof process !== "undefined" && process.emitWarning)
        process.emitWarning(warning);
      else
        console.warn(warning);
    }
  }

  // node_modules/yaml/browser/dist/schema/yaml-1.1/merge.js
  var MERGE_KEY = "<<";
  var merge = {
    identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
    default: "key",
    tag: "tag:yaml.org,2002:merge",
    test: /^<<$/,
    resolve: () => Object.assign(new Scalar(Symbol(MERGE_KEY)), {
      addToJSMap: addMergeToJSMap
    }),
    stringify: () => MERGE_KEY
  };
  var isMergeKey = (ctx, key) => (merge.identify(key) || isScalar(key) && (!key.type || key.type === Scalar.PLAIN) && merge.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge.tag && tag.default);
  function addMergeToJSMap(ctx, map2, value) {
    value = ctx && isAlias(value) ? value.resolve(ctx.doc) : value;
    if (isSeq(value))
      for (const it of value.items)
        mergeValue(ctx, map2, it);
    else if (Array.isArray(value))
      for (const it of value)
        mergeValue(ctx, map2, it);
    else
      mergeValue(ctx, map2, value);
  }
  function mergeValue(ctx, map2, value) {
    const source = ctx && isAlias(value) ? value.resolve(ctx.doc) : value;
    if (!isMap(source))
      throw new Error("Merge sources must be maps or map aliases");
    const srcMap = source.toJSON(null, ctx, Map);
    for (const [key, value2] of srcMap) {
      if (map2 instanceof Map) {
        if (!map2.has(key))
          map2.set(key, value2);
      } else if (map2 instanceof Set) {
        map2.add(key);
      } else if (!Object.prototype.hasOwnProperty.call(map2, key)) {
        Object.defineProperty(map2, key, {
          value: value2,
          writable: true,
          enumerable: true,
          configurable: true
        });
      }
    }
    return map2;
  }

  // node_modules/yaml/browser/dist/nodes/addPairToJSMap.js
  function addPairToJSMap(ctx, map2, { key, value }) {
    if (isNode(key) && key.addToJSMap)
      key.addToJSMap(ctx, map2, value);
    else if (isMergeKey(ctx, key))
      addMergeToJSMap(ctx, map2, value);
    else {
      const jsKey = toJS(key, "", ctx);
      if (map2 instanceof Map) {
        map2.set(jsKey, toJS(value, jsKey, ctx));
      } else if (map2 instanceof Set) {
        map2.add(jsKey);
      } else {
        const stringKey = stringifyKey(key, jsKey, ctx);
        const jsValue = toJS(value, stringKey, ctx);
        if (stringKey in map2)
          Object.defineProperty(map2, stringKey, {
            value: jsValue,
            writable: true,
            enumerable: true,
            configurable: true
          });
        else
          map2[stringKey] = jsValue;
      }
    }
    return map2;
  }
  function stringifyKey(key, jsKey, ctx) {
    if (jsKey === null)
      return "";
    if (typeof jsKey !== "object")
      return String(jsKey);
    if (isNode(key) && ctx?.doc) {
      const strCtx = createStringifyContext(ctx.doc, {});
      strCtx.anchors = /* @__PURE__ */ new Set();
      for (const node of ctx.anchors.keys())
        strCtx.anchors.add(node.anchor);
      strCtx.inFlow = true;
      strCtx.inStringifyKey = true;
      const strKey = key.toString(strCtx);
      if (!ctx.mapKeyWarned) {
        let jsonStr = JSON.stringify(strKey);
        if (jsonStr.length > 40)
          jsonStr = jsonStr.substring(0, 36) + '..."';
        warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
        ctx.mapKeyWarned = true;
      }
      return strKey;
    }
    return JSON.stringify(jsKey);
  }

  // node_modules/yaml/browser/dist/nodes/Pair.js
  function createPair(key, value, ctx) {
    const k = createNode(key, void 0, ctx);
    const v = createNode(value, void 0, ctx);
    return new Pair(k, v);
  }
  var Pair = class _Pair {
    constructor(key, value = null) {
      Object.defineProperty(this, NODE_TYPE, { value: PAIR });
      this.key = key;
      this.value = value;
    }
    clone(schema4) {
      let { key, value } = this;
      if (isNode(key))
        key = key.clone(schema4);
      if (isNode(value))
        value = value.clone(schema4);
      return new _Pair(key, value);
    }
    toJSON(_, ctx) {
      const pair = ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
      return addPairToJSMap(ctx, pair, this);
    }
    toString(ctx, onComment, onChompKeep) {
      return ctx?.doc ? stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
    }
  };

  // node_modules/yaml/browser/dist/stringify/stringifyCollection.js
  function stringifyCollection(collection, ctx, options) {
    const flow = ctx.inFlow ?? collection.flow;
    const stringify4 = flow ? stringifyFlowCollection : stringifyBlockCollection;
    return stringify4(collection, ctx, options);
  }
  function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
    const { indent, options: { commentString } } = ctx;
    const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
    let chompKeep = false;
    const lines = [];
    for (let i3 = 0; i3 < items.length; ++i3) {
      const item = items[i3];
      let comment2 = null;
      if (isNode(item)) {
        if (!chompKeep && item.spaceBefore)
          lines.push("");
        addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
        if (item.comment)
          comment2 = item.comment;
      } else if (isPair(item)) {
        const ik = isNode(item.key) ? item.key : null;
        if (ik) {
          if (!chompKeep && ik.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
        }
      }
      chompKeep = false;
      let str2 = stringify(item, itemCtx, () => comment2 = null, () => chompKeep = true);
      if (comment2)
        str2 += lineComment(str2, itemIndent, commentString(comment2));
      if (chompKeep && comment2)
        chompKeep = false;
      lines.push(blockItemPrefix + str2);
    }
    let str;
    if (lines.length === 0) {
      str = flowChars.start + flowChars.end;
    } else {
      str = lines[0];
      for (let i3 = 1; i3 < lines.length; ++i3) {
        const line2 = lines[i3];
        str += line2 ? `
${indent}${line2}` : "\n";
      }
    }
    if (comment) {
      str += "\n" + indentComment(commentString(comment), indent);
      if (onComment)
        onComment();
    } else if (chompKeep && onChompKeep)
      onChompKeep();
    return str;
  }
  function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
    const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
    itemIndent += indentStep;
    const itemCtx = Object.assign({}, ctx, {
      indent: itemIndent,
      inFlow: true,
      type: null
    });
    let reqNewline = false;
    let linesAtValue = 0;
    const lines = [];
    for (let i3 = 0; i3 < items.length; ++i3) {
      const item = items[i3];
      let comment = null;
      if (isNode(item)) {
        if (item.spaceBefore)
          lines.push("");
        addCommentBefore(ctx, lines, item.commentBefore, false);
        if (item.comment)
          comment = item.comment;
      } else if (isPair(item)) {
        const ik = isNode(item.key) ? item.key : null;
        if (ik) {
          if (ik.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, ik.commentBefore, false);
          if (ik.comment)
            reqNewline = true;
        }
        const iv = isNode(item.value) ? item.value : null;
        if (iv) {
          if (iv.comment)
            comment = iv.comment;
          if (iv.commentBefore)
            reqNewline = true;
        } else if (item.value == null && ik?.comment) {
          comment = ik.comment;
        }
      }
      if (comment)
        reqNewline = true;
      let str = stringify(item, itemCtx, () => comment = null);
      if (i3 < items.length - 1)
        str += ",";
      if (comment)
        str += lineComment(str, itemIndent, commentString(comment));
      if (!reqNewline && (lines.length > linesAtValue || str.includes("\n")))
        reqNewline = true;
      lines.push(str);
      linesAtValue = lines.length;
    }
    const { start, end } = flowChars;
    if (lines.length === 0) {
      return start + end;
    } else {
      if (!reqNewline) {
        const len = lines.reduce((sum, line2) => sum + line2.length + 2, 2);
        reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
      }
      if (reqNewline) {
        let str = start;
        for (const line2 of lines)
          str += line2 ? `
${indentStep}${indent}${line2}` : "\n";
        return `${str}
${indent}${end}`;
      } else {
        return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
      }
    }
  }
  function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
    if (comment && chompKeep)
      comment = comment.replace(/^\n+/, "");
    if (comment) {
      const ic = indentComment(commentString(comment), indent);
      lines.push(ic.trimStart());
    }
  }

  // node_modules/yaml/browser/dist/nodes/YAMLMap.js
  function findPair(items, key) {
    const k = isScalar(key) ? key.value : key;
    for (const it of items) {
      if (isPair(it)) {
        if (it.key === key || it.key === k)
          return it;
        if (isScalar(it.key) && it.key.value === k)
          return it;
      }
    }
    return void 0;
  }
  var YAMLMap = class extends Collection {
    static get tagName() {
      return "tag:yaml.org,2002:map";
    }
    constructor(schema4) {
      super(MAP, schema4);
      this.items = [];
    }
    /**
     * A generic collection parsing method that can be extended
     * to other node classes that inherit from YAMLMap
     */
    static from(schema4, obj, ctx) {
      const { keepUndefined, replacer } = ctx;
      const map2 = new this(schema4);
      const add = (key, value) => {
        if (typeof replacer === "function")
          value = replacer.call(obj, key, value);
        else if (Array.isArray(replacer) && !replacer.includes(key))
          return;
        if (value !== void 0 || keepUndefined)
          map2.items.push(createPair(key, value, ctx));
      };
      if (obj instanceof Map) {
        for (const [key, value] of obj)
          add(key, value);
      } else if (obj && typeof obj === "object") {
        for (const key of Object.keys(obj))
          add(key, obj[key]);
      }
      if (typeof schema4.sortMapEntries === "function") {
        map2.items.sort(schema4.sortMapEntries);
      }
      return map2;
    }
    /**
     * Adds a value to the collection.
     *
     * @param overwrite - If not set `true`, using a key that is already in the
     *   collection will throw. Otherwise, overwrites the previous value.
     */
    add(pair, overwrite) {
      let _pair;
      if (isPair(pair))
        _pair = pair;
      else if (!pair || typeof pair !== "object" || !("key" in pair)) {
        _pair = new Pair(pair, pair?.value);
      } else
        _pair = new Pair(pair.key, pair.value);
      const prev = findPair(this.items, _pair.key);
      const sortEntries = this.schema?.sortMapEntries;
      if (prev) {
        if (!overwrite)
          throw new Error(`Key ${_pair.key} already set`);
        if (isScalar(prev.value) && isScalarValue(_pair.value))
          prev.value.value = _pair.value;
        else
          prev.value = _pair.value;
      } else if (sortEntries) {
        const i3 = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
        if (i3 === -1)
          this.items.push(_pair);
        else
          this.items.splice(i3, 0, _pair);
      } else {
        this.items.push(_pair);
      }
    }
    delete(key) {
      const it = findPair(this.items, key);
      if (!it)
        return false;
      const del = this.items.splice(this.items.indexOf(it), 1);
      return del.length > 0;
    }
    get(key, keepScalar) {
      const it = findPair(this.items, key);
      const node = it?.value;
      return (!keepScalar && isScalar(node) ? node.value : node) ?? void 0;
    }
    has(key) {
      return !!findPair(this.items, key);
    }
    set(key, value) {
      this.add(new Pair(key, value), true);
    }
    /**
     * @param ctx - Conversion context, originally set in Document#toJS()
     * @param {Class} Type - If set, forces the returned collection type
     * @returns Instance of Type, Map, or Object
     */
    toJSON(_, ctx, Type) {
      const map2 = Type ? new Type() : ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
      if (ctx?.onCreate)
        ctx.onCreate(map2);
      for (const item of this.items)
        addPairToJSMap(ctx, map2, item);
      return map2;
    }
    toString(ctx, onComment, onChompKeep) {
      if (!ctx)
        return JSON.stringify(this);
      for (const item of this.items) {
        if (!isPair(item))
          throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
      }
      if (!ctx.allNullValues && this.hasAllNullValues(false))
        ctx = Object.assign({}, ctx, { allNullValues: true });
      return stringifyCollection(this, ctx, {
        blockItemPrefix: "",
        flowChars: { start: "{", end: "}" },
        itemIndent: ctx.indent || "",
        onChompKeep,
        onComment
      });
    }
  };

  // node_modules/yaml/browser/dist/schema/common/map.js
  var map = {
    collection: "map",
    default: true,
    nodeClass: YAMLMap,
    tag: "tag:yaml.org,2002:map",
    resolve(map2, onError) {
      if (!isMap(map2))
        onError("Expected a mapping for this tag");
      return map2;
    },
    createNode: (schema4, obj, ctx) => YAMLMap.from(schema4, obj, ctx)
  };

  // node_modules/yaml/browser/dist/nodes/YAMLSeq.js
  var YAMLSeq = class extends Collection {
    static get tagName() {
      return "tag:yaml.org,2002:seq";
    }
    constructor(schema4) {
      super(SEQ, schema4);
      this.items = [];
    }
    add(value) {
      this.items.push(value);
    }
    /**
     * Removes a value from the collection.
     *
     * `key` must contain a representation of an integer for this to succeed.
     * It may be wrapped in a `Scalar`.
     *
     * @returns `true` if the item was found and removed.
     */
    delete(key) {
      const idx = asItemIndex(key);
      if (typeof idx !== "number")
        return false;
      const del = this.items.splice(idx, 1);
      return del.length > 0;
    }
    get(key, keepScalar) {
      const idx = asItemIndex(key);
      if (typeof idx !== "number")
        return void 0;
      const it = this.items[idx];
      return !keepScalar && isScalar(it) ? it.value : it;
    }
    /**
     * Checks if the collection includes a value with the key `key`.
     *
     * `key` must contain a representation of an integer for this to succeed.
     * It may be wrapped in a `Scalar`.
     */
    has(key) {
      const idx = asItemIndex(key);
      return typeof idx === "number" && idx < this.items.length;
    }
    /**
     * Sets a value in this collection. For `!!set`, `value` needs to be a
     * boolean to add/remove the item from the set.
     *
     * If `key` does not contain a representation of an integer, this will throw.
     * It may be wrapped in a `Scalar`.
     */
    set(key, value) {
      const idx = asItemIndex(key);
      if (typeof idx !== "number")
        throw new Error(`Expected a valid index, not ${key}.`);
      const prev = this.items[idx];
      if (isScalar(prev) && isScalarValue(value))
        prev.value = value;
      else
        this.items[idx] = value;
    }
    toJSON(_, ctx) {
      const seq2 = [];
      if (ctx?.onCreate)
        ctx.onCreate(seq2);
      let i3 = 0;
      for (const item of this.items)
        seq2.push(toJS(item, String(i3++), ctx));
      return seq2;
    }
    toString(ctx, onComment, onChompKeep) {
      if (!ctx)
        return JSON.stringify(this);
      return stringifyCollection(this, ctx, {
        blockItemPrefix: "- ",
        flowChars: { start: "[", end: "]" },
        itemIndent: (ctx.indent || "") + "  ",
        onChompKeep,
        onComment
      });
    }
    static from(schema4, obj, ctx) {
      const { replacer } = ctx;
      const seq2 = new this(schema4);
      if (obj && Symbol.iterator in Object(obj)) {
        let i3 = 0;
        for (let it of obj) {
          if (typeof replacer === "function") {
            const key = obj instanceof Set ? it : String(i3++);
            it = replacer.call(obj, key, it);
          }
          seq2.items.push(createNode(it, void 0, ctx));
        }
      }
      return seq2;
    }
  };
  function asItemIndex(key) {
    let idx = isScalar(key) ? key.value : key;
    if (idx && typeof idx === "string")
      idx = Number(idx);
    return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
  }

  // node_modules/yaml/browser/dist/schema/common/seq.js
  var seq = {
    collection: "seq",
    default: true,
    nodeClass: YAMLSeq,
    tag: "tag:yaml.org,2002:seq",
    resolve(seq2, onError) {
      if (!isSeq(seq2))
        onError("Expected a sequence for this tag");
      return seq2;
    },
    createNode: (schema4, obj, ctx) => YAMLSeq.from(schema4, obj, ctx)
  };

  // node_modules/yaml/browser/dist/schema/common/string.js
  var string = {
    identify: (value) => typeof value === "string",
    default: true,
    tag: "tag:yaml.org,2002:str",
    resolve: (str) => str,
    stringify(item, ctx, onComment, onChompKeep) {
      ctx = Object.assign({ actualString: true }, ctx);
      return stringifyString(item, ctx, onComment, onChompKeep);
    }
  };

  // node_modules/yaml/browser/dist/schema/common/null.js
  var nullTag = {
    identify: (value) => value == null,
    createNode: () => new Scalar(null),
    default: true,
    tag: "tag:yaml.org,2002:null",
    test: /^(?:~|[Nn]ull|NULL)?$/,
    resolve: () => new Scalar(null),
    stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
  };

  // node_modules/yaml/browser/dist/schema/core/bool.js
  var boolTag = {
    identify: (value) => typeof value === "boolean",
    default: true,
    tag: "tag:yaml.org,2002:bool",
    test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
    resolve: (str) => new Scalar(str[0] === "t" || str[0] === "T"),
    stringify({ source, value }, ctx) {
      if (source && boolTag.test.test(source)) {
        const sv = source[0] === "t" || source[0] === "T";
        if (value === sv)
          return source;
      }
      return value ? ctx.options.trueStr : ctx.options.falseStr;
    }
  };

  // node_modules/yaml/browser/dist/stringify/stringifyNumber.js
  function stringifyNumber({ format, minFractionDigits, tag, value }) {
    if (typeof value === "bigint")
      return String(value);
    const num = typeof value === "number" ? value : Number(value);
    if (!isFinite(num))
      return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
    let n = JSON.stringify(value);
    if (!format && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^\d/.test(n)) {
      let i3 = n.indexOf(".");
      if (i3 < 0) {
        i3 = n.length;
        n += ".";
      }
      let d = minFractionDigits - (n.length - i3 - 1);
      while (d-- > 0)
        n += "0";
    }
    return n;
  }

  // node_modules/yaml/browser/dist/schema/core/float.js
  var floatNaN = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
    resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
    stringify: stringifyNumber
  };
  var floatExp = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    format: "EXP",
    test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
    resolve: (str) => parseFloat(str),
    stringify(node) {
      const num = Number(node.value);
      return isFinite(num) ? num.toExponential() : stringifyNumber(node);
    }
  };
  var float = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
    resolve(str) {
      const node = new Scalar(parseFloat(str));
      const dot = str.indexOf(".");
      if (dot !== -1 && str[str.length - 1] === "0")
        node.minFractionDigits = str.length - dot - 1;
      return node;
    },
    stringify: stringifyNumber
  };

  // node_modules/yaml/browser/dist/schema/core/int.js
  var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
  var intResolve = (str, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
  function intStringify(node, radix, prefix) {
    const { value } = node;
    if (intIdentify(value) && value >= 0)
      return prefix + value.toString(radix);
    return stringifyNumber(node);
  }
  var intOct = {
    identify: (value) => intIdentify(value) && value >= 0,
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "OCT",
    test: /^0o[0-7]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 2, 8, opt),
    stringify: (node) => intStringify(node, 8, "0o")
  };
  var int = {
    identify: intIdentify,
    default: true,
    tag: "tag:yaml.org,2002:int",
    test: /^[-+]?[0-9]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
    stringify: stringifyNumber
  };
  var intHex = {
    identify: (value) => intIdentify(value) && value >= 0,
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "HEX",
    test: /^0x[0-9a-fA-F]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
    stringify: (node) => intStringify(node, 16, "0x")
  };

  // node_modules/yaml/browser/dist/schema/core/schema.js
  var schema = [
    map,
    seq,
    string,
    nullTag,
    boolTag,
    intOct,
    int,
    intHex,
    floatNaN,
    floatExp,
    float
  ];

  // node_modules/yaml/browser/dist/schema/json/schema.js
  function intIdentify2(value) {
    return typeof value === "bigint" || Number.isInteger(value);
  }
  var stringifyJSON = ({ value }) => JSON.stringify(value);
  var jsonScalars = [
    {
      identify: (value) => typeof value === "string",
      default: true,
      tag: "tag:yaml.org,2002:str",
      resolve: (str) => str,
      stringify: stringifyJSON
    },
    {
      identify: (value) => value == null,
      createNode: () => new Scalar(null),
      default: true,
      tag: "tag:yaml.org,2002:null",
      test: /^null$/,
      resolve: () => null,
      stringify: stringifyJSON
    },
    {
      identify: (value) => typeof value === "boolean",
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^true$|^false$/,
      resolve: (str) => str === "true",
      stringify: stringifyJSON
    },
    {
      identify: intIdentify2,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^-?(?:0|[1-9][0-9]*)$/,
      resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
      stringify: ({ value }) => intIdentify2(value) ? value.toString() : JSON.stringify(value)
    },
    {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
      resolve: (str) => parseFloat(str),
      stringify: stringifyJSON
    }
  ];
  var jsonError = {
    default: true,
    tag: "",
    test: /^/,
    resolve(str, onError) {
      onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
      return str;
    }
  };
  var schema2 = [map, seq].concat(jsonScalars, jsonError);

  // node_modules/yaml/browser/dist/schema/yaml-1.1/binary.js
  var binary = {
    identify: (value) => value instanceof Uint8Array,
    // Buffer inherits from Uint8Array
    default: false,
    tag: "tag:yaml.org,2002:binary",
    /**
     * Returns a Buffer in node and an Uint8Array in browsers
     *
     * To use the resulting buffer as an image, you'll want to do something like:
     *
     *   const blob = new Blob([buffer], { type: 'image/jpeg' })
     *   document.querySelector('#photo').src = URL.createObjectURL(blob)
     */
    resolve(src, onError) {
      if (typeof Buffer === "function") {
        return Buffer.from(src, "base64");
      } else if (typeof atob === "function") {
        const str = atob(src.replace(/[\n\r]/g, ""));
        const buffer = new Uint8Array(str.length);
        for (let i3 = 0; i3 < str.length; ++i3)
          buffer[i3] = str.charCodeAt(i3);
        return buffer;
      } else {
        onError("This environment does not support reading binary tags; either Buffer or atob is required");
        return src;
      }
    },
    stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
      const buf = value;
      let str;
      if (typeof Buffer === "function") {
        str = buf instanceof Buffer ? buf.toString("base64") : Buffer.from(buf.buffer).toString("base64");
      } else if (typeof btoa === "function") {
        let s = "";
        for (let i3 = 0; i3 < buf.length; ++i3)
          s += String.fromCharCode(buf[i3]);
        str = btoa(s);
      } else {
        throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
      }
      if (!type)
        type = Scalar.BLOCK_LITERAL;
      if (type !== Scalar.QUOTE_DOUBLE) {
        const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
        const n = Math.ceil(str.length / lineWidth);
        const lines = new Array(n);
        for (let i3 = 0, o = 0; i3 < n; ++i3, o += lineWidth) {
          lines[i3] = str.substr(o, lineWidth);
        }
        str = lines.join(type === Scalar.BLOCK_LITERAL ? "\n" : " ");
      }
      return stringifyString({ comment, type, value: str }, ctx, onComment, onChompKeep);
    }
  };

  // node_modules/yaml/browser/dist/schema/yaml-1.1/pairs.js
  function resolvePairs(seq2, onError) {
    if (isSeq(seq2)) {
      for (let i3 = 0; i3 < seq2.items.length; ++i3) {
        let item = seq2.items[i3];
        if (isPair(item))
          continue;
        else if (isMap(item)) {
          if (item.items.length > 1)
            onError("Each pair must have its own sequence indicator");
          const pair = item.items[0] || new Pair(new Scalar(null));
          if (item.commentBefore)
            pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}
${pair.key.commentBefore}` : item.commentBefore;
          if (item.comment) {
            const cn = pair.value ?? pair.key;
            cn.comment = cn.comment ? `${item.comment}
${cn.comment}` : item.comment;
          }
          item = pair;
        }
        seq2.items[i3] = isPair(item) ? item : new Pair(item);
      }
    } else
      onError("Expected a sequence for this tag");
    return seq2;
  }
  function createPairs(schema4, iterable, ctx) {
    const { replacer } = ctx;
    const pairs2 = new YAMLSeq(schema4);
    pairs2.tag = "tag:yaml.org,2002:pairs";
    let i3 = 0;
    if (iterable && Symbol.iterator in Object(iterable))
      for (let it of iterable) {
        if (typeof replacer === "function")
          it = replacer.call(iterable, String(i3++), it);
        let key, value;
        if (Array.isArray(it)) {
          if (it.length === 2) {
            key = it[0];
            value = it[1];
          } else
            throw new TypeError(`Expected [key, value] tuple: ${it}`);
        } else if (it && it instanceof Object) {
          const keys2 = Object.keys(it);
          if (keys2.length === 1) {
            key = keys2[0];
            value = it[key];
          } else {
            throw new TypeError(`Expected tuple with one key, not ${keys2.length} keys`);
          }
        } else {
          key = it;
        }
        pairs2.items.push(createPair(key, value, ctx));
      }
    return pairs2;
  }
  var pairs = {
    collection: "seq",
    default: false,
    tag: "tag:yaml.org,2002:pairs",
    resolve: resolvePairs,
    createNode: createPairs
  };

  // node_modules/yaml/browser/dist/schema/yaml-1.1/omap.js
  var YAMLOMap = class _YAMLOMap extends YAMLSeq {
    constructor() {
      super();
      this.add = YAMLMap.prototype.add.bind(this);
      this.delete = YAMLMap.prototype.delete.bind(this);
      this.get = YAMLMap.prototype.get.bind(this);
      this.has = YAMLMap.prototype.has.bind(this);
      this.set = YAMLMap.prototype.set.bind(this);
      this.tag = _YAMLOMap.tag;
    }
    /**
     * If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
     * but TypeScript won't allow widening the signature of a child method.
     */
    toJSON(_, ctx) {
      if (!ctx)
        return super.toJSON(_);
      const map2 = /* @__PURE__ */ new Map();
      if (ctx?.onCreate)
        ctx.onCreate(map2);
      for (const pair of this.items) {
        let key, value;
        if (isPair(pair)) {
          key = toJS(pair.key, "", ctx);
          value = toJS(pair.value, key, ctx);
        } else {
          key = toJS(pair, "", ctx);
        }
        if (map2.has(key))
          throw new Error("Ordered maps must not include duplicate keys");
        map2.set(key, value);
      }
      return map2;
    }
    static from(schema4, iterable, ctx) {
      const pairs2 = createPairs(schema4, iterable, ctx);
      const omap2 = new this();
      omap2.items = pairs2.items;
      return omap2;
    }
  };
  YAMLOMap.tag = "tag:yaml.org,2002:omap";
  var omap = {
    collection: "seq",
    identify: (value) => value instanceof Map,
    nodeClass: YAMLOMap,
    default: false,
    tag: "tag:yaml.org,2002:omap",
    resolve(seq2, onError) {
      const pairs2 = resolvePairs(seq2, onError);
      const seenKeys = [];
      for (const { key } of pairs2.items) {
        if (isScalar(key)) {
          if (seenKeys.includes(key.value)) {
            onError(`Ordered maps must not include duplicate keys: ${key.value}`);
          } else {
            seenKeys.push(key.value);
          }
        }
      }
      return Object.assign(new YAMLOMap(), pairs2);
    },
    createNode: (schema4, iterable, ctx) => YAMLOMap.from(schema4, iterable, ctx)
  };

  // node_modules/yaml/browser/dist/schema/yaml-1.1/bool.js
  function boolStringify({ value, source }, ctx) {
    const boolObj = value ? trueTag : falseTag;
    if (source && boolObj.test.test(source))
      return source;
    return value ? ctx.options.trueStr : ctx.options.falseStr;
  }
  var trueTag = {
    identify: (value) => value === true,
    default: true,
    tag: "tag:yaml.org,2002:bool",
    test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
    resolve: () => new Scalar(true),
    stringify: boolStringify
  };
  var falseTag = {
    identify: (value) => value === false,
    default: true,
    tag: "tag:yaml.org,2002:bool",
    test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
    resolve: () => new Scalar(false),
    stringify: boolStringify
  };

  // node_modules/yaml/browser/dist/schema/yaml-1.1/float.js
  var floatNaN2 = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
    resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
    stringify: stringifyNumber
  };
  var floatExp2 = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    format: "EXP",
    test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
    resolve: (str) => parseFloat(str.replace(/_/g, "")),
    stringify(node) {
      const num = Number(node.value);
      return isFinite(num) ? num.toExponential() : stringifyNumber(node);
    }
  };
  var float2 = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
    resolve(str) {
      const node = new Scalar(parseFloat(str.replace(/_/g, "")));
      const dot = str.indexOf(".");
      if (dot !== -1) {
        const f = str.substring(dot + 1).replace(/_/g, "");
        if (f[f.length - 1] === "0")
          node.minFractionDigits = f.length;
      }
      return node;
    },
    stringify: stringifyNumber
  };

  // node_modules/yaml/browser/dist/schema/yaml-1.1/int.js
  var intIdentify3 = (value) => typeof value === "bigint" || Number.isInteger(value);
  function intResolve2(str, offset, radix, { intAsBigInt }) {
    const sign = str[0];
    if (sign === "-" || sign === "+")
      offset += 1;
    str = str.substring(offset).replace(/_/g, "");
    if (intAsBigInt) {
      switch (radix) {
        case 2:
          str = `0b${str}`;
          break;
        case 8:
          str = `0o${str}`;
          break;
        case 16:
          str = `0x${str}`;
          break;
      }
      const n2 = BigInt(str);
      return sign === "-" ? BigInt(-1) * n2 : n2;
    }
    const n = parseInt(str, radix);
    return sign === "-" ? -1 * n : n;
  }
  function intStringify2(node, radix, prefix) {
    const { value } = node;
    if (intIdentify3(value)) {
      const str = value.toString(radix);
      return value < 0 ? "-" + prefix + str.substr(1) : prefix + str;
    }
    return stringifyNumber(node);
  }
  var intBin = {
    identify: intIdentify3,
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "BIN",
    test: /^[-+]?0b[0-1_]+$/,
    resolve: (str, _onError, opt) => intResolve2(str, 2, 2, opt),
    stringify: (node) => intStringify2(node, 2, "0b")
  };
  var intOct2 = {
    identify: intIdentify3,
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "OCT",
    test: /^[-+]?0[0-7_]+$/,
    resolve: (str, _onError, opt) => intResolve2(str, 1, 8, opt),
    stringify: (node) => intStringify2(node, 8, "0")
  };
  var int2 = {
    identify: intIdentify3,
    default: true,
    tag: "tag:yaml.org,2002:int",
    test: /^[-+]?[0-9][0-9_]*$/,
    resolve: (str, _onError, opt) => intResolve2(str, 0, 10, opt),
    stringify: stringifyNumber
  };
  var intHex2 = {
    identify: intIdentify3,
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "HEX",
    test: /^[-+]?0x[0-9a-fA-F_]+$/,
    resolve: (str, _onError, opt) => intResolve2(str, 2, 16, opt),
    stringify: (node) => intStringify2(node, 16, "0x")
  };

  // node_modules/yaml/browser/dist/schema/yaml-1.1/set.js
  var YAMLSet = class _YAMLSet extends YAMLMap {
    constructor(schema4) {
      super(schema4);
      this.tag = _YAMLSet.tag;
    }
    add(key) {
      let pair;
      if (isPair(key))
        pair = key;
      else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null)
        pair = new Pair(key.key, null);
      else
        pair = new Pair(key, null);
      const prev = findPair(this.items, pair.key);
      if (!prev)
        this.items.push(pair);
    }
    /**
     * If `keepPair` is `true`, returns the Pair matching `key`.
     * Otherwise, returns the value of that Pair's key.
     */
    get(key, keepPair) {
      const pair = findPair(this.items, key);
      return !keepPair && isPair(pair) ? isScalar(pair.key) ? pair.key.value : pair.key : pair;
    }
    set(key, value) {
      if (typeof value !== "boolean")
        throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
      const prev = findPair(this.items, key);
      if (prev && !value) {
        this.items.splice(this.items.indexOf(prev), 1);
      } else if (!prev && value) {
        this.items.push(new Pair(key));
      }
    }
    toJSON(_, ctx) {
      return super.toJSON(_, ctx, Set);
    }
    toString(ctx, onComment, onChompKeep) {
      if (!ctx)
        return JSON.stringify(this);
      if (this.hasAllNullValues(true))
        return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
      else
        throw new Error("Set items must all have null values");
    }
    static from(schema4, iterable, ctx) {
      const { replacer } = ctx;
      const set2 = new this(schema4);
      if (iterable && Symbol.iterator in Object(iterable))
        for (let value of iterable) {
          if (typeof replacer === "function")
            value = replacer.call(iterable, value, value);
          set2.items.push(createPair(value, null, ctx));
        }
      return set2;
    }
  };
  YAMLSet.tag = "tag:yaml.org,2002:set";
  var set = {
    collection: "map",
    identify: (value) => value instanceof Set,
    nodeClass: YAMLSet,
    default: false,
    tag: "tag:yaml.org,2002:set",
    createNode: (schema4, iterable, ctx) => YAMLSet.from(schema4, iterable, ctx),
    resolve(map2, onError) {
      if (isMap(map2)) {
        if (map2.hasAllNullValues(true))
          return Object.assign(new YAMLSet(), map2);
        else
          onError("Set items must all have null values");
      } else
        onError("Expected a mapping for this tag");
      return map2;
    }
  };

  // node_modules/yaml/browser/dist/schema/yaml-1.1/timestamp.js
  function parseSexagesimal(str, asBigInt) {
    const sign = str[0];
    const parts = sign === "-" || sign === "+" ? str.substring(1) : str;
    const num = (n) => asBigInt ? BigInt(n) : Number(n);
    const res = parts.replace(/_/g, "").split(":").reduce((res2, p) => res2 * num(60) + num(p), num(0));
    return sign === "-" ? num(-1) * res : res;
  }
  function stringifySexagesimal(node) {
    let { value } = node;
    let num = (n) => n;
    if (typeof value === "bigint")
      num = (n) => BigInt(n);
    else if (isNaN(value) || !isFinite(value))
      return stringifyNumber(node);
    let sign = "";
    if (value < 0) {
      sign = "-";
      value *= num(-1);
    }
    const _60 = num(60);
    const parts = [value % _60];
    if (value < 60) {
      parts.unshift(0);
    } else {
      value = (value - parts[0]) / _60;
      parts.unshift(value % _60);
      if (value >= 60) {
        value = (value - parts[0]) / _60;
        parts.unshift(value);
      }
    }
    return sign + parts.map((n) => String(n).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
  }
  var intTime = {
    identify: (value) => typeof value === "bigint" || Number.isInteger(value),
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "TIME",
    test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
    resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
    stringify: stringifySexagesimal
  };
  var floatTime = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    format: "TIME",
    test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
    resolve: (str) => parseSexagesimal(str, false),
    stringify: stringifySexagesimal
  };
  var timestamp = {
    identify: (value) => value instanceof Date,
    default: true,
    tag: "tag:yaml.org,2002:timestamp",
    // If the time zone is omitted, the timestamp is assumed to be specified in UTC. The time part
    // may be omitted altogether, resulting in a date format. In such a case, the time part is
    // assumed to be 00:00:00Z (start of day, UTC).
    test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),
    resolve(str) {
      const match = str.match(timestamp.test);
      if (!match)
        throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
      const [, year, month, day, hour, minute, second] = match.map(Number);
      const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
      let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
      const tz = match[8];
      if (tz && tz !== "Z") {
        let d = parseSexagesimal(tz, false);
        if (Math.abs(d) < 30)
          d *= 60;
        date -= 6e4 * d;
      }
      return new Date(date);
    },
    stringify: ({ value }) => value.toISOString().replace(/(T00:00:00)?\.000Z$/, "")
  };

  // node_modules/yaml/browser/dist/schema/yaml-1.1/schema.js
  var schema3 = [
    map,
    seq,
    string,
    nullTag,
    trueTag,
    falseTag,
    intBin,
    intOct2,
    int2,
    intHex2,
    floatNaN2,
    floatExp2,
    float2,
    binary,
    merge,
    omap,
    pairs,
    set,
    intTime,
    floatTime,
    timestamp
  ];

  // node_modules/yaml/browser/dist/schema/tags.js
  var schemas = /* @__PURE__ */ new Map([
    ["core", schema],
    ["failsafe", [map, seq, string]],
    ["json", schema2],
    ["yaml11", schema3],
    ["yaml-1.1", schema3]
  ]);
  var tagsByName = {
    binary,
    bool: boolTag,
    float,
    floatExp,
    floatNaN,
    floatTime,
    int,
    intHex,
    intOct,
    intTime,
    map,
    merge,
    null: nullTag,
    omap,
    pairs,
    seq,
    set,
    timestamp
  };
  var coreKnownTags = {
    "tag:yaml.org,2002:binary": binary,
    "tag:yaml.org,2002:merge": merge,
    "tag:yaml.org,2002:omap": omap,
    "tag:yaml.org,2002:pairs": pairs,
    "tag:yaml.org,2002:set": set,
    "tag:yaml.org,2002:timestamp": timestamp
  };
  function getTags2(customTags, schemaName, addMergeTag) {
    const schemaTags = schemas.get(schemaName);
    if (schemaTags && !customTags) {
      return addMergeTag && !schemaTags.includes(merge) ? schemaTags.concat(merge) : schemaTags.slice();
    }
    let tags = schemaTags;
    if (!tags) {
      if (Array.isArray(customTags))
        tags = [];
      else {
        const keys2 = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
        throw new Error(`Unknown schema "${schemaName}"; use one of ${keys2} or define customTags array`);
      }
    }
    if (Array.isArray(customTags)) {
      for (const tag of customTags)
        tags = tags.concat(tag);
    } else if (typeof customTags === "function") {
      tags = customTags(tags.slice());
    }
    if (addMergeTag)
      tags = tags.concat(merge);
    return tags.reduce((tags2, tag) => {
      const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
      if (!tagObj) {
        const tagName = JSON.stringify(tag);
        const keys2 = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
        throw new Error(`Unknown custom tag ${tagName}; use one of ${keys2}`);
      }
      if (!tags2.includes(tagObj))
        tags2.push(tagObj);
      return tags2;
    }, []);
  }

  // node_modules/yaml/browser/dist/schema/Schema.js
  var sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  var Schema = class _Schema {
    constructor({ compat, customTags, merge: merge2, resolveKnownTags, schema: schema4, sortMapEntries, toStringDefaults }) {
      this.compat = Array.isArray(compat) ? getTags2(compat, "compat") : compat ? getTags2(null, compat) : null;
      this.name = typeof schema4 === "string" && schema4 || "core";
      this.knownTags = resolveKnownTags ? coreKnownTags : {};
      this.tags = getTags2(customTags, this.name, merge2);
      this.toStringOptions = toStringDefaults ?? null;
      Object.defineProperty(this, MAP, { value: map });
      Object.defineProperty(this, SCALAR, { value: string });
      Object.defineProperty(this, SEQ, { value: seq });
      this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
    }
    clone() {
      const copy = Object.create(_Schema.prototype, Object.getOwnPropertyDescriptors(this));
      copy.tags = this.tags.slice();
      return copy;
    }
  };

  // node_modules/yaml/browser/dist/stringify/stringifyDocument.js
  function stringifyDocument(doc, options) {
    const lines = [];
    let hasDirectives = options.directives === true;
    if (options.directives !== false && doc.directives) {
      const dir = doc.directives.toString(doc);
      if (dir) {
        lines.push(dir);
        hasDirectives = true;
      } else if (doc.directives.docStart)
        hasDirectives = true;
    }
    if (hasDirectives)
      lines.push("---");
    const ctx = createStringifyContext(doc, options);
    const { commentString } = ctx.options;
    if (doc.commentBefore) {
      if (lines.length !== 1)
        lines.unshift("");
      const cs = commentString(doc.commentBefore);
      lines.unshift(indentComment(cs, ""));
    }
    let chompKeep = false;
    let contentComment = null;
    if (doc.contents) {
      if (isNode(doc.contents)) {
        if (doc.contents.spaceBefore && hasDirectives)
          lines.push("");
        if (doc.contents.commentBefore) {
          const cs = commentString(doc.contents.commentBefore);
          lines.push(indentComment(cs, ""));
        }
        ctx.forceBlockIndent = !!doc.comment;
        contentComment = doc.contents.comment;
      }
      const onChompKeep = contentComment ? void 0 : () => chompKeep = true;
      let body = stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
      if (contentComment)
        body += lineComment(body, "", commentString(contentComment));
      if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") {
        lines[lines.length - 1] = `--- ${body}`;
      } else
        lines.push(body);
    } else {
      lines.push(stringify(doc.contents, ctx));
    }
    if (doc.directives?.docEnd) {
      if (doc.comment) {
        const cs = commentString(doc.comment);
        if (cs.includes("\n")) {
          lines.push("...");
          lines.push(indentComment(cs, ""));
        } else {
          lines.push(`... ${cs}`);
        }
      } else {
        lines.push("...");
      }
    } else {
      let dc = doc.comment;
      if (dc && chompKeep)
        dc = dc.replace(/^\n+/, "");
      if (dc) {
        if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "")
          lines.push("");
        lines.push(indentComment(commentString(dc), ""));
      }
    }
    return lines.join("\n") + "\n";
  }

  // node_modules/yaml/browser/dist/doc/Document.js
  var Document = class _Document {
    constructor(value, replacer, options) {
      this.commentBefore = null;
      this.comment = null;
      this.errors = [];
      this.warnings = [];
      Object.defineProperty(this, NODE_TYPE, { value: DOC });
      let _replacer = null;
      if (typeof replacer === "function" || Array.isArray(replacer)) {
        _replacer = replacer;
      } else if (options === void 0 && replacer) {
        options = replacer;
        replacer = void 0;
      }
      const opt = Object.assign({
        intAsBigInt: false,
        keepSourceTokens: false,
        logLevel: "warn",
        prettyErrors: true,
        strict: true,
        stringKeys: false,
        uniqueKeys: true,
        version: "1.2"
      }, options);
      this.options = opt;
      let { version } = opt;
      if (options?._directives) {
        this.directives = options._directives.atDocument();
        if (this.directives.yaml.explicit)
          version = this.directives.yaml.version;
      } else
        this.directives = new Directives({ version });
      this.setSchema(version, options);
      this.contents = value === void 0 ? null : this.createNode(value, _replacer, options);
    }
    /**
     * Create a deep copy of this Document and its contents.
     *
     * Custom Node values that inherit from `Object` still refer to their original instances.
     */
    clone() {
      const copy = Object.create(_Document.prototype, {
        [NODE_TYPE]: { value: DOC }
      });
      copy.commentBefore = this.commentBefore;
      copy.comment = this.comment;
      copy.errors = this.errors.slice();
      copy.warnings = this.warnings.slice();
      copy.options = Object.assign({}, this.options);
      if (this.directives)
        copy.directives = this.directives.clone();
      copy.schema = this.schema.clone();
      copy.contents = isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
      if (this.range)
        copy.range = this.range.slice();
      return copy;
    }
    /** Adds a value to the document. */
    add(value) {
      if (assertCollection(this.contents))
        this.contents.add(value);
    }
    /** Adds a value to the document. */
    addIn(path, value) {
      if (assertCollection(this.contents))
        this.contents.addIn(path, value);
    }
    /**
     * Create a new `Alias` node, ensuring that the target `node` has the required anchor.
     *
     * If `node` already has an anchor, `name` is ignored.
     * Otherwise, the `node.anchor` value will be set to `name`,
     * or if an anchor with that name is already present in the document,
     * `name` will be used as a prefix for a new unique anchor.
     * If `name` is undefined, the generated anchor will use 'a' as a prefix.
     */
    createAlias(node, name) {
      if (!node.anchor) {
        const prev = anchorNames(this);
        node.anchor = // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        !name || prev.has(name) ? findNewAnchor(name || "a", prev) : name;
      }
      return new Alias(node.anchor);
    }
    createNode(value, replacer, options) {
      let _replacer = void 0;
      if (typeof replacer === "function") {
        value = replacer.call({ "": value }, "", value);
        _replacer = replacer;
      } else if (Array.isArray(replacer)) {
        const keyToStr = (v) => typeof v === "number" || v instanceof String || v instanceof Number;
        const asStr = replacer.filter(keyToStr).map(String);
        if (asStr.length > 0)
          replacer = replacer.concat(asStr);
        _replacer = replacer;
      } else if (options === void 0 && replacer) {
        options = replacer;
        replacer = void 0;
      }
      const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
      const { onAnchor, setAnchors, sourceObjects } = createNodeAnchors(
        this,
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        anchorPrefix || "a"
      );
      const ctx = {
        aliasDuplicateObjects: aliasDuplicateObjects ?? true,
        keepUndefined: keepUndefined ?? false,
        onAnchor,
        onTagObj,
        replacer: _replacer,
        schema: this.schema,
        sourceObjects
      };
      const node = createNode(value, tag, ctx);
      if (flow && isCollection(node))
        node.flow = true;
      setAnchors();
      return node;
    }
    /**
     * Convert a key and a value into a `Pair` using the current schema,
     * recursively wrapping all values as `Scalar` or `Collection` nodes.
     */
    createPair(key, value, options = {}) {
      const k = this.createNode(key, null, options);
      const v = this.createNode(value, null, options);
      return new Pair(k, v);
    }
    /**
     * Removes a value from the document.
     * @returns `true` if the item was found and removed.
     */
    delete(key) {
      return assertCollection(this.contents) ? this.contents.delete(key) : false;
    }
    /**
     * Removes a value from the document.
     * @returns `true` if the item was found and removed.
     */
    deleteIn(path) {
      if (isEmptyPath(path)) {
        if (this.contents == null)
          return false;
        this.contents = null;
        return true;
      }
      return assertCollection(this.contents) ? this.contents.deleteIn(path) : false;
    }
    /**
     * Returns item at `key`, or `undefined` if not found. By default unwraps
     * scalar values from their surrounding node; to disable set `keepScalar` to
     * `true` (collections are always returned intact).
     */
    get(key, keepScalar) {
      return isCollection(this.contents) ? this.contents.get(key, keepScalar) : void 0;
    }
    /**
     * Returns item at `path`, or `undefined` if not found. By default unwraps
     * scalar values from their surrounding node; to disable set `keepScalar` to
     * `true` (collections are always returned intact).
     */
    getIn(path, keepScalar) {
      if (isEmptyPath(path))
        return !keepScalar && isScalar(this.contents) ? this.contents.value : this.contents;
      return isCollection(this.contents) ? this.contents.getIn(path, keepScalar) : void 0;
    }
    /**
     * Checks if the document includes a value with the key `key`.
     */
    has(key) {
      return isCollection(this.contents) ? this.contents.has(key) : false;
    }
    /**
     * Checks if the document includes a value at `path`.
     */
    hasIn(path) {
      if (isEmptyPath(path))
        return this.contents !== void 0;
      return isCollection(this.contents) ? this.contents.hasIn(path) : false;
    }
    /**
     * Sets a value in this document. For `!!set`, `value` needs to be a
     * boolean to add/remove the item from the set.
     */
    set(key, value) {
      if (this.contents == null) {
        this.contents = collectionFromPath(this.schema, [key], value);
      } else if (assertCollection(this.contents)) {
        this.contents.set(key, value);
      }
    }
    /**
     * Sets a value in this document. For `!!set`, `value` needs to be a
     * boolean to add/remove the item from the set.
     */
    setIn(path, value) {
      if (isEmptyPath(path)) {
        this.contents = value;
      } else if (this.contents == null) {
        this.contents = collectionFromPath(this.schema, Array.from(path), value);
      } else if (assertCollection(this.contents)) {
        this.contents.setIn(path, value);
      }
    }
    /**
     * Change the YAML version and schema used by the document.
     * A `null` version disables support for directives, explicit tags, anchors, and aliases.
     * It also requires the `schema` option to be given as a `Schema` instance value.
     *
     * Overrides all previously set schema options.
     */
    setSchema(version, options = {}) {
      if (typeof version === "number")
        version = String(version);
      let opt;
      switch (version) {
        case "1.1":
          if (this.directives)
            this.directives.yaml.version = "1.1";
          else
            this.directives = new Directives({ version: "1.1" });
          opt = { resolveKnownTags: false, schema: "yaml-1.1" };
          break;
        case "1.2":
        case "next":
          if (this.directives)
            this.directives.yaml.version = version;
          else
            this.directives = new Directives({ version });
          opt = { resolveKnownTags: true, schema: "core" };
          break;
        case null:
          if (this.directives)
            delete this.directives;
          opt = null;
          break;
        default: {
          const sv = JSON.stringify(version);
          throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
        }
      }
      if (options.schema instanceof Object)
        this.schema = options.schema;
      else if (opt)
        this.schema = new Schema(Object.assign(opt, options));
      else
        throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
    }
    // json & jsonArg are only used from toJSON()
    toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
      const ctx = {
        anchors: /* @__PURE__ */ new Map(),
        doc: this,
        keep: !json,
        mapAsMap: mapAsMap === true,
        mapKeyWarned: false,
        maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
      };
      const res = toJS(this.contents, jsonArg ?? "", ctx);
      if (typeof onAnchor === "function")
        for (const { count, res: res2 } of ctx.anchors.values())
          onAnchor(res2, count);
      return typeof reviver === "function" ? applyReviver(reviver, { "": res }, "", res) : res;
    }
    /**
     * A JSON representation of the document `contents`.
     *
     * @param jsonArg Used by `JSON.stringify` to indicate the array index or
     *   property name.
     */
    toJSON(jsonArg, onAnchor) {
      return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
    }
    /** A YAML representation of the document. */
    toString(options = {}) {
      if (this.errors.length > 0)
        throw new Error("Document with errors cannot be stringified");
      if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
        const s = JSON.stringify(options.indent);
        throw new Error(`"indent" option must be a positive integer, not ${s}`);
      }
      return stringifyDocument(this, options);
    }
  };
  function assertCollection(contents) {
    if (isCollection(contents))
      return true;
    throw new Error("Expected a YAML collection as document contents");
  }

  // node_modules/yaml/browser/dist/errors.js
  var YAMLError = class extends Error {
    constructor(name, pos, code, message) {
      super();
      this.name = name;
      this.code = code;
      this.message = message;
      this.pos = pos;
    }
  };
  var YAMLParseError = class extends YAMLError {
    constructor(pos, code, message) {
      super("YAMLParseError", pos, code, message);
    }
  };
  var YAMLWarning = class extends YAMLError {
    constructor(pos, code, message) {
      super("YAMLWarning", pos, code, message);
    }
  };
  var prettifyError = (src, lc) => (error) => {
    if (error.pos[0] === -1)
      return;
    error.linePos = error.pos.map((pos) => lc.linePos(pos));
    const { line: line2, col } = error.linePos[0];
    error.message += ` at line ${line2}, column ${col}`;
    let ci = col - 1;
    let lineStr = src.substring(lc.lineStarts[line2 - 1], lc.lineStarts[line2]).replace(/[\n\r]+$/, "");
    if (ci >= 60 && lineStr.length > 80) {
      const trimStart = Math.min(ci - 39, lineStr.length - 79);
      lineStr = "\u2026" + lineStr.substring(trimStart);
      ci -= trimStart - 1;
    }
    if (lineStr.length > 80)
      lineStr = lineStr.substring(0, 79) + "\u2026";
    if (line2 > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
      let prev = src.substring(lc.lineStarts[line2 - 2], lc.lineStarts[line2 - 1]);
      if (prev.length > 80)
        prev = prev.substring(0, 79) + "\u2026\n";
      lineStr = prev + lineStr;
    }
    if (/[^ ]/.test(lineStr)) {
      let count = 1;
      const end = error.linePos[1];
      if (end && end.line === line2 && end.col > col) {
        count = Math.max(1, Math.min(end.col - col, 80 - ci));
      }
      const pointer = " ".repeat(ci) + "^".repeat(count);
      error.message += `:

${lineStr}
${pointer}
`;
    }
  };

  // node_modules/yaml/browser/dist/compose/resolve-props.js
  function resolveProps(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
    let spaceBefore = false;
    let atNewline = startOnNewline;
    let hasSpace = startOnNewline;
    let comment = "";
    let commentSep = "";
    let hasNewline = false;
    let reqSpace = false;
    let tab = null;
    let anchor = null;
    let tag = null;
    let newlineAfterProp = null;
    let comma = null;
    let found = null;
    let start = null;
    for (const token of tokens) {
      if (reqSpace) {
        if (token.type !== "space" && token.type !== "newline" && token.type !== "comma")
          onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
        reqSpace = false;
      }
      if (tab) {
        if (atNewline && token.type !== "comment" && token.type !== "newline") {
          onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
        }
        tab = null;
      }
      switch (token.type) {
        case "space":
          if (!flow && (indicator !== "doc-start" || next?.type !== "flow-collection") && token.source.includes("	")) {
            tab = token;
          }
          hasSpace = true;
          break;
        case "comment": {
          if (!hasSpace)
            onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
          const cb = token.source.substring(1) || " ";
          if (!comment)
            comment = cb;
          else
            comment += commentSep + cb;
          commentSep = "";
          atNewline = false;
          break;
        }
        case "newline":
          if (atNewline) {
            if (comment)
              comment += token.source;
            else
              spaceBefore = true;
          } else
            commentSep += token.source;
          atNewline = true;
          hasNewline = true;
          if (anchor || tag)
            newlineAfterProp = token;
          hasSpace = true;
          break;
        case "anchor":
          if (anchor)
            onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
          if (token.source.endsWith(":"))
            onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
          anchor = token;
          if (start === null)
            start = token.offset;
          atNewline = false;
          hasSpace = false;
          reqSpace = true;
          break;
        case "tag": {
          if (tag)
            onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
          tag = token;
          if (start === null)
            start = token.offset;
          atNewline = false;
          hasSpace = false;
          reqSpace = true;
          break;
        }
        case indicator:
          if (anchor || tag)
            onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
          if (found)
            onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow ?? "collection"}`);
          found = token;
          atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
          hasSpace = false;
          break;
        case "comma":
          if (flow) {
            if (comma)
              onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
            comma = token;
            atNewline = false;
            hasSpace = false;
            break;
          }
        // else fallthrough
        default:
          onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
          atNewline = false;
          hasSpace = false;
      }
    }
    const last = tokens[tokens.length - 1];
    const end = last ? last.offset + last.source.length : offset;
    if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) {
      onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
    }
    if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq"))
      onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
    return {
      comma,
      found,
      spaceBefore,
      comment,
      hasNewline,
      anchor,
      tag,
      newlineAfterProp,
      end,
      start: start ?? end
    };
  }

  // node_modules/yaml/browser/dist/compose/util-contains-newline.js
  function containsNewline(key) {
    if (!key)
      return null;
    switch (key.type) {
      case "alias":
      case "scalar":
      case "double-quoted-scalar":
      case "single-quoted-scalar":
        if (key.source.includes("\n"))
          return true;
        if (key.end) {
          for (const st of key.end)
            if (st.type === "newline")
              return true;
        }
        return false;
      case "flow-collection":
        for (const it of key.items) {
          for (const st of it.start)
            if (st.type === "newline")
              return true;
          if (it.sep) {
            for (const st of it.sep)
              if (st.type === "newline")
                return true;
          }
          if (containsNewline(it.key) || containsNewline(it.value))
            return true;
        }
        return false;
      default:
        return true;
    }
  }

  // node_modules/yaml/browser/dist/compose/util-flow-indent-check.js
  function flowIndentCheck(indent, fc, onError) {
    if (fc?.type === "flow-collection") {
      const end = fc.end[0];
      if (end.indent === indent && (end.source === "]" || end.source === "}") && containsNewline(fc)) {
        const msg = "Flow end indicator should be more indented than parent";
        onError(end, "BAD_INDENT", msg, true);
      }
    }
  }

  // node_modules/yaml/browser/dist/compose/util-map-includes.js
  function mapIncludes(ctx, items, search) {
    const { uniqueKeys } = ctx.options;
    if (uniqueKeys === false)
      return false;
    const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a, b) => a === b || isScalar(a) && isScalar(b) && a.value === b.value;
    return items.some((pair) => isEqual(pair.key, search));
  }

  // node_modules/yaml/browser/dist/compose/resolve-block-map.js
  var startColMsg = "All mapping items must start at the same column";
  function resolveBlockMap({ composeNode: composeNode2, composeEmptyNode: composeEmptyNode2 }, ctx, bm, onError, tag) {
    const NodeClass = tag?.nodeClass ?? YAMLMap;
    const map2 = new NodeClass(ctx.schema);
    if (ctx.atRoot)
      ctx.atRoot = false;
    let offset = bm.offset;
    let commentEnd = null;
    for (const collItem of bm.items) {
      const { start, key, sep, value } = collItem;
      const keyProps = resolveProps(start, {
        indicator: "explicit-key-ind",
        next: key ?? sep?.[0],
        offset,
        onError,
        parentIndent: bm.indent,
        startOnNewline: true
      });
      const implicitKey = !keyProps.found;
      if (implicitKey) {
        if (key) {
          if (key.type === "block-seq")
            onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
          else if ("indent" in key && key.indent !== bm.indent)
            onError(offset, "BAD_INDENT", startColMsg);
        }
        if (!keyProps.anchor && !keyProps.tag && !sep) {
          commentEnd = keyProps.end;
          if (keyProps.comment) {
            if (map2.comment)
              map2.comment += "\n" + keyProps.comment;
            else
              map2.comment = keyProps.comment;
          }
          continue;
        }
        if (keyProps.newlineAfterProp || containsNewline(key)) {
          onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
        }
      } else if (keyProps.found?.indent !== bm.indent) {
        onError(offset, "BAD_INDENT", startColMsg);
      }
      ctx.atKey = true;
      const keyStart = keyProps.end;
      const keyNode = key ? composeNode2(ctx, key, keyProps, onError) : composeEmptyNode2(ctx, keyStart, start, null, keyProps, onError);
      if (ctx.schema.compat)
        flowIndentCheck(bm.indent, key, onError);
      ctx.atKey = false;
      if (mapIncludes(ctx, map2.items, keyNode))
        onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
      const valueProps = resolveProps(sep ?? [], {
        indicator: "map-value-ind",
        next: value,
        offset: keyNode.range[2],
        onError,
        parentIndent: bm.indent,
        startOnNewline: !key || key.type === "block-scalar"
      });
      offset = valueProps.end;
      if (valueProps.found) {
        if (implicitKey) {
          if (value?.type === "block-map" && !valueProps.hasNewline)
            onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
          if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024)
            onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
        }
        const valueNode = value ? composeNode2(ctx, value, valueProps, onError) : composeEmptyNode2(ctx, offset, sep, null, valueProps, onError);
        if (ctx.schema.compat)
          flowIndentCheck(bm.indent, value, onError);
        offset = valueNode.range[2];
        const pair = new Pair(keyNode, valueNode);
        if (ctx.options.keepSourceTokens)
          pair.srcToken = collItem;
        map2.items.push(pair);
      } else {
        if (implicitKey)
          onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
        if (valueProps.comment) {
          if (keyNode.comment)
            keyNode.comment += "\n" + valueProps.comment;
          else
            keyNode.comment = valueProps.comment;
        }
        const pair = new Pair(keyNode);
        if (ctx.options.keepSourceTokens)
          pair.srcToken = collItem;
        map2.items.push(pair);
      }
    }
    if (commentEnd && commentEnd < offset)
      onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
    map2.range = [bm.offset, offset, commentEnd ?? offset];
    return map2;
  }

  // node_modules/yaml/browser/dist/compose/resolve-block-seq.js
  function resolveBlockSeq({ composeNode: composeNode2, composeEmptyNode: composeEmptyNode2 }, ctx, bs, onError, tag) {
    const NodeClass = tag?.nodeClass ?? YAMLSeq;
    const seq2 = new NodeClass(ctx.schema);
    if (ctx.atRoot)
      ctx.atRoot = false;
    if (ctx.atKey)
      ctx.atKey = false;
    let offset = bs.offset;
    let commentEnd = null;
    for (const { start, value } of bs.items) {
      const props = resolveProps(start, {
        indicator: "seq-item-ind",
        next: value,
        offset,
        onError,
        parentIndent: bs.indent,
        startOnNewline: true
      });
      if (!props.found) {
        if (props.anchor || props.tag || value) {
          if (value && value.type === "block-seq")
            onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
          else
            onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
        } else {
          commentEnd = props.end;
          if (props.comment)
            seq2.comment = props.comment;
          continue;
        }
      }
      const node = value ? composeNode2(ctx, value, props, onError) : composeEmptyNode2(ctx, props.end, start, null, props, onError);
      if (ctx.schema.compat)
        flowIndentCheck(bs.indent, value, onError);
      offset = node.range[2];
      seq2.items.push(node);
    }
    seq2.range = [bs.offset, offset, commentEnd ?? offset];
    return seq2;
  }

  // node_modules/yaml/browser/dist/compose/resolve-end.js
  function resolveEnd(end, offset, reqSpace, onError) {
    let comment = "";
    if (end) {
      let hasSpace = false;
      let sep = "";
      for (const token of end) {
        const { source, type } = token;
        switch (type) {
          case "space":
            hasSpace = true;
            break;
          case "comment": {
            if (reqSpace && !hasSpace)
              onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
            const cb = source.substring(1) || " ";
            if (!comment)
              comment = cb;
            else
              comment += sep + cb;
            sep = "";
            break;
          }
          case "newline":
            if (comment)
              sep += source;
            hasSpace = true;
            break;
          default:
            onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
        }
        offset += source.length;
      }
    }
    return { comment, offset };
  }

  // node_modules/yaml/browser/dist/compose/resolve-flow-collection.js
  var blockMsg = "Block collections are not allowed within flow collections";
  var isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
  function resolveFlowCollection({ composeNode: composeNode2, composeEmptyNode: composeEmptyNode2 }, ctx, fc, onError, tag) {
    const isMap2 = fc.start.source === "{";
    const fcName = isMap2 ? "flow map" : "flow sequence";
    const NodeClass = tag?.nodeClass ?? (isMap2 ? YAMLMap : YAMLSeq);
    const coll = new NodeClass(ctx.schema);
    coll.flow = true;
    const atRoot = ctx.atRoot;
    if (atRoot)
      ctx.atRoot = false;
    if (ctx.atKey)
      ctx.atKey = false;
    let offset = fc.offset + fc.start.source.length;
    for (let i3 = 0; i3 < fc.items.length; ++i3) {
      const collItem = fc.items[i3];
      const { start, key, sep, value } = collItem;
      const props = resolveProps(start, {
        flow: fcName,
        indicator: "explicit-key-ind",
        next: key ?? sep?.[0],
        offset,
        onError,
        parentIndent: fc.indent,
        startOnNewline: false
      });
      if (!props.found) {
        if (!props.anchor && !props.tag && !sep && !value) {
          if (i3 === 0 && props.comma)
            onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
          else if (i3 < fc.items.length - 1)
            onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
          if (props.comment) {
            if (coll.comment)
              coll.comment += "\n" + props.comment;
            else
              coll.comment = props.comment;
          }
          offset = props.end;
          continue;
        }
        if (!isMap2 && ctx.options.strict && containsNewline(key))
          onError(
            key,
            // checked by containsNewline()
            "MULTILINE_IMPLICIT_KEY",
            "Implicit keys of flow sequence pairs need to be on a single line"
          );
      }
      if (i3 === 0) {
        if (props.comma)
          onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
      } else {
        if (!props.comma)
          onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
        if (props.comment) {
          let prevItemComment = "";
          loop: for (const st of start) {
            switch (st.type) {
              case "comma":
              case "space":
                break;
              case "comment":
                prevItemComment = st.source.substring(1);
                break loop;
              default:
                break loop;
            }
          }
          if (prevItemComment) {
            let prev = coll.items[coll.items.length - 1];
            if (isPair(prev))
              prev = prev.value ?? prev.key;
            if (prev.comment)
              prev.comment += "\n" + prevItemComment;
            else
              prev.comment = prevItemComment;
            props.comment = props.comment.substring(prevItemComment.length + 1);
          }
        }
      }
      if (!isMap2 && !sep && !props.found) {
        const valueNode = value ? composeNode2(ctx, value, props, onError) : composeEmptyNode2(ctx, props.end, sep, null, props, onError);
        coll.items.push(valueNode);
        offset = valueNode.range[2];
        if (isBlock(value))
          onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
      } else {
        ctx.atKey = true;
        const keyStart = props.end;
        const keyNode = key ? composeNode2(ctx, key, props, onError) : composeEmptyNode2(ctx, keyStart, start, null, props, onError);
        if (isBlock(key))
          onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
        ctx.atKey = false;
        const valueProps = resolveProps(sep ?? [], {
          flow: fcName,
          indicator: "map-value-ind",
          next: value,
          offset: keyNode.range[2],
          onError,
          parentIndent: fc.indent,
          startOnNewline: false
        });
        if (valueProps.found) {
          if (!isMap2 && !props.found && ctx.options.strict) {
            if (sep)
              for (const st of sep) {
                if (st === valueProps.found)
                  break;
                if (st.type === "newline") {
                  onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
                  break;
                }
              }
            if (props.start < valueProps.found.offset - 1024)
              onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
          }
        } else if (value) {
          if ("source" in value && value.source && value.source[0] === ":")
            onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
          else
            onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
        }
        const valueNode = value ? composeNode2(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode2(ctx, valueProps.end, sep, null, valueProps, onError) : null;
        if (valueNode) {
          if (isBlock(value))
            onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
        } else if (valueProps.comment) {
          if (keyNode.comment)
            keyNode.comment += "\n" + valueProps.comment;
          else
            keyNode.comment = valueProps.comment;
        }
        const pair = new Pair(keyNode, valueNode);
        if (ctx.options.keepSourceTokens)
          pair.srcToken = collItem;
        if (isMap2) {
          const map2 = coll;
          if (mapIncludes(ctx, map2.items, keyNode))
            onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
          map2.items.push(pair);
        } else {
          const map2 = new YAMLMap(ctx.schema);
          map2.flow = true;
          map2.items.push(pair);
          const endRange = (valueNode ?? keyNode).range;
          map2.range = [keyNode.range[0], endRange[1], endRange[2]];
          coll.items.push(map2);
        }
        offset = valueNode ? valueNode.range[2] : valueProps.end;
      }
    }
    const expectedEnd = isMap2 ? "}" : "]";
    const [ce, ...ee] = fc.end;
    let cePos = offset;
    if (ce && ce.source === expectedEnd)
      cePos = ce.offset + ce.source.length;
    else {
      const name = fcName[0].toUpperCase() + fcName.substring(1);
      const msg = atRoot ? `${name} must end with a ${expectedEnd}` : `${name} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
      onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
      if (ce && ce.source.length !== 1)
        ee.unshift(ce);
    }
    if (ee.length > 0) {
      const end = resolveEnd(ee, cePos, ctx.options.strict, onError);
      if (end.comment) {
        if (coll.comment)
          coll.comment += "\n" + end.comment;
        else
          coll.comment = end.comment;
      }
      coll.range = [fc.offset, cePos, end.offset];
    } else {
      coll.range = [fc.offset, cePos, cePos];
    }
    return coll;
  }

  // node_modules/yaml/browser/dist/compose/compose-collection.js
  function resolveCollection(CN2, ctx, token, onError, tagName, tag) {
    const coll = token.type === "block-map" ? resolveBlockMap(CN2, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq(CN2, ctx, token, onError, tag) : resolveFlowCollection(CN2, ctx, token, onError, tag);
    const Coll = coll.constructor;
    if (tagName === "!" || tagName === Coll.tagName) {
      coll.tag = Coll.tagName;
      return coll;
    }
    if (tagName)
      coll.tag = tagName;
    return coll;
  }
  function composeCollection(CN2, ctx, token, props, onError) {
    const tagToken = props.tag;
    const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
    if (token.type === "block-seq") {
      const { anchor, newlineAfterProp: nl } = props;
      const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
      if (lastProp && (!nl || nl.offset < lastProp.offset)) {
        const message = "Missing newline after block sequence props";
        onError(lastProp, "MISSING_CHAR", message);
      }
    }
    const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
    if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap.tagName && expType === "map" || tagName === YAMLSeq.tagName && expType === "seq") {
      return resolveCollection(CN2, ctx, token, onError, tagName);
    }
    let tag = ctx.schema.tags.find((t) => t.tag === tagName && t.collection === expType);
    if (!tag) {
      const kt = ctx.schema.knownTags[tagName];
      if (kt && kt.collection === expType) {
        ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
        tag = kt;
      } else {
        if (kt?.collection) {
          onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection}`, true);
        } else {
          onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
        }
        return resolveCollection(CN2, ctx, token, onError, tagName);
      }
    }
    const coll = resolveCollection(CN2, ctx, token, onError, tagName, tag);
    const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
    const node = isNode(res) ? res : new Scalar(res);
    node.range = coll.range;
    node.tag = tagName;
    if (tag?.format)
      node.format = tag.format;
    return node;
  }

  // node_modules/yaml/browser/dist/compose/resolve-block-scalar.js
  function resolveBlockScalar(ctx, scalar, onError) {
    const start = scalar.offset;
    const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
    if (!header)
      return { value: "", type: null, comment: "", range: [start, start, start] };
    const type = header.mode === ">" ? Scalar.BLOCK_FOLDED : Scalar.BLOCK_LITERAL;
    const lines = scalar.source ? splitLines(scalar.source) : [];
    let chompStart = lines.length;
    for (let i3 = lines.length - 1; i3 >= 0; --i3) {
      const content = lines[i3][1];
      if (content === "" || content === "\r")
        chompStart = i3;
      else
        break;
    }
    if (chompStart === 0) {
      const value2 = header.chomp === "+" && lines.length > 0 ? "\n".repeat(Math.max(1, lines.length - 1)) : "";
      let end2 = start + header.length;
      if (scalar.source)
        end2 += scalar.source.length;
      return { value: value2, type, comment: header.comment, range: [start, end2, end2] };
    }
    let trimIndent = scalar.indent + header.indent;
    let offset = scalar.offset + header.length;
    let contentStart = 0;
    for (let i3 = 0; i3 < chompStart; ++i3) {
      const [indent, content] = lines[i3];
      if (content === "" || content === "\r") {
        if (header.indent === 0 && indent.length > trimIndent)
          trimIndent = indent.length;
      } else {
        if (indent.length < trimIndent) {
          const message = "Block scalars with more-indented leading empty lines must use an explicit indentation indicator";
          onError(offset + indent.length, "MISSING_CHAR", message);
        }
        if (header.indent === 0)
          trimIndent = indent.length;
        contentStart = i3;
        if (trimIndent === 0 && !ctx.atRoot) {
          const message = "Block scalar values in collections must be indented";
          onError(offset, "BAD_INDENT", message);
        }
        break;
      }
      offset += indent.length + content.length + 1;
    }
    for (let i3 = lines.length - 1; i3 >= chompStart; --i3) {
      if (lines[i3][0].length > trimIndent)
        chompStart = i3 + 1;
    }
    let value = "";
    let sep = "";
    let prevMoreIndented = false;
    for (let i3 = 0; i3 < contentStart; ++i3)
      value += lines[i3][0].slice(trimIndent) + "\n";
    for (let i3 = contentStart; i3 < chompStart; ++i3) {
      let [indent, content] = lines[i3];
      offset += indent.length + content.length + 1;
      const crlf = content[content.length - 1] === "\r";
      if (crlf)
        content = content.slice(0, -1);
      if (content && indent.length < trimIndent) {
        const src = header.indent ? "explicit indentation indicator" : "first line";
        const message = `Block scalar lines must not be less indented than their ${src}`;
        onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message);
        indent = "";
      }
      if (type === Scalar.BLOCK_LITERAL) {
        value += sep + indent.slice(trimIndent) + content;
        sep = "\n";
      } else if (indent.length > trimIndent || content[0] === "	") {
        if (sep === " ")
          sep = "\n";
        else if (!prevMoreIndented && sep === "\n")
          sep = "\n\n";
        value += sep + indent.slice(trimIndent) + content;
        sep = "\n";
        prevMoreIndented = true;
      } else if (content === "") {
        if (sep === "\n")
          value += "\n";
        else
          sep = "\n";
      } else {
        value += sep + content;
        sep = " ";
        prevMoreIndented = false;
      }
    }
    switch (header.chomp) {
      case "-":
        break;
      case "+":
        for (let i3 = chompStart; i3 < lines.length; ++i3)
          value += "\n" + lines[i3][0].slice(trimIndent);
        if (value[value.length - 1] !== "\n")
          value += "\n";
        break;
      default:
        value += "\n";
    }
    const end = start + header.length + scalar.source.length;
    return { value, type, comment: header.comment, range: [start, end, end] };
  }
  function parseBlockScalarHeader({ offset, props }, strict, onError) {
    if (props[0].type !== "block-scalar-header") {
      onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
      return null;
    }
    const { source } = props[0];
    const mode = source[0];
    let indent = 0;
    let chomp = "";
    let error = -1;
    for (let i3 = 1; i3 < source.length; ++i3) {
      const ch = source[i3];
      if (!chomp && (ch === "-" || ch === "+"))
        chomp = ch;
      else {
        const n = Number(ch);
        if (!indent && n)
          indent = n;
        else if (error === -1)
          error = offset + i3;
      }
    }
    if (error !== -1)
      onError(error, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
    let hasSpace = false;
    let comment = "";
    let length = source.length;
    for (let i3 = 1; i3 < props.length; ++i3) {
      const token = props[i3];
      switch (token.type) {
        case "space":
          hasSpace = true;
        // fallthrough
        case "newline":
          length += token.source.length;
          break;
        case "comment":
          if (strict && !hasSpace) {
            const message = "Comments must be separated from other tokens by white space characters";
            onError(token, "MISSING_CHAR", message);
          }
          length += token.source.length;
          comment = token.source.substring(1);
          break;
        case "error":
          onError(token, "UNEXPECTED_TOKEN", token.message);
          length += token.source.length;
          break;
        /* istanbul ignore next should not happen */
        default: {
          const message = `Unexpected token in block scalar header: ${token.type}`;
          onError(token, "UNEXPECTED_TOKEN", message);
          const ts = token.source;
          if (ts && typeof ts === "string")
            length += ts.length;
        }
      }
    }
    return { mode, indent, chomp, comment, length };
  }
  function splitLines(source) {
    const split = source.split(/\n( *)/);
    const first = split[0];
    const m = first.match(/^( *)/);
    const line0 = m?.[1] ? [m[1], first.slice(m[1].length)] : ["", first];
    const lines = [line0];
    for (let i3 = 1; i3 < split.length; i3 += 2)
      lines.push([split[i3], split[i3 + 1]]);
    return lines;
  }

  // node_modules/yaml/browser/dist/compose/resolve-flow-scalar.js
  function resolveFlowScalar(scalar, strict, onError) {
    const { offset, type, source, end } = scalar;
    let _type;
    let value;
    const _onError = (rel, code, msg) => onError(offset + rel, code, msg);
    switch (type) {
      case "scalar":
        _type = Scalar.PLAIN;
        value = plainValue(source, _onError);
        break;
      case "single-quoted-scalar":
        _type = Scalar.QUOTE_SINGLE;
        value = singleQuotedValue(source, _onError);
        break;
      case "double-quoted-scalar":
        _type = Scalar.QUOTE_DOUBLE;
        value = doubleQuotedValue(source, _onError);
        break;
      /* istanbul ignore next should not happen */
      default:
        onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
        return {
          value: "",
          type: null,
          comment: "",
          range: [offset, offset + source.length, offset + source.length]
        };
    }
    const valueEnd = offset + source.length;
    const re = resolveEnd(end, valueEnd, strict, onError);
    return {
      value,
      type: _type,
      comment: re.comment,
      range: [offset, valueEnd, re.offset]
    };
  }
  function plainValue(source, onError) {
    let badChar = "";
    switch (source[0]) {
      /* istanbul ignore next should not happen */
      case "	":
        badChar = "a tab character";
        break;
      case ",":
        badChar = "flow indicator character ,";
        break;
      case "%":
        badChar = "directive indicator character %";
        break;
      case "|":
      case ">": {
        badChar = `block scalar indicator ${source[0]}`;
        break;
      }
      case "@":
      case "`": {
        badChar = `reserved character ${source[0]}`;
        break;
      }
    }
    if (badChar)
      onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
    return foldLines(source);
  }
  function singleQuotedValue(source, onError) {
    if (source[source.length - 1] !== "'" || source.length === 1)
      onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
    return foldLines(source.slice(1, -1)).replace(/''/g, "'");
  }
  function foldLines(source) {
    let first, line2;
    try {
      first = new RegExp("(.*?)(?<![ 	])[ 	]*\r?\n", "sy");
      line2 = new RegExp("[ 	]*(.*?)(?:(?<![ 	])[ 	]*)?\r?\n", "sy");
    } catch {
      first = /(.*?)[ \t]*\r?\n/sy;
      line2 = /[ \t]*(.*?)[ \t]*\r?\n/sy;
    }
    let match = first.exec(source);
    if (!match)
      return source;
    let res = match[1];
    let sep = " ";
    let pos = first.lastIndex;
    line2.lastIndex = pos;
    while (match = line2.exec(source)) {
      if (match[1] === "") {
        if (sep === "\n")
          res += sep;
        else
          sep = "\n";
      } else {
        res += sep + match[1];
        sep = " ";
      }
      pos = line2.lastIndex;
    }
    const last = /[ \t]*(.*)/sy;
    last.lastIndex = pos;
    match = last.exec(source);
    return res + sep + (match?.[1] ?? "");
  }
  function doubleQuotedValue(source, onError) {
    let res = "";
    for (let i3 = 1; i3 < source.length - 1; ++i3) {
      const ch = source[i3];
      if (ch === "\r" && source[i3 + 1] === "\n")
        continue;
      if (ch === "\n") {
        const { fold, offset } = foldNewline(source, i3);
        res += fold;
        i3 = offset;
      } else if (ch === "\\") {
        let next = source[++i3];
        const cc = escapeCodes[next];
        if (cc)
          res += cc;
        else if (next === "\n") {
          next = source[i3 + 1];
          while (next === " " || next === "	")
            next = source[++i3 + 1];
        } else if (next === "\r" && source[i3 + 1] === "\n") {
          next = source[++i3 + 1];
          while (next === " " || next === "	")
            next = source[++i3 + 1];
        } else if (next === "x" || next === "u" || next === "U") {
          const length = { x: 2, u: 4, U: 8 }[next];
          res += parseCharCode(source, i3 + 1, length, onError);
          i3 += length;
        } else {
          const raw = source.substr(i3 - 1, 2);
          onError(i3 - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
          res += raw;
        }
      } else if (ch === " " || ch === "	") {
        const wsStart = i3;
        let next = source[i3 + 1];
        while (next === " " || next === "	")
          next = source[++i3 + 1];
        if (next !== "\n" && !(next === "\r" && source[i3 + 2] === "\n"))
          res += i3 > wsStart ? source.slice(wsStart, i3 + 1) : ch;
      } else {
        res += ch;
      }
    }
    if (source[source.length - 1] !== '"' || source.length === 1)
      onError(source.length, "MISSING_CHAR", 'Missing closing "quote');
    return res;
  }
  function foldNewline(source, offset) {
    let fold = "";
    let ch = source[offset + 1];
    while (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
      if (ch === "\r" && source[offset + 2] !== "\n")
        break;
      if (ch === "\n")
        fold += "\n";
      offset += 1;
      ch = source[offset + 1];
    }
    if (!fold)
      fold = " ";
    return { fold, offset };
  }
  var escapeCodes = {
    "0": "\0",
    // null character
    a: "\x07",
    // bell character
    b: "\b",
    // backspace
    e: "\x1B",
    // escape character
    f: "\f",
    // form feed
    n: "\n",
    // line feed
    r: "\r",
    // carriage return
    t: "	",
    // horizontal tab
    v: "\v",
    // vertical tab
    N: "\x85",
    // Unicode next line
    _: "\xA0",
    // Unicode non-breaking space
    L: "\u2028",
    // Unicode line separator
    P: "\u2029",
    // Unicode paragraph separator
    " ": " ",
    '"': '"',
    "/": "/",
    "\\": "\\",
    "	": "	"
  };
  function parseCharCode(source, offset, length, onError) {
    const cc = source.substr(offset, length);
    const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
    const code = ok ? parseInt(cc, 16) : NaN;
    if (isNaN(code)) {
      const raw = source.substr(offset - 2, length + 2);
      onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
      return raw;
    }
    return String.fromCodePoint(code);
  }

  // node_modules/yaml/browser/dist/compose/compose-scalar.js
  function composeScalar(ctx, token, tagToken, onError) {
    const { value, type, comment, range } = token.type === "block-scalar" ? resolveBlockScalar(ctx, token, onError) : resolveFlowScalar(token, ctx.options.strict, onError);
    const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
    let tag;
    if (ctx.options.stringKeys && ctx.atKey) {
      tag = ctx.schema[SCALAR];
    } else if (tagName)
      tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
    else if (token.type === "scalar")
      tag = findScalarTagByTest(ctx, value, token, onError);
    else
      tag = ctx.schema[SCALAR];
    let scalar;
    try {
      const res = tag.resolve(value, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
      scalar = isScalar(res) ? res : new Scalar(res);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
      scalar = new Scalar(value);
    }
    scalar.range = range;
    scalar.source = value;
    if (type)
      scalar.type = type;
    if (tagName)
      scalar.tag = tagName;
    if (tag.format)
      scalar.format = tag.format;
    if (comment)
      scalar.comment = comment;
    return scalar;
  }
  function findScalarTagByName(schema4, value, tagName, tagToken, onError) {
    if (tagName === "!")
      return schema4[SCALAR];
    const matchWithTest = [];
    for (const tag of schema4.tags) {
      if (!tag.collection && tag.tag === tagName) {
        if (tag.default && tag.test)
          matchWithTest.push(tag);
        else
          return tag;
      }
    }
    for (const tag of matchWithTest)
      if (tag.test?.test(value))
        return tag;
    const kt = schema4.knownTags[tagName];
    if (kt && !kt.collection) {
      schema4.tags.push(Object.assign({}, kt, { default: false, test: void 0 }));
      return kt;
    }
    onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
    return schema4[SCALAR];
  }
  function findScalarTagByTest({ atKey, directives, schema: schema4 }, value, token, onError) {
    const tag = schema4.tags.find((tag2) => (tag2.default === true || atKey && tag2.default === "key") && tag2.test?.test(value)) || schema4[SCALAR];
    if (schema4.compat) {
      const compat = schema4.compat.find((tag2) => tag2.default && tag2.test?.test(value)) ?? schema4[SCALAR];
      if (tag.tag !== compat.tag) {
        const ts = directives.tagString(tag.tag);
        const cs = directives.tagString(compat.tag);
        const msg = `Value may be parsed as either ${ts} or ${cs}`;
        onError(token, "TAG_RESOLVE_FAILED", msg, true);
      }
    }
    return tag;
  }

  // node_modules/yaml/browser/dist/compose/util-empty-scalar-position.js
  function emptyScalarPosition(offset, before, pos) {
    if (before) {
      if (pos === null)
        pos = before.length;
      for (let i3 = pos - 1; i3 >= 0; --i3) {
        let st = before[i3];
        switch (st.type) {
          case "space":
          case "comment":
          case "newline":
            offset -= st.source.length;
            continue;
        }
        st = before[++i3];
        while (st?.type === "space") {
          offset += st.source.length;
          st = before[++i3];
        }
        break;
      }
    }
    return offset;
  }

  // node_modules/yaml/browser/dist/compose/compose-node.js
  var CN = { composeNode, composeEmptyNode };
  function composeNode(ctx, token, props, onError) {
    const atKey = ctx.atKey;
    const { spaceBefore, comment, anchor, tag } = props;
    let node;
    let isSrcToken = true;
    switch (token.type) {
      case "alias":
        node = composeAlias(ctx, token, onError);
        if (anchor || tag)
          onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
        break;
      case "scalar":
      case "single-quoted-scalar":
      case "double-quoted-scalar":
      case "block-scalar":
        node = composeScalar(ctx, token, tag, onError);
        if (anchor)
          node.anchor = anchor.source.substring(1);
        break;
      case "block-map":
      case "block-seq":
      case "flow-collection":
        node = composeCollection(CN, ctx, token, props, onError);
        if (anchor)
          node.anchor = anchor.source.substring(1);
        break;
      default: {
        const message = token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`;
        onError(token, "UNEXPECTED_TOKEN", message);
        node = composeEmptyNode(ctx, token.offset, void 0, null, props, onError);
        isSrcToken = false;
      }
    }
    if (anchor && node.anchor === "")
      onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
    if (atKey && ctx.options.stringKeys && (!isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) {
      const msg = "With stringKeys, all keys must be strings";
      onError(tag ?? token, "NON_STRING_KEY", msg);
    }
    if (spaceBefore)
      node.spaceBefore = true;
    if (comment) {
      if (token.type === "scalar" && token.source === "")
        node.comment = comment;
      else
        node.commentBefore = comment;
    }
    if (ctx.options.keepSourceTokens && isSrcToken)
      node.srcToken = token;
    return node;
  }
  function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
    const token = {
      type: "scalar",
      offset: emptyScalarPosition(offset, before, pos),
      indent: -1,
      source: ""
    };
    const node = composeScalar(ctx, token, tag, onError);
    if (anchor) {
      node.anchor = anchor.source.substring(1);
      if (node.anchor === "")
        onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
    }
    if (spaceBefore)
      node.spaceBefore = true;
    if (comment) {
      node.comment = comment;
      node.range[2] = end;
    }
    return node;
  }
  function composeAlias({ options }, { offset, source, end }, onError) {
    const alias = new Alias(source.substring(1));
    if (alias.source === "")
      onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
    if (alias.source.endsWith(":"))
      onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
    const valueEnd = offset + source.length;
    const re = resolveEnd(end, valueEnd, options.strict, onError);
    alias.range = [offset, valueEnd, re.offset];
    if (re.comment)
      alias.comment = re.comment;
    return alias;
  }

  // node_modules/yaml/browser/dist/compose/compose-doc.js
  function composeDoc(options, directives, { offset, start, value, end }, onError) {
    const opts = Object.assign({ _directives: directives }, options);
    const doc = new Document(void 0, opts);
    const ctx = {
      atKey: false,
      atRoot: true,
      directives: doc.directives,
      options: doc.options,
      schema: doc.schema
    };
    const props = resolveProps(start, {
      indicator: "doc-start",
      next: value ?? end?.[0],
      offset,
      onError,
      parentIndent: 0,
      startOnNewline: true
    });
    if (props.found) {
      doc.directives.docStart = true;
      if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline)
        onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
    }
    doc.contents = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
    const contentEnd = doc.contents.range[2];
    const re = resolveEnd(end, contentEnd, false, onError);
    if (re.comment)
      doc.comment = re.comment;
    doc.range = [offset, contentEnd, re.offset];
    return doc;
  }

  // node_modules/yaml/browser/dist/compose/composer.js
  function getErrorPos(src) {
    if (typeof src === "number")
      return [src, src + 1];
    if (Array.isArray(src))
      return src.length === 2 ? src : [src[0], src[1]];
    const { offset, source } = src;
    return [offset, offset + (typeof source === "string" ? source.length : 1)];
  }
  function parsePrelude(prelude) {
    let comment = "";
    let atComment = false;
    let afterEmptyLine = false;
    for (let i3 = 0; i3 < prelude.length; ++i3) {
      const source = prelude[i3];
      switch (source[0]) {
        case "#":
          comment += (comment === "" ? "" : afterEmptyLine ? "\n\n" : "\n") + (source.substring(1) || " ");
          atComment = true;
          afterEmptyLine = false;
          break;
        case "%":
          if (prelude[i3 + 1]?.[0] !== "#")
            i3 += 1;
          atComment = false;
          break;
        default:
          if (!atComment)
            afterEmptyLine = true;
          atComment = false;
      }
    }
    return { comment, afterEmptyLine };
  }
  var Composer = class {
    constructor(options = {}) {
      this.doc = null;
      this.atDirectives = false;
      this.prelude = [];
      this.errors = [];
      this.warnings = [];
      this.onError = (source, code, message, warning) => {
        const pos = getErrorPos(source);
        if (warning)
          this.warnings.push(new YAMLWarning(pos, code, message));
        else
          this.errors.push(new YAMLParseError(pos, code, message));
      };
      this.directives = new Directives({ version: options.version || "1.2" });
      this.options = options;
    }
    decorate(doc, afterDoc) {
      const { comment, afterEmptyLine } = parsePrelude(this.prelude);
      if (comment) {
        const dc = doc.contents;
        if (afterDoc) {
          doc.comment = doc.comment ? `${doc.comment}
${comment}` : comment;
        } else if (afterEmptyLine || doc.directives.docStart || !dc) {
          doc.commentBefore = comment;
        } else if (isCollection(dc) && !dc.flow && dc.items.length > 0) {
          let it = dc.items[0];
          if (isPair(it))
            it = it.key;
          const cb = it.commentBefore;
          it.commentBefore = cb ? `${comment}
${cb}` : comment;
        } else {
          const cb = dc.commentBefore;
          dc.commentBefore = cb ? `${comment}
${cb}` : comment;
        }
      }
      if (afterDoc) {
        Array.prototype.push.apply(doc.errors, this.errors);
        Array.prototype.push.apply(doc.warnings, this.warnings);
      } else {
        doc.errors = this.errors;
        doc.warnings = this.warnings;
      }
      this.prelude = [];
      this.errors = [];
      this.warnings = [];
    }
    /**
     * Current stream status information.
     *
     * Mostly useful at the end of input for an empty stream.
     */
    streamInfo() {
      return {
        comment: parsePrelude(this.prelude).comment,
        directives: this.directives,
        errors: this.errors,
        warnings: this.warnings
      };
    }
    /**
     * Compose tokens into documents.
     *
     * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
     * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
     */
    *compose(tokens, forceDoc = false, endOffset = -1) {
      for (const token of tokens)
        yield* this.next(token);
      yield* this.end(forceDoc, endOffset);
    }
    /** Advance the composer by one CST token. */
    *next(token) {
      switch (token.type) {
        case "directive":
          this.directives.add(token.source, (offset, message, warning) => {
            const pos = getErrorPos(token);
            pos[0] += offset;
            this.onError(pos, "BAD_DIRECTIVE", message, warning);
          });
          this.prelude.push(token.source);
          this.atDirectives = true;
          break;
        case "document": {
          const doc = composeDoc(this.options, this.directives, token, this.onError);
          if (this.atDirectives && !doc.directives.docStart)
            this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
          this.decorate(doc, false);
          if (this.doc)
            yield this.doc;
          this.doc = doc;
          this.atDirectives = false;
          break;
        }
        case "byte-order-mark":
        case "space":
          break;
        case "comment":
        case "newline":
          this.prelude.push(token.source);
          break;
        case "error": {
          const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
          const error = new YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
          if (this.atDirectives || !this.doc)
            this.errors.push(error);
          else
            this.doc.errors.push(error);
          break;
        }
        case "doc-end": {
          if (!this.doc) {
            const msg = "Unexpected doc-end without preceding document";
            this.errors.push(new YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg));
            break;
          }
          this.doc.directives.docEnd = true;
          const end = resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
          this.decorate(this.doc, true);
          if (end.comment) {
            const dc = this.doc.comment;
            this.doc.comment = dc ? `${dc}
${end.comment}` : end.comment;
          }
          this.doc.range[2] = end.offset;
          break;
        }
        default:
          this.errors.push(new YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
      }
    }
    /**
     * Call at end of input to yield any remaining document.
     *
     * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
     * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
     */
    *end(forceDoc = false, endOffset = -1) {
      if (this.doc) {
        this.decorate(this.doc, true);
        yield this.doc;
        this.doc = null;
      } else if (forceDoc) {
        const opts = Object.assign({ _directives: this.directives }, this.options);
        const doc = new Document(void 0, opts);
        if (this.atDirectives)
          this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
        doc.range = [0, endOffset, endOffset];
        this.decorate(doc, false);
        yield doc;
      }
    }
  };

  // node_modules/yaml/browser/dist/parse/cst-visit.js
  var BREAK2 = Symbol("break visit");
  var SKIP2 = Symbol("skip children");
  var REMOVE2 = Symbol("remove item");
  function visit2(cst, visitor) {
    if ("type" in cst && cst.type === "document")
      cst = { start: cst.start, value: cst.value };
    _visit(Object.freeze([]), cst, visitor);
  }
  visit2.BREAK = BREAK2;
  visit2.SKIP = SKIP2;
  visit2.REMOVE = REMOVE2;
  visit2.itemAtPath = (cst, path) => {
    let item = cst;
    for (const [field, index] of path) {
      const tok = item?.[field];
      if (tok && "items" in tok) {
        item = tok.items[index];
      } else
        return void 0;
    }
    return item;
  };
  visit2.parentCollection = (cst, path) => {
    const parent = visit2.itemAtPath(cst, path.slice(0, -1));
    const field = path[path.length - 1][0];
    const coll = parent?.[field];
    if (coll && "items" in coll)
      return coll;
    throw new Error("Parent collection not found");
  };
  function _visit(path, item, visitor) {
    let ctrl = visitor(item, path);
    if (typeof ctrl === "symbol")
      return ctrl;
    for (const field of ["key", "value"]) {
      const token = item[field];
      if (token && "items" in token) {
        for (let i3 = 0; i3 < token.items.length; ++i3) {
          const ci = _visit(Object.freeze(path.concat([[field, i3]])), token.items[i3], visitor);
          if (typeof ci === "number")
            i3 = ci - 1;
          else if (ci === BREAK2)
            return BREAK2;
          else if (ci === REMOVE2) {
            token.items.splice(i3, 1);
            i3 -= 1;
          }
        }
        if (typeof ctrl === "function" && field === "key")
          ctrl = ctrl(item, path);
      }
    }
    return typeof ctrl === "function" ? ctrl(item, path) : ctrl;
  }

  // node_modules/yaml/browser/dist/parse/cst.js
  var BOM = "\uFEFF";
  var DOCUMENT = "";
  var FLOW_END = "";
  var SCALAR2 = "";
  function tokenType(source) {
    switch (source) {
      case BOM:
        return "byte-order-mark";
      case DOCUMENT:
        return "doc-mode";
      case FLOW_END:
        return "flow-error-end";
      case SCALAR2:
        return "scalar";
      case "---":
        return "doc-start";
      case "...":
        return "doc-end";
      case "":
      case "\n":
      case "\r\n":
        return "newline";
      case "-":
        return "seq-item-ind";
      case "?":
        return "explicit-key-ind";
      case ":":
        return "map-value-ind";
      case "{":
        return "flow-map-start";
      case "}":
        return "flow-map-end";
      case "[":
        return "flow-seq-start";
      case "]":
        return "flow-seq-end";
      case ",":
        return "comma";
    }
    switch (source[0]) {
      case " ":
      case "	":
        return "space";
      case "#":
        return "comment";
      case "%":
        return "directive-line";
      case "*":
        return "alias";
      case "&":
        return "anchor";
      case "!":
        return "tag";
      case "'":
        return "single-quoted-scalar";
      case '"':
        return "double-quoted-scalar";
      case "|":
      case ">":
        return "block-scalar-header";
    }
    return null;
  }

  // node_modules/yaml/browser/dist/parse/lexer.js
  function isEmpty(ch) {
    switch (ch) {
      case void 0:
      case " ":
      case "\n":
      case "\r":
      case "	":
        return true;
      default:
        return false;
    }
  }
  var hexDigits = new Set("0123456789ABCDEFabcdef");
  var tagChars = new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
  var flowIndicatorChars = new Set(",[]{}");
  var invalidAnchorChars = new Set(" ,[]{}\n\r	");
  var isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
  var Lexer = class {
    constructor() {
      this.atEnd = false;
      this.blockScalarIndent = -1;
      this.blockScalarKeep = false;
      this.buffer = "";
      this.flowKey = false;
      this.flowLevel = 0;
      this.indentNext = 0;
      this.indentValue = 0;
      this.lineEndPos = null;
      this.next = null;
      this.pos = 0;
    }
    /**
     * Generate YAML tokens from the `source` string. If `incomplete`,
     * a part of the last line may be left as a buffer for the next call.
     *
     * @returns A generator of lexical tokens
     */
    *lex(source, incomplete = false) {
      if (source) {
        if (typeof source !== "string")
          throw TypeError("source is not a string");
        this.buffer = this.buffer ? this.buffer + source : source;
        this.lineEndPos = null;
      }
      this.atEnd = !incomplete;
      let next = this.next ?? "stream";
      while (next && (incomplete || this.hasChars(1)))
        next = yield* this.parseNext(next);
    }
    atLineEnd() {
      let i3 = this.pos;
      let ch = this.buffer[i3];
      while (ch === " " || ch === "	")
        ch = this.buffer[++i3];
      if (!ch || ch === "#" || ch === "\n")
        return true;
      if (ch === "\r")
        return this.buffer[i3 + 1] === "\n";
      return false;
    }
    charAt(n) {
      return this.buffer[this.pos + n];
    }
    continueScalar(offset) {
      let ch = this.buffer[offset];
      if (this.indentNext > 0) {
        let indent = 0;
        while (ch === " ")
          ch = this.buffer[++indent + offset];
        if (ch === "\r") {
          const next = this.buffer[indent + offset + 1];
          if (next === "\n" || !next && !this.atEnd)
            return offset + indent + 1;
        }
        return ch === "\n" || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
      }
      if (ch === "-" || ch === ".") {
        const dt = this.buffer.substr(offset, 3);
        if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3]))
          return -1;
      }
      return offset;
    }
    getLine() {
      let end = this.lineEndPos;
      if (typeof end !== "number" || end !== -1 && end < this.pos) {
        end = this.buffer.indexOf("\n", this.pos);
        this.lineEndPos = end;
      }
      if (end === -1)
        return this.atEnd ? this.buffer.substring(this.pos) : null;
      if (this.buffer[end - 1] === "\r")
        end -= 1;
      return this.buffer.substring(this.pos, end);
    }
    hasChars(n) {
      return this.pos + n <= this.buffer.length;
    }
    setNext(state) {
      this.buffer = this.buffer.substring(this.pos);
      this.pos = 0;
      this.lineEndPos = null;
      this.next = state;
      return null;
    }
    peek(n) {
      return this.buffer.substr(this.pos, n);
    }
    *parseNext(next) {
      switch (next) {
        case "stream":
          return yield* this.parseStream();
        case "line-start":
          return yield* this.parseLineStart();
        case "block-start":
          return yield* this.parseBlockStart();
        case "doc":
          return yield* this.parseDocument();
        case "flow":
          return yield* this.parseFlowCollection();
        case "quoted-scalar":
          return yield* this.parseQuotedScalar();
        case "block-scalar":
          return yield* this.parseBlockScalar();
        case "plain-scalar":
          return yield* this.parsePlainScalar();
      }
    }
    *parseStream() {
      let line2 = this.getLine();
      if (line2 === null)
        return this.setNext("stream");
      if (line2[0] === BOM) {
        yield* this.pushCount(1);
        line2 = line2.substring(1);
      }
      if (line2[0] === "%") {
        let dirEnd = line2.length;
        let cs = line2.indexOf("#");
        while (cs !== -1) {
          const ch = line2[cs - 1];
          if (ch === " " || ch === "	") {
            dirEnd = cs - 1;
            break;
          } else {
            cs = line2.indexOf("#", cs + 1);
          }
        }
        while (true) {
          const ch = line2[dirEnd - 1];
          if (ch === " " || ch === "	")
            dirEnd -= 1;
          else
            break;
        }
        const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
        yield* this.pushCount(line2.length - n);
        this.pushNewline();
        return "stream";
      }
      if (this.atLineEnd()) {
        const sp2 = yield* this.pushSpaces(true);
        yield* this.pushCount(line2.length - sp2);
        yield* this.pushNewline();
        return "stream";
      }
      yield DOCUMENT;
      return yield* this.parseLineStart();
    }
    *parseLineStart() {
      const ch = this.charAt(0);
      if (!ch && !this.atEnd)
        return this.setNext("line-start");
      if (ch === "-" || ch === ".") {
        if (!this.atEnd && !this.hasChars(4))
          return this.setNext("line-start");
        const s = this.peek(3);
        if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
          yield* this.pushCount(3);
          this.indentValue = 0;
          this.indentNext = 0;
          return s === "---" ? "doc" : "stream";
        }
      }
      this.indentValue = yield* this.pushSpaces(false);
      if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
        this.indentNext = this.indentValue;
      return yield* this.parseBlockStart();
    }
    *parseBlockStart() {
      const [ch0, ch1] = this.peek(2);
      if (!ch1 && !this.atEnd)
        return this.setNext("block-start");
      if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
        const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
        this.indentNext = this.indentValue + 1;
        this.indentValue += n;
        return yield* this.parseBlockStart();
      }
      return "doc";
    }
    *parseDocument() {
      yield* this.pushSpaces(true);
      const line2 = this.getLine();
      if (line2 === null)
        return this.setNext("doc");
      let n = yield* this.pushIndicators();
      switch (line2[n]) {
        case "#":
          yield* this.pushCount(line2.length - n);
        // fallthrough
        case void 0:
          yield* this.pushNewline();
          return yield* this.parseLineStart();
        case "{":
        case "[":
          yield* this.pushCount(1);
          this.flowKey = false;
          this.flowLevel = 1;
          return "flow";
        case "}":
        case "]":
          yield* this.pushCount(1);
          return "doc";
        case "*":
          yield* this.pushUntil(isNotAnchorChar);
          return "doc";
        case '"':
        case "'":
          return yield* this.parseQuotedScalar();
        case "|":
        case ">":
          n += yield* this.parseBlockScalarHeader();
          n += yield* this.pushSpaces(true);
          yield* this.pushCount(line2.length - n);
          yield* this.pushNewline();
          return yield* this.parseBlockScalar();
        default:
          return yield* this.parsePlainScalar();
      }
    }
    *parseFlowCollection() {
      let nl, sp2;
      let indent = -1;
      do {
        nl = yield* this.pushNewline();
        if (nl > 0) {
          sp2 = yield* this.pushSpaces(false);
          this.indentValue = indent = sp2;
        } else {
          sp2 = 0;
        }
        sp2 += yield* this.pushSpaces(true);
      } while (nl + sp2 > 0);
      const line2 = this.getLine();
      if (line2 === null)
        return this.setNext("flow");
      if (indent !== -1 && indent < this.indentNext && line2[0] !== "#" || indent === 0 && (line2.startsWith("---") || line2.startsWith("...")) && isEmpty(line2[3])) {
        const atFlowEndMarker = indent === this.indentNext - 1 && this.flowLevel === 1 && (line2[0] === "]" || line2[0] === "}");
        if (!atFlowEndMarker) {
          this.flowLevel = 0;
          yield FLOW_END;
          return yield* this.parseLineStart();
        }
      }
      let n = 0;
      while (line2[n] === ",") {
        n += yield* this.pushCount(1);
        n += yield* this.pushSpaces(true);
        this.flowKey = false;
      }
      n += yield* this.pushIndicators();
      switch (line2[n]) {
        case void 0:
          return "flow";
        case "#":
          yield* this.pushCount(line2.length - n);
          return "flow";
        case "{":
        case "[":
          yield* this.pushCount(1);
          this.flowKey = false;
          this.flowLevel += 1;
          return "flow";
        case "}":
        case "]":
          yield* this.pushCount(1);
          this.flowKey = true;
          this.flowLevel -= 1;
          return this.flowLevel ? "flow" : "doc";
        case "*":
          yield* this.pushUntil(isNotAnchorChar);
          return "flow";
        case '"':
        case "'":
          this.flowKey = true;
          return yield* this.parseQuotedScalar();
        case ":": {
          const next = this.charAt(1);
          if (this.flowKey || isEmpty(next) || next === ",") {
            this.flowKey = false;
            yield* this.pushCount(1);
            yield* this.pushSpaces(true);
            return "flow";
          }
        }
        // fallthrough
        default:
          this.flowKey = false;
          return yield* this.parsePlainScalar();
      }
    }
    *parseQuotedScalar() {
      const quote = this.charAt(0);
      let end = this.buffer.indexOf(quote, this.pos + 1);
      if (quote === "'") {
        while (end !== -1 && this.buffer[end + 1] === "'")
          end = this.buffer.indexOf("'", end + 2);
      } else {
        while (end !== -1) {
          let n = 0;
          while (this.buffer[end - 1 - n] === "\\")
            n += 1;
          if (n % 2 === 0)
            break;
          end = this.buffer.indexOf('"', end + 1);
        }
      }
      const qb = this.buffer.substring(0, end);
      let nl = qb.indexOf("\n", this.pos);
      if (nl !== -1) {
        while (nl !== -1) {
          const cs = this.continueScalar(nl + 1);
          if (cs === -1)
            break;
          nl = qb.indexOf("\n", cs);
        }
        if (nl !== -1) {
          end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
        }
      }
      if (end === -1) {
        if (!this.atEnd)
          return this.setNext("quoted-scalar");
        end = this.buffer.length;
      }
      yield* this.pushToIndex(end + 1, false);
      return this.flowLevel ? "flow" : "doc";
    }
    *parseBlockScalarHeader() {
      this.blockScalarIndent = -1;
      this.blockScalarKeep = false;
      let i3 = this.pos;
      while (true) {
        const ch = this.buffer[++i3];
        if (ch === "+")
          this.blockScalarKeep = true;
        else if (ch > "0" && ch <= "9")
          this.blockScalarIndent = Number(ch) - 1;
        else if (ch !== "-")
          break;
      }
      return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
    }
    *parseBlockScalar() {
      let nl = this.pos - 1;
      let indent = 0;
      let ch;
      loop: for (let i4 = this.pos; ch = this.buffer[i4]; ++i4) {
        switch (ch) {
          case " ":
            indent += 1;
            break;
          case "\n":
            nl = i4;
            indent = 0;
            break;
          case "\r": {
            const next = this.buffer[i4 + 1];
            if (!next && !this.atEnd)
              return this.setNext("block-scalar");
            if (next === "\n")
              break;
          }
          // fallthrough
          default:
            break loop;
        }
      }
      if (!ch && !this.atEnd)
        return this.setNext("block-scalar");
      if (indent >= this.indentNext) {
        if (this.blockScalarIndent === -1)
          this.indentNext = indent;
        else {
          this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
        }
        do {
          const cs = this.continueScalar(nl + 1);
          if (cs === -1)
            break;
          nl = this.buffer.indexOf("\n", cs);
        } while (nl !== -1);
        if (nl === -1) {
          if (!this.atEnd)
            return this.setNext("block-scalar");
          nl = this.buffer.length;
        }
      }
      let i3 = nl + 1;
      ch = this.buffer[i3];
      while (ch === " ")
        ch = this.buffer[++i3];
      if (ch === "	") {
        while (ch === "	" || ch === " " || ch === "\r" || ch === "\n")
          ch = this.buffer[++i3];
        nl = i3 - 1;
      } else if (!this.blockScalarKeep) {
        do {
          let i4 = nl - 1;
          let ch2 = this.buffer[i4];
          if (ch2 === "\r")
            ch2 = this.buffer[--i4];
          const lastChar = i4;
          while (ch2 === " ")
            ch2 = this.buffer[--i4];
          if (ch2 === "\n" && i4 >= this.pos && i4 + 1 + indent > lastChar)
            nl = i4;
          else
            break;
        } while (true);
      }
      yield SCALAR2;
      yield* this.pushToIndex(nl + 1, true);
      return yield* this.parseLineStart();
    }
    *parsePlainScalar() {
      const inFlow = this.flowLevel > 0;
      let end = this.pos - 1;
      let i3 = this.pos - 1;
      let ch;
      while (ch = this.buffer[++i3]) {
        if (ch === ":") {
          const next = this.buffer[i3 + 1];
          if (isEmpty(next) || inFlow && flowIndicatorChars.has(next))
            break;
          end = i3;
        } else if (isEmpty(ch)) {
          let next = this.buffer[i3 + 1];
          if (ch === "\r") {
            if (next === "\n") {
              i3 += 1;
              ch = "\n";
              next = this.buffer[i3 + 1];
            } else
              end = i3;
          }
          if (next === "#" || inFlow && flowIndicatorChars.has(next))
            break;
          if (ch === "\n") {
            const cs = this.continueScalar(i3 + 1);
            if (cs === -1)
              break;
            i3 = Math.max(i3, cs - 2);
          }
        } else {
          if (inFlow && flowIndicatorChars.has(ch))
            break;
          end = i3;
        }
      }
      if (!ch && !this.atEnd)
        return this.setNext("plain-scalar");
      yield SCALAR2;
      yield* this.pushToIndex(end + 1, true);
      return inFlow ? "flow" : "doc";
    }
    *pushCount(n) {
      if (n > 0) {
        yield this.buffer.substr(this.pos, n);
        this.pos += n;
        return n;
      }
      return 0;
    }
    *pushToIndex(i3, allowEmpty) {
      const s = this.buffer.slice(this.pos, i3);
      if (s) {
        yield s;
        this.pos += s.length;
        return s.length;
      } else if (allowEmpty)
        yield "";
      return 0;
    }
    *pushIndicators() {
      switch (this.charAt(0)) {
        case "!":
          return (yield* this.pushTag()) + (yield* this.pushSpaces(true)) + (yield* this.pushIndicators());
        case "&":
          return (yield* this.pushUntil(isNotAnchorChar)) + (yield* this.pushSpaces(true)) + (yield* this.pushIndicators());
        case "-":
        // this is an error
        case "?":
        // this is an error outside flow collections
        case ":": {
          const inFlow = this.flowLevel > 0;
          const ch1 = this.charAt(1);
          if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
            if (!inFlow)
              this.indentNext = this.indentValue + 1;
            else if (this.flowKey)
              this.flowKey = false;
            return (yield* this.pushCount(1)) + (yield* this.pushSpaces(true)) + (yield* this.pushIndicators());
          }
        }
      }
      return 0;
    }
    *pushTag() {
      if (this.charAt(1) === "<") {
        let i3 = this.pos + 2;
        let ch = this.buffer[i3];
        while (!isEmpty(ch) && ch !== ">")
          ch = this.buffer[++i3];
        return yield* this.pushToIndex(ch === ">" ? i3 + 1 : i3, false);
      } else {
        let i3 = this.pos + 1;
        let ch = this.buffer[i3];
        while (ch) {
          if (tagChars.has(ch))
            ch = this.buffer[++i3];
          else if (ch === "%" && hexDigits.has(this.buffer[i3 + 1]) && hexDigits.has(this.buffer[i3 + 2])) {
            ch = this.buffer[i3 += 3];
          } else
            break;
        }
        return yield* this.pushToIndex(i3, false);
      }
    }
    *pushNewline() {
      const ch = this.buffer[this.pos];
      if (ch === "\n")
        return yield* this.pushCount(1);
      else if (ch === "\r" && this.charAt(1) === "\n")
        return yield* this.pushCount(2);
      else
        return 0;
    }
    *pushSpaces(allowTabs) {
      let i3 = this.pos - 1;
      let ch;
      do {
        ch = this.buffer[++i3];
      } while (ch === " " || allowTabs && ch === "	");
      const n = i3 - this.pos;
      if (n > 0) {
        yield this.buffer.substr(this.pos, n);
        this.pos = i3;
      }
      return n;
    }
    *pushUntil(test) {
      let i3 = this.pos;
      let ch = this.buffer[i3];
      while (!test(ch))
        ch = this.buffer[++i3];
      return yield* this.pushToIndex(i3, false);
    }
  };

  // node_modules/yaml/browser/dist/parse/line-counter.js
  var LineCounter = class {
    constructor() {
      this.lineStarts = [];
      this.addNewLine = (offset) => this.lineStarts.push(offset);
      this.linePos = (offset) => {
        let low = 0;
        let high = this.lineStarts.length;
        while (low < high) {
          const mid = low + high >> 1;
          if (this.lineStarts[mid] < offset)
            low = mid + 1;
          else
            high = mid;
        }
        if (this.lineStarts[low] === offset)
          return { line: low + 1, col: 1 };
        if (low === 0)
          return { line: 0, col: offset };
        const start = this.lineStarts[low - 1];
        return { line: low, col: offset - start + 1 };
      };
    }
  };

  // node_modules/yaml/browser/dist/parse/parser.js
  function includesToken(list3, type) {
    for (let i3 = 0; i3 < list3.length; ++i3)
      if (list3[i3].type === type)
        return true;
    return false;
  }
  function findNonEmptyIndex(list3) {
    for (let i3 = 0; i3 < list3.length; ++i3) {
      switch (list3[i3].type) {
        case "space":
        case "comment":
        case "newline":
          break;
        default:
          return i3;
      }
    }
    return -1;
  }
  function isFlowToken(token) {
    switch (token?.type) {
      case "alias":
      case "scalar":
      case "single-quoted-scalar":
      case "double-quoted-scalar":
      case "flow-collection":
        return true;
      default:
        return false;
    }
  }
  function getPrevProps(parent) {
    switch (parent.type) {
      case "document":
        return parent.start;
      case "block-map": {
        const it = parent.items[parent.items.length - 1];
        return it.sep ?? it.start;
      }
      case "block-seq":
        return parent.items[parent.items.length - 1].start;
      /* istanbul ignore next should not happen */
      default:
        return [];
    }
  }
  function getFirstKeyStartProps(prev) {
    if (prev.length === 0)
      return [];
    let i3 = prev.length;
    loop: while (--i3 >= 0) {
      switch (prev[i3].type) {
        case "doc-start":
        case "explicit-key-ind":
        case "map-value-ind":
        case "seq-item-ind":
        case "newline":
          break loop;
      }
    }
    while (prev[++i3]?.type === "space") {
    }
    return prev.splice(i3, prev.length);
  }
  function fixFlowSeqItems(fc) {
    if (fc.start.type === "flow-seq-start") {
      for (const it of fc.items) {
        if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
          if (it.key)
            it.value = it.key;
          delete it.key;
          if (isFlowToken(it.value)) {
            if (it.value.end)
              Array.prototype.push.apply(it.value.end, it.sep);
            else
              it.value.end = it.sep;
          } else
            Array.prototype.push.apply(it.start, it.sep);
          delete it.sep;
        }
      }
    }
  }
  var Parser = class {
    /**
     * @param onNewLine - If defined, called separately with the start position of
     *   each new line (in `parse()`, including the start of input).
     */
    constructor(onNewLine) {
      this.atNewLine = true;
      this.atScalar = false;
      this.indent = 0;
      this.offset = 0;
      this.onKeyLine = false;
      this.stack = [];
      this.source = "";
      this.type = "";
      this.lexer = new Lexer();
      this.onNewLine = onNewLine;
    }
    /**
     * Parse `source` as a YAML stream.
     * If `incomplete`, a part of the last line may be left as a buffer for the next call.
     *
     * Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
     *
     * @returns A generator of tokens representing each directive, document, and other structure.
     */
    *parse(source, incomplete = false) {
      if (this.onNewLine && this.offset === 0)
        this.onNewLine(0);
      for (const lexeme of this.lexer.lex(source, incomplete))
        yield* this.next(lexeme);
      if (!incomplete)
        yield* this.end();
    }
    /**
     * Advance the parser by the `source` of one lexical token.
     */
    *next(source) {
      this.source = source;
      if (this.atScalar) {
        this.atScalar = false;
        yield* this.step();
        this.offset += source.length;
        return;
      }
      const type = tokenType(source);
      if (!type) {
        const message = `Not a YAML token: ${source}`;
        yield* this.pop({ type: "error", offset: this.offset, message, source });
        this.offset += source.length;
      } else if (type === "scalar") {
        this.atNewLine = false;
        this.atScalar = true;
        this.type = "scalar";
      } else {
        this.type = type;
        yield* this.step();
        switch (type) {
          case "newline":
            this.atNewLine = true;
            this.indent = 0;
            if (this.onNewLine)
              this.onNewLine(this.offset + source.length);
            break;
          case "space":
            if (this.atNewLine && source[0] === " ")
              this.indent += source.length;
            break;
          case "explicit-key-ind":
          case "map-value-ind":
          case "seq-item-ind":
            if (this.atNewLine)
              this.indent += source.length;
            break;
          case "doc-mode":
          case "flow-error-end":
            return;
          default:
            this.atNewLine = false;
        }
        this.offset += source.length;
      }
    }
    /** Call at end of input to push out any remaining constructions */
    *end() {
      while (this.stack.length > 0)
        yield* this.pop();
    }
    get sourceToken() {
      const st = {
        type: this.type,
        offset: this.offset,
        indent: this.indent,
        source: this.source
      };
      return st;
    }
    *step() {
      const top = this.peek(1);
      if (this.type === "doc-end" && (!top || top.type !== "doc-end")) {
        while (this.stack.length > 0)
          yield* this.pop();
        this.stack.push({
          type: "doc-end",
          offset: this.offset,
          source: this.source
        });
        return;
      }
      if (!top)
        return yield* this.stream();
      switch (top.type) {
        case "document":
          return yield* this.document(top);
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
          return yield* this.scalar(top);
        case "block-scalar":
          return yield* this.blockScalar(top);
        case "block-map":
          return yield* this.blockMap(top);
        case "block-seq":
          return yield* this.blockSequence(top);
        case "flow-collection":
          return yield* this.flowCollection(top);
        case "doc-end":
          return yield* this.documentEnd(top);
      }
      yield* this.pop();
    }
    peek(n) {
      return this.stack[this.stack.length - n];
    }
    *pop(error) {
      const token = error ?? this.stack.pop();
      if (!token) {
        const message = "Tried to pop an empty stack";
        yield { type: "error", offset: this.offset, source: "", message };
      } else if (this.stack.length === 0) {
        yield token;
      } else {
        const top = this.peek(1);
        if (token.type === "block-scalar") {
          token.indent = "indent" in top ? top.indent : 0;
        } else if (token.type === "flow-collection" && top.type === "document") {
          token.indent = 0;
        }
        if (token.type === "flow-collection")
          fixFlowSeqItems(token);
        switch (top.type) {
          case "document":
            top.value = token;
            break;
          case "block-scalar":
            top.props.push(token);
            break;
          case "block-map": {
            const it = top.items[top.items.length - 1];
            if (it.value) {
              top.items.push({ start: [], key: token, sep: [] });
              this.onKeyLine = true;
              return;
            } else if (it.sep) {
              it.value = token;
            } else {
              Object.assign(it, { key: token, sep: [] });
              this.onKeyLine = !it.explicitKey;
              return;
            }
            break;
          }
          case "block-seq": {
            const it = top.items[top.items.length - 1];
            if (it.value)
              top.items.push({ start: [], value: token });
            else
              it.value = token;
            break;
          }
          case "flow-collection": {
            const it = top.items[top.items.length - 1];
            if (!it || it.value)
              top.items.push({ start: [], key: token, sep: [] });
            else if (it.sep)
              it.value = token;
            else
              Object.assign(it, { key: token, sep: [] });
            return;
          }
          /* istanbul ignore next should not happen */
          default:
            yield* this.pop();
            yield* this.pop(token);
        }
        if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
          const last = token.items[token.items.length - 1];
          if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token.indent === 0 || last.start.every((st) => st.type !== "comment" || st.indent < token.indent))) {
            if (top.type === "document")
              top.end = last.start;
            else
              top.items.push({ start: last.start });
            token.items.splice(-1, 1);
          }
        }
      }
    }
    *stream() {
      switch (this.type) {
        case "directive-line":
          yield { type: "directive", offset: this.offset, source: this.source };
          return;
        case "byte-order-mark":
        case "space":
        case "comment":
        case "newline":
          yield this.sourceToken;
          return;
        case "doc-mode":
        case "doc-start": {
          const doc = {
            type: "document",
            offset: this.offset,
            start: []
          };
          if (this.type === "doc-start")
            doc.start.push(this.sourceToken);
          this.stack.push(doc);
          return;
        }
      }
      yield {
        type: "error",
        offset: this.offset,
        message: `Unexpected ${this.type} token in YAML stream`,
        source: this.source
      };
    }
    *document(doc) {
      if (doc.value)
        return yield* this.lineEnd(doc);
      switch (this.type) {
        case "doc-start": {
          if (findNonEmptyIndex(doc.start) !== -1) {
            yield* this.pop();
            yield* this.step();
          } else
            doc.start.push(this.sourceToken);
          return;
        }
        case "anchor":
        case "tag":
        case "space":
        case "comment":
        case "newline":
          doc.start.push(this.sourceToken);
          return;
      }
      const bv = this.startBlockValue(doc);
      if (bv)
        this.stack.push(bv);
      else {
        yield {
          type: "error",
          offset: this.offset,
          message: `Unexpected ${this.type} token in YAML document`,
          source: this.source
        };
      }
    }
    *scalar(scalar) {
      if (this.type === "map-value-ind") {
        const prev = getPrevProps(this.peek(2));
        const start = getFirstKeyStartProps(prev);
        let sep;
        if (scalar.end) {
          sep = scalar.end;
          sep.push(this.sourceToken);
          delete scalar.end;
        } else
          sep = [this.sourceToken];
        const map2 = {
          type: "block-map",
          offset: scalar.offset,
          indent: scalar.indent,
          items: [{ start, key: scalar, sep }]
        };
        this.onKeyLine = true;
        this.stack[this.stack.length - 1] = map2;
      } else
        yield* this.lineEnd(scalar);
    }
    *blockScalar(scalar) {
      switch (this.type) {
        case "space":
        case "comment":
        case "newline":
          scalar.props.push(this.sourceToken);
          return;
        case "scalar":
          scalar.source = this.source;
          this.atNewLine = true;
          this.indent = 0;
          if (this.onNewLine) {
            let nl = this.source.indexOf("\n") + 1;
            while (nl !== 0) {
              this.onNewLine(this.offset + nl);
              nl = this.source.indexOf("\n", nl) + 1;
            }
          }
          yield* this.pop();
          break;
        /* istanbul ignore next should not happen */
        default:
          yield* this.pop();
          yield* this.step();
      }
    }
    *blockMap(map2) {
      const it = map2.items[map2.items.length - 1];
      switch (this.type) {
        case "newline":
          this.onKeyLine = false;
          if (it.value) {
            const end = "end" in it.value ? it.value.end : void 0;
            const last = Array.isArray(end) ? end[end.length - 1] : void 0;
            if (last?.type === "comment")
              end?.push(this.sourceToken);
            else
              map2.items.push({ start: [this.sourceToken] });
          } else if (it.sep) {
            it.sep.push(this.sourceToken);
          } else {
            it.start.push(this.sourceToken);
          }
          return;
        case "space":
        case "comment":
          if (it.value) {
            map2.items.push({ start: [this.sourceToken] });
          } else if (it.sep) {
            it.sep.push(this.sourceToken);
          } else {
            if (this.atIndentedComment(it.start, map2.indent)) {
              const prev = map2.items[map2.items.length - 2];
              const end = prev?.value?.end;
              if (Array.isArray(end)) {
                Array.prototype.push.apply(end, it.start);
                end.push(this.sourceToken);
                map2.items.pop();
                return;
              }
            }
            it.start.push(this.sourceToken);
          }
          return;
      }
      if (this.indent >= map2.indent) {
        const atMapIndent = !this.onKeyLine && this.indent === map2.indent;
        const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
        let start = [];
        if (atNextItem && it.sep && !it.value) {
          const nl = [];
          for (let i3 = 0; i3 < it.sep.length; ++i3) {
            const st = it.sep[i3];
            switch (st.type) {
              case "newline":
                nl.push(i3);
                break;
              case "space":
                break;
              case "comment":
                if (st.indent > map2.indent)
                  nl.length = 0;
                break;
              default:
                nl.length = 0;
            }
          }
          if (nl.length >= 2)
            start = it.sep.splice(nl[1]);
        }
        switch (this.type) {
          case "anchor":
          case "tag":
            if (atNextItem || it.value) {
              start.push(this.sourceToken);
              map2.items.push({ start });
              this.onKeyLine = true;
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              it.start.push(this.sourceToken);
            }
            return;
          case "explicit-key-ind":
            if (!it.sep && !it.explicitKey) {
              it.start.push(this.sourceToken);
              it.explicitKey = true;
            } else if (atNextItem || it.value) {
              start.push(this.sourceToken);
              map2.items.push({ start, explicitKey: true });
            } else {
              this.stack.push({
                type: "block-map",
                offset: this.offset,
                indent: this.indent,
                items: [{ start: [this.sourceToken], explicitKey: true }]
              });
            }
            this.onKeyLine = true;
            return;
          case "map-value-ind":
            if (it.explicitKey) {
              if (!it.sep) {
                if (includesToken(it.start, "newline")) {
                  Object.assign(it, { key: null, sep: [this.sourceToken] });
                } else {
                  const start2 = getFirstKeyStartProps(it.start);
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: start2, key: null, sep: [this.sourceToken] }]
                  });
                }
              } else if (it.value) {
                map2.items.push({ start: [], key: null, sep: [this.sourceToken] });
              } else if (includesToken(it.sep, "map-value-ind")) {
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start, key: null, sep: [this.sourceToken] }]
                });
              } else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
                const start2 = getFirstKeyStartProps(it.start);
                const key = it.key;
                const sep = it.sep;
                sep.push(this.sourceToken);
                delete it.key;
                delete it.sep;
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: start2, key, sep }]
                });
              } else if (start.length > 0) {
                it.sep = it.sep.concat(start, this.sourceToken);
              } else {
                it.sep.push(this.sourceToken);
              }
            } else {
              if (!it.sep) {
                Object.assign(it, { key: null, sep: [this.sourceToken] });
              } else if (it.value || atNextItem) {
                map2.items.push({ start, key: null, sep: [this.sourceToken] });
              } else if (includesToken(it.sep, "map-value-ind")) {
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: [], key: null, sep: [this.sourceToken] }]
                });
              } else {
                it.sep.push(this.sourceToken);
              }
            }
            this.onKeyLine = true;
            return;
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar": {
            const fs = this.flowScalar(this.type);
            if (atNextItem || it.value) {
              map2.items.push({ start, key: fs, sep: [] });
              this.onKeyLine = true;
            } else if (it.sep) {
              this.stack.push(fs);
            } else {
              Object.assign(it, { key: fs, sep: [] });
              this.onKeyLine = true;
            }
            return;
          }
          default: {
            const bv = this.startBlockValue(map2);
            if (bv) {
              if (atMapIndent && bv.type !== "block-seq") {
                map2.items.push({ start });
              }
              this.stack.push(bv);
              return;
            }
          }
        }
      }
      yield* this.pop();
      yield* this.step();
    }
    *blockSequence(seq2) {
      const it = seq2.items[seq2.items.length - 1];
      switch (this.type) {
        case "newline":
          if (it.value) {
            const end = "end" in it.value ? it.value.end : void 0;
            const last = Array.isArray(end) ? end[end.length - 1] : void 0;
            if (last?.type === "comment")
              end?.push(this.sourceToken);
            else
              seq2.items.push({ start: [this.sourceToken] });
          } else
            it.start.push(this.sourceToken);
          return;
        case "space":
        case "comment":
          if (it.value)
            seq2.items.push({ start: [this.sourceToken] });
          else {
            if (this.atIndentedComment(it.start, seq2.indent)) {
              const prev = seq2.items[seq2.items.length - 2];
              const end = prev?.value?.end;
              if (Array.isArray(end)) {
                Array.prototype.push.apply(end, it.start);
                end.push(this.sourceToken);
                seq2.items.pop();
                return;
              }
            }
            it.start.push(this.sourceToken);
          }
          return;
        case "anchor":
        case "tag":
          if (it.value || this.indent <= seq2.indent)
            break;
          it.start.push(this.sourceToken);
          return;
        case "seq-item-ind":
          if (this.indent !== seq2.indent)
            break;
          if (it.value || includesToken(it.start, "seq-item-ind"))
            seq2.items.push({ start: [this.sourceToken] });
          else
            it.start.push(this.sourceToken);
          return;
      }
      if (this.indent > seq2.indent) {
        const bv = this.startBlockValue(seq2);
        if (bv) {
          this.stack.push(bv);
          return;
        }
      }
      yield* this.pop();
      yield* this.step();
    }
    *flowCollection(fc) {
      const it = fc.items[fc.items.length - 1];
      if (this.type === "flow-error-end") {
        let top;
        do {
          yield* this.pop();
          top = this.peek(1);
        } while (top && top.type === "flow-collection");
      } else if (fc.end.length === 0) {
        switch (this.type) {
          case "comma":
          case "explicit-key-ind":
            if (!it || it.sep)
              fc.items.push({ start: [this.sourceToken] });
            else
              it.start.push(this.sourceToken);
            return;
          case "map-value-ind":
            if (!it || it.value)
              fc.items.push({ start: [], key: null, sep: [this.sourceToken] });
            else if (it.sep)
              it.sep.push(this.sourceToken);
            else
              Object.assign(it, { key: null, sep: [this.sourceToken] });
            return;
          case "space":
          case "comment":
          case "newline":
          case "anchor":
          case "tag":
            if (!it || it.value)
              fc.items.push({ start: [this.sourceToken] });
            else if (it.sep)
              it.sep.push(this.sourceToken);
            else
              it.start.push(this.sourceToken);
            return;
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar": {
            const fs = this.flowScalar(this.type);
            if (!it || it.value)
              fc.items.push({ start: [], key: fs, sep: [] });
            else if (it.sep)
              this.stack.push(fs);
            else
              Object.assign(it, { key: fs, sep: [] });
            return;
          }
          case "flow-map-end":
          case "flow-seq-end":
            fc.end.push(this.sourceToken);
            return;
        }
        const bv = this.startBlockValue(fc);
        if (bv)
          this.stack.push(bv);
        else {
          yield* this.pop();
          yield* this.step();
        }
      } else {
        const parent = this.peek(2);
        if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
          yield* this.pop();
          yield* this.step();
        } else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
          const prev = getPrevProps(parent);
          const start = getFirstKeyStartProps(prev);
          fixFlowSeqItems(fc);
          const sep = fc.end.splice(1, fc.end.length);
          sep.push(this.sourceToken);
          const map2 = {
            type: "block-map",
            offset: fc.offset,
            indent: fc.indent,
            items: [{ start, key: fc, sep }]
          };
          this.onKeyLine = true;
          this.stack[this.stack.length - 1] = map2;
        } else {
          yield* this.lineEnd(fc);
        }
      }
    }
    flowScalar(type) {
      if (this.onNewLine) {
        let nl = this.source.indexOf("\n") + 1;
        while (nl !== 0) {
          this.onNewLine(this.offset + nl);
          nl = this.source.indexOf("\n", nl) + 1;
        }
      }
      return {
        type,
        offset: this.offset,
        indent: this.indent,
        source: this.source
      };
    }
    startBlockValue(parent) {
      switch (this.type) {
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
          return this.flowScalar(this.type);
        case "block-scalar-header":
          return {
            type: "block-scalar",
            offset: this.offset,
            indent: this.indent,
            props: [this.sourceToken],
            source: ""
          };
        case "flow-map-start":
        case "flow-seq-start":
          return {
            type: "flow-collection",
            offset: this.offset,
            indent: this.indent,
            start: this.sourceToken,
            items: [],
            end: []
          };
        case "seq-item-ind":
          return {
            type: "block-seq",
            offset: this.offset,
            indent: this.indent,
            items: [{ start: [this.sourceToken] }]
          };
        case "explicit-key-ind": {
          this.onKeyLine = true;
          const prev = getPrevProps(parent);
          const start = getFirstKeyStartProps(prev);
          start.push(this.sourceToken);
          return {
            type: "block-map",
            offset: this.offset,
            indent: this.indent,
            items: [{ start, explicitKey: true }]
          };
        }
        case "map-value-ind": {
          this.onKeyLine = true;
          const prev = getPrevProps(parent);
          const start = getFirstKeyStartProps(prev);
          return {
            type: "block-map",
            offset: this.offset,
            indent: this.indent,
            items: [{ start, key: null, sep: [this.sourceToken] }]
          };
        }
      }
      return null;
    }
    atIndentedComment(start, indent) {
      if (this.type !== "comment")
        return false;
      if (this.indent <= indent)
        return false;
      return start.every((st) => st.type === "newline" || st.type === "space");
    }
    *documentEnd(docEnd) {
      if (this.type !== "doc-mode") {
        if (docEnd.end)
          docEnd.end.push(this.sourceToken);
        else
          docEnd.end = [this.sourceToken];
        if (this.type === "newline")
          yield* this.pop();
      }
    }
    *lineEnd(token) {
      switch (this.type) {
        case "comma":
        case "doc-start":
        case "doc-end":
        case "flow-seq-end":
        case "flow-map-end":
        case "map-value-ind":
          yield* this.pop();
          yield* this.step();
          break;
        case "newline":
          this.onKeyLine = false;
        // fallthrough
        case "space":
        case "comment":
        default:
          if (token.end)
            token.end.push(this.sourceToken);
          else
            token.end = [this.sourceToken];
          if (this.type === "newline")
            yield* this.pop();
      }
    }
  };

  // node_modules/yaml/browser/dist/public-api.js
  function parseOptions(options) {
    const prettyErrors = options.prettyErrors !== false;
    const lineCounter = options.lineCounter || prettyErrors && new LineCounter() || null;
    return { lineCounter, prettyErrors };
  }
  function parseAllDocuments(source, options = {}) {
    const { lineCounter, prettyErrors } = parseOptions(options);
    const parser = new Parser(lineCounter?.addNewLine);
    const composer = new Composer(options);
    const docs = Array.from(composer.compose(parser.parse(source)));
    if (prettyErrors && lineCounter)
      for (const doc of docs) {
        doc.errors.forEach(prettifyError(source, lineCounter));
        doc.warnings.forEach(prettifyError(source, lineCounter));
      }
    if (docs.length > 0)
      return docs;
    return Object.assign([], { empty: true }, composer.streamInfo());
  }

  // src/formats.ts
  function lineCol(text, offset) {
    let line2 = 1, last = -1;
    for (let i3 = text.indexOf("\n"); i3 !== -1 && i3 < offset; i3 = text.indexOf("\n", i3 + 1)) {
      line2++;
      last = i3;
    }
    return { line: line2, col: offset - last };
  }
  function jsonFaultAt(s) {
    let i3 = 0;
    const ws = () => {
      while (i3 < s.length && " 	\n\r".includes(s[i3])) i3++;
    };
    const fail = () => {
      throw i3;
    };
    const value = () => {
      ws();
      const c = s[i3];
      if (c === "{") {
        i3++;
        ws();
        if (s[i3] === "}") {
          i3++;
          return;
        }
        for (; ; ) {
          ws();
          if (s[i3] !== '"') fail();
          str();
          ws();
          if (s[i3] !== ":") fail();
          i3++;
          value();
          ws();
          if (s[i3] === ",") {
            i3++;
            continue;
          }
          if (s[i3] === "}") {
            i3++;
            return;
          }
          fail();
        }
      }
      if (c === "[") {
        i3++;
        ws();
        if (s[i3] === "]") {
          i3++;
          return;
        }
        for (; ; ) {
          value();
          ws();
          if (s[i3] === ",") {
            i3++;
            continue;
          }
          if (s[i3] === "]") {
            i3++;
            return;
          }
          fail();
        }
      }
      if (c === '"') return str();
      const lit = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(s.slice(i3, i3 + 64));
      if (!lit) fail();
      i3 += lit[0].length;
    };
    const str = () => {
      i3++;
      while (i3 < s.length && s[i3] !== '"') {
        if (s[i3] === "\\") i3++;
        else if (s[i3] === "\n") fail();
        i3++;
      }
      if (s[i3] !== '"') fail();
      i3++;
    };
    try {
      value();
      ws();
      if (i3 < s.length) fail();
      return -1;
    } catch (at) {
      return typeof at === "number" ? Math.min(at, s.length) : 0;
    }
  }
  function jsonErrorAt(text) {
    const at = jsonFaultAt(text);
    return at < 0 ? { line: 1 } : lineCol(text, at);
  }
  function stripJsonc(text) {
    return text.replace(/("(?:\\.|[^"\\])*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (m, s) => s ?? m.replace(/[^\n]/g, " ")).replace(/,(\s*[}\]])/g, " $1");
  }
  function checkJson(text) {
    if (!text.trim()) return [];
    try {
      JSON.parse(text);
      return [];
    } catch (err) {
      const at = jsonErrorAt(text);
      try {
        JSON.parse(stripJsonc(text));
        return [{ ...at, severity: "warn", message: "Comments or trailing commas: fine for tsconfig and editor settings, not for strict JSON" }];
      } catch {
      }
      const message = err.message.replace(/^JSON\.parse: /, "").replace(/,? ?(?:in JSON )?at position \d+.*$/, "").replace(/, "[\s\S]*" is not valid JSON$/, "");
      return [{ ...at, severity: "error", message }];
    }
  }
  function checkJsonl(text) {
    const out = [];
    text.split("\n").forEach((l, i3) => {
      if (!l.trim()) return;
      try {
        JSON.parse(l);
      } catch (err) {
        out.push({ line: i3 + 1, severity: "error", message: `Not JSON: ${err.message}` });
      }
    });
    return out;
  }
  function yamlDocs(text) {
    const lineCounter = new LineCounter();
    const docs = parseAllDocuments(text, { lineCounter, prettyErrors: false, uniqueKeys: true, logLevel: "silent" });
    return { docs: Array.isArray(docs) ? docs : [], lineCounter };
  }
  function checkYaml(text, lineOffset = 0) {
    if (!text.trim()) return [];
    const { docs, lineCounter } = yamlDocs(text);
    const out = [];
    for (const d of docs) {
      for (const [list3, severity] of [[d.errors, "error"], [d.warnings, "warn"]]) {
        for (const e of list3) {
          const p = lineCounter.linePos(e.pos[0]);
          out.push({ line: p.line + lineOffset, col: p.col, severity, message: e.message.split("\n")[0] });
        }
      }
    }
    const tab = /^\t+/m.exec(text);
    if (tab && !out.some((d) => d.message.includes("Tab"))) out.push({ ...lineCol(text, tab.index), severity: "error", message: "YAML cannot indent with tabs" });
    return out;
  }
  function richYaml(text) {
    const { docs } = yamlDocs(text);
    const values = docs.map((d) => {
      try {
        return d.toJS({ maxAliasCount: 100 });
      } catch {
        return void 0;
      }
    });
    if (!values.some((v) => v !== void 0)) return renderCode(text, "yaml");
    return values.map((v) => renderValueTree(v ?? null)).join('<hr class="fe-yaml-sep">');
  }
  function checkMarkdown(text) {
    const out = [];
    const lines = text.split("\n");
    let start = 0;
    if (lines[0]?.trim() === "---") {
      const end = lines.findIndex((l, i3) => i3 > 0 && /^(---|\.\.\.)\s*$/.test(l));
      if (end === -1) out.push({ line: 1, severity: "error", message: "The front matter opened here is never closed with ---" });
      else {
        out.push(...checkYaml(lines.slice(1, end).join("\n"), 1).map((d) => ({ ...d, severity: "warn" })));
        start = end + 1;
      }
    }
    let fence = null;
    let lastLevel = 0;
    for (let i3 = start; i3 < lines.length; i3++) {
      const l = lines[i3];
      const f = /^\s{0,3}(`{3,}|~{3,})/.exec(l);
      if (f) {
        if (!fence) fence = { mark: f[1], line: i3 + 1 };
        else if (f[1][0] === fence.mark[0] && f[1].length >= fence.mark.length && !l.slice(f.index + f[1].length).trim()) fence = null;
        continue;
      }
      if (fence) continue;
      const h = /^(#{1,6})\s/.exec(l);
      if (h) {
        const level = h[1].length;
        if (lastLevel && level > lastLevel + 1) out.push({ line: i3 + 1, severity: "warn", message: `Heading jumps from level ${lastLevel} to ${level}` });
        lastLevel = level;
      }
    }
    if (fence) out.push({ line: fence.line, severity: "warn", message: "This code block is never closed, so the rest of the file reads as code" });
    return out;
  }
  var VOID = /* @__PURE__ */ new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
  var OPTIONAL_CLOSE = /* @__PURE__ */ new Set(["p", "li", "td", "th", "tr", "thead", "tbody", "tfoot", "option", "optgroup", "dt", "dd", "html", "head", "body", "colgroup", "caption", "rt", "rp"]);
  function checkHtml(text) {
    const out = [];
    const stack2 = [];
    const re = /<!--[\s\S]*?(?:-->|$)|<(script|style|textarea|title)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)|<(\/?)([a-zA-Z][\w:-]*)\b(?:[^>"']|"[^"]*"|'[^']*')*?(\/?)>/g;
    for (let m = re.exec(text); m; m = re.exec(text)) {
      if (m[0].startsWith("<!--")) {
        if (!m[0].endsWith("-->")) out.push({ ...lineCol(text, m.index), severity: "error", message: "This comment is never closed" });
        continue;
      }
      if (m[1]) {
        if (!new RegExp(`</${m[1]}\\s*>$`, "i").test(m[0])) out.push({ ...lineCol(text, m.index), severity: "error", message: `<${m[1].toLowerCase()}> is never closed` });
        continue;
      }
      const name = m[3].toLowerCase();
      if (VOID.has(name) || m[4] === "/") continue;
      const at = lineCol(text, m.index);
      if (!m[2]) {
        stack2.push({ name, line: at.line });
        continue;
      }
      const i3 = stack2.map((s) => s.name).lastIndexOf(name);
      if (i3 === -1) {
        out.push({ ...at, severity: "error", message: `</${name}> closes nothing that is open` });
        continue;
      }
      for (const s of stack2.splice(i3).slice(1)) {
        if (!OPTIONAL_CLOSE.has(s.name)) out.push({ line: s.line, severity: "warn", message: `<${s.name}> is closed implicitly by </${name}> on line ${at.line}` });
      }
    }
    for (const s of stack2) if (!OPTIONAL_CLOSE.has(s.name)) out.push({ line: s.line, severity: "warn", message: `<${s.name}> is never closed` });
    return out;
  }
  function richHtml(text, href) {
    const base = `<base href="${esc(href)}">`;
    const doc = /<head[^>]*>/i.test(text) ? text.replace(/<head([^>]*)>/i, `<head$1>${base}`) : base + text;
    return `<iframe class="fe-html-frame" sandbox="allow-same-origin" title="Rendered page" srcdoc="${esc(doc)}"></iframe>`;
  }
  var safely = (f, ext2) => (text, href) => {
    try {
      return f(text, href);
    } catch (err) {
      return `<div class="notice fe-ql-note">Could not render this file (${esc(err.message)}), so here is its text.</div>${renderCode(text, ext2)}`;
    }
  };
  var FORMATS = [
    { id: "markdown", label: "Markdown", exts: ["md", "mdx", "markdown"], rich: safely((t, h) => `<div class="fe-md">${renderMarkdown(t, h)}</div>`, "md"), check: checkMarkdown },
    // A file that is not strict JSON shows as text; the problems strip says why.
    { id: "json", label: "JSON", exts: ["json", "jsonc", "json5"], rich: safely((t) => {
      try {
        JSON.parse(t);
        return renderJsonTree(t);
      } catch {
        return renderCode(t, "jsonc");
      }
    }, "json"), check: checkJson },
    { id: "jsonl", label: "JSON Lines", exts: ["jsonl", "ndjson"], rich: safely((t) => renderJsonl(t), "json"), check: checkJsonl },
    { id: "yaml", label: "YAML", exts: ["yaml", "yml"], rich: safely((t) => richYaml(t), "yaml"), check: (t) => checkYaml(t) },
    { id: "html", label: "HTML", exts: ["html", "htm", "xhtml"], rich: safely(richHtml, "html"), check: checkHtml }
  ];
  function formatFor(ext2) {
    const e = ext2.toLowerCase();
    return FORMATS.find((f) => f.exts.includes(e)) ?? null;
  }
  function diagnose(ext2, text) {
    const f = formatFor(ext2);
    if (!f) return [];
    try {
      return f.check(text).sort((a, b) => a.line - b.line);
    } catch {
      return [];
    }
  }

  // src/text-window.ts
  function wholeText(ta, text) {
    ta.value = text;
    return {
      text: () => ta.value,
      set: (t) => {
        ta.value = t;
      },
      first: () => 0,
      size: () => countLines(ta.value),
      selection: () => ({ start: ta.selectionStart, end: ta.selectionEnd }),
      select: (a, b) => ta.setSelectionRange(a, b),
      center: () => {
      }
    };
  }
  var countLines = (t) => {
    let n = 1;
    for (let p = t.indexOf("\n"); p !== -1; p = t.indexOf("\n", p + 1)) n++;
    return n;
  };
  function lineStart(t, line2, from = 0, fromLine = 0) {
    let p = from;
    for (let i3 = fromLine; i3 < line2; i3++) {
      const nl = t.indexOf("\n", p);
      if (nl === -1) return t.length;
      p = nl + 1;
    }
    return p;
  }
  function windowedText(ta, text, lines = 3e3) {
    let pre = "", post = "", first = 0, held = 1, after = 0;
    const text_ = () => pre + ta.value + post;
    const allSelected = () => ta.selectionStart === 0 && ta.selectionEnd === ta.value.length && (pre || post) !== "";
    let selectAll = false;
    const place = (t, center, selStart, selEnd) => {
      const total = countLines(t);
      first = Math.max(0, Math.min(center - (lines >> 1), total - lines));
      const a = lineStart(t, first);
      let b = lineStart(t, first + lines, a, first);
      if (b > a && b <= t.length && t[b - 1] === "\n" && first + lines < total) b--;
      pre = t.slice(0, a);
      post = t.slice(b);
      ta.value = t.slice(a, b);
      held = Math.min(lines, total - first);
      after = total - first - held;
      const clamp = (x) => Math.max(0, Math.min(ta.value.length, x - a));
      ta.setSelectionRange(clamp(selStart), clamp(selEnd));
    };
    const lineOf = (t, offset) => {
      let n = 0;
      for (let p = t.indexOf("\n"); p !== -1 && p < offset; p = t.indexOf("\n", p + 1)) n++;
      return n;
    };
    const selection = () => selectAll && allSelected() ? { start: 0, end: text_().length } : { start: pre.length + ta.selectionStart, end: pre.length + ta.selectionEnd };
    ta.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a" && !e.shiftKey) {
        selectAll = true;
        return;
      }
      if (!["Shift", "Meta", "Control", "Alt"].includes(e.key)) selectAll = false;
    }, true);
    ta.addEventListener("mousedown", () => {
      selectAll = false;
    });
    const copyAll = (e, cut) => {
      if (!selectAll || !allSelected()) return;
      e.preventDefault();
      e.clipboardData?.setData("text/plain", text_());
      if (cut) {
        pre = post = "";
        first = 0;
        after = 0;
        ta.value = "";
        held = 1;
        ta.dispatchEvent(new Event("input", { bubbles: true }));
      }
    };
    ta.addEventListener("copy", (e) => copyAll(e, false));
    ta.addEventListener("cut", (e) => copyAll(e, true));
    ta.addEventListener("beforeinput", () => {
      if (selectAll && allSelected()) {
        pre = post = "";
        first = 0;
        after = 0;
      }
      selectAll = false;
    });
    ta.addEventListener("input", () => {
      held = countLines(ta.value);
    });
    place(text, 0, 0, 0);
    return {
      text: text_,
      set: (t) => {
        const s = selection();
        place(t, first + (lines >> 1), s.start, s.end);
      },
      first: () => first,
      size: () => held,
      selection,
      select: (s, e) => {
        if (s >= pre.length && e <= pre.length + ta.value.length) {
          ta.setSelectionRange(s - pre.length, e - pre.length);
          return;
        }
        const t = text_();
        place(t, lineOf(t, s), s, e);
      },
      center: (line2) => {
        const total = first + held + after;
        const target = Math.max(0, Math.min(line2 - (lines >> 1), total - lines));
        if (target === first || line2 - first > lines >> 3 && first + held - line2 > lines >> 3) return;
        const s = selection();
        place(text_(), line2, s.start, s.end);
      }
    };
  }

  // src/comment-anchor.ts
  function pass(t, re, pieces) {
    const out = { s: "", o: [] };
    let at = 0;
    const flags = re.flags.includes("d") ? re.flags : re.flags + "d";
    for (const m of t.s.matchAll(new RegExp(re.source, flags))) {
      out.s += t.s.slice(at, m.index);
      out.o.push(...t.o.slice(at, m.index));
      const here = t.o[m.index] ?? t.o[t.o.length - 1] ?? 0;
      for (const p of pieces) {
        if (typeof p === "string") {
          out.s += p;
          for (let i3 = 0; i3 < p.length; i3++) out.o.push(here);
          continue;
        }
        const span = m.indices[p];
        if (!span) continue;
        out.s += t.s.slice(span[0], span[1]);
        out.o.push(...t.o.slice(span[0], span[1]));
      }
      at = m.index + m[0].length;
    }
    out.s += t.s.slice(at);
    out.o.push(...t.o.slice(at));
    return out;
  }
  var PASSES = [
    [/^[^\S\n]*#{1,6}[^\S\n]+/gm, []],
    [/^[^\S\n]*>[^\S\n]?/gm, []],
    [/^[^\S\n]*(?:[-*+]|\d+[.)])[^\S\n]+(?:\[[ xX]\][^\S\n]+)?/gm, []],
    [/\|/g, [" "]],
    [/\n/g, [" "]],
    [/!\[([^\]]*)\]\([^)]*\)/g, [1]],
    [/\[([^\]]*)\]\([^)]*\)/g, [1]],
    [/<(https?:\/\/[^>]+)>/g, [1]],
    [/\[\^[^\]]+\]/g, []],
    [/<[^>]+>/g, []],
    [/`+/g, []],
    [/\*\*|__|~~/g, []],
    [/(^|[^\w*])[*_](?=\S)/g, [1]],
    [/(\S)[*_](?=[^\w*]|$)/g, [1]],
    [/\s+/g, [" "]]
  ];
  function visibleMap(src) {
    let t = { s: src, o: Array.from({ length: src.length }, (_v, i3) => i3) };
    for (const [re, pieces] of PASSES) t = pass(t, re, pieces);
    const lead = t.s.length - t.s.trimStart().length;
    const keep = t.s.trim().length;
    return { s: t.s.slice(lead, lead + keep), o: t.o.slice(lead, lead + keep) };
  }
  var visibleOf = (src) => visibleMap(src).s;
  var SKIP3 = "script,style,svg,textarea,.fe-md-anchor,.fe-md-code-bar,[hidden]";
  var blocksFor = (page, first, last) => [...page.querySelectorAll("[data-sl]")].filter((b) => {
    const [a, z] = b.dataset.sl.split("-").map(Number);
    return z >= first && a <= last;
  });
  function flatText(blocks) {
    let flat = "";
    const at = [];
    let ws = true;
    for (const b of blocks) {
      const walker = document.createTreeWalker(b, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => n.parentElement?.closest(SKIP3) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
      });
      while (walker.nextNode()) {
        const t = walker.currentNode;
        for (let i3 = 0; i3 < t.data.length; i3++) {
          const sp2 = /\s/.test(t.data[i3]);
          if (sp2 && ws) continue;
          flat += sp2 ? " " : t.data[i3];
          at.push([t, i3]);
          ws = sp2;
        }
      }
      if (!ws && at.length) {
        flat += " ";
        at.push(at[at.length - 1]);
        ws = true;
      }
    }
    return { flat, at };
  }
  function rangeFor(page, first, last, needle) {
    const blocks = blocksFor(page, first, last);
    if (!blocks.length) return null;
    const { flat, at } = flatText(blocks);
    const range = document.createRange();
    let s = needle ? flat.indexOf(needle) : -1;
    if (s === -1 && needle) s = flat.toLowerCase().indexOf(needle.toLowerCase());
    if (s === -1) {
      range.selectNodeContents(blocks[0]);
      return range;
    }
    const [sn, so] = at[s], [en, eo] = at[s + needle.length - 1];
    range.setStart(sn, so);
    range.setEnd(en, eo + 1);
    return range;
  }
  function carrier(before, after) {
    if (before === after) return (o) => o;
    let p = 0;
    const n = Math.min(before.length, after.length);
    while (p < n && before.charCodeAt(p) === after.charCodeAt(p)) p++;
    let q = 0;
    while (q < n - p && before.charCodeAt(before.length - 1 - q) === after.charCodeAt(after.length - 1 - q)) q++;
    const tail = before.length - q, shift = after.length - before.length;
    return (o) => o < p ? o : o >= tail ? o + shift : p;
  }
  var MARKS = "*_~`";
  var runs = (s, c) => s.match(new RegExp(`\\${c}+`, "g"))?.length ?? 0;
  function widen(text, start, end) {
    for (let guard = 0; guard < 50; guard++) {
      const span = text.slice(start, end);
      if (text.startsWith("](", end)) {
        const close = text.indexOf(")", end);
        if (close !== -1) {
          end = close + 1;
          continue;
        }
      }
      const cut = span.indexOf("](");
      const lb = text.lastIndexOf("[", start - 1), nl = text.lastIndexOf("\n", start - 1);
      if (cut !== -1 && !span.slice(0, cut).includes("[") && lb > nl) {
        start = lb;
        continue;
      }
      const mark = (i3) => MARKS.includes(text[i3] ?? "\0") && !(text[i3] === "_" && /\w/.test(text[i3 - 1] ?? "") && /\w/.test(text[i3 + 1] ?? ""));
      const after = text[end], before = text[start - 1];
      if (mark(end) && runs(span, after) % 2) {
        while (text[end] === after) end++;
        continue;
      }
      if (mark(start - 1) && runs(span, before) % 2) {
        while (text[start - 1] === before) start--;
        continue;
      }
      if (mark(start - 1) && before === after) {
        start--;
        end++;
        continue;
      }
      break;
    }
    return [start, end];
  }
  function sourceSpan(page, text, range) {
    if (range.collapsed) return null;
    const holder = (n) => n.nodeType === 1 ? n : n.parentElement;
    if (holder(range.startContainer)?.closest(".fe-md-fm") || holder(range.endContainer)?.closest(".fe-md-fm")) return null;
    const touched = [...page.querySelectorAll("[data-sl]")].filter((b) => range.intersectsNode(b));
    const a = touched[0], z = touched[touched.length - 1];
    if (!a || !z) return null;
    const first = Number(a.dataset.sl.split("-")[0]);
    const last = Number(z.dataset.sl.split("-")[1]);
    const from = lineStart(text, first - 1);
    let to = lineStart(text, last);
    if (to > from && text[to - 1] === "\n") to--;
    const block = { start: from, end: to, block: true };
    const { flat, at } = flatText(blocksFor(page, first, last));
    let s = at.findIndex(([n, o]) => {
      try {
        return range.comparePoint(n, o) >= 0;
      } catch {
        return false;
      }
    });
    let e = -1;
    for (let i3 = at.length - 1; i3 >= 0; i3--) {
      try {
        if (range.comparePoint(at[i3][0], at[i3][1]) === 0) {
          e = i3 + 1;
          break;
        }
      } catch {
      }
    }
    if (s === -1 || e <= s) return block;
    while (s < e && flat[s] === " ") s++;
    while (e > s && flat[e - 1] === " ") e--;
    const needle = flat.slice(s, e);
    if (!needle) return null;
    const vis = visibleMap(text.slice(from, to));
    const hits = [];
    for (const hay of [vis.s, vis.s.toLowerCase()]) {
      const n = hay === vis.s ? needle : needle.toLowerCase();
      for (let i3 = hay.indexOf(n); i3 !== -1; i3 = hay.indexOf(n, i3 + 1)) hits.push(i3);
      if (hits.length) break;
    }
    if (!hits.length) return block;
    const v = hits.reduce((best, i3) => Math.abs(i3 - s) < Math.abs(best - s) ? i3 : best, hits[0]);
    const [ws, we] = widen(text, from + vis.o[v], from + vis.o[v + needle.length - 1] + 1);
    return { start: ws, end: we, block: false };
  }

  // src/file-editor.ts
  var AUTOSAVE_MS = 800;
  var CHECK_MS = 300;
  var modePref = textPref("bfb-edit-mode-v1");
  var MODES = [
    { id: "raw", label: "Raw", hint: "The text alone" },
    { id: "split", label: "Split", hint: "Text and rendered view side by side" },
    { id: "rich", label: "Rich", hint: "The rendered view alone" }
  ];
  var BIG_LINES = 4e3;
  var BIG_CHARS = 4e5;
  var BLOCK = 200;
  var WIN_PAD = 60;
  var CHECK_MAX = 2e6;
  var BIG_RENDER_MS = 1e3;
  var TA_LINES = 3e3;
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
    let lineCount = 1;
    for (let p = doc.text.indexOf("\n"); p !== -1 && lineCount <= BIG_LINES; p = doc.text.indexOf("\n", p + 1)) lineCount++;
    const big = lineCount > BIG_LINES || doc.text.length > BIG_CHARS;
    const fmt = formatFor(host.ext);
    const isMd = fmt?.id === "markdown";
    box.innerHTML = `
    <div id="fe-fe-banner" class="notice" data-tone="warn" style="display:none"></div>
    <div id="fe-fe-scroll">
      <div id="fe-fe-col">
        <div id="fe-fe-src">
          <pre id="fe-fe-paint" aria-hidden="true">${big ? '<div id="fe-fe-win"></div>' : ""}</pre>
          <textarea id="fe-fe-ta" spellcheck="false" aria-label="File text"${big ? ' wrap="off"' : ""}></textarea>
        </div>
        ${fmt ? `<div id="fe-fe-view" class="${isMd ? "fe-md" : "fe-fe-rich"}" hidden></div>` : ""}
      </div>
    </div>
    <div id="fe-fe-pill" role="toolbar" aria-label="Editing">
      <span id="fe-fe-state"></span>
      <button type="button" class="btn" id="fe-fe-diag" data-act="diag" hidden></button>
      ${fmt ? `<span class="fe-seg fe-fe-modes" role="group" aria-label="View">${MODES.map((m) => `<button type="button" class="fe-seg-b" data-mode="${m.id}" title="${m.hint} (\u2318\u21E7P cycles)">${m.label}</button>`).join("")}</span>` : ""}
      <button type="button" class="btn" data-variant="solid" data-shape="pill" data-act="done" title="Back to reading (Esc)">Done</button>
    </div>`;
    const ta = box.querySelector("#fe-fe-ta");
    const paintEl = box.querySelector("#fe-fe-paint");
    const src = box.querySelector("#fe-fe-src");
    const view = box.querySelector("#fe-fe-view");
    const state = box.querySelector("#fe-fe-state");
    const banner = box.querySelector("#fe-fe-banner");
    const diagBtn = box.querySelector("#fe-fe-diag");
    const scroller = box.querySelector("#fe-fe-scroll");
    box.classList.toggle("fe-fe-big", big);
    const lhPx = Math.round(parseFloat(getComputedStyle(ta).fontSize) * 1.7);
    paintEl.style.lineHeight = ta.style.lineHeight = lhPx + "px";
    const tw = big ? windowedText(ta, doc.text, TA_LINES) : wholeText(ta, doc.text);
    const buf = attachBuffer(ta, `file:${host.root}/${host.rel}`, { get: tw.text, set: tw.set });
    let base = doc.text;
    let saving = false;
    let failed = "";
    const saved = modePref.get();
    let mode = fmt && saved && MODES.some((m) => m.id === saved) ? saved : "raw";
    let diags = [];
    let checkTimer = 0;
    let timer = 0;
    const isDirty = () => tw.text() !== base;
    let curRow = -1;
    const markLine = () => {
      const v = ta.value, end = ta.selectionStart;
      let i3 = tw.first();
      for (let p = v.indexOf("\n"); p !== -1 && p < end; p = v.indexOf("\n", p + 1)) i3++;
      if (i3 === curRow) return;
      rowEl(curRow)?.classList.remove("cur");
      rowEl(i3)?.classList.add("cur");
      curRow = i3;
    };
    let painted = [];
    const rowHtml = (r, i3) => `<div class="fe-fe-row"><span class="fe-fe-ln">${i3 + 1}</span><span class="fe-fe-code">${r || " "}</span></div>`;
    const win = box.querySelector("#fe-fe-win");
    let lines = [];
    let lh = 0, winFirst = 0, winLast = -1;
    const blockCache = /* @__PURE__ */ new Map();
    const blockRows = (b) => {
      const text = lines.slice(b * BLOCK, (b + 1) * BLOCK).join("\n");
      let rows = blockCache.get(text);
      if (!rows) {
        rows = splitHighlighted(highlightCode(text, host.ext));
        if (blockCache.size > 64) blockCache.delete(blockCache.keys().next().value);
        blockCache.set(text, rows);
      }
      return rows;
    };
    const rowEl = (i3) => big ? i3 >= winFirst && i3 <= winLast ? win.children[i3 - winFirst] : void 0 : paintEl.children[i3];
    const lineAtY = (clientY) => Math.floor((clientY - paintEl.getBoundingClientRect().top) / lh);
    const viewport = () => mode === "split" ? src : scroller;
    const paintWindow = (force = false) => {
      const vp = viewport();
      const top = vp.getBoundingClientRect().top - paintEl.getBoundingClientRect().top;
      const first = Math.max(0, Math.floor(top / lh) - WIN_PAD);
      const last = Math.min(lines.length - 1, Math.ceil((top + vp.clientHeight) / lh) + WIN_PAD);
      if (!force && first >= winFirst && last <= winLast && (winFirst === 0 || first - winFirst < WIN_PAD) && (winLast === lines.length - 1 || winLast - last < WIN_PAD)) return;
      let html = "";
      for (let b = Math.floor(first / BLOCK); b <= Math.floor(last / BLOCK); b++) {
        const rows = blockRows(b);
        const from = Math.max(first, b * BLOCK), to = Math.min(last, b * BLOCK + rows.length - 1);
        for (let i3 = from; i3 <= to; i3++) html += rowHtml(rows[i3 - b * BLOCK], i3);
      }
      win.style.transform = `translateY(${first * lh}px)`;
      win.innerHTML = html;
      winFirst = first;
      winLast = last;
      rowEl(curRow)?.classList.add("cur");
      markProblems();
      markComments();
    };
    let widest = 0, charW = 0;
    const placeTa = () => {
      ta.style.top = tw.first() * lh + "px";
      ta.style.height = tw.size() * lh + "px";
    };
    const moveWindow = (line2) => {
      const vp = viewport(), top = vp.scrollTop, from = tw.first();
      tw.center(line2);
      if (tw.first() !== from) {
        placeTa();
        vp.scrollTop = top;
        curRow = -1;
        markLine();
      }
    };
    const paintBig = () => {
      lines = tw.text().split("\n");
      lh = parseFloat(getComputedStyle(ta).lineHeight);
      if (!charW) {
        const probe = win.appendChild(document.createElement("span"));
        probe.textContent = "0".repeat(100);
        charW = probe.getBoundingClientRect().width / 100;
        probe.remove();
      }
      let w = 0;
      for (const l of lines) if (l.length > w) w = l.length;
      if (w > widest || w < widest - 40) {
        widest = w;
        src.style.minWidth = `${52 + (w + 4) * charW}px`;
      }
      paintEl.style.height = lines.length * lh + "px";
      placeTa();
      paintWindow(true);
    };
    if (big) for (const el2 of [scroller, src]) el2.addEventListener("scroll", () => {
      paintWindow();
      const vp = viewport();
      moveWindow(Math.floor((vp.getBoundingClientRect().top - paintEl.getBoundingClientRect().top + vp.clientHeight / 2) / lh));
    }, { passive: true });
    const paintSource = () => {
      if (big) {
        paintBig();
        curRow = -1;
        markLine();
        return;
      }
      const rows = splitHighlighted(highlightCode(tw.text(), host.ext));
      let a = 0;
      while (a < rows.length && a < painted.length && rows[a] === painted[a]) a++;
      let b = painted.length, c = rows.length;
      while (b > a && c > a && rows[c - 1] === painted[b - 1]) {
        b--;
        c--;
      }
      for (let i3 = b - 1; i3 >= a; i3--) paintEl.children[i3].remove();
      const html = rows.slice(a, c).map((r, k) => rowHtml(r, a + k)).join("");
      const next = paintEl.children[a];
      if (next) next.insertAdjacentHTML("beforebegin", html);
      else paintEl.insertAdjacentHTML("beforeend", html);
      if (rows.length !== painted.length) for (let i3 = c; i3 < rows.length; i3++) paintEl.children[i3].firstChild.textContent = String(i3 + 1);
      painted = rows;
      ta.style.height = paintEl.offsetHeight + "px";
      paintEl.querySelector(".cur")?.classList.remove("cur");
      curRow = -1;
      markLine();
      markProblems();
      markComments();
    };
    const markProblems = () => {
      for (const r of paintEl.querySelectorAll(".fe-fe-row.err, .fe-fe-row.warn")) {
        r.classList.remove("err", "warn");
        r.removeAttribute("title");
        delete r.dataset.tip;
      }
      for (const d of diags) {
        const row2 = rowEl(d.line - 1);
        if (!row2) continue;
        row2.classList.add(d.severity === "error" || row2.classList.contains("err") ? "err" : "warn");
        if (row2.classList.contains("err")) row2.classList.remove("warn");
        row2.title = row2.title ? `${row2.title}
${d.message}` : `Line ${d.line}: ${d.message}`;
        row2.dataset.tip = "problem";
        row2.dataset.line = String(d.line);
      }
      const errors = diags.filter((d) => d.severity === "error").length;
      diagBtn.hidden = !diags.length;
      diagBtn.className = `btn fe-fe-diag ${errors ? "error" : "warn"}`;
      const warns = diags.length - errors;
      diagBtn.textContent = [errors && `${errors} error${errors > 1 ? "s" : ""}`, warns && `${warns} warning${warns > 1 ? "s" : ""}`].filter(Boolean).join(", ");
      diagBtn.title = diags.slice(0, 12).map((d) => `Line ${d.line}: ${d.message}`).join("\n") + (diags.length > 12 ? `
and ${diags.length - 12} more` : "");
    };
    let cmRows = /* @__PURE__ */ new Map();
    const markComments = () => {
      for (const r of paintEl.querySelectorAll(".fe-fe-row.cm")) {
        r.classList.remove("cm");
        r.removeAttribute("data-cm");
      }
      cmRows = /* @__PURE__ */ new Map();
      const ms = host.comments?.marks() ?? [];
      if (!ms.length) return;
      const t = tw.text();
      const at = carrier(base, t);
      let line2 = 0, p = -1;
      for (const m of ms.map((m2) => ({ id: m2.id, o: at(m2.offset) })).sort((a, b) => a.o - b.o)) {
        for (let nl = t.indexOf("\n", p + 1); nl !== -1 && nl < m.o; nl = t.indexOf("\n", p + 1)) {
          p = nl;
          line2++;
        }
        cmRows.set(line2, cmRows.has(line2) ? cmRows.get(line2) : m.id);
      }
      for (const l of cmRows.keys()) rowEl(l)?.classList.add("cm");
    };
    const check = () => {
      const t = tw.text();
      diags = t.length > CHECK_MAX ? [] : diagnose(host.ext, t);
      markProblems();
    };
    const checkLater = () => {
      clearTimeout(checkTimer);
      checkTimer = window.setTimeout(check, CHECK_MS);
    };
    const paint = () => {
      const dirty = isDirty();
      state.innerHTML = saving ? "Saving\u2026" : failed && dirty ? '<span class="fe-fe-dot"></span>Not saved' : dirty ? '<span class="fe-fe-dot"></span>Edited' : `${UI_ICON.check}Saved`;
      state.className = saving ? "busy" : failed && dirty ? "failed" : dirty ? "dirty" : "saved";
      state.title = failed && dirty ? failed : "";
      renderView();
    };
    let shown = "";
    let renderTimer = 0;
    const renderView = () => {
      if (!view || !fmt || mode === "raw" || shown === tw.text()) return;
      if (big && shown) {
        clearTimeout(renderTimer);
        renderTimer = window.setTimeout(drawView, BIG_RENDER_MS);
        return;
      }
      drawView();
    };
    const drawView = () => {
      const t = tw.text();
      if (!view || !fmt || mode === "raw" || shown === t) return;
      const top = view.scrollTop;
      view.innerHTML = fmt.rich(t, host.href);
      view.scrollTop = top;
      shown = t;
    };
    const setMode = (m) => {
      if (!view) return;
      mode = m;
      modePref.set(m);
      box.dataset.mode = m;
      view.hidden = m === "raw";
      src.hidden = m === "rich";
      if (big && m !== "rich") paintWindow(true);
      box.querySelectorAll("[data-mode]").forEach((b) => {
        b.classList.toggle("on", b.dataset.mode === m);
        b.setAttribute("aria-pressed", String(b.dataset.mode === m));
      });
      renderView();
      if (m !== "rich") ta.focus({ preventScroll: true });
    };
    const nextMode = () => setMode(MODES[(MODES.findIndex((x) => x.id === mode) + 1) % MODES.length].id);
    box.addEventListener("scroll", (e) => {
      if (mode !== "split" || !view || e.target !== src) return;
      const sc = src;
      const ratio = sc.scrollTop / Math.max(1, sc.scrollHeight - sc.clientHeight);
      view.scrollTop = ratio * (view.scrollHeight - view.clientHeight);
    }, true);
    const write = async (expect) => {
      saving = true;
      paint();
      let retryAt = 0;
      try {
        const text = tw.text();
        const r = await notes.fileWrite(host.root, host.rel, text, expect);
        doc = { text, mtime: r.mtime };
        base = text;
        failed = "";
        banner.style.display = "none";
        host.saved(text);
      } catch (err) {
        const e = err;
        if (e.code === "notes_conflict") {
          const now = await notes.fileRead(host.root, host.rel).catch(() => null);
          if (now && now.text === doc.text && expect !== now.mtime) {
            doc = now;
            retryAt = now.mtime;
          } else showConflict();
        } else {
          failed = `Not saved: ${e.message}`;
          host.status(`not saved: ${e.message}`);
        }
      } finally {
        saving = false;
        paint();
      }
      if (retryAt) await write(retryAt);
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
      <button class="btn" data-act="reload" title="Drop your changes and load the file as it is now">Load from disk</button>
      <button class="btn" data-act="overwrite" title="Save your text over the newer file (the newer one is kept as a backup)">Keep mine</button>`;
    }
    const external = async () => {
      try {
        if ((await notes.fileStat(host.root, host.rel)).mtime === doc.mtime) return;
        const now = await notes.fileRead(host.root, host.rel);
        if (now.mtime === doc.mtime) return;
        if (now.text === doc.text) {
          doc = now;
          return;
        }
        if (!isDirty()) {
          doc = now;
          base = now.text;
          buf.snap();
          tw.set(now.text);
          buf.snap();
          check();
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
      clearTimeout(checkTimer);
      clearTimeout(renderTimer);
      document.removeEventListener("selectionchange", onSelection);
      box.innerHTML = "";
      host.closed();
    };
    const selectSpan = (pos, end) => {
      if (mode === "rich") setMode("split");
      const t = tw.text();
      let line2 = 0;
      for (let p = t.indexOf("\n"); p !== -1 && p < pos; p = t.indexOf("\n", p + 1)) line2++;
      ta.focus({ preventScroll: true });
      tw.select(pos, end);
      if (big) {
        placeTa();
        const vp = viewport();
        vp.scrollTop += line2 * lh - (vp.getBoundingClientRect().top - paintEl.getBoundingClientRect().top) - vp.clientHeight / 2;
        paintWindow(true);
      } else rowEl(line2)?.scrollIntoView({ block: "center" });
      markLine();
    };
    const goToLine = (line2) => {
      const t = tw.text();
      const pos = lineStart(t, line2 - 1);
      const end = t.indexOf("\n", pos);
      selectSpan(pos, end === -1 ? t.length : end);
    };
    ta.addEventListener("mousedown", (e) => {
      if (!cmRows.size || e.button !== 0 || e.offsetX > parseFloat(getComputedStyle(ta).paddingLeft)) return;
      const line2 = big ? lineAtY(e.clientY) : [...paintEl.children].findIndex((r) => r.getBoundingClientRect().bottom > e.clientY);
      const id = cmRows.get(line2);
      if (!id) return;
      e.preventDefault();
      host.comments?.open(id);
    });
    box.addEventListener("click", (e) => {
      const m = e.target.closest("[data-mode]")?.dataset.mode;
      if (m) setMode(m);
    });
    box.addEventListener("click", async (e) => {
      const act = e.target.closest("[data-act]")?.dataset.act;
      if (act === "save") save();
      else if (act === "done") void close();
      else if (act === "diag" && diags.length) goToLine(diags[0].line);
      else if (act === "reload") {
        const now = await notes.fileRead(host.root, host.rel);
        doc = now;
        base = now.text;
        buf.snap();
        tw.set(now.text);
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
      checkLater();
    });
    const onSelection = () => {
      if (document.activeElement === ta) markLine();
    };
    document.addEventListener("selectionchange", onSelection);
    for (const ev of ["selectionchange", "mouseup", "keyup", "focus"]) ta.addEventListener(ev, markLine);
    box.querySelector("#fe-fe-scroll").addEventListener("mousedown", (e) => {
      const me = e;
      if (me.button !== 0 || mode === "rich" || me.target === ta || view?.contains(me.target)) return;
      me.preventDefault();
      const t = tw.text();
      const line2 = big ? lineAtY(me.clientY) : [...paintEl.children].findIndex((r) => r.getBoundingClientRect().bottom > me.clientY);
      let pos = t.length;
      if (line2 >= 0) {
        const nl = t.indexOf("\n", lineStart(t, line2));
        if (nl !== -1) pos = nl;
      }
      ta.focus({ preventScroll: true });
      const top = viewport().scrollTop;
      tw.select(pos, pos);
      if (big) {
        placeTa();
        viewport().scrollTop = top;
      }
      markLine();
    });
    box.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "p" && fmt) {
        e.preventDefault();
        nextMode();
      } else if (e.key === "Escape" && mode === "rich") {
        e.preventDefault();
        setMode("raw");
      }
    });
    if (big) ta.addEventListener("keydown", (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "Home" || e.key === "End")) {
        e.preventDefault();
        const toEnd = e.key === "ArrowDown" || e.key === "End";
        const at = toEnd ? tw.text().length : 0;
        const keep = e.shiftKey ? tw.selection() : null;
        tw.select(keep ? toEnd ? keep.start : at : at, keep ? toEnd ? at : keep.end : at);
        placeTa();
        const vp = viewport();
        vp.scrollTop = toEnd ? vp.scrollHeight : 0;
        paintWindow(true);
        curRow = -1;
        markLine();
      } else if (["ArrowUp", "ArrowDown", "PageUp", "PageDown"].includes(e.key)) {
        markLine();
        moveWindow(curRow);
      }
    });
    ta.addEventListener("keydown", (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.shiftKey && e.key.toLowerCase() === "p") return;
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      } else if (mod && e.key.toLowerCase() === "z") e.preventDefault();
      else if (e.key === "Escape") {
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
    diags = doc.text.length > CHECK_MAX ? [] : diagnose(host.ext, doc.text);
    paintSource();
    paint();
    if (fmt) setMode(mode);
    ta.focus();
    return {
      dirty: isDirty,
      close: () => void close(),
      select: (start, end) => {
        const at = carrier(base, tw.text());
        selectSpan(at(start), at(end));
      },
      marks: markComments
    };
  }

  // src/find-in-page.ts
  var MAX_HITS = 2e3;
  var SKIP4 = "script,style,svg,textarea,.fe-cl-n,.fe-jl-n,.fe-fe-ln,[hidden]";
  var BLOCK2 = "p,li,dt,dd,h1,h2,h3,h4,h5,h6,td,th,tr,pre,blockquote,div,section,article,summary,figcaption";
  function attachFind(page, input, count, prev, next) {
    let hits = [];
    let cur = -1;
    const unmark = () => {
      for (const m of page.querySelectorAll("mark.fe-ff-hit")) m.replaceWith(document.createTextNode(m.textContent || ""));
      page.normalize();
      hits = [];
      cur = -1;
    };
    const partial = () => !!page.querySelector(".fe-ql-note");
    const show = () => {
      const q = input.value;
      const part = !!q && partial();
      count.textContent = !q ? "" : hits.length ? `${cur + 1} of ${hits.length}${hits.length >= MAX_HITS ? "+" : ""}` : "No match";
      count.title = part ? "Searched only the part of the file shown here" : "";
      count.classList.toggle("part", part);
      count.classList.toggle("none", !!q && !hits.length);
      prev.toggleAttribute("disabled", hits.length < 2);
      next.toggleAttribute("disabled", hits.length < 2);
      hits.forEach((h, i3) => h.forEach((m) => m.classList.toggle("on", i3 === cur)));
    };
    const go2 = (i3) => {
      if (!hits.length) return;
      cur = (i3 + hits.length) % hits.length;
      show();
      hits[cur][0].scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    };
    const mark = () => {
      unmark();
      const q = input.value.toLowerCase();
      if (!q) {
        show();
        return;
      }
      const drawn = /* @__PURE__ */ new Map();
      const isDrawn = (el2) => {
        let v = drawn.get(el2);
        if (v === void 0) {
          v = el2.getClientRects().length > 0;
          drawn.set(el2, v);
        }
        return v;
      };
      const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT, {
        acceptNode: (n2) => {
          const p = n2.parentElement;
          return !p || p.closest(SKIP4) || !isDrawn(p) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
        }
      });
      const nodes = [], starts = [];
      let joined = "", lastBlock = null;
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const block = node.parentElement.closest(BLOCK2);
        if (nodes.length && block !== lastBlock) joined += "\n";
        lastBlock = block;
        nodes.push(node);
        starts.push(joined.length);
        joined += node.data;
      }
      const lower2 = joined.toLowerCase();
      const pieces = [];
      let n = 0, found = 0;
      for (let at = lower2.indexOf(q); at !== -1 && found < MAX_HITS; at = lower2.indexOf(q, at + q.length), found++) {
        const end = at + q.length;
        while (starts[n] + nodes[n].data.length <= at) n++;
        for (let k = n; k < nodes.length && starts[k] < end; k++) {
          const s = Math.max(at, starts[k]) - starts[k], e = Math.min(end, starts[k] + nodes[k].data.length) - starts[k];
          if (e > s) pieces.push({ node: k, s, e, hit: found });
        }
      }
      hits = Array.from({ length: found }, () => []);
      for (let i3 = pieces.length - 1; i3 >= 0; i3--) {
        const { node, s, e, hit } = pieces[i3];
        const t = nodes[node];
        t.splitText(e);
        const mid = t.splitText(s);
        const m = document.createElement("mark");
        m.className = "fe-ff-hit";
        mid.replaceWith(m);
        m.append(mid);
        hits[hit].unshift(m);
      }
      const top = page.getBoundingClientRect().top;
      const first = hits.findIndex((h) => h[0].getBoundingClientRect().top >= top);
      go2(first === -1 ? 0 : first);
      if (!hits.length) show();
    };
    input.addEventListener("input", mark);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        go2(cur + (e.shiftKey ? -1 : 1));
      } else if (e.key === "Escape") {
        e.preventDefault();
        input.value = "";
        mark();
        input.blur();
      }
      e.stopPropagation();
    });
    prev.addEventListener("click", () => go2(cur - 1));
    next.addEventListener("click", () => go2(cur + 1));
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

  // src/comments-ui.ts
  var filterPref = textPref("bfb-comments-filter-v1", "open");
  var POLL_MS = 2e3;
  var FILTERS = [
    { id: "open", label: "Open", icon: UI_ICON.circle, hint: "Threads still open" },
    { id: "me", label: "For me", icon: UI_ICON.at, hint: "Threads waiting on you" },
    { id: "done", label: "Done", icon: UI_ICON.check, hint: "Closed threads" },
    { id: "all", label: "All", icon: UI_ICON.stack, hint: "Every thread" }
  ];
  var DATE_WORDS = ["due", "today", "tomorrow"];
  var who = (a) => a.kind === "human" ? "You" : (a.alias || "agent") + (a.role ? ` \xB7 ${a.role}` : "");
  function ago(iso) {
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return "";
    const s = Math.max(0, (Date.now() - t) / 1e3);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    if (s < 86400 * 7) return `${Math.floor(s / 86400)}d`;
    return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  function dueLabel(d) {
    const t = /* @__PURE__ */ new Date(d + "T00:00:00");
    return isNaN(t.getTime()) ? d : t.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }
  function forOwner(t) {
    if (t.status === "done" || !t.comments.length) return false;
    const last = t.comments[t.comments.length - 1].author;
    if (last.kind === "agent") return true;
    let mine = -1;
    t.comments.forEach((c, i3) => {
      if (c.author.kind === "human") mine = i3;
    });
    return t.comments.slice(mine + 1).some((c) => /(^|\s)@(user|owner)\b/i.test(c.text || ""));
  }
  function commentHtml(text) {
    const out = [];
    let list3 = [];
    const flush = () => {
      if (list3.length) {
        out.push(`<ul>${list3.map((l) => `<li>${l}</li>`).join("")}</ul>`);
        list3 = [];
      }
    };
    let para = [];
    const end = () => {
      if (para.length) {
        out.push(`<p>${para.join("<br>")}</p>`);
        para = [];
      }
    };
    for (const line2 of text.split("\n")) {
      const item = /^\s*[-*]\s+(.*)$/.exec(line2);
      if (item) {
        end();
        list3.push(mdInline(item[1]));
        continue;
      }
      flush();
      if (!line2.trim()) {
        end();
        continue;
      }
      para.push(mdInline(line2));
    }
    flush();
    end();
    return out.join("");
  }
  function completions(value, caret, people, tags) {
    const m = /(^|\s)([@#])([\w:.-]*)$/.exec(value.slice(0, caret));
    if (!m) return null;
    const q = m[3].toLowerCase();
    const pool = m[2] === "@" ? [...people, ...DATE_WORDS] : tags;
    const items = [...new Set(pool)].filter((x) => x.toLowerCase().startsWith(q) && x.toLowerCase() !== q).slice(0, 8);
    return items.length ? { from: caret - m[3].length - 1, sigil: m[2], items } : null;
  }
  function agentBrief(path, href, threads) {
    const name = (a) => a.kind === "human" ? a.name || "owner" : a.alias || "agent";
    const one = threads.length === 1;
    const short = (id) => id.slice(0, 10);
    const head = [
      `${one ? "Comment" : `${threads.length} comments`} on ${path}`,
      `Answer: bfb-docs comments reply|done ${path} <thread> "text"`
    ];
    const body = threads.map((t) => {
      const where = t.place.line !== null ? `line ${t.place.line}` : "not found in the file";
      const meta = [short(t.id), where, t.status, ...(t.tags ?? []).map((g) => "#" + g), t.due ? `due ${t.due}` : ""].filter(Boolean).join(" \xB7 ");
      const quote = t.anchor.exact.length > 200 ? t.anchor.exact.slice(0, 199) + "\u2026" : t.anchor.exact;
      return [
        "",
        meta,
        ...quote.split("\n").map((l) => "> " + l),
        ...t.comments.filter((c) => !c.deleted).map((c) => `${name(c.author)}: ${(c.text || "").trim()}`)
      ].join("\n");
    });
    const link = one ? [`
${href.split("#")[0]}#c=${threads[0].id}`] : [];
    return [...head, ...body, ...link].join("\n") + "\n";
  }
  function mountComments(o) {
    let threads = [];
    let notesLine = [];
    let filter = filterPref.get();
    let active = "";
    let loaded = false, failed = "";
    let lastCompanion = null, lastText = "";
    let draft = null;
    let editing = "";
    let busy = false;
    let dueOpen = "";
    const seen = /* @__PURE__ */ new Set();
    const ranges = /* @__PURE__ */ new Map();
    const typed = /* @__PURE__ */ new Map();
    let linked = location.hash.startsWith("#c=") ? decodeURIComponent(location.hash.slice(3)) : "";
    let fromLens = location.hash === "#comments";
    if (fromLens) setTimeout(() => o.reveal(), 0);
    addEventListener("hashchange", () => {
      if (location.hash === "#comments") {
        fromLens = true;
        o.reveal();
        void load();
      } else if (location.hash.startsWith("#c=")) {
        linked = decodeURIComponent(location.hash.slice(3));
        void load();
      }
    });
    let peers = null;
    const loadPeers = () => {
      if (peers === null) {
        peers = [];
        notes.people().then((p) => {
          peers = p;
        }).catch(() => {
        });
      }
    };
    const readCompanion = () => fetchFileText(o.href + ".bfb.json").catch(() => "");
    const take = (r) => {
      const fresh = r.threads.flatMap((t) => t.comments.filter((c) => !seen.has(c.id) && c.author.kind === "agent").map((c) => c.author));
      if (loaded && fresh.length) o.status(`New reply from ${fresh[fresh.length - 1].alias}`);
      r.threads.forEach((t) => t.comments.forEach((c) => seen.add(c.id)));
      threads = r.threads;
      failed = "";
      loaded = true;
    };
    const load = async () => {
      const root = o.root();
      if (!root) {
        loaded = true;
        paint();
        return;
      }
      lastCompanion = await readCompanion();
      lastText = o.text();
      try {
        const r = await notes.commentsRead(root, o.rel());
        take(r);
        notesLine = r.notes;
      } catch (e) {
        failed = e.message;
        loaded = true;
      }
      paint();
      redraw();
      o.changed();
      const hit = linked && threads.find((t) => t.id.startsWith(linked));
      if (hit) {
        linked = "";
        o.reveal();
        focusThread(hit.id);
      }
      const first = fromLens && (threads.find((t) => t.status !== "done" && t.place.offset !== null) ?? threads.find((t) => t.status !== "done"));
      if (first) {
        fromLens = false;
        focusThread(first.id);
      }
    };
    const write = async (ops, what) => {
      const root = o.root();
      if (!root || busy) return null;
      busy = true;
      try {
        const r = await notes.commentsWrite(root, o.rel(), ops);
        take(r);
        const said = r.notes.filter((n) => !notesLine.includes(n));
        if (said.length) o.status(said.join("; "));
        lastCompanion = await readCompanion();
        lastText = o.text();
        return r;
      } catch (e) {
        o.status(`${what} not saved: ${e.message}`);
        return null;
      } finally {
        busy = false;
        paint();
        redraw();
        o.changed();
      }
    };
    const sugSay = (commentId, text) => {
      sugMsg = { id: commentId, text };
      o.status(text);
      paint();
    };
    const accept = async (t, commentId) => {
      const root = o.root();
      const c = t.comments.find((x) => x.id === commentId);
      if (!root || busy || !c?.suggestion || t.place.offset === null) return;
      sugMsg = null;
      if (o.editing?.()) {
        sugSay(commentId, "The file is open in the editor. Press Done there, then accept.");
        return;
      }
      const shown = o.text();
      let cur;
      try {
        cur = await notes.fileRead(root, o.rel());
      } catch (e) {
        sugSay(commentId, `Not applied: ${e.message}`);
        return;
      }
      if (cur.text !== shown) {
        sugSay(commentId, "The file changed on disk since this page loaded it. Reload, then accept again.");
        return;
      }
      const start = t.place.offset, end = start + t.place.length;
      const next = cur.text.slice(0, start) + c.suggestion.replace + cur.text.slice(end);
      try {
        await notes.fileWrite(root, o.rel(), next, cur.mtime);
      } catch (e) {
        sugSay(commentId, `Not applied: ${e.message}`);
        return;
      }
      o.edited?.(next);
      const r = await write([{ op: "decide", thread: t.id, comment: commentId, state: "accepted", start, end: start + c.suggestion.replace.length, was: cur.text.slice(start, end) }], "Accept");
      if (r) o.status("Suggestion applied; the old text is in the backups");
    };
    const people = () => [
      "user",
      "claude",
      ...(peers ?? []).map((p) => "claude:" + p.alias),
      ...threads.flatMap((t) => [...t.mentions ?? [], ...t.comments.map((c) => c.author.kind === "agent" ? c.author.alias ?? "" : "")])
    ].filter(Boolean);
    const hintFor = (x) => {
      if (x === "user") return "you";
      if (x === "claude") return "any agent";
      if (DATE_WORDS.includes(x)) return "due date";
      const p = x.startsWith("claude:") && peers?.find((q) => q.alias === x.slice(7));
      return p ? `${p.cwd.split("/").pop() || p.cwd} \xB7 ${p.status}` : "";
    };
    const allTags = () => threads.flatMap((t) => t.tags ?? []);
    const visible2 = () => threads.filter((t) => filter === "all" ? true : filter === "done" ? t.status === "done" : filter === "me" ? forOwner(t) : t.status !== "done");
    const box = (id, label, place, start = "") => `
    <div class="fe-cm-box">
      <textarea class="tb" data-for="${esc(id)}" rows="2" aria-label="${esc(label)}" placeholder="${esc(place)}">${esc(typed.get(id) ?? start)}</textarea>
    </div>`;
    const notice = (text, why = "") => `<div class="fe-cm-state"${why ? ` title="${esc(why)}"` : ""}>${UI_ICON.info}<span>${esc(text)}</span></div>`;
    const iconBtn2 = (a, icon2, title, v = "") => `<button type="button" class="btn fe-cm-ib" data-icon data-size="sm" data-a="${a}"${v ? ` data-v="${esc(v)}"` : ""} title="${esc(title)}" aria-label="${esc(title)}">${icon2}</button>`;
    let sugMsg = null;
    const sugHtml = (t, c, on) => {
      const s = c.suggestion;
      const placed2 = t.place.offset !== null;
      const now = s.state === "accepted" ? s.was ?? "" : placed2 ? o.text().slice(t.place.offset, t.place.offset + t.place.length) : t.anchor.exact;
      const cut = (x) => x.length > 200 ? x.slice(0, 199) + "\u2026" : x;
      const diff = `<div class="fe-cm-diff">${now ? `<del>${esc(cut(now))}</del>` : ""}${s.replace ? `<ins>${esc(cut(s.replace))}</ins>` : `<i>${s.state === "accepted" ? "removed" : "remove these words"}</i>`}</div>`;
      if (s.state !== "pending") return `<div class="fe-cm-sug ${esc(s.state)}">${diff}<span class="fe-cm-sug-state">${s.state === "accepted" ? UI_ICON.check + "Accepted" : UI_ICON.close + "Rejected"}</span></div>`;
      const can = placed2 && t.place.state !== "ambiguous";
      const tools = on ? `<div data-inset class="bar fe-cm-tools">
        <button type="button" class="btn" data-size="sm" data-a="reject" data-v="${esc(c.id)}" title="Keep the text as it is">${UI_ICON.close}Reject</button>
        <button type="button" class="btn" data-size="sm" data-variant="solid" data-a="accept" data-v="${esc(c.id)}"${can ? "" : " disabled"} title="${can ? "Replace the words in the file (a backup is kept)" : "The words are no longer in the file, so this cannot be applied"}">${UI_ICON.check}Accept</button></div>` : "";
      const said = on && sugMsg?.id === c.id ? `<p class="fe-cm-sug-msg" role="status">${UI_ICON.info}<span>${esc(sugMsg.text)}</span></p>` : "";
      return `<div class="fe-cm-sug pending">${diff}${tools}${said}</div>`;
    };
    const threadHtml = (t) => {
      const on = t.id === active;
      const quote = visibleOf(t.place.state === "moved" && t.place.offset !== null ? o.text().slice(t.place.offset, t.place.offset + t.place.length) : t.anchor.exact);
      const x = (a, v, label) => on ? `<button type="button" class="btn fe-cm-x" data-icon data-size="xs" data-a="${a}" data-v="${esc(v)}" aria-label="${esc(label)}" title="${esc(label)}">${UI_ICON.close}</button>` : "";
      const chips = [
        ...(t.tags ?? []).map((g) => `<span class="chip fe-cm-chip" data-fill data-tone="quiet">#${esc(g)}${x("untag", g, `Remove tag ${g}`)}</span>`),
        t.due ? `<span class="chip fe-cm-chip" data-fill data-tone="due">${UI_ICON.clock}${esc(dueLabel(t.due))}${x("undue", "", "Clear the due date")}</span>` : "",
        t.status === "done" ? `<span class="chip fe-cm-chip" data-fill data-tone="done">Done</span>` : ""
      ].join("");
      const cs = t.comments.map((c) => {
        const mine = on && c.author.kind === "human" && !c.deleted;
        const body = editing === c.id ? `${box("edit:" + c.id, "Edit comment", "", c.text || "")}<div data-inset class="bar fe-cm-tools"><span class="fe-cm-grow"></span>
            <button type="button" class="btn" data-size="sm" data-a="edit-cancel" title="Cancel (Esc)">Cancel</button>
            <button type="button" class="btn" data-size="sm" data-variant="solid" data-a="edit-save" data-v="${esc(c.id)}" title="Save (\u2318\u21B5)">Save</button></div>` : `<div class="fe-cm-tx">${c.deleted ? "<i>Deleted</i>" : commentHtml(c.text || "")}</div>`;
        return `
      <div class="fe-cm-c${c.deleted ? " gone" : ""}">
        <div class="fe-cm-who"><b class="${c.author.kind}">${c.author.kind === "agent" ? UI_ICON.ai : ""}${esc(who(c.author))}</b><time title="${esc(c.created)}">${esc(ago(c.created))}${c.edited ? " \xB7 edited" : ""}</time>
          ${mine && editing !== c.id ? `<span class="fe-cm-own">${iconBtn2("edit", UI_ICON.rename, "Edit this comment", c.id)}${iconBtn2("del", UI_ICON.trash, "Delete this comment", c.id)}</span>` : ""}</div>
        ${body}
        ${c.suggestion ? sugHtml(t, c, on) : ""}
      </div>`;
      }).join("");
      const applied = t.status === "done" && t.comments.some((c) => c.suggestion?.state === "accepted");
      const where = applied ? "" : t.place.state === "moved" ? notice("Moved: the words changed", "The quoted words were edited; this is where they seem to be now.") : t.place.state === "ambiguous" ? notice("These words appear more than once") : t.place.state === "detached" ? notice("No longer in the file", "The quoted words were removed. Select new words and press Attach to selection to move the thread.") : "";
      const done = t.status === "done";
      const tools = on ? `
      ${box(t.id, "Reply", done ? "Reply to reopen\u2026" : "Reply\u2026 @ to mention, # to tag")}
      <div data-inset class="bar fe-cm-tools">
        <button type="button" class="btn" data-size="sm" data-a="${done ? "reopen" : "done"}" title="${done ? "Reopen this thread" : "Mark done"} (\u2318\u21E7\u21B5)">${done ? UI_ICON.reset + "Reopen" : UI_ICON.check + "Done"}</button>
        ${dueOpen === t.id ? `<input type="date" class="tb fe-cm-date" data-size="sm" data-a="due-in" aria-label="Due date" value="${esc(t.due ?? "")}">` : iconBtn2("due", UI_ICON.clock, "Set a due date")}
        ${iconBtn2("link", UI_ICON.link, "Copy a link that opens this thread")}
        ${iconBtn2("brief", UI_ICON.bot, "Copy this thread as a brief for an agent")}
        ${t.place.state !== "anchored" && !applied ? `<button type="button" class="btn" data-size="sm" data-a="attach" title="Select words on the page first">Attach to selection</button>` : ""}
        <span class="fe-cm-grow"></span>
        <button type="button" class="btn" data-size="sm" data-variant="solid" data-a="reply" title="Reply (\u2318\u21B5)">Reply</button>
      </div>` : "";
      return `<article class="fe-cm-th card${on ? " on" : ""}" data-id="${esc(t.id)}" tabindex="0" aria-label="Comment on: ${esc(t.anchor.exact.slice(0, 80))}">
      <blockquote class="fe-cm-q">${esc(quote.length > 140 ? quote.slice(0, 139) + "\u2026" : quote)}</blockquote>${where}${cs}
      ${chips ? `<div class="fe-cm-chips">${chips}</div>` : ""}${tools}</article>`;
    };
    const draftHtml = () => draft ? `<form class="fe-cm-th card fe-cm-new on" data-new aria-label="${draft.attach ? "Attach the thread here" : "New comment"}">
      <blockquote class="fe-cm-q">${esc(draft.quote.length > 140 ? draft.quote.slice(0, 139) + "\u2026" : draft.quote)}</blockquote>
      ${draft.block ? notice("On the whole block", "These words could not be placed exactly, so the comment covers the whole block.") : ""}
      ${draft.attach ? '<p class="fe-cm-hint">The thread moves to these words.</p>' : box("new", "New comment", "Comment\u2026 @ to mention, # to tag")}
      <div data-inset class="bar fe-cm-tools"><span class="fe-cm-grow"></span>
        <button type="button" class="btn" data-size="sm" data-a="cancel" title="Cancel (Esc)">Cancel</button>
        <button type="submit" class="btn" data-size="sm" data-variant="solid" data-a="post" title="${draft.attach ? "Attach" : "Comment"} (\u2318\u21B5)">${draft.attach ? "Attach here" : "Comment"}</button></div>
    </form>` : "";
    const noneHtml = () => threads.length ? emptyHtml("filtered", "Nothing here", { icon: UI_ICON.comment, actions: [{ a: "show-all", label: "Show all", title: "Show every thread, open and done" }] }) : emptyHtml("empty", "No comments yet", { icon: UI_ICON.comment, hintHtml: "Select some text,<br>then press <kbd>c</kbd>" });
    const wanted2 = (id) => id === "new" ? !!draft && !draft.attach : id.startsWith("edit:") ? editing === id.slice(5) : id === active;
    const paint = () => {
      const ae = document.activeElement;
      const focus = ae && o.box.contains(ae) && ae.dataset.for ? { id: ae.dataset.for, s: ae.selectionStart, e: ae.selectionEnd } : null;
      o.box.querySelectorAll("textarea[data-for]").forEach((ta) => {
        const id = ta.dataset.for;
        if (ta.value && wanted2(id)) typed.set(id, ta.value);
        else typed.delete(id);
      });
      const listTop = o.box.querySelector(".fe-cm-list")?.scrollTop ?? 0;
      const root = o.root();
      if (!root) {
        o.box.innerHTML = emptyHtml("empty", "Comments are saved beside this file", { icon: UI_ICON.lock, actions: [{ a: "allow", label: "Allow this folder", title: "Let comments be written in this folder" }] });
        return;
      }
      if (!loaded) {
        o.box.innerHTML = emptyHtml("loading", "Loading comments\u2026");
        return;
      }
      if (failed) {
        o.box.innerHTML = emptyHtml("failed", "Comments could not be read", { icon: UI_ICON.info, hint: failed, actions: [{ a: "retry", label: "Try again", title: "Read the comments again" }] });
        return;
      }
      const list3 = visible2();
      const groups = filter === "done" || filter === "all" ? [["", list3]] : [
        ["", list3.filter((t) => t.place.state === "anchored" || t.place.state === "ambiguous")],
        ["Moved", list3.filter((t) => t.place.state === "moved")],
        ["Detached", list3.filter((t) => t.place.state === "detached")]
      ];
      const done = filter === "open" ? threads.filter((t) => t.status === "done") : [];
      const count = (f) => threads.filter((t) => f === "all" ? true : f === "done" ? t.status === "done" : f === "me" ? forOwner(t) : t.status !== "done").length;
      o.box.innerHTML = `
      <div class="fe-cm-top">
        <div class="fe-cm-filters" role="tablist">${FILTERS.map((f) => `<button type="button" role="tab" data-f="${f.id}" class="${f.id === filter ? "on" : ""}" aria-selected="${f.id === filter}" title="${f.hint}">${f.icon}<span class="fe-cm-fl">${f.label}</span><span class="fe-cm-fn">${count(f.id) || ""}</span></button>`).join("")}</div>
        ${list3.length ? iconBtn2("brief-all", UI_ICON.bot, "Copy the threads shown as a brief for an agent, with links") : ""}
      </div>
      <div class="fe-cm-list">
        ${draftHtml()}
        ${notesLine.map((n) => `<p class="fe-cm-note">${esc(n)}</p>`).join("")}
        ${list3.length || draft ? "" : noneHtml()}
        ${groups.filter(([, ts]) => ts.length).map(([name, ts]) => `${name ? `<h4 class="sect fe-cm-group" data-level="group">${name} <span>${ts.length}</span></h4>` : ""}${ts.map(threadHtml).join("")}`).join("")}
        ${done.length ? `<details class="fe-cm-done"${done.some((t) => t.id === active) ? " open" : ""}><summary class="sect fe-cm-group" data-level="group">${DISCLOSE}Done <span>${done.length}</span></summary>${done.map(threadHtml).join("")}</details>` : ""}
      </div>
      <div class="fe-cm-ac" role="listbox" hidden></div>`;
      o.box.querySelector(".fe-cm-list").scrollTop = listTop;
      acFor = null;
      if (focus) {
        const ta = o.box.querySelector(`textarea[data-for="${CSS.escape(focus.id)}"]`);
        if (ta) {
          ta.focus({ preventScroll: true });
          ta.setSelectionRange(focus.s, focus.e);
        }
      }
    };
    const lineOf = (text, off) => {
      let n = 1;
      for (let p = text.indexOf("\n"); p !== -1 && p < off; p = text.indexOf("\n", p + 1)) n++;
      return n;
    };
    const rangeOfSpan = (offset, length) => {
      const text = o.text();
      const src = text.slice(offset, offset + length);
      const line2 = lineOf(text, offset);
      return rangeFor(o.page, line2, line2 + (src.match(/\n/g)?.length ?? 0), visibleOf(src));
    };
    const reg = CSS.highlights;
    const H = window.Highlight;
    const redraw = () => {
      ranges.clear();
      o.page.querySelectorAll("[data-cm]").forEach((b) => b.removeAttribute("data-cm"));
      const all = [];
      for (const t of threads) {
        if (t.status === "done" || t.place.offset === null || t.place.line === null) continue;
        const r = rangeOfSpan(t.place.offset, t.place.length);
        if (!r) continue;
        ranges.set(t.id, r);
        all.push(r);
        const block = (r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement)?.closest("[data-sl]");
        if (block) block.dataset.cm = String(Number(block.dataset.cm || 0) + 1);
      }
      if (reg && H) {
        reg.set("bfb-cm", new H(...all));
        const on = draft ? rangeOfSpan(draft.start, draft.end - draft.start) : ranges.get(active);
        if (on) reg.set("bfb-cm-on", new H(on));
        else reg.delete("bfb-cm-on");
        reg.delete("bfb-cm-hover");
        hovered = "";
      }
    };
    const focusThread = (id, scroll = true) => {
      active = id;
      dueOpen = "";
      editing = "";
      paint();
      redraw();
      const card3 = o.box.querySelector(`.fe-cm-th[data-id="${CSS.escape(id)}"]`);
      if (!card3) {
        filter = "all";
        paint();
        redraw();
      }
      const th = o.box.querySelector(`.fe-cm-th[data-id="${CSS.escape(id)}"]`);
      th?.scrollIntoView({ block: "nearest" });
      th?.querySelector(`textarea[data-for="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "nearest" });
      const r = ranges.get(id);
      if (scroll && r) {
        const box2 = r.getBoundingClientRect(), pg = o.page.getBoundingClientRect();
        if (box2.top < pg.top + 40 || box2.bottom > pg.bottom - 40) o.page.scrollTop += box2.top - pg.top - pg.height / 3;
      }
      const t = threads.find((x) => x.id === id);
      if (t && t.place.offset !== null) o.picked?.({ offset: t.place.offset, length: t.place.length });
    };
    const selected = () => {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount || sel.isCollapsed || o.page.style.display === "none") return null;
      const range = sel.getRangeAt(0);
      if (!o.page.contains(range.commonAncestorContainer)) return null;
      const span = sourceSpan(o.page, o.text(), range);
      return span ? { span, range } : null;
    };
    let held = null;
    const startDraft = async (span, attach) => {
      if (!o.root()) {
        if (!await o.allow()) return;
        loaded = false;
        void load();
      }
      const src = o.text().slice(span.start, span.end);
      if (!draft || draft.start !== span.start || draft.end !== span.end) {
        typed.delete("new");
        const kept = parked.get(spanKey(span));
        if (kept !== void 0) typed.set("new", kept);
      }
      parked.delete(spanKey(span));
      draft = { ...span, quote: visibleOf(src) || src, attach };
      if (!attach) active = "";
      window.getSelection()?.removeAllRanges();
      addBtn.hidden = true;
      o.reveal();
      paint();
      redraw();
      o.box.querySelector(".fe-cm-new")?.scrollIntoView({ block: "nearest" });
      (o.box.querySelector('textarea[data-for="new"]') ?? o.box.querySelector('[data-a="post"]'))?.focus();
    };
    const parked = /* @__PURE__ */ new Map();
    const spanKey = (s) => `${s.start}:${s.end}`;
    const cancelDraft = (keep = false) => {
      const raw = o.box.querySelector('textarea[data-for="new"]')?.value ?? typed.get("new") ?? "";
      if (draft && !draft.attach) {
        if (keep && raw.trim()) {
          parked.set(spanKey(draft), raw);
          o.status("Comment put away. Select the same words and press c to pick it up");
        } else parked.delete(spanKey(draft));
      }
      draft = null;
      typed.delete("new");
      paint();
      redraw();
    };
    const post = async () => {
      if (!draft) return;
      const d = draft;
      if (d.attach) {
        if (await write([{ op: "attach", thread: d.attach, start: d.start, end: d.end }], "Attach")) {
          draft = null;
          focusThread(d.attach);
        }
        return;
      }
      const ta = o.box.querySelector('textarea[data-for="new"]');
      const text = (ta?.value ?? "").trim();
      if (!text) {
        ta?.focus();
        return;
      }
      const r = await write([{ op: "new", start: d.start, end: d.end, text }], "Comment");
      if (!r) return;
      draft = null;
      typed.delete("new");
      const id = r.results?.[0]?.thread;
      if (id) {
        if (filter === "done") filter = "open";
        focusThread(id);
      } else paint();
    };
    const reply = async (id, close = false) => {
      const t = threads.find((x) => x.id === id);
      if (!t) return;
      const ta = o.box.querySelector(`textarea[data-for="${CSS.escape(id)}"]`);
      const text = (ta?.value ?? "").trim();
      const ops = [];
      if (close) ops.push({ op: t.status === "done" ? "reopen" : "done", thread: id, text });
      else if (text) ops.push({ op: t.status === "done" ? "reopen" : "reply", thread: id, text });
      if (!ops.length) {
        ta?.focus();
        return;
      }
      if (ta) ta.value = "";
      typed.delete(id);
      if (!await write(ops, "Reply")) {
        typed.set(id, text);
        paint();
        return;
      }
      o.box.querySelector(`.fe-cm-th[data-id="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
    };
    const startEdit = (cid) => {
      editing = cid;
      paint();
      const ta = o.box.querySelector(`textarea[data-for="edit:${CSS.escape(cid)}"]`);
      if (ta) {
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
      }
    };
    const cancelEdit = () => {
      typed.delete("edit:" + editing);
      editing = "";
      paint();
    };
    const saveEdit = async (cid) => {
      const ta = o.box.querySelector(`textarea[data-for="edit:${CSS.escape(cid)}"]`);
      const text = (ta?.value ?? "").trim();
      if (!text) {
        ta?.focus();
        return;
      }
      if (await write([{ op: "edit", thread: active, comment: cid, text }], "Edit")) {
        typed.delete("edit:" + cid);
        editing = "";
        paint();
      }
    };
    const copy = (text, said) => copyToClipboard(text).then((ok) => o.status(ok ? said : "copy failed"));
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.id = "fe-cm-add";
    addBtn.className = "btn";
    addBtn.hidden = true;
    addBtn.title = "Comment on the selection (c)";
    addBtn.innerHTML = `${UI_ICON.comment}Comment`;
    (document.getElementById("fe") ?? document.body).appendChild(addBtn);
    addBtn.addEventListener("pointerdown", (e) => e.preventDefault());
    addBtn.addEventListener("click", () => {
      const s = selected();
      if (s) void startDraft(s.span);
    });
    let selTimer = 0;
    document.addEventListener("selectionchange", () => {
      clearTimeout(selTimer);
      selTimer = window.setTimeout(() => {
        const s = selected();
        if (!s) {
          addBtn.hidden = true;
          return;
        }
        const rects = s.range.getClientRects();
        const r = rects[rects.length - 1] ?? s.range.getBoundingClientRect();
        addBtn.hidden = false;
        addBtn.style.top = `${Math.max(8, r.top - addBtn.offsetHeight - 6)}px`;
        addBtn.style.left = `${Math.min(innerWidth - addBtn.offsetWidth - 8, Math.max(8, r.right - addBtn.offsetWidth / 2))}px`;
      }, 120);
    });
    o.page.addEventListener("scroll", () => {
      addBtn.hidden = true;
    }, { passive: true });
    let acFor = null, acAt = 0;
    const acList = () => o.box.querySelector(".fe-cm-ac");
    const acClose = () => {
      const l = acList();
      if (l) {
        l.hidden = true;
        l.innerHTML = "";
      }
      acFor = null;
    };
    const acShow = (ta) => {
      const list3 = acList();
      const c = completions(ta.value, ta.selectionStart, people(), allTags());
      if (!list3 || !c) {
        acClose();
        return;
      }
      acFor = ta;
      acAt = Math.min(acAt, c.items.length - 1);
      list3.hidden = false;
      list3.innerHTML = c.items.map((x, i3) => {
        const hint = hintFor(x);
        return `<div role="option" data-v="${esc(x)}" class="${i3 === acAt ? "on" : ""}" aria-selected="${i3 === acAt}">${esc(c.sigil + x)}${hint ? ` <span>${esc(hint)}</span>` : ""}</div>`;
      }).join("");
      const t = ta.getBoundingClientRect(), b = o.box.getBoundingClientRect();
      list3.style.left = `${t.left - b.left}px`;
      list3.style.width = `${t.width}px`;
      const below = t.bottom + list3.offsetHeight + 8 < innerHeight;
      list3.style.top = `${below ? t.bottom - b.top + 4 : t.top - b.top - list3.offsetHeight - 4}px`;
    };
    const acPick = (ta, v) => {
      const c = completions(ta.value, ta.selectionStart, people(), allTags());
      if (!c) return;
      ta.setRangeText(c.sigil + v + " ", c.from, ta.selectionStart, "end");
      acClose();
      ta.focus();
    };
    o.box.addEventListener("input", (e) => {
      const ta = e.target;
      if (!ta.dataset?.for) return;
      if (ta.value.includes("@")) loadPeers();
      acAt = 0;
      acShow(ta);
    });
    o.box.addEventListener("scroll", acClose, true);
    o.box.addEventListener("focusout", (e) => {
      if (e.target === acFor) acClose();
    });
    o.box.addEventListener("pointerdown", (e) => {
      const s = selected();
      if (s) held = s.span;
      const opt = e.target.closest(".fe-cm-ac [data-v]");
      if (opt && acFor) {
        e.preventDefault();
        acPick(acFor, opt.dataset.v);
      }
    });
    o.box.addEventListener("keydown", (e) => {
      const el2 = e.target;
      const ta = el2.closest("textarea[data-for]");
      if (ta) {
        const list3 = acList();
        if (list3 && !list3.hidden && acFor === ta) {
          const n = list3.children.length;
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            acAt = (acAt + (e.key === "ArrowDown" ? 1 : n - 1)) % n;
            acShow(ta);
            return;
          }
          if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            acPick(ta, list3.children[acAt].dataset.v);
            return;
          }
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            acClose();
            return;
          }
        }
        const id = ta.dataset.for;
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          if (id === "new") void post();
          else if (id.startsWith("edit:")) void saveEdit(id.slice(5));
          else void reply(id, e.shiftKey);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          if (id === "new") cancelDraft(true);
          else if (id.startsWith("edit:")) cancelEdit();
          else {
            ta.blur();
            o.box.querySelector(`.fe-cm-th[data-id="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
          }
        }
        return;
      }
      if (el2.closest(".fe-cm-new")) {
        if (e.key === "Escape") {
          e.preventDefault();
          cancelDraft(true);
        } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          void post();
        }
        return;
      }
      const th = el2.closest(".fe-cm-th[data-id]");
      if (!th) return;
      if (el2 === th && (e.key === "Enter" || e.key === " ") && !e.metaKey) {
        e.preventDefault();
        focusThread(th.dataset.id);
        return;
      }
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        void reply(th.dataset.id, true);
        return;
      }
      if (e.key === "Escape" && active) {
        e.preventDefault();
        e.stopPropagation();
        active = "";
        paint();
        redraw();
        o.page.focus({ preventScroll: true });
      }
    });
    o.box.addEventListener("submit", (e) => {
      e.preventDefault();
      void post();
    });
    o.box.addEventListener("change", (e) => {
      const inp = e.target;
      if (inp.dataset.a === "due-in" && active) {
        dueOpen = "";
        void write([{ op: "due", thread: active, due: inp.value || void 0 }], "Due date");
      }
    });
    o.box.addEventListener("click", async (e) => {
      const el2 = e.target;
      const f = el2.closest("[data-f]")?.dataset.f;
      if (f) {
        filter = f;
        filterPref.set(f);
        paint();
        redraw();
        return;
      }
      const act2 = el2.closest("[data-a]");
      const a = act2?.dataset.a;
      if (a === "allow") {
        if (await o.allow()) {
          loaded = false;
          paint();
          void load();
        }
        return;
      }
      if (a === "retry") {
        failed = "";
        loaded = false;
        paint();
        void load();
        return;
      }
      if (a === "show-all") {
        filter = "all";
        paint();
        redraw();
        return;
      }
      if (a === "cancel") {
        cancelDraft();
        return;
      }
      if (a === "post") {
        e.preventDefault();
        void post();
        return;
      }
      if (a === "brief-all") {
        const ts = visible2();
        void copy(agentBrief(o.path, o.href, ts), `${ts.length} thread${ts.length === 1 ? "" : "s"} copied as a brief for an agent`);
        return;
      }
      if (a && active) {
        const v = act2.dataset.v ?? "";
        const t = threads.find((x) => x.id === active);
        if (a === "reply") {
          void reply(active);
          return;
        }
        if (a === "done" || a === "reopen") {
          void reply(active, true);
          return;
        }
        if (a === "untag") {
          void write([{ op: "untag", thread: active, tags: [v] }], "Tag");
          return;
        }
        if (a === "undue") {
          void write([{ op: "due", thread: active }], "Due date");
          return;
        }
        if (a === "del") {
          void write([{ op: "delete", thread: active, comment: v }], "Delete");
          return;
        }
        if (a === "edit") {
          startEdit(v);
          return;
        }
        if (a === "edit-cancel") {
          cancelEdit();
          return;
        }
        if (a === "edit-save") {
          void saveEdit(v);
          return;
        }
        if (a === "due") {
          dueOpen = active;
          paint();
          const inp = o.box.querySelector(".fe-cm-date");
          inp?.focus();
          try {
            inp?.showPicker();
          } catch {
          }
          return;
        }
        if (a === "reject") {
          void write([{ op: "decide", thread: active, comment: v, state: "rejected" }], "Reject");
          return;
        }
        if (a === "accept" && t) {
          void accept(t, v);
          return;
        }
        if (a === "link") {
          void copy(location.href.split("#")[0] + "#c=" + encodeURIComponent(active), "Link to this thread copied");
          return;
        }
        if (a === "brief" && t) {
          void copy(agentBrief(o.path, o.href, [t]), "Thread copied as a brief for an agent");
          return;
        }
        if (a === "attach") {
          const span = held ?? selected()?.span;
          if (!span) {
            o.status("Select the words on the page first, then press Attach to selection");
            return;
          }
          held = null;
          void startDraft(span, active);
          return;
        }
      }
      if (el2.closest("a, textarea, input, .fe-cm-tools, .fe-cm-ac, .fe-cm-new, button")) return;
      const th = el2.closest(".fe-cm-th[data-id]");
      if (th && th.dataset.id !== active) focusThread(th.dataset.id);
    });
    const threadAt = (x, y) => {
      const pos = document.caretRangeFromPoint?.(x, y);
      if (!pos) return "";
      for (const [id, r] of ranges) {
        try {
          if (r.isPointInRange(pos.startContainer, pos.startOffset)) return id;
        } catch {
        }
      }
      return "";
    };
    let hovered = "", hoverFrame = 0;
    o.page.addEventListener("mousemove", (e) => {
      if (hoverFrame || !ranges.size) return;
      hoverFrame = requestAnimationFrame(() => {
        hoverFrame = 0;
        const id = threadAt(e.clientX, e.clientY);
        if (id === hovered || !reg || !H) return;
        hovered = id;
        const r = id && id !== active ? ranges.get(id) : void 0;
        if (r) reg.set("bfb-cm-hover", new H(r));
        else reg.delete("bfb-cm-hover");
        o.page.classList.toggle("fe-cm-pointing", !!id);
      });
    });
    o.page.addEventListener("mouseleave", () => {
      hovered = "";
      reg?.delete("bfb-cm-hover");
      o.page.classList.remove("fe-cm-pointing");
    });
    o.page.addEventListener("click", (e) => {
      const me = e;
      const block = me.target.closest("[data-cm]");
      if (block && me.clientX > block.getBoundingClientRect().right - 4) {
        const id2 = [...ranges].find(([, r]) => block.contains(r.startContainer))?.[0];
        if (id2) {
          o.reveal();
          focusThread(id2, false);
          o.changed();
          return;
        }
      }
      if (window.getSelection()?.toString()) return;
      const id = threadAt(me.clientX, me.clientY);
      if (id) {
        o.reveal();
        focusThread(id, false);
        o.changed();
      }
    });
    setInterval(async () => {
      if (document.visibilityState !== "visible" || !o.root() || lastCompanion === null || busy) return;
      const comp = await readCompanion();
      if (comp === lastCompanion && o.text() === lastText) return;
      void load();
    }, POLL_MS);
    const placed = () => threads.filter((t) => t.status !== "done" && t.place.offset !== null);
    const step2 = (dir) => {
      const list3 = placed();
      if (!list3.length) return;
      const i3 = list3.findIndex((t) => t.id === active);
      const next = list3[i3 === -1 ? dir === 1 ? 0 : list3.length - 1 : (i3 + dir + list3.length) % list3.length];
      o.reveal();
      focusThread(next.id);
      o.box.querySelector(`.fe-cm-th[data-id="${CSS.escape(next.id)}"]`)?.focus({ preventScroll: true });
    };
    const readingBlock = () => {
      const at = document.activeElement?.closest("[data-sl]");
      if (at && o.page.contains(at)) return at;
      const top = o.page.getBoundingClientRect().top + 8;
      return [...o.page.querySelectorAll("[data-sl]")].find((b) => !b.querySelector("[data-sl]") && b.getBoundingClientRect().bottom > top && b.textContent.trim()) ?? null;
    };
    const act = (a) => {
      if (a === "panel") {
        o.toggle();
        return true;
      }
      if (a === "clear") {
        if (!active && !draft) return false;
        draft = null;
        active = "";
        paint();
        redraw();
        return true;
      }
      if (a === "next" || a === "prev") {
        step2(a === "next" ? 1 : -1);
        return placed().length > 0;
      }
      if (a === "comment") {
        const s = selected();
        if (s) {
          void startDraft(s.span);
          return true;
        }
        const block = readingBlock();
        if (!block) return false;
        const r = document.createRange();
        r.selectNodeContents(block);
        const span = sourceSpan(o.page, o.text(), r);
        if (!span) {
          o.status("This part of the page cannot take a comment");
          return true;
        }
        void startDraft(span);
        return true;
      }
      if (!active || !threads.some((t) => t.id === active && t.status !== "done")) {
        if (!placed().length) {
          o.status("No open comments to reply to");
          return true;
        }
        step2(1);
      }
      o.reveal();
      const ta = o.box.querySelector(`textarea[data-for="${CSS.escape(active)}"]`);
      ta?.focus();
      ta?.scrollIntoView({ block: "nearest" });
      return true;
    };
    paint();
    void load();
    return {
      act,
      redraw,
      open: () => threads.filter((t) => t.status !== "done").length,
      show: (id) => {
        if (id) focusThread(id);
        else paint();
      },
      marks: () => placed().map((t) => ({ id: t.id, offset: t.place.offset, length: t.place.length })),
      held: () => !!active || !!draft
    };
  }

  // src/file-page.ts
  var scrollPref = jsonPref("bfb-page-scroll-v1", {}, (v) => !!v && typeof v === "object");
  var tocPref = flagPref("bfb-page-toc-v1", true);
  var railTabPref = choicePref("bfb-page-rail-tab-v1", ["toc", "cm"], "toc");
  var columnPref = textPref("bfb-page-column-v2");
  var oldColumnPref = textPref("bfb-page-column-v1");
  var COLUMN_MODES = ["unset", "xl", "lg", "md"];
  var COLUMN_WIDTHS = { unset: "full", xl: "150ch", lg: "130ch", md: "110ch" };
  function columnMode(value) {
    if (value === true || value === "1") return "md";
    return COLUMN_MODES.includes(value) ? value : "unset";
  }
  function savedColumnMode(fallback) {
    return columnMode(columnPref.get() || oldColumnPref.get() || fallback);
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
  function renderBody(text, ext2, href) {
    const note2 = unrenderableNote(text);
    if (note2) return note2;
    if (TABLE_EXTS.has(ext2)) {
      const rows = parseDSV(text, ext2 === "tsv" ? "	" : ",");
      return rows.length ? renderDSVTable(rows[0], rows.slice(1), numericCols(rows)) : unrenderableNote("");
    }
    const fmt = formatFor(ext2);
    if (fmt && fmt.id !== "html") return fmt.rich(text, href);
    return renderCode(text, ext2);
  }
  var diagRow = (d) => `<button type="button" class="fe-diag-row ${d.severity}" data-line="${d.line}" title="Show line ${d.line} in the source"><span class="fe-diag-ln">${d.line}</span><span>${esc(d.message)}</span></button>`;
  function diagStrip(diags) {
    if (!diags.length) return "";
    const errors = diags.filter((d) => d.severity === "error").length;
    const warns = diags.length - errors;
    const head = [errors && `${errors} error${errors > 1 ? "s" : ""}`, warns && `${warns} warning${warns > 1 ? "s" : ""}`].filter(Boolean).join(", ");
    const rows = diags.slice(0, 8).map(diagRow).join("");
    const more = diags.length > 8 ? `<span class="fe-diag-more">and ${diags.length - 8} more</span>` : "";
    return `<details class="fe-diag card ${errors ? "error" : "warn"}"${errors ? " open" : ""}><summary>${head}</summary>${rows}${more}</details>`;
  }
  function markRows(rows, diags) {
    for (const d of diags) {
      const row2 = rows[d.line - 1];
      if (!row2) continue;
      if (!row2.classList.contains("err")) row2.classList.add(d.severity === "error" ? "err" : "warn");
      if (d.severity === "error") row2.classList.replace("warn", "err");
      row2.title = row2.title ? `${row2.title}
${d.message}` : d.message;
      row2.dataset.tip = "problem";
      row2.dataset.line = String(d.line);
    }
  }
  function buildToc(page, toc) {
    const heads = [...page.querySelectorAll(".fe-md h1, .fe-md h2, .fe-md h3, .fe-md h4")];
    toc.innerHTML = heads.map((h) => {
      const text = (h.textContent || "").replace(/#$/, "").trim();
      return `<a href="#${esc(h.id)}" class="row fe-toc-${h.tagName.toLowerCase()}" data-id="${esc(h.id)}" title="${esc(text)}">${esc(text)}</a>`;
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
    const row2 = on;
    if (row2) {
      const r = row2.getBoundingClientRect(), b = box.getBoundingClientRect();
      if (r.top < b.top || r.bottom > b.bottom) box.scrollTop += r.top - b.top - box.clientHeight / 3;
    }
  }
  function scrollMemory() {
    return scrollPref.get();
  }
  function rememberScroll(path, top) {
    const m = scrollMemory();
    m[path] = top;
    const keys2 = Object.keys(m);
    if (keys2.length > 200) for (const k of keys2.slice(0, keys2.length - 200)) delete m[k];
    scrollPref.set(m);
  }
  function renderFileContent() {
    return `
      <div id="fe-fp-bar" class="bar">
        <span id="fe-fp-meta"></span>
        <button id="fe-fp-column" class="btn" title="Cycle reading width"><svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true"><rect x="1.5" y="1.5" width="10" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M4 1.5v10M9 1.5v10" stroke="currentColor" stroke-width="1.1"/></svg><span class="fe-fp-column-label">Full width</span></button>
        <button id="fe-fp-edit" class="btn" title="Edit this file (e)"><svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true"><path d="M8.5 2.5l2 2L4.5 10.5H2.5v-2z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>Edit</button>
        <button id="fe-fp-wrap" class="btn" title="Wrap long lines in raw text and code"><svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true"><path d="M1.5 3.5h10M1.5 6.5h8a2 2 0 0 1 0 4H7m1.5-1.5L7 10.5 8.5 12M1.5 9.5h3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>Wrap</button>
        <button id="fe-fp-raw" class="btn" title="Raw text (r)"><svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true"><path d="M4.5 3 1.5 6.5 4.5 10M8.5 3l3 3.5-3 3.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>Raw</button>
        <button id="fe-fp-copy" class="btn" title="Copy file contents"><svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M2 9H1.5V2a.5.5 0 0 1 .5-.5h7V2" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>Copy</button>
        <span id="fe-ff" title="Find in this file (/) \xB7 Enter next \xB7 Shift+Enter previous \xB7 Esc clears">
          <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true"><circle cx="5.5" cy="5.5" r="3.8" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M8.4 8.4 11.5 11.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
          <input id="fe-ff-q" type="text" placeholder="Find" spellcheck="false" autocomplete="off" aria-label="Find in this file" title="Find in this file (/)">
          <span id="fe-ff-n" aria-live="polite"></span>
          <button id="fe-ff-prev" class="btn" data-icon data-size="xs" title="Previous match (Shift+Enter)" disabled><svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true"><path d="M2.5 7 5.5 4l3 3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          <button id="fe-ff-next" class="btn" data-icon data-size="xs" title="Next match (Enter)" disabled><svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true"><path d="M2.5 4l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        </span>
        <span class="fe-fp-panes">
          <button id="fe-fp-toc" class="btn" data-icon title="On this page: the headings" aria-label="On this page" hidden>${UI_ICON.contents}</button>
          <button id="fe-fp-cm" class="btn" data-icon title="Comments (\u21E7C)" aria-label="Comments" hidden>${UI_ICON.comment}<span id="fe-fp-cm-n"></span></button>
        </span>
      </div>
      <div id="fe-fp">
        <div id="fe-page" tabindex="-1"></div>
        <div id="fe-fe" style="display:none"></div>
        <aside id="fe-toc-rail" hidden>
          <div class="fe-toc-head"><h3 class="sect fe-rail-title" data-level="panel"><span class="fe-rail-ico"></span><span class="fe-rail-name"></span><span class="badge fe-rt-n" data-tone="solid" id="fe-cm-n"></span></h3></div>
          <nav id="fe-toc"></nav>
          <div id="fe-cm" role="tabpanel" aria-label="Comments" hidden></div>
        </aside>
      </div>`;
  }
  var TOC_ROOMY = 1e3;
  function mountFileContent(opts) {
    const { ext: ext2, rawPath, href } = opts;
    let text = opts.text;
    const page = document.getElementById("fe-page");
    const toc = document.getElementById("fe-toc");
    const rail = document.getElementById("fe-toc-rail");
    const tocBtn = document.getElementById("fe-fp-toc");
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
    let tocOpen = tocPref.get();
    let tight = false, peek = false;
    let column = savedColumnMode(opts.column);
    const fe = document.getElementById("fe");
    const paintMeta = () => {
      const fm = fileMeta(text, ext2, rawPath);
      meta.textContent = fm.kind;
      const row2 = document.getElementById("fe-status-meta");
      if (row2) row2.innerHTML = metaChips(fm);
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
      rawBtn.style.display = editor ? "none" : "";
      const cmOpen = comments?.open() ?? 0;
      const hasToc = headings >= 2 && !editor;
      const tab = railTab === "toc" && !hasToc ? "cm" : railTab;
      const open = tight ? peek : tocOpen;
      rail.hidden = !isMd || raw || !open || (tab === "cm" ? railTab !== "cm" && !cmOpen : !hasToc);
      rail.dataset.tab = tab;
      toc.hidden = tab !== "toc";
      cmBox.hidden = tab !== "cm";
      rail.querySelector(".fe-rail-ico").innerHTML = tab === "cm" ? UI_ICON.comment : UI_ICON.contents;
      rail.querySelector(".fe-rail-name").textContent = tab === "cm" ? "Comments" : "On this page";
      cmN.textContent = tab === "cm" && cmOpen ? String(cmOpen) : "";
      cmBtn.hidden = !isMd || raw;
      tocBtn.hidden = !hasToc || raw;
      for (const [b, t] of [[tocBtn, "toc"], [cmBtn, "cm"]]) {
        const on = !rail.hidden && tab === t;
        b.classList.toggle("on", on);
        b.setAttribute("aria-pressed", String(on));
      }
      cmBtnN.textContent = cmOpen ? String(cmOpen) : "";
      rail.classList.toggle("peek", tight && peek);
      findBox.hidden = !!editor;
    };
    const render2 = () => {
      paintMeta();
      const top = page.scrollTop;
      const diags = diagnose(ext2, text);
      const fmEnd = isMd && !raw && /^---\r?\n/.test(text) ? text.split("\n").findIndex((l, k) => k > 0 && /^(---|\.\.\.)\s*$/.test(l)) + 1 : 0;
      const inBox = fmEnd > 0 ? diags.filter((d) => d.line <= fmEnd) : [];
      page.innerHTML = diagStrip(diags.filter((d) => !inBox.includes(d))) + (raw ? renderCode(text, JSONL_EXTS.has(ext2) ? "json" : ext2) : renderBody(text, ext2, href));
      const box = inBox.length ? page.querySelector(".fe-md-fm") : null;
      if (box) box.insertAdjacentHTML("beforeend", `<div class="fe-md-fm-warn notice" data-tone="warn">${inBox.map(diagRow).join("")}<span class="fe-md-fm-note">Shown as written; a strict YAML reader would not accept it.</span></div>`);
      else if (inBox.length) page.insertAdjacentHTML("afterbegin", diagStrip(inBox));
      markRows(page.querySelectorAll(".fe-cl"), diags);
      headings = !raw && isMd ? buildToc(page, toc) : 0;
      page.scrollTop = top;
      rawBtn.classList.toggle("on", raw);
      paint();
      spy(page, toc);
      find.refresh();
      comments?.redraw();
    };
    let editor = null;
    const cmBox = document.getElementById("fe-cm");
    const cmN = document.getElementById("fe-cm-n");
    const cmBtn = document.getElementById("fe-fp-cm");
    const cmBtnN = document.getElementById("fe-fp-cm-n");
    let comments = null;
    let railTab = railTabPref.get();
    const showPane = (t) => {
      railTab = t;
      railTabPref.set(t);
      if (tight) peek = true;
      else if (!tocOpen) {
        tocOpen = true;
        tocPref.set(true);
      }
      paint();
      if (t === "toc") spy(page, toc);
    };
    const togglePane = (t) => {
      if (rail.hidden || rail.dataset.tab !== t) {
        showPane(t);
        return;
      }
      if (tight) peek = false;
      else {
        tocOpen = false;
        tocPref.set(false);
      }
      paint();
    };
    const fp = document.getElementById("fe-fp");
    if (fp) tight = fp.clientWidth < TOC_ROOMY;
    render2();
    if (fp) new ResizeObserver(() => {
      const was = tight;
      tight = fp.clientWidth < TOC_ROOMY;
      if (tight !== was) {
        peek = false;
        paint();
      }
    }).observe(fp);
    toc.addEventListener("click", (e) => {
      if (tight && e.target.closest("a")) {
        peek = false;
        paint();
      }
    });
    colBtn.addEventListener("click", () => {
      column = COLUMN_MODES[(COLUMN_MODES.indexOf(column) + 1) % COLUMN_MODES.length];
      columnPref.set(column);
      paint();
    });
    page.addEventListener("scroll", () => {
      if (isMd && !raw) spy(page, toc);
    });
    page.addEventListener("click", (e) => {
      const row2 = e.target.closest(".fe-diag-row");
      if (!row2) return;
      if (!raw) {
        raw = true;
        render2();
      }
      const line2 = page.querySelectorAll(".fe-cl")[Number(row2.dataset.line) - 1];
      if (!line2) return;
      line2.scrollIntoView({ block: "center" });
      line2.classList.add("flash");
      setTimeout(() => line2.classList.remove("flash"), 1200);
    });
    toc.addEventListener("click", (e) => {
      const a = e.target.closest("a[data-id]");
      const target = a && document.getElementById(a.dataset.id);
      if (!target) return;
      e.preventDefault();
      const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
      toc.dataset.pin = a.dataset.id;
      target.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
      markPlace("#" + encodeURIComponent(a.dataset.id));
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
      const pop = document.createElement("div");
      pop.id = "fe-allow";
      const short = home && folder.startsWith(home + "/") ? "~" + folder.slice(home.length) : folder;
      pop.innerHTML = `<div class="fe-allow-title">${UI_ICON.lock}Allow editing here?</div>
      <p>Saves write to <code>${esc(short)}</code>. Each save keeps the old text for 14 days.</p>
      <div class="fe-allow-acts"><button type="button" class="btn" data-a="cancel">Cancel</button>
      <button type="button" class="btn" data-variant="outline" data-a="file">Just this file</button>
      <button type="button" class="btn" data-variant="solid" data-a="folder">Allow folder</button></div>`;
      let ok = false;
      const layer = openLayer(pop, {
        kind: "popover",
        anchor: editBtn,
        align: "end",
        offset: 8,
        role: "dialog",
        label: "Allow editing",
        group: "allow",
        focus: pop.querySelector('[data-a="folder"]'),
        onClose: () => resolve(ok)
      });
      if (!layer.open) {
        resolve(false);
        return;
      }
      pop.addEventListener("click", (e) => {
        const a = e.target.closest("[data-a]")?.dataset.a;
        if (!a) return;
        if (a !== "cancel") {
          const s = getSettings();
          s.editableFolders = [.../* @__PURE__ */ new Set([...s.editableFolders ?? [], a === "folder" ? folder : rawPath])];
          saveSettings(s);
          root = editableRoot(rawPath, s.editableFolders, home);
          ok = !!root;
        }
        layer.close("pick");
      });
    });
    const noteAtButton = (msg) => {
      const pop = document.createElement("div");
      pop.id = "fe-allow";
      pop.className = "fe-allow-note";
      pop.innerHTML = `<div class="fe-allow-title">${UI_ICON.lock}Cannot edit this file</div><p>${esc(msg)}</p>`;
      const layer = openLayer(pop, { kind: "popover", anchor: editBtn, align: "end", offset: 8, role: "alert", group: "allow", focus: "none" });
      setTimeout(() => layer.close("api"), 8e3);
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
        },
        comments: comments ? { marks: () => comments.marks(), open: (id) => {
          showComments();
          comments.show(id);
        } } : void 0
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
    const showComments = () => showPane("cm");
    const toggleComments = () => togglePane("cm");
    if (isMd) comments = mountComments({
      page,
      box: cmBox,
      href,
      path: rawPath,
      root: () => root,
      rel: () => rawPath.slice((root ?? "").length + 1),
      text: () => text,
      allow: askToAllow,
      status,
      changed: () => {
        paint();
        editor?.marks();
      },
      reveal: showComments,
      toggle: toggleComments,
      picked: (span) => editor?.select(span.offset, span.offset + span.length),
      editing: () => !!editor,
      edited: (fresh) => {
        text = fresh;
        paintMeta();
        render2();
      }
    });
    cmBtn.addEventListener("click", toggleComments);
    tocBtn.addEventListener("click", () => togglePane("toc"));
    document.getElementById("fe-ff-q").addEventListener("input", () => setTimeout(() => comments?.redraw(), 0));
    rawBtn.addEventListener("click", toggleRaw);
    const wrapBtn = document.getElementById("fe-fp-wrap");
    const syncWrap = () => wrapBtn.classList.toggle("on", fe.dataset.wrap === "on");
    syncWrap();
    wrapBtn.addEventListener("click", () => {
      const s = getSettings();
      s.wrapLines = fe.dataset.wrap !== "on";
      fe.dataset.wrap = s.wrapLines ? "on" : "off";
      saveSettings(s);
      syncWrap();
    });
    document.getElementById("fe-fp-copy").addEventListener("click", () => {
      copyToClipboard(text).then((ok) => {
        document.getElementById("fe-status-text").textContent = ok ? "copied" : "copy failed";
      });
    });
    const reloadEl = document.getElementById("fe-fp-reload");
    let liveTimer = 0;
    const live2 = (ok, label) => {
      clearTimeout(liveTimer);
      reloadEl.hidden = false;
      reloadEl.classList.toggle("off", !ok);
      reloadEl.textContent = ok ? "Updated from disk" : "Not watching for changes";
      reloadEl.title = label;
      if (ok) liveTimer = window.setTimeout(() => {
        reloadEl.hidden = true;
      }, 4e3);
    };
    setInterval(() => {
      if (document.visibilityState !== "visible" || editor) return;
      fetchFileText(href).then((fresh) => {
        if (fresh === text) return;
        text = fresh;
        paintMeta();
        render2();
        live2(true, "reloaded " + (/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      }).catch(() => live2(false, "not watching"));
    }, RELOAD_MS);
    return {
      toggleRaw,
      edit: () => void edit2(),
      comment: (a) => !editor && !raw && !!comments?.act(a),
      commentable: () => !editor && !raw && !!comments,
      commentHeld: () => !editor && !raw && !!comments?.held(),
      editing: () => !!editor,
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
    const i3 = s.list.findIndex((t) => t.id === s.active);
    const list3 = [...s.list];
    list3.splice(Math.max(i3 < 0 ? list3.length : i3 + 1, pinnedCount(s)), 0, tab);
    return { list: list3, active: background ? s.active : tab.id };
  }
  function closeTab(s, id) {
    const i3 = s.list.findIndex((t) => t.id === id);
    if (i3 < 0) return s;
    const list3 = s.list.filter((t) => t.id !== id);
    let active = s.active;
    if (active === id) active = list3[Math.min(i3, list3.length - 1)]?.id ?? null;
    return { list: list3, active };
  }
  function closeOthers(s, id) {
    if (!s.list.some((t) => t.id === id)) return s;
    const list3 = s.list.filter((t) => t.pinned || t.id === id);
    return { list: list3, active: list3.some((t) => t.id === s.active) ? s.active : id };
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
    const i3 = s.list.findIndex((t) => t.id === s.active);
    const j = i3 < 0 ? dir > 0 ? 0 : s.list.length - 1 : (i3 + dir + s.list.length) % s.list.length;
    return s.list[j];
  }
  function moveTab(s, id, toId) {
    const from = s.list.findIndex((t2) => t2.id === id), to = s.list.findIndex((t2) => t2.id === toId);
    if (from < 0 || to < 0 || from === to || s.list[from].pinned !== s.list[to].pinned) return s;
    const list3 = [...s.list];
    const [t] = list3.splice(from, 1);
    list3.splice(to, 0, t);
    return { ...s, list: list3 };
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
    const list3 = [...s.list];
    const at = Math.min(Math.max(index, pinnedCount(s)), list3.length);
    list3.splice(at, 0, { ...tab, pinned: false });
    return { ...s, list: list3 };
  }
  function splitLabel(label) {
    if (label.length <= 12) return { head: label, tail: "" };
    const ext2 = label.match(/\.[A-Za-z0-9]{1,6}$/)?.[0] ?? "";
    return { head: label.slice(0, label.length - ext2.length), tail: ext2 };
  }
  function displayLabels(list3) {
    const count = /* @__PURE__ */ new Map();
    for (const t of list3) count.set(t.label, (count.get(t.label) ?? 0) + 1);
    return list3.map((t) => {
      if ((count.get(t.label) ?? 0) < 2) return t.label;
      const parts = t.path.split("/").filter(Boolean);
      return parts.length >= 2 ? parts[parts.length - 2] + "/" + t.label : t.label;
    });
  }

  // src/strip.ts
  var SESSION_KEY = "bfb-strip-v2";
  var RECOVERY_PREFIX = "bfb-strip-v2:";
  var storageArea = () => typeof chrome !== "undefined" && chrome.storage?.local || null;
  var sessionPref = jsonPref(SESSION_KEY, null, () => true, "tab");
  function readSession() {
    const v = sessionPref.get();
    return v && typeof v.sid === "string" && isTabState(v.state) ? { sid: v.sid, state: normalize(v.state), closed: Array.isArray(v.closed) ? v.closed : [] } : null;
  }
  function writeSession(sid, state, closed) {
    sessionPref.set({ sid, state, closed });
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
      state.list.forEach((t, i3) => {
        if (!next.list.some((x) => x.id === t.id)) closed.push({ tab: t, index: i3 });
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
      if (t.path !== rawPath) go(hrefFor(t));
    }
    function closeHere() {
      const here = hereIn(state);
      if (!here) return;
      const next = closeTab(state, here.id);
      commit(next);
      const to = next.list.find((t) => t.id === next.active);
      if (to && to.path !== rawPath) go(hrefFor(to));
    }
    function closeById(id) {
      if (hereIn(state)?.id === id) closeHere();
      else commit(closeTab(state, id));
    }
    const listBtn = document.getElementById("fe-tab-list");
    const menu = document.createElement("div");
    menu.className = "fe-ctx fe-tab-menu";
    let layer = null;
    const closeMenu = () => layer?.close("pick");
    el2.addEventListener("contextmenu", (e) => {
      const a = e.target.closest(".fe-tab[data-id]");
      const t = a && state.list.find((x) => x.id === a.dataset.id);
      if (!t) return;
      e.preventDefault();
      openMenu3(t, a);
    });
    function openMenu3(t, anchor) {
      const saved = isSaved(t.path);
      menu.innerHTML = [
        `<div class="row fe-ctx-item" data-act="copy">${UI_ICON.copy}<span>Copy path</span></div>`,
        `<div class="row fe-ctx-item" data-act="save">${PI.bm}<span>${saved ? "Unsave" : "Save"}</span></div>`,
        host.openInTerminal ? `<div class="row fe-ctx-item" data-act="term">${UI_ICON.terminal}<span>Open in terminal</span></div>` : "",
        `<div class="row fe-ctx-item" data-act="pin">${UI_ICON.pin}<span>${t.pinned ? "Unpin" : "Pin"}</span><span class="fe-ctx-key">p</span></div>`,
        `<div class="fe-ctx-sep"></div>`,
        `<div class="row fe-ctx-item" data-act="close">${UI_ICON.close}<span>Close</span><span class="fe-ctx-key">w</span></div>`,
        `<div class="row fe-ctx-item" data-act="others">${UI_ICON.stack}<span>Close others</span></div>`
      ].join("");
      menu.dataset.id = t.id;
      layer = openLayer(menu, { kind: "popover", anchor, role: "menu", group: "menu" });
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
        const now = toggleSaved(t.path, t.label);
        host.onSavedChange?.();
        toast(now ? "Saved" : "Removed from Saved");
      } else if (act === "term") host.openInTerminal?.(t.kind === "file" ? t.path.replace(/\/[^/]*$/, "") || "/" : t.path);
      else if (act === "pin") commit(togglePin(state, t.id));
      else if (act === "close") closeById(t.id);
      else if (act === "others") commit(closeOthers(state, t.id));
    });
    function fitHeads() {
      for (const head of el2.querySelectorAll(".fe-tab-head")) {
        const full = head.dataset.full ?? head.textContent ?? "";
        head.dataset.full = full;
        head.textContent = full;
        if (head.scrollWidth <= head.clientWidth) continue;
        let lo = 0, hi = full.length;
        while (lo < hi) {
          const mid = lo + hi + 1 >> 1;
          head.textContent = full.slice(0, mid) + "\u2026";
          if (head.scrollWidth <= head.clientWidth) lo = mid;
          else hi = mid - 1;
        }
        head.textContent = full.slice(0, lo).trimEnd() + "\u2026";
      }
    }
    function lblHtml(label) {
      const { head, tail } = splitLabel(label);
      return `<span class="fe-tab-lbl"><span class="fe-tab-head">${esc(head)}</span>${tail ? `<span class="fe-tab-tail">${esc(tail)}</span>` : ""}</span>`;
    }
    function tabHtml(t, i3, on, label) {
      const ico = t.kind === "file" ? `<span class="fe-tab-ico">${icoFile(t.label.includes(".") ? t.label.split(".").pop().toLowerCase() : "")}</span>` : `<span class="fe-tab-ico">${icoFolder(t.label)}</span>`;
      const tip = `${t.path}
${i3 < 9 ? `${i3 + 1} jumps \xB7 ` : ""}click switches \xB7 ${t.pinned ? "pinned (p unpins, right-click for more)" : "middle-click closes"} \xB7 drag reorders`;
      return `<a class="fe-tab${on ? " on" : ""}${t.pinned ? " pinned" : ""}"${on ? ' aria-current="page"' : ""} draggable="true" data-id="${esc(t.id)}" href="${esc(hrefFor(t))}" title="${esc(tip)}">
      ${ico}${lblHtml(label)}
      <button class="btn fe-tab-more" data-icon data-size="xs" data-id="${esc(t.id)}" title="Copy path \xB7 save \xB7 pin \xB7 close others">${UI_ICON.more}</button>
      ${t.pinned ? "" : `<button class="btn fe-tab-x" data-icon data-size="xs" data-tone="danger" data-id="${esc(t.id)}" title="Close (w)">${UI_ICON.close}</button>`}
    </a>`;
    }
    function render2() {
      const here = hereIn(state);
      const labels = displayLabels(state.list);
      const rows = state.list.map((t, i3) => tabHtml(t, i3, t.id === here?.id, labels[i3]));
      if (!here) {
        const ico = kindOf(rawPath) === "file" ? `<span class="fe-tab-ico">${icoFile(labelFor(rawPath).split(".").pop().toLowerCase())}</span>` : `<span class="fe-tab-ico">${icoFolder(labelFor(rawPath))}</span>`;
        rows.push(`<a class="fe-tab on temp" data-id="" href="${esc(fileUrl(rawPath))}" title="${esc(rawPath)}
Not kept yet \xB7 t or double-click keeps \xB7 p pins">${ico}${lblHtml(labelFor(rawPath))}</a>`);
      }
      el2.innerHTML = rows.join("");
      fitHeads();
      el2.classList.toggle("is-empty", state.list.length === 0);
      el2.querySelector(".fe-tab.on")?.scrollIntoView({ inline: "nearest", block: "nearest" });
      if (listBtn) {
        listBtn.hidden = state.list.length < 2;
        listBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          menu.innerHTML = state.list.map((t, i3) => `<div class="row fe-ctx-item${t.id === here?.id ? " on" : ""}" data-go="${esc(t.id)}">${t.kind === "file" ? icoFile(t.label.includes(".") ? t.label.split(".").pop().toLowerCase() : "") : icoFolder(t.label)}<span>${esc(labels[i3])}</span>${i3 < 9 ? `<kbd>${i3 + 1}</kbd>` : ""}</div>`).join("");
          menu.dataset.id = "";
          layer = openLayer(menu, { kind: "popover", anchor: listBtn, align: "end", role: "menu", group: "menu" });
        };
      }
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
          if (t) openMenu3(t, btn);
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
      move(id, dir) {
        const i3 = state.list.findIndex((t) => t.id === id);
        const to = state.list[i3 + dir];
        if (i3 >= 0 && to) commit(moveTab(state, id, to.id));
      },
      open: (path, background = false) => commit(openTab(state, path, background)),
      go: (path, hash = "") => {
        let s = state;
        if (rawPath && !s.list.some((t) => t.path === rawPath)) s = openTab(s, rawPath, true);
        commit(openTab(s, path));
        if (path !== rawPath) go(fileUrl(path), "here", { hash });
        else if (hash) location.hash = hash;
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
      raise(el2);
      el2.classList.add("show");
      clearTimeout(tid);
      tid = setTimeout(() => el2.classList.remove("show"), ms);
    };
  }

  // src/help.ts
  var kbd = (k) => k.startsWith("hold ") ? `<i class="fe-km-then">hold</i><kbd>${esc(k.slice(5))}</kbd>` : k.split(" ").map((p) => `<kbd>${esc(p)}</kbd>`).join('<i class="fe-km-then">then</i>');
  var keys = (list3) => list3.map(kbd).join('<i class="fe-km-or">or</i>');
  var ROWS = [
    [["esc", "esc", 1.5], ...Array.from({ length: 12 }, (_, i3) => [`f${i3 + 1}`, `F${i3 + 1}`])],
    [["`", "`"], ..."1234567890".split("").map((c) => [c, c]), ["-", "-"], ["=", "="], ["backspace", "\u232B", 2]],
    [["tab", "\u21E5", 1.5], ..."qwertyuiop".split("").map((c) => [c, c.toUpperCase()]), ["[", "["], ["]", "]"], ["\\", "\\", 1.5]],
    [["caps", "\u21EA", 1.75], ..."asdfghjkl".split("").map((c) => [c, c.toUpperCase()]), [";", ";"], ["'", "'"], ["enter", "\u21A9", 2.25]],
    [["shift", "\u21E7", 2.25], ..."zxcvbnm".split("").map((c) => [c, c.toUpperCase()]), [",", ","], [".", "."], ["/", "/"], ["shift", "\u21E7", 2.75]],
    [["fn", "fn"], ["ctrl", "\u2303"], ["alt", "\u2325"], ["meta", "\u2318", 1.25], ["space", "", 5], ["meta", "\u2318", 1.25], ["alt", "\u2325"], ["left", "\u2190"], ["updown", "", 1], ["right", "\u2192"]]
  ];
  function keyboardMap() {
    const uses = /* @__PURE__ */ new Map();
    for (const d of KEYMAP) for (const k of d.keys) for (const c of capsFor(k)) uses.set(c, (uses.get(c) ?? 0) + 1);
    const cap = ([id, label, w = 1]) => id === "updown" ? `<span class="fe-km-ud"><span class="fe-km-cap half${uses.has("up") ? " used" : ""}" data-cap="up">\u2191</span><span class="fe-km-cap half${uses.has("down") ? " used" : ""}" data-cap="down">\u2193</span></span>` : `<span class="fe-km-cap${uses.has(id) ? " used" : ""}${/^f\d/.test(id) || id === "esc" ? " fn" : ""}" data-cap="${esc(id)}" style="--w:${w}">${esc(label)}</span>`;
    const board = `<div class="fe-km-board" aria-hidden="true">${ROWS.map((r) => `<div class="fe-km-row-k">${r.map(cap).join("")}</div>`).join("")}</div>`;
    const list3 = GROUPS.map((g) => {
      const defs = KEYMAP.filter((d) => d.group === g.name);
      if (!defs.length) return "";
      return `<section class="fe-km-g card"><h3 class="sect" data-level="group">${PI[g.icon] ?? ""}${esc(g.name)}</h3>${defs.map((d) => `<div class="row fe-km-i" data-caps="${esc([...new Set(d.keys.flatMap(capsFor))].join(" "))}" data-q="${esc((d.title + " " + d.keys.join(" ") + " " + g.name).toLowerCase())}"><span>${esc(d.title)}</span><span class="fe-km-k">${keys(d.keys)}</span></div>`).join("")}</section>`;
    }).join("");
    return `<div class="fe-km">
    ${board}
    <div class="fe-km-bar"><input type="search" class="tb fe-km-q" data-size="lg" placeholder="Find a key or an action" spellcheck="false" aria-label="Find a key or an action">
      <span class="fe-km-legend"><kbd>\u2318K</kbd> run any of these \xB7 hold <kbd>\u2325</kbd> to see keys on screen</span></div>
    <div class="fe-km-list">${list3}</div>
  </div>`;
  }
  var toned = (tone) => ` style="--tone:${tone}"`;
  var card = (icon2, tone, title, text, how = "") => `<div class="fe-hc card"${toned(tone)}><span class="fe-hc-ico">${icon2}</span><div class="fe-hc-tx"><b>${title}</b><span>${text}</span></div>${how ? `<div class="fe-hc-how">${how}</div>` : ""}</div>`;
  var cards = (title, body) => `<section class="fe-hs"><h3 class="sect" data-level="group">${title}</h3><div class="fe-hcs">${body}</div></section>`;
  var i = (body) => line(body, 18);
  var journey = (icon2, tone, title, steps) => `<div class="fe-hj card"${toned(tone)}><div class="fe-hj-h"><span class="fe-hc-ico">${icon2}</span><b>${title}</b></div><ol class="fe-hj-steps">${steps.map(([label, id]) => {
    const k = KEYMAP.find((d) => d.id === id);
    return `<li data-key="${id}"><span>${label}</span>${k ? `<span class="fe-hc-how">${keys(k.keys)}</span>` : ""}</li>`;
  }).join("")}</ol></div>`;
  var T = { blue: "var(--nc-blue)", teal: "var(--nc-teal)", green: "var(--nc-green)", orange: "var(--nc-orange)", pink: "var(--nc-pink)", purple: "var(--nc-purple)", red: "var(--nc-red)", yellow: "var(--nc-yellow)" };
  var POINTER = i('<path d="M4 4l7 17 2.5-7.5L21 11z"/>');
  var HELP_TABS = [
    { key: "keys", label: "Keyboard", hint: "Every key, on a map", icon: UI_ICON.keyboard, tone: "var(--nc-purple)", desc: "Hover a row to see its keys. Hover a key to see what it does.", body: keyboardMap() },
    { key: "start", label: "Tour", hint: "The basics", icon: UI_ICON.ai, tone: "var(--nc-pink)", desc: "Twelve things worth knowing, and eight journeys by keyboard.", body: cards(
      "Move around",
      card(PI.folder, T.blue, "Browse", "Folders open in place.", keys(["\u21A9", "\u232B"])) + card(UI_ICON.eye, T.teal, "Preview", "Look without leaving.", keys(["Space"])) + card(UI_ICON.tab, T.green, "Tabs", "Keep places open.", keys(["t", "w"])) + card(PI.bm, T.orange, "Save", "A folder for later.", keys(["b"]))
    ) + cards(
      "Find things",
      card(PI.search, T.purple, "Filter", "Narrow this folder.", keys(["/"])) + card(UI_ICON.stack, T.pink, "Palette", "Any command or place.", keys(["\u2318K"])) + card(UI_ICON.link, T.blue, "Go to a path", "Type or paste one.", keys(["l"])) + card(PI.recent, T.teal, "History", "Where you have been.", keys(["g 4"]))
    ) + cards(
      "Make things",
      card(UI_ICON.notes, T.orange, "Notes", "Markdown, saved as you type.", keys(["n"])) + card(UI_ICON.rename, T.green, "Edit", "Any text file you allow.", keys(["e"])) + card(UI_ICON.comment, T.yellow, "Comment", "On a selection in a doc.", keys(["c"])) + card(UI_ICON.ai, T.purple, "Ask", "A model reads the file.", keys(["g 6"]))
    ) + cards(
      "Journeys, by keyboard",
      journey(UI_ICON.eye, T.teal, "Preview and sidebar", [["Preview a file", "look"], ["Dock or float it", "pv-dock"], ["Close it", "pv-close"], ["Sidebar on or off", "sidebar"]]) + journey(PI.bm, T.orange, "Saved, by tag", [["Go to Saved", "lens-saved"], ["Pick a tag", "lens-tags"], ["Filter the list", "lens-filter"], ["Preview a file", "side-look"], ["Open it as a tab", "side-open"], ["Or keep it in the background", "side-bg"]]) + journey(UI_ICON.tab, T.green, "Tabs and back", [["Focus the sidebar", "to-sidebar"], ["Open as a tab", "side-open"], ["Type a path", "path"], ["Step through tabs", "tab-step"], ["Back to the listing", "to-listing"]]) + journey(UI_ICON.link, T.blue, "Path picker", [["Type or paste a path", "path"], ["Open it as a background tab", "goto-bg"], ["All tabs", "tab-list"]]) + journey(UI_ICON.comment, T.yellow, "Comments", [["Comments panel", "fp-comments"], ["Step through threads", "fp-cm-step"], ["Comment on a selection", "fp-comment"], ["Post it", "fp-cm-post"], ["Reply", "fp-cm-reply"]]) + journey(UI_ICON.ai, T.purple, "Ask", [["Ask about the previewed file", "pv-ask"], ["Go to Ask", "lens-ask"], ["Back to the listing", "to-listing"]]) + journey(UI_ICON.notes, T.pink, "Notes", [["New note", "new-note"], ["Save", "ed-save"], ["Rename", "note-rename"], ["Colour, pin and tags", "side-props"], ["Move to .trash", "note-delete"]]) + journey(PI.gear, T.red, "Settings", [["Open Settings", "settings"], ["Next page", "dlg-tabs"], ["Next control", "dlg-fields"], ["Change a choice", "dlg-choice"]])
    ) },
    { key: "mouse", label: "Mouse", hint: "Clicks and drags", icon: i('<rect width="12" height="18" x="6" y="3" rx="6"/><path d="M12 7v4"/>'), tone: "var(--nc-blue)", desc: "The same gestures work on rows, sidebar items and tabs.", body: cards(
      "Gestures",
      card(POINTER, T.blue, "Click", "File previews, folder opens.", '<span class="fe-hc-tag">click</span>') + card(POINTER, T.teal, "Double-click", "Open the file page.", '<span class="fe-hc-tag">2\xD7</span>') + card(UI_ICON.tab, T.green, "\u2325-click", "Keep as a background tab.", "<kbd>\u2325</kbd>") + card(UI_ICON.external, T.orange, "Middle-click", "A new Chrome tab.", '<span class="fe-hc-tag">middle</span>') + card(UI_ICON.list, T.purple, "Right-click", "The item menu.", keys(["x"])) + card(UI_ICON.check, T.pink, "\u21E7 or \u2318-click", "Pick several.", "<kbd>\u21E7</kbd><kbd>\u2318</kbd>") + card(PI.drag, T.yellow, "Drag", "Reorder tabs and Saved.", '<span class="fe-hc-tag">drag</span>') + card(UI_ICON.rename, T.red, "Double-click a name", "Rename in the sidebar.", keys(["F2"]))
    ) + cards(
      "Panels",
      card(UI_ICON.preview, T.blue, "Dock the preview", "Float it, or pin it right.", keys(["d"])) + card(UI_ICON.fit, T.teal, "Resize", "Drag any edge or corner.", '<span class="fe-hc-tag">drag</span>') + card(i('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>'), T.green, "Sidebar", "Toggle, or drag its edge.", keys(["\\"]))
    ) },
    { key: "files", label: "Files", hint: "What opens as what", icon: UI_ICON.files, tone: "var(--nc-teal)", desc: "Files show as pages, with the sidebar and tabs still there.", body: cards(
      "Shown as",
      card(UI_ICON.fmtCode, T.blue, "Code", "Highlighted, numbered.") + card(UI_ICON.table, T.green, "CSV, TSV", "A sortable table.") + card(i('<path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1M16 21h1a2 2 0 0 0 2-2v-5a2 2 0 0 1 2-2 2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"/>'), T.orange, "JSON", "A tree you can fold.") + card(UI_ICON.files, T.purple, "Markdown", "Rendered, with diagrams.") + card(UI_ICON.image, T.pink, "Images", "Fit, zoom, rotate, copy.") + card(i('<path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2"/>'), T.red, "Media, PDF", "Played or embedded.")
    ) + cards(
      "On a file page",
      card(UI_ICON.contents, T.blue, "Contents", "Jump between headings.", keys(["\u21E7O"])) + card(PI.search, T.teal, "Find", "Inside this file.", keys(["/"])) + card(UI_ICON.fmtCode, T.green, "Raw", "See the source.", keys(["r"])) + card(i('<path d="M3 12h18M3 6h18M3 18h18"/>'), T.orange, "Width", "Full to narrow.", keys(["\u21E7W"]))
    ) },
    { key: "notes", label: "Notes and AI", hint: "Write, ask, comment", icon: UI_ICON.notes, tone: "var(--nc-orange)", desc: "Plain Markdown on your disk, and models that read it.", body: cards(
      "Notes",
      card(UI_ICON.add, T.orange, "New note", "Untitled until you type.", keys(["n"])) + card(UI_ICON.check, T.green, "Autosave", "A pause saves. So does \u2318S.", keys(["\u2318S"])) + card(UI_ICON.pin, T.yellow, "Pin and colour", "Pinned notes sit on top.") + card(UI_ICON.tag, T.pink, "Tags", "Filter with #tag.") + card(UI_ICON.image, T.blue, "Images", "Paste one in.") + card(UI_ICON.versions, T.purple, "Versions", "Every save, from git.")
    ) + cards(
      "AI",
      card(UI_ICON.ai, T.purple, "Ask", "Chat about a file or folder.", keys(["g 6"])) + card(UI_ICON.bot, T.green, "On this Mac", "Local models stay local.") + card(i('<path d="M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9"/>'), T.blue, "Gemini", "Sends the file to Google.")
    ) + cards(
      "Comments",
      card(UI_ICON.comment, T.yellow, "Comment", "Select words, press c.", keys(["c"])) + card(UI_ICON.at, T.teal, "Mention", "@claude answers in the file.") + card(UI_ICON.check, T.green, "Suggest", "Accept or reject edits.")
    ) },
    { key: "how", label: "How it works", hint: "The idea, and your data", icon: UI_ICON.info, tone: "var(--nc-green)", desc: "Three actions on four things.", body: cards(
      "Three actions",
      card(UI_ICON.next, T.blue, "Go", "Move to it.", keys(["\u21A9"])) + card(UI_ICON.eye, T.teal, "Look", "See it, stay put.", keys(["Space"])) + card(UI_ICON.pin, T.orange, "Keep", "Make it stay.", keys(["t", "b"]))
    ) + cards(
      "Four things",
      card(PI.folder, T.blue, "Place", "A folder.") + card(UI_ICON.file, T.green, "File", "Something in it.") + card(UI_ICON.notes, T.orange, "Note", "A file you write here.") + card(UI_ICON.list, T.purple, "View", "How a place is shown.")
    ) + cards(
      "Where things live",
      card(UI_ICON.data, T.teal, "Settings, Saved", "In this browser.") + card(UI_ICON.tab, T.pink, "Tabs", "In this Chrome tab only.") + card(UI_ICON.lock, T.green, "Your files", "Never leave the Mac, unless you ask Gemini.")
    ) }
  ];
  function wireKeyboardMap(root) {
    const km = root.querySelector(".fe-km");
    if (!km) return;
    const caps = [...km.querySelectorAll(".fe-km-cap")];
    const rows = [...km.querySelectorAll(".fe-km-i")];
    const q = km.querySelector(".fe-km-q");
    let pinned = null;
    const light = (ids) => caps.forEach((c) => c.classList.toggle("hl", ids.includes(c.dataset.cap)));
    const filter = () => {
      const s = q.value.trim().toLowerCase();
      rows.forEach((r) => {
        const hit = (!s || r.dataset.q.includes(s)) && (!pinned || r.dataset.caps.split(" ").includes(pinned));
        r.hidden = !hit;
      });
      km.querySelectorAll(".fe-km-g").forEach((g) => {
        g.hidden = !g.querySelector(".fe-km-i:not([hidden])");
      });
      caps.forEach((c) => c.classList.toggle("pin", c.dataset.cap === pinned));
    };
    km.addEventListener("mouseover", (e) => {
      const row2 = e.target.closest(".fe-km-i");
      const cap = e.target.closest(".fe-km-cap");
      if (row2) {
        light(row2.dataset.caps.split(" "));
        rows.forEach((r) => r.classList.toggle("on", r === row2));
      } else if (cap) {
        light([cap.dataset.cap]);
        rows.forEach((r) => r.classList.toggle("on", r.dataset.caps.split(" ").includes(cap.dataset.cap)));
      }
    });
    km.addEventListener("mouseleave", () => {
      light([]);
      rows.forEach((r) => r.classList.remove("on"));
    });
    km.addEventListener("click", (e) => {
      const cap = e.target.closest(".fe-km-cap.used");
      if (!cap) return;
      pinned = pinned === cap.dataset.cap ? null : cap.dataset.cap;
      filter();
    });
    q.addEventListener("input", filter);
    q.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && (q.value || pinned)) {
        e.stopPropagation();
        q.value = "";
        pinned = null;
        filter();
      }
    });
  }

  // src/controls.ts
  function segHtml(id, opts, title, size = "md") {
    return `<div class="fe-seg" id="${id}"${size === "md" ? "" : ` data-size="${size}"`} role="radiogroup" aria-label="${esc(title)}" title="${esc(title)}">${opts.map((o) => `<button type="button" role="radio" class="fe-seg-b${o.label ? "" : " ico"}" data-v="${esc(o.value)}" aria-checked="false" tabindex="-1" title="${esc(o.hint ?? o.label ?? o.value)}"${o.label ? "" : ` aria-label="${esc(o.hint ?? o.value)}"`}>${o.icon ?? ""}${o.label ? `<span>${esc(o.label)}</span>` : ""}</button>`).join("")}</div>`;
  }
  function sliderHtml(id, values, unit, title, names) {
    return `<div class="fe-sld" id="${id}" data-values="${values.join(",")}" data-unit="${esc(unit)}"${names ? ` data-names="${esc(names.join("|"))}"` : ""} title="${esc(title)}">
    <input type="range" min="0" max="${values.length - 1}" step="1" aria-label="${esc(title)}" title="${esc(title)}">
    <output></output>
  </div>`;
  }
  function ddHtml(id, opts, title, size = "md") {
    return `<div class="fe-dd" id="${id}"${size === "md" ? "" : ` data-size="${size}"`} data-opts="${esc(JSON.stringify(opts))}">
    <button type="button" class="fe-dd-btn" aria-haspopup="listbox" aria-expanded="false" title="${esc(title)}"><span class="fe-dd-cur"></span>${CHEVRON_DOWN}</button>
  </div>`;
  }
  function checkHtml2(id, label, title, checked = false) {
    return `<label class="fe-check" title="${esc(title)}"><input type="checkbox" id="${id}"${checked ? " checked" : ""}><span>${esc(label)}</span></label>`;
  }
  function switchHtml(o) {
    return `<input type="checkbox" role="switch" class="fe-switch${o.small ? " sm" : ""}${o.cls ? " " + o.cls : ""}"${o.id ? ` id="${o.id}"` : ""} title="${esc(o.title)}" aria-label="${esc(o.label ?? o.title)}"${o.checked ? " checked" : ""}>`;
  }
  function chipsHtml(id, placeholder, title) {
    return `<div class="fe-chipin" id="${id}" title="${esc(title)}"><input class="fe-chipin-in" placeholder="${esc(placeholder)}" spellcheck="false" aria-label="${esc(title)}"></div>`;
  }
  var fire = (host) => host.dispatchEvent(new Event("change", { bubbles: true }));
  function upgradeSeg(host) {
    const btns = [...host.querySelectorAll(".fe-seg-b")];
    let cur = "";
    const paint = () => btns.forEach((b) => {
      const on = b.dataset.v === cur;
      b.classList.toggle("on", on);
      b.setAttribute("aria-checked", String(on));
      b.tabIndex = on || !cur && b === btns[0] ? 0 : -1;
    });
    Object.defineProperty(host, "value", { get: () => cur, set: (v) => {
      cur = String(v);
      paint();
    } });
    btns.forEach((b) => b.addEventListener("click", () => {
      if (cur !== b.dataset.v) {
        cur = b.dataset.v;
        paint();
        fire(host);
      }
    }));
    rovingFocus(host, ".fe-seg-b", { axis: "both", onMove: (b) => b.click() });
    paint();
  }
  function upgradeSlider(host) {
    const values = host.dataset.values.split(",").map(Number);
    const unit = host.dataset.unit ?? "";
    const names = host.dataset.names?.split("|");
    const range = host.querySelector("input");
    const out = host.querySelector("output");
    const show = () => {
      const v = values[Number(range.value)];
      out.textContent = names?.[Number(range.value)] ?? `${v}${unit}`;
      if (names) range.setAttribute("aria-valuetext", out.textContent);
      host.style.setProperty("--pct", `${Number(range.value) / (values.length - 1) * 100}%`);
    };
    Object.defineProperty(host, "value", {
      get: () => String(values[Number(range.value)]),
      set: (v) => {
        const n = Number(v);
        let best = 0;
        values.forEach((x, i3) => {
          if (Math.abs(x - n) < Math.abs(values[best] - n)) best = i3;
        });
        range.value = String(best);
        show();
      }
    });
    range.addEventListener("input", () => {
      show();
      host.dispatchEvent(new Event("input", { bubbles: true }));
    });
    range.addEventListener("change", (e) => {
      e.stopPropagation();
      fire(host);
    });
    show();
  }
  var list = null;
  var closeList = null;
  function upgradeDd(host) {
    const btn = host.querySelector(".fe-dd-btn");
    const curEl = host.querySelector(".fe-dd-cur");
    let opts = JSON.parse(host.dataset.opts || "[]");
    let cur = "";
    const paint = () => {
      host.dataset.value = cur;
      const o = opts.find((x) => x.value === cur);
      curEl.innerHTML = o ? `${o.icon ?? ""}<span>${esc(o.label ?? o.value)}</span>` : cur ? `<span>${esc(cur)}</span>` : '<span class="fe-dd-none">None</span>';
    };
    Object.defineProperty(host, "value", { get: () => cur, set: (v) => {
      cur = String(v);
      paint();
    } });
    host.setOptions = (o) => {
      opts = o;
      host.dataset.opts = JSON.stringify(o);
      paint();
    };
    let keys2 = null;
    function open() {
      closeList?.();
      list = document.createElement("div");
      list.className = "fe-dd-list";
      const optHtml = (o) => `<div role="option" class="row fe-dd-opt${o.value === cur ? " on" : ""}" data-v="${esc(o.value)}" aria-selected="${o.value === cur}">${o.icon ?? ""}<span class="fe-dd-l">${esc(o.label ?? o.value)}</span>${o.hint ? `<span class="fe-dd-h">${esc(o.hint)}</span>` : ""}</div>`;
      const groups = [...new Set(opts.map((o) => o.group ?? ""))];
      list.innerHTML = groups.map((g) => {
        const inner = opts.filter((o) => (o.group ?? "") === g).map(optHtml).join("");
        return g ? `<div role="group" aria-label="${esc(g)}"><div class="fe-dd-g" aria-hidden="true">${esc(g)}</div>${inner}</div>` : inner;
      }).join("");
      list.style.minWidth = `${btn.getBoundingClientRect().width}px`;
      const layer = openLayer(list, { kind: "popover", anchor: btn, align: "end", role: "listbox", group: "menu", onClose: () => {
        keys2 = null;
        list = null;
        closeList = null;
      } });
      if (!layer.open) return;
      const items = [...list.querySelectorAll(".fe-dd-opt")];
      let at = Math.max(0, items.findIndex((i3) => i3.dataset.v === cur));
      const mark = () => {
        items.forEach((it, i3) => it.classList.toggle("kb", i3 === at));
        items[at]?.scrollIntoView({ block: "nearest" });
      };
      mark();
      const pick = (v) => {
        const changed = v !== cur;
        cur = v;
        paint();
        layer.close("pick");
        btn.focus();
        if (changed) fire(host);
      };
      list.addEventListener("click", (e) => {
        const it = e.target.closest(".fe-dd-opt");
        if (it) pick(it.dataset.v);
      });
      list.addEventListener("mousemove", (e) => {
        const it = e.target.closest(".fe-dd-opt");
        if (it) {
          at = items.indexOf(it);
          mark();
        }
      });
      let typed = "", typedAt = 0;
      keys2 = (e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          at = (at + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
          mark();
        } else if (e.key === "Home" || e.key === "End") {
          at = e.key === "Home" ? 0 : items.length - 1;
          mark();
        } else if (e.key === "Enter" || e.key === " " && !(typed && Date.now() - typedAt < 700)) {
          if (items[at]) pick(items[at].dataset.v);
        } else if (e.key === "Tab") {
          layer.close("blur");
          return;
        } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
          typed = Date.now() - typedAt > 700 ? e.key.toLowerCase() : typed + e.key.toLowerCase();
          typedAt = Date.now();
          const hit = items.findIndex((it) => (it.querySelector(".fe-dd-l")?.textContent ?? "").toLowerCase().startsWith(typed));
          if (hit >= 0) {
            at = hit;
            mark();
          }
        } else return;
        e.preventDefault();
        e.stopPropagation();
      };
      closeList = () => layer.close("api");
    }
    btn.addEventListener("click", () => {
      if (btn.getAttribute("aria-expanded") === "true") closeList?.();
      else open();
    });
    btn.addEventListener("keydown", (e) => {
      if (keys2) keys2(e);
      else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        open();
      }
    });
    paint();
  }
  function upgradeChips(host) {
    const input = host.querySelector(".fe-chipin-in");
    let items = [];
    const paint = () => {
      host.dataset.value = items.join(", ");
      host.querySelectorAll(".chip").forEach((c) => c.remove());
      input.insertAdjacentHTML("beforebegin", items.map((t, i3) => `<span class="chip" data-fill data-mono><span>${esc(t)}</span><button type="button" class="btn" data-icon data-size="xs" data-tone="danger" data-i="${i3}" title="Remove ${esc(t)}" aria-label="Remove ${esc(t)}">${UI_ICON.close}</button></span>`).join(""));
    };
    const commit = () => {
      const add = input.value.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean);
      input.value = "";
      if (!add.length) return;
      items = [...items, ...add.filter((a) => !items.includes(a))];
      paint();
      fire(host);
    };
    Object.defineProperty(host, "value", {
      get: () => items.join(", "),
      set: (v) => {
        items = String(v).split(",").map((x) => x.trim()).filter(Boolean);
        paint();
      }
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        commit();
      } else if (e.key === "Backspace" && !input.value && items.length) {
        items.pop();
        paint();
        fire(host);
      }
    });
    input.addEventListener("blur", commit);
    input.addEventListener("change", (e) => e.stopPropagation());
    host.addEventListener("click", (e) => {
      const b = e.target.closest(".chip button");
      if (b) {
        items.splice(Number(b.dataset.i), 1);
        paint();
        fire(host);
        input.focus();
      } else if (e.target === host) input.focus();
    });
  }
  function upgradeControls(root = document) {
    root.querySelectorAll(".fe-seg:not([data-up])").forEach((h) => {
      h.dataset.up = "1";
      upgradeSeg(h);
    });
    root.querySelectorAll(".fe-sld:not([data-up])").forEach((h) => {
      h.dataset.up = "1";
      upgradeSlider(h);
    });
    root.querySelectorAll(".fe-dd:not([data-up])").forEach((h) => {
      h.dataset.up = "1";
      upgradeDd(h);
    });
    root.querySelectorAll(".fe-chipin:not([data-up])").forEach((h) => {
      h.dataset.up = "1";
      upgradeChips(h);
    });
  }

  // src/settings-page.ts
  var row = (label, desc, ctl, attrs = "") => `<div class="fe-set"${attrs}><div class="fe-set-tx"><span class="fe-set-l">${label}</span>${desc ? `<span class="fe-set-d">${desc}</span>` : ""}</div><div class="fe-set-c">${ctl}</div></div>`;
  var wide = (label, desc, ctl) => `<div class="fe-set wide"><div class="fe-set-tx"><span class="fe-set-l">${label}</span>${desc ? `<span class="fe-set-d">${desc}</span>` : ""}</div><div class="fe-set-c">${ctl}</div></div>`;
  var card2 = (title, rows, action = "") => `<section class="fe-set-group"><h3 class="sect fe-set-h" data-level="group"><span>${title}</span>${action}</h3><div class="fe-set-card card">${rows}</div></section>`;
  var sw = (id, title) => switchHtml({ id, title });
  var iconBtn = (id, icon2, title) => `<button type="button" id="${id}" class="btn fe-ibtn" data-icon title="${title}" aria-label="${title}">${icon2}</button>`;
  var note = (text, id = "") => `<p class="fe-set-note"${id ? ` id="${id}"` : ""}>${text}</p>`;
  var thumb = (group, value, name, kind) => `<label class="fe-set-sw" title="${name}"><input type="radio" name="${group}" value="${value}" title="${name}"><span class="fe-set-thumb" data-${kind}="${value}"><i class="sb"></i><i class="r1"></i><i class="r2"></i><i class="pill"></i></span><span>${name}</span></label>`;
  var PALETTE_NAMES = [
    ["slate", "Slate"],
    ["violet", "Violet"],
    ["sand", "Sand"],
    ["ink", "Ink"],
    ["ocean", "Ocean"],
    ["forest", "Forest"],
    ["ember", "Ember"],
    ["nord", "Nord"]
  ];
  var i2 = (body) => line(body, 14);
  var SORT_OPTS = [
    { value: "", label: "As listed", icon: i2('<path d="M3 6h18M3 12h18M3 18h18"/>') },
    { value: "name", label: "Name", icon: i2('<path d="M4 18 8 6l4 12M5.5 14h5M15 6h5l-5 12h5"/>') },
    { value: "date", label: "Modified", icon: i2('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>') },
    { value: "size", label: "Size", icon: i2('<path d="M3 20h18M6 20v-5M10 20V9M14 20v-8M18 20V4"/>') },
    { value: "type", label: "Type", icon: i2('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h6"/>') },
    { value: "ext", label: "Extension", icon: i2('<path d="M4 7V5h16v2M9 19h6M12 5v14"/>') }
  ];
  var SORT_DIR_OPTS = [
    { value: "asc", icon: i2('<path d="M12 19V5M5 12l7-7 7 7"/>'), hint: "Ascending" },
    { value: "desc", icon: i2('<path d="M12 5v14M19 12l-7 7-7-7"/>'), hint: "Descending" }
  ];
  var GROUP_OPTS = [
    { value: "none", label: "None", icon: i2('<path d="M3 6h18M3 12h18M3 18h18"/>') },
    { value: "folders-first", label: "Folders first", icon: i2('<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/>') },
    { value: "files-first", label: "Files first", icon: i2('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/>') },
    { value: "ext", label: "By extension", icon: i2('<path d="M4 7V5h16v2M9 19h6M12 5v14"/>') },
    { value: "type", label: "By type", icon: i2('<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/>') }
  ];
  var TERM_OPTS = [
    { value: "ghostty", label: "Ghostty" },
    { value: "terminal", label: "Terminal" },
    { value: "iterm", label: "iTerm2" },
    { value: "wezterm", label: "WezTerm" },
    { value: "kitty", label: "Kitty" },
    { value: "custom", label: "Custom", hint: "your own command" }
  ].map((o) => ({ ...o, icon: UI_ICON.terminal }));
  function settingsDialog() {
    return {
      id: "fe-settings-modal",
      mark: PI.gear,
      title: "Settings",
      subtitle: "Kept in this browser",
      tabs: [
        { key: "look", label: "Look", hint: "Theme, colour, size", icon: UI_ICON.appearance, tone: "var(--nc-pink)", desc: "Theme, colours, icon and size.", body: card2(
          "Theme",
          row("Mode", "", `<div class="fe-set-sws">${thumb("bfb-theme", "dark", "Dark", "mode") + thumb("bfb-theme", "light", "Light", "mode") + thumb("bfb-theme", "system", "System", "mode")}</div>`) + row("Palette", "", `<div class="fe-set-sws grid4">${PALETTE_NAMES.map(([v, n]) => thumb("bfb-palette", v, n, "p")).join("")}</div>`)
        ) + card2(
          "App icon",
          wide("", "Shows in the tab and in an installed app window", `<div class="fe-appicons" role="radiogroup" aria-label="App icon">${APP_ICONS.map((a) => `<label class="fe-appicon" title="${a.name}"><input type="radio" name="bfb-appicon" value="${a.id}" aria-label="${a.name}" title="${a.name}"><img alt="" data-src="assets/app-icons/${a.file}"><span>${a.name}</span></label>`).join("")}</div>`)
        ) + card2(
          "Size",
          row("Interface", "Everything", sliderHtml("fe-st-uiscale", [80, 90, 100, 110, 125, 150], "%", "Interface size")) + row("Text", "Lists, sidebar, pages", sliderHtml("fe-st-rd-size", [12, 13, 14, 15, 16, 17, 18], " px", "Text size")) + row("Density", "", segHtml("fe-st-density", [
            { value: "roomy", label: "Roomy", icon: i2('<path d="M3 5h18M3 12h18M3 19h18"/>') },
            { value: "compact", label: "Compact", icon: i2('<path d="M3 7h18M3 11h18M3 15h18M3 19h18"/>') }
          ], "Row spacing", "lg"))
        ) + card2(
          "Help",
          row("Tooltips", "Labels on hover", sw("fe-st-tooltips", "Tooltips on every control")) + row("Keyboard", "Every key, on a map", `<button id="fe-st-keys" class="btn" data-size="lg" title="Open the keyboard map">${UI_ICON.keyboard}Keys</button>`)
        ) },
        { key: "folders", label: "Folders", hint: "View, order, sidebar", icon: UI_ICON.folderOpen, tone: "var(--nc-blue)", desc: "How folders open, and what a click does.", body: card2(
          "Opening a folder",
          row("View", "", segHtml("fe-st-defview", VIEW_ICONS.map((v) => ({ value: v.id, icon: v.ico, hint: v.label })), "View a folder opens in", "lg")) + row("Sort", "", ddHtml("fe-st-sort", SORT_OPTS, "Order a folder opens in", "lg") + segHtml("fe-st-sort-dir", SORT_DIR_OPTS, "Direction", "lg")) + row("Group", "", ddHtml("fe-st-group", GROUP_OPTS, "Grouping a folder opens with", "lg")) + row("Dates", "", segHtml("fe-st-datefmt", [{ value: "short", label: "Apr 17" }, { value: "full", label: "April 17, 2025" }], "How dates read", "lg"))
        ) + card2(
          "Opening a file",
          row("Click a file", "", segHtml("fe-st-click", [
            { value: "look", label: "Preview", icon: UI_ICON.eye },
            { value: "go", label: "Open", icon: UI_ICON.external }
          ], "What a click on a file does", "lg")) + row("Preview", "", segHtml("fe-st-panel", [
            { value: "modal", label: "Float", icon: i2('<rect width="14" height="12" x="5" y="6" rx="2"/>') },
            { value: "side", label: "Dock", icon: UI_ICON.preview }
          ], "Where the preview opens", "lg") + iconBtn("fe-st-panel-reset", UI_ICON.reset, "Reset dragged sizes"))
        ) + card2(
          "Sidebar",
          row("Sidebar", "", sw("fe-st-sidebar", "Show the sidebar")) + row("Make room for a docked preview", "Fold the sidebar while a docked preview is open", sw("fe-st-dock-fold", "Fold the sidebar for a docked preview")) + row("History", "Recent places and closed tabs", sw("fe-st-sec-recent", "Show the History lens"))
        ) + card2(
          "Terminal",
          row("Open in", "", ddHtml("fe-st-terminal", TERM_OPTS, "Terminal app", "lg")) + row("Command", "${p} is the folder", `<input type="text" id="fe-st-term-custom" class="tb fe-st-input" data-size="lg" placeholder='open -a MyTerm "\${p}"' spellcheck="false" title='Shell command. \${p} is the folder.'>`, ' id="fe-st-term-custom-row" style="display:none"') + note("", "fe-st-term-hint")
        ) },
        { key: "files", label: "Files", hint: "Pages, icons", icon: UI_ICON.files, tone: "var(--nc-teal)", desc: "Reading, file pages and icons.", body: card2(
          "Reading",
          row("Width", "Markdown pages", segHtml("fe-st-rd-column", [
            { value: "unset", label: "Full" },
            { value: "xl", label: "Wide" },
            { value: "lg", label: "Medium" },
            { value: "md", label: "Narrow" }
          ], "Reading width", "lg")) + row("Line height", "", sliderHtml("fe-st-rd-lh", [1.4, 1.5, 1.65, 1.8, 2], "", "Line height")) + row("Code", "", sliderHtml("fe-st-rd-code", [11, 12, 13, 14, 15, 16], " px", "Code size")) + row("Wrap lines", "Raw text and code", sw("fe-st-wrap", "Wrap long lines"))
        ) + card2(
          "File pages",
          row("Pages for", "", segHtml("fe-st-filepages", [
            { value: "all", label: "All text" },
            { value: "not-md", label: "Not .md" },
            { value: "off", label: "Off" }
          ], "Which files open as pages", "lg")) + row("Chrome opens", "In its own viewer", chipsHtml("fe-st-excluded-exts", ".ext", "Extensions Chrome opens itself") + iconBtn("fe-st-excluded-reset", UI_ICON.reset, "Restore .pdf .html .htm"))
        ) + card2(
          "Icon rules",
          `
          <div class="fe-rule-sugg" id="fe-st-rule-sugg"></div>
          <div id="fe-st-rules-list"></div>`,
          `<span class="sect-acts">${iconBtn("fe-st-reset-rules", UI_ICON.reset, "Reset to the built-in rules")}<button id="fe-st-add-rule" class="btn" data-size="sm" title="Add a rule">${UI_ICON.add}Rule</button></span>`
        ) },
        { key: "notes", label: "Notes", hint: "Notes, editing", icon: UI_ICON.notes, tone: "var(--nc-orange)", desc: "Your notes folder, and where you can edit.", body: card2(
          "Notes",
          row("Folder", "Markdown files", `<input type="text" id="fe-st-notes-root" class="tb fe-st-input" data-size="lg" placeholder="~/Notes" spellcheck="false" title="Notes folder">${iconBtn("fe-st-notes-pick", UI_ICON.folderOpen, "Choose a folder")}`) + note("", "fe-st-notes-hint")
        ) + card2(
          "Editing",
          wide("Editable folders", "Text files inside get Edit (e). Saves keep a 14-day backup.", chipsHtml("fe-st-edit-roots", "~/Code", "Folders you can edit in"))
        ) },
        { key: "ai", label: "AI", hint: "Models", icon: UI_ICON.ai, tone: "var(--nc-purple)", desc: "Models that answer in Ask and the preview.", body: `
        <div id="fe-st-ai-card" class="fe-ai-hero">
          <span class="fe-st-ai-head"><span class="fe-st-ai-blink"><span class="dot"></span></span></span>
          <div class="fe-ai-hero-tx"><b class="fe-st-ai-state">Checking\u2026</b><span id="fe-st-ai-sub"></span></div>
          ${iconBtn("fe-st-ai-refresh", UI_ICON.reset, "Check again")}
        </div>` + card2(
          "On this Mac",
          row("Model", "", ddHtml("fe-st-ai-model", [], "Local model", "lg")) + row("Keep warm", "Replies start at once", sw("fe-st-ai-warm", "Keep the model loaded")) + `<div class="fe-st-ai-grid" id="fe-st-ai-grid"></div>` + note("", "fe-st-ai-hint")
        ) + card2("Ask can use", `<div class="fe-ai-models" id="fe-st-ai-models"><p class="fe-set-note">Loading\u2026</p></div>`) },
        { key: "data", label: "Data", hint: "Export, import", icon: UI_ICON.data, tone: "var(--nc-green)", desc: "Move your settings and Saved list.", body: card2(
          "Your data",
          row("Export", "Copies JSON", `<button id="fe-st-export" class="btn" data-size="lg" title="Copy everything as JSON">${UI_ICON.export}Export</button>`) + row("Import", "Then reloads", `<button id="fe-st-import" class="btn" data-size="lg" title="Load a JSON export">${UI_ICON.import}Import</button><input type="file" id="fe-st-import-file" accept="application/json" style="display:none">`) + `<textarea id="fe-st-export-out" class="tb fe-st-input" style="display:none;width:100%;height:120px;font:var(--fs-sm) var(--mono)" spellcheck="false" title="The export, also on the clipboard"></textarea>`
        ) }
      ]
    };
  }

  // src/find.ts
  var EMPTY_FIND = { scope: "here", name: "", regex: false, exts: [], text: "", caseSensitive: false, textRegex: false, maxDepth: 8 };
  function isEmptyFind(q) {
    return q.scope === "here" && !q.name && !q.exts.length && !q.kind && !q.text;
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
    let lineStart2 = 0, lineNumber = 1;
    while (lineStart2 <= text.length) {
      const breakAt = text.indexOf("\n", lineStart2);
      const end = breakAt < 0 ? text.length : breakAt;
      const line3 = text.slice(lineStart2, end);
      if (pattern) {
        pattern.lastIndex = 0;
        let match;
        while (match = pattern.exec(line3)) {
          count++;
          if (!first) first = { line: line3, at: match.index, length: match[0].length, number: lineNumber };
          if (!match[0].length) {
            const codePoint = line3.codePointAt(pattern.lastIndex);
            pattern.lastIndex += codePoint !== void 0 && codePoint > 65535 ? 2 : 1;
          }
        }
      } else {
        const hay = q.caseSensitive ? line3 : line3.toLowerCase();
        for (let at = hay.indexOf(needle); at >= 0; at = hay.indexOf(needle, at + Math.max(1, needle.length))) {
          count++;
          if (!first) first = { line: line3, at, length: q.text.length, number: lineNumber };
        }
      }
      if (breakAt < 0) break;
      lineStart2 = breakAt + 1;
      lineNumber++;
    }
    if (!first) return null;
    const from = Math.max(0, first.at - 60);
    const to = Math.min(first.line.length, from + 180);
    const line2 = (from ? "\u2026" : "") + first.line.slice(from, to) + (to < first.line.length ? "\u2026" : "");
    const start = first.at - from + (from ? 1 : 0);
    return { count, line: line2, start, end: Math.min(line2.length, start + first.length), lineNumber: first.number };
  }
  async function searchContents(files, read2, q, onProgress, isCancelled = () => false, concurrency = 4, match = async (text, query) => scanContent(text, query)) {
    const hits = /* @__PURE__ */ new Map();
    let scanned = 0, failed = 0, next = 0;
    const worker = async () => {
      while (next < files.length && !isCancelled()) {
        const f = files[next++];
        try {
          const text = await read2(f.href);
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
      return { ...EMPTY_FIND, ...q, exts: Array.isArray(q.exts) ? q.exts : [], kind: q.kind === "folders" || q.kind === "files" ? q.kind : void 0, maxDepth: [1, 2, 4, 8].includes(q.maxDepth) ? q.maxDepth : 8 };
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
    if (q.kind) bits.push(q.kind === "folders" ? "folders" : "files");
    if (q.exts.length) bits.push("." + q.exts.join(" ."));
    if (q.text) bits.push(q.textRegex ? `/${q.text}/` : `"${q.text}"`);
    const what = bits.join(" ") || "everything";
    return q.scope === "deep" ? `${what} in subfolders` : what;
  }

  // src/render.ts
  function commentBadge(e, ctx) {
    const n = e.isDir || e.isParent ? 0 : ctx.openComments?.(e.name) ?? 0;
    return n ? `<span class="badge fe-row-cm" title="${n} open comment${n === 1 ? "" : "s"}">${UI_ICON.comment}${n}</span>` : "";
  }
  var CHIPS_SHOWN = 2;
  function tagChips(e, ctx) {
    if (e.isParent || !ctx.tagsOf) return "";
    const tags = ctx.tagsOf(fullPath(ctx.rawPath, e));
    const shown = tags.length > CHIPS_SHOWN + 1 ? tags.slice(0, CHIPS_SHOWN) : tags;
    const rest = tags.slice(shown.length);
    if (!tags.length) return "";
    return '<div class="fe-chips">' + shown.map((t) => `<span class="chip" data-size="sm" style="--chip:${esc(t.color)}" title="Tag: ${esc(t.name)}"><span>${esc(t.name)}</span></span>`).join("") + (rest.length ? `<span class="chip fe-chip-more" data-size="sm" title="Also tagged: ${esc(rest.map((t) => t.name).join(", "))}">+${rest.length}</span>` : "") + "</div>";
  }
  function buildTipData(e, ctx) {
    if (e.isParent) {
      return JSON.stringify({ icon: "", name: "Parent Directory", lines: ["Navigate up one level"] });
    }
    const fp = fullPath(ctx.rawPath, e);
    const lines = [`Path: ${fp}`, `Type: ${fmtType(e)}`];
    if (!e.isDir) lines.push(`Size: ${fmtSize(e.rawBytes)}`);
    lines.push(`Modified: ${fmtDate(e.dateMs, ctx.settings, e.dateStr)}`);
    if (e.isHidden) lines.push(e.name.startsWith(".") ? "Hidden file (dotfile)" : "Comments on " + e.name.replace(/\.bfb[^./]*\.json$/, ""));
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
    const pvBtn = canPreview(e) ? `<button class="btn fe-act-btn fe-act-pv" data-icon data-size="sm" data-variant="surface" title="Preview (Space)" data-pv="${dName}">
        <svg width="12" height="12" viewBox="0 0 13 13"><path d="M1 6.5C2.5 3 4.8 1.5 6.5 1.5S10.5 3 12 6.5C10.5 10 8.2 11.5 6.5 11.5S2.5 10 1 6.5z" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="6.5" cy="6.5" r="2" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
      </button>` : "";
    return `<span class="fe-acts" data-path="${dPath}" data-name="${dName}">
    ${pvBtn}<button class="btn fe-act-btn fe-act-cp" data-icon data-size="sm" data-variant="surface" title="Copy full path" data-copy="${dPath}">
      <svg width="11" height="12" viewBox="0 0 11 12"><rect x="3" y="3" width="7" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M1 1h6v1" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
    </button>
    <button class="btn fe-act-btn fe-act-nm" data-icon data-size="sm" data-variant="surface" title="Copy name" data-copy="${dName}">
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
             ${e.isParent ? "" : `data-tip="${esc(tipData)}"`}>
    <td class="c-nm"><a href="${esc(e.href)}" class="fe-lnk">${getIcon(e, ctx.iconRules)}<span class="fe-nm">${esc(e.isParent ? "Parent Directory" : e.name)}</span>${commentBadge(e, ctx)}</a>${hit ? renderHitSnippet(hit) + `<span class="badge fe-find-badge">${hit.count}</span>` : ""}${itemActions(e, ctx.rawPath)}</td>
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
    ${hit ? `<span class="badge fe-find-badge">${hit.count}</span>${renderHitSnippet(hit)}` : ""}
    ${!e.isDir && !e.isParent ? `<span class="fe-tile-sz">${fmtSize(e.rawBytes)}</span>` : ""}
    ${e.isParent ? "" : `<span class="fe-tile-meta"><span class="fe-tile-tp">${fmtType(e)}</span><span class="fe-tile-dt">${fmtDate(e.dateMs, ctx.settings, e.dateStr)}</span><span class="fe-tile-tags">${tagChips(e, ctx)}${commentBadge(e, ctx)}</span></span>`}
    ${itemActions(e, ctx.rawPath)}
  </a>`;
  }
  function renderRows(entries, ctx, start = 0) {
    return entries.map((e, i3) => renderRow(e, ctx, start + i3)).join("");
  }
  function renderTiles(entries, ctx, start = 0) {
    return entries.map((e, i3) => renderTile(e, ctx, start + i3)).join("");
  }
  var savedFileExt = (path) => path.endsWith("/") ? "" : path.split("/").pop().match(/\.([^.]+)$/)?.[1].toLowerCase() ?? "";
  function renderSavedList(saved, tags, rawPath, filter = "", folded = /* @__PURE__ */ new Set(), hits = /* @__PURE__ */ new Map()) {
    if (!saved.length) return emptyHtml("empty", "Nothing saved yet", { inline: true, hint: "Click \u2606 in the path bar, or + to name this folder" });
    const byName = filterSaved(saved, filter);
    saved = saved.filter((p) => byName.includes(p) || hits.has(p.path));
    if (!saved.length) return emptyHtml("filtered", "No saved item matches", { inline: true, actions: [CLEAR] });
    const VIEW_ICON = `<svg width="14" height="14" viewBox="0 0 14 14"><path d="M1.5 2h11l-4.2 5v4.5l-2.6-1.3V7z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>`;
    const row2 = (p) => {
      const n = p.tags?.length ?? 0, hit = hits.get(p.path);
      return `
    <div class="row fe-bm-item fe-pl-item${isViewPath(p.path) ? " fe-view" : ""}" draggable="true" data-path="${esc(p.path)}">
      <span class="fe-drag-h" aria-hidden="true">${PI.drag}</span>
      <a href="${isViewPath(p.path) ? "file://" + esc(p.path) : fileHref(p.path)}" class="fe-si-link${samePlace(p.path, rawPath) ? ' active" aria-current="page' : ""}">
        ${isViewPath(p.path) ? VIEW_ICON : savedFileExt(p.path) ? icoFile(savedFileExt(p.path)) : PI.folder}<span class="fe-sl fe-pl-label">${esc(p.label || p.path.split("/").filter(Boolean).pop() || "/")}</span>
        ${n ? `<span class="fe-pl-meta">${UI_ICON.tag}${n}</span>` : ""}
      </a>${hit ? `<span class="fe-pl-hit">${esc(hit)}</span>` : ""}
      <span class="fe-pl-tags" title="Tags, comma separated"></span>
      <button class="btn fe-tag-btn" data-icon data-size="sm" data-path="${esc(p.path)}" title="Edit tags" aria-label="Edit tags">${UI_ICON.tag}</button>
      <button class="btn fe-rm-btn" data-icon data-size="sm" data-tone="danger" data-path="${esc(p.path)}" title="Remove from Saved" aria-label="Remove from Saved">${UI_ICON.close}</button>
    </div>`;
    };
    return groupByTag(saved, tags).map((g) => {
      if (!g.tag) return g.items.map(row2).join("");
      const open = filter.trim() || !folded.has(g.tag.name) ? " open" : "";
      return `<details class="fe-grp" data-tag="${esc(g.tag.name)}"${open}>
      <summary class="sect fe-sv-tag" data-level="group">${DISCLOSE}<i class="fe-sv-dot" data-tag="${esc(g.tag.name)}" style="background:${esc(g.tag.color)}" title="Click to change colour"></i>${esc(g.tag.name)}<span class="fe-grp-n">${g.items.length}</span></summary>
      <div class="fe-grp-body">${g.items.map(row2).join("")}</div>
    </details>`;
    }).join("");
  }
  function renderCrumbs(rawPath, segments, trailing = false, home = "") {
    const crumbs = [{ label: "/", href: "file:///" }];
    let acc = "/";
    for (const seg of segments) {
      acc += seg + "/";
      crumbs.push({ label: seg, href: fileHref(acc) });
    }
    const homeAt = home && (acc === home + "/" || acc.startsWith(home + "/")) ? home.split("/").length - 1 : -1;
    return crumbs.map((c, i3) => {
      const last = i3 === crumbs.length - 1, where = esc(decodeURIComponent(c.href.slice(7)));
      const end = last && !trailing;
      const label = i3 === homeAt ? "~" : c.label;
      const pre = i3 < homeAt ? " data-pre hidden" : "";
      return `<span class="fe-cg" data-i="${i3}"${pre}><a href="${esc(c.href)}" class="fe-crumb${end ? " cur" : ""}" title="Go to ${where}">${esc(label)}</a><button class="btn fe-crumb-dd" data-url="${esc(c.href)}" title="What is in ${where}" aria-label="What is in ${where}">${end ? CHEVRON_DOWN : CHEVRON_RIGHT}</button></span>`;
    }).join("");
  }

  // src/page.ts
  var SORT_ICON = line('<path d="m3 16 4 4 4-4M7 20V4M11 4h10M11 8h7M11 12h4"/>', 14);
  var PI_FOLDER = '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/>';
  var STAR = '<path d="M11.53 2.3a.53.53 0 0 1 .94 0l2.31 4.68a2.12 2.12 0 0 0 1.6 1.16l5.16.76a.53.53 0 0 1 .3.9l-3.74 3.64a2.12 2.12 0 0 0-.61 1.88l.88 5.14a.53.53 0 0 1-.77.56l-4.62-2.43a2.12 2.12 0 0 0-1.97 0L6.4 21.01a.53.53 0 0 1-.77-.56l.88-5.14a2.12 2.12 0 0 0-.61-1.88L2.16 9.8a.53.53 0 0 1 .3-.9l5.16-.76a2.12 2.12 0 0 0 1.6-1.16z"/>';
  function placesHTML(home, rawPath) {
    const places = [
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
      ].map((p) => ({ label: p.label, icon: p.icon, href: fileHref(home + "/" + p.sub) })) : [],
      { label: "Applications", icon: "apps", href: "file:///Applications/" },
      { label: "Root /", icon: "root", href: "file:///" }
    ];
    return places.map(
      (p) => `<a href="${p.href}" class="row fe-si${p.href.replace(/\/$/, "") === fileHref(rawPath).replace(/\/$/, "") ? ' active" aria-current="page' : ""}" title="${esc(p.label)}
${esc(p.href)}">${PI[p.icon] ?? PI.folder}<span class="fe-sl">${esc(p.label)}</span></a>`
    ).join("");
  }
  function renderPage(p) {
    const { initTheme, initPalette, initView, initDensity, initHidden, fileMode, rawPath, folderPath, fileName, segments, settings, curIsBookmarked, dirs, files, extOpts, recentsHTML } = p;
    const ALL_ENTRIES = p.entries;
    const ctx0 = p.ctx;
    const VIEW_MODES = VIEW_ICONS;
    const VIEW_LABELS = {
      details: "Full table: name, type, size, modified",
      list: "Compact single-column rows",
      tree: "Expand folders without leaving this page",
      tiles: "Medium icon grid with filename below",
      icons: "Large icon grid"
    };
    const viewSeg = segHtml("fe-view-group", VIEW_MODES.map((v) => ({ value: v.id, icon: v.ico, hint: `${v.label} view: ${VIEW_LABELS[v.id]}` })), "View");
    const railBtn = (lens, label, icon2, hint, hidden = false) => `<button type="button" class="fe-rail-btn" role="tab" data-lens="${lens}" id="fe-rail-${lens}" aria-controls="fe-lens-${lens}" title="${hint}" data-hint="${hint}"${hidden ? " hidden" : ""}>${icon2}<em>${label}</em></button>`;
    const SETTINGS_DIALOG = settingsDialog();
    const HELP_DIALOG = {
      id: "fe-help-modal",
      mark: PI.help,
      title: "Help",
      subtitle: "What is here and how to use it",
      tabs: HELP_TABS
    };
    const PAGE_HTML = `
<div id="fe" data-theme="${initTheme}" data-palette="${initPalette}" data-view="${initView}" data-density="${initDensity}"${fileMode ? ' class="fe-file-page"' : ""}>

  <div id="fe-bar" class="bar">
    <button id="fe-side-toggle" class="btn" data-icon title="Show or hide the sidebar">${line('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>', 15)}</button>
    <div id="fe-bc">${renderCrumbs(folderPath, segments, fileMode, homeDir(rawPath))}${fileMode ? `<span class="fe-crumb fe-crumb-file cur">${esc(fileName)}</span>` : ""}<button id="fe-crumb-more" class="btn fe-crumb-more" title="Folders hidden for room" aria-label="Folders hidden for room" hidden>\u2026</button></div>
    <button id="fe-term-btn" class="btn" data-icon title="Open in terminal (${settings.terminalApp || "ghostty"}), click opens the current folder, shift-click copies the command">${UI_ICON.terminal}</button>
    <button id="fe-bm-btn" data-icon class="btn ${curIsBookmarked ? "on" : ""}" title="${curIsBookmarked ? `Remove this ${fileMode ? "file" : "folder"} from Saved` : `Save this ${fileMode ? "file" : "folder"} (sidebar)`}">
      ${line(`<path id="fe-bm-path" d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" fill="${curIsBookmarked ? "currentColor" : "none"}"/>`)}
    </button>
    <button id="fe-theme-btn" class="btn" data-icon title="Switch between dark and light">
      ${UI_ICON.appearance.replace("<svg ", '<svg id="fe-sun" ')}
      ${line('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>').replace("<svg ", '<svg id="fe-moon" ')}
    </button>
    <button id="fe-help-btn" class="btn" data-icon title="Help (press ?), what's here and how to use it">
      ${PI.help}
    </button>
    <button id="fe-settings-btn" class="btn" data-icon title="Settings (press ,), theme, views, terminal, icon rules">
      ${PI.gear}
    </button>
  </div>

  <div id="fe-body">
    <nav id="fe-side">
      <div id="fe-rail" role="tablist" aria-label="Sidebar" aria-orientation="horizontal">
        ${railBtn("places", "Places", PI.home, "Places: Home, your folders, Applications and Root")}
        ${railBtn("saved", "Saved", PI.bm, "Saved: places and views you kept")}
        ${railBtn("notes", "Notes", PI.docs, "Notes: your notes folder")}
        ${railBtn("history", "History", PI.recent, "History: folders and files you opened lately, and closed tabs", !!settings.hideRecent)}
        ${railBtn("search", "Search", PI.search, "Search: find text in the files of this folder")}
        ${railBtn("ask", "Ask", PI.ask, "Ask: put a question about this file or folder to the local model")}
        ${railBtn("comments", "Comments", UI_ICON.comment, "Comments: every document with comments")}
      </div>
      <div id="fe-lenses">
      <div class="fe-lens" id="fe-lens-places" data-lens="places" role="tabpanel" aria-labelledby="fe-rail-places" hidden>
        <div class="fe-sec" data-sec="places">
        ${placesHTML(homeDir(rawPath), rawPath)}
        </div>
      </div>
      <div class="fe-lens" id="fe-lens-saved" data-lens="saved" role="tabpanel" aria-labelledby="fe-rail-saved" hidden>
      <div class="bar fe-lens-tools" data-inset>
        <button id="fe-sv-add" class="btn fe-lens-ib" data-icon data-size="lg" data-tone="accent" title="Save this ${fileMode ? "file" : "folder"} and name it" aria-label="Save this ${fileMode ? "file" : "folder"}">${UI_ICON.add}</button>
        <label class="fe-lens-box">
          <input id="fe-lens-filter" class="tb" data-size="lg" data-lead="search" type="text" placeholder="Filter" spellcheck="false" autocomplete="off" title="Matches names and tags. #work matches tags only. Esc clears.">
          <button type="button" id="fe-lens-depth" class="btn fe-lens-depth" data-size="sm" data-variant="outline" aria-pressed="false" title="Names only. Click to search inside too">Names</button>
        </label>
      </div>
      <div id="fe-lens-tags" class="fe-lens-tags" hidden></div>
      <div class="fe-sec" data-sec="saved">
        <input id="fe-sv-filter" class="fe-proxy-filter" type="text" tabindex="-1" aria-hidden="true">
        <div id="fe-sv-list">${renderSavedList(getSaved(), getTags(), rawPath, "", getFoldedGroups())}</div>
      </div>
      </div>
      <div class="fe-lens" id="fe-lens-notes" data-lens="notes" role="tabpanel" aria-labelledby="fe-rail-notes" hidden>
      <div class="bar fe-lens-tools" data-inset>
        <button id="fe-nt-add" class="btn fe-lens-ib" data-icon data-size="lg" data-tone="accent" title="New note (n)" aria-label="New note">${UI_ICON.add}</button>
        <a id="fe-notes-root" class="btn fe-lens-ib" data-icon data-size="lg" title="Open the notes folder" aria-label="Open the notes folder">${UI_ICON.folderOpen}</a>
      </div>
      <div class="fe-sec" id="fe-notes-sec" data-sec="notes">
        <input id="fe-nt-filter" class="fe-proxy-filter" type="text" tabindex="-1" aria-hidden="true">
        <div id="fe-nt-list"></div>
      </div>
      </div>
      <div class="fe-lens" id="fe-lens-history" data-lens="history" role="tabpanel" aria-labelledby="fe-rail-history" hidden>
        ${recentsHTML}
      </div>
      <div class="fe-lens" id="fe-lens-search" data-lens="search" role="tabpanel" aria-labelledby="fe-rail-search" hidden>
        <div id="fe-srch"></div>
      </div>
      <div class="fe-lens" id="fe-lens-ask" data-lens="ask" role="tabpanel" aria-labelledby="fe-rail-ask" hidden>
        <div id="fe-ask"></div>
      </div>
      <div class="fe-lens" id="fe-lens-comments" data-lens="comments" role="tabpanel" aria-labelledby="fe-rail-comments" hidden>
        <div id="fe-docs-list"></div>
      </div>
      </div>
    </nav>
    <div id="fe-side-rz" title="Drag to resize the sidebar"></div>

    <div id="fe-main">
      <div id="fe-tabbar">
        <div id="fe-tabs" title="Tabs of this Chrome tab (t keeps this one, w closes, p pins, [ ] switch, 1-9 jump)"></div>
        <div id="fe-tabs-end">
          <button id="fe-tab-list" class="btn" data-icon data-size="sm" hidden title="All tabs" aria-label="All tabs" aria-haspopup="menu">${CHEVRON_DOWN}</button>
          <button id="fe-open-pick" class="btn" data-icon data-size="sm" title="Open a file or folder" aria-label="Open a file or folder">${UI_ICON.add}</button>
          <button id="fe-open-path" class="btn" data-icon data-size="sm" title="Go to a path you paste or type" aria-label="Go to a path">${UI_ICON.link}</button>
        </div>
      </div>
      ${fileMode ? renderFileContent() : ""}
      <div id="fe-toolbar" class="bar">
        <span id="fe-count">${fileMode ? "" : `${dirs} folder${dirs !== 1 ? "s" : ""}, ${files} file${files !== 1 ? "s" : ""}`}</span>
        <div id="fe-tb-right">
          <button id="fe-sg-btn" class="btn" title="Sort and group" aria-expanded="false">
            ${SORT_ICON}<span id="fe-sg-cur">Sort</span>
          </button>
          <span class="bar-sep" aria-hidden="true"></span>
          <button id="fe-filter-btn" class="btn" data-icon title="Filter by name, type or text inside files" aria-expanded="false">
            ${line('<path d="M10 20a1 1 0 0 0 .55.9l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .52-1.34L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.74 1.67l7.22 7.99A2 2 0 0 1 10 14z"/>', 14)}
          </button>
          <button id="fe-deep-btn" class="btn" data-icon title="Subfolders: filter every folder under this one too">
            ${line('<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/><path d="M2 10h20"/>', 14)}
          </button>
          <button id="fe-hidden-btn" data-icon class="btn ${initHidden ? "on" : ""}" title="Hidden files: ${initHidden ? "showing" : "hiding"} dotfiles and comment files \xB7 click to toggle">
            ${line(`<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3" fill="${initHidden ? "currentColor" : "none"}"/>`, 14)}
          </button>
          <span class="bar-sep" aria-hidden="true"></span>
          <div id="fe-density-wrap" title="Detail: drag left for fewer, bigger items, right for smaller items with more facts (- and =)">
            <span class="fe-density-end" aria-hidden="true">${line('<rect width="16" height="16" x="4" y="4" rx="2"/>', 13)}</span>
            ${sliderHtml("fe-density", [1, 2, 3, 4, 5], "", "Detail", DENSITY_NAMES)}
            <span class="fe-density-end" aria-hidden="true">${line('<path d="M4 5h16M4 9.5h16M4 14h16M4 18.5h16"/>', 13)}</span>
          </div>
          <span class="bar-sep" aria-hidden="true"></span>
          ${viewSeg}
          <label class="fe-in-box fe-tb-box"><input id="fe-search" class="tb" data-lead="search" type="text" placeholder="Filter" autocomplete="off" spellcheck="false" title="Filter this folder by name"/></label>
        </div>
      </div>

      <div id="fe-sg-panel" style="display:none">
        <div class="fe-panel-row">
          <span class="fe-panel-lbl">Sort by</span>
          ${ddHtml("fe-sort-cols", SORT_OPTS, "Sort this folder by")}
          ${segHtml("fe-sort-dir", SORT_DIR_OPTS, "Direction")}
          <span class="fe-panel-lbl fe-panel-gap">Group by</span>
          ${ddHtml("fe-group-btns", GROUP_OPTS, "Group this folder by")}
        </div>
      </div>

      <div id="fe-filter-bar" style="display:none">
        <div class="fe-panel-row">
          <span class="fe-panel-lbl">Name</span>
          <label class="fe-in-box fe-in-name">
            <input id="fe-filter-q" class="tb" data-lead="search" type="text" placeholder="Pattern" autocomplete="off" spellcheck="false" title="Filter by name; turn on .* for a regular expression"/>
            <span class="fe-in-chips"><button type="button" id="fe-regex-btn" class="btn fe-in-chip" data-size="sm" data-variant="outline" data-mono aria-pressed="false" title="Treat the pattern as a regular expression">.*</button></span>
          </label>
          <span class="fe-panel-lbl">Type</span>
          ${ddHtml("fe-type-filter", [
      { value: "all", label: "All types", icon: line('<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>', 14) },
      { value: "folders", label: "Folders only", icon: line(PI_FOLDER, 14) },
      { value: "files", label: "Files only", icon: UI_ICON.file },
      ...extOpts.map((x) => ({ value: x, label: "." + x }))
    ], "Show only folders, files or one extension")}
        </div>
        <div class="fe-panel-row">
          <span class="fe-panel-lbl">Text</span>
          <label class="fe-in-box fe-in-text">
            <input id="fe-find-text" class="tb" data-lead="search" type="text" placeholder="Find text" autocomplete="off" spellcheck="false" title="Reads text files (up to 2 MB each) in this folder, or every subfolder when Subfolders is on. Enter runs."/>
            <span class="fe-in-chips">
              <label class="btn fe-in-chip" data-size="sm" data-variant="outline" data-mono title="Match case"><input type="checkbox" id="fe-find-case" title="Match case">Aa</label>
              <label class="btn fe-in-chip" data-size="sm" data-variant="outline" data-mono title="Use a regular expression for the text"><input type="checkbox" id="fe-find-text-regex" title="Use a regular expression for the text">.*</label>
            </span>
          </label>
          <span id="fe-find-depth-wrap" class="fe-panel-sub" style="display:none" title="How many levels of subfolders to look in">
            <span class="fe-panel-lbl">Depth</span>
            ${ddHtml("fe-find-depth", [1, 2, 4, 8].map((n) => ({ value: String(n), label: n === 1 ? "1 level" : `${n} levels` })), "Maximum subfolder depth")}
          </span>
          <button id="fe-find-run" class="btn" data-variant="outline" title="Run the text search (Enter)">${line('<path d="M6 4l13 8-13 8z"/>', 12)}Run</button>
          <button id="fe-find-cancel" class="btn" data-variant="outline" style="display:none" title="Stop scanning">${UI_ICON.close}Cancel</button>
          <span id="fe-find-status"></span>
          <span id="fe-find-error" role="alert"></span>
          <button id="fe-find-save" class="btn" data-variant="outline" style="margin-left:auto" title="Keep this search as a Saved view: this folder plus these fields">${line(STAR, 13)}Save view</button>
        </div>
      </div>

      <div id="fe-scroll">
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
        <div id="fe-empty" hidden></div>
      </div>

      <div id="fe-statusbar" class="bar">
        ${fileMode ? '<span id="fe-status-meta"></span><span class="bar-sep" aria-hidden="true"></span>' : ""}
        <span id="fe-status-text">${fileMode ? "" : `${dirs} folder${dirs !== 1 ? "s" : ""}, ${files} file${files !== 1 ? "s" : ""}`}</span>
        <span class="fe-status-grow"></span>
        ${fileMode ? '<span id="fe-fp-reload" hidden></span>' : ""}
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

  // src/selection.ts
  function selectionRange(anchor, target) {
    const lo = Math.min(anchor, target);
    const hi = Math.max(anchor, target);
    const out = [];
    for (let i3 = lo; i3 <= hi; i3++) out.push(i3);
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
      const map2 = /* @__PURE__ */ new Map();
      entries.forEach((e) => {
        const key = e.isDir ? "\u{1F4C1} Folders" : getExt(e) ? `.${getExt(e)}` : "Other";
        if (!map2.has(key)) map2.set(key, []);
        map2.get(key).push(e);
      });
      return Array.from(map2.entries()).map(([label, items]) => ({ label, items }));
    }
    if (mode === "type") {
      const map2 = /* @__PURE__ */ new Map();
      entries.forEach((e) => {
        const key = e.isDir ? "Folder" : fmtType(e);
        if (!map2.has(key)) map2.set(key, []);
        map2.get(key).push(e);
      });
      return Array.from(map2.entries()).map(([label, items]) => ({ label, items }));
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
  async function crawl(rootUrl, listDir2, opts = {}, isCancelled = () => false) {
    const maxDepth = opts.maxDepth ?? 8;
    const maxEntries = opts.maxEntries ?? 5e3;
    const skip = opts.skipDirs ?? DEFAULT_SKIP_DIRS;
    const perFolderFiles = Math.ceil(maxEntries / 2);
    const entries = [];
    let folders = 0, entryCapped = false, depthCapped = false;
    let queue = [{ url: rootUrl, depth: 0 }];
    while (queue.length && !isCancelled() && entries.length < maxEntries) {
      const batch = queue.splice(0, CONCURRENCY);
      const listed = await Promise.all(batch.map(async (b) => {
        try {
          return { b, kids: await listDir2(b.url) };
        } catch {
          return { b, kids: [] };
        }
      }));
      listed.sort((x, y) => x.kids.length - y.kids.length);
      for (const { b, kids } of listed) {
        folders++;
        let files = 0;
        for (const k of kids) {
          if (k.isParent) continue;
          if (entries.length >= maxEntries) {
            entryCapped = true;
            break;
          }
          if (!k.isDir && ++files > perFolderFiles) {
            entryCapped = true;
            continue;
          }
          const name = relativeName(k.href, rootUrl);
          const hiddenSeg = name.split("/").some((s) => s.startsWith("."));
          entries.push({ ...k, name, isHidden: hiddenSeg });
          if (!k.isDir) continue;
          if (skip.has(k.name) || !opts.includeHidden && k.name.startsWith(".")) continue;
          if (b.depth + 1 > maxDepth) {
            depthCapped = true;
            continue;
          }
          queue.push({ url: k.href, depth: b.depth + 1 });
        }
      }
      opts.onProgress?.(folders, entries.length);
    }
    return { entries, folders, truncated: entryCapped || depthCapped, entryCapped, depthCapped, cancelled: isCancelled() };
  }

  // src/doc-comments.ts
  var SUFFIX = ".bfb.json";
  function openThreads(text) {
    try {
      const threads = JSON.parse(text)?.comments?.threads;
      return Array.isArray(threads) ? threads.filter((t) => !t?.deleted && t?.status !== "done").length : 0;
    } catch {
      return 0;
    }
  }
  function commentedDocs(all) {
    const names = new Set(all.filter((e) => !e.isDir).map((e) => e.name));
    return all.filter((e) => !e.isDir && e.name.endsWith(SUFFIX) && names.has(e.name.slice(0, -SUFFIX.length))).map((e) => ({ doc: e.name.slice(0, -SUFFIX.length), href: e.href }));
  }
  async function loadOpenCounts(all) {
    const out = /* @__PURE__ */ new Map();
    await Promise.all(commentedDocs(all).map(async ({ doc, href }) => {
      const n = openThreads(await fetchFileText(href, 1).catch(() => ""));
      if (n) out.set(doc, n);
    }));
    return out;
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
      deepCap: "",
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
    let openComments = /* @__PURE__ */ new Map();
    const ctx = () => {
      const colour = new Map(getTags().map((t) => [t.name, t.color]));
      const byPath = new Map(getSaved().filter((p) => p.tags?.length).map((p) => [p.path.replace(/\/+$/, ""), p.tags]));
      return {
        rawPath,
        iconRules: app.iconRules,
        settings: app.settings,
        tagsOf: (path) => (byPath.get(path.replace(/\/+$/, "")) ?? []).map((name) => ({ name, color: colour.get(name) ?? "#8b949e" })),
        openComments: (name) => openComments.get(name) ?? 0
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
    const countText = () => {
      const showHidden = fe.classList.contains("show-hidden");
      const d = showHidden ? dirs : nonPar.filter((e) => e.isDir && !e.isHidden).length;
      const f = showHidden ? files : nonPar.filter((e) => !e.isDir && !e.isHidden).length;
      return `${d} folder${d !== 1 ? "s" : ""}, ${f} file${f !== 1 ? "s" : ""}${!showHidden && hidden ? ` \xB7 ${hidden} hidden` : ""}`;
    };
    ls.baseStatus = countText();
    function renderTree(entries, parent) {
      const rows = [];
      const add = (en, depth) => {
        const idx = ls.visible.length;
        ls.visible.push(en);
        const name = en.isParent ? "Parent Directory" : en.name.split("/").pop();
        const expanded = treeExpanded.has(en.href);
        const hit = ls.contentHits?.get(en.href);
        rows.push(`<div class="row fe-tree-row${en.isHidden ? " dotfile" : ""}${en.isDir ? " dir" : ""}" data-idx="${idx}" style="padding-left:${10 + depth * 20}px">
        ${en.isDir && !en.isParent ? `<button class="fe-tree-toggle" data-url="${esc(en.href)}" aria-label="${expanded ? "Collapse" : "Expand"} ${esc(name)}" aria-expanded="${expanded}">${DISCLOSE}</button>` : '<span class="fe-tree-spacer"></span>'}
        <a href="${esc(en.href)}" class="fe-tree-link" title="${esc(name)}">${getIcon(en, app.iconRules)}<span class="fe-nm">${esc(name)}</span></a>${hit ? `<span class="badge fe-find-badge">${hit.count}</span>${renderHitSnippet(hit)}` : ""}
      </div>`);
        if (!en.isDir || !expanded) return;
        if (treeLoading.has(en.href)) {
          rows.push(emptyHtml("loading", "Loading\u2026", { inline: true, style: `padding-left:${34 + (depth + 1) * 20}px` }));
          return;
        }
        if (treeErrors.has(en.href)) {
          rows.push(emptyHtml("failed", "This folder could not be read", { inline: true, hint: "Collapse and expand it to try again", style: `padding-left:${34 + (depth + 1) * 20}px` }));
          return;
        }
        const children = treeChildren.get(en.href);
        if (!children) return;
        if (!children.length) rows.push(emptyHtml("empty", "Empty folder", { inline: true, style: `padding-left:${34 + (depth + 1) * 20}px` }));
        for (const child of applySort(applyFilter(children, ls.filter, nameMatches ?? void 0), ls.sort)) {
          if (!ls.contentHits || ls.contentHits.has(child.href) || child.isDir) add(child, depth + 1);
        }
      };
      parent.forEach((en) => add(en, 0));
      entries.forEach((en) => add(en, 0));
      el("fe-tree").innerHTML = rows.join("");
    }
    const WINDOW_MIN = 300, OVERSCAN = 40;
    let win = null;
    const firstAtOrAfter = (tops, y) => {
      let lo = 0, hi = tops.length;
      while (lo < hi) {
        const mid = lo + hi >> 1;
        if (tops[mid] < y) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    };
    function paintWindow(force = false) {
      if (!win) return;
      const scroller = el("fe-scroll"), tbody = el("fe-tbody");
      const offset = tbody.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
      const top2 = scroller.scrollTop - offset;
      const n = win.parts.length;
      const a = Math.max(0, firstAtOrAfter(win.tops, top2) - OVERSCAN);
      const b = Math.min(n, firstAtOrAfter(win.tops, top2 + scroller.clientHeight) + OVERSCAN);
      if (!force && a >= win.a && b <= win.b) return;
      win.a = Math.max(0, a - OVERSCAN);
      win.b = Math.min(n, b + OVERSCAN);
      const above = win.tops[win.a] ?? 0, below = win.total - (win.b < n ? win.tops[win.b] : win.total);
      const spacer = (h) => h > 0 ? `<tr class="fe-spacer" aria-hidden="true"><td colspan="6" style="height:${h}px"></td></tr>` : "";
      tbody.innerHTML = spacer(above) + win.parts.slice(win.a, win.b).join("") + spacer(below);
      paintSel();
    }
    function measureWindow() {
      if (!win) return;
      const tbody = el("fe-tbody");
      tbody.innerHTML = win.parts.slice(0, 60).join("");
      const row2 = tbody.querySelector("tr[data-idx]")?.offsetHeight || 36;
      const hdr = tbody.querySelector(".fe-group-hdr")?.offsetHeight || row2;
      let y = 0;
      win.tops = win.parts.map((part, i3) => {
        const t = y;
        y += win.idxOf[i3] < 0 ? hdr : row2;
        return t;
      });
      win.total = y;
      win.a = win.b = 0;
      paintWindow(true);
    }
    let windowFrame = 0;
    el("fe-scroll").addEventListener("scroll", () => {
      if (!win || windowFrame) return;
      windowFrame = requestAnimationFrame(() => {
        windowFrame = 0;
        paintWindow();
      });
    }, { passive: true });
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
      const view = fe.dataset.view ?? "details";
      const wantTiles = view === "tiles" || view === "icons", wantRows = !wantTiles && view !== "tree";
      const showHidden = fe.classList.contains("show-hidden");
      const rowParts = [], tileParts = [], idxOf = [], hiddenRow = [];
      const pushEntry = (e) => {
        const idx = ls.visible.length;
        ls.visible.push(e);
        const hit = ls.contentHits?.get(e.href);
        if (wantRows) {
          rowParts.push(renderRow(e, c, idx, hit));
          idxOf.push(idx);
          hiddenRow.push(e.isHidden);
        }
        if (wantTiles) tileParts.push(renderTile(e, c, idx, hit));
      };
      parent.forEach(pushEntry);
      if (ls.group !== "none") {
        for (const g of buildGroups(entries, ls.group)) {
          if (wantRows) {
            rowParts.push(`<tr class="fe-group-hdr"><td colspan="6">${esc(g.label)}</td></tr>`);
            idxOf.push(-1);
            hiddenRow.push(false);
          }
          if (wantTiles) tileParts.push(`<div class="fe-group-hdr-tile">${esc(g.label)}</div>`);
          g.items.forEach(pushEntry);
        }
      } else {
        entries.forEach(pushEntry);
      }
      const kept = rowParts.map((p, i3) => showHidden || !hiddenRow[i3] ? i3 : -1).filter((i3) => i3 >= 0);
      win = rowParts.length > WINDOW_MIN ? { parts: kept.map((i3) => rowParts[i3]), idxOf: kept.map((i3) => idxOf[i3]), tops: [], total: 0, a: 0, b: 0 } : null;
      if (win) measureWindow();
      else tbody.innerHTML = rowParts.join("");
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
        ls.baseStatus = ls.deepScanning ? `Scanning\u2026 ${ls.deepFolders} folder${ls.deepFolders !== 1 ? "s" : ""}` : `${shown} of ${ls.deepEntries?.length ?? 0} items in ${ls.deepFolders} folders${ls.deepTruncated ? ` (${ls.deepCap})` : ""}`;
      } else {
        ls.baseStatus = filtered ? `${shown} of ${nonPar.length} item${nonPar.length !== 1 ? "s" : ""} shown` : countText();
      }
      if (!app.fileMode) el("fe-count").textContent = ls.baseStatus;
      lastEntries = entries;
      paintEmpty();
      sel.setSel(-1);
    }
    let lastEntries = [];
    function paintEmpty() {
      const box = el("fe-empty");
      const showHidden = fe.classList.contains("show-hidden");
      const seen = lastEntries.filter((e) => showHidden || !e.isHidden).length;
      const busy = ls.deepScanning || !!nameFilterAbort || app.fileMode;
      const filtered = !!ls.filter.q || ls.filter.type !== "all" || !!ls.contentHits;
      box.hidden = busy || seen > 0;
      const showThem = "Press <kbd>.</kbd> to show them";
      box.innerHTML = box.hidden ? "" : filtered && lastEntries.length ? emptyHtml("filtered", "Only hidden files match", { hintHtml: showThem, actions: [CLEAR] }) : filtered ? emptyHtml("filtered", "Nothing here matches", { actions: [CLEAR] }) : lastEntries.length ? emptyHtml("empty", "Only hidden files here", { hintHtml: showThem }) : ls.deepOn ? emptyHtml("empty", "Nothing in these folders", { hint: showHidden ? "" : "Hidden files are left out of a subfolder search" }) : emptyHtml("empty", "This folder is empty");
    }
    app.applyAll = applyAll;
    void loadOpenCounts(all).then((m) => {
      if (m.size) {
        openComments = m;
        applyAll();
      }
    });
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
      const controller = new AbortController();
      nameFilterAbort = controller;
      nameMatches = /* @__PURE__ */ new Set();
      applyAll();
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
      selectable: (i3) => {
        const en = ls.visible[i3];
        return !!en && !en.isParent && sel.entryShown(en);
      },
      setSel(i3) {
        ls.selSet.clear();
        ls.selIdx = i3;
        ls.anchor = i3;
        if (i3 >= 0) ls.selSet.add(i3);
        paintSel();
        scrollToLead();
      },
      toggleSel(i3) {
        if (ls.selSet.has(i3)) ls.selSet.delete(i3);
        else ls.selSet.add(i3);
        ls.selIdx = i3;
        ls.anchor = i3;
        paintSel();
      },
      rangeSel(target) {
        const a = ls.anchor >= 0 ? ls.anchor : target;
        ls.selSet.clear();
        selectionRange(a, target).filter(sel.selectable).forEach((i3) => ls.selSet.add(i3));
        ls.selIdx = target;
        paintSel();
        scrollToLead();
      },
      selectAll() {
        ls.selSet.clear();
        for (let i3 = 0; i3 < ls.visible.length; i3++) if (sel.selectable(i3)) ls.selSet.add(i3);
        if (ls.selSet.size && ls.selIdx < 0) ls.selIdx = [...ls.selSet][0];
        paintSel();
      },
      moveSel(step2) {
        let i3 = ls.selIdx;
        for (let n = 0; n < ls.visible.length; n++) {
          i3 += step2;
          if (i3 < 0 || i3 >= ls.visible.length) return;
          if (sel.entryShown(ls.visible[i3])) {
            sel.setSel(i3);
            return;
          }
        }
      },
      copySelection() {
        const paths = [...ls.selSet].sort((a, b) => a - b).map((i3) => fullPath(rawPath, ls.visible[i3]));
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
        let i3 = ls.selIdx;
        for (let n = 0; n < ls.visible.length; n++) {
          i3 += step2;
          if (i3 < 0 || i3 >= ls.visible.length) return;
          const en = ls.visible[i3];
          if (sel.entryShown(en) && canPreview(en)) {
            sel.setSel(i3);
            openPreview(en);
            return;
          }
        }
      }
    };
    function paintSel() {
      els("#fe-scroll [data-idx]").forEach((x) => x.classList.toggle("selected", ls.selSet.has(Number(x.dataset.idx))));
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
      if (win && !el("fe-tbody").querySelector(`[data-idx="${ls.selIdx}"]`)) {
        const part = win.idxOf.indexOf(ls.selIdx);
        if (part >= 0) {
          const scroller = el("fe-scroll"), tbody = el("fe-tbody");
          const offset = tbody.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
          scroller.scrollTop = Math.max(0, offset + win.tops[part] - scroller.clientHeight / 2);
          paintWindow(true);
        }
      }
      els(`#fe-scroll [data-idx="${ls.selIdx}"]`).forEach((x) => {
        if (x.offsetParent) x.scrollIntoView({ block: "nearest" });
      });
    }
    el("fe-view-group").addEventListener("change", () => {
      const v = el("fe-view-group").value;
      fe.dataset.view = v;
      viewPref.set(v);
      applyAll();
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
      hiddenBtn.title = `Hidden files: ${on ? "showing" : "hiding"} dotfiles and comment files \xB7 click to toggle`;
      hiddenPref.set(on);
      toast(on ? `Showing ${hidden} hidden file${hidden !== 1 ? "s" : ""}` : "Hidden files concealed");
      if (!app.fileMode) el("fe-count").textContent = ls.baseStatus = countText();
      if (win) applyAll();
      else paintEmpty();
    });
    upgradeControls(el("fe-toolbar"));
    upgradeControls(el("fe-sg-panel"));
    upgradeControls(el("fe-filter-bar"));
    el("fe-view-group").value = init.view;
    el("fe-type-filter").value = ls.filter.type;
    el("fe-find-depth").value = "8";
    const density = el("fe-density");
    density.value = String(init.density);
    const setDensity = (d) => {
      const n = Math.max(1, Math.min(5, d));
      fe.dataset.density = String(n);
      density.value = String(n);
      densityPref.set(n);
      applyAll();
    };
    density.addEventListener("input", () => {
      fe.dataset.density = density.value;
    });
    density.addEventListener("change", () => setDensity(Number(density.value)));
    const scroll = el("fe-scroll");
    const scrollPref2 = textPref("bfb-scroll:" + rawPath, "", "tab");
    const top = Number(scrollPref2.get());
    if (top) scroll.scrollTop = top;
    scroll.addEventListener("scroll", () => scrollPref2.set(String(scroll.scrollTop)));
    const sortCols = el("fe-sort-cols"), sortDir = el("fe-sort-dir"), groupSeg = el("fe-group-btns");
    const SORT_NAMES = { name: "Name", size: "Size", date: "Modified", type: "Type", ext: "Extension" };
    function syncSortUi() {
      const { col, dir } = ls.sort;
      sortCols.value = col ?? "";
      sortDir.value = dir;
      el("fe-sg-cur").textContent = col ? `${SORT_NAMES[col]} ${dir === "asc" ? "\u2191" : "\u2193"}` : "Sort";
      els("th[data-sort]").forEach((h) => {
        const on = h.dataset.sort === col;
        h.classList.toggle("sorted", on);
        h.querySelector(".si").textContent = on ? dir === "asc" ? "\u2191" : "\u2193" : "\u2195";
      });
      groupSeg.value = ls.group;
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
    const MIN_W2 = 48, LAST_MIN = 110;
    const lastTh = el("fe-table").querySelector("thead th.c-dt");
    const applyWidths = () => {
      const w = getColWidths();
      els("thead th[data-ck]").forEach((th) => {
        const px2 = w[th.dataset.ck];
        th.style.width = px2 ? px2 + "px" : "";
      });
      lastTh.style.width = Object.keys(w).length ? "auto" : "";
    };
    applyWidths();
    if (el("fe-table").offsetWidth && lastTh.offsetWidth < LAST_MIN) {
      saveColWidths({});
      applyWidths();
    }
    els(".fe-col-rz").forEach((handle) => {
      handle.title = "Drag to resize this column \xB7 double-click to reset";
      const th = handle.closest("th");
      const key = th.dataset.ck;
      let maxW = Infinity;
      resizable(handle, {
        axis: "x",
        label: `Resize the ${th.textContent?.trim() || "column"} column`,
        size: () => {
          maxW = th.offsetWidth + Math.max(0, lastTh.offsetWidth - LAST_MIN);
          lastTh.style.width = "auto";
          return { w: th.offsetWidth, h: 0 };
        },
        apply: (w) => {
          th.style.width = Math.min(maxW, Math.max(MIN_W2, w)) + "px";
        },
        reset: () => {
          const widths = getColWidths();
          delete widths[key];
          saveColWidths(widths);
          applyWidths();
        },
        commit: () => {
          if (!th.style.width || th.style.width === "auto") return;
          const widths = getColWidths();
          widths[key] = parseFloat(th.style.width);
          saveColWidths(widths);
        }
      });
    });
    const sgPanel = el("fe-sg-panel");
    el("fe-sg-btn").addEventListener("click", () => {
      const open = sgPanel.style.display === "none";
      sgPanel.style.display = open ? "" : "none";
      el("fe-sg-btn").classList.toggle("on", open);
      el("fe-sg-btn").setAttribute("aria-expanded", String(open));
    });
    sortCols.addEventListener("change", () => {
      ls.sort.col = sortCols.value || null;
      syncSortUi();
      applyAll();
    });
    sortDir.addEventListener("change", () => {
      ls.sort.dir = sortDir.value;
      if (!ls.sort.col) ls.sort.col = "name";
      syncSortUi();
      applyAll();
    });
    groupSeg.addEventListener("change", () => {
      ls.group = groupSeg.value;
      syncSortUi();
      applyAll();
    });
    syncSortUi();
    const filterBar = el("fe-filter-bar");
    el("fe-filter-btn").addEventListener("click", () => {
      const open = filterBar.style.display === "none";
      filterBar.style.display = open ? "" : "none";
      el("fe-filter-btn").classList.toggle("on", open);
      el("fe-filter-btn").setAttribute("aria-expanded", String(open));
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
      this.setAttribute("aria-pressed", String(ls.filter.regex));
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
        kind: type === "folders" || type === "files" ? type : void 0,
        text: findText.value.trim(),
        caseSensitive: findCase.checked,
        textRegex: findRegex.checked,
        maxDepth: Number(findDepth.value) || 8
      };
    }
    async function runFind(text) {
      findSession?.close();
      const seq2 = ++ls.findSeq;
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
        if (seq2 !== ls.findSeq) return;
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
        if (seq2 !== ls.findSeq) return;
        findCancel.style.display = "none";
        findError.textContent = `Search could not start: ${String(error)}`;
        return;
      }
      if (seq2 !== ls.findSeq) {
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
          if (seq2 === ls.findSeq) findStatus.textContent = `scanning ${d}/${t}`;
        },
        () => cancelled || session.dead || seq2 !== ls.findSeq,
        4,
        session.match
      );
      const failure = session.failure;
      session.close();
      if (findSession === session) findSession = null;
      if (seq2 !== ls.findSeq) return;
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
      if (!q) {
        if (location.hash.startsWith("#find=")) toast("This saved view link is damaged, so the folder shows unfiltered");
        return;
      }
      ls.filter.q = q.name;
      ls.filter.regex = q.regex;
      ls.filter.type = q.kind ?? (q.exts.length === 1 ? q.exts[0] : "all");
      el("fe-filter-q").value = q.name;
      el("fe-search").value = q.name;
      el("fe-regex-btn").classList.toggle("active", q.regex);
      el("fe-regex-btn").setAttribute("aria-pressed", String(q.regex));
      const typeDd = el("fe-type-filter");
      const typeOpts = JSON.parse(typeDd.dataset.opts || "[]");
      if (!typeOpts.some((o) => o.value === ls.filter.type)) typeDd.setOptions([...typeOpts, { value: ls.filter.type, label: "." + ls.filter.type }]);
      typeDd.value = ls.filter.type;
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
      const seq2 = ++ls.deepSeq;
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
          if (seq2 === ls.deepSeq) findError.textContent = `Could not read ${scanFailures} folder${scanFailures === 1 ? "" : "s"}: ${String(error)}`;
          throw error;
        }),
        {
          maxDepth: Number(findDepth.value) || 8,
          includeHidden: fe.classList.contains("show-hidden"),
          onProgress: (f) => {
            if (seq2 === ls.deepSeq) {
              ls.deepFolders = f;
              applyAll();
            }
          }
        },
        () => seq2 !== ls.deepSeq
      ).then((r) => {
        reader.close();
        if (deepReader === reader) deepReader = null;
        if (seq2 !== ls.deepSeq) return;
        ls.deepCap = [r.entryCapped ? "stopped at 5,000 items" : "", r.depthCapped ? `not deeper than ${findDepth.value} level${findDepth.value === "1" ? "" : "s"}` : ""].filter(Boolean).join(", ");
        ls.deepEntries = r.entries;
        ls.deepFolders = r.folders;
        ls.deepTruncated = r.truncated;
        ls.deepScanning = false;
        refreshNameMatches();
        if (r.truncated) toast(`Deep search ${ls.deepCap}`);
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
    el("fe-empty").addEventListener("click", (e) => {
      if (e.target.closest("[data-a]")?.dataset.a !== "clear") return;
      stopFind();
      findText.value = "";
      searchEl.value = ls.filter.q = "";
      el("fe-filter-q").value = "";
      ls.filter.type = "all";
      el("fe-type-filter").value = "all";
      refreshNameMatches();
      searchEl.focus();
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
      const i3 = ls.visible.indexOf(en);
      e.preventDefault();
      if (en.isParent) {
        go(en.href);
        return;
      }
      if (e.altKey) {
        app.strip.open(fullPath(rawPath, en), true);
        return;
      }
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        if (!sel.selectable(i3)) return;
        if (e.shiftKey && (e.metaKey || e.ctrlKey)) sel.rangeSel(i3);
        else sel.toggleSel(i3);
        return;
      }
      if (en.isDir) {
        go(en.href);
        return;
      }
      if (!sel.selectable(i3)) return;
      sel.setSel(i3);
      if (!canPreview(en) || app.settings.clickOpens === "go") {
        go(en.href);
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
      go(en.href);
    });
    scroll.addEventListener("auxclick", (e) => {
      if (e.button !== 1 || e.target.closest("a")) return;
      const en = entryAt(e);
      if (!en) return;
      e.preventDefault();
      go(en.href, "chrome-tab");
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
      if (topmost()) return;
      try {
        const d = JSON.parse(target.getAttribute("data-tip") ?? "{}");
        const iconHtml = d.icon ? `<span class="tip-icon">${d.icon}</span>` : "";
        const linesHtml = (d.lines || []).map((l) => `<div class="tip-line">${esc(l)}</div>`).join("");
        const warnHtml = d.warn ? `<div class="tip-warn">\u26A0 ${esc(d.warn)}</div>` : "";
        tip.innerHTML = `<div class="tip-header">${iconHtml}<span class="tip-name">${esc(d.name || "")}</span></div>${linesHtml}${warnHtml}`;
      } catch {
        tip.innerHTML = `<div class="tip-name">${esc(target.getAttribute("data-tip") ?? "")}</div>`;
      }
      raise(tip);
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
    let ctx = null;
    const closeCtx = () => ctx?.close("pick");
    scroll.addEventListener("contextmenu", (e) => {
      hideTip();
      const holder = e.target.closest("[data-idx]");
      if (!holder) return;
      const idx = parseInt(holder.dataset.idx);
      const en = ls.visible[idx];
      if (!en || en.isParent) return;
      e.preventDefault();
      const multi = ls.selSet.size > 1 && ls.selSet.has(idx);
      if (!multi) sel.setSel(idx);
      ctxMenu.innerHTML = multi ? [
        `<div class="row fe-ctx-item" data-act="cp-paths">${UI_ICON.copy}<span>Copy ${ls.selSet.size} paths</span></div>`,
        `<div class="row fe-ctx-item" data-act="cp-names">${UI_ICON.copy}<span>Copy ${ls.selSet.size} names</span></div>`
      ].join("") : [
        canPreview(en) ? `<div class="row fe-ctx-item" data-act="pv">${UI_ICON.eye}<span>Preview</span><span class="fe-ctx-key">Space</span></div>` : "",
        `<div class="row fe-ctx-item" data-act="cp-path">${UI_ICON.copy}<span>Copy path</span><span class="fe-ctx-key">y</span></div>`,
        `<div class="row fe-ctx-item" data-act="cp-name">${UI_ICON.copy}<span>Copy name</span><span class="fe-ctx-key">\u21E7Y</span></div>`,
        `<div class="fe-ctx-sep"></div>`,
        `<div class="row fe-ctx-item" data-act="save">${PI.bm}<span>${isSaved(fullPath(rawPath, en)) ? "Unsave" : "Save"}</span></div>`,
        `<div class="row fe-ctx-item" data-act="term">${UI_ICON.terminal}<span>Open in terminal</span></div>`
      ].join("");
      ctxMenu.dataset.idx = String(idx);
      ctx = openLayer(ctxMenu, { kind: "popover", place: "point", point: { x: e.clientX, y: e.clientY }, origin: holder, role: "menu", group: "menu" });
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
      else if (item.dataset.act === "save") {
        const now = toggleSaved(fp, en.name);
        app.refreshSaved();
        toast(now ? `Saved ${en.name}` : `Removed ${en.name} from Saved`);
      } else if (item.dataset.act === "cp-paths") sel.copySelection();
      else if (item.dataset.act === "cp-names") {
        const names = [...ls.selSet].sort((a, b) => a - b).map((i3) => ls.visible[i3].name).join("\n");
        copyToClipboard(names).then(() => toast(`Copied ${ls.selSet.size} names`));
      }
    });
    const onListing = () => !app.fileMode;
    const lead = () => ls.selIdx >= 0 ? ls.visible[ls.selIdx] : null;
    const leadRow = () => scroll.querySelector(`[data-idx="${ls.selIdx}"]`);
    const shown = () => ls.visible.map((_, i3) => i3).filter((i3) => sel.selectable(i3) || ls.visible[i3].isParent);
    const perPage = () => Math.max(1, Math.floor(scroll.clientHeight / (leadRow()?.offsetHeight || 32)) - 1);
    const jump = (to) => {
      const list3 = shown();
      if (list3.length) sel.setSel(list3[Math.max(0, Math.min(list3.length - 1, to))]);
    };
    const pos = () => shown().indexOf(ls.selIdx);
    bind("to-listing", () => {
      document.activeElement?.blur();
      if (ls.selIdx < 0) sel.moveSel(1);
      else sel.setSel(ls.selIdx);
    }, onListing);
    bind("first", () => jump(0), onListing);
    bind("last", () => jump(Infinity), onListing);
    bind("page-up", () => jump(pos() - perPage()), onListing);
    bind("page-down", () => jump(Math.max(0, pos()) + perPage()), onListing);
    const extend = (dir) => {
      const list3 = shown();
      const to = list3[list3.indexOf(ls.selIdx) + dir];
      if (to !== void 0 && sel.selectable(to)) {
        if (ls.anchor < 0) ls.anchor = ls.selIdx;
        sel.rangeSel(to);
      }
    };
    bind("extend-up", () => extend(-1), onListing);
    bind("extend-down", () => extend(1), onListing);
    bind("open-bg", () => {
      const en = lead();
      if (en && !en.isParent) {
        app.strip.open(fullPath(rawPath, en), true);
        toast(`Kept ${en.name} as a tab`);
      }
    }, () => onListing() && !!lead());
    bind("open-chrome", () => {
      const en = lead();
      if (en) go(en.href, "chrome-tab");
    }, () => onListing() && !!lead());
    bind("copy-path", () => {
      const en = lead();
      if (en) copyText(fullPath(rawPath, en));
    }, () => onListing() && !!lead());
    bind("up", () => app.goUp());
    bind("move", (key) => sel.moveSel(key === "\u2191" ? -1 : 1), onListing);
    bind("pv-step", (key) => sel.previewStep(key === "\u2191" || key === "\u2190" ? -1 : 1), () => isPreviewOpen());
    bind("open", () => {
      const en = lead();
      if (en) go(en.href);
    }, () => onListing() && !!lead());
    bind("look", () => {
      const en = lead();
      if (en) sel.tryPreview(en);
    }, () => onListing() && !!lead());
    bind("select-all", () => sel.selectAll(), onListing);
    bind("copy-paths", () => sel.copySelection(), () => onListing() && ls.selSet.size > 0);
    bind("pv-close", () => closePreview(), () => isPreviewOpen());
    bind("pv-open", () => {
      const en = previewEntry();
      if (en) go(en.href);
    }, () => isPreviewOpen() && !!previewEntry());
    bind("pv-tab", () => keepPreviewedAsTab(), () => isPreviewOpen());
    bind("copy-name", () => {
      const en = lead();
      if (en) copyText(en.name);
    }, () => onListing() && !!lead());
    bind("menu", () => {
      const row2 = leadRow();
      if (!row2) return;
      const r = row2.getBoundingClientRect();
      row2.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.left + 40, clientY: r.top + r.height }));
      ctxMenu.querySelector(".fe-ctx-item")?.classList.add("kb");
    }, () => onListing() && !!lead());
    const treeToggle = (open) => {
      const t = leadRow()?.querySelector(".fe-tree-toggle");
      if (t && t.getAttribute("aria-expanded") === "true" !== open) t.click();
    };
    bind("tree-open", () => treeToggle(true), () => onListing() && fe.dataset.view === "tree" && !!lead()?.isDir);
    bind("tree-close", () => treeToggle(false), () => onListing() && fe.dataset.view === "tree" && !!lead()?.isDir);
    bind("filter", () => {
      if (app.fileMode) return;
      const s = el("fe-search");
      s.focus({ preventScroll: true });
      s.select();
    }, onListing);
    bind("filter-panel", () => el("fe-filter-btn").click(), onListing);
    bind("hidden", () => el("fe-hidden-btn").click(), onListing);
    for (const v of ["details", "list", "tree", "tiles", "icons"]) {
      bind("view-" + v, () => document.querySelector(`#fe-view-group [data-v="${v}"]`)?.click(), onListing);
    }
    const sortBy = (col) => {
      const s = getSortConfig();
      app.setOrder({ col, dir: s.col === col && s.dir === "asc" ? "desc" : "asc" }, getGroupMode());
    };
    bind("sort-name", () => sortBy("name"), onListing);
    bind("sort-date", () => sortBy("date"), onListing);
    bind("sort-size", () => sortBy("size"), onListing);
    bind("sort-type", () => sortBy("type"), onListing);
    bind("sort-rev", () => {
      const s = getSortConfig();
      app.setOrder({ col: s.col ?? "name", dir: s.dir === "asc" ? "desc" : "asc" }, getGroupMode());
    }, onListing);
    const GROUPS2 = ["none", "folders-first", "files-first", "ext", "type"];
    bind("group", () => {
      const next = GROUPS2[(GROUPS2.indexOf(getGroupMode()) + 1) % GROUPS2.length];
      app.setOrder(getSortConfig(), next);
      toast(`Grouping: ${next.replace("-", " ")}`);
    }, onListing);
    const detail = (to) => {
      const d = el("fe-density");
      d.value = String(Math.max(1, Math.min(5, to(Number(d.value)))));
      d.dispatchEvent(new Event("change"));
    };
    bind("zoom-in", () => detail((d) => d - 1), onListing);
    bind("zoom-out", () => detail((d) => d + 1), onListing);
    bind("zoom-reset", () => detail(() => 3), onListing);
    addPaletteSource(() => onListing() ? ls.all.filter((en) => !en.isParent).slice(0, 400).map((en) => ({
      title: en.name,
      sub: en.isDir ? "folder here" : "file here",
      group: "This folder",
      icon: getIcon(en, app.iconRules),
      run: () => {
        go(en.href);
      },
      runAlt: () => {
        app.strip.open(fullPath(rawPath, en), true);
        toast(`Kept ${en.name} as a tab`);
      }
    })) : []);
  }

  // src/areas.ts
  var list2 = [];
  function declareArea(a) {
    list2.push(a);
    if (a.roving) for (const r of document.querySelectorAll(a.root)) rovingFocus(r, a.roving.items, { axis: a.roving.axis, wrap: a.roving.wrap });
  }
  function areaOf(x) {
    return x && list2.find((a) => x.closest(a.root)) || null;
  }
  function areaNamed(name) {
    return list2.find((a) => a.name === name) ?? null;
  }
  function cycleArea(from, dir, isHome) {
    let i3 = list2.findIndex((a) => (from ? !!from.closest(a.root) : false) || from === document.body && isHome(a));
    for (let n = 0; n < list2.length; n++) {
      i3 = (i3 + dir + list2.length) % list2.length;
      if (list2[i3].enter()) return list2[i3];
    }
    return null;
  }
  var allRoots = () => list2.map((a) => a.root).join(", ");

  // src/tooltip.ts
  var DELAY = 350;
  function tipParts(text, keys2 = []) {
    let t = text;
    for (const k of keys2) {
      const q = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      t = t.replace(new RegExp(`\\s*\\((?:press\\s+)?${q}\\)`, "g"), "");
    }
    const nl = t.indexOf("\n");
    if (nl >= 0) return { title: t.slice(0, nl).trim(), sub: t.slice(nl + 1).trim(), keys: keys2 };
    const dot = t.indexOf(" \xB7 ");
    if (dot >= 0) return { title: t.slice(0, dot).trim(), sub: t.slice(dot + 3).trim(), keys: keys2 };
    const comma = t.indexOf(", ");
    if (comma > 0 && t.slice(0, comma).split(" ").length <= 3) return { title: t.slice(0, comma).trim(), sub: t.slice(comma + 2).trim(), keys: keys2 };
    return { title: t.trim(), sub: "", keys: keys2 };
  }
  var keysFor = () => [];
  function setTooltipKeys(fn) {
    keysFor = fn;
  }
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
      const anchor = target.closest(".fe-tab") || target.dataset.tip === "problem" ? r.left : r.left + r.width / 2 - t.width / 2;
      const left = Math.min(Math.max(4, anchor), innerWidth - t.width - 4);
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
        if (el2.dataset.tip === "problem") {
          const err = el2.classList.contains("err");
          const msgs = text.split("\n").map((m) => m.replace(/^Line \d+:\s*/, ""));
          tip.className = `rich problem ${err ? "err" : "warn"}`;
          tip.innerHTML = `<span class="fe-hint-h"><b>${err ? "Error" : "Warning"}</b>${el2.dataset.line ? `<span class="fe-hint-ln">line ${esc(el2.dataset.line)}</span>` : ""}</span>` + msgs.map((m) => `<span class="fe-hint-s">${esc(m)}</span>`).join("");
          raise(tip);
          tip.classList.add("on");
          place();
          return;
        }
        const keys2 = keysFor(el2);
        const icon2 = el2.matches('button, a, [role="button"]') ? el2.querySelector("svg") : null;
        if (keys2.length || icon2) {
          const p = tipParts(text, keys2);
          tip.className = "rich";
          tip.innerHTML = `<span class="fe-hint-h">${icon2 ? icon2.outerHTML : ""}<b>${esc(p.title)}</b></span>` + (p.sub ? `<span class="fe-hint-s">${esc(p.sub)}</span>` : "") + (p.keys.length ? `<span class="fe-hint-k">${p.keys.map((k) => k.split(" ").map((x) => `<kbd>${esc(x)}</kbd>`).join("")).join("<i>or</i>")}</span>` : "");
        } else {
          tip.className = "";
          tip.textContent = text;
        }
        raise(tip);
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

  // src/focus-nav.ts
  var visible = (x) => !!x && x.checkVisibility();
  var isTyping = (x) => !!x && (["INPUT", "TEXTAREA", "SELECT"].includes(x.tagName) || x.isContentEditable) && !x.type?.match(/^(checkbox|radio|range|button)$/);
  var MENU_SEL = "#fe-ctx, .fe-ctx, #fe-crumb-menu, .fe-pmenu";
  var ITEM_SEL = ".fe-ctx-item, .fe-dd-item, .fe-pmenu button";
  function openMenu2() {
    return [...document.querySelectorAll(MENU_SEL)].find((m) => m.style.display !== "none" && visible(m)) ?? null;
  }
  function menuKeys(e) {
    const menu = openMenu2();
    if (!menu || !["ArrowDown", "ArrowUp", "Home", "End", "Enter"].includes(e.key)) return false;
    const items = [...menu.querySelectorAll(ITEM_SEL)].filter(visible);
    if (!items.length) return false;
    let at = items.findIndex((i3) => i3.classList.contains("kb"));
    if (e.key === "Enter") {
      if (at < 0) return false;
      e.preventDefault();
      e.stopImmediatePropagation();
      items[at].click();
      return true;
    }
    at = e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : at < 0 ? e.key === "ArrowDown" ? 0 : items.length - 1 : (at + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items.forEach((it, i3) => it.classList.toggle("kb", i3 === at));
    items[at].scrollIntoView({ block: "nearest" });
    e.preventDefault();
    e.stopImmediatePropagation();
    return true;
  }
  function initFocusNav(app) {
    const fe = app.fe;
    const dialogOpen = () => [...document.querySelectorAll(".fe-dlg")].some((d) => d.style.display !== "none");
    setContext(() => {
      const ae2 = document.activeElement;
      const blocked = paletteOpen() || !!openMenu2() || !!document.querySelector(".fe-dd-list, .fe-rule-pop");
      if (dialogOpen()) return { scopes: /* @__PURE__ */ new Set(["dialog"]), typing: isTyping(ae2), blocked };
      const scopes = /* @__PURE__ */ new Set(["any"]);
      const preview = isPreviewOpen();
      if (preview) scopes.add("preview");
      const docked = preview && !!document.getElementById("fe-qlook")?.classList.contains("side");
      if (app.fileMode && !preview) scopes.add("file");
      if (document.getElementById("fe-goto")) scopes.add("goto");
      if (visible(document.getElementById("fe-ed-bar"))) scopes.add("editor");
      const area2 = areaOf(ae2);
      if (area2?.scope) scopes.add(area2.scope);
      if (!app.fileMode && !preview && !area2?.widget) {
        scopes.add("listing");
        if (fe.dataset.view === "tree") scopes.add("tree");
      }
      if (openMenu2()) scopes.add("menu");
      return { scopes, typing: isTyping(ae2), widget: !!area2?.widget, docked, blocked };
    });
    document.addEventListener("keydown", (e) => {
      if (e.defaultPrevented) return;
      if (menuKeys(e)) return;
      dispatch(e);
    }, true);
    let lastSide = null;
    document.addEventListener("focusin", (e) => {
      const t = e.target;
      if (t.closest?.("#fe-lenses")) lastSide = t;
    });
    const sideBack = () => {
      if (lastSide && document.contains(lastSide) && visible(lastSide)) {
        lastSide.focus();
        return true;
      }
      return false;
    };
    const ROW_SEL = ".fe-si, .fe-si-link, .fe-grp > summary, .fe-nt-grp";
    const BAR_ITEMS = ':is(a[href], button, input):not([tabindex="-1"])';
    declareArea({
      name: "sidebar",
      root: "#fe-side",
      scope: "sidebar",
      widget: true,
      roving: { items: ROW_SEL, wrap: false },
      enter: () => sideBack() || focusFirst("#fe-lenses .fe-lens:not([hidden])", ROW_SEL) || focusFirst("#fe-lenses .fe-lens:not([hidden])", "input, textarea, button") || focusFirst("#fe-rail", ".fe-rail-btn.on")
    });
    declareArea({
      name: "tabs",
      root: "#fe-tabbar",
      scope: "tabs",
      widget: true,
      roving: { items: "#fe-tabs .fe-tab, #fe-tabs-end button", axis: "horizontal", wrap: false },
      enter: () => focusFirst("#fe-tabs", ".fe-tab.on") || focusFirst("#fe-tabbar", "button")
    });
    declareArea({
      name: "path",
      root: "#fe-bar",
      scope: "bar",
      widget: true,
      roving: { items: BAR_ITEMS, axis: "horizontal", wrap: false },
      enter: () => focusFirst("#fe-bc", ".fe-crumb.cur, .fe-crumb:last-of-type") || focusFirst("#fe-bar", "button")
    });
    declareArea({
      name: "toolbar",
      root: "#fe-toolbar, #fe-fp-bar",
      scope: "bar",
      widget: true,
      roving: { items: BAR_ITEMS, axis: "horizontal", wrap: false },
      enter: () => focusFirst("#fe-toolbar, #fe-fp-bar", "button")
    });
    declareArea({ name: "listing", root: "#fe-scroll, #fe-page", enter: () => {
      runCommand("to-listing");
      return true;
    } });
    declareArea({ name: "preview", root: "#fe-qlook", enter: () => isPreviewOpen() && focusFirst("#fe-qlook", "#fe-ql-close, button") });
    function focusFirst(scope, sel) {
      const root = [...document.querySelectorAll(scope)].find(visible);
      const t = root && [...root.querySelectorAll(sel)].find(visible);
      if (!t) return false;
      t.focus({ preventScroll: false });
      return true;
    }
    const cycle = (dir) => {
      if (cycleArea(document.activeElement ?? document.body, dir, (a) => a.name === "listing")) flash(document.activeElement);
    };
    function flash(x) {
      const box = x?.closest(allRoots());
      if (!box) return;
      box.classList.remove("fe-area-flash");
      void box.offsetWidth;
      box.classList.add("fe-area-flash");
    }
    bind("area-next", () => cycle(1));
    bind("area-prev", () => cycle(-1));
    const goArea = (name) => {
      areaNamed(name)?.enter();
      flash(document.activeElement);
    };
    bind("to-sidebar", () => {
      if (fe.querySelector("#fe-side")?.checkVisibility?.() === false) runCommand("sidebar");
      goArea("sidebar");
    });
    bind("to-tabs", () => goArea("tabs"));
    bind("to-toolbar", () => goArea("toolbar"));
    const ae = () => document.activeElement;
    const inArea = () => !!areaOf(ae())?.widget;
    const inSidePane = () => !!ae()?.closest("#fe-side-pane");
    bind("area-leave", () => {
      if (inSidePane()) {
        closeSideDialog();
        runCommand("to-listing");
        return;
      }
      const leave = inArea();
      app.closeSideOverlay?.();
      if (leave) {
        ae()?.blur();
        runCommand("to-listing");
      }
    }, () => inSidePane() || inArea() || !!document.querySelector("#fe-side.open"));
    const sideRow = () => ae()?.closest("#fe-lenses .fe-lens .fe-bm-item, #fe-lenses .fe-lens .fe-pl-item") ?? null;
    const inLens = () => !!ae()?.closest("#fe-lenses .fe-lens");
    const LENS_ROWS = ".fe-si, .fe-si-link, .fe-grp > summary, .fe-nt-grp";
    bind("side-bg", () => ae()?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, altKey: true })), () => inLens() && !!ae()?.matches("a"));
    const LABEL = ".fe-pl-label, .fe-nt-label";
    bind("side-rename", () => sideRow().querySelector(LABEL).dispatchEvent(new MouseEvent("dblclick", { bubbles: true })), () => !!sideRow()?.querySelector(LABEL));
    bind("side-remove", () => {
      const row2 = sideRow(), lens = row2.closest(".fe-lens");
      const rows = [...lens.querySelectorAll(LENS_ROWS)].filter(visible);
      const at = rows.indexOf(ae());
      const next = rows[at + 1] ?? rows[at - 1];
      const nextKey = next?.closest("[data-rel]")?.dataset.rel ?? next?.getAttribute("href") ?? "";
      row2.querySelector(".fe-rm-btn").click();
      const refocus = () => {
        const again = nextKey && [...lens.querySelectorAll(LENS_ROWS)].find((r) => (r.closest("[data-rel]")?.dataset.rel ?? r.getAttribute("href")) === nextKey);
        (again || (next && document.contains(next) ? next : lens.querySelector(".fe-si, .fe-si-link")))?.focus();
      };
      setTimeout(refocus, 50);
      setTimeout(() => {
        const a = ae();
        if (!a || a === document.body || !a.isConnected) refocus();
      }, 450);
    }, () => !!sideRow()?.querySelector(".fe-rm-btn"));
    bind("side-rail", () => document.querySelector("#fe-rail .fe-rail-btn.on")?.focus(), () => inLens() && !!ae()?.matches(LENS_ROWS));
    bind("side-into", () => areaNamed("sidebar")?.enter(), () => !!ae()?.closest("#fe-rail"));
    const focusedTab = () => {
      const t = ae();
      return t?.closest("#fe-tabs") && t.classList.contains("fe-tab") ? t : null;
    };
    bind("tab-focus-shift", (key) => {
      const id = focusedTab().dataset.id;
      app.strip.move(id, key === "\u21E7\u2190" ? -1 : 1);
      document.querySelector(`#fe-tabs .fe-tab[data-id="${id}"]`)?.focus();
    }, () => !!focusedTab()?.dataset.id);
    bind("tab-focus-close", () => {
      const t = focusedTab(), tabs = [...document.querySelectorAll("#fe-tabs .fe-tab")];
      const at = tabs.indexOf(t);
      const nextId = (tabs[at + 1] ?? tabs[at - 1])?.dataset.id;
      t.querySelector(".fe-tab-x").click();
      setTimeout(() => document.querySelector(`#fe-tabs .fe-tab[data-id="${nextId}"]`)?.focus(), 30);
    }, () => !!focusedTab()?.querySelector(".fe-tab-x"));
    bind("tab-focus-menu", () => {
      const t = focusedTab(), r = t.getBoundingClientRect();
      t.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.left + 8, clientY: r.bottom }));
    }, () => !!focusedTab()?.dataset.id);
    const crumbDd = () => {
      const t = ae();
      if (!t?.closest("#fe-bc")) return null;
      return t.matches(".fe-crumb-dd") ? t : t.nextElementSibling?.matches(".fe-crumb-dd") ? t.nextElementSibling : null;
    };
    bind("crumb-menu", () => crumbDd()?.click(), () => !!crumbDd());
    const click = (id, init = {}) => () => {
      const b = document.getElementById(id);
      if (b && !b.hidden) b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ...init }));
    };
    bind("palette", () => openPalette());
    const stripKey = (key) => () => {
      app.strip.handleKey(new KeyboardEvent("keydown", { key }));
    };
    bind("settings", () => app.openSettings());
    bind("keys", () => app.openHelp("keys"));
    bind("tab-keep", stripKey("t"));
    bind("tab-close", stripKey("w"));
    bind("tab-pin", stripKey("p"));
    bind("tab-step", (key) => stripKey(key === "[" ? "[" : "]")());
    bind("tab-jump", (key) => stripKey(key ?? "1")());
    bind("tab-reopen", stripKey("T"));
    bind("new-note", () => app.newNote(), () => !!app.settings.notesRoot);
    bind("fp-raw", () => app.filePage?.toggleRaw(), () => !!app.filePage);
    bind("fp-edit", () => app.filePage?.edit(), () => !!app.filePage);
    const noteBtn = (act) => document.querySelector(`#fe-ed-bar [data-act="${act}"]`);
    bind("note-rename", () => noteAction("rename"), () => visible(noteBtn("rename")));
    bind("note-delete", () => noteAction("delete"), () => visible(noteBtn("delete")));
    bind("goto-bg", gotoBackground, () => !!document.getElementById("fe-goto"));
    const commentable = () => !!app.filePage?.commentable();
    bind("fp-comment", () => app.filePage?.comment("comment"), commentable);
    bind("fp-cm-reply", () => app.filePage?.comment("reply"), commentable);
    bind("fp-comments", () => app.filePage?.comment("panel"), commentable);
    bind("fp-cm-step", (key) => app.filePage?.comment(key === "\u2325\u2191" ? "prev" : "next"), commentable);
    bind("fp-cm-clear", () => app.filePage?.comment("clear"), () => !!app.filePage?.commentHeld() && !ae()?.closest("#fe-cm"));
    bind("fp-find", () => document.getElementById("fe-ff-q")?.focus(), () => app.fileMode && !app.filePage?.editing());
    bind("to-path", () => {
      focusFirst("#fe-bc", "a.fe-crumb:last-of-type, .fe-crumb.cur, a");
      flash(document.activeElement);
    });
    bind("deep", click("fe-deep-btn"), () => !app.fileMode);
    bind("sidebar", click("fe-side-toggle"));
    bind("theme", click("fe-theme-btn"));
    bind("path", click("fe-open-path"));
    bind("open-pick", click("fe-open-pick"));
    bind("save", click("fe-bm-btn"), () => !!document.getElementById("fe-bm-btn"));
    bind("terminal", click("fe-term-btn"));
    bind("terminal-copy", click("fe-term-btn", { shiftKey: true }));
    const moveHere = (dir) => {
      const id = document.querySelector("#fe-tabs .fe-tab.on")?.dataset.id;
      if (id) app.strip.move(id, dir);
    };
    bind("tab-left", () => moveHere(-1), () => !!document.querySelector('#fe-tabs .fe-tab.on[data-id]:not([data-id=""])'));
    bind("tab-right", () => moveHere(1), () => !!document.querySelector('#fe-tabs .fe-tab.on[data-id]:not([data-id=""])'));
    bind("tab-list", click("fe-tab-list"), () => !document.getElementById("fe-tab-list")?.hidden);
    bind("home", () => {
      const h = homeDir(app.rawPath);
      if (h) go(fileHref(h + "/"));
    }, () => !!homeDir(app.rawPath));
    const LENSES = [["lens-places", "places"], ["lens-saved", "saved"], ["lens-notes", "notes"], ["lens-recent", "history"], ["lens-search", "search"], ["lens-ask", "ask"], ["lens-docs", "comments"]];
    for (const [id, lens] of LENSES) bind(id, () => {
      if (!sidebarShown()) runCommand("sidebar");
      app.showLens?.(lens);
      setTimeout(() => {
        const box = document.getElementById(`fe-lens-${lens}`);
        (box?.querySelector('input[type="search"], textarea, .fe-tl-input') ?? box?.querySelector(".fe-si, .fe-si-link"))?.focus();
      }, 60);
    }, () => !document.getElementById(`fe-rail-${lens}`)?.hidden);
    const openLens = () => document.querySelector("#fe-lenses .fe-lens:not([hidden])");
    const focusedRow = () => document.activeElement?.closest("#fe-lenses .fe-si-link, #fe-lenses a.fe-si") ?? null;
    const rowPath = (a) => decodeURIComponent((a.getAttribute("href") || "").slice(7));
    bind("lens-filter", () => {
      const box = [...openLens()?.querySelectorAll('input[type="text"], input[type="search"]') ?? []].find(visible);
      box?.focus();
      box?.select();
    }, () => !!openLens());
    bind("lens-tags", () => {
      if (!sidebarShown()) runCommand("sidebar");
      const chip = [...openLens()?.querySelectorAll(".fe-lens-tags .chip, .fe-lens-tags button") ?? []].find(visible);
      chip?.focus();
    }, () => !!openLens()?.querySelector(".fe-lens-tags"));
    document.querySelectorAll("#fe-lenses .fe-lens-tags, #fe-docs-list .fe-lens-tags").forEach((r) => rovingFocus(r, ".chip, button", { axis: "horizontal" }));
    bind("side-look", () => {
      const a = focusedRow(), path = rowPath(a), name = path.split("/").pop() || path;
      openPreview({ name, href: fileHref(path), isDir: false, isParent: false, isHidden: false, rawBytes: -1, dateMs: NaN, dateStr: "" });
    }, () => {
      const a = focusedRow();
      return !!a && !rowPath(a).endsWith("/") && !rowPath(a).includes("#");
    });
    bind("side-chrome", () => focusedRow().dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, metaKey: true })), () => !!focusedRow());
    bind("side-props", () => {
      const row2 = document.activeElement.closest(".fe-bm-item, .fe-pl-item, .fe-nt-item");
      row2.querySelector(".fe-tag-btn, .fe-nt-props").click();
    }, () => !!document.activeElement?.closest(".fe-bm-item, .fe-pl-item, .fe-nt-item")?.querySelector(".fe-tag-btn, .fe-nt-props"));
    const pv = () => isPreviewOpen();
    bind("pv-dock", click("fe-ql-dock"), pv);
    bind("pv-copy", click("fe-ql-copy"), pv);
    bind("pv-ask", () => document.getElementById("fe-ql-ai-q")?.focus(), () => pv() && visible(document.getElementById("fe-ql-ai-q")));
    bind("fp-toc", click("fe-fp-toc"), () => app.fileMode && visible(document.getElementById("fe-fp-toc")));
    bind("fp-width", click("fe-fp-column"), () => app.fileMode && visible(document.getElementById("fe-fp-column")));
    const placeIcon = (p) => p.endsWith("/") ? PI.folder : PI.docs;
    addPaletteSource(() => app.strip.state().list.map((t, i3) => ({
      title: t.label,
      sub: i3 < 9 ? `tab ${i3 + 1}` : "tab",
      group: "Tabs",
      icon: placeIcon(t.path),
      run: () => app.strip.go(t.path)
    })));
    addPaletteSource(() => getSaved().map((p) => ({
      title: p.label || p.path,
      sub: (p.tags ?? []).map((t) => "#" + t).join(" ") || "saved",
      group: "Saved",
      icon: PI.bm,
      run: () => app.strip.go(p.path),
      runAlt: () => app.strip.open(p.path, true)
    })));
    addPaletteSource(() => getRecents().slice(0, 30).map((r) => ({
      title: r.path.split("/").filter(Boolean).pop() || "/",
      sub: r.path,
      group: "Recent",
      icon: PI.recent,
      run: () => app.strip.go(r.path),
      runAlt: () => app.strip.open(r.path, true)
    })));
    const KEY_OF = {
      "fe-side-toggle": "sidebar",
      "fe-theme-btn": "theme",
      "fe-help-btn": "keys",
      "fe-settings-btn": "settings",
      "fe-term-btn": "terminal",
      "fe-bm-btn": "save",
      "fe-open-pick": "open-pick",
      "fe-open-path": "path",
      "fe-tab-list": "tab-list",
      "fe-filter-btn": "filter-panel",
      "fe-hidden-btn": "hidden",
      "fe-search": "filter",
      "fe-fp-raw": "fp-raw",
      "fe-fp-edit": "fp-edit",
      "fe-fp-toc": "fp-toc",
      "fe-fp-column": "fp-width",
      "fe-ql-dock": "pv-dock",
      "fe-ql-copy": "pv-copy",
      "fe-ql-tab": "pv-tab",
      "fe-ql-go": "pv-open",
      "fe-ql-close": "pv-close",
      "fe-rail-places": "lens-places",
      "fe-rail-saved": "lens-saved",
      "fe-rail-notes": "lens-notes",
      "fe-rail-history": "lens-recent",
      "fe-rail-search": "lens-search",
      "fe-rail-ask": "lens-ask",
      "fe-rail-comments": "lens-docs"
    };
    const keyOf = (cmd) => KEYMAP.find((d) => d.id === cmd)?.keys[0];
    setTooltipKeys((x) => {
      const cmd = KEY_OF[x.id] ?? (x.matches("#fe-view-group [data-v]") ? "view-" + x.dataset.v : "");
      return cmd && KEYMAP.find((d) => d.id === cmd)?.keys || [];
    });
    let hintTimer = null;
    let hints = null;
    const hideHints = () => {
      if (hintTimer) clearTimeout(hintTimer);
      hintTimer = null;
      hints?.remove();
      hints = null;
    };
    function showHints() {
      hideHints();
      hints = document.createElement("div");
      hints.className = "fe-hints";
      const spots = [];
      for (const [id, cmd] of Object.entries(KEY_OF)) {
        const x = document.getElementById(id);
        const k = keyOf(cmd);
        if (visible(x) && k) spots.push([x, k]);
      }
      document.querySelectorAll("#fe-view-group [data-v]").forEach((b) => {
        const k = keyOf("view-" + b.dataset.v);
        if (visible(b) && k) spots.push([b, k]);
      });
      document.querySelectorAll("#fe-tabs .fe-tab").forEach((t, i3) => {
        if (i3 < 9 && visible(t)) spots.push([t, String(i3 + 1)]);
      });
      hints.innerHTML = spots.map(([x, k]) => {
        const r = x.getBoundingClientRect();
        return `<kbd style="left:${Math.round(r.left + r.width / 2)}px;top:${Math.round(r.bottom - 6)}px">${esc(k)}</kbd>`;
      }).join("") + `<div class="fe-hints-tip"><kbd>\u2318K</kbd> every command \xB7 <kbd>?</kbd> keyboard map \xB7 <kbd>F6</kbd> next area</div>`;
      fe.appendChild(hints);
      raise(hints);
    }
    document.addEventListener("keydown", (e) => {
      if (e.key === "Alt" && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.repeat) {
        hideHints();
        hintTimer = setTimeout(showHints, 450);
      } else hideHints();
    }, true);
    document.addEventListener("keyup", (e) => {
      if (e.key === "Alt") hideHints();
    }, true);
    window.addEventListener("blur", hideHints);
    document.addEventListener("pointerdown", hideHints, true);
  }

  // src/sidebar.ts
  var lensPref = textPref("bfb-lens-v1", "notes");
  function initLenses(app) {
    const rail = el("fe-rail");
    const btns = els("#fe-rail .fe-rail-btn");
    const lenses = els("#fe-lenses .fe-lens");
    const show = (lens, paint = (f) => f()) => {
      const usable = btns.filter((b) => !b.hidden).map((b) => b.dataset.lens);
      const pick2 = usable.includes(lens) ? lens : "notes";
      for (const b of btns) {
        const on = b.dataset.lens === pick2;
        b.setAttribute("aria-selected", String(on));
        b.tabIndex = on ? 0 : -1;
      }
      for (const l of lenses) l.hidden = l.dataset.lens !== pick2;
      paint(() => {
        for (const b of btns) {
          const on = b.dataset.lens === pick2;
          b.classList.toggle("on", on);
          b.title = on ? "" : b.dataset.hint ?? "";
          b.setAttribute("aria-label", b.dataset.hint ?? "");
        }
        fitBar();
      });
      document.dispatchEvent(new CustomEvent("bfb-lens", { detail: pick2 }));
    };
    function fitBar() {
      rail.classList.remove("tight", "tighter");
      const over = () => rail.scrollWidth > rail.clientWidth + 1;
      if (!over()) return;
      rail.classList.add("tight");
      if (over()) rail.classList.add("tighter");
    }
    new ResizeObserver(fitBar).observe(rail);
    for (const b of btns) b.prepend(Object.assign(document.createElement("span"), { className: "fe-rail-hl" }));
    const hlRect = () => rail.querySelector(".fe-rail-btn.on .fe-rail-hl")?.getBoundingClientRect();
    const switchTo = (lens) => show(lens, (f) => {
      const from = hlRect();
      f();
      const to = hlRect(), hl = rail.querySelector(".fe-rail-btn.on .fe-rail-hl");
      if (!from || !to || !hl || !to.width || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      hl.animate(
        [{ transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})` }, { transform: "none" }],
        { duration: 180, easing: "cubic-bezier(.2, .8, .2, 1)" }
      );
    });
    app.showLens = (lens, hideHistory) => {
      if (hideHistory !== void 0) el("fe-rail-history").hidden = hideHistory;
      show(lens ?? lensPref.get());
    };
    const side = el("fe-side");
    const narrow = () => matchMedia("(max-width: 520px)").matches;
    const closeOverlay = () => side.classList.remove("open");
    const pick = (b) => {
      lensPref.set(b.dataset.lens);
      switchTo(b.dataset.lens);
    };
    rail.addEventListener("click", (e) => {
      const b = e.target.closest(".fe-rail-btn");
      if (!b) return;
      if (narrow()) side.classList.toggle("open", !(b.classList.contains("on") && side.classList.contains("open")));
      pick(b);
    });
    document.addEventListener("pointerdown", (e) => {
      if (side.classList.contains("open") && !side.contains(e.target)) closeOverlay();
    });
    app.closeSideOverlay = () => {
      const was = side.classList.contains("open");
      closeOverlay();
      return was;
    };
    const step2 = (dir) => {
      const usable = btns.filter((b) => !b.hidden);
      const i3 = usable.findIndex((b) => b.classList.contains("on"));
      pick(usable[(i3 + dir + usable.length) % usable.length]);
    };
    rovingFocus(rail, ".fe-rail-btn", { axis: "both", onMove: pick });
    let wheelAt = 0, steppedAt = 0;
    rail.addEventListener("wheel", (e) => {
      const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (!d) return;
      e.preventDefault();
      const notch = e.deltaMode !== 0 || Math.abs(d) >= 40;
      const quiet = e.timeStamp - wheelAt;
      wheelAt = e.timeStamp;
      if (notch ? e.timeStamp - steppedAt < 120 : quiet < 220) return;
      steppedAt = e.timeStamp;
      step2(d > 0 ? 1 : -1);
    }, { passive: false });
    const box = document.querySelector(".fe-lens-box");
    const tagRow = document.getElementById("fe-lens-tags");
    document.addEventListener("bfb-lens", (e) => {
      const lens = e.detail;
      const tools = document.querySelector(`#fe-lens-${lens} .fe-lens-tools`);
      if (!box || !tagRow || !tools || lens !== "saved" && lens !== "notes") return;
      tools.append(box);
      tools.after(tagRow);
    });
    lensPref.onChange(() => show(lensPref.get()));
    show(lensPref.get());
  }
  function initSidebar(app) {
    const { rawPath, settings, toast } = app;
    initLenses(app);
    const collapsedPref = setPref("bfb-sidebar-collapsed-v1");
    const sections = els("#fe-side .fe-sec[data-collapse]");
    const collapsed = () => collapsedPref.get();
    const applyCollapsed = (keys2) => {
      for (const section of sections) {
        const key = section.dataset.collapse;
        const isCollapsed = keys2.has(key);
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
      toggle.innerHTML = DISCLOSE;
      toggle.append(labelNode);
      toggle.addEventListener("click", () => {
        const keys2 = collapsed();
        if (section.classList.contains("fe-collapsed")) keys2.delete(key);
        else keys2.add(key);
        collapsedPref.set(keys2);
        toggle.setAttribute("aria-expanded", String(!keys2.has(key)));
        foldTo(section, () => {
          section.classList.toggle("fe-collapsed");
        }, () => applyCollapsed(keys2));
      });
      header.prepend(toggle);
    }
    applyCollapsed(collapsed());
    collapsedPref.onChange(() => applyCollapsed(collapsed()));
    const svList = el("fe-sv-list");
    const svFilter = el("fe-sv-filter");
    let svHits = /* @__PURE__ */ new Map();
    const card3 = document.createElement("div");
    card3.id = "fe-sv-card";
    card3.hidden = true;
    el("fe").append(card3);
    let cardTimer = null, cardFor = null;
    function hideCard() {
      if (cardTimer) {
        clearTimeout(cardTimer);
        cardTimer = null;
      }
      card3.hidden = true;
      cardFor = null;
    }
    function showCard(item) {
      const p = getSaved().find((x) => x.path === item.dataset.path);
      if (!p) return;
      const colour = new Map(getTags().map((t) => [t.name, t.color]));
      const home = homeDir(rawPath);
      const where = isViewPath(p.path) ? "Saved view in " + p.path.split("#")[0] : p.path;
      card3.innerHTML = `<b>${esc(p.label || where)}</b><span class="fe-svc-path">${esc(home && where.startsWith(home) ? "~" + where.slice(home.length) : where)}</span>` + ((p.tags ?? []).length ? `<span class="fe-svc-tags">${p.tags.map((t) => `<span class="chip fe-lens-tag"><i style="background:${esc(colour.get(t) ?? "#8b949e")}"></i>${esc(t)}</span>`).join("")}</span>` : "") + `<span class="fe-svc-hint">Double-click to rename \xB7 drag to reorder</span>`;
      const r = item.getBoundingClientRect();
      card3.hidden = false;
      raise(card3);
      const h = card3.offsetHeight, w = card3.offsetWidth;
      const sideRight = el("fe-side").getBoundingClientRect().right;
      if (sideRight + 8 + w <= innerWidth - 8) {
        card3.style.left = `${Math.round(sideRight + 8)}px`;
        card3.style.top = `${Math.round(Math.max(8, Math.min(r.top - 4, innerHeight - h - 8)))}px`;
      } else {
        card3.style.left = `${Math.round(r.left + 24)}px`;
        card3.style.top = `${Math.round(r.bottom + h + 8 > innerHeight ? r.top - h - 4 : r.bottom + 4)}px`;
      }
      cardFor = item;
    }
    svList.addEventListener("pointerover", (e) => {
      const item = e.target.closest(".fe-pl-item");
      if (item === cardFor) {
        if (cardTimer) {
          clearTimeout(cardTimer);
          cardTimer = null;
        }
        return;
      }
      if (cardTimer) clearTimeout(cardTimer);
      if (!item || item.classList.contains("dragging") || item.querySelector(".editing")) {
        cardTimer = setTimeout(hideCard, 150);
        return;
      }
      cardTimer = setTimeout(() => {
        cardTimer = null;
        hideCard();
        showCard(item);
      }, card3.hidden ? 450 : 120);
    });
    svList.addEventListener("pointerleave", () => {
      if (cardTimer) clearTimeout(cardTimer);
      cardTimer = setTimeout(hideCard, 200);
    });
    svList.addEventListener("scroll", hideCard, true);
    svList.addEventListener("pointerdown", hideCard);
    svList.addEventListener("dragstart", hideCard);
    let dragSrc = null;
    const lensNotes = { count: 0, tags: [] };
    function syncStar() {
      const on = getSaved().some((p) => samePlace(p.path, rawPath));
      const btn = el("fe-bm-btn");
      btn.classList.toggle("on", on);
      const what = app.fileMode ? "file" : "folder";
      btn.title = on ? `Remove this ${what} from Saved` : `Save this ${what} (sidebar)`;
      el("fe-bm-path").setAttribute("fill", on ? "currentColor" : "none");
    }
    function refreshSaved() {
      hideCard();
      svList.innerHTML = renderSavedList(getSaved(), getTags(), rawPath, svFilter.value, foldedGroups(), svHits);
      attachSavedEvents();
      syncStar();
      syncLens();
    }
    const openLens = () => document.querySelector("#fe-rail .fe-rail-btn.on")?.dataset.lens;
    function syncLens() {
      const box = document.getElementById("fe-lens-filter");
      const row2 = document.getElementById("fe-lens-tags");
      if (!box || !row2) return;
      const inNotes = openLens() === "notes";
      const colour = new Map(getTags().map((t) => [t.name, t.color]));
      const names = [...new Set(inNotes ? lensNotes.tags : getSaved().flatMap((p) => p.tags ?? []))].sort();
      const on = box.value.trim().toLowerCase();
      row2.hidden = !names.length;
      row2.innerHTML = names.map((n) => `<button type="button" class="chip fe-lens-tag${on === "#" + n.toLowerCase() ? " on" : ""}" aria-pressed="${on === "#" + n.toLowerCase()}" data-tag="${esc(n)}" style="--chip:${esc(colour.get(n) ?? "#8b949e")}" title="Show only items tagged ${esc(n)}"><i style="background:${esc(colour.get(n) ?? "#8b949e")}"></i>${esc(n)}</button>`).join("");
    }
    const foldedGroups = getFoldedGroups;
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
      els("details.fe-grp", svList).forEach((d) => d.querySelector("summary").addEventListener("click", (e) => {
        if (e.target.closest(".fe-sv-dot")) return;
        e.preventDefault();
        if (!svFilter.value.trim()) {
          const folded = foldedGroups();
          if (d.open) folded.add(d.dataset.tag);
          else folded.delete(d.dataset.tag);
          saveFoldedGroups(folded);
        }
        foldTo(d, () => {
          d.open = !d.open;
        });
      }));
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
      const fresh = els(".fe-pl-item", svList).find((i3) => samePlace(i3.dataset.path, rawPath));
      const lbl = fresh?.querySelector(".fe-pl-label");
      if (lbl) lbl.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    }
    el("fe-sv-add").addEventListener("click", () => addCurrentFolder(true));
    el("fe-bm-btn").addEventListener("click", () => {
      if (getSaved().some((p) => samePlace(p.path, rawPath))) {
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
    const noteFoldsPref = setPref("bfb-notes-folded-v1");
    const noteFolds = () => noteFoldsPref.get();
    ntList.addEventListener("click", (e) => {
      const g = e.target.closest(".fe-nt-grp");
      if (!g) return;
      const body = g.nextElementSibling;
      const folds = noteFolds(), key = g.dataset.grp;
      if (folds.has(key)) folds.delete(key);
      else folds.add(key);
      const open = !folds.has(key);
      g.setAttribute("aria-expanded", String(open));
      g.title = `${open ? "Fold" : "Show"} ${g.dataset.label}`;
      noteFoldsPref.set(folds);
      foldTo(body, () => {
        body.hidden = !body.hidden;
      });
    });
    let bodyHits = /* @__PURE__ */ new Map();
    const shownNotes = () => {
      const byMeta = filterNotes(allNotes, ntFilter.value);
      return [...byMeta, ...allNotes.filter((n) => bodyHits.has(n.rel) && !byMeta.includes(n))];
    };
    function renderNotes(root) {
      if (ntList.querySelector(".fe-nt-label.editing")) return;
      lensNotes.count = allNotes.length;
      lensNotes.tags = [...new Set(allNotes.flatMap((n) => n.tags ?? []))];
      syncLens();
      const shown = shownNotes();
      ntHint.textContent = ntFilter.value.trim() ? `${shown.length} of ${allNotes.length} notes in ${root}` : `${allNotes.length} note${allNotes.length !== 1 ? "s" : ""} in ${root}`;
      const row2 = (n) => {
        const c = colorName(n.color);
        return `
          <div class="row fe-bm-item fe-nt-item${n.pinned ? " pinned" : ""}${c ? " coloured" : ""}${(n.tags ?? []).length ? " two" : ""}" data-rel="${esc(n.rel)}"${c ? ` style="--c:var(--nc-${c})"` : ""}>
            <a href="${esc(fileHref(root + "/" + n.rel))}" class="fe-si-link" title="${esc(n.rel)}">
              ${PI.docs ?? PI.folder}${noteRowText(n)}${bodyHits.has(n.rel) ? `<span class="fe-nt-hit" title="${esc(bodyHits.get(n.rel))}">${esc(bodyHits.get(n.rel))}</span>` : ""}
            </a>
            <span class="fe-nt-acts">
              <button class="btn fe-nt-props" data-icon data-size="sm" data-rel="${esc(n.rel)}" title="Colour, pin and tags" aria-label="Colour, pin and tags for ${esc(n.title || noteTitle(n.rel))}">${UI_ICON.palette}</button>
              <button class="btn fe-nt-tab" data-icon data-size="sm" data-rel="${esc(n.rel)}" title="Open in a page tab" aria-label="Open ${esc(n.title || noteTitle(n.rel))} in a page tab">${UI_ICON.tab}</button>
              <button class="btn fe-rm-btn" data-icon data-size="sm" data-tone="danger" data-rel="${esc(n.rel)}" title="Move to .trash" aria-label="Move ${esc(n.title || noteTitle(n.rel))} to .trash">${UI_ICON.trash}</button>
            </span>
          </div>`;
      };
      const pinned = shown.filter((n) => n.pinned), rest = shown.filter((n) => !n.pinned);
      const folded = noteFolds();
      const group = (key, label, list3) => {
        const open = !folded.has(key) || !!ntFilter.value.trim();
        return `<button type="button" class="sect fe-nt-grp" data-level="group" data-grp="${key}" data-label="${esc(label.toLowerCase())}" aria-expanded="${open}" title="${open ? "Fold" : "Show"} ${esc(label.toLowerCase())}">${DISCLOSE}${key === "pinned" ? `<span class="fe-nt-grp-pin">${UI_ICON.pin}</span>` : ""}${label}<span class="fe-grp-n">${list3.length}</span></button><div class="fe-nt-gbody"${open ? "" : " hidden"}>${list3.map(row2).join("")}</div>`;
      };
      ntList.innerHTML = shown.length ? pinned.length ? group("pinned", "Pinned", pinned) + group("all", "All notes", rest) : shown.map(row2).join("") : allNotes.length ? emptyHtml("filtered", `No note matches "${ntFilter.value.trim()}"`, { inline: true, actions: [CLEAR] }) : emptyHtml("empty", "No notes yet", { inline: true, hintHtml: "Press <kbd>n</kbd> or + to write one" });
      attachNoteEvents(root);
    }
    addPaletteSource(() => {
      const root = notesRoot();
      return root ? allNotes.map((n) => ({
        title: n.title || noteTitle(n.rel),
        sub: (n.tags ?? []).map((t) => "#" + t).join(" ") || "note",
        group: "Notes",
        icon: PI.docs,
        run: () => app.strip.go(root + "/" + n.rel),
        runAlt: () => app.strip.open(root + "/" + n.rel, true)
      })) : [];
    });
    let searchTimer = null;
    ntFilter.addEventListener("input", () => {
      const root = notesRoot();
      if (!root) return;
      const q = ntFilter.value.trim();
      bodyHits = /* @__PURE__ */ new Map();
      renderNotes(root);
      if (searchTimer) clearTimeout(searchTimer);
      if (!q || q.startsWith("#") || !deep()) return;
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
    const lensFilter = el("fe-lens-filter");
    function toggleTagFilter(tag) {
      const q = "#" + tag;
      lensFilter.value = lensFilter.value.trim().toLowerCase() === q.toLowerCase() ? "" : q;
      applyLensFilter();
    }
    const deepPref = flagPref("bfb-lens-deep-v1", false);
    const depthBtn = el("fe-lens-depth");
    const deep = () => deepPref.get();
    function syncDepth() {
      const on = deep(), inNotes = openLens() === "notes";
      depthBtn.textContent = on ? "Deep" : "Names";
      depthBtn.classList.toggle("on", on);
      depthBtn.setAttribute("aria-pressed", String(on));
      depthBtn.title = on ? `Deep: also matches ${inNotes ? "the text inside notes" : "the names inside saved folders"}. Click for names only` : "Names only. Click to search inside too";
      lensFilter.placeholder = on ? inNotes ? "Search inside notes" : "Search inside folders" : "Filter";
    }
    depthBtn.addEventListener("click", (e) => {
      e.preventDefault();
      deepPref.set(!deep());
      syncDepth();
      applyLensFilter();
      lensFilter.focus();
    });
    const applyLensFilter = () => {
      svFilter.value = ntFilter.value = lensFilter.value;
      svHits = /* @__PURE__ */ new Map();
      refreshSaved();
      searchInsideSaved();
      ntFilter.dispatchEvent(new Event("input"));
    };
    const listings = /* @__PURE__ */ new Map();
    const namesIn = (path) => {
      const hit = listings.get(path);
      if (hit && Date.now() - hit.at < 6e4) return hit.names;
      const href = fileHref(path);
      const names = fetchFileText(href).then((t) => parseListing(t, href).map((e) => e.name)).catch(() => []);
      listings.set(path, { at: Date.now(), names });
      return names;
    };
    let insideTimer = null;
    function searchInsideSaved() {
      if (insideTimer) clearTimeout(insideTimer);
      const q = svFilter.value.trim().toLowerCase();
      if (!q || q.startsWith("#") || !deep()) return;
      const words = q.split(/\s+/);
      insideTimer = setTimeout(async () => {
        const found = /* @__PURE__ */ new Map();
        await Promise.all(getSaved().filter((p) => p.path.endsWith("/") && !isViewPath(p.path)).map(async (p) => {
          const name = (await namesIn(p.path)).find((n) => words.every((w) => n.toLowerCase().includes(w)));
          if (name) found.set(p.path, name);
        }));
        if (svFilter.value.trim().toLowerCase() !== q || !deep()) return;
        svHits = found;
        refreshSaved();
      }, 250);
    }
    lensFilter.addEventListener("input", applyLensFilter);
    for (const list3 of [svList, ntList]) list3.addEventListener("click", (e) => {
      const a = e.target.closest(".empty [data-a]")?.dataset.a;
      if (a === "clear") {
        lensFilter.value = "";
        applyLensFilter();
        lensFilter.focus();
      } else if (a === "retry") refreshNotes();
    });
    lensFilter.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        lensFilter.value = "";
        applyLensFilter();
        lensFilter.blur();
      }
      e.stopPropagation();
    });
    document.addEventListener("bfb-lens", (e) => {
      const lens = e.detail;
      if (lens !== "saved" && lens !== "notes") return;
      syncDepth();
      if (lensFilter.value) {
        lensFilter.value = "";
        applyLensFilter();
      } else syncLens();
    });
    syncDepth();
    el("fe-lens-tags").addEventListener("click", (e) => {
      const chip = e.target.closest(".fe-lens-tag");
      if (!chip) return;
      const tag = chip.dataset.tag, hadFocus = document.activeElement === chip;
      toggleTagFilter(tag);
      if (hadFocus) [...el("fe-lens-tags").querySelectorAll(".fe-lens-tag")].find((c) => c.dataset.tag === tag)?.focus();
    });
    function refreshNotes() {
      const root = notesRoot();
      if (!root) {
        lensNotes.count = 0;
        lensNotes.tags = [];
        syncLens();
        ntHint.textContent = "";
        el("fe-notes-root").removeAttribute("href");
        ntList.innerHTML = emptyHtml("empty", "Choose a folder to store your notes", { inline: true, actions: [
          { id: "fe-nt-pick", label: "Choose folder", title: "Pick the notes folder in the system chooser", icon: UI_ICON.folderOpen },
          { id: "fe-nt-setup", label: "Type it in Settings", title: "Type the notes folder in Settings" }
        ] });
        el("fe-nt-pick").addEventListener("click", () => app.pickNotesFolder());
        el("fe-nt-setup").addEventListener("click", () => {
          app.openSettings("notes");
          el("fe-st-notes-root").focus();
        });
        return;
      }
      el("fe-notes-root").href = fileHref(root + "/");
      notes.list(root).then((unsorted) => {
        allNotes = sharedOrder(unsorted);
        renderNotes(root);
      }).catch((err) => {
        ntHint.textContent = err.message;
        ntList.innerHTML = err.code === "unavailable" ? emptyHtml("failed", "Notes host not installed", { inline: true, hint: "Run native/install.sh, then reload" }) : emptyHtml("failed", "Notes could not be listed", { inline: true, hint: err.message, actions: [{ a: "retry", label: "Try again", title: "List the notes again" }] });
      });
    }
    app.refreshNotes = refreshNotes;
    function noteRowText(n) {
      const colour = new Map(getTags().map((t) => [t.name, t.color]));
      const tags = (n.tags ?? []).length ? `<span class="fe-nt-tags">${n.tags.map((t) => `<span class="fe-nt-tag"><i style="background:${esc(colour.get(t) ?? "var(--dm)")}"></i>${esc(t)}</span>`).join("")}</span>` : "";
      const pin = n.pinned ? `<span class="fe-nt-pin" title="Pinned">${UI_ICON.pin}</span>` : "";
      return `<span class="fe-nt-main"><span class="fe-sl fe-nt-label" title="${esc(noteName(n))}&#10;Double-click to rename (F2)">${midHtml(noteName(n))}</span>${tags}</span>${pin}`;
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
      const row2 = els(".fe-nt-item", ntList).find((i3) => i3.dataset.rel === rel);
      const label = row2?.querySelector(".fe-nt-label");
      if (!label) {
        toast("That note is not in the list. Clear the filter first.");
        return;
      }
      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
      }
      row2.scrollIntoView({ block: "nearest" });
      const meta = allNotes.find((n) => n.rel === rel);
      label.textContent = meta ? noteName(meta) : noteTitle(rel);
      const back = () => {
        renderNotes(root);
        if (reopen) openNoteRel(root, rel);
      };
      inlineEdit(label, (val) => {
        if (!val.trim()) {
          back();
          return;
        }
        notes.read(root, rel).then(async (doc) => {
          const to = nameIsId(rel) ? rel : rel.replace(/[^/]+$/, slugForTitle(val));
          if (to.toLowerCase() !== rel.toLowerCase() && allNotes.some((n) => n.rel.toLowerCase() === to.toLowerCase())) {
            toast(`A note named ${to.split("/").pop()} already exists. Pick another title.`);
            back();
            return;
          }
          let now = rel;
          if (to !== rel) {
            await notes.rename(root, rel, to);
            now = to;
          }
          const titled = retitle(doc.text, val);
          if (titled !== null) await notes.write(root, now, titled, doc.mtime);
          refreshNotes();
          if (reopen) openNoteRel(root, now);
        }).catch((err) => toast(err.message));
      }, back);
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
        // The editor's scrim covers the sidebar, so close the editor, rename in
        // the list, then reopen the note. The bar acts on mousedown; wait for the
        // rest of that click, which would otherwise land on the page under the
        // closed editor and shut the rename box straight away.
        rename: (r, now) => {
          let started = false;
          const start = () => {
            if (started) return;
            started = true;
            void saveEditor().then(() => {
              discardEditor();
              renameNote(root, r, true);
            });
          };
          if (now) {
            start();
            return;
          }
          document.addEventListener("pointerup", () => setTimeout(start, 0), { once: true, capture: true });
          setTimeout(start, 800);
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
    let ntLayer = null;
    const closeNtMenu = () => ntLayer?.close("pick");
    function openNtMenu(root, item, x, y) {
      const rel = item.dataset.rel;
      ntMenu.innerHTML = [
        `<div class="row fe-ctx-item" data-act="open">${UI_ICON.files}<span>Open</span><span class="fe-ctx-key">Enter</span></div>`,
        `<div class="row fe-ctx-item" data-act="tab">${UI_ICON.tab}<span>Open in a page tab</span></div>`,
        `<div class="row fe-ctx-item" data-act="rename">${UI_ICON.rename}<span>Rename</span><span class="fe-ctx-key">F2</span></div>`,
        `<div class="row fe-ctx-item" data-act="props">${UI_ICON.palette}<span>Colour, pin and tags</span></div>`,
        `<div class="fe-ctx-sep"></div>`,
        `<div class="row fe-ctx-item" data-act="cp-path">${UI_ICON.copy}<span>Copy path</span></div>`,
        `<div class="row fe-ctx-item" data-act="cp-title">${UI_ICON.copy}<span>Copy title</span></div>`,
        `<div class="fe-ctx-sep"></div>`,
        `<div class="row fe-ctx-item" data-act="delete">${UI_ICON.trash}<span>Move to .trash</span><span class="fe-ctx-key">Delete</span></div>`
      ].join("");
      ntMenu.dataset.rel = rel;
      ntMenu.dataset.root = root;
      ntLayer = openLayer(ntMenu, { kind: "popover", place: "point", point: { x, y }, origin: item, role: "menu", group: "menu" });
    }
    ntMenu.addEventListener("click", (e) => {
      const item = e.target.closest(".fe-ctx-item");
      if (!item) return;
      const { rel, root } = ntMenu.dataset;
      closeNtMenu();
      const row2 = els(".fe-nt-item", ntList).find((i3) => i3.dataset.rel === rel);
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
          if (row2) openProps(root, rel, row2.querySelector(".fe-nt-props"));
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
      const d = /* @__PURE__ */ new Date(), two = (n) => String(n).padStart(2, "0");
      const stamp = `${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}${two(d.getHours())}${two(d.getMinutes())}${two(d.getSeconds())}`;
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

  // src/tool-lenses.ts
  var listDir = async (url) => parseListing(await fetchFileText(url), url);
  var extOf = (name) => name.includes(".") ? name.split(".").pop().toLowerCase() : "txt";
  function initToolLenses(app) {
    initSearch(app);
    initAsk(app);
  }
  var SEARCH_MAX_FILES = 2e3;
  function initSearch(app) {
    const box = document.getElementById("fe-srch");
    if (!box) return;
    box.innerHTML = `
    <div class="fe-tl-form">
      <input id="fe-srch-q" class="tb fe-tl-input" data-size="lg" data-lead="search" type="search" placeholder="Search" spellcheck="false" autocomplete="off" title="Enter searches the text of every file here">
      <div class="fe-tl-opts">
        ${checkHtml2("fe-srch-deep", "Subfolders", "Subfolders: search every folder under this one too", true)}
        ${checkHtml2("fe-srch-case", "Match case", "Match upper and lower case exactly")}
      </div>
    </div>
    <div id="fe-srch-status" class="fe-hint">Type a word and press Enter.</div>
    <div id="fe-srch-list"></div>`;
    const q = el("fe-srch-q");
    const status = el("fe-srch-status");
    const list3 = el("fe-srch-list");
    let run = 0;
    async function search() {
      const term = q.value.trim();
      const mine = ++run;
      const cancelled = () => mine !== run;
      list3.innerHTML = "";
      if (!term) {
        status.textContent = "Type a word and press Enter.";
        return;
      }
      const root = fileHref(app.folderPath.replace(/\/?$/, "/"));
      const deep = el("fe-srch-deep").checked;
      status.textContent = deep ? "Listing folders\u2026" : "Searching\u2026";
      let files;
      try {
        files = deep ? (await crawl(root, listDir, { maxEntries: SEARCH_MAX_FILES }, cancelled)).entries : await listDir(root);
      } catch {
        if (!cancelled()) status.textContent = "Could not list this folder.";
        return;
      }
      if (cancelled()) return;
      files = files.filter((f) => !f.isDir && !f.isParent && isTextCandidate(f));
      const query = { ...EMPTY_FIND, text: term, caseSensitive: el("fe-srch-case").checked };
      const res = await searchContents(
        files,
        fetchFileText,
        query,
        (done, total2) => {
          if (!cancelled()) status.textContent = `Searching ${done} of ${total2} files\u2026`;
        },
        cancelled
      );
      if (cancelled()) return;
      const hits = [...res.hits].sort((a, b) => b[1].count - a[1].count);
      const total = hits.reduce((n, [, h]) => n + h.count, 0);
      status.textContent = hits.length ? `${total} match${total === 1 ? "" : "es"} in ${hits.length} file${hits.length === 1 ? "" : "s"}` : `No file here contains "${term}".`;
      list3.innerHTML = hits.map(([href, h]) => {
        const name = relativeName(href, root);
        const snip = `${esc(h.line.slice(0, h.start))}<mark>${esc(h.line.slice(h.start, h.end))}</mark>${esc(h.line.slice(h.end))}`;
        return `<a class="row fe-si fe-srch-hit" href="${esc(pageHref(href))}" title="${esc(name)}, line ${h.lineNumber}">${icoFile(extOf(name))}<span class="fe-srch-tx"><span class="fe-sl">${esc(name)}</span><span class="fe-srch-snip">${snip}</span></span><span class="fe-rc-ago">${h.count}</span></a>`;
      }).join("");
    }
    q.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        void search();
      } else if (e.key === "Escape") {
        q.value = "";
        run++;
        list3.innerHTML = "";
        status.textContent = "Type a word and press Enter.";
      }
    });
    document.addEventListener("bfb-lens", (e) => {
      if (e.detail === "search") q.focus({ preventScroll: true });
    });
  }
  var askModelPref = textPref("bfb-ask-model-v1");
  var when = (at) => new Date(at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  function initAsk(app) {
    const box = document.getElementById("fe-ask");
    if (!box) return;
    const subject = app.fileMode ? app.fileName : app.folderPath.split("/").filter(Boolean).pop() || "/";
    const key = app.fileMode ? decodeURIComponent(location.pathname) : app.folderPath;
    const quick = app.fileMode ? [["summarize", "Summarize"], ["explain", "Explain"]] : [["folder", "What is in here?"]];
    const what = app.fileMode ? "this file" : "this folder";
    box.innerHTML = `
    <div class="fe-ask-top">
      <span class="fe-ask-model"><span class="dot"></span>${ddHtml("fe-ask-model", [{ value: "", label: "Default" }], "Which model answers. Local models run on this machine; Gemini runs on Google's servers.")}</span>
      <span class="fe-ask-sp"></span>
      <button type="button" class="btn fe-ask-ib" data-icon id="fe-ask-new" title="New chat">${UI_ICON.add}</button>
      <button type="button" class="btn fe-ask-ib" data-icon id="fe-ask-hist-btn" title="Earlier chats about ${what}" aria-expanded="false">${UI_ICON.clock}<span class="badge fe-ask-n" data-size="sm" data-tone="solid" id="fe-ask-hist-n"></span></button>
      <div class="fe-ask-hist" id="fe-ask-hist" hidden></div>
    </div>
    <div class="fe-ask-status" id="fe-ask-status" hidden><span class="dot"></span><span id="fe-ask-state">Not checked yet</span></div>
    <p class="fe-ask-cloud" id="fe-ask-cloud" hidden>${UI_ICON.info}<span>Sends ${app.fileMode ? "the text" : "the listing"} to Google</span></p>
    <div id="fe-ask-thread"></div>
    <div class="fe-ask-empty" id="fe-ask-empty"><p>Ask anything about ${what}.</p><div class="fe-ask-quick">${quick.map(([k, l]) => `<button type="button" class="btn fe-ask-chip" data-size="sm" data-variant="outline" data-shape="pill" data-intent="${k}">${l}</button>`).join("")}</div></div>
    <div class="fe-ask-form">
      <div class="fe-ask-box">
        <textarea id="fe-ask-q" rows="1" placeholder="Ask about ${what}" spellcheck="false" title="Enter asks; Shift+Enter starts a new line"></textarea>
        <div class="fe-ask-foot"><span class="fe-ask-ctx" title="${esc(app.fileMode ? decodeURIComponent(location.pathname) : app.folderPath)}">${app.fileMode ? UI_ICON.file ?? "" : ""}<span>${esc(subject)}</span></span>
          <button type="button" class="btn fe-ask-send" data-icon data-variant="solid" id="fe-ask-go" title="Ask (Enter)" aria-label="Ask">${UI_ICON.send ?? "\u2191"}</button></div>
      </div>
    </div>`;
    const thread = el("fe-ask-thread");
    const q = el("fe-ask-q");
    const go2 = el("fe-ask-go");
    const statusRow = el("fe-ask-status");
    const state = el("fe-ask-state");
    upgradeControls(box);
    const pick = el("fe-ask-model");
    const cloud = el("fe-ask-cloud");
    const hist = el("fe-ask-hist");
    const histBtn = el("fe-ask-hist-btn");
    const histN = el("fe-ask-hist-n");
    const emptyBox = el("fe-ask-empty");
    const chipDot = box.querySelector(".fe-ask-model .dot");
    const syncEmpty = () => {
      emptyBox.hidden = thread.children.length > 0;
    };
    const grow = () => {
      q.style.height = "auto";
      q.style.height = Math.min(q.scrollHeight, 140) + "px";
    };
    q.addEventListener("input", grow);
    let cancel = null;
    let checked = false;
    let localReady = false;
    let chatId = "";
    let turns = [];
    const model = () => pick.value || app.settings.aiModel || "";
    const isCloud = () => model().startsWith("gemini:");
    const syncUsable = () => {
      const usable = localReady || isCloud();
      q.disabled = go2.disabled = !usable;
      box.querySelectorAll(".fe-ask-chip").forEach((b) => {
        b.disabled = !usable;
      });
      cloud.hidden = !isCloud();
    };
    async function checkModel() {
      checked = true;
      state.textContent = "Checking the local model\u2026";
      const [a, models] = await Promise.all([llmAvailability(), llmModels()]);
      const kind = a.kind === "ready" ? a.cold ? "cold" : "ready" : a.kind;
      statusRow.className = `fe-ask-status ${kind}`;
      statusRow.hidden = a.kind === "ready";
      state.textContent = a.kind === "ready" ? "" : a.kind === "down" ? LLM_ERROR_TEXT.server_down : LLM_ERROR_TEXT.unavailable;
      chipDot.className = `dot ${kind}`;
      chipDot.title = a.kind === "ready" ? a.cold ? "Loads on the first question" : "Ready" : state.textContent;
      localReady = a.kind === "ready";
      const saved = askModelPref.get();
      const opts = [
        { value: "", label: a.kind === "ready" ? a.status.default_model.replace(/:latest$/, "") : "Default" },
        ...models.tiers.map((t) => ({ value: t.alias, label: t.alias, hint: t.model, group: "On this machine" })),
        ...models.gemini.map((g) => ({ value: `gemini:${g.name}`, label: g.name + (g.default ? " (default)" : ""), group: "Gemini, on Google's servers" }))
      ];
      pick.setOptions(opts);
      pick.value = opts.some((o) => o.value === saved) ? saved : "";
      syncUsable();
    }
    pick.addEventListener("change", () => {
      askModelPref.set(pick.value);
      syncUsable();
    });
    async function context() {
      if (app.fileMode) return { ctx: await fetchFileText(location.href.split("#")[0]), name: app.fileName };
      const url = fileHref(app.folderPath.replace(/\/?$/, "/"));
      const rows = (await listDir(url)).filter((e) => !e.isParent).map((e) => `${e.name}${e.isDir ? "/" : ""}	${e.isDir ? "" : e.rawBytes + " bytes"}`);
      return { ctx: `Folder ${app.folderPath}
${rows.join("\n")}`, name: subject };
    }
    const turnEl = (question) => {
      const turn = document.createElement("div");
      turn.className = "fe-ask-turn";
      turn.innerHTML = `<div class="fe-ask-q">${esc(question)}</div><div class="fe-ask-a fe-md"><span class="fe-ask-wait">Thinking\u2026</span></div><div class="fe-ask-meta"></div>`;
      thread.appendChild(turn);
      syncEmpty();
      return turn;
    };
    const metaText = (m, ms, truncated = false) => `${m} \xB7 ${(ms / 1e3).toFixed(1)}s${truncated ? " \xB7 shortened to fit" : ""}`;
    const syncHistN = () => {
      const n = chatsFor(key).length;
      histN.textContent = n ? String(n) : "";
    };
    const newChat = () => {
      cancel?.();
      chatId = "";
      turns = [];
      thread.innerHTML = "";
      syncEmpty();
      q.focus();
    };
    const openChat = (c) => {
      cancel?.();
      chatId = c.id;
      turns = c.turns.slice();
      thread.innerHTML = "";
      for (const t of turns) {
        const el2 = turnEl(t.q);
        el2.querySelector(".fe-ask-a").innerHTML = renderMarkdown(t.a);
        el2.querySelector(".fe-ask-meta").textContent = t.model === "stopped" ? "Stopped" : metaText(t.model, t.ms);
      }
      syncEmpty();
      showHist(false);
    };
    const paintHist = () => {
      const chats = chatsFor(key);
      hist.innerHTML = chats.length ? chats.map((c) => `<div class="row fe-ask-h${c.id === chatId ? " on" : ""}" data-chat="${esc(c.id)}">
        <button type="button" class="fe-ask-h-open" title="Open this chat"><span class="fe-ask-h-t">${esc(c.title)}</span><span class="fe-ask-h-m">${esc(when(c.at))} \xB7 ${c.turns.length} question${c.turns.length === 1 ? "" : "s"}</span></button>
        <button type="button" class="btn fe-ask-h-del" data-icon data-size="sm" data-tone="danger" title="Delete this chat" aria-label="Delete this chat">${UI_ICON.close}</button>
      </div>`).join("") : emptyHtml("empty", "No earlier chats about this yet", { inline: true });
    };
    let histLayer = null;
    const showHist = (on) => {
      if (!on) {
        histLayer?.close("api");
        return;
      }
      hist.hidden = false;
      paintHist();
      histLayer = openLayer(hist, { kind: "popover", anchor: histBtn, align: "end", onClose: () => {
        hist.hidden = true;
        histBtn.classList.remove("on");
      } });
      if (histLayer.open) histBtn.classList.add("on");
      else hist.hidden = true;
    };
    async function ask(intent, question) {
      if (go2.disabled) return;
      cancel?.();
      const shown = question ?? (intent === "folder" ? "What is in here?" : intent === "summarize" ? "Summarize" : "Explain");
      const turn = turnEl(shown);
      turn.scrollIntoView({ block: "end" });
      const out = turn.querySelector(".fe-ask-a");
      const meta = turn.querySelector(".fe-ask-meta");
      let c;
      try {
        c = await context();
      } catch {
        out.textContent = "Could not read this to send it.";
        return;
      }
      let full = "";
      go2.classList.add("stop");
      go2.title = "Stop";
      go2.setAttribute("aria-label", "Stop");
      const done = () => {
        cancel = null;
        go2.classList.remove("stop");
        go2.title = "Ask (Enter)";
        go2.setAttribute("aria-label", "Ask");
      };
      const asked = intent === "folder" ? "What is in this folder? Group the files by purpose in a few short lines." : question;
      let over = false;
      const stopped = () => {
        if (over) return;
        over = true;
        done();
        if (!full.trim()) {
          out.textContent = "Stopped before an answer came.";
          return;
        }
        out.innerHTML = renderMarkdown(full);
        meta.textContent = "Stopped";
        if (!chatId) chatId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const t = { q: shown, a: full + "\n\n*(stopped)*", model: "stopped", ms: 0, at: Date.now() };
        turns.push(t);
        addTurn(key, chatId, t);
        syncHistN();
      };
      const stop = llmQuery(
        {
          ctx: c.ctx,
          ctxName: c.name,
          // The host knows summarize, explain-code and qa; a folder question is a qa.
          intent: intent === "explain" ? "explain-code" : intent === "summarize" ? "summarize" : "qa",
          question: asked && intent === "qa" ? withHistory(turns, asked) : asked,
          model: model() || void 0,
          // lm gemini's own default; a local model keeps the shorter one.
          timeout: isCloud() ? 300 : void 0
        },
        {
          onChunk: (t) => {
            full += t;
            out.textContent = full;
          },
          onDone: (info) => {
            over = true;
            done();
            out.innerHTML = renderMarkdown(full);
            meta.textContent = metaText(info.model, info.ms, info.truncated);
            if (!chatId) chatId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
            const t = { q: shown, a: full, model: info.model, ms: info.ms, at: Date.now() };
            turns.push(t);
            addTurn(key, chatId, t);
            syncHistN();
          },
          onError: (code, message) => {
            over = true;
            done();
            if (code !== "cancelled") out.textContent = LLM_ERROR_TEXT[code] ?? message;
          }
        }
      );
      cancel = () => {
        stop();
        stopped();
      };
    }
    box.addEventListener("click", (e) => {
      const t = e.target;
      const chip = t.closest(".fe-ask-chip");
      if (chip) {
        void ask(chip.dataset.intent);
        return;
      }
      const row2 = t.closest(".fe-ask-h");
      if (row2 && t.closest(".fe-ask-h-del")) {
        deleteChat(key, row2.dataset.chat);
        if (row2.dataset.chat === chatId) newChat();
        paintHist();
        syncHistN();
        return;
      }
      if (row2 && t.closest(".fe-ask-h-open")) {
        const c = chatsFor(key).find((x) => x.id === row2.dataset.chat);
        if (c) openChat(c);
      }
    });
    el("fe-ask-new").addEventListener("click", () => {
      showHist(false);
      newChat();
    });
    histBtn.addEventListener("click", () => showHist(hist.hidden));
    go2.addEventListener("click", () => {
      if (cancel) {
        cancel();
        return;
      }
      const text = q.value.trim();
      if (!text) {
        q.focus();
        return;
      }
      q.value = "";
      grow();
      void ask("qa", text);
    });
    q.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        go2.click();
      }
    });
    syncHistN();
    const reopen = (id) => {
      const c = chatsFor(key).find((x) => x.id === id);
      if (!c) return;
      app.showLens?.("ask");
      openChat(c);
    };
    addPaletteSource(() => allChats().slice(0, 60).map(({ subject: subject2, chat }) => ({
      title: chat.title,
      sub: `${subject2.split("/").filter(Boolean).pop() || "/"} \xB7 ${when(chat.at)}`,
      group: "Chats",
      tab: "chats",
      icon: UI_ICON.ai,
      run: () => {
        if (subject2 === key) reopen(chat.id);
        else app.strip.go(subject2, "#ask=" + encodeURIComponent(chat.id));
      }
    })));
    const askHash = /^#ask=(.+)$/.exec(location.hash);
    if (askHash) setTimeout(() => reopen(decodeURIComponent(askHash[1])), 0);
    document.addEventListener("bfb-lens", (e) => {
      if (e.detail !== "ask") return;
      if (!checked) void checkModel();
      q.focus({ preventScroll: true });
    });
  }

  // src/settings-ui.ts
  var RULE_SUGGESTIONS = [
    { name: "Images", pattern: "\\.(png|jpe?g|gif|webp|svg|avif|heic)$", label: "IMG", glyph: "image", color: "#b197fc" },
    { name: "Archives", pattern: "\\.(zip|tar|gz|tgz|rar|7z|xz)$", label: "ZIP", glyph: "archive", color: "#a1887f" },
    { name: "Env files", pattern: "^\\.env", label: "ENV", glyph: "key", color: "#e8b923" },
    { name: "Lockfiles", pattern: "(\\.lock|-lock\\.json|lockfile)$", label: "LCK", glyph: "lock", color: "#8b949e" },
    { name: "Tests", pattern: "(\\.test|\\.spec|_test)\\.", label: "TST", glyph: "test", color: "#40c057" },
    { name: "Docker", pattern: "^(dockerfile|docker-compose|compose\\.ya?ml)", label: "DKR", glyph: "box", color: "#4dabf7" },
    { name: "Config", pattern: "(\\.config\\.[a-z]+|rc|\\.toml|\\.ini)$", label: "CFG", glyph: "gear", color: "#868e96" },
    { name: "Data", pattern: "\\.(db|sqlite3?|sql|parquet)$", label: "DB", glyph: "db", color: "#ffa94d" },
    { name: "Media", pattern: "\\.(mp4|mov|mkv|webm|mp3|wav|flac)$", label: "MED", glyph: "video", color: "#ff6b6b" },
    { name: "Git", pattern: "^\\.git(ignore|attributes|modules)?$", label: "GIT", glyph: "branch", color: "#f05133" },
    { name: "Readme", pattern: "^readme", label: "RDM", glyph: "book", color: "#4a9eff" },
    { name: "Claude", pattern: "(^claude\\.md$|\\.claude$)", label: "Cld", glyph: "sparkle", color: "#d97757" }
  ];
  var SWATCHES = [
    "#ff6b6b",
    "#f783ac",
    "#d97757",
    "#ffa94d",
    "#e8b923",
    "#94d82d",
    "#40c057",
    "#38d9a9",
    "#3bc9db",
    "#4dabf7",
    "#4a9eff",
    "#748ffc",
    "#b197fc",
    "#da77f2",
    "#a1887f",
    "#8b949e"
  ];
  function initSettingsUi(app) {
    const { fe, settings, toast } = app;
    const v = (id) => el(id);
    upgradeControls(el("fe-settings-modal"));
    const badRegex = (p) => {
      try {
        new RegExp(p, "i");
        return "";
      } catch (e) {
        return String(e.message);
      }
    };
    const hits = (p) => {
      try {
        const r = new RegExp(p, "i");
        return app.entryNames.filter((n) => r.test(n)).length;
      } catch {
        return 0;
      }
    };
    function renderRulesList() {
      const list3 = el("fe-st-rules-list");
      list3.innerHTML = app.iconRules.length ? app.iconRules.map((rule, i3) => {
        const bad = badRegex(rule.pattern);
        return `<div class="fe-rule${rule.enabled ? "" : " off"}" data-idx="${i3}">
        ${switchHtml({ title: rule.enabled ? "On" : "Off", label: "Use this rule", checked: rule.enabled, small: true, cls: "fe-st-rule-en" })}
        <button type="button" class="fe-rule-ico" title="Icon and colour">${icoCustom(rule.label, rule.color, rule.glyph)}</button>
        <input type="text" class="tb fe-st-rule-pattern" data-size="lg" data-mono${bad ? ' aria-invalid="true"' : ""} value="${esc(rule.pattern)}" placeholder="name pattern, e.g. \\.md$" spellcheck="false" title="${bad ? esc(bad) : "Matches file names, any case"}">
        <span class="fe-rule-n" title="Matches in this folder">${bad ? "!" : hits(rule.pattern)}</span>
        <button type="button" class="btn fe-ibtn fe-st-rule-del" data-icon data-size="sm" data-tone="danger" title="Delete rule" aria-label="Delete rule">${UI_ICON.trash}</button>
      </div>`;
      }).join("") : emptyHtml("empty", "No rules yet", { inline: true, hint: "Add one, or pick a suggestion" });
      const have = new Set(app.iconRules.map((r) => r.pattern));
      const left = RULE_SUGGESTIONS.filter((s) => !have.has(s.pattern));
      el("fe-st-rule-sugg").innerHTML = left.length ? `<span class="fe-rule-sugg-l">Add</span>` + left.map((s) => `<button type="button" class="chip fe-rule-add" data-add data-name="${esc(s.name)}" title="${esc(s.pattern)}">${icoCustom(s.label, s.color, s.glyph)}${esc(s.name)}</button>`).join("") : "";
    }
    const saveRules = () => {
      saveIconRules(app.iconRules);
      app.applyAll();
    };
    const rulesList = el("fe-st-rules-list");
    const ruleAt = (e) => {
      const row2 = e.target.closest(".fe-rule");
      if (!row2) return null;
      const idx = parseInt(row2.dataset.idx);
      return isNaN(idx) || idx >= app.iconRules.length ? null : [row2, idx];
    };
    rulesList.addEventListener("change", (e) => {
      const hit = ruleAt(e);
      if (!hit) return;
      const t = e.target;
      if (t.classList.contains("fe-st-rule-en")) {
        app.iconRules[hit[1]].enabled = t.checked;
        hit[0].classList.toggle("off", !t.checked);
        saveRules();
      }
    });
    rulesList.addEventListener("input", (e) => {
      const hit = ruleAt(e);
      if (!hit) return;
      const t = e.target;
      if (!t.classList.contains("fe-st-rule-pattern")) return;
      app.iconRules[hit[1]].pattern = t.value;
      const bad = badRegex(t.value);
      if (bad) t.setAttribute("aria-invalid", "true");
      else t.removeAttribute("aria-invalid");
      t.title = bad || "Matches file names, any case";
      hit[0].querySelector(".fe-rule-n").textContent = bad ? "!" : String(hits(t.value));
      if (!bad) saveRules();
    });
    rulesList.addEventListener("click", (e) => {
      const hit = ruleAt(e);
      if (!hit) return;
      const t = e.target;
      if (t.closest(".fe-st-rule-del")) {
        app.iconRules.splice(hit[1], 1);
        saveRules();
        renderRulesList();
      } else if (t.closest(".fe-rule-ico")) openRulePop(hit[1], t.closest(".fe-rule-ico"));
    });
    el("fe-st-rule-sugg").addEventListener("click", (e) => {
      const b = e.target.closest(".fe-rule-add");
      const s = b && RULE_SUGGESTIONS.find((x) => x.name === b.dataset.name);
      if (!s) return;
      app.iconRules.push({ id: "r" + Date.now(), pattern: s.pattern, label: s.label, color: s.color, glyph: s.glyph, enabled: true });
      saveRules();
      renderRulesList();
    });
    el("fe-st-add-rule").addEventListener("click", () => {
      app.iconRules.push({ id: "r" + Date.now(), pattern: "", label: "NEW", color: "#4a9eff", enabled: true });
      saveIconRules(app.iconRules);
      renderRulesList();
      els(".fe-st-rule-pattern", rulesList).pop()?.focus();
    });
    el("fe-st-reset-rules").addEventListener("click", () => {
      app.iconRules = DEFAULT_ICON_RULES.map((r) => ({ ...r }));
      saveRules();
      renderRulesList();
      toast("Icon rules reset");
    });
    let pop = null;
    const closePop = () => pop?.close("api");
    function openRulePop(idx, anchor) {
      const rule = app.iconRules[idx];
      const box = document.createElement("div");
      box.className = "fe-rule-pop";
      box.setAttribute("role", "dialog");
      box.setAttribute("aria-label", "Icon and colour");
      const paint = () => {
        box.innerHTML = `
        <div class="fe-rp-sec"><span class="fe-rp-l">Picture</span>
          <div class="fe-rp-glyphs">
            <button type="button" class="fe-rp-g${rule.glyph ? "" : " on"}" data-g="" title="Text badge">${icoCustom(rule.label, rule.color)}</button>
            ${Object.keys(RULE_GLYPHS).map((g) => `<button type="button" class="fe-rp-g${rule.glyph === g ? " on" : ""}" data-g="${g}" title="${g}">${icoCustom("", rule.color, g)}</button>`).join("")}
          </div></div>
        <div class="fe-rp-sec"><span class="fe-rp-l">Text</span><input class="tb fe-st-input fe-rp-label" data-mono maxlength="4" value="${esc(rule.label)}" spellcheck="false" title="Up to 4 characters, shown when there is no picture"></div>
        <div class="fe-rp-sec"><span class="fe-rp-l">Colour</span>
          <div class="fe-rp-sw">${SWATCHES.map((c) => `<button type="button" class="fe-rp-c${c === rule.color ? " on" : ""}" data-c="${c}" style="--c:${c}" title="${c}" aria-label="${c}"></button>`).join("")}
          <input class="tb fe-st-input fe-rp-hex" data-mono value="${esc(rule.color)}" maxlength="7" spellcheck="false" title="Any hex colour"></div></div>`;
      };
      paint();
      const apply = () => {
        saveRules();
        const ico = rulesList.querySelector(`.fe-rule[data-idx="${idx}"] .fe-rule-ico`);
        if (ico) ico.innerHTML = icoCustom(rule.label, rule.color, rule.glyph);
      };
      box.addEventListener("click", (e) => {
        const t = e.target;
        const g = t.closest(".fe-rp-g"), c = t.closest(".fe-rp-c");
        if (g) rule.glyph = g.dataset.g || void 0;
        else if (c) rule.color = c.dataset.c;
        else return;
        apply();
        paint();
        box.querySelector(g ? `.fe-rp-g[data-g="${g.dataset.g}"]` : `.fe-rp-c[data-c="${c.dataset.c}"]`)?.focus();
      });
      box.addEventListener("input", (e) => {
        const t = e.target;
        if (t.classList.contains("fe-rp-label")) {
          rule.label = t.value;
          apply();
        }
        if (t.classList.contains("fe-rp-hex") && /^#[0-9a-f]{6}$/i.test(t.value)) {
          rule.color = t.value;
          apply();
        }
      });
      pop = openLayer(box, { kind: "popover", anchor, offset: 6, group: "menu", focus: box.querySelector(".fe-rp-g.on") ?? "first" });
    }
    const aiModel = v("fe-st-ai-model");
    const warm = el("fe-st-ai-warm");
    function refreshAi() {
      const head = document.querySelector("#fe-st-ai-card .fe-st-ai-head");
      const state = document.querySelector(".fe-st-ai-state");
      const sub = el("fe-st-ai-sub"), grid = el("fe-st-ai-grid"), hint = el("fe-st-ai-hint");
      head.className = "fe-st-ai-head";
      state.textContent = "Checking\u2026";
      sub.textContent = "";
      grid.innerHTML = "";
      hint.innerHTML = "";
      warm.disabled = true;
      const kv = (k, val) => `<span class="k">${esc(k)}</span><span class="v">${esc(val)}</span>`;
      llmAvailability().then((av) => {
        if (av.kind === "unavailable") {
          head.classList.add("off");
          state.textContent = "Not set up";
          sub.textContent = "Ask and the AI bar stay hidden";
          hint.innerHTML = `Run <code>native/install.sh &lt;extension-id&gt;</code>, then reload. <span class="fe-dm">(${esc(av.reason)})</span>`;
          aiModel.setOptions([]);
          return;
        }
        const s = av.status;
        head.classList.add(av.kind === "down" ? "down" : av.cold ? "cold" : "ready");
        state.textContent = av.kind === "down" ? "Server down" : av.cold ? "Ready, cold" : "Ready";
        sub.textContent = av.kind === "down" ? "Start Ollama, then check again" : `${settings.aiModel || s.default_model} \xB7 ${av.cold ? "first reply loads it" : "replies at once"}`;
        grid.innerHTML = kv("Server", `${s.server}${s.host ? " \xB7 " + s.host : ""}`) + (s.toolkit_version ? kv("Toolkit", `lm ${s.toolkit_version}`) : "");
        const resident = new Set(s.resident_models ?? []);
        aiModel.setOptions((s.available_models ?? []).map((m) => ({
          value: m,
          label: m,
          icon: UI_ICON.bot,
          hint: [m === s.default_model ? "default" : "", resident.has(m) ? "loaded" : ""].filter(Boolean).join(" \xB7 ")
        })));
        aiModel.value = settings.aiModel || s.default_model;
        warm.checked = !!s.warm;
        warm.disabled = av.kind !== "ready";
      });
      const models = el("fe-st-ai-models");
      llmModels().then(({ tiers, gemini }) => {
        const rowHtml = (icon2, name, model, where, star = false) => `<div class="fe-ai-m">${icon2}<b>${esc(name)}</b><span class="fe-ai-m-id">${esc(model)}</span>${star ? '<span class="fe-ai-def">default</span>' : ""}<span class="fe-ai-where${where === "Google" ? " cloud" : ""}">${where}</span></div>`;
        models.innerHTML = tiers.length || gemini.length ? tiers.map((t) => rowHtml(UI_ICON.bot, t.alias, t.model, "This Mac")).join("") + gemini.map((g) => rowHtml(UI_ICON.ai, g.name.replace(/^gemini-/, "Gemini "), g.name, "Google", g.default)).join("") + `<p class="fe-set-note">Google models send the question and the file to Google.</p>` : '<p class="fe-set-note">No model list from lm.</p>';
      });
    }
    el("fe-st-ai-refresh").addEventListener("click", refreshAi);
    aiModel.addEventListener("change", () => {
      settings.aiModel = aiModel.value || void 0;
      saveSettings(settings);
    });
    warm.addEventListener("change", () => {
      warm.disabled = true;
      llmWarm(warm.checked).then((r) => {
        if (!r.ok) toast(r.message ? `Warm failed: ${r.message}` : "Warm failed");
        refreshAi();
      });
    });
    function updateTermHint() {
      const term = settings.terminalApp || "ghostty";
      const cmd = term === "custom" ? settings.terminalCmd || "" : TERMINAL_CMDS[term] || "";
      el("fe-st-term-hint").textContent = cmd ? cmd.replace(/\$\{p\}/g, app.folderPath) : "";
    }
    const settingsDlg = mountDialog("fe-settings-modal", { onClose: closePop });
    function openSettings(tab) {
      els('input[name="bfb-theme"]').forEach((r) => {
        r.checked = r.value === (fe.dataset.mode || "dark");
      });
      els('input[name="bfb-palette"]').forEach((r) => {
        r.checked = r.value === (fe.dataset.palette || "slate");
      });
      const icon2 = appIconPref.get();
      els('input[name="bfb-appicon"]').forEach((r) => {
        r.checked = r.value === icon2;
        const img = r.nextElementSibling;
        if (!img.getAttribute("src")) img.src = appIconUrl(r.value);
      });
      v("fe-st-uiscale").value = String(settings.uiScale || 100);
      v("fe-st-rd-size").value = String(settings.readerSize || 15);
      v("fe-st-density").value = settings.compactMode ? "compact" : "roomy";
      el("fe-st-tooltips").checked = settings.tooltips !== false;
      v("fe-st-defview").value = getView();
      const order = getSortConfig();
      v("fe-st-sort").value = order.col ?? "";
      v("fe-st-sort-dir").value = order.dir;
      v("fe-st-group").value = getGroupMode();
      v("fe-st-datefmt").value = settings.dateFormat || "short";
      v("fe-st-click").value = settings.clickOpens || "look";
      v("fe-st-panel").value = getPreviewLayout().mode;
      el("fe-st-sidebar").checked = settings.showSidebar !== false;
      el("fe-st-dock-fold").checked = settings.dockFoldsSidebar !== false;
      el("fe-st-sec-recent").checked = !settings.hideRecent;
      v("fe-st-terminal").value = settings.terminalApp || "ghostty";
      el("fe-st-term-custom-row").style.display = settings.terminalApp === "custom" ? "" : "none";
      el("fe-st-term-custom").value = settings.terminalCmd || "";
      v("fe-st-rd-column").value = savedColumnMode(settings.readerColumn);
      v("fe-st-rd-lh").value = String(settings.readerLineHeight || 1.65);
      v("fe-st-rd-code").value = String(settings.readerCodeSize || 13);
      el("fe-st-wrap").checked = settings.wrapLines !== false;
      v("fe-st-filepages").value = settings.renderFilePages || "all";
      const excluded = Array.isArray(settings.excludedFileExtensions) ? settings.excludedFileExtensions : DEFAULT_SETTINGS.excludedFileExtensions ?? [];
      v("fe-st-excluded-exts").value = excluded.map((x) => "." + x).join(", ");
      el("fe-st-notes-root").value = settings.notesRoot || "";
      v("fe-st-edit-roots").value = (settings.editableFolders ?? []).join(", ");
      updateTermHint();
      renderRulesList();
      refreshAi();
      settingsDlg.open(tab);
    }
    el("fe-settings-btn").addEventListener("click", () => openSettings());
    const helpDlg = mountDialog("fe-help-modal");
    wireKeyboardMap(el("fe-help-modal"));
    el("fe-help-btn").addEventListener("click", () => helpDlg.open());
    el("fe-st-keys").addEventListener("click", () => {
      settingsDlg.close();
      helpDlg.open("keys");
    });
    app.openHelp = (tab) => helpDlg.open(tab);
    app.openSettings = openSettings;
    els('input[name="bfb-theme"]').forEach((r) => r.addEventListener("change", () => setThemeMode(fe, r.value)));
    els('input[name="bfb-palette"]').forEach((r) => r.addEventListener("change", () => {
      fe.dataset.palette = r.value;
      palettePref.set(r.value);
    }));
    els('input[name="bfb-appicon"]').forEach((r) => r.addEventListener("change", () => setAppIcon(r.value)));
    v("fe-st-uiscale").addEventListener("change", () => {
      settings.uiScale = Number(v("fe-st-uiscale").value);
      saveSettings(settings);
      setUiScale(settings.uiScale);
    });
    const textScale = () => document.documentElement.style.setProperty("--ui-text-scale", String(Number(v("fe-st-rd-size").value) / 15));
    v("fe-st-rd-size").addEventListener("input", textScale);
    v("fe-st-rd-size").addEventListener("change", () => {
      textScale();
      settings.readerSize = Number(v("fe-st-rd-size").value);
      saveSettings(settings);
    });
    v("fe-st-density").addEventListener("change", () => {
      settings.compactMode = v("fe-st-density").value === "compact";
      saveSettings(settings);
      fe.classList.toggle("compact", settings.compactMode);
    });
    el("fe-st-tooltips").addEventListener("change", function() {
      settings.tooltips = this.checked;
      saveSettings(settings);
      fe.classList.toggle("fe-notips", !this.checked);
      if (this.checked) toast("Tooltips come back after a reload");
    });
    v("fe-st-defview").addEventListener("change", () => viewPref.set(v("fe-st-defview").value));
    const applyOrder = () => app.setOrder(
      { col: v("fe-st-sort").value || null, dir: v("fe-st-sort-dir").value },
      v("fe-st-group").value
    );
    ["fe-st-sort", "fe-st-sort-dir", "fe-st-group"].forEach((id) => el(id).addEventListener("change", applyOrder));
    v("fe-st-datefmt").addEventListener("change", () => {
      settings.dateFormat = v("fe-st-datefmt").value;
      saveSettings(settings);
      app.applyAll();
    });
    v("fe-st-click").addEventListener("change", () => {
      settings.clickOpens = v("fe-st-click").value;
      saveSettings(settings);
    });
    v("fe-st-panel").addEventListener("change", () => {
      savePreviewLayout({ ...getPreviewLayout(), mode: v("fe-st-panel").value });
      toast("The next preview opens there");
    });
    el("fe-st-panel-reset").addEventListener("click", () => {
      savePreviewLayout({ mode: getPreviewLayout().mode });
      toast("Preview sizes reset");
    });
    el("fe-st-sidebar").addEventListener("change", function() {
      settings.showSidebar = this.checked;
      saveSettings(settings);
      setSidebarShown(this.checked);
    });
    el("fe-st-dock-fold").addEventListener("change", function() {
      settings.dockFoldsSidebar = this.checked;
      saveSettings(settings);
      if (document.querySelector("#fe-qlook.side")?.checkVisibility()) setSidebarShown(this.checked ? false : settings.showSidebar);
    });
    el("fe-st-sec-recent").addEventListener("change", function() {
      settings.hideRecent = !this.checked;
      saveSettings(settings);
      app.showLens?.(this.checked ? null : "notes", !this.checked);
    });
    v("fe-st-terminal").addEventListener("change", () => {
      settings.terminalApp = v("fe-st-terminal").value;
      saveSettings(settings);
      el("fe-st-term-custom-row").style.display = settings.terminalApp === "custom" ? "" : "none";
      updateTermHint();
    });
    el("fe-st-term-custom").addEventListener("input", function() {
      settings.terminalCmd = this.value;
      saveSettings(settings);
      updateTermHint();
    });
    v("fe-st-rd-column").addEventListener("change", () => {
      settings.readerColumn = v("fe-st-rd-column").value;
      saveSettings(settings);
      columnPref.set(settings.readerColumn);
    });
    const readerVar = (id, key, cssVar, unit) => {
      const live2 = () => fe.style.setProperty(cssVar, v(id).value + unit);
      v(id).addEventListener("input", live2);
      v(id).addEventListener("change", () => {
        live2();
        settings[key] = Number(v(id).value);
        saveSettings(settings);
      });
    };
    readerVar("fe-st-rd-lh", "readerLineHeight", "--rd-lh", "");
    readerVar("fe-st-rd-code", "readerCodeSize", "--rd-code", "px");
    el("fe-st-wrap").addEventListener("change", function() {
      settings.wrapLines = this.checked;
      saveSettings(settings);
      fe.dataset.wrap = this.checked ? "on" : "off";
    });
    v("fe-st-filepages").addEventListener("change", () => {
      settings.renderFilePages = v("fe-st-filepages").value;
      saveSettings(settings);
    });
    v("fe-st-excluded-exts").addEventListener("change", () => {
      settings.excludedFileExtensions = parseExcludedExtensions(v("fe-st-excluded-exts").value);
      v("fe-st-excluded-exts").value = settings.excludedFileExtensions.map((x) => "." + x).join(", ");
      saveSettings(settings);
    });
    el("fe-st-excluded-reset").addEventListener("click", () => {
      settings.excludedFileExtensions = [...DEFAULT_SETTINGS.excludedFileExtensions ?? []];
      v("fe-st-excluded-exts").value = settings.excludedFileExtensions.map((x) => "." + x).join(", ");
      saveSettings(settings);
    });
    el("fe-st-notes-pick").addEventListener("click", () => app.pickNotesFolder());
    el("fe-st-notes-root").addEventListener("change", function() {
      settings.notesRoot = this.value.trim() || void 0;
      saveSettings(settings);
      app.refreshNotes();
    });
    v("fe-st-edit-roots").addEventListener("change", () => {
      const list3 = v("fe-st-edit-roots").value.split(",").map((s) => s.trim()).filter(Boolean);
      settings.editableFolders = list3.length ? list3 : void 0;
      saveSettings(settings);
    });
    el("fe-st-export").addEventListener("click", () => {
      const text = JSON.stringify(exportAll(), null, 2);
      const ta = el("fe-st-export-out");
      ta.value = text;
      ta.style.display = "";
      ta.select();
      navigator.clipboard.writeText(text).then(() => toast("Export copied"), () => toast("Export shown below"));
    });
    el("fe-st-import").addEventListener("click", () => el("fe-st-import-file").click());
    el("fe-st-import-file").addEventListener("change", function() {
      const f = this.files?.[0];
      if (!f) return;
      f.text().then((text) => {
        const data = JSON.parse(text);
        const n = importAll(data);
        toast(`Imported ${n} keys, reloading`);
        setTimeout(reload, 600);
      }).catch(() => toast("That file is not a JSON export"));
    });
  }

  // src/md-ui.ts
  function initMarkdownUi(toast) {
    const rendered = /* @__PURE__ */ new WeakMap();
    const pending2 = /* @__PURE__ */ new WeakSet();
    let sequence = 0;
    let queue = Promise.resolve();
    const theme = () => document.getElementById("fe")?.dataset.theme === "light" ? "light" : "dark";
    const renderDiagrams = () => {
      document.querySelectorAll(".fe-md-mermaid").forEach((block) => {
        if (pending2.has(block) || rendered.get(block) === theme()) return;
        pending2.add(block);
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
          pending2.delete(block);
          if (block.isConnected && rendered.get(block) !== theme()) renderDiagrams();
        });
      });
    };
    const fe = document.getElementById("fe");
    if (fe) {
      new MutationObserver(() => {
        renderDiagrams();
        linkFrontMatterPaths();
      }).observe(fe, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["data-theme"]
      });
      renderDiagrams();
      linkFrontMatterPaths();
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
          copy.dataset.done = "";
          copy.innerHTML = UI_ICON.check;
          copy.dataset.timer = String(window.setTimeout(() => {
            delete copy.dataset.done;
            copy.innerHTML = UI_ICON.copy;
          }, 3e3));
        });
        return;
      }
      const img = t.closest(".fe-md img");
      if (img && !img.closest("a")) {
        e.preventDefault();
        go(img.src, "chrome-tab");
      }
    });
  }
  var looked = /* @__PURE__ */ new WeakSet();
  function linkFrontMatterPaths() {
    document.querySelectorAll(".fe-md-fm .fe-fm-path").forEach((span) => {
      if (looked.has(span) || span.tagName === "A") return;
      looked.add(span);
      const base = span.closest(".fe-md-fm")?.dataset.fmBase || location.href;
      const rel = span.dataset.fmPath || "";
      void findPath(rel, base).then((url) => {
        if (!url || !span.isConnected) return;
        const a = document.createElement("a");
        a.className = "fe-fm-path";
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener";
        a.title = decodeURIComponent(new URL(url).pathname);
        a.innerHTML = esc(rel);
        span.replaceWith(a);
      });
    });
  }
  async function findPath(rel, base) {
    let dir;
    try {
      dir = new URL(".", new URL(base, location.href));
    } catch {
      return null;
    }
    const home = /^\/(Users|home)\/[^/]+\//.exec(dir.pathname)?.[0];
    const tries = [];
    if (rel.startsWith("/")) tries.push("file://" + rel);
    else if (rel.startsWith("~/")) {
      if (home) tries.push("file://" + home + rel.slice(2));
    } else for (let d = dir, k = 0; k < 8; k++) {
      tries.push(new URL(rel, d).href);
      const up = new URL("..", d);
      if (up.href === d.href) break;
      d = up;
    }
    for (const url of tries) {
      if (await fileExists(url)) return url;
    }
    return null;
  }

  // src/docs-lens.ts
  var browsedPath = (p) => p.replace(/^\/private\/(var|tmp|etc)(?=\/|$)/, "/$1");
  var forMe = (r) => (r.mentions ?? []).some((m) => m === "user" || m === "owner");
  function docRows(rows, f = { q: "", me: false, due: false }) {
    const q = f.q.trim().toLowerCase();
    return rows.filter((r) => r.exists !== false && r.open + r.done > 0).filter((r) => (!q || r.doc.toLowerCase().includes(q)) && (!f.me || forMe(r)) && (!f.due || !!r.due?.length) && (!f.tag || (r.tags ?? []).includes(f.tag))).sort((a, b) => (b.open > 0 ? 1 : 0) - (a.open > 0 ? 1 : 0) || a.name.localeCompare(b.name));
  }
  function initDocsLens(box, home, go2) {
    let loaded = false, all = [];
    const f = { q: "", me: false, due: false, tag: "" };
    box.innerHTML = `<div class="fe-docs-top" hidden>
      <input id="fe-docs-q" class="tb" data-size="lg" data-lead="search" type="text" placeholder="Filter" spellcheck="false" autocomplete="off" title="Matches the document's name and folder. Esc clears.">
      <div class="fe-lens-tags"><button type="button" class="chip fe-lens-tag" aria-pressed="false" data-f="me" title="Only documents with a comment that mentions you">For me</button><button type="button" class="chip fe-lens-tag" aria-pressed="false" data-f="due" title="Only documents with a due date">Due</button><span class="fe-docs-tags"></span></div>
    </div><div class="fe-docs-rows"></div>`;
    const top = box.querySelector(".fe-docs-top"), rowsBox = box.querySelector(".fe-docs-rows");
    const input = box.querySelector("#fe-docs-q");
    const short = (p) => (home && p.startsWith(home + "/") ? "~" + p.slice(home.length) : p).replace(/\/[^/]+$/, "") || "/";
    const due = (d) => (/* @__PURE__ */ new Date(d + "T00:00:00")).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const paint = () => {
      const usable = docRows(all);
      top.hidden = !usable.length;
      for (const c of top.querySelectorAll("[data-f]")) {
        const on = f[c.dataset.f];
        c.classList.toggle("on", on);
        c.setAttribute("aria-pressed", String(on));
      }
      const counts = /* @__PURE__ */ new Map();
      for (const r of usable) for (const g of r.tags ?? []) counts.set(g, (counts.get(g) ?? 0) + 1);
      const tags = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8).map(([g]) => g);
      if (f.tag && !tags.includes(f.tag)) tags.push(f.tag);
      const tagBox = top.querySelector(".fe-docs-tags");
      const tagHtml = tags.map((g) => `<button type="button" class="chip fe-lens-tag${f.tag === g ? " on" : ""}" aria-pressed="${f.tag === g}" data-tag="${esc(g)}" title="Only documents with a thread tagged #${esc(g)}">#${esc(g)}</button>`).join("");
      if (tagBox.innerHTML !== tagHtml) tagBox.innerHTML = tagHtml;
      const list3 = docRows(all, f);
      if (!usable.length) {
        rowsBox.innerHTML = emptyHtml("empty", "No comments yet", { icon: UI_ICON.comment, hintHtml: "Documents you or an agent<br>comment on show up here" });
        return;
      }
      if (!list3.length) {
        rowsBox.innerHTML = emptyHtml("filtered", "No document matches", { actions: [CLEAR] });
        return;
      }
      rowsBox.innerHTML = list3.map((r) => `<button type="button" class="row fe-doc-row" data-doc="${esc(r.doc)}" title="${esc(r.doc)}">
        <span class="fe-row-ico">${icoFile(r.name.split(".").pop().toLowerCase())}</span>
        <span class="fe-doc-tx"><span class="fe-doc-name">${midHtml(r.name)}</span><span class="fe-doc-dir">${esc(short(r.doc))}</span></span>
        ${forMe(r) ? `<span class="fe-doc-me" title="Mentions you">${UI_ICON.at}</span>` : ""}
        ${r.due?.length ? `<span class="fe-doc-due" title="Due ${esc(r.due[0])}">${esc(due(r.due[0]))}</span>` : ""}
        <span class="badge fe-doc-n" data-tone="${r.open ? "solid" : "quiet"}" title="${r.open} open, ${r.done} done">${r.open || UI_ICON.check}</span>
      </button>`).join("");
    };
    const load = () => notes.docsIndex().then((rows) => {
      all = rows.map((r) => ({ ...r, doc: browsedPath(r.doc) }));
      paint();
    }).catch((err) => {
      top.hidden = true;
      rowsBox.innerHTML = emptyHtml("failed", "Comments could not be listed", { hint: err.message, actions: [{ a: "retry", label: "Try again", title: "List the commented documents again" }] });
    });
    input.addEventListener("input", () => {
      f.q = input.value;
      paint();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && input.value) {
        e.preventDefault();
        input.value = "";
        f.q = "";
        paint();
      }
      e.stopPropagation();
    });
    top.addEventListener("click", (e) => {
      const tg = e.target.closest("[data-tag]");
      if (tg) {
        f.tag = f.tag === tg.dataset.tag ? "" : tg.dataset.tag;
        paint();
        return;
      }
      const c = e.target.closest("[data-f]");
      if (!c) return;
      const k = c.dataset.f;
      f[k] = !f[k];
      paint();
    });
    rowsBox.addEventListener("click", (e) => {
      const b = e.target.closest(".fe-doc-row");
      if (b) {
        go2(b.dataset.doc, "#comments");
        return;
      }
      const a = e.target.closest(".empty [data-a]")?.dataset.a;
      if (a === "clear") {
        input.value = "";
        f.q = "";
        f.tag = "";
        f.me = f.due = false;
        paint();
        input.focus();
      } else if (a === "retry") {
        rowsBox.innerHTML = emptyHtml("loading", "Loading\u2026");
        void load();
      }
    });
    addPaletteSource(() => (loaded ? Promise.resolve(all) : (loaded = true, load().then(() => all))).then((rows) => docRows(rows).map((r) => ({
      title: r.name,
      sub: `${short(r.doc)} \xB7 ${r.open ? `${r.open} open` : "all done"}`,
      group: "Comments",
      tab: "comments",
      icon: icoFile(r.name.split(".").pop().toLowerCase()),
      run: () => go2(r.doc, "#comments")
    }))));
    document.addEventListener("bfb-lens", (e) => {
      if (e.detail !== "comments") return;
      if (!loaded) rowsBox.innerHTML = emptyHtml("loading", "Loading\u2026");
      loaded = true;
      void load();
    });
  }

  // src/main.ts
  async function showClosedSets(strip, visible2) {
    const box = document.getElementById("fe-rc-sets");
    if (!box) return;
    const section = box.closest(".fe-sec");
    const ago2 = (at) => {
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
        return `<button type="button" class="row fe-si fe-rc-set" data-set="${esc(s.id)}" title="Add these tabs to this strip: ${esc(s.labels.join(", "))}">${PI.tabset}<span class="fe-sl">${n} tab${n === 1 ? "" : "s"}: ${esc(s.labels.slice(0, 3).join(", "))}${n > 3 ? "\u2026" : ""}</span><span class="fe-rc-ago">${ago2(s.at)}</span></button>`;
      }).join("");
      section.style.display = visible2 && sets.length ? "" : "none";
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
    syncHtmlGuard(settings);
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
    setLinkHome(homeDir(rawPath));
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
    const extOpts = allExts;
    const iconRules = getIconRules();
    const initDensity = getDensity();
    const initView = getView();
    const initTheme = resolveTheme(themeMode());
    const initPalette = getPalette();
    const initHidden = getShowHidden();
    const recents = getRecents().filter((r) => r.path !== rawPath);
    pushRecent(rawPath);
    const ago2 = (ts) => {
      if (!ts) return "";
      const m = Math.round((Date.now() - ts) / 6e4);
      return m < 1 ? "now" : m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
    };
    const recentRow = (r) => {
      const name = r.path.split("/").filter(Boolean).pop() || "/";
      const isDir = r.path.endsWith("/");
      const ext2 = name.includes(".") ? name.split(".").pop().toLowerCase() : "txt";
      return `<a href="${esc(fileHref(r.path))}" class="row fe-si" title="${esc(r.path)}">${isDir ? PI.folder : icoFile(ext2)}<span class="fe-sl">${esc(name)}</span><span class="fe-rc-ago">${ago2(r.ts)}</span></a>`;
    };
    const recentDirs = recents.filter((r) => r.path.endsWith("/")).slice(0, 12);
    const recentFiles = recents.filter((r) => !r.path.endsWith("/")).slice(0, 12);
    const recentsHTML = `
      <div class="fe-sec" data-sec="recent" data-collapse="recent">
        <div class="sect fe-sh" data-level="group"><span class="fe-sh-label">Folders</span></div>
        ${recentDirs.length ? recentDirs.map(recentRow).join("") : emptyHtml("empty", "Folders you open show up here", { inline: true })}
      </div>
      <div class="fe-sec" data-collapse="recent-files">
        <div class="sect fe-sh" data-level="group"><span class="fe-sh-label">Files</span></div>
        ${recentFiles.length ? recentFiles.map(recentRow).join("") : emptyHtml("empty", "Files you open show up here", { inline: true })}
      </div>
      <div class="fe-sec" data-collapse="recent-tabs" id="fe-rc-tabs-sec" style="display:none">
        <div class="sect fe-sh" data-level="group"><span class="fe-sh-label">Closed tabs</span></div>
        <div id="fe-rc-sets"></div>
      </div>`;
    const html = renderPage({
      initTheme,
      initPalette,
      initView,
      initDensity,
      initHidden,
      fileMode,
      rawPath,
      folderPath,
      fileName,
      segments,
      settings,
      curIsBookmarked: getSaved().some((p) => samePlace(p.path, rawPath)),
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
    document.head.innerHTML = `<meta charset="utf-8"><title>${document.title}</title><link rel="icon" type="image/svg+xml" href="${appIconUrl()}">`;
    document.body.innerHTML = html;
    const styleEl = document.createElement("style");
    styleEl.textContent = CSS2 + UI_CSS;
    document.head.appendChild(styleEl);
    preload?.remove();
    const fe = el("fe");
    fe.dataset.wrap = settings.wrapLines === false ? "off" : "on";
    fe.dataset.mode = themeMode();
    followSystem(fe);
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
    if (settings.uiScale && settings.uiScale !== 100) setUiScale(settings.uiScale);
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
      entryNames: nonPar.map((e) => e.name),
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
          go(fileHref(folderPath), "here", { exact: true });
          return;
        }
        const up = entries.find((x) => x.isParent);
        if (up) go(up.href, "here", { exact: true });
        else if (rawPath !== "/") go("file:///", "here", { exact: true });
      }
    };
    initPreview({
      iconRules: () => app.iconRules,
      aiModel: () => settings.aiModel,
      keepTab: (path) => {
        app.strip.open(path, true);
        app.toast("Kept as a tab");
      },
      saveError: (message) => app.toast(message),
      toast: (message) => app.toast(message),
      savedChanged: () => app.refreshSaved(),
      openInTerminal: (p) => app.openInTerminal(p),
      // A docked preview folds the sidebar away while it shows; the sidebar's own setting comes back after.
      dockRoom: (docked) => setSidebarShown(docked && settings.dockFoldsSidebar !== false ? false : settings.showSidebar)
    });
    app.strip = mountStrip({ el: el("fe-tabs"), rawPath, toast: app.toast, onSavedChange: () => app.refreshSaved(), openInTerminal: (p) => app.openInTerminal(p) });
    void showClosedSets(app.strip, !settings.hideRecent);
    const goTab = (path, hash = "") => app.strip.go(path, hash);
    initDocsLens(el("fe-docs-list"), homeDir(rawPath), goTab);
    mountGoto(el("fe-open-path"), () => homeDir(rawPath), (path, background) => {
      if (!background) {
        goTab(path);
        return;
      }
      app.strip.open(path, true);
      app.toast("Kept as a tab");
    });
    el("fe-open-pick").addEventListener("click", () => {
      notes.pick(rawPath, "any").then(async (p) => {
        const path = p && absPath(p, "");
        const found = path && await resolvePath(path);
        if (found) goTab(found);
      }).catch((err) => app.toast(`Could not open the chooser: ${err.message}`));
    });
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
      if (location.hash.startsWith("#view=") || viewName) reload();
    });
    initChrome(app);
    initMarkdownUi(app.toast);
    installColumnResize();
    const listing = initListing(app, entries, { view: initView, density: initDensity, hidden: initHidden });
    initListingInput(app, listing);
    initSettingsUi(app);
    initToolLenses(app);
    initSidebar(app);
    initFocusNav(app);
    if (!homeDir(rawPath)) {
      notes.home().then((home) => {
        if (!setHomeDir(home)) return;
        setLinkHome(home);
        const list3 = document.querySelector('#fe-lens-places .fe-sec[data-sec="places"]');
        if (list3) list3.innerHTML = placesHTML(home, rawPath);
      }).catch(() => {
      });
    }
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
