// Checks every frame in both themes and three text sizes against the phone
// rules in README.md, reads the screens for markup the kit should draw, and
// crawls every tap for dead ends. Run runChecks() and crawl() in the console.

// A filled control is allowed only for the verb a place exists for.
const FILLED_VERBS = /^(Send|Save|New note|New chat)$/;
const MIN_TAP = 44;

/** Reads screens.js and sheets.js and reports any line that draws its own markup. */
let KIT_AUDIT = null;
async function kitAudit() {
  const problems = [];
  let lines = 0;
  for (const file of ['screens.js', 'sheets.js']) {
    const text = await (await fetch(file, { cache: 'no-store' })).text();
    text.split('\n').forEach((line, n) => {
      if (/^\s*(\/\/|\/?\*)/.test(line)) return;
      lines++;
      const tag = line.match(/<\/?[a-z][a-z0-9]*[\s>]/i), own = line.match(/\b(class|style)=/);
      if (tag || own) problems.push(`${file} line ${n + 1} draws its own ${tag ? tag[0].trim() : own[0]} where a part belongs`);
    });
  }
  return (KIT_AUDIT = { problems, lines });
}
kitAudit();

function runChecks() {
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:-9999px;top:0';
  document.body.appendChild(host);
  const found = [], all = frames();
  let drawn = 0;
  const lum = hex => {
    const c = hex.replace('#', '').match(/../g).map(x => parseInt(x, 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

  for (const theme of ['dark', 'light']) for (const size of ['sm', 'md', 'lg']) for (const f of all) {
    const tag = `${theme}/${size} ${f.label}`;
    const s = freshState();
    Object.assign(s, { theme, size, place: f.place });
    const el = document.createElement('div');
    el.className = 'phone';
    host.appendChild(el);
    try { f.change(s); dress(el, s); el.innerHTML = phoneHtml(s); } catch (e) { found.push(`${tag}: cannot be drawn, ${e.message}`); el.remove(); continue; }
    drawn++;
    const box = el.getBoundingClientRect(), place = PLACE[f.place];

    for (const n of el.querySelectorAll('*')) {
      if (n.closest('.hscroll, .chips, .trail, pre, svg')) continue;
      const r = n.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const over = Math.max(r.right - box.right, box.left - r.left);
      if (over > 1.5) { found.push(`${tag}: ${n.tagName.toLowerCase()}.${String(n.className).split(' ')[0]} runs ${Math.round(over)}px outside the phone`); break; }
    }
    for (const area of el.querySelectorAll('.p-scroll, .sheet-body, .p-foot')) if (area.scrollWidth > area.clientWidth + 1) found.push(`${tag}: ${area.className} scrolls sideways`);
    const sheet = el.querySelector('.sheet');
    if (sheet && sheet.getBoundingClientRect().top < box.top + 60) found.push(`${tag}: the sheet covers the whole screen`);

    for (const b of el.querySelectorAll('button')) {
      const name = (b.getAttribute('aria-label') || b.innerText).trim();
      if (!name) found.push(`${tag}: a button has no name`);
      const r = b.getBoundingClientRect();
      if (r.height && !b.closest('.md') && (r.height < MIN_TAP - .5 || r.width < MIN_TAP - .5)) found.push(`${tag}: "${name.slice(0, 30)}" is ${Math.round(r.width)} by ${Math.round(r.height)}, under ${MIN_TAP}`);
    }
    const layers = [el.querySelector('.p-screen'), ...el.querySelectorAll('.sheet')];
    for (const layer of layers) {
      const filled = [...layer.querySelectorAll('.btn.primary, .fab')].filter(b => !b.closest('.sheet') || layer.classList.contains('sheet'));
      if (place.id !== 'showcase' && filled.length > 1) found.push(`${tag}: ${filled.length} filled controls on one layer`);
      for (const b of filled) if (!FILLED_VERBS.test(b.innerText.trim())) found.push(`${tag}: "${b.innerText.trim()}" is filled, and only ${FILLED_VERBS.source} may be`);
    }
    if (place.kind === 'bar' && !el.querySelector('.p-bottom') && !s.selecting) found.push(`${tag}: a bar place without the bottom bar`);
    if (place.kind === 'page' && !el.querySelector('.back')) found.push(`${tag}: a child place without Back`);
    const on = el.querySelectorAll('.p-bottom .tab.on');
    if (el.querySelector('.p-bottom') && (on.length !== 1 || on[0].dataset.arg !== barOf(f.place))) found.push(`${tag}: the bottom bar lights the wrong place`);

    for (const a of el.querySelectorAll('[data-act]')) if (!ACTS[a.dataset.act]) found.push(`${tag}: tap "${a.dataset.act}" does nothing`);
    for (const a of el.querySelectorAll('[data-act="sheet"]')) if (!SHEETS[a.dataset.arg.split('|')[0]]) found.push(`${tag}: sheet "${a.dataset.arg}" does not exist`);
    for (const a of el.querySelectorAll('[data-act="go"]')) if (!PLACE[a.dataset.arg]) found.push(`${tag}: place "${a.dataset.arg}" does not exist`);

    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n; (n = walk.nextNode());) {
      const t = n.nodeValue.trim();
      if (/…|\.\.\./.test(t)) found.push(`${tag}: an ellipsis typed into text "${t.slice(0, 30)}"`);
      if (/—/.test(t)) found.push(`${tag}: an em dash "${t.slice(0, 30)}"`);
      if (/\b(planned|fixture|prototype|lorem|TODO)\b/.test(t)) found.push(`${tag}: placeholder wording "${t.slice(0, 40)}"`);
      if (/\b(hover|right-click|double-click)\b/i.test(t)) found.push(`${tag}: a desktop gesture named on the phone "${t.slice(0, 40)}"`);
    }
    el.remove();
  }

  if (!KIT_AUDIT) found.push('the kit audit has not finished reading the screens, run the checks again');
  else found.push(...KIT_AUDIT.problems);
  for (const p of PLACES) {
    if (!SCREENS[p.id]) found.push(`no screen for ${p.id}`);
    let at = p.id, hops = 0;
    while (at && at !== 'home' && hops++ < 6) at = backTarget(at);
    if (at !== 'home') found.push(`Back from ${p.id} never reaches Home`);
  }
  for (const name of Object.keys(SHEETS)) if (!SHEET_HOME[name]) found.push(`sheet ${name} has no place on the wall`);

  const probe = document.createElement('div');
  probe.className = 'phone';
  document.body.appendChild(probe);
  for (const theme of ['dark', 'light']) {
    probe.dataset.theme = theme;
    const t = name => getComputedStyle(probe).getPropertyValue('--' + name).trim();
    for (const fg of ['tx', 'mt', 'dm', 'ac', 'red', 'orange', 'green', 'blue']) for (const bg of ['bg', 's1', 's2']) {
      const r = ratio(t(fg), t(bg));
      if (r < 4.5) found.push(`contrast, ${theme}: ${fg} on ${bg} is ${r.toFixed(2)} to 1`);
    }
    const r = ratio(t('tx-on-ac'), t('ac'));
    if (r < 4.5) found.push(`contrast, ${theme}: text on the accent is ${r.toFixed(2)} to 1`);
  }
  probe.remove();
  host.remove();

  const grouped = {};
  for (const f of found) {
    const m = f.match(/^(dark|light)\/(sm|md|lg) (.*?): (.*)$/);
    const key = m ? m[4] : f;
    const g = grouped[key] = grouped[key] || { on: new Set(), where: new Set() };
    if (m) { g.on.add(m[3]); g.where.add(`${m[1]}/${m[2]}`); }
  }
  return { frames: all.length, drawn, of: all.length * 6,
    problems: Object.entries(grouped).map(([k, g]) => g.on.size ? `${k} | ${g.on.size} frames, first: ${[...g.on][0]} | ${[...g.where].join(' ')}` : k) };
}

/**
 * Walks every tap from Home, breadth first, and reports taps that throw, taps
 * that change nothing and say nothing, and screens with no way out.
 */
function crawl(limit = 400) {
  const realDraw = draw, realToast = toast, saved = S;
  let said = '';
  draw = () => {}; toast = w => { said = w; };
  const key = s => JSON.stringify([s.place, s.sheets, s.views, s.selecting, s.reorder, s.raw, s.hidden]);
  const seen = new Set(), queue = [freshState()], problems = [];
  const host = document.createElement('div');
  host.className = 'phone';
  host.style.cssText = 'position:absolute;left:-9999px;top:0';
  document.body.appendChild(host);
  while (queue.length && seen.size < limit) {
    const st = queue.shift(), k = key(st);
    if (seen.has(k)) continue;
    seen.add(k);
    host.innerHTML = phoneHtml(st);
    // A tap on the tab, view or filter already showing is meant to do nothing, so skip those.
    const taps = [...host.querySelectorAll('[data-act]')].filter(a => !a.matches('[aria-selected="true"], [aria-pressed="true"], [aria-checked="true"], .tab.on')).map(a => [a.dataset.act, a.dataset.arg, (a.getAttribute('aria-label') || a.innerText).trim().slice(0, 30)]);
    if (!taps.some(([a]) => a === 'back' || a === 'close' || a === 'go')) problems.push(`no way out of ${k}`);
    for (const [act, arg, name] of taps) {
      S = structuredClone(st); said = '';
      try { ACTS[act](arg); } catch (e) { problems.push(`"${name}" on ${st.place} throws: ${e.message}`); continue; }
      if (key(S) === k && !said && JSON.stringify(S) === JSON.stringify(st)) problems.push(`"${name}" on ${st.place} changes nothing and says nothing`);
      S.toast = '';
      queue.push(S);
    }
  }
  host.remove();
  draw = realDraw; toast = realToast; S = saved; draw();
  return { states: seen.size, problems: [...new Set(problems)] };
}
