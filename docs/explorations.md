# Three explorations, sized before anyone builds

Written 2026-09-15 for the owner to pick from. Each one says what exists,
what it would cost in this codebase, and one recommended shape. None of it is
built.

## 1. Skinning the plain file pages (txt, md, sh, py, code)

**What happens today.** The extension injects into every `file://` page, but
`src/main.ts:34` returns unless the title starts with "Index of", so a file
opened directly gets Chrome's raw `<pre>` render. Every renderer needed to do
better already exists for the Quick Look preview: code highlighting for 45
extensions (`src/renderers.ts:6`), markdown with relative-link resolution,
JSON and JSONL trees, TSV/CSV tables.

**What Markdown Viewer is.** Version 5.3 is installed locally. MIT licensed
(Simeon Velichkov, github.com/simov/markdown-viewer), so copying is allowed
with the notice kept. It is 8.1 MB, of which mermaid is 2.9 MB, MathJax 2.0
MB, Prism 1.3 MB, and it ships six markdown compilers (marked, markdown-it,
remark, commonmark, remarkable, showdown) and 30 themes. It takes over a page
by URL pattern through the `scripting` permission, and its features are the
description line: dark mode, themes, autoreload, mermaid, MathJax, table of
contents, syntax highlighting.

**The cheap fact.** A raw text page already has the whole file in
`document.body.textContent`. No fetch, no relay, no new permission. A takeover
is: detect a file page with a known extension, read the body, replace the
document with our shell and the matching renderer.

**Recommended shape.** Build our own takeover on the renderers we have, and
borrow Markdown Viewer's feature list rather than its code:

- `src/file-page.ts`: runs when the path does not end in `/` and the
  extension is in our renderer sets. Renders a header bar (file name, size,
  "open folder in explorer", copy, theme, the AI bar) above the rendered body.
- Table of contents for markdown from the headings, in a left rail. Small.
- Autoreload: poll the file through the existing relay every 2 s while the
  tab is visible, re-render on change. The relay and the diff are already
  there.
- Mermaid: vendor `mermaid.min.js` (2.9 MB) and load it lazily only when a
  fence says `mermaid`. MathJax: skip until asked.
- Themes: our dark and light only. Thirty themes is their product, not ours.

**The conflict to decide.** With both extensions on, they fight over `.md`
pages. Either the owner turns off Markdown Viewer for `file://`, or our
takeover leaves `.md` to it and handles everything else. The recommendation
is the first: one renderer, and ours has the explorer link and the AI bar.

**Cost.** A day. The takeover shell is small because the renderers exist;
the real work is the header bar and the table of contents.

## 2. Tabs inside the explorer, synced across windows

**What the ask means.** A tab strip at the top of the explorer where each tab
is a folder, so one Chrome tab holds several places, and the same strip
appears in every explorer window because the set is shared.

**Three shapes, from cheap to expensive.**

- **A. Persisted strip, real navigation.** Tabs are `{ id, path, label }` plus
  an active id, stored under one key in localStorage, which every `file://`
  page shares. Clicking a tab navigates the page; the strip re-renders from
  storage on load. Other open explorer windows update through the `storage`
  event. Cost: a strip component, a storage helper, a keyboard pair (⌘⇧[ and
  ⌘⇧]) and a "new tab from this folder" button. Two or three hours.
- **B. Single-page explorer.** Switching tabs fetches the listing through the
  relay (the crumb dropdown and deep search already do this) and re-renders
  without navigation. Chrome refuses `pushState` to another `file://` path, so
  the address bar would stop matching the folder shown. `main.ts` also treats
  the entry list as fixed at load, so this is the behavioural decomposition
  refactor (#37 M2b) done first. Days, not hours.
- **C. Mirror Chrome's own tabs.** With the `tabs` permission the worker can
  list every Chrome tab on a `file://` folder and the strip shows those;
  clicking one activates that Chrome tab. Cheap, and it is what "synced" would
  mean if the owner opens folders in separate Chrome tabs anyway. Adds a
  permission the Web Store will ask about (#34).

**Recommended shape.** A now, C as an optional section of the same strip
later. B only if the address-bar mismatch is acceptable, and after #37.

## 3. Notes: a markdown editor that reads and writes files in one folder

**The constraint.** A content script cannot write to disk. Two ways exist:

- **Native host** (proven here twice: `native/llm_host.py`, the Ghostty
  launcher, both installed by `native/install.sh`). A third host,
  `notes_host.py`, with ops `list`, `read`, `write`, `create`, `rename`,
  `delete`, all confined to one root the owner picks in Settings. The host
  refuses any path whose real path is outside the root, and `write` carries
  the mtime it read so a concurrent change is a conflict, not a clobber.
- **File System Access API** (`showDirectoryPicker`). It might work from a
  `file://` page and would need no host, but I have not confirmed that Chrome
  grants it to content scripts on `file://`, and handles must be re-granted
  after a restart. UNCONFIRMED, and the native host is the known path.

**Recommended shape.**

- Settings gains a "Notes folder" field. A "Notes" sidebar section lists that
  folder's `.md` files newest first, with a "+ New note" row.
- The editor is the docked preview panel (shipped today) in an edit mode:
  textarea on the left, our `renderMarkdown` on the right, ⌘S saves, autosave
  after 1.5 s of quiet, a dirty dot on the tab. The kanban board's
  `editor.js` (109 lines, no DOM until called) already solves undo that
  survives a re-render, coalesced history and insert-at-cursor. Copy it in.
- Rename and delete from the row's hover actions, like Places today.
- Out of scope for a first cut: front matter, tags across notes, search
  inside notes (deep search plus the filter box already find them by name).

**Cost.** Host plus install step, half a day. Editor mode in the docked
panel, a day. The sidebar section, a couple of hours.

## The one question

Which of the three to build first. My order: 3 (it is the feature the owner
named as a feature), then 1, then 2A. Each is independent, so any order works.
