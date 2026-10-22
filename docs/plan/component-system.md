---
reader: the owner, decision on the system before any code moves; agents building or migrating a surface
---

# Component and behaviour system

<!-- sessions: bfb@2026-10-22 -->

Better File Browser looks and behaves as one app only where a part is shared.
Today the colours, type sizes and motion timings are shared. Almost everything
built from them is made by hand at each place it appears.

This doc specifies the parts every surface is built from, the services every
feature calls, the checks that stop new one-offs, and the order the app moves
onto them. The owner decided the open questions on 2026-10-22 (section 15) and added the items in sections 17 and 18.

It extends `design-system.md`, which stays the reference for colour, type and
markdown reading. Section 4 lists every value this doc changes there; nothing
else in that doc changes.

Second version, after an independent review
(`.claude/output/20261022-1500-system/spec-review.md`, 45 findings). Section 16
maps each finding to where it landed.

## 1. Why: what was measured

Counted from the source on 2026-10-22 (commands in Sources).

| Layer | Shared today | Made by hand |
|---|---|---|
| Colour, type, motion | almost all values are tokens | 4 raw font sizes, 26 raw timings |
| Buttons | 63 of 147 | about 50 other button styles |
| Icon buttons | none | 8 sizes, 4 corner shapes |
| Text boxes | 2 uses of one style | 20 more styles, 5 heights |
| Toolbars and headers | none | 19, each with its own padding and gap |
| Floating layers | a popover skin used by 8 | 20 layers, 13 unrelated z-index values |
| Dialogs | Settings and Help | 3 more built separately; the title style written 3 times |
| Corner radius | | 36 values |
| Keys | a 114-command map with scopes | 49 of those keys answered by raw listeners; 47 listeners in 23 modules |
| Close on click outside | | 24 handlers in 18 modules |
| Saved settings | one storage module | 11 more modules read and write keys directly |
| Navigation | six path and URL helpers in three modules | 18 direct page changes, plus hash, reload and new-window exits |
| Picking a file renderer | a format registry, used by the file page | the preview's own switch |
| Watching a file | | three timers with different rules |
| Errors | three error types with codes | raw messages shown as UI copy in 12 places |
| Accessibility | dialog roles on Settings, Help, palette | no menu roles; no role on the preview, Go to, toasts |
| CSS | | 2,000 lines, a later layer overriding earlier rules |

Two bugs fixed on 2026-10-22 came from that structure. List rows were held at
36px by a rule 800 lines below the one being edited. An unused rule padded
every toggle group in Settings.

## 2. Principles

1. **One part per job.** A job that two parts do is a bug in one of them.
2. **Extend what exists.** The key scopes, the format registry, the popover
   skin, the row tokens, the error codes and the coherence census are seeds,
   not things to replace. No token, scope or registry gets a twin.
3. **Registries, not edits.** A new lens, setting, action, file type, layer
   kind, key scope or tone is a registry entry. If adding one needs edits in
   three files, the contract is wrong.
4. **Reconcile on paper first.** Before a shared part replaces its copies, a
   table shows what each copy does today and what changes. Changed cells need
   the owner's decision.
5. **Done means the copies are gone.** A part is not done until every copy it
   replaces is deleted and a check proves it.
6. **The owner sees the look before it ships.** Any change to what the owner
   sees goes on a before-and-after sheet first.

## 3. The model

```
┌──────────────────────────────────────────────────────┐ ┌──────────────┐
│ Surfaces  path bar · tab strip · listing · lenses    │ │ Services     │
│           preview · file page · editor · comments    │ │              │
│           dialogs · palette · status bar · menus     │ │ actions      │
├──────────────────────────────────────────────────────┤ │ keys, focus  │
│ Composites Toolbar · SectionTitle · Panel · Card     │ │ layers       │
│           Menu · ListRow · Dialog · Tabs · Breadcrumb│ │ store        │
│           EmptyState · Notice · FieldRow · Toast     │ │ navigation   │
├──────────────────────────┬───────────────────────────┤ │ files, host  │
│ Primitives (look)        │ Behaviours (no look)      │ │ renderers    │
│ Icon · Button · Toggle   │ Layer · RovingFocus       │ │ feedback     │
│ Segmented · TextBox      │ Selection · FocusTrap     │ │ copy         │
│ Dropdown · Check · Switch│ Disclosure · HoverCard    │ │ theme, motion│
│ Slider · Chip · Badge    │ Resize · Reorder · Busy   │ │              │
│ Kbd · Skeleton           │                           │ │              │
├──────────────────────────┴───────────────────────────┤ │              │
│ Tokens and categories (sections 4 and 5)             │ │              │
└──────────────────────────────────────────────────────┘ └──────────────┘
```

Each part is a TypeScript module that returns markup (as `controls.ts` does
today), an `upgrade` step that wires it, and one CSS block. No framework.

Allowed calls, so a part cannot reach around the system:

| Layer | May use |
|---|---|
| Tokens | nothing |
| Behaviours | tokens; services keys, focus, layers, theme, motion |
| Primitives | tokens, behaviours, Icon, simpler primitives (a Toggle wraps a Button; a Dropdown holds a TextBox and a Layer); services copy, feedback |
| Composites | primitives, behaviours; services actions, copy, feedback |
| Surfaces | composites; every service |
| Services | other services; never markup |

## 4. Tokens: what exists, what changes

### 4.1 Token map

What happens to each token family. Slice 0 renames or deletes; it never adds a
twin. Surface, text and border tokens (`--bg`, `--s1` to `--s3`, `--tx`,
`--mt`, `--dm`, `--bd`, `--bd2`, `--card`, `--side`, `--ac`) stay as they are,
with values in `design-system.md`.

