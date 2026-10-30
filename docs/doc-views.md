# Doc views: decision pages and directions docs

Some documents are not meant to be read as plain files. A decision page is a
set of questions an agent wants the owner to answer. A directions doc is a plan
the owner reads to pick the next piece of work. bfb gives each of these its own
view, built as a small plugin on one shared kit, so a new kind of document can
reuse the same pictures, meters, folding text and side rail.

```
                 src/docview.ts  (the registry and the contract)
                         │
         ┌───────────────┴────────────────┐
         │                                │
   folder views                       file views
   replace a folder's listing         decorate a rendered .md file
         │                                │
   decision page                      directions doc
   src/dp-page.ts                     src/directions.ts
   (a folder with config.json)        (DIRECTIONS.md, *directions*.md)
         │                                │
         └───────────────┬────────────────┘
                         │ both draw with the shared kit
   docview-media    pictures, mock pages, marks, large view, compare
   docview-status   state pills, meters, a chip bar that filters
   docview-clamp    long text folded behind More / Less
   docview-outline  the side rail of items, following the scroll
```

## How a view plugs in

A view is an object with four fields (`src/docview.ts`):

| Field | Meaning |
|---|---|
| `id` | A stable name, such as `decision-page` |
| `on` | `folder` to replace a folder's listing, `file` to decorate a markdown file |
| `claims(path, names)` | A quick check from the path and file names, before anything is read |
| `mount(ctx)` | Draw the view. Return `false` when, having read the files, it is not one after all |

`src/docviews.ts` registers the views bfb ships and shows them in two places:

- **Folder views.** When a folder opens, the listing stays out of sight until
  the views that claim it have looked, so the file list never flashes first. If
  one mounts, a **Files** button in the view and a **Decision page** button in
  the toolbar switch between the view and the listing, remembered per tab. If a
  view throws, a toast says the page could not be drawn and the listing comes
  back.
- **File views.** After a markdown file renders, each claiming view decorates it
  in place. A failure leaves the plain markdown.

To add a kind of document: write a `DocView`, register it in `docviews.ts`,
and draw it with the kit modules. Keep anything specific to the new kind in its
own file.

## Decision pages

An agent writes a folder holding `config.json` (title, intro, origin,
decisions with options, sections to review, groups, pictures). Opening that
folder in bfb shows the page instead of the listing. The format belongs to
gcc and is described in `~/.claude/features/decision-pages.md`.

### What the owner sees

- A head with the title, the topic as a badge, where the page came from (a
  link to its board or card in gcc's page server, then project, session, goal
  and how long ago; click a fact to copy it), and the intro, folded after two
  lines.
- A sticky bar with a meter of changed, noted and as-drafted items, Notes,
  Marks, Flagged only, Reset, and on the right **Answer**, **Copy** and
  **Submit**.
- Decision cards whose options are rows with a number key, the recommended one
  tagged, and pictures as tiles: up to three in a row, four as two rows of two,
  never narrower than 220px. A decision with a `group` shows it as a small
  label in the group's colour. Section cards have an Agree switch, a priority,
  key-value slots and pictures.
- A rail on the right listing every item with its current pick. It shows when
  the pane is 720px wide or more.
- Pictures that grow in place, open large with ← → through their set, or
  compare two side by side. An `.html` entry is a live mock in a sandboxed
  frame. An agent can draw labelled boxes ("marks") on a picture; the Marks
  button hides them all.

Every pick, agree and note is saved in the browser as it changes and comes back
on reload. Keys: `j` `k` move, `1`-`9` pick, `a` agree, `n` note, `m` notes on
every card, `N` notes for Claude, `f` flagged only, `p` the answer panel, `c`
copy, `s` or `⌘↩` submit, `t` dark or light.

### How an answer travels

bfb never writes an answer itself. gcc owns the answer format, its parser, the
answer files and waking the agent that asked. bfb only asks gcc and shows what
comes back.

```
 bfb page (dp-page.ts, dp-answer.ts)
   │  picks, agrees, notes  ──►  toGcc() maps them to gcc's shape (dp-form.ts)
   ▼
 dp-io.ts  ── in the extension ──►  notes host (native/notes_host.py, op "dp")
   │                                   └─► decision-page.sh compose|parse|submit|seen
   └──────── on the web build ───►  POST /api/dp-compose|parse|submit|seen/<slug>
                                       (gcc's page server, same origin)
   ▼
 gcc composes the answer string, stores .answer.json, wakes the asker,
 records how in .notify.json
```

- **The panel** (`p`) shows the answer exactly as gcc composes it, updated a
  moment after each change. Copy puts that text on the clipboard; the Copy
  button shows how many items you changed.
- **Submit** sends that same text. The toast says whether the agent was woken
  or the message waits for it. The page then turns answered: a banner with when
  it was sent, each pick by label (a pick moved off the recommendation is
  tinted), each note or disagreement, and the full text folded. Submit becomes
  **Replace answer**, which asks before it overwrites.
- **Reopening an answered page** fills the form from the sent answer (gcc
  parses it back), unless you have edited the page since sending.
- **When something fails**, the page says which:
  - answered somewhere else already: the banner appears and Replace is offered;
  - gcc's server is down: nothing was written, the composed answer is on your
    clipboard to paste, and Submit stays for a retry;
  - gcc cannot compose at all: Submit is off with the reason, and Copy gives a
    picks line (`D1a D2b`) with the notes under a "not composed" heading;
  - the agent was not told: the answer is saved, and the banner keeps an amber
    edge.
- A page outside gcc's registry (such as `docs/dp-examples/`) can be answered
  and copied but not sent.

### The Decisions lens

