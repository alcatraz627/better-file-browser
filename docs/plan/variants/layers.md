---
reader: the owner and the agent building the layers slice
---

# Variant table: floating layers, as they behave today

This is the written-down "before" for the layers slice (component-system.md
13.1, step 2). It says how each floating part opens, closes, takes focus and
stacks right now, so any change after the slice can be flagged against it.
Where the layers disagree is at the end.

Behaviour is described as of the commit before the slice (see Sources). Cells
say `none` when searched and absent, `unknown` when neither found in code nor
exercised. A page change here is always a full page load, so no layer
survives navigation and no layer has route-change code.

How to read the close events: `out-click` is a click on the document
(bubble), which a handler upstream can swallow and which a right-click never
sends. `out-down` is a capture-phase mousedown or pointerdown, which always
fires.

## A. Where each layer comes from and what it looks like

| layer | created | parent | opens by | z-index | roles and aria |
|---|---|---|---|---|---|
| `#fe-crumb-menu` | static `pg:273` | `#fe` | click chevron `ch:159` or "…" `ch:147` | 300 `s:118` | none |
| `.fe-tab-menu` (tab actions) | `st:146-149` | `#fe` | click ⋯ `st:283`; right-click `st:153`; ⇧F10 `fn:165` | 360 `s:1215` | none |
| `.fe-tab-menu` (All tabs list) | `st:243-254`, same element | `#fe` | click `#fe-tab-list` `st:245`; key `g a` | 360 | button `aria-haspopup` `pg:165`; no `aria-expanded` |
| `#fe-ctx` | `li:113-116` | `#fe` | right-click row `li:118`; key `x` or ⇧F10 `li:241` | 360 `s:1215` | none |
| `#fe-nt-ctx` | `sb:664-668` | `#fe` | right-click note row `sb:740`; no key route | 360 | none |
| `.fe-pmenu` | `nm:19-25` | `#fe` | click props button `sb:653`, `nm:139` | 2147483000 `s:995` | `menu`, `menuitem` `nm:23` |
| `#fe-sv-card` | `sb:181-184` | `#fe` | hover a Saved row `sb:215-220` | 60 `s:1362` | none |
| `.fe-rule-pop` | `su:117-124` | `#fe` | click `.fe-rule-ico` `su:93` | 610 `sui:142` | `dialog` + label `su:123` |
| `#fe-allow` (ask) | `fp:358-370` | `#fe` | first Edit press, folder not allowed `fp:432` | 320 `s:950` | `dialog` + label `fp:362` |
| `#fe-allow` (cannot-edit note) | `fp:393-400` | `#fe` | editor says "cannot edit" `fp:419` | 320 | `alert` `fp:398` |
| `#fe-cm-add` | `cu:536-543` | `#fe` | text selected, 120 ms `cu:547` | 30 `s:862` | none |
| `.fe-cm-ac` | markup `cu:379`, filled `cu:567` | comments box, absolute | type `@` or `#` in a comment `cu:589` | 10 `s:848` | `listbox`, `option` `cu:379`, `cu:574` |
| `.fe-dd-list` | `co:116-125` | `#fe` | click `.fe-dd-btn` `co:164`; ↑ ↓ on it `co:165` | 600 `sui:89` | `listbox`, `option`; button `aria-expanded` `co:160` |
| `.fe-ask-hist` | markup `tl:111` | Ask lens, absolute | click `#fe-ask-hist-btn` `tl:282` | 20 `s:1587` | button `aria-expanded` `tl:214`; panel none |
| `#fe-tip` | static `pg:274` | `#fe` | hover `[data-tip]`, 300 ms `li:78-85` | 200 `s:534` | none |
| `#fe-hint` | `tt:8-13` | `document.body` `main.ts:264` | hover any `[title]`, 350 ms `tt:38-57` | 300 `s:556` | `tooltip` `tt:11` |
| `.fe-hints` | `fn:264-274` | `#fe` | hold ⌥ alone 450 ms `fn:277` | 690 `sui:209` | none |
| `.fe-chord` | `cm:55-66` | `#fe` | first key of a sequence `cm:84-87` | 700 `sui:202` | none |
| `#fe-toast` | static `pg:275`; `toast.ts:6-23` | `#fe` | programmatic `main.ts:192` | 200 `s:552` | none (no `aria-live`) |
| `#fe-goto` | `gt:74-84` | `#fe` | click `#fe-open-path` `gt:110`; key `l` `fn:209` | 60 `s:689` | `dialog` + label `gt:77` |
| `.fe-pal-wrap` | `cm:115-131` | `#fe` | ⌘K `cm:73`; command `palette` | 700 `sui:182` | `dialog`; `listbox`; `option` without `aria-selected` |
| `#fe-qlook` floating | `pv:93-130` | `#fe` | row click `li:30-62`; Space; menu; `openPreview` `pv:701` | 350 `s:665` | none |
| `#fe-qlook.side` docked | same element, `pv:243-256` | `#fe-body` | dock button `pv:141`; key `d` | 1 `s:676` | none |
| `.fe-dlg` Settings, Help | `dl:19-37`, `dl:51` | `#fe`, static `pg:277` | buttons; `,` `?` `li:178`; commands `fn:194` | 400 `s:571` | `dialog` + `aria-labelledby` `dl:25`; no `aria-modal` |