| Today | In the system | Action |
|---|---|---|
| `--row-h` 32, `--row-r` 8, `--row-px` 10, `--row-gap` 10, `--row-ic` 16, `--row-fs` | same names | keep |
| `--pop-r` 12, `--pop-pad`, `--pop-bg`, `--pop-bd`, `--pop-sh`, `--pop-blur` | same names; the skin of every floating layer | keep, widen to all layers |
| `--r` 6 | `--r-sm` | rename |
| `--act` (accent 18% dark, 14% light) | `--on` | rename; the one "on" wash |
| `--hover`, `--shade`, `--shade2` | same | keep |
| `--on-ac` (text on accent) | `--tx-on-ac` | rename, so it cannot be read as the "on" state |
| `--t-fast`, `--t-base`, `--t-slow`, `--ease` | same | keep; 0ms under reduced motion |
| `--fs-*`, `--ui-text-scale`, `--rd-size` | same | keep |
| raw paddings and gaps | `--sp-1` to `--sp-9` (2, 4, 6, 8, 12, 16, 20, 24, 32) | add (design-system.md already lists the steps) |
| raw control heights | `--ctl-xs` to `--ctl-lg` (section 5.2) | add |
| raw radii | `--r-xs` 4, `--r-sm` (was `--r`), `--row-r` for controls and rows, `--pop-r` for panels and layers, `--r-full` | add `--r-xs` and `--r-full` only |
| no tone colours | `--tone-ok`, `--tone-warn`, `--tone-danger`, `--tone-info` (section 5.7) | add, from the palette's `--nc-*` colours |
| no type roles | `--type-micro`, `--type-small`, `--type-ui`, `--type-ui-strong`, `--type-title` mapped onto `--fs-*` | add (owner row 6) |
| 13 z-index values | layer levels (section 5.4) | add |
| `#f85149`, `#fff` and other raw colours in rules | tone tokens (section 5.7) | replace |
| raw `@media` and container widths | named containers (section 5.9) | replace |

Palettes set only surface, text and accent. Every state and tone colour is
derived with `color-mix`, so a palette cannot break a state.

### 4.2 What this changes in design-system.md

| Value | design-system.md | This doc | Owner decision |
|---|---|---|---|
| Panel and dialog corner | 10px | 12px (`--pop-r`, what the code uses for popovers) | question 4 |
| Control corner | 6px | 8px (`--row-r`, what rows use) | question 4 |
| Toolbar height | 36px | 40px | question 2 |
| Button height | 26px (22 small) | 28px (22 small) | question 2 |
| Dense icon button | 24px | removed; 22 or 28 | question 2 |
| Selected look | soft wash | one wash for on and selected | already decided (Soft round 2) |
| UI text | `ui` 13px, and "14px UI" in the Soft decision | 13px (`--fs-lg`), as the code has | question 5 |
| Row height | "36px rows" in the Soft decision | 32px (`--row-h`), as the code has | question 5 |
| Icon button | a circle, 26px | round, 28px; rounded square inside a group | questions 1, 2 |
| Button sizes | `sm` and md | `xs`, `sm`, `md`, `lg` | question 2 |
| Reduced motion | 0 | 0 (the code sets 1ms today) | none |

When the owner approves the look sheet, `design-system.md` is updated in the
same commit, so the two docs never disagree.

The coherence census (`e2e/coherence-census.mjs`) asserts the row and popover
values; it changes in the same commit as any value above.

## 5. Categories every part shares

### 5.1 Interaction states

| State | Look | Attribute |
|---|---|---|
| rest | text `--mt`, no fill | |
| hover | text `--tx`, fill `--hover` (`--shade2` on a shaded part) | |
| focus-visible | 2px `--ac` ring, 1px offset | |
| pressed | fill `--s3` | |
| on | text `--ac`, fill `--on` | `aria-pressed` or `aria-checked` or `aria-expanded` |
| selected | fill `--on` | `aria-selected`, `data-selected` |
| disabled | 45% opacity, no hover | `aria-disabled` |
| busy | spinner in place of the icon | `aria-busy` |
| done | green check for 3s | `data-done` |
| invalid | `--tone-danger` hairline, message below | `aria-invalid` |

On and selected share one wash, as Soft round 2 asked: "a light bg is often
the best; different and compatible with the hover bg".
No accent line is added for a selected item in a group.

### 5.2 Size scale

| Token | px | For |
|---|---|---|
| `--ctl-xs` | 18 | close and remove inside chips and tabs |
| `--ctl-sm` | 22 | row actions, toggles inside text boxes |
| `--ctl-md` | 28 | toolbar controls, text boxes, dropdowns, segmented groups |
| `--ctl-lg` | 32 | dialog controls, palette and Go to input, rail and lens buttons |
| `--row-h` | 32 | menu items, sidebar rows, dropdown options |
| `--bar-h` | 40 | every toolbar and header bar |

Icons: 12, 14, 16 or 20px. Appendix B lands every control height and icon
size used today on these scales, with the change in pixels, for the owner to
rule on. Listing rows are not on this scale; the Detail slider sets them
(section 5.8).

### 5.3 Shape

`--r-xs` 4 (chips, inline code), `--r-sm` 6 (inside a group), `--row-r` 8
(controls, rows, inner cards), `--pop-r` 12 (panels, dialogs, floating
layers), `--r-full` (icon buttons, pills).

### 5.4 Layer archetypes and stacking

Every floating or overlaid thing is one of eight archetypes. The archetype
decides modality, focus, dismissal, role, backdrop and level, so a new layer
is a registry row, not a new design.

| Archetype | Today | Modal | Focus | Closes on | Role | Base level |
|---|---|---|---|---|---|---|
| region | path bar, tab strip, main, status bar | no | stays | | landmark | 0 |
| dock | docked preview, comments rail, sidebar overlay | no | stays | its close | complementary | 30 |
| float | preview window | yes | moves in, returns | Esc, close | dialog | 400 |
| dialog | Settings, Help, a confirm | yes | trapped, returns | Esc, close, backdrop | dialog | 400 |
| command | palette, Go to | yes | trapped, returns | Esc, outside, pick | dialog | 500 |
| popover | menus, dropdowns, props, allow, rule, crumb, tab menu | no | moves in from keys, returns | Esc, outside, anchor, pick, focus out, scroll | menu or listbox or dialog | 300 |
| hovercard | Saved card, row tip, tooltip | no | never moves | pointer leaves, Esc, drag start | tooltip | 300 |
| transient | toast, key hints, chord pill | no | never moves | timer, Esc | status | 600 |

