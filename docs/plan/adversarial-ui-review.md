# Adversarial UI review

**Status: review run on 2026-09-22. Three confirmed defects are fixed and rechecked. One finding was a mistaken expectation about GFM.**

Use real files and folders, including `STATE.md` from the local-models project, to find cases where the extension renders incorrectly, blocks input, loses state, or leaves work running after it is no longer needed. Cover Markdown tables, links, code, Mermaid, and callouts; large and unusual folders; Find across multiple tabs with cancellation and depth limits; Tree expansion; native HTML/PDF opening; and settings persistence. Exercise both themes and narrow and wide windows.

For each failure, record the input and steps, a screenshot or observable browser result, the cause in code, a proposed handling, and a regression check that exercises the behavior. Rank the findings by user impact and fix confirmed defects before closing the review.

## Findings

### P0: A filename regex can stop the browser tab

In a folder containing `aaaaaaaaaaaaaaaaaaaaaaaaaa!.txt`, enable the Quick Filter regex option and enter `(a+)+$`. In Chrome, the input event took **568 ms** with this one 26-character nonmatching name. An isolated run increased from about 38 ms at 22 `a` characters to 667 ms at 26. A longer ordinary filename can block the tab for much longer.

`/Users/alcatraz627/Code/better-file-browser/src/listing.ts:366` calls `applyAll()` synchronously on every input. `/Users/alcatraz627/Code/better-file-browser/src/sort-filter.ts:15` constructs and runs the regex for each entry on that same thread. The content regex has a worker and timeout; the filename regex does not.

**Resolution:** filename regex matching now runs in a worker with a 500 ms budget. Query changes and page exit stop the worker. The browser regression used 30 `a` characters: the input event took 1.1 ms, the timeout appeared, a changed query recovered, and a second tab responded. Command: `node e2e/adversarial-regex.mjs`.

### P1: Markdown becomes unreadable in a narrow window

At a 620 px viewport, opening `/Users/alcatraz627/Code/local-models/docs/STATE.md` leaves the reading pane **175 px** wide. Its 48 px padding on each side leaves about 79 px for text. The table and nearby paragraphs appear as a thin vertical strip in [dark](</Users/alcatraz627/Code/better-file-browser/.claude/output/20260922-adversarial-ui/narrow-table-dark.png>) and [light](</Users/alcatraz627/Code/better-file-browser/.claude/output/20260922-adversarial-ui/narrow-table-light.png>). The folder toolbar also clips its rightmost controls at this width.

`/Users/alcatraz627/Code/better-file-browser/src/styles.ts:67` gives the sidebar 220 px; line 443 gives the contents rail another 220 px; line 448 keeps 48 px side padding. There is no narrow-width layout rule for this combination.

**Resolution:** the sidebar and Contents rail narrow below 900 px, reading padding falls to 18 px, and toolbar controls wrap. At 620 px the Markdown content measured over 400 px and the page had no horizontal overflow in both themes. Inspect [dark](</Users/alcatraz627/Code/better-file-browser/.claude/output/20260922-adversarial-ui/narrow-fixed-dark.png>) and [light](</Users/alcatraz627/Code/better-file-browser/.claude/output/20260922-adversarial-ui/narrow-fixed-light.png>). Command: `node e2e/ui-polish.mjs`.

### Retracted: Raw HTML absorbs the following Markdown heading

Open a Markdown file containing `# Start`, a blank line, `<div align="center">Logo</div>`, then `# Next` on the immediately following line. Chrome renders `# Next` as literal text and lists only `Start` in Contents. [Screenshot](</Users/alcatraz627/Code/better-file-browser/.claude/output/20260922-adversarial-ui/raw-html-heading.png>). The browser result was `headings: ["Start"]`, `toc: ["Start"]`, `rawBlock: "Logo\n# Next"`.

The [GFM specification](https://github.github.com/gfm/) says this form of HTML block ends at a blank line. The heading on the immediately following line is therefore HTML text. The earlier review called compliant behavior a defect.

**Resolution:** block parsing remains as specified by GFM. The renderer now handles safe inline HTML such as `<kbd>` and `<sup>`. Raw `<details open>` and table cell spans survive sanitization. A blank line after a raw HTML block allows Markdown heading parsing to resume.

### P2: Uneven Markdown table rows change the column count

For a three-column table, rows `| one | two |` and `| alpha | beta | gamma | extra |` render with **two and four** cells. The observed row widths were `[3,2,4]`. `/Users/alcatraz627/Code/better-file-browser/src/renderers.ts:612` emits each parsed row without normalizing it to the header width.

**Resolution:** table body rows are padded or trimmed to the header width. Unit checks cover short and long rows, escaped pipes, and code spans. The complete `STATE.md` table also rendered with three aligned columns in the browser review.

## Checks that held

- The complete `STATE.md` Command table has 13 rows and three aligned columns in both themes after the local table fix.
- The actual `/Users/alcatraz627/Code/Versable/speedway/.claude/output/20260918-pause-cancel-credits/00-ask.md` callout has 8 px outer margins and 1 px vertical padding. Inspected [dark](</Users/alcatraz627/Code/better-file-browser/.claude/output/20260922-adversarial-ui/callout-dark.png>) and [light](</Users/alcatraz627/Code/better-file-browser/.claude/output/20260922-adversarial-ui/callout-light.png>).
- `node e2e/mermaid.mjs` passed preview, theme change, file page, and invalid Mermaid source.
- `node e2e/search.mjs` passed independent tabs, content regex, escaped snippets, depth, saved views, stale query, cancellation, and worker timeout.
- `node e2e/tree-native-files.mjs` passed native HTML, source opt-in, exclusions reset, lazy Tree expansion, collapse, cache, and reload.
- Chrome left a PDF to its native viewer. An exclusions edit normalized `.PDF, .HTML, .PDF, bad!` to `.pdf, .html` and persisted it through reload.
- A folder with 1,200 files loaded in 614 ms and responded to the next animation frame. A 1.28 MB Markdown fixture with 20,000 paragraphs rendered in 255 ms and remained responsive. These are observations from one machine, not limits or benchmarks.
- A filename containing spaces, `&`, `<`, `>`, and `#` appeared correctly in the folder and opened its Markdown page.

## Cancellation checks

`/Users/alcatraz627/Code/better-file-browser/src/listing.ts` now closes a Tree read port when its folder collapses or the tab closes. `/Users/alcatraz627/Code/better-file-browser/background.js` aborts active fetches and removes queued reads when that port disconnects. The Tree browser suite rapidly expanded and collapsed a folder, then expanded it again and read the expected child. The search browser suite closed a tab during pathological regex work, then completed a search in another tab. These checks prove recovery in Chrome; they do not measure the exact time between port disconnect and fetch abort.

## Rechecks

- `npm test`: 16 files and 212 tests passed.
- `node e2e/search.mjs`: independent tabs, content regex, depth, stale query, cancellation, and timeout passed.
- `node e2e/tree-native-files.mjs`: native file handling, lazy Tree expansion, rapid collapse, and re-expansion passed.
- `node e2e/ui-polish.mjs`: both themes passed settings tab, icon, text size, input color, HTML, fence, and narrow layout checks. The real `docs/notes-contract.md` YAML fence rendered as one code block.
- `node e2e/smoke.mjs`: all checks passed. Its cleanup loop now skips pinned tabs, which middle-click cannot close.

No review check remains open in this report. Owner callout rows remain available for later rechecks.
