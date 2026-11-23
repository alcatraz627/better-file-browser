// Marks: your own comments and pins on any web page.
//
// A comment is made on selected words and shows as a highlight with a small
// badge; a pin marks a spot and can be dragged. Both open a note card. They are
// kept in chrome.storage under the page's address and come back on the next
// visit, found again by their words (comments) or element (pins). Highlights use
// the CSS Custom Highlight API, so the site's own DOM is never wrapped or split,
// which keeps React and similar frameworks from tripping over them.

import { collapseSpace, collapsedIndex, findQuote, makeQuote, pageKey, type Mapped, type Quote } from './site-marks-anchor';
import { MARKS_INDEX, MARKS_PREFIX, markRows, mergeMarks } from './site-marks-store';
import { ICON, esc, hint, inOverlay, offerUndo, overlay, pageLayer, when } from './site-tools-overlay';

export interface PinSpot {
  /** A CSS path to the element the pin sits on. */
  selector: string;
  /** Where on that element, as fractions of its width and height. */
  fx: number; fy: number;
  /** Page coordinates, used when the element cannot be found. */
  x: number; y: number;
}

export interface Mark {
  id: string;
  kind: 'comment' | 'pin';
  note: string;
  created: number;
  updated: number;
  quote?: Quote;
  pin?: PinSpot;
}

interface IndexEntry { title: string; count: number; updated: number }

let key = pageKey(location.href);
let marks: Mark[] = [];
/** The ids last seen in storage, and the ids deleted here since, for merging with another tab. */
let known = new Set<string>();
const gone = new Set<string>();
/** Where each comment's words are on the page now; absent when they are gone. */
const ranges = new Map<string, Range>();
const changeListeners = new Set<() => void>();
export const onMarksChange = (fn: () => void) => { changeListeners.add(fn); return () => changeListeners.delete(fn); };
export const pageMarks = () => marks;
export const isFound = (m: Mark) => m.kind === 'pin' || ranges.has(m.id);

// ---- Storage ----

async function load() {
  const k = MARKS_PREFIX + key;
  try {
    marks = markRows<Mark>((await chrome.storage.local.get(k))[k]);
  } catch {
    marks = [];
  }
  known = new Set(marks.map(m => m.id));
  gone.clear();
}

// Saves run one after another, so a delete and an add made together cannot
// land in the wrong order. Each save starts from what is stored now, so a mark
// another tab added to this page is kept.
let saving: Promise<void> = Promise.resolve();
function save(): Promise<void> {
  saving = saving.then(saveNow, saveNow);
  return saving;
}
async function saveNow() {
  const k = MARKS_PREFIX + key;
  const got = await chrome.storage.local.get([k, MARKS_INDEX]);
  const index = (got[MARKS_INDEX] && typeof got[MARKS_INDEX] === 'object' ? got[MARKS_INDEX] : {}) as Record<string, IndexEntry>;
  const before = marks.length;
  marks = mergeMarks(markRows<Mark>(got[k]), marks, known, gone);
  known = new Set(marks.map(m => m.id));
  gone.clear();
  if (marks.length) {
    index[key] = { title: document.title.slice(0, 200) || key, count: marks.length, updated: Date.now() };
    await chrome.storage.local.set({ [k]: marks, [MARKS_INDEX]: index });
  } else {
    delete index[key];
    await chrome.storage.local.remove(k);
    await chrome.storage.local.set({ [MARKS_INDEX]: index });
  }
  if (marks.length !== before) shown();
}

/** Redraws this page's marks and tells the panel, after the list changed. */
function shown() {
  anchorAll();
  draw();
  for (const fn of changeListeners) fn();
}

// The same page open in another tab: its saves arrive here as they land.
function hearOtherTabs() {
  chrome.storage.onChanged.addListener((changes, area) => {
    const c = area === 'local' ? changes[MARKS_PREFIX + key] : undefined;
    if (!c) return;
    const stored = markRows<Mark>(c.newValue);
    if (JSON.stringify(stored) === JSON.stringify(marks)) return;   // this tab's own save
    marks = mergeMarks(stored, marks, known, gone);
    known = new Set(stored.map(m => m.id));
    shown();
  });
}

