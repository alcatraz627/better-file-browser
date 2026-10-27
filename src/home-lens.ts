// The Home lens: one place to see what is going on across bfb. A card at the
// top holds what waits on the owner (decision pages waiting, and each repo
// whose directions doc has asks, with how many); below it, every Ask chat to
// continue, with the start of its last answer; then the quiet repos and pages.
// A click opens the thing itself: the chat on its file, the page, the doc. The
// lists refresh when the lens opens and every 15 seconds while it stays open.
import { notes } from './notes';
import { esc, whenText } from './utils';
import { UI_ICON } from './control-icons';
import { allChats, type AskChat } from './ask-history';
import { ago, REACH, type DpRow } from './dp-lens';
import { jsonPref } from './storage';
import { summarizeRepo, sortRepos, openPages, type RepoSummary } from './home-model';
import { emptyHtml } from './empty-state';
import { DISCLOSE } from './icons';

type Chat = { subject: string; chat: AskChat };
interface HomeData { chats: Chat[]; pages: DpRow[]; repos: RepoSummary[]; pagesFailed: boolean }

// The Decisions lens's hand-archived pages, so Home leaves them out too.
const archivedPref = jsonPref<string[]>('bfb-dp-archived-v1', [], Array.isArray);
const CHATS_SHOWN = 5;

const name = (p: string) => p.split('/').filter(Boolean).pop() || '/';
const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;
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
const pageRow = (r: DpRow) => {
  const unseen = r.state === 'waiting' && !r.seen;
  const reach = r.reach && REACH[r.reach];
  const sub = [r.state === 'waiting' ? 'waiting on you' : 'never answered', reach?.label, r.origin?.project].filter(Boolean).join(' · ');
  return `<button type="button" class="row fe-home-row${unseen ? ' unseen' : ''}" data-page="${esc(r.path)}" title="${esc(r.title ?? r.slug)}${unseen ? ' · you have not opened this one yet' : ''}">
    <span class="fe-row-ico">${UI_ICON.opinion}${unseen ? '<i class="fe-dpl-dot" aria-label="Not opened yet"></i>' : ''}</span>
    <span class="fe-home-tx"><span class="fe-home-t">${esc(r.title ?? r.slug)}</span><span class="fe-home-s">${esc(sub)}</span></span>
    <span class="fe-home-age" title="${esc(whenText(r.mtime * 1000))}">${esc(ago(r.mtime))}</span>
    ${r.items ? `<span class="badge" data-tone="${r.state === 'waiting' ? 'solid' : 'quiet'}" title="${plural(r.items, 'item')}">${r.items}</span>` : ''}
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
const group = (id: string, label: string, n: number, body: string, open: boolean) =>
  `<details class="fe-grp fe-home-grp" data-grp="${id}"${open ? ' open' : ''}><summary class="sect" data-level="group">${DISCLOSE}${esc(label)}<span class="fe-grp-n">${n}</span></summary><div class="fe-grp-body">${body}</div></details>`;

function paint(d: HomeData, allShown: boolean, folded: Set<string>): string {
  const asks = d.repos.filter(r => r.onYou);
  const waiting = d.pages.filter(p => p.state === 'waiting');
  const quiet = [...d.repos.filter(r => !r.onYou).map(repoRow), ...d.pages.filter(p => p.state !== 'waiting').map(pageRow)];
  const n = waiting.length + asks.length;
  const day = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const card = n
    ? `<section class="fe-home-card" data-tone="you"><div class="sect fe-home-card-h" data-level="group">Needs you<span class="fe-grp-n">${n}</span></div>${waiting.map(pageRow).join('')}${asks.map(repoRow).join('')}</section>`
    : `<section class="fe-home-card" data-tone="calm"><div class="sect fe-home-card-h" data-level="group">${UI_ICON.circleCheck}<span>Nothing waits on you</span></div></section>`;
  const failed = d.pagesFailed ? `<p class="fe-home-none">Decision pages could not be listed</p>` : '';
  const chats = allShown ? d.chats : d.chats.slice(0, CHATS_SHOWN);
  const chatBody = (chats.map(chatRow).join('') || `<p class="fe-home-none">No chats yet. Ask about any file to start one.</p>`)
    + (chats.length < d.chats.length ? `<button type="button" class="btn fe-home-more" data-more data-size="sm" data-variant="ghost">Show all ${d.chats.length}</button>` : '');
  return `<header class="fe-home-head">${esc(day)}</header>${card}${failed}`
    + group('chats', 'Continue', d.chats.length, chatBody, !folded.has('chats'))
    + (quiet.length ? group('quiet', 'Quiet', quiet.length, quiet.join(''), !folded.has('quiet')) : '');
}

export function initHomeLens(box: HTMLElement, go: (path: string, hash?: string) => void): void {
  let data: HomeData | null = null, timer: ReturnType<typeof setInterval> | null = null, seq = 0, allShown = false;
  const folded = new Set<string>();
  const render = () => { if (data) box.innerHTML = paint(data, allShown, folded); };
  // Only the newest read paints, so a slow one never overwrites a fresher list.
  const load = async () => {
    const mine = ++seq;
    const [pages, docs] = await Promise.all([
      notes.dpPages().then(rows => ({ rows, failed: false }), () => ({ rows: [] as DpRow[], failed: true })),
      notes.directionsDocs().catch(() => []),
    ]);
    if (mine !== seq) return;
    data = {
      chats: allChats(),
      pages: openPages(pages.rows, new Set(archivedPref.get())),
      pagesFailed: pages.failed,
      repos: sortRepos(docs.map(doc => summarizeRepo(doc))),
    };
    render();
  };
  box.addEventListener('toggle', e => {
    const g = (e.target as HTMLDetailsElement).dataset?.grp;
    if (!g) return;
    if ((e.target as HTMLDetailsElement).open) folded.delete(g); else folded.add(g);
  }, true);
  box.addEventListener('click', e => {
    const t = e.target as Element;
    if (t.closest('[data-more]')) { allShown = true; render(); return; }
    const row = t.closest<HTMLElement>('.fe-home-row');
    if (!row) return;
    if (row.dataset.chat) go(row.dataset.subject!, '#ask=' + encodeURIComponent(row.dataset.chat));
    else if (row.dataset.page) go(row.dataset.page + '/');
    else if (row.dataset.doc) go(row.dataset.doc);
  });
  // Read only while the lens is open and the tab is in front.
  document.addEventListener('bfb-lens', e => {
    const on = (e as CustomEvent).detail === 'home';
    if (timer) { clearInterval(timer); timer = null; }
    if (!on) return;
    if (!data) box.innerHTML = emptyHtml('loading', 'Loading…');
    void load();
    timer = setInterval(() => { if (!document.hidden) void load(); }, 15_000);
  });
}