Stacking: a layer opened from another layer sits one step above its opener
(`opener level + 10`). That keeps Settings, then its dropdown, then the rule
popover in order without a fixed number for each. Tooltips sit at 700, always
on top.

The browser's own top layer (the popover attribute) works on file:// pages:
the slice 0 probe (`e2e/probe-top-layer.mjs`) shows a later popover stacking
above an earlier one and above any z-index. So Layer opens every floating
layer in the top layer, the levels above become order of opening, and z-index
leaves the stylesheet. The level tokens stay only for docks and sticky parts
inside the page.

Esc closes the topmost layer only. One ordered stack replaces the 31 separate
Escape checks.

### 5.5 Content states

One `Resource<T>` type carries a list's or panel's state; EmptyState and the
host render from it, never from a local flag.

| State | Shows |
|---|---|
| idle | nothing yet |
| loading | skeleton bones where content goes; real chrome stays |
| refreshing | the data, plus a quiet "updating" mark |
| streaming | the part that has arrived, and a stop control |
| ready | the data |
| empty | what goes here, and the action that adds it |
| filtered-empty | the filter in words, and Clear |
| partial | the data, and what was left out and why |
| stale | the data, and why it may be out of date (the extension was reloaded) |
| unavailable | what is missing (the notes host) and the one step that installs it |
| failed | what broke, in words from the copy layer, and the retry |

### 5.6 Machine-readable state

Every part instance carries `data-part="Button"` (or its name) and mirrors its
value and state as attributes (`data-value` and the aria attributes in 5.1).
CSS, tests and the census read those, never the script's own variables, which
live in the content script's isolated world.

### 5.7 Tones

One vocabulary: `neutral` (`--mt`), `accent` (`--ac`), `ok` (`--tone-ok`),
`warn` (`--tone-warn`), `danger` (`--tone-danger`), `info` (`--tone-info`).
The four tone tokens are built from the palette's named colours (`--nc-green`,
`--nc-orange`, `--nc-red`, `--nc-blue`), so they follow dark and light; the
raw `#f85149` in two rules goes. Button, Chip, Badge, Toast, Notice, the checker's
error and warning, the AI status dot and the comment due and done chips all
take a tone. A new status picks a tone and a label.

### 5.8 Scale axes

Five settings change sizes. Each says what it scales and what it never
touches.

| Axis | Setting | Scales | Never touches |
|---|---|---|---|
| Interface size | Settings, Look | the whole tab (Chrome zoom) | |
| Text size | `--ui-text-scale` | UI type steps | reading text |
| Reader size | `--rd-size` | markdown and file text | UI chrome |
| Density (compact, default, spacious) | Settings, Look | every control and row, one step | reading text |
| Detail | the toolbar slider | listing rows, tiles and what they show | everything outside the listing |

### 5.9 Containers

Composites collapse by their container, not the window. Named containers:
`fe-main`, `lens`, `dialog`, `panel`. Each composite states its collapse rule
(overflow menu, icon only, or hidden) in its contract. CSS cannot read a
custom property inside a container condition, so the widths are a short fixed
list (narrow 480, medium 720, wide 1100) that the source check enforces.

### 5.10 Roles and announcements

| Part | Role and name | Announces |
|---|---|---|
| Menu | `menu`, items `menuitem` | |
| Dropdown list | `listbox`, options `option` | |
| Dialog, float, command | `dialog`, `aria-modal`, named by its title | |
| Tabs | `tablist`, `tab`, `tabpanel` | |
| Toast | `status` | polite |
| Notice (error) | `alert` | assertive |
| Count Badge | | polite on change |
| IconButton | name from its label | |
| ListRow | `option` or `row`, `aria-selected` | |

The census fails when an instance lacks its role or name.

### 5.11 Copy and voice

Every user-facing string lives in `copy.ts`, keyed by id and by error code:
empty states, errors, tooltips, toasts, confirmations. Key mentions are drawn
from the key map, never typed, so a rebind cannot leave old words behind.
Voice rules in one place: sentence case, no period on titles, "Could not ..."
for a failure, the next step for an empty state. Translation later costs a
lookup, not a hunt.

## 6. Primitives

Options and keys below. Each part also gets a full contract file before its
slice (section 13.1). Appendix A lists what each replaces.

| Primitive | Options | Keys |
|---|---|---|
| **Icon** | name; size 12, 14, 16, 20 | |
| **Button** | label, icon, variant (plain, shade, outline, solid), tone, size | Enter, Space |
| **IconButton** | icon, required label, variant, size, shape | Enter, Space |
| **Toggle** | a Button or IconButton that stays on | Space |
| **Segmented** | options with icon or label; one chosen | arrows, Home, End |
| **TextBox** | leading icon, placeholder, trailing slot, size, multiline | Esc clears, then leaves |
| **Dropdown** | Item options; one or many; search when long | arrows, type to jump, Enter, Esc |
| **Check**, **Switch** | label; Check can be mixed | Space |
| **Slider** | named stops | arrows, Home, End |
| **Chip** | label, tone or tag colour, removable | Backspace removes |
| **Badge** | count or dot, tone | |
| **Kbd** | a key from the key map | |
| **Skeleton** | bone shape | |

Switch may wrap a native checkbox. A markdown task-list checkbox is content,
not a control, and stays native.

## 7. Behaviours

| Behaviour | Does |
|---|---|
| **Layer** | opens any archetype in 5.4 against an anchor; places, stacks, dismisses, moves and returns focus, sets aria; reports why it closed |
| **RovingFocus** | arrows move within a group; Home, End jump; one Tab stop |
| **Selection** | single, multiple, range from an anchor; survives a re-render; separate from the focused item |
| **FocusTrap** | Tab stays inside a modal layer; focus returns on close |
| **Disclosure** | open and close with the fold motion; remembers its state |
| **HoverCard** | open and close delays, a safe path to the card, never during a drag, focus opens it too |
| **Resize** | drag an edge, or arrows on a focused handle; remembers size; double-click resets |
| **Reorder** | drag to reorder; Alt+arrows from the keyboard |
| **Busy** | marks a control busy while work runs, then shows done |

