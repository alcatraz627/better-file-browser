// The shared parts. Every screen and sheet is built from these and nothing
// else (check.js reads the screens and fails any line that draws its own
// markup), so a change to a part reaches every screen that uses it.

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const on = (act, arg = '') => act ? `data-act="${act}" data-arg="${esc(arg)}"` : '';
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const KIND_ICON = { folder: 'folder', doc: 'doc', code: 'code', table: 'table', image: 'image', search: 'filter', note: 'note' };

/** Long text wraps to two lines and fades; `one` keeps it to a single line. */
const clamp = (text, one = false) => `<span class="clamp${one ? ' one' : ''}">${esc(text)}</span>`;

function ibtn(symbol, label, act, arg = '', cls = '') {
  return `<button type="button" class="ibtn ${cls}" ${on(act, arg)} aria-label="${esc(label)}" title="${esc(label)}">${icon(symbol, 21)}</button>`;
}

/** A button with words. kind: '' (outlined), 'primary' (the one verb a page exists for), 'quiet'. */
function btn(label, symbol, act, arg = '', kind = '') {
  return `<button type="button" class="btn ${kind}" ${on(act, arg)}>${icon(symbol, 18)}<span>${esc(label)}</span></button>`;
}

/**
 * The bar at the top. A bar place shows its name large; a child place shows
 * Back (named for where it goes) and a one-line title. `trail` is the folder
 * path when the place has one; it scrolls sideways rather than wrapping.
 */
function topBar(placeId, o = {}) {
  const p = PLACE[placeId], actions = `<span class="p-actions">${o.actions || ''}</span>`;
  if (p.kind === 'bar') return `<header class="p-top bar-top"><h1 class="big">${esc(o.title || p.label)}</h1>${actions}</header>`;
  const to = PLACE[backTarget(placeId)];
  const name = `<span class="trail">${esc(o.trail ? o.trail.join(' / ') : '')}</span><span class="p-name">${clamp(o.title || p.label, true)}</span>`;
  // With a trail, the title is a button: it lists the folders above as full-size rows.
  const title = o.trail ? `<button type="button" class="p-title" ${on('sheet', 'path')} aria-label="${esc(o.title)}, in ${esc(o.trail.join(' / '))}">${name}</button>` : `<span class="p-title">${name}</span>`;
  return `<header class="p-top"><button type="button" class="back" ${on('back')} aria-label="Back to ${esc(to.label)}">${icon('back', 22)}</button>${title}${actions}</header>`;
}

/** The five places along the bottom, with a count badge where something waits. */
function bottomBar(current, badges = {}) {
  return `<nav class="p-bottom" aria-label="Places">${BAR.map(id => {
    const p = PLACE[id], n = badges[id];
    return `<button type="button" class="tab${barOf(current) === id ? ' on' : ''}" ${on('go', id)} aria-label="${esc(p.label)}${n ? `, ${n} waiting` : ''}">${icon(p.icon, 23)}<span>${esc(p.label)}</span>${n ? `<b class="badge">${n}</b>` : ''}</button>`;
  }).join('')}</nav>`;
}

/** A labelled group of content; `more` is a quiet link on the label's right. */
function section(label, body, more = '') {
  return `<section class="sec"><div class="sec-head"><h2 class="sec-label">${esc(label)}</h2>${more}</div>${body}</section>`;
}

const group = rows => `<div class="group">${rows}</div>`;
const stack = parts => `<div class="stack">${parts}</div>`;
const scroller = parts => `<div class="hscroll">${parts}</div>`;
/** Cards two to a row, for a folder seen as a grid. */
const tiles = parts => `<div class="tiles">${parts}</div>`;

/**
 * One thing in a list. `act` makes the whole row a button; `more` adds the
 * row's action menu on its right (the phone's stand-in for hover and right-click).
 */
function row(o) {
  const tag = o.act ? 'button' : 'div';
  const cls = ['row', o.picked && 'picked', o.dim && 'dim'].filter(Boolean).join(' ');
  const lead = o.check != null ? `<span class="row-check${o.check ? ' on' : ''}">${o.check ? icon('check', 16) : ''}</span>` : '';
  const ico = o.icon ? `<span class="row-ico${o.tone ? ' t-' + o.tone : ''}">${icon(o.icon, 21)}</span>` : '';
  const tags = (o.tags || []).map(t => `<i class="tagdot t-${DATA.tagColors[t] || 'grey'}">${esc(t)}</i>`).join('');
  const end = [o.count ? `<b class="count">${esc(o.count)}</b>` : '', o.pill ? statePill(o.pill) : '', o.meta ? `<span class="meta">${esc(o.meta)}</span>` : '', o.opens ? icon('forward', 16) : ''].join('');
  const body = `${lead}${ico}<span class="row-copy"><span class="row-title">${clamp(o.title, !o.wrap)}${o.dot ? `<i class="cdot t-${o.dot}"></i>` : ''}</span>${o.sub || tags ? `<span class="row-sub">${o.sub ? clamp(o.sub, true) : ''}${tags}</span>` : ''}${o.snippet ? `<span class="row-snip">${o.snippet}</span>` : ''}</span>${end ? `<span class="row-end">${end}</span>` : ''}`;
  const main = `<${tag} ${o.act ? 'type="button"' : ''} class="${cls}" ${on(o.act, o.arg)}>${body}</${tag}>`;
  const tail = o.more ? ibtn('more', `More for ${o.title}`, 'sheet', o.more, 'row-more') : o.handle ? `<span class="row-handle" aria-label="Drag to reorder">${icon('drag', 20)}</span>` : '';
  return tail ? `<div class="row-wrap">${main}${tail}</div>` : main;
}

