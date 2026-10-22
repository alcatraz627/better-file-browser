---
reader: the owner and the agent building the layers slice
---

# Parity list: floating layers

One row per thing a person can do with a floating layer today that must still
work after the slice (component-system.md 13.1, step 3). The full behaviour
table is `docs/plan/variants/layers.md`. Rows describe the commit before the
slice (068d04f).

Every row is marked `kept` until the owner decides otherwise. The last column
names the e2e check that covers it. `none` means no automated coverage found.
`pressed` means the script presses the key but asserts nothing about the
result. Part 2 lists today's defects the slice could fix, for the owner to
rule on.

Each `kept` row also becomes a "check that it still works" task on the slice.

## 1. Behaviours to keep

### Path menu (`#fe-crumb-menu`)

| id | what the user does | what happens today | covered by |
|---|---|---|---|
| L1 | Click the chevron after a folder | A menu lists that folder, with a Filter box that takes focus | path-bar-walk.mjs:55-60, smoke.mjs:281-283 |
| L2 | Click "…" in the path bar | A menu lists the folded folders | path-bar-walk.mjs:41-49 |
| L3 | Click "…" under home | The menu lists the folders above `~` | path-bar-walk.mjs:108-111 |
| L4 | Click a menu item | The page goes to that folder or file | path-bar-walk.mjs:49 |
| L5 | Alt-click a menu item | A background tab opens, the page and URL stay, the menu stays | smoke.mjs:281-290 |
| L6 | Type in the Filter box | Items narrow by name | none |
| L7 | Press Enter in the Filter box | The first visible match opens | none |
| L8 | Press Esc in the Filter box | The menu closes | pressed at path-bar-walk.mjs:62 |
| L9 | Press ↑ ↓ Home End Enter | A highlight moves, Enter opens it | none |
| L10 | Click the same chevron again | The menu closes | none |
| L11 | Click elsewhere on the page | The menu closes | none |
| L12 | Resize the window | The menu closes | none |
| L13 | Open the menu | It rises in with the shared animation | motion-walk.mjs:67-70 |
| L14 | Open the menu at a zoom level | It sits under its chevron | zoom-walk.mjs:17-21 (reads both rectangles) |
| L15 | An empty or unreadable folder | The menu says "Empty folder" or "Cannot load directory" | none |

### Tab menu and All tabs list (`.fe-tab-menu`)

| id | what the user does | what happens today | covered by |
|---|---|---|---|
| L16 | Click ⋯ on a tab | A menu lists Copy path, Save or Unsave, Pin, Close, Close others | smoke.mjs:947-949 |
| L17 | Right-click a pinned tab | The same menu opens, with Unpin | smoke.mjs:937-940 |
| L18 | Pick Close others | Other tabs close, the pinned tab and this one stay | smoke.mjs:950-953 |
| L19 | Pick Copy path, Save, Pin, Close | Each acts on that tab and shows a toast where it has one | none |
| L20 | Press ⇧F10 or the ContextMenu key on a focused tab | The tab menu opens under the tab | none |
| L21 | Press Esc | The menu closes | pressed at smoke.mjs:941, waited on but not asserted |
| L22 | Click elsewhere | The menu closes | none |
| L23 | Click the All tabs button, or press `g a` | A menu names every tab, with digits 1 to 9, the current one marked | smoke.mjs:1129-1133 (count only) |
| L24 | Pick a tab in the All tabs list | The page goes to that tab | none |
| L25 | Use ↑ ↓ and Enter in either menu | A highlight moves, Enter picks | none |

### Item menu (`#fe-ctx`)

| id | what the user does | what happens today | covered by |
|---|---|---|---|
| L26 | Right-click a row or tile | A menu opens at the pointer: Preview, Copy path, Copy name, Open in terminal | coherence-census.mjs:104-108 (looks only) |
| L27 | Right-click inside a multi-selection | The menu offers Copy N paths and Copy N names | none |
| L28 | Press `x` or ⇧F10 on the lead row | The menu opens by the row with the first item marked | keys-walk.mjs:63-66 |
| L29 | Press ↓ in the menu | The highlight moves | keys-walk.mjs:67-69 |
| L30 | Press Esc | The menu closes | keys-walk.mjs:70-71 |
| L31 | Click elsewhere | The menu closes | none |
| L32 | Pick any item | The action runs, the menu closes | none |
| L33 | Press other listing keys while it is open | They do nothing until it closes | none |

