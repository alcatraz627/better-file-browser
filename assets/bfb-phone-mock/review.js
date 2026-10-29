// The review shell around the phone (desktop only): every place, the sheets
// this screen opens, states to put the app in, notes on the screen, and a wall
// of every frame at once.

/** Each sheet, with the place it opens on. */
const SHEET_HOME = {
  open: 'home', path: 'folder', item: 'folder', saved: 'browse', tags: 'browse', opened: 'home', folder: 'folder', file: 'file', toc: 'file', find: 'file',
  comments: 'file', thread: 'file', sendto: 'file', download: 'diagram', layout: 'diagram', dp: 'decision', qnote: 'decision',
  sections: 'directions', drow: 'directions', note: 'notes'
};
const SHEET_ARG = { item: 'f5', saved: 's1', tags: 's1', opened: 'o1', thread: 'c1', qnote: 'q2', drow: 'E1', note: 'n1' };
const sheetKey = name => SHEET_ARG[name] ? `${name}|${SHEET_ARG[name]}` : name;

/** States a reviewer can put the app in. Each is a frame on the wall too. */
const STATES = [
  { label: 'Mac asleep', place: 'home', change: s => { s.offline = true; } },
  { label: 'Nothing waiting', place: 'inbox', change: s => { s.emptyInbox = true; } },
  { label: 'Picking files', place: 'folder', change: s => { s.selecting = true; s.selected = ['f5', 'f7']; } },
  { label: 'Folder as a grid', place: 'folder', change: s => { s.views.folder = 'Grid'; } },
  { label: 'Saved, reordering', place: 'browse', change: s => { s.views.browse = 'Saved'; s.reorder = true; } },
  { label: 'Recent', place: 'browse', change: s => { s.views.browse = 'Recent'; } },
  { label: 'Comments for me', place: 'inbox', change: s => { s.views.inbox = 'Comments'; } },
  { label: 'Directions list', place: 'inbox', change: s => { s.views.inbox = 'Directions'; } },
  { label: 'Raw text', place: 'file', change: s => { s.raw = true; } },
  { label: 'Editor preview', place: 'editor', change: s => { s.views.editor = 'Preview'; } },
  { label: 'Writing a note', place: 'note', change: s => { s.views.note = 'Write'; } },
  { label: 'Text search', place: 'search', change: s => { s.views.search = 'Text'; } },
  { label: 'Answer changed', place: 'decision', change: s => { s.picks.q1 = 1; } }
];

/** Every frame the checks and the wall cover: each place, each state, each sheet. */
function frames() {
  return [
    ...PLACES.map(p => ({ label: p.label, place: p.id, change: () => {} })),
    ...STATES,
    ...Object.keys(SHEETS).map(name => ({ label: 'Sheet: ' + name, place: SHEET_HOME[name], change: s => { s.sheets = [sheetKey(name)]; } }))
  ];
}

function review() {
  const depth = id => pathTo(id).length - 1;
  document.getElementById('tree').innerHTML = PLACES.map(p =>
    `<button type="button" class="${depth(p.id) ? 'kid' + (depth(p.id) > 1 ? depth(p.id) : '') : ''}${S.place === p.id ? ' on' : ''}" data-shell="go" data-v="${p.id}">${esc(p.label)}</button>`).join('');
  document.getElementById('sheets').innerHTML = Object.keys(SHEETS).filter(n => SHEET_HOME[n] === S.place).map(n =>
    `<button type="button" data-shell="sheet" data-v="${n}">${esc(n)}</button>`).join('') || '<span>None</span>';
  document.getElementById('states').innerHTML = STATES.map((st, i) => `<button type="button" data-shell="state" data-v="${i}">${esc(st.label)}</button>`).join('');
  const p = PLACE[S.place];
  document.getElementById('inspect').innerHTML = `<h2>THIS SCREEN</h2><p><b>${esc(p.label)}</b>, ${p.kind === 'bar' ? 'one of the five places on the bottom bar' : 'opened from ' + esc(PLACE[p.parent].label)}.</p>`
    + (p.desk ? `<p>Stands in for the desktop's ${esc(p.desk)}.</p>` : '')
    + (p.views ? `<p>Views: ${p.views.map(esc).join(', ')}. Switching one keeps you in the place.</p>` : '')
    + `<p>Back goes to ${esc(PLACE[backTarget(S.place)]?.label || 'nowhere, this is Home')}.</p>`
    + `<h2>CHECKS</h2><p id="checkout">Run runChecks() in the console, or <button type="button" class="shell-btn" data-shell="check">run them here</button></p>`;
  for (const b of document.querySelectorAll('[data-shell="theme"],[data-shell="size"]')) b.classList.toggle('on', S[b.dataset.shell] === b.dataset.v);
}

function wall() {
  const el = document.getElementById('wall');
  el.innerHTML = frames().map((f, i) => `<figure><figcaption>${esc(f.label)}</figcaption><div class="phone" id="w${i}"></div></figure>`).join('');
  frames().forEach((f, i) => {
    const s = freshState(); Object.assign(s, { theme: S.theme, size: S.size, place: f.place }); f.change(s);
    const ph = document.getElementById('w' + i); dress(ph, s); ph.innerHTML = phoneHtml(s);
  });
}

document.addEventListener('click', e => {
  const t = e.target.closest('[data-shell]');
  if (!t) return;
  const v = t.dataset.v;
  ({
    theme: () => { S.theme = v; draw(); if (!document.getElementById('wall').hidden) wall(); },
    size: () => { S.size = v; draw(); if (!document.getElementById('wall').hidden) wall(); },
    go: () => ACTS.go(v),
    sheet: () => ACTS.sheet(sheetKey(v)),
    state: () => { const st = STATES[v]; S = freshState(); S.theme = document.documentElement.dataset.theme; S.place = st.place; st.change(S); draw(); },
    wall: () => { const w = document.getElementById('wall'), one = document.getElementById('one'); w.hidden = !w.hidden; one.hidden = !w.hidden; if (!w.hidden) wall(); },
    reset: () => { S = freshState(); draw(); },
    check: () => { const r = runChecks(); document.getElementById('checkout').textContent = `${r.drawn} of ${r.of} frames drawn, ${r.problems.length ? r.problems.length + ' problems (see console)' : 'no problems'}`; console.log(r); }
  })[t.dataset.shell]?.();
});

if (!SOLO) { review(); if (/[?&]wall\b/.test(location.search)) document.querySelector('[data-shell="wall"]').click(); }
