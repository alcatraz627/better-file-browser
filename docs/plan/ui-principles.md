---
reader: anyone designing or reviewing a screen of the explorer; the owner when judging variants
---

# UI principles

<!-- sessions: bfb@2026-10-20 -->

`design-system.md` says what things are made of. This page says what a good
screen of this product is, so a review can say "this breaks principle 6"
instead of listing another complaint. Each principle has a test you can run
on a screenshot or by clicking. Sources and the longer argument are in
`.claude/output/20261020-1630-ui-principles/research.md`, distilled from the
design language in `~/Code/Versable/versable-builder/docs/design-language/`.

## The principles

**Coherence**

1. **One identity, one home.** A file kind, a place or a section has one
   definition (icon, label, colour) and every surface reads it from there.
   Test: change it once; every row, tab, header and tooltip follows.
2. **One primitive per role.** A button, toolbar, section title, list row,
   chip, popover and empty state each have one anatomy. Test: tabulate
   height, radius and font size per role on a screen; more than one value is
   a finding.
3. **Scales are short and never extended on a page.** Every size, gap,
   radius and opacity is a named step in `design-system.md`.

**Visual language**

4. **Hierarchy comes from size, weight and the ink ladder** (`--tx`, `--mt`,
   `--dm`), not from colour or bold. Test: blur the screenshot; title, label
   and metadata are still distinct.
5. **Colour has three jobs that never share a hue.** Identity (what a thing
   is: folder, markdown, image, code), state (how it is: saved, edited,
   conflict, failed) and selection (what you chose: the active tab, the
   selected row). Test: name the job of every coloured element; a hue doing
   two jobs fails.
6. **Three kinds of small tag, never mixed.** A status pill or dot for state,
   a chip for something you can pick or remove (a tag, a filter), a field
   label for naming (a file type, a front-matter key). A row shows at most one
   status mark beside its kind icon; the rest goes in its tooltip, worst
   first.

**Usability**

7. **Every action answers on the thing you acted on, then confirms when it
   settles.** Within 100ms the control shows pressed or busy; when it is done
   a check, a count change or a toast says so. Test: click every control on
   a screen; a silent one fails.
8. **A control that cannot act says why on the spot**, or is not shown.
9. **Empty, loading and failed look different and say different things.**
   An empty folder, a filter with no match (quote the filter), a search with
   no hits (say what was searched) and an unreadable file (say what failed,
   offer a way out) are four different screens.
10. **Loading keeps the shape of what is coming** and never blanks what is
    already on screen.
11. **Counts, selection and state agree.** The status bar, the list and the
    tab strip tell one story after every change, including the empty case.

**Information and placement**

12. **Say each fact once, where it belongs, at the weight the reader needs.**
    A file's size, path and kind appear in one component each; a second
    appearance needs a reason. The weight of a surface matches the size of
    the task: a small action never gets a big panel.
13. **Each feature lives on the kind of surface its job calls for.** A peek
    keeps the list in view (the preview panel), a modal is for settings you
    leave and come back from, a page is a place you go (a file), a popover
    asks one question next to the button that raised it. Record why when
    breaking this.
14. **Everything clickable is a real control with a name and a visible
    focus; anything cut off shows its full text on hover.**

**Keeping it true**

15. **Fix the primitive, not the instance.** For each complaint, name the
    primitive, token or check that would have prevented it. If there is none,
    the complaint will come back.
16. **Done means seen in the state that matters.** Dark and light, the edge
    state (long name, empty, error, narrow pane), and a measured value for
    any claim about size or colour. A check that has never failed proves
    nothing.

## Two kinds of screen

| Archetype | Surfaces | Width | Scroll |
|---|---|---|---|
| Work surface | Listing, preview panel, search results, settings | Full width | Inside its own panel; bars stay put |
| Reading page | File page, rendered markdown, notes | Prose capped near 72ch, wide content (tables, code, images) may break out | The whole column |

## What a good one contains

Each surface owes these things. A missing one is a finding, not a taste call.

- **Listing:** one toolbar, a count line that says "N of M" only while
  filtered, three empty states (empty folder, no match, unreadable), the
  kind icon and at most one status mark per row, keyboard paths shown in
  tooltips.
- **Preview panel:** a header with the file's name and one summary line, the
  content with a shaped loading frame, a failure state with "open in Chrome"
  and "copy path", the same toolbar primitive as the file page.
- **File page:** reading column, the outline when the file has headings, one
  bar of actions, a live state for the watch (watching, reloaded, not
  watching).
- **Editor:** the caret line marked, the save state on the pill (edited,
  saving, saved, failed), the conflict banner, every failure next to the
  control that caused it.
- **Sidebar:** see the capabilities concept on the decision page; whatever
  the shape, each section owns a title, an empty state that offers the next
  step, and a filter only when it can hold more than about eight rows.
