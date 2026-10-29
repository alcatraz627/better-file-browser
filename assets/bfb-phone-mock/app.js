// The running mock: one state object, one draw, and the taps that change it.
// On a phone-sized screen the review shell steps aside and the mock fills it.

function freshState() {
  return { place: 'home', history: [], views: {}, sheets: [], toast: '', theme: 'dark', size: 'md',
    selecting: false, selected: [], reorder: false, hidden: false, raw: false, offline: false, emptyInbox: false,
    picks: {}, searchChips: ['Everywhere'], tagChips: ['All'], commentChips: ['For me'], stateChips: ['needs you'], sort: 'Name' };
}

let S = freshState();
const SOLO = matchMedia('(max-width: 600px)').matches || /[?&]phone\b/.test(location.search);

/** The theme the page should show: the state's pick, which starts from the device. */
const resolvedTheme = s => s.theme;

/** Everything inside the phone for this state. */
function phoneHtml(s) {
  const screen = SCREENS[s.place](s);
  const badges = { inbox: waiting(s) || 0 };
  const foot = screen.bottom === 'bar' ? bottomBar(s.place, badges) : '';
  const tools = screen.tools ? `<div class="p-foot">${screen.tools}</div>` : '';
  const sheets = s.sheets.map((key, i) => {
    const [name, arg] = key.split("|"), sh = SHEETS[name](arg, s);
    // Only a sheet that just opened rises; a redraw under an open sheet must not replay it.
    return `<div class="scrim" data-act="close" data-arg="${i}"></div><div class="sheet${i === s.enter ? ' enter' : ''}" role="dialog" aria-label="${esc(sh.title)}"><i class="grab"></i><h2 class="sheet-title">${clamp(sh.title, true)}</h2><div class="sheet-body">${sh.body}</div></div>`;
  }).join('');
  return `<div class="p-screen" data-place="${s.place}">${screen.top}<div class="p-scroll">${screen.body}</div>${screen.fab || ''}${tools}${foot}</div>${sheets}${s.toast ? `<div class="toast" role="status">${esc(s.toast)}</div>` : ''}`;
}

/** Theme and text size go on the phone itself so the wall can show several at once. */
function dress(el, s) { el.dataset.theme = s.theme; el.dataset.size = s.size; }

function draw() {
  const el = document.getElementById('phone');
  dress(el, S);
  document.documentElement.dataset.theme = resolvedTheme(S);
  el.innerHTML = phoneHtml(S);
  tidy(el);
  if (typeof review === 'function' && !SOLO) review();
}

/** After drawing: start each place at the top, keep sheets scrolled to their start. */
function tidy(el) { el.querySelector('.p-scroll')?.scrollTo?.(0, 0); }

let toastTimer = 0;
function toast(words) {
  S.toast = words; draw();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { S.toast = ''; draw(); }, 1800);
}

/** What each tap does. Every data-act in the mock must name one of these. */
const ACTS = {
  go(id) {
    if (!PLACE[id]) return;
    if (BAR.includes(id)) S.history = []; else S.history.push(S.place);
    S.place = id; S.sheets = []; S.selecting = false; S.selected = []; S.reorder = false; draw();
  },
  back() { S.place = S.history.pop() || backTarget(S.place) || 'home'; S.sheets = []; S.selecting = false; draw(); },
  view(arg) {
    const [place, v] = arg.includes('|') ? arg.split('|') : [S.place, arg];
    S.views[place] = v;
    if (place !== S.place) return ACTS.go(place);
    draw();
  },
  sheet(key) { S.sheets.push(key); S.enter = S.sheets.length - 1; draw(); S.enter = -1; },
  close(i) { S.sheets = S.sheets.slice(0, Number(i)); draw(); },
  toast(words) { S.sheets = []; toast(words); },
  flip(key) { S[key] = !S[key]; if (key === 'selecting') S.selected = []; S.sheets = []; draw(); },
  pickrow(id) { S.selected = S.selected.includes(id) ? S.selected.filter(x => x !== id) : [...S.selected, id]; draw(); },
  chip(name) { S.searchChips = toggleIn(S.searchChips, name); draw(); },
  tag(name) { S.tagChips = name === 'All' ? ['All'] : toggleIn(S.tagChips.filter(t => t !== 'All'), name); if (!S.tagChips.length) S.tagChips = ['All']; draw(); },
  cchip(name) { S.commentChips = [name]; draw(); },
  state(name) { S.stateChips = toggleIn(S.stateChips, name); draw(); },
  sort(name) { S.sort = name; draw(); },
  pick(arg) { const [q, i] = arg.split('|'); S.picks[q] = Number(i); draw(); },
  fmt(label) { toast(label + ' added'); },
  saved() { toast('Saved to the Mac'); },
  sent() { toast('Sent. The agent has your answers.'); },
  theme() { S.theme = S.theme === 'dark' ? 'light' : 'dark'; draw(); },
  size() { S.size = { sm: 'md', md: 'lg', lg: 'sm' }[S.size]; draw(); }
};
const toggleIn = (list, x) => list.includes(x) ? list.filter(y => y !== x) : [...list, x];

document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]');
  if (!t || !t.closest('#phone')) return;
  e.preventDefault();
  ACTS[t.dataset.act]?.(t.dataset.arg);
});

// A swipe down on a sheet's grab handle closes it, as on the phone.
let y0 = -1;
document.addEventListener('touchstart', e => { y0 = e.target.closest('.grab, .sheet-title') ? e.touches[0].clientY : -1; }, { passive: true });
document.addEventListener('touchend', e => { if (y0 >= 0 && e.changedTouches[0].clientY - y0 > 60) ACTS.close(S.sheets.length - 1); y0 = -1; }, { passive: true });

if (SOLO) document.documentElement.classList.add('solo');
if (matchMedia('(prefers-color-scheme: light)').matches) S.theme = 'light';
// ?theme=light and ?place=folder open the mock in that state (for screenshots and links).
const ASK = new URLSearchParams(location.search);
if (ASK.get('theme')) S.theme = ASK.get('theme');
if (PLACE[ASK.get('place')]) S.place = ASK.get('place');
draw();