/** Every page with marks, newest first, for the panel's All pages list. */
export async function allPages(): Promise<(IndexEntry & { key: string })[]> {
  const index = ((await chrome.storage.local.get(MARKS_INDEX))[MARKS_INDEX] ?? {}) as Record<string, IndexEntry>;
  return Object.entries(index).map(([k, v]) => ({ key: k, ...v })).sort((a, b) => b.updated - a.updated);
}

function changed() {
  void save();
  draw();
  for (const fn of changeListeners) fn();
}

const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

// ---- The page's text, for finding words ----

interface TextIndex { nodes: Text[]; starts: number[]; raw: string; map: Mapped }

const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'TEMPLATE', 'SVG']);

function textIndex(): TextIndex {
  const nodes: Text[] = [], starts: number[] = [];
  let raw = '';
  const walker = document.createTreeWalker(document.body ?? document.documentElement, NodeFilter.SHOW_TEXT, {
    acceptNode: n => {
      const p = n.parentElement;
      if (!p || SKIP.has(p.tagName.toUpperCase()) || inOverlay(p)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    nodes.push(n);
    starts.push(raw.length);
    raw += n.data;
  }
  return { nodes, starts, raw, map: collapseSpace(raw) };
}

/** The text node holding a raw offset, and the offset inside it. */
function locate(idx: TextIndex, raw: number): [Text, number] | null {
  let lo = 0, hi = idx.starts.length - 1;
  if (hi < 0) return null;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (idx.starts[mid] <= raw) lo = mid; else hi = mid - 1;
  }
  return [idx.nodes[lo], Math.min(raw - idx.starts[lo], idx.nodes[lo].data.length)];
}

function rangeFor(idx: TextIndex, start: number, end: number): Range | null {
  if (end <= start || end > idx.map.o.length) return null;
  const a = locate(idx, idx.map.o[start]);
  const b = locate(idx, idx.map.o[end - 1] + 1);
  if (!a || !b) return null;
  const r = document.createRange();
  r.setStart(a[0], a[1]);
  r.setEnd(b[0], b[1]);
  return r;
}

/** The raw text offset of a range boundary. */
function rawOffset(idx: TextIndex, node: Node, offset: number): number {
  if (node.nodeType === Node.TEXT_NODE) {
    const i = idx.nodes.indexOf(node as Text);
    if (i >= 0) return idx.starts[i] + offset;
  }
  // A boundary between elements: the first indexed text at or after it.
  const probe = document.createRange();
  probe.setStart(node, offset);
  for (let i = 0; i < idx.nodes.length; i++) {
    if (probe.comparePoint(idx.nodes[i], 0) >= 0) return idx.starts[i];
  }
  return idx.raw.length;
}

// ---- Highlights ----

const HL = 'bfb-mark', HL_ACTIVE = 'bfb-mark-active';

function ensureHighlightStyle() {
  if (document.getElementById('bfb-marks-style')) return;
  const style = document.createElement('style');
  style.id = 'bfb-marks-style';
  // A tint alone vanishes on a dark page, so every highlight is also underlined.
  // Under Invert the page filter flips these colours, so they are given pre-flipped.
  const line = (c: string) => `text-decoration:underline 2px ${c};text-underline-offset:3px`;
  style.textContent =
    `::highlight(${HL}){background-color:rgba(251,191,36,.3);${line('rgba(217,119,6,.9)')}}` +
    `::highlight(${HL_ACTIVE}){background-color:rgba(251,146,60,.55);${line('rgb(234,88,12)')}}` +
    `html:is([data-bfb-lights=smart],[data-bfb-lights=native])::highlight(${HL}){background-color:rgba(251,191,36,.22);${line('rgb(251,191,36)')}}` +
    `html:is([data-bfb-lights=smart],[data-bfb-lights=native])::highlight(${HL_ACTIVE}){background-color:rgba(251,191,36,.4);${line('rgb(253,224,71)')}}` +
    `html[data-bfb-lights=invert]::highlight(${HL}){background-color:rgba(4,64,219,.3);${line('rgb(4,64,219)')}}` +
    `html[data-bfb-lights=invert]::highlight(${HL_ACTIVE}){background-color:rgba(4,109,195,.55);${line('rgb(4,109,195)')}}`;
  (document.head ?? document.documentElement).append(style);
}

function anchorAll() {
  ranges.clear();
  const comments = marks.filter(m => m.kind === 'comment' && m.quote);
  if (comments.length) {
    const idx = textIndex();
    for (const m of comments) {
      const at = findQuote(idx.map.s, m.quote!);
      const r = at && rangeFor(idx, at.start, at.end);
      if (r) ranges.set(m.id, r);
    }
  }
  paintHighlights();
}

let activeId: string | null = null;

function paintHighlights() {
  if (!('highlights' in CSS)) return;
  ensureHighlightStyle();
  const normal: Range[] = [], active: Range[] = [];
  for (const [id, r] of ranges) (id === activeId ? active : normal).push(r);
  CSS.highlights.set(HL, new Highlight(...normal));
  CSS.highlights.set(HL_ACTIVE, new Highlight(...active));
}

// ---- Drawing pins and badges ----

function pinPoint(spot: PinSpot): { x: number; y: number } {
  let el: Element | null = null;
  try { el = spot.selector ? document.querySelector(spot.selector) : null; } catch { /* a selector the page no longer accepts */ }
  if (el) {
    const r = el.getBoundingClientRect();
    if (r.width || r.height) return { x: r.left + scrollX + spot.fx * r.width, y: r.top + scrollY + spot.fy * r.height };
  }
  return { x: spot.x, y: spot.y };
}

function draw() {
  if (!marks.length && !document.getElementById('bfb-site-tools')) return;
  const layer = pageLayer();
  const seen = new Set<string>();
  for (const m of marks) {
    let pos: { x: number; y: number } | null = null;
    if (m.kind === 'pin' && m.pin) pos = pinPoint(m.pin);
    else {
      const r = ranges.get(m.id);
      const rects = r ? [...r.getClientRects()].filter(x => x.width > 0) : [];
      if (rects.length) pos = { x: Math.min(rects[0].right + scrollX, scrollX + innerWidth - 16), y: rects[0].top + scrollY };
    }
    let el = layer.querySelector<HTMLElement>(`[data-id="${m.id}"]`);
    if (!pos) { el?.remove(); continue; }
    seen.add(m.id);
    if (!el) {
      el = document.createElement('div');
      el.dataset.id = m.id;
      el.className = m.kind === 'pin' ? 'pin' : 'badge';
      el.innerHTML = m.kind === 'pin' ? ICON.pin : ICON.comment;
      el.title = m.note ? m.note.slice(0, 140) : m.kind === 'pin' ? 'Pin' : 'Comment';
      if (m.kind === 'pin') makeDraggable(el, m);
      else el.addEventListener('click', e => { e.stopPropagation(); openCard(m); });
      layer.append(el);
    }
    el.title = m.note ? m.note.slice(0, 140) : m.kind === 'pin' ? 'Pin' : 'Comment';
    el.style.left = `${pos.x}px`;
    el.style.top = `${pos.y}px`;
  }
  for (const el of layer.querySelectorAll<HTMLElement>('[data-id]')) if (!seen.has(el.dataset.id!)) el.remove();
}

let drawQueued = false;
function queueDraw() {
  if (drawQueued) return;
  drawQueued = true;
  requestAnimationFrame(() => { drawQueued = false; draw(); });
}

// ---- Pins ----

/** A CSS path to an element, short when it or an ancestor has a stable id. */
export function cssPath(el: Element): string {
  const parts: string[] = [];
  for (let cur: Element | null = el; cur && cur !== document.documentElement; cur = cur.parentElement) {
    // Ids that look generated (digits, long hashes) change between visits.
    if (cur.id && !/\d{3,}|[a-f0-9]{8,}|:/.test(cur.id) && document.querySelectorAll(`#${CSS.escape(cur.id)}`).length === 1) {
      parts.unshift(`#${CSS.escape(cur.id)}`);
      break;
    }
    const tag = cur.tagName.toLowerCase();
    const parent: Element | null = cur.parentElement;
    const same = parent ? [...parent.children].filter(c => c.tagName === cur!.tagName) : [];
    parts.unshift(same.length > 1 ? `${tag}:nth-of-type(${same.indexOf(cur) + 1})` : tag);
  }
  return parts.join('>');
}

function spotAt(clientX: number, clientY: number): PinSpot {
  const el = document.elementsFromPoint(clientX, clientY).find(e => !inOverlay(e) && e !== document.documentElement) ?? document.body;
  const r = el.getBoundingClientRect();
  return {
    selector: el === document.body ? '' : cssPath(el),
    fx: r.width ? (clientX - r.left) / r.width : 0,
    fy: r.height ? (clientY - r.top) / r.height : 0,
    x: clientX + scrollX,
    y: clientY + scrollY,
  };
}

/** Drops a pin at a point in the window and opens its note. */
export function pinAt(clientX: number, clientY: number) {
  const now = Date.now();
  const m: Mark = { id: newId(), kind: 'pin', note: '', created: now, updated: now, pin: spotAt(clientX, clientY) };
  marks.push(m);
  changed();
  openCard(m, true);
}

let veil: HTMLDivElement | null = null;

/** Asks for a click on the page, then drops a pin there. Esc cancels. */
export function startPinDrop() {
  if (veil) return;
  veil = document.createElement('div');
  veil.className = 'veil';
  const tip = hint('Click where the pin goes. Esc cancels.', 0);
  const end = () => { veil?.remove(); tip.remove(); veil = null; removeEventListener('keydown', onKey, true); };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); end(); } };
  veil.addEventListener('click', e => { e.preventDefault(); end(); pinAt(e.clientX, e.clientY); });
  addEventListener('keydown', onKey, true);
  overlay().append(veil);
}