## B. How each layer closes, takes focus and handles keys

| layer | closes by | focus moves in? | focus returns? | arrows inside | opening it closes others? |
|---|---|---|---|---|---|
| `#fe-crumb-menu` | out-click `ch:202`; anchor toggle `ch:150`; Esc only from the filter box `ch:190`; pick; bar resize `ch:101` | chevron list: filter box after load `ch:181`; "…" list: no | no | `fn` menu keys `fn:19-41` | no |
| `.fe-tab-menu` (actions) | out-click `st:194`; Esc `st:195`; pick `st:178` | no | n/a | `fn` menu keys | no |
| `.fe-tab-menu` (All tabs) | same as above; second click on the button re-opens, never closes `st:245` | no | n/a | `fn` menu keys | no |
| `#fe-ctx` | out-click `li:163`; Esc, no input focused `li:186`; pick `li:150` | no; key route pre-marks item 1 `.kb` `li:246` | n/a | `fn` menu keys | no |
| `#fe-nt-ctx` | out-click `sb:706`; Esc `sb:707`; pick `sb:693` | no | n/a | `fn` menu keys | no |
| `.fe-pmenu` | out-down `nm:77`; Esc, capture `nm:78`; preview open `pv:705` | yes, tag input `nm:86`, again after each change `nm:46` | no | `fn` menu keys | replaces itself `nm:20` |
| `#fe-sv-card` | pointer leaves list 200 ms `sb:222`; scroll `sb:223`; pointerdown; dragstart `sb:224-225` | never | n/a | none | no |
| `.fe-rule-pop` | out-down `su:164`; Esc on its box `su:157`; Settings closes `su:225` | yes, selected glyph `su:162` | on Esc only `su:157` | none | replaces itself `su:118` |
| `#fe-allow` (ask) | Esc, capture `fp:375`; out-down `fp:376`; three buttons `fp:379-388` | yes, Allow folder `fp:389` | no | none | removes older one `fp:359` |
| `#fe-allow` (note) | any pointerdown `fp:405`; 8 s timer `fp:406`; no Esc | no | no | none | removes older one `fp:394` |
| `#fe-cm-add` | selection cleared `cu:551`; page scroll `cu:559`; click `cu:545` | no, keeps selection `cu:544` | n/a | none | no |
| `.fe-cm-ac` | pick `cu:587`; Esc `cu:614`; box scroll `cu:596`; any box repaint `cu:379` | no | n/a | own handler `cu:611-613` | no |
| `.fe-dd-list` | out-down `co:153`; Esc or Tab `co:143`; pick; button click `co:164` | no, keys captured at document `co:154` | on pick and Esc, not Tab `co:138`, `co:143` | own handler `co:139-150` | closes previous list `co:117` |
| `.fe-ask-hist` | button toggle `tl:282`; out-pdown `tl:283`; Esc `tl:284`; new chat, open chat | no | on Esc only `tl:284` | none | no |
| `#fe-tip` | pointer leaves target or listing `li:82`, `li:86` | never | n/a | none | no |
| `#fe-hint` | pointerout `tt:59`; pointerdown `tt:63`; scroll `tt:64`; any key `tt:65` | never | n/a | none | no |
| `.fe-hints` | other key `fn:278`; ⌥ up `fn:280`; blur `fn:281`; pointerdown `fn:282` | never | n/a | none | no |
| `.fe-chord` | 1600 ms `cm:61`; next key `cm:75-80` | never | n/a | none | no |
| `#fe-toast` | 2400 ms, or 6000 ms with an action `toast.ts:9`, `toast.ts:18` | never | n/a | action is a plain button | replaces text |
| `#fe-goto` | button toggle `gt:110`; out-down `gt:73`; Esc `gt:106`; submit `gt:104` | yes, input selected `gt:89` | on Esc only `gt:106` | none | no |
| `.fe-pal-wrap` | Esc `cm:165`; scrim mousedown `cm:174`; pick `cm:155-160` | yes, input `cm:176` | Esc and scrim yes; pick no `cm:158` | own handler, no Home or End `cm:162-167` | no; ⌘K runs before the blocked test `cm:73-74` |
| `#fe-qlook` floating | Esc or Space `li:190`; × `pv:132`; scrim `pv:140`; Esc in note box `pv:596` | no; only the note editor `pv:449` | yes `pv:268` | ↑ ↓ ← → step files `li:191-193`; Tab wraps `pv:150-160` | closes props menu only `pv:705` |
| `#fe-qlook.side` docked | Esc or Space `li:190`; × `pv:132`; no scrim `s:677` | no | yes `pv:268` | same; Tab wrap off `pv:151` | closes props menu only |
| `.fe-dlg` | Esc `dl:86`; × `dl:82`; scrim `dl:83` | yes, the box `dl:72` | yes `dl:78` | `[` `]` switch tabs `dl:95`; Tab wraps `dl:87-94` | Help over Settings leaves one open (smoke.mjs:733) |