The sidebar's Decisions lens lists every page in gcc's registry in bands:
waiting on you, answered, never answered. A waiting page you have not opened
has a dot. Each waiting page says whether the agent that asked is live, idle or
gone, from one `decision-page.sh reach` call; a live agent's page sorts first.
The list refreshes every 10 seconds while the lens is open. Opening a page
tells gcc it was seen.

### Outside the extension

`src/dp-web.ts` builds the same page as a standalone bundle,
`assets/dp-web/dp-web.js`, with a one-line shell beside it. gcc's page server
serves them at `/dp-assets/dp-web.js` and `/dp/<slug>/`, so a page opens over
http on another device on the tailnet. It uses the same cards, panel and keys,
reads files and posts answers by same-origin URLs, and has three controls by
the title: **All decisions** (back to `/dp/`, which answers on both of gcc's
listeners), **?** for a card of the page's keys, and a dark and light switch.
At phone width the bar wraps so Copy and Submit stay on screen. Opening the file in the app and copying a picture need the
extension, so the web build hides those two buttons.

## Directions docs

A file named `DIRECTIONS.md`, or any `*directions*.md`, is a plan of tables
whose rows carry one of five state marks (🔴 needs you, 🟠 waiting, 🟢 ready,
💤 parked, ✅ for finished rows). On its file page the markdown is left as
written and decorated.

### The head

A short head says what to do next. It lists three one-line items on you and
three ready for an agent. Each item links to its row.

### The filter row

One filter row stays pinned while the page scrolls. It holds:

- the Doc / List switch
- a chip per state, where several can be on at once
- Overview or Full
- a box that narrows rows by id or words
- "Showing N of M · Clear" whenever a filter is on
- the ⓘ legend, which holds the doc's "How to read this" section and its key
  to the marks

The filter lives in the address (`#dir?…`). Back and a shared link bring the
same view.

### Doc and List

**Doc** shows the doc itself, narrowed to the matching rows.

**List** shows every task row in one bordered table, grouped by direction. It
holds exactly the rows the doc would show. A row opens the doc at that row.

- **Direction cards** sit above the table, one per direction. A ring shows how
  much of the direction is finished, counting every row. Below it are the
  state counts and next rows of what the filter shows. A card opens its group.
- **Links** is a column of chips, one per link in the row: PR, issue, commit,
  Linear ticket, Google doc, other page or file. It hides when no row has a
  link.

### Marks

- A mark at the start of a cell becomes a named pill. This happens whether
  the mark stands alone, is followed by its name ("🟢 ready") or by other
  words, which stay.
- A key row is never counted as a task.
- Rows under a "Waiting on you" heading count as needing you.
- Pictures open large, with ← → through the doc's pictures.

## Files

| File | Holds |
|---|---|
| `src/docview.ts` | The view contract and registry |
| `src/docviews.ts` | Registers the views; mounts folder and file views; the Files and back buttons |
| `src/docview-media.ts` | Pictures, mock pages, marks, large view, compare |
| `src/docview-status.ts` | Pills, meters, the filtering chip bar |
| `src/docview-clamp.ts` | More / Less folding |
| `src/docview-outline.ts` | The item rail |
| `src/dp-page.ts` | The decision page view: head, bar, keys, saving |
| `src/dp-cards.ts` | Decision and section cards, groups |
| `src/dp-form.ts` | Answers as data: drafted state, flags, the mapping to gcc's shape, the fallback picks line |
| `src/dp-answer.ts` | The answer panel, Copy, Submit, the answered banner |
| `src/dp-io.ts` | Where a page reads and sends: extension or web |
| `src/dp-lens.ts` | The Decisions lens |
| `src/dp-web.ts` | The web build's entry |
| `src/directions.ts` | The directions doc view: head, filter row, Doc layout |
| `src/directions-model.ts` | Reads the doc into sections and rows, with each row's state and direction |
| `src/directions-state.ts` | The filter record and its `#dir?` address form |
| `src/directions-list.ts` | The List layout: direction cards, grouped rows, link chips |
| `native/notes_host.py` | `dp` (relay to gcc's command) and `dpPages` (the lens's list, with reach) |

## Checks

| Run | Covers |
|---|---|
| `npx vitest run tests/dp-form.test.ts tests/dp-lens.test.ts tests/directions.test.ts` | Answer data, the gcc mapping, lens bands and order, directions parsing |
| `python3 native/test_notes_host.py` | The host's relay to gcc: arguments, stdin, exit codes, reach |
| `node e2e/dp-walk.mjs` | The page, cards, keys, saving, Reset, notes off |
| `node e2e/dp-answer-walk.mjs` | Panel, Copy, Submit, Replace, answered banner, every failure message |
| `node e2e/dp-gallery-walk.mjs` | Pictures, mock tiles, marks, large view, compare |
| `node e2e/dp-lens-walk.mjs` | The lens, including reach |
| `node e2e/dp-web-walk.mjs` | The web build in a plain browser against a stand-in for gcc's server |
| `node e2e/directions-walk.mjs` | The directions doc view |
| `node e2e/directions-bar-walk.mjs` | The pinned filter row and the ⓘ legend |
| `node e2e/directions-list-walk.mjs` | The List: same rows as the doc, cards, link chips, a row opening the doc |
| `node e2e/directions-url-walk.mjs` | The filter kept in the address, Back, a pasted link |
| `node e2e/dp-check.mjs` | Every real page in gcc's registry renders, and its answer matches gcc's compose and parse |

Each walk takes `BFB_THEME=light` for the light theme. Walks copy pages into a
scratch registry and a stand-in for gcc's command; they never touch the live
registry.