/** A big number that opens what it counts. */
function stat(o) {
  return `<button type="button" class="stat${o.hot ? ' hot' : ''}" ${on(o.act, o.arg)}><span class="stat-ico t-${o.tone}">${icon(o.icon, 19)}</span><b>${esc(o.n)}</b><span class="stat-l">${esc(o.label)}</span></button>`;
}

/** A card in a sideways list: a recent file, an open page. */
function card(o) {
  return `<button type="button" class="card" ${on(o.act, o.arg)}><span class="card-ico">${icon(o.icon, 20)}</span><span class="card-t">${clamp(o.title, true)}</span><span class="card-s">${clamp(o.sub, true)}</span></button>`;
}

/** Pick one of a few, as a full-width switch. items: [label, icon]. */
function seg(items, selected, act, label) {
  return `<div class="seg" role="tablist" aria-label="${esc(label)}">${items.map(([name, symbol]) =>
    `<button type="button" role="tab" aria-selected="${name === selected}" ${on(act, name)}>${icon(symbol, 16)}<span>${esc(name)}</span></button>`).join('')}</div>`;
}

/** Filters you can stack: a row of chips that scrolls sideways. items: [label, count?, tone?]. */
function chips(items, picked, act) {
  return `<div class="chips" role="group">${items.map(([name, n, tone]) =>
    `<button type="button" class="chip${picked.includes(name) ? ' on' : ''}" ${on(act, name)} aria-pressed="${picked.includes(name)}">${tone ? `<i class="cdot t-${tone}"></i>` : ''}<span>${esc(name)}</span>${n != null ? `<b>${n}</b>` : ''}</button>`).join('')}</div>`;
}

/** The floating button for the one thing a list place makes. */
function fab(label, symbol, act, arg = '') {
  return `<button type="button" class="fab" ${on(act, arg)} aria-label="${esc(label)}">${icon(symbol, 24)}<span>${esc(label)}</span></button>`;
}

/** A line across the page that says something is off, with the way out. */
function banner(tone, text, action = '') {
  return `<div class="banner t-${tone}" role="status">${icon(tone === 'bad' ? 'wifi' : 'clock', 18)}<span>${esc(text)}</span>${action}</div>`;
}

/** Nothing here yet: what this place holds and how to fill it. */
function empty(symbol, title, sub, action = '') {
  return `<div class="empty">${icon(symbol, 36)}<b>${esc(title)}</b><p>${esc(sub)}</p>${action}</div>`;
}

/** A text box. kind 'search' adds the glass; 'area' is several lines. */
function field(o) {
  if (o.kind === 'area') return `<textarea class="field area" aria-label="${esc(o.label)}" placeholder="${esc(o.placeholder || '')}">${esc(o.value || '')}</textarea>`;
  return `<label class="field${o.kind === 'search' ? ' search' : ''}">${o.kind === 'search' ? icon('search', 18) : ''}<input type="text" aria-label="${esc(o.label)}" placeholder="${esc(o.placeholder || '')}" value="${esc(o.value || '')}"></label>`;
}

/** An on or off setting. */
function toggle(label, sub, isOn, act, arg = '') {
  return `<button type="button" class="row toggle" role="switch" aria-checked="${isOn}" ${on(act, arg)}><span class="row-copy"><span class="row-title">${clamp(label)}</span>${sub ? `<span class="row-sub">${clamp(sub, true)}</span>` : ''}</span><span class="switch${isOn ? ' on' : ''}"><i></i></span></button>`;
}

const STATE_WORDS = { you: 'needs you', waiting: 'waiting', ready: 'ready', parked: 'parked', done: 'done' };
/** A Directions state as a coloured word. */
const statePill = state => `<span class="pill s-${state}"><i></i>${STATE_WORDS[state]}</span>`;

/** How far along: a bar and the words for it. */
function progress(done, total, words) {
  return `<div class="progress" role="progressbar" aria-valuenow="${done}" aria-valuemax="${total}"><span class="track"><i style="width:${Math.round(done / Math.max(total, 1) * 100)}%"></i></span><span>${esc(words)}</span></div>`;
}

