# Edit any text file, a Notes overhaul, and a Firefox port

<!-- sessions: better-file-browser-20db15be@2026-10-19 -->

Owner ask, 2026-10-19: "Let me edit text files and md docs inline, even the
ones not expressly in note, plan for this", "md notes are bad and very
lacking", "firefox support for the plugin".

This plan rests on three adversarial reviews run the same day, in
`.claude/output/20261019-2210-adversarial-review/` (`visuals-usability.md`,
`product-halfbuilt.md`, `code-data.md`). Findings already fixed that day are
listed at the end so they are not planned twice.

Build order: inline editing first, because the Notes overhaul reuses its
editor, and Firefox last, because two of its blockers (storage and file
reads) are changes Chrome benefits from on their own.

## 1. Edit any text file

Today the only write path is the notes host, and it refuses anything outside
the chosen notes folder or anything that is not `.md` (`native/notes_host.py`
`resolve_rel` and the `.md` check in `op_write`). The editor (about 300
lines) lives inside `src/preview.ts` as module state tied to `NoteDoc`,
front-matter drift guards and the notes rename-on-first-save rule. Nothing
generalises as it stands.

| # | Item | Default | Check |
|---|---|---|---|
| E1 | A `files` op family in the native host: `read`, `write(path, text, expectMtime)`. Writes only text under folders listed in Settings → Editing (empty by default, so nothing is writable until the owner adds a folder). Same mtime conflict check as notes. Refuses binary, files over 2 MB, symlinks that leave the folder. | default | host protocol test: write inside an allowed folder, refuse outside, refuse stale mtime, refuse a symlink escape |
| E2 | Before every write, the previous text goes to `~/Library/Application Support/BetterFileBrowser/backups/<date>/<path>` (kept 14 days), so an edit outside git can be undone. | default | host test: two writes leave one backup with the first text |
| E3 | Pull the editor out of `preview.ts` into `src/editor-pane.ts` with a small interface: `open(doc, store)`, where `store` is either the notes store or the files store. Notes keep their rename, front-matter and versions behaviour through the notes store only. | default | existing smoke notes checks stay green; new unit tests on the store interface |
| E4 | An Edit button (key `e`) on the file page and in the preview header for any text file in an allowed folder. Markdown gets the split source and live render the notes editor has; other text gets the source pane with the file's own highlighting. Saving is explicit (Cmd+S) for non-notes files, with a dirty marker on the tab. | default | e2e: edit a `.md` and a `.yaml` in a fixture folder, Cmd+S, read back from disk; a file outside the allowed folders shows no Edit button |
| E5 | Autoreload (the file page already polls) pauses while the editor has unsaved changes and shows the same "changed on disk" banner notes use. | default | e2e: change the file on disk while dirty, banner shows, nothing overwritten |

Open question for the owner, with a default: the allowed-folder list starts
empty. If you would rather it start as `~/Code`, say so.

## 2. Notes overhaul

| # | Item | Default | Check |
|---|---|---|---|
| N1 | The source pane colours markdown as you type (headings, emphasis, code, links, lists), using the highlighter's new `md` grammar under a transparent textarea. | default | e2e screenshot both themes; unit test on the grammar already exists |
| N2 | Toolbar gains heading, link, quote, numbered list and strikethrough, each with a key. | default | e2e: each button wraps the selection |
| N3 | Search note contents, not only titles and tags. The host gets a `search(root, query)` op that returns matching notes with the first matching line. | default | host test plus e2e: a body word finds its note |
| N4 | The title field works for a plain note too: retitling a note without front matter renames its file, as the contract allows. | default | e2e |
| N5 | Opening a note scrolls the source to the top, matching the render. In the docked panel the toolbar wraps to one row and the source keeps at least half the height. | default | e2e at 1400 px docked |
| N6 | One front-matter module. Today there are four regexes in `notes.ts`, one in `preview.ts` and two parsers in the host, and they disagree on edge cases. The TypeScript side moves to one `frontmatter.ts`; the host's parser gets a shared fixture file both test suites read, so drift shows up as a failing test. YAML block lists for tags get read. | default | shared fixture run by vitest and by `test_notes_host.py` |
| N7 | Versions without Switchboard: when the notes folder is a git repository, the host commits each save itself (message `save: <title>`). A plain folder still has none, and says so. | *optional* | host test |
| N8 | Bring the docs back in line with the 2026-10-11 Notes changes: `docs/notes-contract.md` (title labels, shared order, front matter added for colour, pin and tags), README Notes section, Help's "Set notes folder" wording, and a version bump with release notes. | default | read-through; Help text matches the UI labels |

## 3. Firefox

The `chrome.*` namespace is not the blocker: the code uses only
`chrome.runtime` and `chrome.storage`, which Firefox provides under that name.
The blockers are structural:

| # | Blocker | Where | Plan |
|---|---|---|---|
| F1 | Settings, Saved, tags and reading choices live in page `localStorage` on the `file://` origin. Firefox gives each file its own origin by default, so settings would split per folder. | `src/storage.ts`, plus direct reads in `sidebar.ts`, `file-page.ts`, `dialog.ts`, `listing.ts`, `settings-ui.ts`, `chrome.ts` | Move every `bfb-*` key to `chrome.storage.local` behind one async store with an in-memory cache loaded before first render. One-time migration from `localStorage` on Chrome. Helps Chrome too: Settings export then covers tab recovery. |
| F2 | Every file read goes through a background `fetch(file://…)`, which Firefox does not allow from an extension. | `background.js`, `src/file-fetch.ts` | Route reads through the native host's `files.read` op (from E1) when the worker fetch fails, and make it the only path on Firefox. Directory crawls for deep search need a `files.list` op too. |
| F3 | Listing detection and parsing read Chrome's directory page (`Index of` title, `addRow(...)` script, `data-value` cells). Firefox renders its own directory index with a different structure. | `src/main.ts:32`, `src/parse.ts` | A second parser for Firefox's index page, picked by detecting which page is loaded. Fixture HTML captured from Firefox goes into `tests/parse.test.ts`. |
| F4 | Manifest uses `background.service_worker`; Firefox MV3 runs `background.scripts`. No `browser_specific_settings.gecko.id`. | `manifest.json` | Build writes two manifests (`dist/chrome`, `dist/firefox`) from one source; Firefox gets `background.scripts` and a gecko id. |
| F5 | Native hosts install only into Chrome's folder with `allowed_origins`. Firefox reads `~/Library/Application Support/Mozilla/NativeMessagingHosts` and wants `allowed_extensions`. | `native/install.sh` | `install.sh --firefox` writes the Mozilla manifests with the gecko id. |
| F6 | The e2e harness launches Chrome for Testing only. | `e2e/harness.mjs` | Add a Firefox launch through Puppeteer's WebDriver BiDi support and run `smoke.mjs` against both. |

Order: F1 and F2 first (both land in Chrome and are testable there), then F3
and F4, then F5 and F6. Firefox is "done" when `smoke.mjs` passes against
Firefox with the notes host installed.

Open question for the owner, with a default: Firefox needs "allow file
access" granted per extension and gives each file its own origin. The plan
assumes a desktop Firefox you control, not a store listing. Say so if you
want it published on addons.mozilla.org, because that adds signing and review.

## 4. Other findings the reviews raised, queued

| Finding | Source | Proposed fix |
|---|---|---|
| `.yaml`, `.yml`, `.sql`, `.csv` files cannot open as file pages: Chrome treats them as downloads, so Enter, double-click and links fail. `.xml` throws. | visuals #5 | Open these through an in-page view on the folder listing (`#view=name`), rendered by the file-page code, instead of navigating to the file. Confirm the abort once in branded Chrome first. |
| Nested and continued lists render wrong; `> [!NOTE]` alerts and `[^1]` footnotes show literally; two-space hard breaks collapse. | visuals #8, product #8 | Rework the list block parser to keep nesting and continuation lines; add alerts and footnotes. |
| Docked preview at 1400 px pushes the close and dock buttons outside the panel. | visuals #9 | Header wraps or collapses button labels to icons below a width. |
| Narrow windows keep both sidebar and contents open; breadcrumb hides the file name. | visuals #10 | Below 760 px the contents collapse to a button; breadcrumb collapses middle segments. |
| File pages show "0 folders, 0 files" in the status bar. | visuals #11 | Status bar shows size and line count on a file page. |
| Terminal setting: only Ghostty launches; the others copy a command while the tooltip says "opens". | product #11 | The launcher host runs `open -a <app> <dir>` for iTerm, WezTerm, Kitty and Terminal, and the Custom command. |
| The owner's home path is hard-coded for local-link detection and Favorites. | code appendix | Read the home folder once from the native host or from the listing URL; Favorites come from Settings. |
| The sanitizer test cannot fail (a leading `<script>` lands in `<head>`). Dead exports in `find.ts` and `places.ts`. Three name matchers disagree. | code #5 | Fix the fixture; remove dead exports; one matcher. |
| JSON tree opens two levels deep with no expand-all. | visuals appendix | Expand-all and collapse-all buttons. |

## Already fixed on 2026-10-19

Bare URL links, fence aliases, case-insensitive SQL, JSON/HTTP/markdown
grammars, coloured Raw view, YAML values and anchors, JSONC fallback for lax
JSON, distinct number colour, HTML page preview, contents in the sidebar,
strip restore off by default with files in Recent, switching tabs keeps the
current doc, restore merges instead of replacing, note Versions after a
rename, flow-list tags, `''` in titles, `$` in note properties. Verified by
`e2e/owner-batch-1019.mjs`, `e2e/smoke.mjs`, the vitest suite and
`native/test_notes_host.py`.
