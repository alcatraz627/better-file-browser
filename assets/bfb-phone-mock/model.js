// Every place in bfb on the phone: its parent, its views and its icon.
// Breadcrumbs, Back and the bottom-bar highlight are all read from this list,
// never typed on a screen. Why the places are cut this way: README.md.
//
// kind 'bar' is one of the five bottom-bar places; 'page' is a child place.
// views are looks at the same place, so switching one is not navigation.
// desk names the desktop surface the place replaces; the review panel shows it.

const PLACES = [
  { id: 'home', kind: 'bar', label: 'Home', icon: 'home', desk: 'Home tab' },
  { id: 'search', kind: 'page', parent: 'home', label: 'Search', icon: 'search', views: ['Names', 'Text'], desk: 'Search lens, filter box, deep search' },
  { id: 'settings', kind: 'page', parent: 'home', label: 'Settings', icon: 'settings', desk: 'Settings dialog' },

  { id: 'browse', kind: 'bar', label: 'Browse', icon: 'folder', views: ['Places', 'Saved', 'Recent'], desk: 'Places, Saved and Recent lenses' },
  { id: 'folder', kind: 'page', parent: 'browse', label: 'Folder', icon: 'folder', views: ['List', 'Grid'], desk: 'The listing, toolbar and path bar' },
  { id: 'file', kind: 'page', parent: 'folder', label: 'File', icon: 'file', desk: 'Preview panel and file page' },
  { id: 'editor', kind: 'page', parent: 'file', label: 'Edit', icon: 'pencil', views: ['Write', 'Preview'], desk: 'File editor and Split' },
  { id: 'diagram', kind: 'page', parent: 'file', label: 'Diagram', icon: 'diagram', desk: 'Diagram viewer' },

  { id: 'inbox', kind: 'bar', label: 'Inbox', icon: 'inbox', views: ['Decisions', 'Comments', 'Directions'], desk: 'Decisions and Comments lenses, Home counts' },
  { id: 'decision', kind: 'page', parent: 'inbox', label: 'Decision', icon: 'decision', desk: 'Decision page and answer bar' },
  { id: 'directions', kind: 'page', parent: 'inbox', label: 'Directions', icon: 'route', desk: 'DIRECTIONS.md view' },

  { id: 'notes', kind: 'bar', label: 'Notes', icon: 'note', views: ['Pinned', 'All'], desk: 'Notes lens' },
  { id: 'note', kind: 'page', parent: 'notes', label: 'Note', icon: 'note', views: ['Read', 'Write'], desk: 'Note editor in the panel' },

  { id: 'ask', kind: 'bar', label: 'Ask', icon: 'sparkle', desk: 'Ask lens' },
  { id: 'chat', kind: 'page', parent: 'ask', label: 'Chat', icon: 'sparkle', desk: 'Ask chat' },

  { id: 'showcase', kind: 'page', parent: 'home', label: 'Design system', icon: 'palette', review: true }
];

const PLACE = Object.fromEntries(PLACES.map(p => [p.id, p]));

/** The path from the bar place down to this place, bar place first. */
function pathTo(id) {
  const path = [];
  for (let at = id; at; at = PLACE[at].parent) path.unshift(at);
  return path;
}

/** The bar place that owns this place; this is what the bottom bar highlights. */
function barOf(id) { return pathTo(id)[0]; }

/** Where Back goes from this place with nothing open on top of it. */
function backTarget(id) {
  const place = PLACE[id];
  if (place.parent) return place.parent;
  return id === 'home' ? null : 'home';
}

const BAR = PLACES.filter(p => p.kind === 'bar').map(p => p.id);
