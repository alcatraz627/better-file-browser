# Version 2.11

Version 2.11 improves reading, Notes navigation, and the explorer controls.

| Area | Change |
|---|---|
| Markdown | Renders safe inline and block HTML, preserves fenced code blocks, aligns uneven GFM table rows, and recognizes escaped pipes and code spans inside table cells. Paths beginning `/Users/alcatraz627` open as links in a new tab. |
| File pages | Reading width cycles through Full, XL (150ch), LG (130ch), and MD (110ch). The choice persists. Text size scales the whole interface. A page favicon identifies the extension. |
| Notes | The section remains visible before setup, with a shortcut to its folder setting. A note row can open a rendered reading page in the in-page tab strip. New notes start empty and take their filename from the first heading or text line on first save. |
| Sidebar | Click any section title to collapse or expand its list. The choice survives a reload. The Notes folder has a separate open-folder icon. |
| Settings and layout | Tabs and buttons use icons, inputs use the active page background, and narrow windows give Markdown and toolbar controls more room. |
| Filename filter | Regex matching runs in a worker with a time limit. Changing the query or leaving the page stops the old work. |

Version 2.10 introduced the lazy Tree view, native HTML/PDF exclusions, bounded
content search, and Mermaid rendering. Those features remain available in 2.11.

## Checks

The release checks cover the unit suite, browser smoke in dark and light themes,
Find across tabs, Tree and native file handling, Markdown UI, Mermaid, the
filename regex timeout, and the Notes host protocol. The commands are listed in
the [README](../README.md#development) and the focused browser scripts under
`e2e/`.
