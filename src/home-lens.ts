// Home: one place to see what is going on across bfb, as a full page (the
// default, at ~/#home) and as a sidebar lens. Both show what waits on the
// owner, Ask chats to continue, and each repo's directions; a click opens the
// thing itself. The page adds a path bar, usage numbers and quick links that
// can be edited, forgotten, or opened elsewhere. Lists refresh when shown and
// every 15 seconds while in view.
import { notes, type NoteMeta } from './notes';
import { esc, whenText, fileHref, pageHref } from './utils';
import { UI_ICON, LINE_ICON, line } from './control-icons';
import { allChats, type AskChat } from './ask-history';
import { ago, REACH, type DpRow } from './dp-lens';
import { jsonPref, getSaved, saveSaved, getRecents, forgetRecent, keptNotesList, homeDir } from './storage';
import { renamePlace, setTags, parseTags, removePlace } from './places';
import { summarizeRepo, sortRepos, openPages, homeStats, splitByAge, type RepoSummary, type HomeStat } from './home-model';
import { runCommand } from './commands';
import { emptyHtml } from './empty-state';
import { DISCLOSE, PI, icoFile } from './icons';
import { absPath, resolvePath, readable, suggestPaths } from './goto';
import { openLayer, type Layer } from './layer';
import { go as navigate } from './nav';
import type { App } from './app';

type Chat = { subject: string; chat: AskChat };
interface QuickLink { path: string; label: string; kind: 'saved' | 'note' | 'recent'; tags?: string[]; rel?: string }
interface HomeData { chats: Chat[]; pages: DpRow[]; repos: RepoSummary[]; pagesFailed: boolean; stats: HomeStat[]; saved: QuickLink[]; notes: QuickLink[]; recent: QuickLink[] }
type Go = (path: string, hash?: string) => void;

// The Decisions lens's hand-archived pages, so Home leaves them out too.
const archivedPref = jsonPref<string[]>('bfb-dp-archived-v1', [], Array.isArray);
// The page's cards the owner folded shut, by card id.
const foldedPref = jsonPref<string[]>('bfb-home-folded-v1', [], Array.isArray);
const SIDE_CHATS = 5, PAGE_CHATS = 8, LINKS = 8;
/** Waiting pages older than this many days are counted, not listed. */
const FRESH_DAYS = 14;

