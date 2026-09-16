# Usability v3 brief

State of the extension at 2.9.0, written 2026-09-16 for the owner's review. Private
use only. Everything below is built, bundled into `content.js`, and green under
`npm run test`, `npm run e2e`, and `npm run e2e:light` at HEAD. The one thing not
yet done is a real browser session: no claim here rests on a reload of the
extension since v2.8, only on the e2e harness and screenshots the agent read.

## What v3 set out to do

The owner's ask on 2026-09-16 was to take three primitive areas up to the standard of
a daily power user who should not have to think about limitations or clunky steps:
the Settings panel, the markdown viewer's spacing and display, and the file preview
and tab behaviour. The build order followed the reading day: the markdown viewer
first because it is read all day, then preview and tabs, then Settings, whose knobs
mostly expose what the first two passes created.

## What shipped

Markdown viewer. A real typographic scale (15px body, 1.65 line height, headings on a
26/21/17/15 ramp with room above h2), full width by default with a reading-column
toggle that persists, a table of contents rail that highlights the section in view
and collapses, code blocks with a language chip and a per-block copy button and
horizontal scroll instead of wrap, tables in a scroll container so a wide table never
widens the page, front matter as a compact key and value block, task lists as
read-only checkboxes, and images centred with a click that opens the file natively.

Preview and tabs. The panel header gained open-in-this-tab and open-in-a-new-strip-tab,
and Enter while the panel is open goes to the file page. The panel remembers scroll
per file for the session. With the panel open, `t` keeps the previewed file as a
background strip tab. The strip now shrinks tabs to a minimum, then scrolls with fade
edges and keeps the active tab in view, with a menu that lists every tab. Tab labels
truncate in the middle and show their folder when two share a basename. Folder tabs
remember their listing scroll. Pinned tabs collapse to their icon. Shift-T reopens the
last closed tab from a per-Chrome-tab stack.

Settings. Sidebar sections toggle on and off. Click on a file chooses look-in-panel or
go-to-page. Preview placement defaults to floating or docked and the remembered sizes
can be reset. A reader group sets column width, base size, line height, and code size.
The strip can restore closed strips or not, with a reopen stack depth. Settings and the
Saved list export and import as one JSON file. Tooltips toggle on and off. A link jumps
to the Keyboard tab of Help. Help and Settings now share one tabbed dialog whose title
row and tab strip hold still while a pane scrolls.

Structure. `main.ts` dropped from a 1669-line monolith to a 131-line entry point, with
page, listing, listing-input, sidebar, settings-ui, chrome, dialog, help, strip,
md-ui, toast, styles, el, and app in their own modules.

## The invariants that hold it together

- The address bar is the active tab's location and nothing else. Navigation is real:
  a tab or crumb click sets `location.href`, never an in-page state swap.
- Opening a file in the panel is Look, not Go. The URL does not change. This holds for
  listing rows while Settings has click set to look.
- Sidebar rows are bookmarks, not listing rows. A click opens the place as a strip tab,
  switching to the tab that already holds it or keeping a new one, and goes there. An
  earlier pass made a saved file look in the panel; the owner rejected it. Bookmarks
  open, they do not preview.
- One shell. The file page is the explorer shell in file mode, so the bar, sidebar,
  strip, and status bar sit in the same place on a listing and a file, checked to the
  pixel in e2e, and nothing moves when a file opens.
- Every gesture and key lives in `docs/mouse-key-audit.md`. The code follows that file,
  e2e exercises the rows marked with a check, and the same run fails if any control
  lacks a tooltip.

## Verified against not

Verified by e2e in both themes: the M, P, and S items marked with a check in
`docs/plan/usability-v3.md`, the full mouse and key contract rows marked with a check,
and the tooltip sweep across every control. Vitest covers the pure cores (renderers,
tabs, places, storage, sort-filter, and the rest) at 192 tests.

Built but not exercised by e2e, so resting on code and screenshots alone: image click
to open natively (M4), panel scroll memory (P2, the fixture is too short to scroll),
preview default placement and reset sizes (S3), strip restore off (S5), and the editor
keys not named in the contract's checked rows, which include italic and code
(Cmd+I, Cmd+E), redo (Cmd+Shift+Z), and duplicate lines (Alt+Shift+Up and Down).

Not done at all: the owner's own browser session. The extension has not been reloaded
or used in a real browser since v2.8.

## Deferred by choice

Web Store preparation stays out because this is private use. The highlighter passes P3
and P4 wait. The optional plan rows wait for a yes: reading-progress bar (M8), callout
boxes (M9), docked panel remembering the open file per folder tab (P9), and drag a row
onto the strip or a tab onto Saved (P10).