Layer replaces the 24 outside-click handlers and most Escape checks.
HoverCard covers the tooltip, the row tip and the Saved card, which open on
hover and must not take focus.

## 8. Composites

| Composite | Anatomy | Used by |
|---|---|---|
| **Toolbar** | groups of Actions, separators, optional title or count; `--bar-h`, `--ctl-md`, 4px in a group, 12px between | listing toolbar, file bar, preview header, editor bar, image and HTML bars, code block bar, comments tools, lens tools |
| **SectionTitle** | icon tile, title, subtitle, actions | dialog headers, lens titles, panel headers, Settings groups, contents rail |
| **Panel** | SectionTitle, scrolling body, optional footer; float or dock | preview, comments, Ask |
| **Card** | a bounded group inside a panel | Settings cards, AI status, comment threads |
| **Menu** | Items, separators, group labels, checks, submenus; on Layer | context, tab, props and crumb menus, All tabs |
| **ListRow** | an Item: icon, label, secondary, meta, actions on hover and focus | sidebar rows, results, docs, dropdown options |
| **Dialog** | SectionTitle, optional side Tabs, body, footer actions | Settings, Help, confirm; palette and Go to as compact |
| **Tabs** | tabs with close, pin, overflow Menu, kept and unkept looks | tab strip, dialog side tabs, lens rail |
| **Breadcrumb** | segments, collapsed middle, a Menu per segment, edit mode | path bar |
| **EmptyState** | icon, one line, one action, from a Resource state | every list and panel |
| **Notice** | tone, message, action, dismiss | conflict, checker results, preview notes, stale page |
| **FieldRow** | label, help line, control | Settings, filter bar, sort panel |
| **Toast** | message, one action, tone; a transient Layer | everywhere, through the feedback service |

ListRow states its height token and never wraps. A windowed list may measure
rows but never guesses their height.

## 9. Services

### 9.1 Actions

One definition feeds the button, the menu item, the palette entry, the key and
Help.

```
Action { id, title, icon, keys[], scope, when(), run(), tone?,
         group, surfaces[], confirm?, result: toast | busy-done | none }
```

A Toolbar renders the actions marked for it; a Menu renders its own; the
palette lists all; Help reads the keys. Disabled state and the tooltip with
its key come free. This replaces parallel lists: the 114 key map entries, the
`bind()` calls, four palette sources, hand-written button titles and the
context-menu builders.

### 9.2 Keys and focus areas

Extends what exists. `keymap.ts` keeps its `Scope` list, `commands.ts` keeps
`dispatch()`. Changes:

1. Scopes become a registry: `{id, active(), passes[]}`. `popover` and `text`
   join the existing ten.
2. The `own` flag goes. Every key is an Action with a `run`; the 49 keys
   surfaces answer with raw listeners move one by one. Slice 2's parity list
   has a row for each, naming the module that answers it today.
3. The hard-coded list of keys that work over the preview becomes each
   Action's `passes`.
4. Field-level listeners on an input or textarea (editor, find, text window)
   stay; they claim only keys the map gives their scope.

Focus areas (the area-switch key) declare themselves: element, name, RovingFocus group.

### 9.3 Store

One typed store over `kv.ts`. Each key declares:

- **scope:** `profile` (chrome.storage, every tab), `tab` (sessionStorage with
  a recovery copy, as the strip does), or `mirror` (localStorage, for pages
  the extension cannot reach);
- schema, default, version and a migration;
- `exportable`, for Settings export and import;
- `ui`: group, label, help, control, keywords.

Settings rows, the palette's "toggle" entries, export, import and reset are
generated from that. `subscribe` reports changes from other tabs; whether it
also reports this page's own writes is a per-key choice. `remember(key,
scope)` covers fold states, sizes, scroll and last tab.

### 9.4 Navigation

```
go(target, how, { hash?, line?, anchor? })
how: here | chrome-tab | keep-tab | preview | page
```

It owns the URL, the strip, recents and the hash. The hash has one grammar and
one parser: `find`, `view`, `c` (a comment), `comments`, and heading ids. One
`FilePath` type holds the path model behind today's six helpers.

The renderers hard-code `/Users/alcatraz627` as the home folder in four
places. Navigation gets the home folder from the path model instead.

### 9.5 Files and host

One file service: `read`, `meta`, `watch`, `write`. `watch(path, {pause?})`
uses a change token (modified time, or a hash when that is missing), runs one
timer per file, pauses while the tab is hidden and while any subscriber's
`pause()` is true, and reports "not watching" as a state. The three timers
(file page, editor, comments companion) become subscribers.

One host service: `host.call(kind, payload)` and `host.stream(kind,
payload)`, each returning a Resource with an `AppError` on failure. It covers
every way the page reaches outside itself today:

| Kind | Does |
|---|---|
| `bfb-fetch` | read a file through the worker |
| `bfb-native-oneshot` | one request to the notes host |
| `bfb-fetch-image` | read an image for copying |
| `bfb-zoom` | set the tab's zoom |
| `bfb-app-icon` | set the toolbar icon |
| model port | stream an Ask answer |
| terminal | open a folder in the terminal app |
| open natively | open a file in its default app |

### 9.6 Renderers

`formats.ts` is the seed: it already pairs a rich view with a checker per
format, and the file page uses it. The preview gets onto it. Each renderer
declares:

```
Renderer { id, match(ext, sniff), rich, raw?, check?, meta?,
           actions[], largeFilePolicy, hosts: { preview?, page?, note?, ask?, help? } }