function makeDraggable(el: HTMLElement, m: Mark) {
  let moved = false, startX = 0, startY = 0;
  el.addEventListener('pointerdown', e => {
    e.preventDefault();
    e.stopPropagation();
    moved = false; startX = e.clientX; startY = e.clientY;
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', e => {
    if (!el.hasPointerCapture(e.pointerId)) return;
    if (!moved && Math.hypot(e.clientX - startX, e.clientY - startY) < 4) return;
    moved = true;
    el.classList.add('dragging');
    el.style.left = `${e.clientX + scrollX}px`;
    el.style.top = `${e.clientY + scrollY}px`;
  });
  el.addEventListener('pointerup', e => {
    if (!el.hasPointerCapture(e.pointerId)) return;
    el.releasePointerCapture(e.pointerId);
    el.classList.remove('dragging');
    if (!moved) { openCard(m); return; }
    // The pin's own point is its tip, so the spot is read from under the tip.
    el.style.display = 'none';
    m.pin = spotAt(e.clientX, e.clientY);
    el.style.display = '';
    m.updated = Date.now();
    changed();
  });
  el.addEventListener('click', e => e.stopPropagation());
}

// ---- Comments ----

/** Makes a comment on the selected words, or says what to do when none are selected. */
export function commentOnSelection(): boolean {
  const sel = getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) { hint('Select some words first, then Comment.'); return false; }
  const range = sel.getRangeAt(0);
  if (inOverlay(range.commonAncestorContainer)) return false;
  const idx = textIndex();
  const start = collapsedIndex(idx.map, rawOffset(idx, range.startContainer, range.startOffset));
  const end = collapsedIndex(idx.map, rawOffset(idx, range.endContainer, range.endOffset));
  let s = start, e = end;
  while (s < e && idx.map.s[s] === ' ') s++;
  while (e > s && idx.map.s[e - 1] === ' ') e--;
  if (e <= s) { hint('Those words can\'t take a comment.'); return false; }
  const now = Date.now();
  const m: Mark = { id: newId(), kind: 'comment', note: '', created: now, updated: now, quote: makeQuote(idx.map.s, s, Math.min(e, s + 2000)) };
  marks.push(m);
  const r = rangeFor(idx, s, e);
  if (r) ranges.set(m.id, r);
  sel.removeAllRanges();
  changed();
  paintHighlights();
  openCard(m, true);
  return true;
}