### Note row menu (`#fe-nt-ctx`) and props menu (`.fe-pmenu`)

| id | what the user does | what happens today | covered by |
|---|---|---|---|
| L34 | Right-click a note row | A menu lists Open, tab, Rename, Colour pin and tags, Copy path, Copy title, Move to .trash, each with an icon | notes-ergonomics-walk.mjs:62-67 |
| L35 | Pick Rename | The row goes into rename | notes-rename-walk.mjs:40-42, notes-ergonomics-walk.mjs:67 |
| L36 | Pick the other items | Each acts on the note | none |
| L37 | Press Esc or click elsewhere | The menu closes | none |
| L38 | Click the colour chip in the editor | A props menu opens under it with the tag box focused | notes-props-walk.mjs:101-106 |
| L39 | Pick a colour, add a tag, press Enter | Only that line of the note's header changes | notes-props-walk.mjs:105-117 |
| L40 | Click the props button on a sidebar row | The props menu opens there | notes-props-walk.mjs:146-149 |
| L41 | Pick a colour or pin | The note changes, a pinned note moves to the top | notes-props-walk.mjs:149-158 |
| L42 | Press Esc | The menu closes | pressed at notes-props-walk.mjs:109 |
| L43 | Click outside it | The menu closes | none |
| L44 | Open a preview | An open props menu closes | none |

### Saved card (`#fe-sv-card`)

| id | what the user does | what happens today | covered by |
|---|---|---|---|
| L45 | Rest the pointer on a Saved row | After 450 ms a card shows the path and tags, beside the sidebar | none |
| L46 | Move to another row | The card swaps after 120 ms | none |
| L47 | Leave the list, scroll, click, or start a drag | The card goes away | none |
| L48 | Point at a row being renamed or dragged | No card | none |

### Settings parts (`.fe-dd-list`, `.fe-rule-pop`)

| id | what the user does | what happens today | covered by |
|---|---|---|---|
| L49 | Click a dropdown button | A list opens under it, current value marked | search.mjs:33-34, owner-batch-1020.mjs:19 |
| L50 | Press ↓ on a focused dropdown button | The list opens | settings-walk.mjs:54-57 |
| L51 | Press ↓ and Enter in the list | The value changes, the list closes, Settings stays open | settings-walk.mjs:59-66 |
| L52 | Press Home, End, or type a letter | The highlight jumps | none |
| L53 | Press Esc | The list closes, focus returns to the button, Settings stays | none |
| L54 | Press Tab | The list closes and focus moves on | none |
| L55 | Click outside, or the button again | The list closes | none |
| L56 | Open a list near the bottom edge | It opens upward | none |
| L57 | Click an icon in the rules list | The designer opens, the selected glyph focused | settings-walk.mjs:78-80 |
| L58 | Click a swatch | The rule colour saves | settings-walk.mjs:82-84 |
| L59 | Press Esc in the designer | It closes, Settings stays | settings-walk.mjs:85-86 |
| L60 | Edit the text or hex box | The rule updates live | none |
| L61 | Click outside, or close Settings | The designer closes | none |

### File page parts (`#fe-allow`, `#fe-cm-add`, `.fe-cm-ac`)

| id | what the user does | what happens today | covered by |
|---|---|---|---|
| L62 | Press Edit on a folder not yet allowed | A popover opens under the button with Cancel, Just this file, Allow folder | edit-walk.mjs:34-41 |
| L63 | Click Cancel | It closes and the page stays in reading mode | edit-walk.mjs:43-44 |
| L64 | Click Allow folder | The popover closes and the editor opens | edit-walk.mjs:48-52, big-edit-walk.mjs:30-31 |
| L65 | Press Esc, or click elsewhere | The popover closes | none |
| L66 | The editor cannot open the file | A red note shows by the button and goes away on a click or after 8 s | none |
| L67 | Select text on a file page | A Comment button appears above the selection | comments-compose-walk.mjs:81-83 |
| L68 | Click the Comment button | A draft starts on that selection | comments-compose-walk.mjs:85 |
| L69 | Clear the selection or scroll the page | The button goes away | none |
| L70 | Type `@` or `#` in a comment | A list of people or tags opens under the box | comments-compose-walk.mjs:97-103 |
| L71 | Type `@cl` | The generic @claude is first | comments-compose-walk.mjs:177-179 |
| L72 | Press ↑ ↓ Enter Tab in the list | The highlight moves, Enter or Tab inserts | none |
| L73 | Press Esc in the list | The list closes, the draft stays; a second Esc cancels the draft | comments-compose-walk.mjs:179-183 |

