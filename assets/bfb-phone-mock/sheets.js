// Sheets rise from the bottom over a place. On the phone they stand in for the
// desktop's hover buttons, right-click menus, popovers and side panels. A tap
// on the scrim or a swipe down closes one; there is no close button.

const byId = (list, id) => list.find(x => x.id === id) || list[0];

const SHEETS = {
  open: () => ({ title: plural(DATA.openPages.length, 'open page'), body: group(DATA.openPages.map(o =>
    row({ icon: KIND_ICON[o.kind], title: o.label, sub: o.where, act: 'go', arg: o.kind === 'folder' ? 'folder' : 'file', more: 'opened|' + o.id })).join('')) + btn('Close all but this', 'x', 'toast', 'Closed 3 pages', 'quiet') }),

  path: () => ({ title: 'Folders above', body: group(['~', 'Code', 'better-file-browser'].map((f, i) => row({ icon: i ? 'folder' : 'home', title: f, sub: ['~', 'Code', 'better-file-browser'].slice(0, i).join(' / ') || 'Your home folder', act: 'go', arg: 'folder' })).join('')) }),

  item: id => {
    const f = byId(DATA.folder.items.concat(DATA.recent.map(r => ({ id: r.id, name: r.label, kind: r.kind }))), id);
    return { title: f.name, body: group(
      row({ icon: 'eye', title: 'Open', act: 'go', arg: f.kind === 'folder' ? 'folder' : 'file' }) +
      row({ icon: 'tabs', title: 'Keep as an open page', act: 'toast', arg: 'Added to open pages' }) +
      row({ icon: 'bookmark', title: 'Save', act: 'toast', arg: 'Saved' }) +
      row({ icon: 'copy', title: 'Copy path', act: 'toast', arg: 'Path copied' }) +
      row({ icon: 'link', title: 'Copy phone link', act: 'toast', arg: 'Link copied' }) +
      row({ icon: 'select', title: 'Select more', act: 'flip', arg: 'selecting' })) };
  },

  saved: id => {
    const r = byId(DATA.saved, id);
    return { title: r.label, body: group(
      row({ icon: 'pencil', title: 'Rename', act: 'toast', arg: 'Renamed' }) +
      row({ icon: 'tag', title: 'Tags', sub: r.tags.join(', ') || 'None yet', act: 'sheet', arg: 'tags|' + r.id }) +
      row({ icon: 'link', title: 'Copy phone link', act: 'toast', arg: 'Link copied' }) +
      row({ icon: 'trash', title: 'Remove from Saved', act: 'toast', arg: 'Removed, undo' })) };
  },

  tags: id => ({ title: 'Tags for ' + byId(DATA.saved, id).label, body: chips([['work', 3, 'blue'], ['code', 2, 'green'], ['later', 0, 'orange']], byId(DATA.saved, id).tags, 'toast') + field({ label: 'New tag', placeholder: 'New tag' }) }),

  opened: id => ({ title: byId(DATA.openPages, id).label, body: group(
    row({ icon: 'pin', title: 'Pin', act: 'toast', arg: 'Pinned' }) +
    row({ icon: 'bookmark', title: 'Save', act: 'toast', arg: 'Saved' }) +
    row({ icon: 'x', title: 'Close', act: 'toast', arg: 'Closed' })) }),

  folder: (arg, s) => ({ title: DATA.folder.path.at(-1), body:
    seg([['List', 'list'], ['Grid', 'grid']], view(s, 'folder'), 'view', 'folder') + group(
      row({ icon: 'select', title: 'Select', act: 'flip', arg: 'selecting' }) +
      row({ icon: 'hidden', title: s.hidden ? 'Hide dot files' : 'Show dot files', act: 'flip', arg: 'hidden' }) +
      row({ icon: 'search', title: 'Search in here and below', act: 'go', arg: 'search' }) +
      row({ icon: 'link', title: 'Copy phone link', act: 'toast', arg: 'Link copied' }) +
      row({ icon: 'mac', title: 'Open on the Mac', act: 'toast', arg: 'Opened in Finder on the Mac' })) }),

  file: (arg, s) => ({ title: DATA.doc.name, body: group(
    row({ icon: 'raw', title: s.raw ? 'Show it rendered' : 'Show raw text', act: 'flip', arg: 'raw' }) +
    row({ icon: 'copy', title: 'Copy the text', act: 'toast', arg: 'Copied' }) +
    row({ icon: 'link', title: 'Copy phone link', act: 'toast', arg: 'Link copied' }) +
    row({ icon: 'tabs', title: 'Keep as an open page', act: 'toast', arg: 'Added to open pages' }) +
    row({ icon: 'sparkle', title: 'Ask about this file', act: 'go', arg: 'chat' }) +
    row({ icon: 'mac', title: 'Open on the Mac', act: 'toast', arg: 'Opened on the Mac' }) +
    row({ title: DATA.doc.size + ', ' + DATA.doc.words, sub: DATA.doc.path })) }),

  toc: () => ({ title: 'Contents', body: group(DATA.doc.headings.map((h, i) => row({ icon: i ? 'heading' : 'doc', title: h, act: 'toast', arg: 'Jumped to ' + h })).join('')) }),

  find: () => ({ title: 'Find in this file', body: field({ kind: 'search', label: 'Find', placeholder: 'Words in this file', value: 'phone' }) + row({ title: '2 matches', sub: 'On the phone, and in the last paragraph' }) + btn('Next', 'down', 'toast', 'Match 2 of 2') }),

  comments: () => ({ title: 'Comments', body: chips([['Open', 1], ['Done', 1]], ['Open'], 'toast') + DATA.threads.map(t => thread(t)).join('') + row({ icon: 'hand', wrap: true, title: 'Select words in the doc to comment on them', sub: 'Press and hold a word, drag the handles, then tap Comment' }) }),

  thread: id => {
    const t = byId(DATA.threads, id);
    return { title: 'On "' + t.quote + '"', body: thread(t, true) + composer('Reply', 'toast', 'Replied') + group(
      row({ icon: 'send', title: 'Send to an agent', sub: 'bfb is live in better-file-browser', act: 'sheet', arg: 'sendto' }) +
      row({ icon: 'check', title: t.state === 'done' ? 'Reopen' : 'Mark done', act: 'toast', arg: t.state === 'done' ? 'Reopened' : 'Marked done' })) };
  },

  sendto: () => ({ title: 'Send to an agent', body: group(
    row({ icon: 'sparkle', tone: 'purple', title: 'bfb', sub: 'better-file-browser, live now', act: 'toast', arg: 'Sent to bfb' }) +
    row({ icon: 'sparkle', tone: 'purple', title: 'clanky-hands', sub: 'slack-automation, live now', act: 'toast', arg: 'Sent to clanky-hands' }) +
    row({ icon: 'sparkle', title: 'gcc-all', sub: 'Asleep, it reads this when it wakes', act: 'toast', arg: 'Queued for gcc-all' })) }),

  download: () => ({ title: 'Download the diagram', body: group(['SVG', 'PNG', 'PDF', 'Markdown', 'Text'].map(f => row({ icon: 'download', title: f, act: 'toast', arg: 'Saved ' + f })).join('')) }),

  layout: () => ({ title: 'Layout', body: seg([['Tidy', 'layout'], ['Compact', 'grid']], 'Tidy', 'toast', 'layout') + seg([['Curved', 'route'], ['Straight', 'flow']], 'Curved', 'toast', 'lines') }),

  dp: () => ({ title: DATA.decision.title, body: group(
    row({ icon: 'flag', title: 'Show only the flagged one', act: 'toast', arg: 'Showing 1 flagged' }) +
    row({ icon: 'undo', title: 'Put back my picks', act: 'toast', arg: 'Back to the drafted picks' }) +
    row({ icon: 'copy', title: 'Copy the answer', act: 'toast', arg: 'Answer copied' }) +
    row({ icon: 'folder', title: 'Open the page\'s folder', act: 'go', arg: 'folder' })) }),

  qnote: id => ({ title: 'A note on ' + byId(DATA.decision.items, id).title, body: field({ kind: 'area', label: 'Your note', placeholder: 'What the agent should know' }) + btn('Save', 'check', 'toast', 'Note kept', 'primary') }),

  sections: () => ({ title: 'Sections', body: group(DATA.directions.sections.map(sec => row({ icon: 'route', title: sec.title, meta: sec.met + ' of ' + sec.of, act: 'toast', arg: 'Jumped' })).join('')) }),

  drow: id => {
    const r = DATA.directions.sections.flatMap(x => x.rows).find(x => x.id === id) || DATA.directions.sections[0].rows[0];
    return { title: r.id, body: row({ title: r.task, pill: r.state, wrap: true }) + group(
      row({ icon: 'decision', title: 'Open its decision page', act: 'go', arg: 'decision' }) +
      row({ icon: 'comment', title: 'Comment on this row', act: 'sheet', arg: 'thread|c1' }) +
      row({ icon: 'send', title: 'Send to an agent', act: 'sheet', arg: 'sendto' })) };
  },

  note: id => ({ title: byId(DATA.notes, id).title, body: chips([['red', null, 'red'], ['orange', null, 'orange'], ['green', null, 'green'], ['teal', null, 'teal'], ['none']], [byId(DATA.notes, id).color || 'none'], 'toast') + group(
    row({ icon: 'pin', title: byId(DATA.notes, id).pinned ? 'Unpin' : 'Pin', act: 'toast', arg: 'Done' }) +
    row({ icon: 'pencil', title: 'Rename', act: 'toast', arg: 'Renamed' }) +
    row({ icon: 'link', title: 'Copy phone link', act: 'toast', arg: 'Link copied' }) +
    row({ icon: 'trash', title: 'Move to trash', act: 'toast', arg: 'Moved to trash, undo' })) })
};
