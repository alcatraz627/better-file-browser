# Documentation map

Use [the project README](../README.md) for current controls, setup, and test
commands. The documents below have different purposes; older plans preserve
their original decision context and may describe a past version.

Version 2.11 adds clickable sidebar titles, Notes reading tabs, Markdown and
table fixes, reading-width choices, interface polish, and bounded filename
regex matching. The README changelog and current controls describe this release.

| Document | Use it for | Status |
|---|---|---|
| [Version 2.11](release-2.11.md) | User-facing changes in the current release | Current release |
| [Notes contract](notes-contract.md) | File format, saving, conflicts, and cross-tool use | Current, updated 2026-09-22 |
| [Comments for agents](comments-for-agents.md) | Where markdown comments live, the `bfb-docs` commands, and a CLAUDE.md paragraph | Current |
| [Interaction map](interaction-map.md) | Keys, mouse gestures, and page relationships | Current |
| [Mouse and key audit](mouse-key-audit.md) | Gesture inventory and browser checks | Current checklist |
| [Architecture v2](architecture-v2.md) | URL, tab strip, and recovery design | Shipped design, with later sidebar notes |
| [Feature set](feature-set.md) | v2.8 product model and Notes design | Historical model with later corrections |
| [Highlighter plan](highlighter-plan.md) | Tokenizer design and test stages | Shipped through P4 in v2.10 |
| [Search improvements](plan/search-improvements.md) | v2.10 Find scope and acceptance cases | Implemented plan |
| [Adversarial UI review](plan/adversarial-ui-review.md) | Edge cases, fixes, and review evidence | Review record, 2026-09-22 |
| [Notes audit](notes-audit-20260922.md) | Notes checks and recorded limitations | Review record, 2026-09-22; no follow-up planned for this release |
| [Explorations](explorations.md) | Early file-page, tab, and Notes options | Historical exploration |
| [Modal survey](modal-survey.md) | Earlier panel and dialog research | Historical survey |
| [Saved places](saved-places.md) | Decision to merge Bookmarks and My Places | Historical proposal, resolved |
| [Sprint plan](sprint-plan.md) | v2.4 to v2.7 delivery record | Historical plan |
| [Usability v3 brief](plan/usability-v3-brief.md) | v2.9 release review | Historical brief |
| [Usability v3 plan](plan/usability-v3.md) | v2.9 design choices | Historical plan |

The in-app Help tabs are authored in `src/help.ts`. Update them with the README
when a gesture or setting changes.