```

Today the preview and the file page differ in two places. The registry keeps
each as a host setting, and the parity list for slice 8 asks the owner about
both:

| Kind | Preview | File page |
|---|---|---|
| HTML | live page with a Source toggle | source |
| Relative and in-page markdown links | open in a new tab | open here (web links open a new tab on both) |

Both restore the scroll position. Notes, Ask answers and Help render only
markdown today, through the same renderer with no host differences.

A conformance walk renders one fixture of each kind in every host.

### 9.7 Feedback and errors

`AppError { code, context }`. These codes exist today and keep their names:

| Code | Raised by | State | Recovery |
|---|---|---|---|
| `read-failed` | file read | failed | retry |
| `context-invalidated` | file read after an extension reload | stale | refresh the page |
| `unavailable` | notes host, model host | unavailable | the install step |
| `notes_conflict` | a save after the file changed | failed | review the change |
| `disconnected` | model port | failed | retry |
| `cancelled` | a stopped request | none | none |
| `server_down`, `model_missing`, `ctx_too_large`, `timeout`, `invalid_args`, `host_no_lm`, `gemini_unavailable` | model host | failed or unavailable | each has its words in `llm.ts` today |

Two failures have no code yet and get one, because the UI words depend on
them. (The notes host's "not installed" text, written twice today, becomes the
copy for `unavailable`.)

| New code | Today | Recovery |
|---|---|---|
| `match-timeout` | a plain error "Text matching timed out" and "Name regex timed out" | narrow the search |
| `write-failed` | a save error shown as its raw message | retry |

Checker findings are not errors; they are `Diagnostic` lists shown as Notices.
Editing outside an allowed folder is a question (the allow popover), not an
error.

Words come from the copy layer by code. `run(action)` wraps busy, done, a
toast with undo and the error words, so no module writes `toast(err.message)`.

### 9.8 Theme and motion

`theme.ts` and `motion.ts` stay. Under reduced motion every `--t-*` token is
0ms in the token block, and the five per-rule overrides are deleted.

### 9.9 Registries

Each of these is one list that the rest of the app reads:

| Registry | Entry | Read by |
|---|---|---|
| Actions | 9.1 | toolbars, menus, palette, keys, Help |
| Lenses | id, icon, title, subtitle, key, tools, render, empty, palette source | rail, keys, Help, palette |
| Settings | 9.3 | Settings page, palette, export |
| Renderers | 9.6 | preview, file page, notes, Ask, Help |
| Layer kinds | 5.4 | Layer |
| Scopes | 9.2 | dispatch |
| Tones | 5.7 | every part with a tone |
| Items | an entity presented as an Item | ListRow, Menu, Dropdown, palette |

## 10. The Item shape

```
Item { icon, label, secondary, meta, keys, actions[], checked,
       disabled, tone, children?, entity? }
```

ListRow, Menu, Dropdown options, palette results and the tab menu all take an
Item. Each entity (folder entry, saved place, note, thread, recent, document,
tab) has one presenter that turns it into an Item. Today they are seven
unrelated shapes.

## 11. Surfaces, as compositions

| Surface | Made of |
|---|---|
| Path bar | Toolbar, Breadcrumb, TextBox in edit mode |
| Tab strip | Tabs, Menu (tab menu, All tabs) |
| Listing toolbar | Toolbar of Actions; Sort opens a popover panel; Toggles; Slider; Segmented; TextBox |
| Sort panel, filter bar | FieldRows of Dropdown, Segmented, TextBox with Toggle chips, Buttons |
| Listing views | ListRow, tile cards, Selection, windowing; EmptyState |
| Row tip | HoverCard |
| Status bar | region Toolbar with file facts (one FileMeta component, owner row 25) |
| Context menus | Menu |
| Sidebar rail and lenses | Tabs (rail), SectionTitle, TextBox, ListRow, Disclosure, EmptyState |
| Saved card | HoverCard |
| Search and Ask lenses | TextBox, Dropdown (model), Resource with streaming, Cards |
| Preview | float or dock Panel, Toolbar, Resize, renderer host `preview` |
| Note editor in the preview | Panel, Toolbar, editor, Notice for conflicts |
| File page | Toolbar, renderer host `page`, contents rail Panel with ListRows, Find |
| Checker strip | Notice per finding |
| Find in file | TextBox with a count Badge; highlight tokens |
| Editor | Toolbar, floating pill Toolbar, Notice |
| Comments | Panel, Card per thread, TextBox, Chip, autocomplete Menu, highlight tokens |
| Settings, Help | Dialog with side Tabs, Cards, generated FieldRows |
| Help keyboard map | Kbd, ListRow, from the Actions registry |
| Palette, Go to | command Layer, TextBox, ListRows of Items |
| Key hints, chord | transient Layer, Kbd |
| Toasts, tooltips | Toast, HoverCard |
| Recents landing | ListRow, EmptyState |
| Tables (CSV, markdown) | Resize on headers |

Highlights (find match, current match, comment, active comment) get tokens.
Slice 0 checks that the highlight API accepts custom properties in this
Chrome.

## 12. Glossary

"Hint" means five different things in today's class names. During each slice
the classes take these names:

| Word | Means | Today |
|---|---|---|
| tooltip | a label on hover | `#fe-hint` |
| row tip | a file's facts on hover over a row | `#fe-tip` |
| hover card | a rich card on hover (Saved) | `#fe-sv-card` |
| key hints | key badges while ⌥ is held | `.fe-hints` |
| empty text | the line inside an EmptyState | `.fe-hint` |
| notice | a message in a page or panel | `.fe-ql-note`, `.fe-diag` |

## 13. Gates

The versable-builder kit's retrospective found 28 lapses in five families. Each
gate below answers one.

### 13.1 Before a slice starts (families 1, 2, 4)

1. **Contract files.** Each part in the slice gets `docs/system/<part>.md`:
   when to reach for it, the contract, how it collapses when narrow, sanctioned and banned combinations,
   "before you adopt this" questions, what it travels with, a snippet, and what
   it replaces. The banned combinations feed the source check.
2. **Variant table.** Every copy the slice replaces, one row each, with what
   it does today: for layers, how it opens, closes, takes and returns focus,
   its role, level and scroll behaviour. Changed cells are flagged for the
   owner. Found by searching for the shape (listeners, fixed positioning,
   created elements, inline styles), not by class name.