/** Opens the comment under a click on highlighted words. */
function onPageClick(e: MouseEvent) {
  if (inOverlay(e.target) || !ranges.size || e.button !== 0) return;
  if (!getSelection()?.isCollapsed) return;
  const pos = document.caretPositionFromPoint?.(e.clientX, e.clientY);
  if (!pos) return;
  for (const [id, r] of ranges) {
    if (r.comparePoint(pos.offsetNode, pos.offset) === 0 && (r.startContainer !== pos.offsetNode || r.startOffset !== pos.offset)) {
      const m = marks.find(x => x.id === id);
      if (m) openCard(m);
      return;
    }
  }
}

// ---- The note card ----

let card: HTMLDivElement | null = null;
let closeCard: (() => void) | null = null;

/** Opens the note card for a mark, beside it. A new mark with no note is removed on close. */
export function openCard(m: Mark, isNew = false) {
  closeCard?.();
  activeId = m.id;
  paintHighlights();
  card = document.createElement('div');
  card.className = 'card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', m.kind === 'pin' ? 'Pin note' : 'Comment');
  const quote = m.quote ? `<p class="quote">${esc(m.quote.exact.slice(0, 300))}</p>` : '';
  card.innerHTML = `${quote}<textarea placeholder="${m.kind === 'pin' ? 'Note for this spot' : 'Your comment'}">${esc(m.note)}</textarea>
    <div class="row"><span class="when">${isNew ? 'New' : `Edited ${when(m.updated)}`}</span>
    <button class="icon-btn danger" data-act="delete" title="Delete this ${m.kind}" aria-label="Delete">${ICON.trash}</button>
    <button class="btn primary" data-act="save" title="Save (⌘ Enter)">${ICON.check}Save</button></div>`;
  overlay().append(card);
  placeCard(card, m);
  const box = card.querySelector('textarea')!;
  box.focus();
  box.setSelectionRange(box.value.length, box.value.length);

  const done = (keep: boolean) => {
    if (!card) return;
    const text = box.value.trim();
    card.remove();
    card = null; closeCard = null; activeId = null;
    removeEventListener('pointerdown', outside, true);
    if (keep && text !== m.note) { m.note = text; m.updated = Date.now(); }
    // A brand-new mark closed without a note was a slip, so it goes.
    if (isNew && !m.note) { marks = marks.filter(x => x !== m); ranges.delete(m.id); gone.add(m.id); }
    changed();
    paintHighlights();
  };
  // Closing any way but Delete keeps what was typed, so no words are lost.
  closeCard = () => done(true);
  const outside = (e: PointerEvent) => { if (card && !e.composedPath().includes(card)) done(true); };
  addEventListener('pointerdown', outside, true);
  card.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); done(true); }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); done(true); }
  });
  // Keys typed in the card must not reach the site's own shortcuts.
  card.addEventListener('keyup', e => e.stopPropagation());
  card.addEventListener('keypress', e => e.stopPropagation());
  card.querySelector('[data-act="save"]')!.addEventListener('click', () => done(true));
  card.querySelector('[data-act="delete"]')!.addEventListener('click', () => {
    // Whatever was typed is kept on the mark, so Undo brings it back whole.
    const text = box.value.trim();
    if (text) m.note = text;
    isNew = false;
    done(false);
    deleteMark(m);
  });
}