const name = (p: string) => p.split('/').filter(Boolean).pop() || '/';
const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const today = (month: 'short' | 'long' = 'short') => new Date().toLocaleDateString('en-US', { weekday: 'long', month, day: 'numeric' });
const greeting = () => { const h = new Date().getHours(); return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };
/** The start of a chat's last real answer, as plain text. */
const lastAnswer = (c: AskChat) => {
  const t = [...c.turns].reverse().find(x => x.a && !x.error);
  return (t?.a ?? '').replace(/<think>[\s\S]*?<\/think>/g, '').replace(/[#*`>_[\]]/g, '').replace(/\s+/g, ' ').trim().slice(0, 200);
};

const chatRow = (c: Chat) => {
  const ans = lastAnswer(c.chat);
  return `<button type="button" class="row fe-home-row${ans ? ' has-p' : ''}" data-chat="${esc(c.chat.id)}" data-subject="${esc(c.subject)}" title="${esc(c.chat.title)} · ${esc(c.subject)}">
    <span class="fe-row-ico">${UI_ICON.ai}</span>
    <span class="fe-home-tx"><span class="fe-home-t">${esc(c.chat.title)}</span><span class="fe-home-s">${esc(name(c.subject))} · ${plural(c.chat.turns.length, 'turn')}</span>${ans ? `<span class="fe-home-p">${esc(ans)}</span>` : ''}</span>
    <span class="fe-home-age" title="${esc(whenText(c.chat.at))}">${esc(ago(c.chat.at / 1000))}</span>
  </button>`;
};
// `inWaiting`: the row sits in a list that already says these wait on you, so it does not say it again.
const pageRow = (r: DpRow, inWaiting = false) => {
  const unseen = r.state === 'waiting' && !r.seen;
  const reach = r.reach && REACH[r.reach];
  const sub = [inWaiting ? '' : r.state === 'waiting' ? 'waiting on you' : 'never answered', r.origin?.project, reach?.label].filter(Boolean).join(' · ');
  return `<button type="button" class="row fe-home-row${unseen ? ' unseen' : ''}" data-page="${esc(r.path)}" title="${esc(r.title ?? r.slug)}${unseen ? ' · you have not opened this one yet' : ''}">
    <span class="fe-row-ico">${UI_ICON.opinion}${unseen ? '<i class="fe-dpl-dot" aria-label="Not opened yet"></i>' : ''}</span>
    <span class="fe-home-tx"><span class="fe-home-t">${esc(r.title ?? r.slug)}</span>${sub ? `<span class="fe-home-s">${esc(sub)}</span>` : ''}</span>
    ${r.items ? `<span class="badge" data-tone="quiet" title="${plural(r.items, 'question')}">${r.items}</span>` : ''}
    <span class="fe-home-age" title="${esc(whenText(r.mtime * 1000))}">${esc(ago(r.mtime))}</span>
  </button>`;
};
const repoRow = (r: RepoSummary) => {
  const sub = [r.ready ? `${r.ready} ready for an agent` : '', r.staleDays ? `updated ${r.staleDays} d ago` : ''].filter(Boolean).join(' · ') || 'nothing waiting';
  return `<button type="button" class="row fe-home-row" data-doc="${esc(r.path)}" title="Open ${esc(r.repo)}'s directions">
    <span class="fe-row-ico">${UI_ICON.contents}</span>
    <span class="fe-home-tx"><span class="fe-home-t">${esc(r.repo)}</span><span class="fe-home-s">${esc(sub)}</span></span>
    ${r.onYou ? `<span class="fe-home-you" title="${plural(r.onYou, 'item')} in this doc wait on you">${r.onYou} on you</span>` : ''}
  </button>`;
};
const none = (text: string) => `<p class="fe-home-none">${esc(text)}</p>`;
const moreBtn = (shown: number, all: number) =>
  shown < all ? `<button type="button" class="btn fe-home-more" data-more data-size="sm" data-variant="ghost">Show all ${all}</button>` : '';
const group = (id: string, label: string, n: number, body: string, open: boolean) =>
  `<details class="fe-grp fe-home-grp" data-grp="${id}"${open ? ' open' : ''}><summary class="sect" data-level="group">${DISCLOSE}${esc(label)}<span class="fe-grp-n">${n}</span></summary><div class="fe-grp-body">${body}</div></details>`;

// The sidebar: one card for what needs the owner, then folding groups.
function paintSide(d: HomeData, allShown: boolean, folded: Set<string>): string {
  const asks = d.repos.filter(r => r.onYou);
  const waiting = d.pages.filter(p => p.state === 'waiting');
  const quiet = [...d.repos.filter(r => !r.onYou).map(repoRow), ...d.pages.filter(p => p.state !== 'waiting').map(r => pageRow(r))];
  const n = waiting.length + asks.length;
  const card = n
    ? `<section class="fe-home-card" data-tone="you"><div class="sect fe-home-card-h" data-level="group">Needs you<span class="fe-grp-n">${n}</span></div>${waiting.map(r => pageRow(r)).join('')}${asks.map(repoRow).join('')}</section>`
    : `<section class="fe-home-card" data-tone="calm"><div class="sect fe-home-card-h" data-level="group">${UI_ICON.circleCheck}<span>Nothing waits on you</span></div></section>`;
  const failed = d.pagesFailed ? none('Decision pages could not be listed') : '';
  const chats = allShown ? d.chats : d.chats.slice(0, SIDE_CHATS);
  const chatBody = (chats.map(chatRow).join('') || none('No chats yet. Ask about any file to start one.')) + moreBtn(chats.length, d.chats.length);
  return `<header class="fe-home-head">${esc(today())}</header>${card}${failed}`
    + group('chats', 'Continue', d.chats.length, chatBody, !folded.has('chats'))
    + (quiet.length ? group('quiet', 'Quiet', quiet.length, quiet.join(''), !folded.has('quiet')) : '');
}

// Each number on the page gets its own icon and colour, and says where a click takes you.
const STAT_LOOK: Record<HomeStat['id'], { icon: string; tone: string; to: string }> = {
  waiting: { icon: UI_ICON.opinion, tone: 'var(--nc-blue)', to: 'Show the decisions waiting' },
  asks: { icon: UI_ICON.contents, tone: 'var(--nc-teal)', to: 'Show the directions with asks on you' },
  asked: { icon: UI_ICON.ai, tone: 'var(--nc-purple)', to: 'Show the chats to continue' },
  opened: { icon: UI_ICON.clock, tone: 'var(--nc-orange)', to: 'Open History in the sidebar' },
  saved: { icon: line(LINE_ICON.bm, 14), tone: 'var(--nc-pink)', to: 'Open Saved in the sidebar' },
  notes: { icon: UI_ICON.notes, tone: 'var(--nc-green)', to: 'Open Notes in the sidebar' },
};
const tile = (icon: string, tone: string) => `<span class="fe-dlg-tile" style="--tone:${tone}" aria-hidden="true">${icon}</span>`;
const DAY = (i: number) => i === 6 ? 'today' : i === 5 ? 'yesterday' : `${6 - i} days ago`;
/** Seven small bars, today last; each says its day and count on hover. */
const bars = (series: number[]) => {
  const top = Math.max(1, ...series);
  return `<span class="fe-hp-bars" aria-hidden="true">${series.map((v, i) =>
    `<i style="--h:${Math.max(12, Math.round(v / top * 100))}%"${v ? '' : ' class="nil"'} title="${DAY(i)}: ${v}"></i>`).join('')}</span>`;
};
const statCell = (s: HomeStat) =>
  `<button type="button" class="fe-hp-stat${s.hot ? ' hot' : ''}" data-stat="${s.id}" title="${esc(STAT_LOOK[s.id].to)}">${tile(STAT_LOOK[s.id].icon, STAT_LOOK[s.id].tone)}<span class="fe-hp-stat-tx"><span class="fe-hp-stat-top"><b>${esc(s.value)}</b>${s.series ? bars(s.series) : ''}</span><span class="fe-hp-stat-l">${esc(s.label)}</span><span class="fe-hp-stat-s">${esc(s.sub)}</span></span></button>`;

// The head's actions: things that start work from nowhere, each named with its key.
const ACTIONS: [string, string, string][] = [
  ['note', UI_ICON.add, 'New note (n)'],
  ['ask', UI_ICON.ai, 'Ask about a file or folder'],
  ['pick', UI_ICON.folderOpen, 'Open a file or folder from Finder (o)'],
  ['palette', line(LINE_ICON.apps, 16), 'Command palette (⌘K)'],
  ['keys', UI_ICON.keyboard, 'Keyboard map (?)'],
  ['settings', line(LINE_ICON.gear, 16), 'Settings (,)'],
];
const actionBtn = ([act, icon, title]: [string, string, string]) =>
  `<button type="button" class="btn" data-icon data-variant="ghost" data-hp-act="${act}" title="${esc(title)}" aria-label="${esc(title)}">${icon}</button>`;

const linkCard = (l: QuickLink) => {
  const dir = l.path.endsWith('/');
  const ext = l.label.includes('.') ? l.label.split('.').pop()!.toLowerCase() : '';
  const ico = l.kind === 'note' ? UI_ICON.notes : dir ? PI.folder : icoFile(ext);
  const tags = l.tags?.length ? `<span class="fe-hp-link-tags">${l.tags.map(t => `<i>${esc(t)}</i>`).join('')}</span>` : '';
  const end = l.kind === 'recent'
    ? `<button type="button" class="btn fe-hp-link-act" data-icon data-size="xs" data-variant="ghost" data-forget="${esc(l.path)}" title="Forget ${esc(l.label)}" aria-label="Forget ${esc(l.label)}">${UI_ICON.close}</button>`
    : `<button type="button" class="btn fe-hp-link-act" data-icon data-size="xs" data-variant="ghost" data-menu="${esc(l.path)}" data-kind="${l.kind}" title="Open, edit or show in the sidebar" aria-label="More for ${esc(l.label)}">${UI_ICON.more}</button>`;
  return `<div class="fe-hp-link" data-kind="${l.kind}"><a class="fe-hp-link-a" href="${esc(pageHref(fileHref(l.path)))}" data-link="${esc(l.path)}" title="${esc(l.path)}">${ico}<span class="fe-hp-link-tx"><span class="fe-hp-link-l">${esc(l.label)}</span>${tags}</span></a>${end}</div>`;
};

/** One card on the page: an icon, a title, a line saying what it holds, a count, and a body that folds away. */
const card = (id: string, o: { icon: string; tone: string; title: string; sub: string; n?: number }, body: string, folded: Set<string>) =>
  `<details class="fe-hp-card" data-card="${id}"${folded.has(id) ? '' : ' open'}>
    <summary class="fe-hp-card-h">${tile(o.icon, o.tone)}<span class="fe-hp-card-tx"><b>${esc(o.title)}</b><span>${esc(o.sub)}</span></span>${o.n != null ? `<span class="fe-grp-n">${o.n}</span>` : ''}${DISCLOSE}</summary>
    <div class="fe-hp-card-b">${body}</div>
  </details>`;

// The full page (docs/plan/home-rail.md): a head with the day, actions and the
// path bar; a row of numbers that each go somewhere; then a main column (what
// waits, what to continue) beside a rail of quick links.
function paintPage(d: HomeData, allShown: boolean, folded: Set<string>): string {
  const { recent: fresh, older } = splitByAge(d.pages.filter(p => p.state === 'waiting'), FRESH_DAYS);
  const chats = allShown ? d.chats : d.chats.slice(0, PAGE_CHATS);
  const olderLine = older.length
    ? `<button type="button" class="btn fe-home-more" data-hp-lens="decisions" data-size="sm" data-variant="ghost" title="Pages waiting more than ${FRESH_DAYS} days, in the Decisions lens">${plural(older.length, 'older page')} in Decisions</button>` : '';
  const decide = d.pagesFailed ? none('Decision pages could not be listed')
    : (fresh.map(r => pageRow(r, true)).join('') || `<p class="fe-home-none fe-hp-calm">${UI_ICON.circleCheck}<span>Nothing waits on you</span></p>`) + olderLine;
  const links = (id: string, o: { icon: string; tone: string; title: string; sub: string }, list: QuickLink[], empty: string) =>
    card(id, { ...o, n: list.length }, list.length ? `<div class="fe-hp-links">${list.map(linkCard).join('')}</div>` : none(empty), folded);
  return `<div class="fe-hp">
    <header class="fe-hp-head">
      <div class="fe-hp-hello"><h1>${esc(greeting())}</h1><span class="fe-hp-date">${esc(today('long'))}</span></div>
      <div class="fe-hp-acts" role="toolbar" aria-label="Start something">${ACTIONS.map(actionBtn).join('')}</div>
      <form class="fe-hp-go" role="search" autocomplete="off">
        <span class="fe-hp-go-ico">${line(LINE_ICON.search, 16)}</span>
        <input type="text" class="fe-hp-go-in" list="fe-hp-go-list" spellcheck="false" placeholder="Open a path, such as ~/Code or /tmp  (l)" aria-label="Open a path" title="Type a path; folders and files are suggested as you type">
        <datalist id="fe-hp-go-list"></datalist>
        <button type="submit" class="btn" data-icon data-variant="ghost" title="Open this path here (↵)" aria-label="Open this path here">${UI_ICON.next}</button>
        <button type="button" class="btn fe-hp-go-link" data-icon data-variant="ghost" title="Open what is typed as a web link, in a new Chrome tab" aria-label="Open as a web link">${UI_ICON.link}</button>
        <button type="button" class="btn" data-icon data-variant="ghost" data-hp-act="pick" title="Choose a file or folder in Finder (o)" aria-label="Choose in Finder">${UI_ICON.folderOpen}</button>
      </form>
      <p class="fe-hp-go-msg" role="status" hidden></p>
    </header>
    <div class="fe-hp-stats">${d.stats.map(statCell).join('')}</div>
    <div class="fe-hp-body">
      <div class="fe-hp-main">
        <div class="fe-hp-pair">
          ${card('decide', { icon: UI_ICON.opinion, tone: 'var(--nc-blue)', title: 'Decisions', sub: `Waiting on your answer, last ${FRESH_DAYS} days`, n: fresh.length }, decide, folded)}
          ${card('repos', { icon: UI_ICON.contents, tone: 'var(--nc-teal)', title: 'Directions', sub: 'Each repo’s plan, asks on you first', n: d.repos.length }, d.repos.map(repoRow).join('') || none('No directions docs found under ~/Code'), folded)}
        </div>
        ${card('chats', { icon: UI_ICON.ai, tone: 'var(--nc-purple)', title: 'Continue', sub: 'Ask chats, newest first', n: d.chats.length }, (chats.map(chatRow).join('') || none('No chats yet. Ask about any file to start one.')) + moreBtn(chats.length, d.chats.length), folded)}
      </div>
      <aside class="fe-hp-rail">
        ${links('saved', { icon: line(LINE_ICON.bm, 14), tone: 'var(--nc-pink)', title: 'Saved', sub: 'Places you keep' }, d.saved, 'Save a place with the star to see it here')}
        ${links('notes', { icon: UI_ICON.notes, tone: 'var(--nc-orange)', title: 'Notes', sub: 'Latest first' }, d.notes, 'Notes you write show up here')}
        ${links('recent', { icon: UI_ICON.clock, tone: 'var(--nc-green)', title: 'Opened lately', sub: '× forgets one' }, d.recent, 'Places you open show up here')}
      </aside>
    </div>
  </div>`;
}

/** Fill `box` with Home and keep it current. The sidebar lens refreshes while
 *  its lens is open; the page refreshes while its tab is in front. */
function mountHome(box: HTMLElement, go: Go, layout: 'side' | 'page', app?: App): void {
  let data: HomeData | null = null, timer: ReturnType<typeof setInterval> | null = null, seq = 0, allShown = false;
  const folded = new Set<string>(layout === 'page' ? foldedPref.get() : []);
  const notesRoot = () => app?.settings.notesRoot?.replace(/\/+$/, '') ?? '';
  const noteLinks = (list: NoteMeta[]): QuickLink[] => [...list].sort((a, b) => b.mtime - a.mtime).slice(0, LINKS)
    .map(n => ({ path: `${notesRoot()}/${n.rel}`, rel: n.rel, label: n.title || name(n.rel).replace(/\.md$/, ''), kind: 'note', tags: n.tags }));
  const quick = (): Pick<HomeData, 'saved' | 'recent'> => {
    const saved = getSaved(), savedPaths = new Set(saved.map(p => p.path));
    return {
      saved: saved.slice(0, LINKS).map(p => ({ path: p.path, label: p.label || name(p.path), kind: 'saved', tags: p.tags })),
      recent: getRecents().filter(r => !savedPaths.has(r.path)).slice(0, LINKS).map(r => ({ path: r.path, label: name(r.path), kind: 'recent' })),
    };
  };
  // A redraw keeps what is typed in the path bar and where the focus was.
  const render = () => {
    if (!data) return;
    const input = box.querySelector<HTMLInputElement>('.fe-hp-go-in');
    const typed = input?.value ?? '', had = !!input && document.activeElement === input;
    box.innerHTML = layout === 'page' ? paintPage(data, allShown, folded) : paintSide(data, allShown, folded);
    if (layout === 'page') wireGo(typed, had);
  };
  // Only the newest read paints, so a slow one never overwrites a fresher list.
  const load = async () => {
    const mine = ++seq;
    const root = notesRoot();
    const [pages, docs, noteList] = await Promise.all([
      notes.dpPages().then(rows => ({ rows, failed: false }), () => ({ rows: [] as DpRow[], failed: true })),
      notes.directionsDocs().catch(() => []),
      layout === 'page' && root ? notes.list(root).catch(() => keptNotesList<NoteMeta>(root) ?? []) : Promise.resolve([] as NoteMeta[]),
    ]);
    if (mine !== seq) return;
    const chats = allChats();
    const open = openPages(pages.rows, new Set(archivedPref.get()));
    const repos = sortRepos(docs.map(doc => summarizeRepo(doc)));
    data = {
      chats, pages: open, pagesFailed: pages.failed, repos,
      stats: homeStats({
        waiting: splitByAge(open.filter(p => p.state === 'waiting'), FRESH_DAYS).recent.length,
        asks: repos.reduce((s, r) => s + r.onYou, 0), askRepos: repos.filter(r => r.onYou).length,
        chats, recents: getRecents(), saved: getSaved(), notes: noteList,
      }),
      notes: noteLinks(noteList),
      ...quick(),
    };
    render();
  };
  const start = () => {
    if (timer) clearInterval(timer);
    if (!data) box.innerHTML = emptyHtml('loading', 'Loading…');
    void load();
    timer = setInterval(() => { if (!document.hidden && !box.contains(document.activeElement)) void load(); }, 15_000);
  };

  // The path bar: Enter opens a path here, or a web address in a new Chrome tab.
  function wireGo(typed: string, focus: boolean): void {
    const form = box.querySelector<HTMLFormElement>('.fe-hp-go');
    if (!form) return;
    const input = form.querySelector<HTMLInputElement>('input')!;
    const msg = box.querySelector<HTMLElement>('.fe-hp-go-msg')!;
    const say = (text: string) => { msg.hidden = !text; msg.textContent = text; };
    const home = () => homeDir(location.pathname ? decodeURIComponent(location.pathname) : '');
    input.value = typed;
    if (focus) input.focus();
    suggestPaths(input, form.querySelector('datalist')!, home);
    input.addEventListener('input', () => say(''));
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const text = input.value.trim();
      if (/^https?:\/\//i.test(text)) { navigate(text, 'chrome-tab'); return; }
      const path = absPath(text, home());
      if (!path) { say('Type a full path, such as ~/Code or /Users/you/notes.md'); return; }
      const found = await resolvePath(path);
      if (!found) { say(`Nothing at ${path}`); return; }
      if (!await readable(found)) { say(`The browser could not open ${found}. It may not have permission to read that folder.`); return; }
      go(found);
    });
    form.querySelector('.fe-hp-go-link')!.addEventListener('click', () => {
      const text = input.value.trim();
      if (!text) { say('Type or paste a web address first'); input.focus(); return; }
      navigate(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : 'https://' + text, 'chrome-tab');
    });
  }

  // A quick link's menu: open it elsewhere, edit it, or let it go.
  const menu = document.createElement('div');
  menu.className = 'fe-ctx fe-hp-menu';
  let layer: Layer | null = null;
  function openMenu(btn: HTMLElement): void {
    const kind = btn.dataset.kind as QuickLink['kind'];
    const item = (act: string, icon: string, text: string) => `<div class="row fe-ctx-item" data-act="${act}">${icon}<span>${text}</span></div>`;
    menu.innerHTML = [
      item('open', UI_ICON.files, 'Open'),
      item('chrome', UI_ICON.external, 'Open in a new Chrome tab'),
      item('side', UI_ICON.preview, 'Show in the sidebar'),
      '<div class="fe-ctx-sep"></div>',
      kind === 'saved' ? item('edit', UI_ICON.tag, 'Name and tags…') : item('props', UI_ICON.palette, 'Colour, pin and tags…'),
      kind === 'saved' ? item('unsave', UI_ICON.trash, 'Remove from Saved') : '',
    ].join('');
    menu.dataset.path = btn.dataset.menu;
    menu.dataset.kind = kind;
    layer = openLayer(menu, { kind: 'popover', anchor: btn, align: 'end', role: 'menu', group: 'menu' });
  }
  menu.addEventListener('click', e => {
    const act = (e.target as HTMLElement).closest<HTMLElement>('.fe-ctx-item')?.dataset.act;
    const path = menu.dataset.path!, kind = menu.dataset.kind;
    const anchor = box.querySelector<HTMLElement>(`[data-menu="${CSS.escape(path)}"]`);
    layer?.close('pick');
    if (!act) return;
    if (act === 'open') go(path);
    else if (act === 'chrome') navigate(pageHref(fileHref(path)), 'chrome-tab');
    else if (act === 'side') showInSidebar(kind === 'note' ? 'notes' : 'saved', path);
    else if (act === 'edit' && anchor) editSaved(path, anchor);
    else if (act === 'props' && anchor) app?.editNoteProps?.(path.slice(notesRoot().length + 1), anchor);
    else if (act === 'unsave') {
      const before = getSaved();
      saveSaved(removePlace(before, path));
      app?.refreshSaved();
      refreshQuick();
      app?.toast('Removed from Saved', 6000, { label: 'undo', run: () => { saveSaved(before); app?.refreshSaved(); refreshQuick(); } });
    }
  });
  function showInSidebar(lens: 'saved' | 'notes', path: string): void {
    app?.showLens?.(lens);
    requestAnimationFrame(() => {
      const row = lens === 'notes'
        ? document.querySelector<HTMLElement>(`#fe-side .fe-nt-item[data-rel="${CSS.escape(path.slice(notesRoot().length + 1))}"]`)
        : document.querySelector<HTMLElement>(`#fe-side .fe-pl-item[data-path="${CSS.escape(path)}"]`);
      row?.scrollIntoView({ block: 'nearest' });
      row?.classList.add('fe-area-flash');
      row?.focus();
      setTimeout(() => row?.classList.remove('fe-area-flash'), 1200);
    });
  }
  // A small form beside the link: its name and its tags, saved on Enter.
  function editSaved(path: string, anchor: HTMLElement): void {
    const place = getSaved().find(p => p.path === path);
    if (!place) return;
    const form = document.createElement('form');
    form.className = 'fe-hp-edit panel';
    form.innerHTML = `<label><span>Name</span><input class="tb" data-size="md" name="label" spellcheck="false" title="Name shown for this place"></label>
      <label><span>Tags</span><input class="tb" data-size="md" name="tags" spellcheck="false" placeholder="work, docs" title="Tags, separated by commas"></label>
      <div class="fe-hp-edit-acts"><button type="button" class="btn" data-size="sm" data-variant="ghost" data-cancel title="Close without saving">Cancel</button><button type="submit" class="btn" data-size="sm" data-tone="accent" title="Save the name and tags">Save</button></div>`;
    const label = form.querySelector<HTMLInputElement>('[name="label"]')!, tags = form.querySelector<HTMLInputElement>('[name="tags"]')!;
    label.value = place.label || name(path);
    tags.value = (place.tags ?? []).join(', ');
    const l = openLayer(form, { kind: 'popover', anchor, align: 'end', role: 'dialog', label: 'Name and tags', focus: label, group: 'menu' });
    form.querySelector('[data-cancel]')!.addEventListener('click', () => l.close('api'));
    form.addEventListener('submit', e => {
      e.preventDefault();
      let list = getSaved();
      if (label.value.trim()) list = renamePlace(list, path, label.value.trim());
      saveSaved(setTags(list, path, parseTags(tags.value)));
      l.close('pick');
      app?.refreshSaved();
      refreshQuick();
      app?.toast('Saved the name and tags');
    });
  }
  const refreshQuick = () => { if (data) { data = { ...data, ...quick() }; render(); } };

  box.addEventListener('toggle', e => {
    const t = e.target as HTMLDetailsElement;
    const id = t.dataset?.grp ?? t.dataset?.card;
    if (!id) return;
    if (t.open) folded.delete(id); else folded.add(id);
    if (t.dataset.card) foldedPref.set([...folded]);
  }, true);
  box.addEventListener('click', e => {
    const t = e.target as Element;
    // Only parts of Home answer: the sidebar around the lens has data- attributes of its own.
    const hit = <T extends HTMLElement>(sel: string) => { const m = t.closest<T>(sel); return m && box.contains(m) ? m : null; };
    if (hit('[data-more]')) { allShown = true; render(); return; }
    const act = hit('[data-hp-act]')?.dataset.hpAct;
    if (act) {
      if (act === 'note') { if (app?.settings.notesRoot) app.newNote(); else app?.openSettings('notes'); }
      else if (act === 'ask') app?.showLens?.('ask');
      else if (act === 'pick') document.getElementById('fe-open-pick')?.click();
      else if (act === 'palette') runCommand('palette');
      else if (act === 'keys') app?.openHelp('keys');
      else if (act === 'settings') app?.openSettings();
      return;
    }
    // A number goes to what it counts: a card on this page, or a lens in the sidebar.
    const stat = hit('[data-stat]')?.dataset.stat;
    if (stat) {
      const card = ({ waiting: 'decide', asks: 'repos', asked: 'chats' } as Record<string, string>)[stat];
      const lens = ({ opened: 'history', saved: 'saved', notes: 'notes' } as Record<string, string>)[stat];
      const c = card && box.querySelector<HTMLDetailsElement>(`[data-card="${card}"]`);
      if (c) { c.open = true; c.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      else if (lens) app?.showLens?.(lens);
      return;
    }
    const jump = hit('[data-jump]');
    if (jump) {
      const c = box.querySelector<HTMLDetailsElement>(`[data-card="${jump.dataset.jump}"]`);
      if (c) { c.open = true; c.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      return;
    }
    const lens = hit('[data-hp-lens]');
    if (lens) { app?.showLens?.(lens.dataset.hpLens!); return; }
    const forget = hit('[data-forget]');
    if (forget) { forgetRecent(forget.dataset.forget!); refreshQuick(); return; }
    const more = hit('[data-menu]');
    if (more) { openMenu(more); return; }
    const link = hit<HTMLAnchorElement>('[data-link]');
    if (link) {
      if ((e as MouseEvent).metaKey || (e as MouseEvent).ctrlKey || (e as MouseEvent).shiftKey) return;   // Chrome's own new-tab gestures keep the anchor
      e.preventDefault();
      go(link.dataset.link!);
      return;
    }
    const row = hit('.fe-home-row');
    if (!row) return;
    if (row.dataset.chat) go(row.dataset.subject!, '#ask=' + encodeURIComponent(row.dataset.chat));
    else if (row.dataset.page) go(row.dataset.page + '/');
    else if (row.dataset.doc) go(row.dataset.doc);
  });
  if (layout === 'page') { start(); return; }
  document.addEventListener('bfb-lens', e => {
    if ((e as CustomEvent).detail === 'home') { start(); return; }
    if (timer) { clearInterval(timer); timer = null; }
  });
}

export const initHomeLens = (box: HTMLElement, go: Go) => mountHome(box, go, 'side');
export const initHomePage = (box: HTMLElement, go: Go, app: App) => mountHome(box, go, 'page', app);
