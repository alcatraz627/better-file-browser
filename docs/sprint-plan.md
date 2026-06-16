# Better File Browser — sprint plan (v2.4 → v2.6)

<!-- sessions: catch-proj-3f@2026-06-16 -->

Scope: every open item from the audit's to-do list **except** committing the
e2e harness (skipped per decision). Unit tests are in scope throughout — every
item with a pure function gets vitest coverage. Grouped by subsystem so each
sprint touches one area; risk ascends (S1 safest → S4 needs new native infra).

Live status is the Task tool (this doc is the detailed thinking, not the status
surface). The parked gcc-audit work (task #21) is unrelated and stays parked.

---

## Sprint 1 — Correctness & table/sidebar polish  (low risk, no external deps)

| Item | What | Unit tests |
|------|------|-----------|
| **1.1 Date-parse fix** 🐞 | `fmtDate` (`utils.ts:21`) does `new Date("12/06/2026,…")` → misreads DD/MM as MM/DD ("Dec 6" for 12 Jun). Parse the listing's real format explicitly. | `fmtDate` DD/MM + edge cases (the bug that escaped) |
| **1.2 Multi-select** | Extend the existing keyboard selection model from one index to a set: shift-click range, ⌘/ctrl-click toggle, ⌘A; bulk "Copy N paths" action + context-menu entry. | pure range-compute helper (anchor→target index set) |
| **1.3 Column resize** | Drag handles on Details-view headers; persist widths in `localStorage`. | storage get/set widths round-trip |
| **1.4 Custom places** | User-editable quick-access section in the sidebar (add current folder, rename, remove, reorder); persist. | storage CRUD round-trip |

**Ships as v2.4.** Acceptance: the one bug fixed with a regression test; the
three features work in-browser (manual check) and persist across reload.

---

## Sprint 2 — Preview depth  (preview subsystem)

| Item | What | Unit tests |
|------|------|-----------|
| **2.1 Markdown relative paths** | Relative `<img src>` / `[x](./y)` in previewed markdown resolve against the file's directory (currently broken under `file://`). | pure `resolveRelative(base, href)` resolver |
| **2.2 More preview types** | PDF via `<embed>`; audio/video via native `<audio>/<video>` with `file://` src; fonts via a glyph specimen. Extend `canPreview` + the dispatch in `preview.ts`. | `canPreview` + extension→type mapping table |
| **2.3 Highlighter upgrade** *(optional/stretch)* | The ~100-line tokenizer is deliberately approximate. Either broaden it or swap in a small real lib. Only if S2 has room. | `highlightCode` cases per language |

**Ships as v2.5.** Acceptance: each new type renders in-browser; the markdown
resolver has a test proving relative paths become absolute `file://` URLs.

---

## Sprint 3 — AI bar enhancements  (AI subsystem; one cross-agent dependency)

| Item | What | Unit tests |
|------|------|-----------|
| **3.1 Model picker** | Use the `available_models` already in the status payload to populate a dropdown in the Local Model settings panel; pass the choice through as `-m` (the native host already forwards `model`). Persist selection. | storage selected-model; status→options mapping |
| **3.2 Warm toggle from UI** | A button in the settings panel to warm/unwarm. **Cross-agent dependency:** the local-models agent declined a machine `warm ensure` API (warmth is read-only for consumers). Needs a small `lm` API addition first → coordinate via claude-ipc, same as the original spec. Interim fallback: a "copy `lm warm on`" button. | n/a (UI + IPC) |

**Ships as v2.6.** 3.2 is gated on the `lm`-side API; if the agent declines
again, ship the copy-command fallback and close the item.

---

## Sprint 4 — Native filesystem metadata  (needs new native host op; highest effort)

| Item | What | Unit tests |
|------|------|-----------|
| **4.1 Metadata native host** | New op (extend `llm_host.py` or a sibling host) returning `os.stat` data for a path: permissions, real ctime, size. Same native-messaging + background-proxy pattern already built. | pure perms-format + stat-shape formatters |
| **4.2 File permissions** | Show perms + creation date in the tooltip (and optionally a column), filling the gaps the README's "what's not supported" lists. | perms-string formatter (`0o644`→`rw-r--r--`) |
| **4.3 Image dimensions** | Dimensions in image tooltips/preview — either from the metadata host or by loading the image and reading `naturalWidth/Height`. | n/a (DOM) or dimension formatter |

**Ships as v2.7.** Acceptance: tooltip shows perms + true ctime for a known
file; the README "what's not supported" table shrinks accordingly.

---

## Sequencing notes
- S1 → S4 is the recommended order (risk + dependency ascending), but S1–S2 are
  independent of S3–S4 and could interleave.
- **3.2 and all of S4 have external dependencies** (an `lm` API change; a new
  native host the user must re-run `install.sh` for) — flagged so they don't
  block the self-contained work.
- Each sprint ends with: `npm test` green, `npm run build`, a manual in-browser
  check of the new surface, a version bump, and a commit.