3. **Parity list.** `docs/plan/parity/NN-<slice>.md`: one row per surface,
   control, key, state and error the slice touches, each marked kept, changed
   (owner decided) or removed (owner decided). No owner-reviewed surface is
   removed without a row. Each kept row also becomes a task, "check that it
   still works", on the slice's task list.
4. **Look sign-off.** The before-and-after sheet for anything the owner will
   see differently, on one decision page.

### 13.2 While building (family 3)

1. **Source check with a ratchet.** `e2e/check-system.mjs` counts violations
   per rule; slice 0 commits the counts; the check fails if any count rises,
   and each slice must lower its rows to zero. Rules:
   - raw px for radius, height, padding, gap, z-index, font size or duration;
   - raw colours outside the token block;
   - raw `@media` or container widths;
   - `!important` and inline `style=` in markup;
   - a `keydown` listener that is not field-level (the Layer service registers its Esc through the `menu` scope, so slice 1 adds none);
   - a `mousedown` or `pointerdown` listener used to close something (drag handles are exempt);
   - `location`, `history.*State`, `window.open` or `target="_blank"` outside
     navigation and the renderers;
   - a storage call outside the store;
   - a native select or checkbox outside Switch and rendered markdown;
   - a selector defined twice in the same media and theme scope;
   - anything Appendix A says a finished part replaced.
2. **Each rule has a planted violation** in `e2e/fixtures/system-violations/`
   that turns it red; the check runs on those first.
3. **Census.** `census.mjs` and `coherence-census.mjs` merge into one: every
   instance has `data-part`, a role and a name; every size is on a scale; one
   "on" look per toolbar; every state change has a transition (owner row 15). It opens
   every layer kind with a script and forces hover, focus, pressed and disabled
   states, so section 5.1 is measured.
4. **Gallery.** A page that shows every part in every state, both themes, each
   size, built from the same CSS module the content script injects, exposed in
   the manifest, never a `_` file at the root.

### 13.3 Before a slice is done (family 5)

| Check | Command | Read |
|---|---|---|
| unit tests | `npx vitest run` | the pass line |
| source check | `node e2e/check-system.mjs` | counts at or below the ratchet; slice rows at 0 |
| census | `node e2e/census.mjs` | no failures |
| smoke | `node e2e/smoke.mjs` | "all checks passed" |
| the slice's walks | named per slice in 14 | their pass lines |
| extension root | `ls -a` | no `_` files |
| screenshots | the slice's shots, dark and light, narrow, Compact, reduced motion | read back, paths in the commit |
| parity list | each row | ticked with a shot or a walk line |

Anything that cannot be driven is written UNCONFIRMED, never ticked.

## 14. Migration order