## C. Quirks worth knowing before the change

- **The path menu has no Esc for most states.** Only its filter box handles
  Esc. The "…" list, the loading state and an empty or failed folder stay open
  on Esc. Alt-click on an item keeps a tab and leaves the menu open.
- **The path menu drops focus.** After Esc the focused filter box is hidden,
  so focus falls to the page body.
- **Two menus can be open together.** The chevron, ⋯ and All tabs clicks stop
  propagation, and a right-click sends no click at all, so the document-click
  closers never run.
- **The tab menu closes on any Esc**, including an Esc meant for another
  layer. The note menu and the narrow sidebar do the same.
- **The note row menu is mouse only.** Only the tab strip handles the
  ContextMenu key.
- **The Allow popover leaks.** Pressing Edit again while it is open removes the
  element but not its old key and pointer listeners, and leaves a promise that
  never resolves.
- **The props menu sits above everything**, palette included, at z-index
  2147483000.
- **Toast and tooltip likely hide behind dialogs.** Toast is 200, tooltip 300,
  preview 350, dialog 400. Not measured in a render.
- **The completion list never closes on blur or outside click.** Scroll and a
  box repaint close it.
- **The row tip survives scroll, click and key** until the next mousemove.
  Keyboard users never see it.
- **The chord pill does not swallow Esc.** Esc cancels it as a wrong second
  key and still reaches other handlers.
- **The Allow popover and its cannot-edit note share one id**, `#fe-allow`.
- **Key badges are placed once**, at show time, and do not follow scroll.

## D. Where the layers disagree

1. **Escape.** At least 13 layer-specific handlers. Bubble listeners that
   check nothing else: tab menu, note menu, narrow sidebar, dialog, item menu.
   Capture listeners that stop propagation: props menu, dropdown, Allow
   popover, Ask history. Box-level listeners: rule popover, Go to, palette,
   path-menu filter. One Esc can close the tab menu and the sidebar overlay
   together.
2. **What counts as outside.** Document click for the path, tab, item and note
   menus. Mousedown capture for the dropdown, props menu and rule popover.
   Pointerdown for Go to, Allow popover, Ask history and the narrow sidebar.
3. **Anchor click.** Toggles: path menu, dropdown, Go to, Ask history.
   Re-opens in place: props menu, rule popover. Never closes: All tabs list.
4. **Scroll.** Closes: Saved card, tooltip, Comment button, completion list.
   Stays put and drifts from its anchor: every menu, the dropdown, both
   popovers, Go to, Ask history, the row tip.