/** The tools along the bottom of a reading place; each is an icon over a word. */
function toolbar(items) {
  return `<nav class="p-tools" aria-label="Tools">${items.map(([label, symbol, act, arg, n]) =>
    `<button type="button" class="tool" ${on(act, arg)}>${icon(symbol, 21)}<span>${esc(label)}</span>${n ? `<b class="badge">${n}</b>` : ''}</button>`).join('')}</nav>`;
}

/** Keys above the keyboard while writing. */
function keybar(items) {
  return `<div class="keybar" role="toolbar" aria-label="Format">${items.map(([label, symbol, act]) => ibtn(symbol, label, act, label)).join('')}</div>`;
}

/** A rendered markdown document. A block with a thread id carries its highlight. */
function doc(blocks) {
  return `<article class="md">${blocks.map(([kind, body, thread]) => {
    if (kind === 'h1' || kind === 'h2') return `<${kind}>${esc(body)}</${kind}>`;
    if (kind === 'ul') return `<ul>${body.map(li => `<li>${esc(li)}</li>`).join('')}</ul>`;
    if (kind === 'code') return `<pre><code>${esc(body)}</code></pre>`;
    if (kind === 'mermaid') return diagram(body, true);
    if (thread) {
      const t = DATA.threads.find(x => x.id === thread);
      return `<p>${esc(body.replace(t.quote, '\u0000'))}</p>`.replace('\u0000', `<button type="button" class="mark" ${on('sheet', 'thread|' + thread)}>${esc(t.quote)}</button>`);
    }
    return `<p>${esc(body)}</p>`;
  }).join('')}</article>`;
}

/** A small flowchart. `inline` is the doc's figure that opens the full view. */
function diagram(title, inline = false) {
  const svg = `<svg class="flow" viewBox="0 0 300 150" role="img" aria-label="${esc(title)}"><g class="fl-e"><path d="M70 45h50M180 45h50M150 60v40"/></g>
    <g class="fl-n"><rect x="10" y="25" width="60" height="40" rx="8"/><rect x="120" y="25" width="60" height="40" rx="8"/><rect x="230" y="25" width="60" height="40" rx="8"/><rect x="110" y="100" width="80" height="40" rx="8"/></g>
    <g class="fl-t"><text x="40" y="50">Look</text><text x="150" y="50">Keep</text><text x="260" y="50">Go</text><text x="150" y="125">Tab strip</text></g></svg>`;
  return inline ? `<button type="button" class="fig" ${on('go', 'diagram')} aria-label="Open the diagram ${esc(title)}">${svg}<span class="fig-cap">${icon('zoom', 15)}${esc(title)}</span></button>` : `<div class="fig full">${svg}</div>`;
}

/** One comment thread: the words it is about, what was said, and the way to answer. */
function thread(t, open = false) {
  const said = [{ who: t.who, when: t.when, text: t.text }, ...t.replies];
  return `<div class="thread${t.state === 'done' ? ' done' : ''}"><blockquote>${esc(t.quote)}</blockquote>${said.map(s =>
    `<div class="msg"><b>${esc(s.who)}</b><span class="meta">${esc(s.when)}</span><p>${esc(s.text)}</p></div>`).join('')}${open ? '' : `<button type="button" class="link" ${on('sheet', 'thread|' + t.id)}>${t.state === 'done' ? 'Done, show it' : plural(said.length, 'message') + ', reply'}</button>`}</div>`;
}

/** One message in a chat. */
const bubble = m => `<div class="bubble ${m.who}"><p>${esc(m.text)}</p></div>`;

/** Write and send. Stays above the keyboard. */
function composer(placeholder, act, arg = '') {
  return `<div class="composer">${field({ label: placeholder, placeholder })}<button type="button" class="send" ${on(act, arg)} aria-label="Send">${icon('send', 20)}</button></div>`;
}

/** One question on a decision page, its options as big choices. */
function question(q, n, of) {
  return `<section class="q${q.flagged ? ' flagged' : ''}"><div class="q-head"><span class="q-n">${n} of ${of}</span>${q.flagged ? `<span class="pill s-you"><i></i>flagged</span>` : ''}</div><h2>${esc(q.title)}</h2><p class="q-why">${esc(q.why)}</p><div class="choices" role="radiogroup">${q.options.map((o, i) =>
    `<button type="button" role="radio" aria-checked="${i === q.pick}" class="choice${i === q.pick ? ' on' : ''}" ${on('pick', q.id + '|' + i)}><span class="radio"><i></i></span><span>${esc(o)}</span>${i === q.rec ? `<span class="rec">my pick</span>` : ''}</button>`).join('')}</div>${btn('Add a note', 'comment', 'sheet', 'qnote|' + q.id, 'quiet')}</section>`;
}

/** A sideways bar of the open pages count; sits on any top bar. */
const openPagesBtn = n => `<button type="button" class="ibtn tabsbtn" ${on('sheet', 'open')} aria-label="${plural(n, 'open page')}">${icon('tabs', 21)}<b>${n}</b></button>`;