function placeCard(el: HTMLDivElement, m: Mark) {
  let x = innerWidth / 2 - 150, y = 80;
  if (m.kind === 'pin' && m.pin) {
    const p = pinPoint(m.pin);
    x = p.x - scrollX + 16; y = p.y - scrollY - 10;
  } else {
    const r = ranges.get(m.id)?.getBoundingClientRect();
    if (r) { x = r.left; y = r.bottom + 8; }
  }
  const h = el.offsetHeight || 160;
  if (y + h > innerHeight - 8) y = Math.max(8, y - h - 40);
  el.style.left = `${Math.max(8, Math.min(x, innerWidth - 308))}px`;
  el.style.top = `${Math.max(8, y)}px`;
}

/** Scrolls a mark into view and flashes it. */
export function reveal(m: Mark) {
  let y: number | null = null;
  if (m.kind === 'pin' && m.pin) y = pinPoint(m.pin).y;
  else {
    const r = ranges.get(m.id)?.getBoundingClientRect();
    if (r) y = r.top + scrollY;
  }
  if (y == null) { hint('Those words are not on the page now.'); return; }
  scrollTo({ top: Math.max(0, y - innerHeight / 3), behavior: 'smooth' });
  const el = pageLayer().querySelector<HTMLElement>(`[data-id="${m.id}"]`);
  el?.classList.remove('flash');
  void el?.offsetWidth;
  el?.classList.add('flash');
  activeId = m.id;
  paintHighlights();
  setTimeout(() => { if (activeId === m.id && !card) { activeId = null; paintHighlights(); } }, 1800);
}