### Ask history, Go to, palette

| id | what the user does | what happens today | covered by |
|---|---|---|---|
| L74 | Click the history button in Ask | A list of earlier chats opens, the count shown | ask-walk.mjs:53-58 |
| L75 | Click a chat, or its delete button | The chat reopens, or is removed and the count updates | ask-walk.mjs:60-69 |
| L76 | Press Esc, or click elsewhere | The list closes; Esc returns focus to the button | none |
| L77 | Click the path button, or press `l` | A box opens under it with recents offered and the last text kept | round3a-walk.mjs:58-66 |
| L78 | Click away | The box closes and keeps what was typed | round3a-walk.mjs:64-67 |
| L79 | Press Enter on a path | The page goes there | round3a-walk.mjs:68-69 |
| L80 | Enter a path that does not exist | The box says so and stays open | narrow-card-walk.mjs:59-64 |
| L81 | Press Esc, or click the button again | The box closes, focus returns to the button | none |
| L82 | Press ⌘K | A palette opens with commands and places, input focused | keys-walk.mjs:19-25 |
| L83 | Type to filter, press Enter | The best match runs and the palette closes | keys-walk.mjs:26-32 |
| L84 | Press Esc | The palette closes and focus returns to where it was | keys-walk.mjs:36-41 (closing only) |
| L85 | Click the dimmed scrim | The palette closes | none |
| L86 | Press ⌥Enter | The place opens as a background tab | none |
| L87 | Press ⌘K with a menu open | The palette opens over the menu | none |

### Hover and transient parts (`#fe-tip`, `#fe-hint`, `.fe-hints`, `.fe-chord`, `#fe-toast`)

| id | what the user does | what happens today | covered by |
|---|---|---|---|
| L88 | Rest on a row | A tip with name and facts follows the pointer after 300 ms | none (census.mjs only looks, coherence-census.mjs:95-99) |
| L89 | Rest on anything with a title | A label shows after 350 ms, in view, and the title returns on leave | owner-batch-1020.mjs:44-60 |
| L90 | Rest on text that is fully visible | No label | owner-batch-1020.mjs:110-121 |
| L91 | Turn Tooltips off in Settings | No labels, titles stripped | smoke.mjs:728 (via import) |
| L92 | Scroll, click, or press a key | The label hides | none |
| L93 | Hold ⌥ for 450 ms | Key badges show over the controls | keys-walk.mjs:128-134 |
| L94 | Release ⌥, press another key, or click | The badges go | keys-walk.mjs:135 (release only) |
| L95 | Press the first key of a sequence such as `v` | A pill lists the second keys | keys-walk.mjs:44-47 |
| L96 | Press the second key | The command runs and the pill goes | keys-walk.mjs:48-49 |
| L97 | Wait 1.6 s | The pill goes | none |
| L98 | Do something that toasts | A short message shows at the bottom | owner-batch-1020.mjs:143-144, smoke.mjs:775-776 |
| L99 | Click the action on a toast | The action runs (Undo restores a row) and the toast goes | smoke.mjs:1007-1010 |
| L100 | Wait | The toast goes after 2.4 s, or 6 s with an action | none |

### Preview and dialogs (`#fe-qlook`, `.fe-dlg`)

