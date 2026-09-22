# Better Find results (v2.10)

The v2.9 Find panel filtered names, types, and file contents in the current
folder or a bounded subtree. A saved view was the folder URL plus `#find=`.
`src/find.ts` recorded the first matching line and match count for each file,
but `src/listing.ts` used that map only to hide files without a hit.

The v2.10 implementation covers the three Find follow-ups named in
`docs/feature-set.md:107-109`: show the first match, show the match count, and
allow a regular expression for contents. It keeps the current 2 MB file limit,
four concurrent reads, 5000-entry deep crawl, cancel action, and saved view URL
model. Deep scope has a selectable maximum folder depth, defaulting to 8.

## Behavior

| Surface | Result |
|---|---|
| Find panel | A separate **Text regex** control applies only to the contents field. The existing name regex control keeps its current meaning. Invalid text patterns show an inline error and do not start a scan. |
| Results | Show the first matching line under each result label, with the matching span highlighted. Show a numeric match count for each file; Details gets a Match count column while a contents result is active, and other views get a compact count badge. The count is occurrences, not matching lines. |
| Empty and partial results | Zero hits stays explicit. Failed reads and the number scanned remain visible. Cancel stops scheduling new reads and leaves a clearly labelled partial result. A new query cannot display a previous query's hits. |
| Saved views | Add `textRegex: false` to decoded older `#find=` queries. New views round-trip the separate toggle. Opening a saved view restores the controls and runs the same search. |
| Work limits | A depth selector limits deep crawl to 1, 2, 4, or 8 levels. Reads and matching stop when a query changes, Cancel is pressed, deep scope is turned off, or the tab closes. Multiple tabs can search independently within a shared four-read limit. |
| Navigation | Clicking a result still follows the current look/go setting. Preview and file page remain tied to the file URL. The snippet is display text, not a new navigation target. |

## Implementation

1. Extend `FindQuery` and the contents scanner in `src/find.ts`. Run content
   matching in a dedicated worker so a slow regex cannot freeze the page.
   Terminate a stalled worker. Search one line at a time so snippets map to a
   visible line. Escape snippet text before adding highlight markup. Bound
   snippet length and pattern length; keep the existing file-size cap.
2. Add the separate control, depth selector, and inline error to the Find panel
   in `src/page.ts` and wire them in `src/listing.ts`. Keep cancellation and
   deep-scan sequencing in one place; stale async completions must never
   replace newer results. Stop in-flight reads through a per-search extension
   port. The background worker shares a four-read budget across tabs.
3. Render the snippet and count in Details, List, Tiles, and Icons using the
   existing result map. Do not add a permanent column to ordinary listings.
4. Update Help and README only after the behavior is exercised.

## Constraints

- Browser regular expressions can be slow on a pathological pattern, even on a
  2 MB local file. The matching worker can be terminated after a timeout; the
  scan then reports partial results. The UI labels content regex as an
  advanced local search option.
- The current scanner counts overlapping literal matches. Regex counting must
  define its own rule: non-overlapping matches, with zero-length matches
  advancing one code point to avoid a loop. Document the distinction.
- A result line can contain HTML or a path-like string. Render it as escaped
  text with only the matching range wrapped for emphasis.
- Deep crawl completion, cancellation, and a new query can arrive in different
  orders. Results must belong to the latest query; cancelled results should
  be visibly partial rather than silently presented as complete.

## Meaningful acceptance cases

- A saved deep view with content regex restores all controls and finds a match
  in a nested file after navigation to the view URL.
- A second query started while the first is reading cannot show the first
  query's snippets or counts.
- Cancel during four in-flight reads stops later scheduling and labels the
  result partial. A failed file read does not erase successful results.
- A snippet containing `<script>` or quotes displays literally, with only the
  matched text emphasized; a long first line remains bounded.
- Invalid and zero-length regex cases produce a usable error or finite result,
  and an older saved view without `textRegex` still opens as literal search.