/** Removes a mark, with a few seconds to take it back. */
export function deleteMark(m: Mark) {
  const at = marks.indexOf(m);
  marks = marks.filter(x => x !== m);
  ranges.delete(m.id);
  gone.add(m.id);
  changed();
  paintHighlights();
  offerUndo(`${m.kind === 'pin' ? 'Pin' : 'Comment'} deleted`, () => {
    gone.delete(m.id);
    known.delete(m.id);
    marks.splice(Math.min(at, marks.length), 0, m);
    anchorAll();
    changed();
  });
}

/** This page's marks as Markdown, for pasting into notes. */
export function marksMarkdown(): string {
  const lines = [`# ${document.title || key}`, '', `<${key}>`, ''];
  for (const m of marks) {
    if (m.kind === 'comment') lines.push(`> ${m.quote?.exact ?? ''}`, '', m.note || '_(no note)_', '');
    else lines.push(`- Pin: ${m.note || '_(no note)_'}`, '');
  }
  return lines.join('\n');
}

// ---- Start ----

let lastContext = { x: innerWidth / 2, y: innerHeight / 2 };
/** Where the last right-click was, for "Drop a pin here". */
export const contextPoint = () => lastContext;

let reanchorTimer = 0;

/** Starts Marks on this page: loads its marks and keeps them in place. */
export async function startMarks() {
  addEventListener('contextmenu', e => { lastContext = { x: e.clientX, y: e.clientY }; }, true);
  addEventListener('click', onPageClick, true);
  addEventListener('resize', queueDraw);
  addEventListener('scroll', queueDraw, { capture: true, passive: true });
  await load();
  hearOtherTabs();
  anchorAll();
  draw();
  for (const fn of changeListeners) fn();
  // A page that changes its text (late content, a re-render) is re-read for marks.
  new MutationObserver(records => {
    if (!marks.length || records.every(r => inOverlay(r.target))) return;
    clearTimeout(reanchorTimer);
    reanchorTimer = window.setTimeout(() => { anchorAll(); draw(); for (const fn of changeListeners) fn(); }, 400);
  }).observe(document.body ?? document.documentElement, { subtree: true, childList: true, characterData: true });
  // Single-page apps change address without loading a page.
  setInterval(async () => {
    const now = pageKey(location.href);
    if (now === key) return;
    closeCard?.();
    key = now;
    await load();
    anchorAll();
    draw();
    for (const fn of changeListeners) fn();
  }, 800);
  // Late images and fonts move things after load.
  addEventListener('load', () => { anchorAll(); draw(); });
}
