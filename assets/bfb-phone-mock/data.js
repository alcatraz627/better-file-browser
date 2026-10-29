// Sample data shaped like the owner's own bfb: the folders, Saved rows, notes,
// decision pages and Directions docs that the desktop Home showed on 2026-10-29.

const DATA = {
  saved: [
    { id: 's1', label: 'better-file-browser', path: '~/Code/better-file-browser', kind: 'folder', tags: ['code'] },
    { id: 's2', label: 'slack-automation', path: '~/Code/Versable/slack-automation', kind: 'folder', tags: ['work'] },
    { id: 's3', label: 'plan', path: '~/Code/Versable/slack-automation/docs/plan', kind: 'folder', tags: ['work'] },
    { id: 's4', label: 'DIRECTIONS.md', path: '~/Code/Versable/versable-ingest/docs/plan', kind: 'doc', tags: ['work'] },
    { id: 's5', label: 'Notes', path: '~/Notes', kind: 'folder', tags: [] },
    { id: 's6', label: '"todo" in plan, subfolders', path: '~/Code/better-file-browser/docs', kind: 'search', tags: ['code'] }
  ],
  tagColors: { work: 'blue', code: 'green' },
  places: [
    { id: 'p1', label: 'Home', path: '~', icon: 'home' },
    { id: 'p2', label: 'Code', path: '~/Code', icon: 'folder' },
    { id: 'p3', label: 'Downloads', path: '~/Downloads', icon: 'download' },
    { id: 'p4', label: 'Desktop', path: '~/Desktop', icon: 'mac' },
    { id: 'p5', label: 'Notes', path: '~/Notes', icon: 'note' }
  ],
  recent: [
    { id: 'r1', label: 'feedback.md', path: '~/Notes', kind: 'doc', when: '2 min ago' },
    { id: 'r2', label: 'DIRECTIONS.md', path: '~/Code/Versable/slack-automation/docs/plan', kind: 'doc', when: '1 h ago' },
    { id: 'r3', label: 'better-file-browser', path: '~/Code', kind: 'folder', when: '3 h ago' },
    { id: 'r4', label: 'web_server.py', path: '~/Code/better-file-browser/native', kind: 'code', when: 'Yesterday' },
    { id: 'r5', label: 'home-rail.md', path: '~/Code/better-file-browser/docs/plan', kind: 'doc', when: 'Yesterday' }
  ],
  folder: {
    path: ['~', 'Code', 'better-file-browser'],
    items: [
      { id: 'f1', name: 'docs', kind: 'folder', meta: '18 items', when: 'Today' },
      { id: 'f2', name: 'native', kind: 'folder', meta: '9 items', when: 'Today' },
      { id: 'f3', name: 'src', kind: 'folder', meta: '74 items', when: 'Today' },
      { id: 'f4', name: 'e2e', kind: 'folder', meta: '22 items', when: 'Yesterday' },
      { id: 'f5', name: 'README.md', kind: 'doc', meta: '14 KB', when: 'Today', comments: 2 },
      { id: 'f6', name: 'manifest.json', kind: 'code', meta: '1 KB', when: 'Oct 21' },
      { id: 'f7', name: 'build.ts', kind: 'code', meta: '3 KB', when: 'Oct 28' },
      { id: 'f8', name: 'data.json', kind: 'table', meta: '6 KB', when: 'Oct 12' },
      { id: 'f9', name: 'banner.svg', kind: 'image', meta: '22 KB', when: 'Sep 30' }
    ]
  },
  doc: {
    name: 'README.md', path: '~/Code/better-file-browser', size: '14 KB', words: '2,140 words',
    headings: ['better-file-browser', 'What it does', 'Install', 'Notes', 'On the phone', 'Keys'],
    blocks: [
      ['h1', 'better-file-browser'],
      ['p', 'A Chrome extension that replaces the plain file:// listing with a real file explorer, and renders the files it understands in the page.'],
      ['h2', 'What it does'],
      ['ul', ['Folders as a sortable, filterable list with tabs and Saved places', 'Markdown, code, tables, images and diagrams rendered in place', 'Notes you write in a folder of your own, with comments like a shared doc']],
      ['mermaid', 'Look, keep, go'],
      ['h2', 'Install'],
      ['p', 'Load the folder unpacked on chrome://extensions, then allow access to file URLs.'],
      ['code', 'npm install\nnpm run build'],
      ['h2', 'On the phone'],
      ['p', 'Turn on Open on my phone in Settings, Data. The phone opens the same pages over the tailnet.', 'c1']
    ]
  },
  threads: [
    { id: 'c1', quote: 'Open on my phone', who: 'You', when: '10 min ago', text: 'Does this survive a Mac restart?', state: 'open', replies: [
      { who: 'bfb', when: '8 min ago', text: 'Yes. pm2 brings the server back and it waits for Tailscale before it answers.' }] },
    { id: 'c2', quote: 'with comments like a shared doc', who: 'You', when: 'Yesterday', text: 'Link the comments guide here.', state: 'done', replies: [] }
  ],
  inboxComments: [
    { id: 'ic1', doc: 'plan.md', where: '~/Code/Versable/slack-automation', text: 'Is the Thursday run before or after the deploy?', when: '1 h ago', due: 'Today' },
    { id: 'ic2', doc: 'README.md', where: '~/Code/better-file-browser', text: 'Does this survive a Mac restart?', when: '10 min ago' },
    { id: 'ic3', doc: 'home-rail.md', where: '~/Code/better-file-browser/docs/plan', text: 'Rail width on a 13 inch screen?', when: '2 d ago' }
  ],
  decisions: [
    { id: 'd1', title: 'docs.versable.ai UI taste calls', repo: '~/Code/Versable/slack-automation', open: 2, when: 'Just now', fresh: true },
    { id: 'd2', title: 'Directions and decision pages: what to build next', repo: '~/Code/better-file-browser', open: 7, when: '1 d' },
    { id: 'd3', title: 'What went wrong with Claude, week 44', repo: '~/Code/Claude/i-dream', open: 7, when: '1 d' },
    { id: 'd4', title: 'i-dream dashboard: sign-off', repo: '~/Code/Claude/i-dream', open: 4, when: '2 d' },
    { id: 'd5', title: 'Clanky eval: failure tiers', repo: '~/Code/Versable/slack-automation', open: 63, when: '2 d' }
  ],
  decision: {
    title: 'Directions and decision pages: what to build next', repo: '~/Code/better-file-browser', asked: '1 d ago',
    intro: 'Seven calls on what the Directions view and the decision pages do next. Each has my pick; change only what is wrong.',
    items: [
      { id: 'q1', title: 'Should Directions rows link to their decision page?', why: 'Rows that wait on you already name a page; a link saves a search.', options: ['Yes, a chip on the row', 'Only in the detail', 'No'], pick: 0, rec: 0 },
      { id: 'q2', title: 'Where does a submitted answer go?', why: 'Today it is copied; Submit could also message the agent.', options: ['Copy and message', 'Copy only'], pick: 0, rec: 0, flagged: true },
      { id: 'q3', title: 'Show done rows by default?', why: 'Done rows are most of a long doc.', options: ['Folded', 'Shown', 'Hidden'], pick: 0, rec: 0 }
    ]
  },
  directionsDocs: [
    { id: 'g1', repo: 'slack-automation', onYou: 16, ready: 16, when: 'Today' },
    { id: 'g2', repo: 'versable-ingest', onYou: 4, ready: 10, when: '5 d ago' },
    { id: 'g3', repo: 'versable-builder', onYou: 3, ready: 16, when: '1 d ago' }
  ],
  directions: {
    repo: 'slack-automation', counts: { you: 16, waiting: 5, ready: 16, parked: 3, done: 22 },
    sections: [
      { title: 'Clanky answers on its own account', met: 2, of: 6, rows: [
        { id: 'E1', state: 'you', task: 'DM Clanky one ask and read its answer' },
        { id: '#157', state: 'ready', task: 'Adversarial Linear rounds, priced first' },
        { id: 'E2', state: 'done', task: 'Read-only token for the bot account' }] },
      { title: 'The weekly run reports and holds', met: 0, of: 3, rows: [
        { id: 'V1', state: 'you', task: 'Review the built weekly run: tiered gate, degraded band' },
        { id: 'V2', state: 'waiting', task: 'First run lands, Thursday 2026-10-29' },
        { id: 'V3', state: 'parked', task: 'Second region for the VM' }] }
    ]
  },
  notes: [
    { id: 'n1', title: 'BFB Feedback', when: 'Sat', color: 'orange', pinned: true, body: 'AI chat is not durable, a page change stops it and loses history.' },
    { id: 'n2', title: 'Ideas for bfb', when: 'Today', color: 'teal', pinned: true, body: 'A home page that shows what waits on me first.' },
    { id: 'n3', title: 'Meeting notes 27 Oct', when: 'Mon', color: '', pinned: false, body: 'Ship the weekly run before the second region.' },
    { id: 'n4', title: 'Groceries', when: 'Sun', color: 'green', pinned: false, body: 'Eggs, milk, bread.' },
    { id: 'n5', title: 'Trip plan', when: 'Oct 20', color: '', pinned: false, body: 'Book the train by Friday.' }
  ],
  chats: [
    { id: 'a1', title: 'Why does the strip drop a tab?', about: 'tabs.ts', when: 'Today' },
    { id: 'a2', title: 'Summarise the weekly run plan', about: 'plan.md', when: 'Yesterday' },
    { id: 'a3', title: 'Explain the seed push', about: 'web-shim.ts', when: 'Mon' }
  ],
  chat: [
    { who: 'you', text: 'Why does the strip drop a tab when two windows move at once?' },
    { who: 'ai', text: 'Both windows write the whole strip back. The later write wins, so a tab the other window added is lost. Writing only the change fixes it.' }
  ],
  openPages: [
    { id: 'o1', label: 'README.md', where: 'better-file-browser', kind: 'doc' },
    { id: 'o2', label: 'better-file-browser', where: 'Code', kind: 'folder' },
    { id: 'o3', label: 'DIRECTIONS.md', where: 'plan', kind: 'doc' },
    { id: 'o4', label: 'feedback.md', where: 'Notes', kind: 'doc' }
  ],
  searchHits: [
    { id: 'h1', name: 'plan.md', where: '~/Code/Versable/slack-automation/docs', line: 'weekly run: <b>todo</b> second region', kind: 'doc' },
    { id: 'h2', name: 'home-rail.md', where: '~/Code/better-file-browser/docs/plan', line: '<b>todo</b>: rail width on small screens', kind: 'doc' },
    { id: 'h3', name: 'tabs.ts', where: '~/Code/better-file-browser/src', line: '// <b>todo</b> write only the change', kind: 'code' }
  ]
};