| # | Slice | Builds | Moves | Walks | Done when |
|---|---|---|---|---|---|
| 0 | Foundations | token map, scales, tones, archetype table, copy file, `data-part`, source check with ratchet, merged census, gallery; top-layer and highlight probes | nothing visible | smoke | baseline counts committed; gallery renders; look sheet decided |
| 1 | Layers | Layer, Dismiss, RovingFocus, FocusTrap, HoverCard, Menu (reusing today's menu item rule) | the 20 layers | keys, palette, path bar, comments walks | outside-click handlers 0; one Esc stack |
| 2 | Actions | Actions, key scopes, focus-area registry | the 49 raw keys, palette sources, context menus | keys, palette, help walks | non-field keydown listeners 0 |
| 3 | Buttons | Icon, Button, IconButton, Toggle, Busy | every button | census | no button class outside the parts |
| 4 | Inputs | TextBox, Dropdown, Check, Switch, Chip, Badge, Segmented, Slider | filter bar, filters, Go to, palette, Settings, comment box | search.mjs, settings walk | no native select; one height per size |
| 5 | Bars | Toolbar, SectionTitle, Notice | 19 bars and headers, the status bar | narrow-pane, zoom walks | one bar height, gap, padding and control size (owner row 5) |
| 6 | Panels | Panel, Card, Dialog, Resize | preview, comments, Ask, Settings, Help | narrow-pane, narrow-card, help walks | dialog title written once |
| 7 | Lists | Item, ListRow, Selection, Reorder, Disclosure, EmptyState, Resource | lenses, listing, results, docs | big-folder, long-file, columns, notes walks | one selected and hover look; windowing intact |
| 8 | Services | store, navigation, files, host, renderers, errors | every module that reads keys, navigates, renders, polls or shows an error | formats, edit, comments walks | storage, navigation and message-text rows 0; one watcher; one renderer path |
| 9 | Cleanup | | the override layer | all | one rule per selector; ratchet at 0 everywhere |

Layers come first: they cause the most repeated bugs (menus that stay open,
focus that is not returned, stacking). Actions come second because Toolbar
and Menu render Actions. Each slice reuses the old CSS of a later part under
the new name until that part's slice absorbs it.

## 15. Owner decisions, 2026-10-22

Answered on the decision page on 2026-10-22: every recommendation taken, plus
the print sheet.

1. **Icon buttons:** round on their own; rounded square inside a Segmented
   group and the rail.
2. **Heights:** 40px bars, 28px controls, the 24px dense size removed.
3. **Density:** three settings instead of the Compact switch: compact,
   default, spacious. Each scales every control and row by one step.
4. **Corners:** 8px for controls and rows, 12px for panels and layers.
5. **UI text:** 13px.
6. **Palette over dialogs:** kept. The owner added: every palette entry gets
   an icon, and the palette gets tabs (section 17).
7. **Firefox:** Chrome first. Firefox gets "decent parity for minimal effort or
   maintenance": features may be cut there, but nothing Chrome-only is built
   without a Firefox fallback or a stated cut.
8. **Print:** add a print sheet for markdown and code pages.
9. **Gallery:** yes, as the design-system page in section 17.

Already decided before the page: on and selected share one soft wash with no
accent line (Soft round 2).

## 16. The review

An independent review found 52 issues in the first version. Each is
answered in this version; the ledger in
`.claude/specs/component-system-ledger.md` traces every finding to its
section.

## 17. Added by the owner with the decisions

Owner's words are quoted; each item names its parts and slice.

| Asked for | In the system | Slice |
|---|---|---|
| "A page for the design system showing primitives / composites / patterns / variants" | the gallery becomes a browsable design-system page, built from the real parts | 0, grows each slice |
| Palette: an icon for every entry; tabs for history, notes, saved, recent, actions, comments, chats | palette sources become Item providers with an icon and a tab; tabs are a Segmented row in the command layer; the Actions registry feeds the actions tab | 2 |
| Help: "some form of reading material ... minimal and a bit flashy" | a short guide in Help, one card per journey (section 18), each with its keys | 6 |
| Settings preview: a "silhouette" of the app; hovering a setting highlights where it applies, and the reverse; changing it changes the preview | each Settings schema entry names the regions it affects; a silhouette panel in Settings draws those regions and re-renders on change | 6 (needs the store, slice 8, for live values; ships with today's settings first) |
| Modal size inside the modal: xl (95%), lg (75%), md (today) | a size control in the Dialog and float title bar, remembered per dialog | 6 |
| Opening the preview collapses the sidebar; closing restores it; a setting turns this off | a store setting read by the preview Panel and the sidebar | 6 |
| Tooltips: icon and title, a lighter short subtitle, and the keys drawn below | the HoverCard tooltip takes `{icon, title, subtitle, keys}` from the Action; plain text tips stay for content | 1 |
| Every capability by keyboard, with the keys shown in the UI | section 18 | 2, then every slice |

Added later the same day (owner feedback, 2026-10-22):

| Asked for | In the system | Slice |
|---|---|---|
| Front matter that fails to parse: "parse this as properly as we can", show the warning inside the front-matter box, link `related` paths when they resolve | a lenient front-matter reader with the error as a row of the box; path-shaped values become file links | 7 (renderers) |
| The editor's error line: "a hover warn tooltip with proper text (not too dense, terse and formatted)" | the rich tooltip on the error gutter | 1 pattern, used in 7 |
| Notes stay compatible with Switchboard and csync "across all platforms" | a compatibility check of the note format against both readers | before 8 |
| Save and Open in terminal also "in other places where we place file/folder related actions" | both become Actions shown in every file and folder action surface | 2 |
| Comment instructions for agents: reconcile comment locations after moves, with basic tools; best effort, and the person can move a comment too | the agent guide and a small re-anchor tool; a move control on a comment | 9 |
| One drag-handle behaviour like the left sidebar's for table columns and the right pane; drag a column from any cell; better initial column widths | one ResizeHandle primitive; column edges active down the whole column; a width heuristic from content | 3 |
| Settings and Help can also open as a sidebar pane; the modal stays | one content source shown either as a dialog or as a sidebar lens | 6 |

## 18. Keyboard journeys

The owner: "I neither see enough shortcuts shown in the UI to quickly learn nor
do I think this kind of a workflow is possible. Same for ALL capabilities ...
ALL WITH keyboard."

A capability counts as reachable only when a whole journey through it works
without the mouse and every step shows its key where the eye already is. Each
journey becomes an e2e walk that drives keys only, and runs in every slice from
slice 2 on.

| Journey | Steps |
|---|---|
| Preview and sidebar | open a file's preview; switch it between float and dock; close it; open and close the sidebar |
| Saved by tag | go to a sidebar lens; pick a tag; move to the search box and type; clear the tag; open a file in the preview, in a new tab, and as a strip tab |
| Tabs and back | open files from the sidebar, the listing and Go to; switch strip tabs; return focus to the sidebar where it was |
| Path picker | open Go to; type or paste a path; open it here or as a tab |
| Comments | go to a document; read its threads; add a comment on selected text; reply; resolve |
| AI chat | ask about one file; start a chat on another file; quote a paragraph from the first chat into the second |
| Notes | create, edit, rename, tag, delete a note |
| Settings | open a section; change a value; see it apply |

Rules that make the journeys possible:

1. Every Action has a key or is reachable from the palette; the palette shows
   the key next to every entry.
2. Every focusable area (sidebar lenses, the lens search, tag chips, the
   listing, strip tabs, the preview, the comments rail, the Ask chat) is a
   focus area or a RovingFocus group, so arrows and one key reach it.
3. Focus returns to where it came from when a layer closes and when the user
   switches area and back.
4. Keys are shown three ways: in the rich tooltip, as hints while the hint key
   is held, and in the palette. Help's keyboard map reads the same list.
5. The journeys are written as parity rows before slice 2; any step that
   needs a new key is an Action added in that slice.

## Appendix A: what each part replaces

A part is done when every copy it replaces is gone. The full list of
class names, functions and search patterns is in
`.claude/specs/component-system-ledger.md`; the source check reads it.

| Part | Copies today |
|---|---|
| Icon | 22 in 8 modules |
| Button | 63 buttons |
| IconButton | 14 classes |
| Toggle | 3 |
| Segmented | 3 |
| TextBox | 15 |
| Dropdown | 3 |
| Check, Switch | 7 |
| Slider | 1 |
| Chip | 6 |
| Badge | 3 |
| Kbd | 3 |
| Skeleton | 8 |
| Layer | 20 layers |
| Dismiss | 24 |
| RovingFocus | 4 |
| Selection | 3 |
| FocusTrap | 3 |
| Disclosure | per caller |
| HoverCard | 3 |
| Resize | 5 |
| Reorder | 2 |
| Busy | per caller |
| Toolbar | 14 |
| SectionTitle | 7 |
| Panel, Card | 5 |
| Dialog | 3 |
| Tabs | 3 |
| Breadcrumb | 1 |
| EmptyState | 12 |
| Notice | 4 |
| FieldRow | 2 |
| ListRow | 11 |
| Actions, keys | 49 keys |
| Store | 11 modules |
| Navigation | 18 + others |
| Files | 3 |
| Host | 6 |
| Renderers | 1 |
| Errors | 12 |

## Appendix B: where today's sizes land

Heights in px. The owner rules on this table, not on the abstract scale.

| Control | Today | Lands on | Change |
|---|---|---|---|
| toolbar and file-bar buttons | 26 | `--ctl-md` 28 | +2 |
| small buttons | 22 | `--ctl-sm` 22 | 0 |
| view switcher buttons | 24 | `--ctl-md` 28 group | +4 |
| filter-bar text boxes, dropdowns | 28 | `--ctl-md` 28 | 0 |
| sidebar filter, Go to, Settings inputs | 30 | `--ctl-lg` 32 | +2 |
| Settings dropdowns | 32 | `--ctl-lg` 32 | 0 |
| Help key-map search | 34 | `--ctl-lg` 32 | -2 |
| rail and lens buttons | 30 | `--ctl-lg` 32 | +2 |
| Ask buttons, `.fe-ibtn` | 28 | `--ctl-md` 28 | 0 |
| comment buttons | 24 | `--ctl-sm` 22 | -2 |
| row action buttons | 22 | `--ctl-sm` 22 | 0 |
| dialog close | 26 | `--ctl-md` 28 | +2 |
| `.*` and `Aa` chips | 20 | `--ctl-sm` 22 | +2 |
| tab close and more | 18 | `--ctl-xs` 18 | 0 |
| comment remove | 14 | `--ctl-xs` 18 | +4 |
| path edit box | 26 | `--ctl-md` 28 | +2 |
| tree toggle | 20 | `--ctl-sm` 22 | +2 |
| Settings buttons (`.fe-pbn` in the pane) | 30 | `--ctl-lg` 32 | +2 |
| Settings group header buttons | 24 | `--ctl-sm` 22 | -2 |
| sort and filter panel toggles | 24 inside a 28 group | `--ctl-md` 28 group | 0 |
| tool-lens inputs (`.fe-tl-input`) | about 30 | `--ctl-lg` 32 | +2 |
| own-comment buttons | 20 | `--ctl-sm` 22 | +2 |

Icon sizes:

| Where | Today | Lands on | Change |
|---|---|---|---|
| toolbar and file-bar icons | 13 | 14 | +1 |
| `.fe-ibtn`, Ask buttons | 15 | 16 | +1 |
| rail, lens buttons, sidebar rows | 16 | 16 | 0 |
| sidebar place icons | 19 | 20 | +1 |
| comment buttons | 13 | 12 | -1 |
| own-comment and filter-bar buttons | 12 | 12 | 0 |
| comment remove | 9 | 12 | +3 |
| chip and count icons | 11 | 12 | +1 |

## Appendix C: the owner's acceptance rows

From `20261020-consistency-pass.md`. Each row names the part, the gate line
and the slice.

| Owner row | Asks for | Part | Gate | Slice |
|---|---|---|---|---|
| 1 | Cmd+F keeps the list in place | Find, Panel dock | probe-cmdf | 6 |
| 2 | tooltips on icon buttons | IconButton, HoverCard | census name rule | 3 |
| 3 | better icons | Icon | look sheet | 0, 3 |
| 4 | one button with variants; round icon buttons | Button, IconButton | census | 3 |
| 5 | one toolbar height, gap, padding, control size | Toolbar | census | 5 |
| 6 | every text node has a type role | tokens | source check font-size rule | 0 |
| 7 | find in file | Find | contents-find walk | 6 |
| 8 | AI chat | Panel, Resource streaming | ask walk | 7 |
| 9 | one sidebar section | SectionTitle (lens title, per the rail decision) | census | 5 |
| 10 | path bar | Breadcrumb | path-bar walk | 5 |
| 11 | default sort | Store | settings walk | 8 |
| 12 | tab restore from History | Tabs, Store `tab` scope | smoke | 8 |
| 13 | deep search progress and cancel | Resource partial, Busy | search.mjs | 7 |
| 14 | everything consistent | all | all | 9 |
| 15 | transitions on every state change | tokens, census | census transition rule | 0 |
| 16 | code block surface and copy | Toolbar (code bar), Busy done | markdown-polish | 5 |
| 17 | inline code colour | tokens | look sheet | 0 |
| 18 | the grey ramp | tokens | look sheet | 0 |
| 19 | strip spacing; no dashed unkept tab | Tabs | look sheet | 5 |
| 20 | status bar size and copy path | Toolbar (status) | census | 5 |
| 21 | contents rail active, tips, smooth scroll | ListRow, HoverCard | contents walk | 7 |
| 22 | icon, title, subtitle pattern | SectionTitle | census | 5 |
| 23 | markdown rhythm | reading CSS (design-system.md) | markdown-polish | outside this doc |
| 24 | heading rules | reading CSS | markdown-polish | outside this doc |
| 25 | one FileMeta component | status bar, preview header | formats walk | 8 |

## Sources

- Inventory, generated 2026-10-22: `.claude/output/20261022-1500-system/inventory.md`.
- Review: `.claude/output/20261022-1500-system/spec-review.md`.
- Counts in section 1: `rg -c "addEventListener\('keydown'" src`, `rg -n "location\.href\s*=" src`,
  the inventory's tables for buttons, inputs, bars, layers and radii.
- Existing seeds: `--row-*` and `--pop-*` at `styles.ts:1280-1284`; `Scope` at
  `keymap.ts:6`; the preview key list in `live()` at `commands.ts:50`;
  `FORMATS` at `formats.ts:218`; `ROW` and `POP` at `coherence-census.mjs:11-12`;
  error codes at `file-fetch.ts:10`, `notes.ts:50-56`, `llm.ts:26`.
- Duplicates: dialog title at `styles.ts:579`, `:1427`, `:1613` (and a narrow
  override at `:1720`); `.fe-chip` at `styles.ts:340` and `:991`; the override
  layer from `styles.ts:1240`.
- Timers: `file-page.ts:477`, `file-editor.ts:475`, `comments-ui.ts:738`.
- Home path literal: `renderers.ts:451`, `:490`, `:540`, `:598-619`.
- Versable-builder lessons, in `~/Code/Versable/versable-builder`:
  `docs/GUIDEBOOK.md` §7, `docs/plan/43-toolkit-rca.md`,
  `docs/plan/62-toolkit-proposals-design.md` §5,
  `packages/ui/docs/KIT-STANDARD.md`.
