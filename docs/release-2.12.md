# Version 2.12

Version 2.12 fixes how documents read, adds editing for any text file in folders
you allow, and stops tab restore from surprising you.

| Area | Change |
|---|---|
| Links | Bare `https://` and `file://` addresses in Markdown become links, including inside table cells. |
| Highlighting | Code fences labelled `json`, `http`, `typescript`, `python`, `shell`, `console`, `rust`, `golang`, `postgres` and similar get colour. SQL keywords match in any case, with types and `:params`. YAML colours keys, plain values, anchors and document markers. JSON keys, strings, numbers and literals each have their own colour. JSON that fails strict parsing (comments, trailing commas) shows as highlighted text. |
| Raw view | Raw shows the file in its own language instead of plain text. |
| YAML, SQL, CSV, XML | Chrome downloads these types, so the explorer opens them inside their folder's page (`folder/#view=name`) with highlighting and the Edit button. Every way of opening a file takes this route. |
| Editing | **Settings → Notes → Editable folders** lists folders where any text file can be edited in place. The file page gets an **Edit** button (**e**). Markdown edits beside a live render; other text edits as source. **⌘S** saves. The previous text is kept for 14 days under `~/Library/Application Support/BetterFileBrowser/backups`. A change on disk while you have unsaved edits offers **Load from disk** or **Keep mine**. |
| HTML | The preview panel shows an `.html` file as a page, in a sandbox, with a **Page / Source** toggle. |
| Markdown | Lists nest by indentation and keep continued lines in their item. GitHub alerts (`> [!NOTE]`, TIP, IMPORTANT, WARNING, CAUTION) render as coloured callouts. Footnotes link to a list at the end. Two trailing spaces break a line. A Markdown page's contents sit in the top half of the sidebar. |
| Tabs | A fresh Chrome tab no longer pulls in another tab's closed strip; **Restore closed strips** is off by default. **Recent** lists files as well as folders. Switching tabs from a page you never kept keeps it as a tab. |
| Notes | The filter also finds notes by their text, showing the matching line. The toolbar adds strikethrough, heading levels, link, quote and numbered list. Versions follow a note through renames and say whether the folder is a repository at all. Tags written as `[a, b]` and `''` inside a quoted title read the same everywhere. A `$` in a property no longer blocks saving. A note opens at its top. |
| Preview and status | Docked, the preview header goes icon-only so its close button stays inside the panel. File pages show a line count in the status bar. |
| Terminal | Terminal.app, iTerm2, WezTerm and Kitty open on the folder, not only Ghostty. A custom command is copied, never run. |

The plan for the remaining work (Notes editor colouring, one front-matter
parser, and a Firefox port) is in [plan/20261019-edit-notes-firefox.md](plan/20261019-edit-notes-firefox.md).

## Checks

The unit suite, the notes and launcher host suites, the browser smoke in dark
and light, and two new browser walks: `e2e/owner-batch-1019.mjs` (links,
highlighting, raw JSON, HTML preview, sidebar contents, tabs) and
`e2e/edit-walk.mjs` (editing, conflict banner, YAML view).
