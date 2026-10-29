// Every place, drawn from the parts in kit.js only. A screen returns its top
// bar, its body, and what sits at the bottom: the five places (`bar`), the
// place's own tools (`tools`), or nothing while writing (`none`).

const view = (s, id) => s.views[id] || (PLACE[id].views || [])[0];
const waiting = s => s.emptyInbox ? 0 : DATA.decisions.length + DATA.inboxComments.length;
const macBanner = s => s.offline ? banner('bad', 'The Mac is asleep. You are reading what it last sent.', btn('Retry', 'undo', 'toast', 'Still asleep')) : '';

const SCREENS = {
  home: s => ({
    top: topBar('home', { title: 'Good morning', actions: openPagesBtn(DATA.openPages.length) + ibtn('search', 'Search', 'go', 'search') + ibtn('settings', 'Settings', 'go', 'settings') }),
    body: macBanner(s) + stack(
      scroller(
        stat({ n: s.emptyInbox ? 0 : DATA.decisions.length, label: 'decisions', icon: 'decision', tone: 'blue', act: 'view', arg: 'inbox|Decisions', hot: !s.emptyInbox }) +
        stat({ n: s.emptyInbox ? 0 : DATA.inboxComments.length, label: 'comments', icon: 'comment', tone: 'orange', act: 'view', arg: 'inbox|Comments' }) +
        stat({ n: 23, label: 'asks on you', icon: 'route', tone: 'teal', act: 'view', arg: 'inbox|Directions' }) +
        stat({ n: DATA.notes.length, label: 'notes', icon: 'note', tone: 'green', act: 'go', arg: 'notes' })) +
      section('Continue', scroller(DATA.recent.slice(0, 4).map(r => card({ title: r.label, sub: r.when, icon: KIND_ICON[r.kind], act: 'go', arg: r.kind === 'folder' ? 'folder' : 'file' })).join(''))) +
      section('Waiting on you', s.emptyInbox ? empty('check', 'Nothing waits on you', 'Decision pages and comments for you land here.') :
        group(DATA.decisions.slice(0, 3).map(d => row({ icon: 'decision', tone: 'blue', title: d.title, sub: d.repo, count: d.open, act: 'go', arg: 'decision' })).join('')),
        btn('All', 'forward', 'go', 'inbox', 'quiet')) +
      section('Saved', group(DATA.saved.slice(0, 4).map(r => row({ icon: KIND_ICON[r.kind], title: r.label, tags: r.tags, act: 'go', arg: r.kind === 'doc' ? 'file' : 'folder' })).join('')),
        btn('All', 'forward', 'view', 'browse|Saved', 'quiet')) +
      section('Pinned notes', group(DATA.notes.filter(n => n.pinned).map(n => row({ icon: 'note', title: n.title, sub: n.body, dot: n.color, act: 'go', arg: 'note' })).join('')))),
    bottom: 'bar'
  }),

  search: s => ({
    top: topBar('search', { title: 'Search' }),
    body: stack(
      field({ kind: 'search', label: 'Search', placeholder: 'Names, or words inside files', value: 'todo' }) +
      seg([['Names', 'file'], ['Text', 'text']], view(s, 'search'), 'view', 'search') +
      chips([['Here'], ['Everywhere'], ['Notes'], ['.md'], ['.ts']], s.searchChips, 'chip') +
      section(plural(DATA.searchHits.length, 'match', 'matches') + ' in 40 files', group(DATA.searchHits.map(h => row({ icon: KIND_ICON[h.kind], title: h.name, sub: h.where, snippet: view(s, 'search') === 'Text' ? h.line : '', act: 'go', arg: 'file' })).join(''))) +
      btn('Keep this search', 'bookmark', 'toast', 'Kept in Saved')),
    bottom: 'bar'
  }),

  settings: s => ({
    top: topBar('settings'),
    body: stack(
      section('Look', group(
        row({ icon: 'sun', title: 'Theme', meta: s.theme === 'dark' ? 'Dark' : 'Light', act: 'theme' }) +
        row({ icon: 'text', title: 'Text size', meta: { sm: 'Small', md: 'Medium', lg: 'Large' }[s.size], act: 'size' }))) +
      section('On the phone', group(
        toggle('Open files to read', 'A tap on a file shows it full screen', true, 'toast', 'Always on, on the phone') +
        toggle('Show hidden files', 'Dot files and folders', s.hidden, 'flip', 'hidden') +
        row({ icon: 'mac', title: 'This Mac', sub: 'aakarshs-m5-pro, over the tailnet', meta: s.offline ? 'Asleep' : 'Awake' }))) +
      section('Shared with the Mac', group(
        row({ icon: 'bookmark', title: 'Saved, Notes and chats', sub: 'The Mac sends them each time a bfb page opens there' }) +
        row({ icon: 'phone', title: 'Copy this page\'s link', act: 'toast', arg: 'Link copied' })))),
    bottom: 'bar'
  }),

  browse: s => {
    const v = view(s, 'browse');
    const list = v === 'Places' ? section('On this Mac', group(DATA.places.map(p => row({ icon: p.icon, title: p.label, sub: p.path, act: 'go', arg: 'folder', opens: true })).join('')))
      : v === 'Saved' ? chips([['All'], ['work', 3, 'blue'], ['code', 2, 'green']], s.tagChips, 'tag') +
        group(DATA.saved.filter(r => s.tagChips.includes('All') || r.tags.some(t => s.tagChips.includes(t))).map(r => row({ icon: KIND_ICON[r.kind], title: r.label, sub: r.path, tags: r.tags, act: 'go', arg: r.kind === 'doc' ? 'file' : 'folder', more: s.reorder ? '' : 'saved|' + r.id, handle: s.reorder })).join('')) +
        btn(s.reorder ? 'Done' : 'Reorder', s.reorder ? 'check' : 'drag', 'flip', 'reorder', 'quiet')
      : group(DATA.recent.map(r => row({ icon: KIND_ICON[r.kind], title: r.label, sub: r.path, meta: r.when, act: 'go', arg: r.kind === 'folder' ? 'folder' : 'file', more: 'item|' + r.id })).join(''));
    return {
      top: topBar('browse', { actions: openPagesBtn(DATA.openPages.length) + ibtn('search', 'Search', 'go', 'search') }),
      body: macBanner(s) + stack(seg([['Places', 'home'], ['Saved', 'bookmark'], ['Recent', 'clock']], v, 'view', 'browse') + list),
      bottom: 'bar'
    };
  },

  folder: s => {
    const items = DATA.folder.items, grid = view(s, 'folder') === 'Grid';
    const rows = items.map(f => row({ icon: KIND_ICON[f.kind], tone: f.kind === 'folder' ? 'dir' : '', title: f.name, sub: f.meta + (f.comments ? ', ' + plural(f.comments, 'comment') : ''), meta: f.when,
      check: s.selecting ? s.selected.includes(f.id) : null, act: s.selecting ? 'pickrow' : 'go', arg: s.selecting ? f.id : f.kind === 'folder' ? 'folder' : 'file', more: s.selecting ? '' : 'item|' + f.id })).join('');
    return {
      top: topBar('folder', { title: DATA.folder.path.at(-1), trail: DATA.folder.path.slice(0, -1),
        actions: s.selecting ? btn('Done', 'check', 'flip', 'selecting', 'quiet') : ibtn('bookmark', 'Save this folder', 'toast', 'Saved') + ibtn('more', 'More for this folder', 'sheet', 'folder') }),
      body: macBanner(s) + stack(
        (s.selecting ? progress(s.selected.length, items.length, plural(s.selected.length, 'item') + ' picked') :
          chips([['Name'], ['Changed'], ['Size'], ['Kind']], [s.sort], 'sort') ) +
        (grid && !s.selecting ? tiles(items.map(f => card({ title: f.name, sub: f.meta, icon: KIND_ICON[f.kind], act: 'go', arg: f.kind === 'folder' ? 'folder' : 'file' })).join('')) : group(rows))),
      bottom: s.selecting ? 'tools' : 'bar',
      tools: s.selecting ? toolbar([['Copy paths', 'copy', 'toast', 'Paths copied'], ['Links', 'link', 'toast', 'Phone links copied'], ['Save', 'bookmark', 'toast', 'Saved'], ['Send', 'send', 'sheet', 'sendto']]) : ''
    };
  },

  file: s => ({
    top: topBar('file', { title: DATA.doc.name, trail: ['Code', 'better-file-browser'],
      actions: ibtn('bookmark', 'Keep', 'toast', 'Kept in Saved') + ibtn('more', 'More for this file', 'sheet', 'file') }),
    body: macBanner(s) + (s.raw ? stack(row({ icon: 'raw', title: 'Raw text', sub: DATA.doc.size + ', ' + DATA.doc.words })) + doc([['code', DATA.doc.blocks.map(b => [].concat(b[1]).join('\n')).join('\n\n')]]) : doc(DATA.doc.blocks)),
    bottom: 'tools',
    tools: toolbar([['Contents', 'toc', 'sheet', 'toc'], ['Find', 'search', 'sheet', 'find'], ['Comments', 'comment', 'sheet', 'comments', DATA.threads.filter(t => t.state === 'open').length], ['Edit', 'pencil', 'go', 'editor']])
  }),

  editor: s => ({
    top: topBar('editor', { title: DATA.doc.name, actions: btn('Save', 'check', 'saved', '', 'primary') }),
    body: stack(seg([['Write', 'pencil'], ['Preview', 'eye']], view(s, 'editor'), 'view', 'editor') +
      (view(s, 'editor') === 'Write' ? field({ kind: 'area', label: 'The file', value: DATA.doc.blocks.map(b => [].concat(b[1]).join('\n')).join('\n\n') }) : doc(DATA.doc.blocks))),
    bottom: 'none',
    tools: view(s, 'editor') === 'Write' ? keybar([['Heading', 'heading', 'fmt'], ['Bold', 'bold', 'fmt'], ['Italic', 'italic', 'fmt'], ['List', 'list', 'fmt'], ['Task', 'task', 'fmt'], ['Link', 'link', 'fmt'], ['Undo', 'undo', 'fmt']]) : ''
  }),

  diagram: s => ({
    top: topBar('diagram', { title: 'Look, keep, go', actions: ibtn('download', 'Download', 'sheet', 'download') }),
    body: diagram('Look, keep, go'),
    bottom: 'tools',
    tools: toolbar([['Layout', 'layout', 'sheet', 'layout'], ['Flow', 'flow', 'toast', 'Now flows down'], ['Fit', 'zoom', 'toast', 'Fitted'], ['Source', 'raw', 'toast', 'Showing the mermaid text']])
  }),

  inbox: s => {
    const v = view(s, 'inbox');
    const list = s.emptyInbox ? empty('check', 'Nothing waits on you', 'When an agent asks you something it lands here, and the Inbox shows a count.')
      : v === 'Decisions' ? group(DATA.decisions.map(d => row({ icon: 'decision', tone: 'blue', title: d.title, sub: d.repo, count: d.open, meta: d.when, dot: d.fresh ? 'orange' : '', wrap: true, act: 'go', arg: 'decision' })).join(''))
      : v === 'Comments' ? chips([['For me', 3], ['Due', 1], ['Done']], s.commentChips, 'cchip') + group(DATA.inboxComments.map(c => row({ icon: 'comment', tone: 'orange', title: c.text, sub: c.doc + ' in ' + c.where, meta: c.due ? 'Due today' : c.when, wrap: true, act: 'go', arg: 'file' })).join(''))
      : group(DATA.directionsDocs.map(g => row({ icon: 'route', tone: 'teal', title: g.repo, sub: plural(g.ready, 'row') + ' ready for an agent', count: g.onYou + ' on you', act: 'go', arg: 'directions' })).join(''));
    return {
      top: topBar('inbox', { actions: ibtn('search', 'Search', 'go', 'search') }),
      body: stack(seg([['Decisions', 'decision'], ['Comments', 'comment'], ['Directions', 'route']], v, 'view', 'inbox') + list),
      bottom: 'bar'
    };
  },

  decision: s => {
    const d = DATA.decision, picks = d.items.filter(q => s.picks[q.id] != null).length;
    return {
      top: topBar('decision', { title: d.title, actions: ibtn('more', 'More for this page', 'sheet', 'dp') }),
      body: stack(row({ icon: 'decision', tone: 'blue', title: d.repo, sub: 'Asked ' + d.asked + ', ' + plural(d.items.length, 'decision') }) + doc([['p', d.intro]]) +
        d.items.map((q, i) => question({ ...q, pick: s.picks[q.id] ?? q.pick }, i + 1, d.items.length)).join('')),
      bottom: 'tools',
      tools: progress(d.items.length, d.items.length, picks ? plural(picks, 'answer') + ' changed, the rest take my pick' : 'Every pick is mine; change what is wrong') + btn('Send', 'send', 'sent', '', 'primary')
    };
  },

  directions: s => {
    const d = DATA.directions, c = d.counts;
    const want = s.stateChips;
    return {
      top: topBar('directions', { title: d.repo + ' directions', actions: ibtn('toc', 'Sections', 'sheet', 'sections') }),
      body: stack(chips([['needs you', c.you, 'red'], ['waiting', c.waiting, 'orange'], ['ready', c.ready, 'green'], ['parked', c.parked, 'grey'], ['done', c.done, 'teal']], want, 'state') +
        d.sections.map(sec => section(sec.title, progress(sec.met, sec.of, sec.met + ' of ' + sec.of + ' done') +
          group(sec.rows.filter(r => !want.length || want.includes(STATE_WORDS[r.state])).map(r => row({ title: r.task, sub: r.id, pill: r.state, wrap: true, act: 'sheet', arg: 'drow|' + r.id })).join('')))).join('')),
      bottom: 'bar'
    };
  },

  notes: s => {
    const list = DATA.notes.filter(n => view(s, 'notes') === 'All' || n.pinned);
    return {
      top: topBar('notes', { actions: ibtn('search', 'Search notes', 'go', 'search') }),
      body: stack(seg([['Pinned', 'pin'], ['All', 'list']], view(s, 'notes'), 'view', 'notes') +
        group(list.map(n => row({ icon: 'note', title: n.title, sub: n.when + ', ' + n.body, dot: n.color, act: 'go', arg: 'note', more: s.reorder ? '' : 'note|' + n.id, handle: s.reorder })).join('')) +
        btn(s.reorder ? 'Done' : 'Reorder', s.reorder ? 'check' : 'drag', 'flip', 'reorder', 'quiet')),
      bottom: 'bar',
      fab: fab('New note', 'plus', 'go', 'note')
    };
  },

  note: s => ({
    top: topBar('note', { title: DATA.notes[0].title, actions: ibtn('pin', 'Unpin', 'toast', 'Unpinned') + ibtn('more', 'More for this note', 'sheet', 'note|n1') }),
    body: stack(seg([['Read', 'eye'], ['Write', 'pencil']], view(s, 'note'), 'view', 'note') +
      (view(s, 'note') === 'Write' ? field({ kind: 'area', label: 'The note', value: '## BFB Feedback\n\n- [ ] ' + DATA.notes[0].body }) : doc([['h1', 'BFB Feedback'], ['ul', [DATA.notes[0].body, 'Have a notes doc pinned where I write feedback for you']]]))),
    bottom: view(s, 'note') === 'Write' ? 'none' : 'bar',
    tools: view(s, 'note') === 'Write' ? keybar([['Heading', 'heading', 'fmt'], ['Bold', 'bold', 'fmt'], ['List', 'list', 'fmt'], ['Task', 'task', 'fmt'], ['Image', 'image', 'fmt'], ['Undo', 'undo', 'fmt']]) : ''
  }),

  ask: s => ({
    top: topBar('ask'),
    body: stack(section('Chats', group(DATA.chats.map(c => row({ icon: 'sparkle', tone: 'purple', title: c.title, sub: 'About ' + c.about, meta: c.when, act: 'go', arg: 'chat' })).join('')))),
    bottom: 'bar',
    fab: fab('New chat', 'plus', 'go', 'chat')
  }),

  chat: s => ({
    top: topBar('chat', { title: DATA.chats[0].title }),
    body: stack(row({ icon: 'code', title: 'About tabs.ts', sub: '~/Code/better-file-browser/src', act: 'go', arg: 'file' }) + DATA.chat.map(bubble).join('')),
    bottom: 'tools',
    tools: composer('Ask about tabs.ts', 'toast', 'Asked')
  }),

  showcase: s => ({
    top: topBar('showcase'),
    body: stack(
      section('Buttons', btn('Send', 'send', 'toast', 'Filled: the one verb a page exists for', 'primary') + btn('Retry', 'undo', 'toast', 'Outlined') + btn('All', 'forward', 'toast', 'Quiet', 'quiet')) +
      section('Rows', group(row({ icon: 'folder', tone: 'dir', title: 'A folder', sub: '18 items', meta: 'Today', act: 'toast', arg: 'row', more: 'item|f1' }) + row({ title: 'A Directions row', sub: 'E1', pill: 'you' }) + toggle('A setting', 'With a line under it', true, 'toast', 'switch'))) +
      section('Switches and filters', seg([['One', 'list'], ['Two', 'grid']], 'One', 'toast', 'showcase') + chips([['A chip'], ['Picked', 3, 'blue']], ['Picked'], 'toast')) +
      section('States', statePill('you') + statePill('waiting') + statePill('ready') + statePill('parked') + statePill('done') + progress(2, 6, '2 of 6 done')) +
      section('Notices', banner('bad', 'The Mac is asleep.') + empty('check', 'Nothing here', 'What would land here, and how.'))),
    bottom: 'bar'
  })
};
