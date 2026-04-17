# Better File Browser

A Chrome extension that replaces the browser's plain directory listings with a modern, feature-rich file explorer.

```
┌─────────────────────────────────────────────────────────────────┐
│  Better File Browser                                            │
├──────────────────────────────────────────────────────────────── ┤
│                                                                  │
│  ARCHITECTURE                                                    │
│                                                                  │
│  Chrome navigates to file:///some/path/                         │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────┐    loader.js (document_start)              │
│  │  Chrome's plain │ ──► hides body immediately                 │
│  │  directory HTML │    (prevents white flash)                  │
│  └─────────────────┘         │                                  │
│                               ▼                                  │
│                    content.js (document_end)                     │
│                    ┌──────────────────────┐                     │
│                    │ 1. parse table data  │                     │
│                    │ 2. replace DOM       │                     │
│                    │ 3. attach events     │                     │
│                    └──────────────────────┘                     │
│                               │                                  │
│                               ▼                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ PATH BAR  /  Users  ›  alcatraz627  ›  Projects  ›  app  │  │
│  ├────────────┬──────────────────────────────────────────────┤  │
│  │ SIDEBAR    │ TOOLBAR  [Details][List][Tiles][Icons] [🔍]  │  │
│  │            ├──────────────────────────────────────────────┤  │
│  │ Bookmarks  │ Name           │ Type    │ Size    │ Modified │  │
│  │  ★ app     │ 📁 src/        │ Folder  │  —      │ Apr 17   │  │
│  │  ★ docs    │ 📁 node_mods/  │ Folder  │  —      │ Apr 15   │  │
│  │            │ 🟨 index.js    │ JS File │ 4.2 KB  │ Apr 17   │  │
│  │ Places     │ 🔷 types.ts    │ TS File │ 1.1 KB  │ Apr 15   │  │
│  │  🖥 Root   │ {} package.json│ JSON    │  890 B  │ Apr 10   │  │
│  │  🏠 Home   │ 🔒 yarn.lock   │ File    │  —      │ Apr 10   │  │
│  │  📋 Docs   │                │         │         │          │  │
│  │  ⬇ Down   │                │         │         │          │  │
│  └────────────┴──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Features

- **Breadcrumb path bar** — every path segment is a clickable link
- **Bookmarks** — star any folder; persists across sessions via `localStorage`
- **Quick places** — Root, Home, Desktop, Documents, Downloads, Projects (auto-detected from your username)
- **4 view modes** — Details (table), List (compact), Tiles (medium grid), Large Icons
- **Live search** — filter files by name as you type
- **Sortable columns** — click Name, Size, or Modified to sort
- **SVG icon set** — 30+ file types with distinct colors; clean folder icons
- **Dark / Light theme** — toggle in the path bar; preference persists
- **No flash** — `loader.js` pre-hides Chrome's plain listing at `document_start`
- **Ghostty terminal** — open current folder in Ghostty (requires optional native setup)

## What's NOT supported

- **System Finder icons / macOS `.icns`** — Chrome's extension sandbox cannot read the filesystem or macOS metadata APIs. Icons are custom SVG.
- **Finder sidebar sync** — Finder favorites live in a binary plist (`com.apple.sidebarlists.plist`) that's inaccessible from a browser extension. Use the built-in Bookmarks feature instead.

## Installation

### 1. Load the extension

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** → select this folder (`better-file-browser/`)
4. On the extension card → **Details** → enable **"Allow access to file URLs"**

### 2. (Optional) Enable Ghostty one-click launch

```bash
# Find your Extension ID on chrome://extensions, then:
cd native/
./install.sh <your-extension-id>
```

This registers a native messaging host that lets the terminal button open Ghostty directly in the current folder.

Without this step, the terminal button copies the path to your clipboard with instructions.

## File Structure

```
better-file-browser/
├── manifest.json          MV3 extension manifest
├── loader.js              document_start: hides Chrome listing before it renders
├── content.js             document_end: parses + replaces the full page
├── README.md
└── native/
    ├── ghostty_launcher.py    Native messaging host (Python)
    ├── install.sh             Registers the host with Chrome
    └── com.better_file_browser.ghostty.json  Host manifest template
```

## Development

All logic is in `content.js` — reload the extension after edits (`chrome://extensions/` → refresh button).

The extension uses no bundler, no dependencies, and no network requests.