5. **Resize.** Only the path menu closes on resize.
6. **Focus in.** Moves in: path filter, props menu, rule popover, Allow
   popover, Go to, palette, dialog. Stays out: item, tab and note menus,
   dropdown, preview, every hover and transient layer.
7. **Focus back.** A stack for preview and dialog. The anchor on Esc only for
   rule popover, Go to, Ask history and dropdown. The palette on Esc and scrim,
   not on pick. Never for path menu, props menu, Allow popover or item menus.
8. **Arrow keys.** Four implementations: shared `.kb` menu keys (five menus),
   the dropdown's own, the palette's own, the completion list's own. None
   uses roving focus or `aria-activedescendant`.
9. **Roles.** 10 of 25 rows carry a role. None of the five menus, the
   preview, the toast, the Saved card or the pills do.
10. **Stacking.** 16 distinct z-index values, from 1 to 2147483000. The
    `--z-*` tokens are declared and used nowhere. Out of order: toast 200 and
    tooltip 300 under preview 350 and dialog 400; Go to and Saved card 60 under
    the path menu 300; props menu above the palette 700.
11. **Hover timing.** Row tip 300 ms, tooltip 350, Saved card 450 then 120, ⌥
    badges 450. The tooltip hides on any key, the row tip on none.
12. **Show and hide mechanism.** Four: `style.display`, create and remove, a
    class, the `hidden` attribute. The shared open-menu test reads
    `style.display` only.
13. **Command keys while open.** Menus, dropdown, rule popover and Go to block
    them. Allow popover, Ask history, Saved card and Comment button do not.
14. **Placement.** Clamp left only (props menu, Go to, Allow popover, path
    menu); both axes (item, tab and note menus); flip above (dropdown, rule
    popover, Saved card, completion list).

## Not floating layers

| thing | reason |
|---|---|
| `#fe-side.open` narrow sidebar | A dock. Opens by rail click at 520px or less, closes on Esc or an outside pointerdown. Needs a dock row in the slice. |
| `#fe-toc-rail`, `#fe-fe-pill` | Absolute inside the file view at z 4 and 5, not floating. |
| `#fe-ed-hist` | Inline panel in the note editor. |
| `#fe-bc-edit` path box | Replaces the crumb bar in place; Esc or blur puts the bar back. |
| filter bar | Inline row toggled by the filter button. |

## Sources

Read at commit 068d04f. Two later commits, 49b869d (the layer service,
`src/layer.ts`, unused at 068d04f) and 18f88d3 (item and tab menus moved onto
it), change the item menu and tab menu rows; those rows describe 068d04f. Line
numbers in `src/sidebar.ts` and `src/note-meta-ui.ts` are 068d04f too; the
working tree had unfinished edits there while this was written.

Evidence for sections C, D and the last table:

- Path menu Esc is only in the filter box: `ch:190`.
- Clicks that stop propagation: `ch:149`, `ch:161`, `st:246`, `st:285`.
- Tab menu, note menu and sidebar Esc: `st:195`, `sb:707`, `sb:74-81`.
- ContextMenu key: `fn:165`.
- Allow popover listeners left behind: `fp:359`, `fp:377-378`.
- Props menu z-index: `s:995`.
- Completion list closes: `cu:596`, `cu:379`.
- Row tip hides: `li:82-86`.
- Chord next-key rule: `cm:75-80`.
- Badges placed once: `fn:269-273`.
- Unused `--z-*` tokens: `s:1290`.
- Open-menu test and blocked list: `fn:21-23`, `fn:62`.
- Path menu clamp: `ch:71`.
- Docked or inline parts: `s:735`, `s:940`, `s:966`, `ch:105-141`, `listing.ts:532`.
- Tooltip parent: `main.ts:264`.

Abbreviations: `ch` chrome.ts, `st` strip.ts, `li` listing-input.ts, `sb`
sidebar.ts, `nm` note-meta-ui.ts, `su` settings-ui.ts, `fp` file-page.ts, `cu`
comments-ui.ts, `co` controls.ts, `tl` tool-lenses.ts, `tt` tooltip.ts, `fn`
focus-nav.ts, `cm` commands.ts, `pv` preview.ts, `dl` dialog.ts, `gt` goto.ts,
`s` styles.ts, `sui` styles-ui.ts, `pg` page.ts. In `s`, lines after 1216 may
be one higher in later commits.
