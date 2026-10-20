---
reader: the owner, checking progress; the rows are referenced by later slices
---

# Consistency pass: how we find out what is needed

<!-- sessions: bfb@2026-10-20 -->

The owner's review on 2026-10-20 found that features work one at a time but
do not fit together: buttons, toolbars, type and sidebar sections each follow
their own rules, and several capabilities (AI, deep search, path bar, restore,
settings) are half-built. This plan replaces one-shot fixes with a process
that finds every gap first, measures it, and builds against a written spec.

## Phases

| # | Phase | Output | Done when |
|---|---|---|---|
| A | Capture | Acceptance rows below, in the owner's words, each with a check | Every complaint has a row and a check that can fail |
| B | Inventory | `capabilities.md`: every feature, where it lives, entry points, settings, keys, states, what is missing | Generated from the code (buttons, toolbars, settings, key handlers), not from memory |
| C | Census | A script that walks the rendered UI in dark and light and records every button (size, shape, border, fill, tooltip) and every text role (size, weight, line height, colour) | Inconsistency is a number, not an opinion; the script reruns after each slice |
| D | Spec | `design-system.md`: Button, IconButton, Toolbar, SidebarSection, type scale, spacing | Each primitive has props, tokens and a rendered sample sheet |
| E | Ideation | Per capability: today, gaps, proposal, which primitives it uses | Owner rules on one decision page with mocks, not a chat list |
| F | Build | Slices: primitives first, then one surface at a time | Each slice: census delta, dark and light screenshots read, e2e green |
| G | Review | Adversarial review against the rows below | Every row passes or is listed as open |

Bugs found along the way are fixed outside the phases, each with a probe that
reproduces it and an e2e check that stays in the suite.

## Acceptance rows (owner, 2026-10-20)

| # | Owner's words (trimmed) | Check |
|---|---|---|
| R1 | "cmd + f to search with sidebar open ruins the main file list window" | `e2e/probe-cmdf.mjs`: at 1519px with sidebar and an 880px docked preview, Cmd+F leaves `#fe-main` unscrolled and the Name column visible |
| R2 | "there are no tooltips for the icon only buttons" | Census: every icon-only control has a label shown on hover |
| R3 | "need better icons for some" | Icon sheet reviewed by the owner (phase E) |
| R4 | Buttons: plain by default; `variant = solid / outline / shade`, `shade`, `hoverShade` (darker when already shaded); icon buttons circular | Census: one button primitive, no ad-hoc bordered squares |
| R5 | "toolbars ... inconsistent, like you forget what consistency means when adding a second toolbar" | Census: every toolbar uses one height, gap, padding and control size |
| R6 | "the typography is thoroughly off ... text size in settings is not an excuse" | Census: every text node maps to a named type role; no stray sizes |
| R7 | "no search inside a preview file or a dedicated file" | Find-in-file on file pages and in the preview, with match count and next/previous |
| R8 | AI: shorter toolbar, follow-up chat with history, "the bare minimum in back-and-forth", maybe the lm agent for searching; its own feature section | AI chat with persisted threads per file and a global AI section |
| R9 | Sidebar: ToC has a bottom border but cannot be resized; other sections lack it | One SidebarSection primitive: same header, divider, collapse and resize for all |
| R10 | "The top path bar is so half-done" | Path bar capabilities listed and ruled in phase E |
| R11 | "I can't even select the default sort to persist across folders" | Settings has a default sort; it applies in a folder never sorted before |
| R12 | Tab restore "keeps false restoring"; offer restore from Recents instead; same Chrome tab keeps its strip | No automatic restore into a fresh Chrome tab; closed strips appear in Recent |
| R13 | Deep search "so primitive", no progress, cannot specify properly | Deep search spec in phase E: scope, depth, filters, live progress, cancel |
| R15 | "smooth animations for various actions, the sidebars and browsing and buttons and all" | Motion tokens in the spec (durations, easing, reduced motion); census flags any state change with no transition |
| R16 | Code block "bg needs to be lighter"; colour plain-text blocks too; copy is "just an icon as a plain button", turning into a green check for 3s | Light and dark code block surface one step off the page; copy is an icon button; `copied` state lasts 3s |
| R17 | "the chip color bg needs to be lighter" (inline `code`) | Inline code surface matches the token set; contrast measured |
| R18 | "revisit and tune the entire color palette of blacks and grays for text, `code`, code blocks and the spacing; same for tables" | One neutral ramp in the spec; every text, code and table colour maps to it |
| R19 | "extra left spacing against sidebar + the dashed tab border looks weird" | Strip starts flush with the content gutter; an unkept tab is shown without a dashed border |
| R20 | Footer "too small", could carry more, path "isn't even clickable to copy" | Status bar at body size with file metadata; path click copies |
| R21 | ToC "inconsistent in showing the selected element + no tooltip for truncated items + no smooth scroll" | One active style that follows scroll; truncated rows have a tooltip; clicks scroll smoothly |
| R22 | "all the titles in the sidebar and modals and else need a icon + title + subtitle (optional) pattern with proper spacing" | One SectionTitle primitive used by sidebar sections, dialogs and panels |
| R23 | "bullet and para spacing is inconsistent ... it is the job of the markdown engine to make it pleasant to read" | Loose and tight lists render with the same rhythm; paragraph, list and heading spacing come from one scale |
| R24 | "the bottom border under titles is fine sometimes and not fine otherwise" | Heading rule rules decided once in the spec (which levels, what weight) |
| R25 | "3.8kb in the top bar but 37 lines in the bottom": standardise file metadata in data and display, with icons, generic plus type-specific | One FileMeta record (generic + per-type fields) rendered by one component in the preview header, file bar and status bar |
| R14 | "look at all the capabilities ... make these consistent within themselves and with the whole plugin" | Phases B to G complete |

## Constraints

- Mindful usage: work inline, no sub-agent fleets unless the owner asks.
- No surface is removed without the owner's ruling (`capabilities.md` lists each one).