| id | what the user does | what happens today | covered by |
|---|---|---|---|
| L101 | Click a file row, or press Space | A floating preview opens over a dimmed page | smoke.mjs:160 |
| L102 | Press Esc or Space | The preview closes | smoke.mjs:124-126 |
| L103 | Click × or the dimmed scrim | The preview closes | none |
| L104 | Press ↑ ↓ ← → | The preview steps to the next or previous file | none |
| L105 | Press `t`, then Enter | The file keeps as a tab, then the page opens | smoke.mjs:128-135 |
| L106 | Press Tab | Focus cycles inside the preview | none |
| L107 | Close the preview | Focus returns to where it was | none |
| L108 | Drag the corner grip | The window resizes and the size is remembered | smoke.mjs:78, 114-122 |
| L109 | Click the dock button | The preview docks beside the list, width kept after reload | smoke.mjs:83-112 |
| L110 | Click a row while docked | The docked preview follows | smoke.mjs:92-95 |
| L111 | Click Settings or Help, or press `,` or `?` | A dialog opens, the box focused, last tab remembered | smoke.mjs:613-632, 728-736 |
| L112 | Press Esc | The dialog closes | smoke.mjs:655-657 |
| L113 | Click × | The dialog closes | tree-native-files.mjs:41 |
| L114 | Click the dimmed scrim | The dialog closes | none |
| L115 | Press `[` or `]` | The dialog tab changes | none |
| L116 | Press Tab and Shift+Tab | Focus wraps inside the dialog | none |
| L117 | Close the dialog | Focus returns to the opener | none |
| L118 | Pick Keyboard in Settings | Help opens on its Keyboard tab and Settings closes | smoke.mjs:729-736 |
| L119 | Open a dropdown or designer inside Settings | It shows above the dialog | shot only: settings-walk.mjs:56-60 |

## 2. Today's defects the slice could fix (owner decides)

These are not parity rows. Fixing one changes a behaviour, so each needs a
ruling before the slice treats it as changed.

| id | defect today | file in the variant table |
|---|---|---|
| D1 | The path menu's "…" list, loading state and empty state ignore Esc | section C |
| D2 | Esc drops focus to the page body after the path menu closes | section C |
| D3 | A right-click or a ⋯ click leaves other menus open | section C |
| D4 | The tab menu, note menu and sidebar overlay each close on any Esc | section D, item 1 |
| D5 | The note row menu has no keyboard route | section C |
| D6 | The Allow popover leaves old listeners and an unresolved promise | section C |
| D7 | Toast and tooltip likely sit under dialogs and the preview | section C |
| D8 | The completion list stays open on blur and outside click | section C |
| D9 | The All tabs button never toggles closed | section D, item 3 |
| D10 | Most menus stay open and drift away on scroll and resize | section D, items 4 and 5 |

## 3. Counts

- Part 1 has 119 rows.
- 52 rows have no automated coverage (51 marked `none`, plus L88, which only
  has a style census).
- 10 rows are touched by a script that asserts little or nothing about the
  behaviour: L8, L14, L21, L23, L26, L42, L84, L91, L94, L119.
- 57 rows have a real check (119 minus the 62 above).
- Part 2 has 10 defects.

## 4. Where the slice stands

The owner's approved spec already rules the layer contract (Esc closes the
topmost layer only, focus returns to the opener, an anchor press toggles), so
the defects it covers are fixed as part of the slice rather than asked again.

Fixed by the move onto the layer service: D1 (every path menu state takes
Esc), D2 (focus returns to the chevron), D3 (one menu group, opening one
closes the other), D4 (Esc reaches only the topmost layer), D6 (a second Edit
press answers no and leaves nothing behind), D7 (toast, tooltip, row tip,
badges and chord pill rise above whatever opened before them), D9 (the All
tabs button toggles), D10 for scroll (an anchored layer closes when its anchor
moves; resize still closes only the path menu).

On the layer service now: item menu, tab menu and All tabs list, note row
menu, props menu, path menu, dropdown lists, icon designer, Settings and Help,
command palette, Go to, Ask history, Allow popover and cannot-edit note.
Raised above layers without becoming one: toast, title tooltip, row tip, key
badges, chord pill, Saved card.

Changed on purpose: opening the palette while a menu is open now closes the
menu (it loses focus) instead of stacking over it (L87). A second click on the
props or rule-designer anchor closes it instead of reopening it in place.

Left for later in the slice: the floating preview (z-index, its own focus
stack), the narrow sidebar overlay (a dock), the Comment button and the
completion list (D8), and the note row menu's keyboard route (D5, slice 2 with
the action registry).

Checks added: tests/layer.test.ts (Esc order, outside and anchor presses,
group, focus return, page-held parts, scroll), tests/tooltip.test.ts,
e2e/layer-shots.mjs (real-mouse toggle, palette over a menu, tooltip over a
menu, Saved card; dark and light shots), and an Esc-inside-Settings row in
e2e/settings-walk.mjs (L53).
