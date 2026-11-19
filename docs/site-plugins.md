---
reader: the bfb owner using the Metro switch, and whoever adds the next site plugin
---

# Site plugins: bfb on ordinary websites

Most of bfb works on local files. A site plugin adds something to a website you
already use. The first one is a **Metro** switch on Booking and Airbnb maps, for
judging how well connected a place to stay is.

## The Metro switch

Open the map on a Booking or Airbnb search and turn on **Metro** at the map's top
left. The choice is remembered per site.

- **Lines** appear at once, in their real colours.
- **Stations** appear as dots. A one-line station wears its line's colour, and an
  interchange has a heavier dark ring.
- **Hovering** names a station and its lines, or names the lines under the pointer
  and highlights the nearest.
- **Clicking a station** opens a popup with its name, local name, operator, station
  codes, step-free access where known, and every line stopping there. Its button
  opens the station's page on Google Maps.
- **Clicking a line** opens the same kind of popup: its code and colour, where it
  runs, operator, hours, frequency and stops in order. Where lines share track, the
  popup lists them to choose from.
- From a popup, a line opens its details and a stop opens its station, with **‹**
  to go back. **×**, **Esc** or a click on empty map closes it.

A line's button opens the area it runs through, with transit showing, because Google
Maps has no page for a line. Searching for "Oedo Line", "Tokyo Metro Ginza Line" or
its Japanese name all answer "can't find".

### How long it takes

Only the first view of an area is slow. The switch says what is loading at each step.

| Step | Live test, public servers busy |
|---|---|
| Lines from Google | At once |
| Stations | 30 to 50 seconds |
| Metro and train details | Under four minutes, for a view spanning four grid squares |
| The same area again, on either site | At once, for 30 days |

- If the servers refuse, the switch says so and offers **Retry**. Whatever already
  loaded stays.
- Below zoom 11 it asks you to zoom in, because a view that wide covers too many
  squares to fetch.

### What leaves the browser

bfb sends only map squares, and only while the switch is on.

- It sends OpenStreetMap's public servers the fixed grid squares around the map,
  about 28 km across, and nothing about your search or dates.
- It tries `overpass.openstreetmap.fr` first, then `overpass-api.de`.
- Station and line buttons open Google Maps only when clicked.

### Why it is built this way

Where the data comes from:

- **Google's transit layer draws the lines.** It appears instantly and matches the
  map, but it is only a picture. It reports no hover, click or line name.
- **OpenStreetMap supplies stations and details.** It is free, needs no key, and
  carries line colours, codes, stops, hours and frequency.
- **Each square is three separate requests.** Public servers often refuse one big
  question but answer these. Stations come first because they are small and most wanted.

What is left out:

- **Named express trains.** Tokyo Station otherwise lists about 30 services, mostly
  Shinkansen and limited expresses. A train counts as a city line only with a line
  colour or a short line code.
- **Through services.** A code like `DT;Z` is a train running across two lines already shown.

How it behaves on the sites:

| Choice | Reason |
|---|---|
| The tip and popup float above the map and never move it | Panning makes Airbnb search again. |
| Clicking a dot does not reach the map | Airbnb would otherwise open its own card on top of the popup. |
| An open popup takes Esc first | Booking closes its whole map on Esc. |

How it reaches the map and the network:

- **The overlay runs in the page.** Only the page can reach the site's map.
- **The fetch runs outside it.** A site's security policy can block the page's own
  requests. The worker cannot fetch either, because Chrome stops a worker whose
  fetch takes over 30 seconds.
- **The map is found by its shape in the React tree.** Google offers no way from an
  element back to its map. Searching for anything map-shaped survives a site
  renaming its fields.

### Limits

- Coverage is whatever OpenStreetMap has mapped. Tokyo is rich. Elsewhere a line
  may lack a colour, code or hours, and its card shows only what exists.
- A line's stop list covers the squares loaded so far, and says so ("19 of 20 stops,
  in this area").
- Highlighted track comes from OpenStreetMap and Google draws its own lines, so the
  two can sit a few pixels apart.

## The Areas switch

**Areas**, beside Metro, is for skimming a map to shortlist a place to stay: what each
part of Tokyo and its day-trip towns is like, and what is on during one trip, Nov 12
to 17, 2026. It works with Metro on or off, and fetches nothing.

- **Patches and labels** mark each area. The label's coloured dots say what kind of
  place it is, and its number counts events during the trip. When there is room
  (zoom 12 and closer) the label adds a few words, such as "old Tokyo, temple, stalls".
- **Hovering** a label gives its feel and first event.
- **Clicking** a label opens its feel, dated events with hours where known, and, with
  Metro on, its stations. An event row opens its source. An event whose dates come
  from a yearly pattern says so.
- **Filters** under the switch narrow the map: Food, Temples, Night, Shops, Art, Fun,
  Nature, and Events for areas with something on. No filter means everything.

The site's own price pins stay on top of the labels, so a pin can cover a label. Zoom
in to separate them.

All of this is written by hand in `src/site-areas-data.ts`, with a source link on each
event. Centres and radii are approximate. Another trip means replacing that file.
`tests/site-areas.test.ts` fails if an event falls outside the dates it names.

## Dark mode (Lights)

Lights darkens any website, and it is built for the pages where store dark-mode
extensions give up. It is off until you turn it on for a site, and each site keeps
its own choice.

| Mode | What it does | Best for |
|---|---|---|
| Auto | Picks one of the three below for each page | Most sites. Start here. |
| Site | Turns on the dark theme the site already ships | GitHub, MDN, Wikipedia |
| Smart | Rewrites the site's colours, keeping hues and pictures | Hacker News, BBC News |
| Invert | Flips the page with a filter and flips pictures back | A page drawn on a canvas |

Auto leaves a page that is already dark alone. Otherwise it uses the site's own dark
theme when it has one, and Smart when it does not. Smart turns light backgrounds
dark and text light, and leaves pictures as they are.

All of it is set in **Settings, Web pages**. There you set the mode for every site,
list the sites with a mode of their own (add, change or forget one), change the keys,
and see or delete your marked pages. Three ways in:

- In bfb, press `,` and pick **Web pages**.
- On any web page, open the page panel and click its gear.
- Right-click bfb's toolbar icon and choose **Options**.

A change there reaches every open tab at once, and a mode picked on a page shows in
open Settings straight away. On a page itself:

- **Alt+Shift+D** turns dark mode on or off for the site you are on.
- **Right-click, Dark mode for this site** picks a mode.
- **Alt+Shift+K** opens the page panel, with the modes and a **Use on every site**
  button that makes the current mode the default for sites you have not set.
- A site set to dark paints dark from its first frame on the next visit. It never
  flashes white while Lights reads its colours.

### How Site mode works

- **It finds the switch in the site's own selectors.** Sites hang a dark theme on a
  class at the start of many selectors (`.dark .card`,
  `html.skin-theme-clientpref-night p`) or on a `[data-theme="dark"]` attribute.
  Lights sets that switch and takes off its light twin.
- **It copies media-query dark themes.** Rules under `prefers-color-scheme: dark`
  are copied so they apply always.
- **It checks its own work.** Some dark rules sit behind a switch Lights cannot see.
  A page that still looks light after Site mode gets Smart instead, and the panel says so.

### How Smart works

- **Colours move in OKLCH, by role.** Lightness there matches what the eye sees, so
  a pale blue panel becomes a dark blue one, not the orange a plain invert makes.
- **Backgrounds fold dark and text folds light.** A black header stays dark. A CSS
  variable is judged by its name (`--surface` is a background, `--text-main` is text).
- **Stylesheets from other origins are fetched by the extension.** A page may not
  read a CDN stylesheet's rules, so the background worker fetches the text. It
  fetches only stylesheets, with no cookies.
- **Inline styles and old HTML colour attributes are read too.** Many sites set
  colours in `style=""` from script, and older ones use `bgcolor` (Hacker News).
  Lights remembers each original and puts it back when you turn it off.

### How the first frame stays dark

Chrome only applies a stylesheet before the first paint when it is registered by
address. So the background keeps one registration for dark sites and one for
inverted ones. The page waits up to 0.9 seconds for Lights, then shows anyway.

Limits:

- Pages Chrome keeps extensions out of (the Chrome Web Store, `chrome://` pages) cannot be darkened.
- Embedded frames and shadow-DOM widgets keep their own colours.
- A site that picks its theme in JavaScript from your system setting may not see Site mode.
- Smart leaves pictures as they are, so a white picture stays white.

## Comments and pins (Marks)

Marks are your own notes on any web page. They are kept in the extension, under the
page's address, and come back when you return.

- **Comment:** select words, then **Alt+Shift+M** or right-click, **Comment on "…"**.
  The words are highlighted with a small badge. Click either to open the note.
- **Pin:** with nothing selected, **Alt+Shift+M** asks where the pin goes. Or
  right-click anywhere, **Drop a pin here**. Drag a pin to move it.
- The note card saves on **⌘ Enter**, **Esc**, or a click outside. Closing never
  loses words. A new mark closed with nothing typed is dropped.
- The page panel (**Alt+Shift+K**) lists this page's marks (click one to scroll to
  it), deletes with **Undo**, copies them as Markdown, and lists every page that has marks.

### How marks find their place again

- **A comment remembers its words and a little either side.** On the next visit the
  words are searched for again. The copy whose surroundings match wins, so the same
  phrase elsewhere on the page does not take the comment.
- **Highlights use the CSS Custom Highlight API.** The site's own text is never
  wrapped or split, so React and similar frameworks do not trip over it.
- **A pin remembers its element and its spot on it.** It stays on the card or image
  it was dropped on when the page reflows. Page coordinates are the fallback.
- **The address drops tracking parameters and plain `#` anchors.** `?utm_source=…`
  links and section links land on the same marks. A single-page app's `#/route` is kept.

A comment whose words have gone from the page is listed in the panel as not found,
and is kept until you delete it.

## Adding a site plugin

1. Write the plugin in its own `src/site-<name>.ts`, with a `start()` function.
   Keep the parts that need no page in a separate file, so they can be unit tested.
2. Add it to `PLUGINS` in `src/site-plugins.ts`, with the hosts it runs on.
3. Add the same hosts to both `site-plugins.js` and `site-bridge.js` in
   `manifest.json`. Chrome will not load them anywhere else. A match pattern cannot
   wildcard a country ending, so each Airbnb country site is listed. A site missing
   from that list gets no switch.

`site-plugins.js` runs in the page with no extension privileges. Anything needing
the network or the extension's cache goes through `site-bridge.js` by
`window.postMessage`. A page can post anything, so the bridge checks each request.

## Files

| File | Holds |
|---|---|
| `src/site-plugins.ts` | The list of plugins and the hosts each runs on |
| `src/site-metro.ts` | The switch, dots, hovering, popup and loading |
| `src/site-metro-cards.ts` | The tip and popup contents, and all the overlay's styles |
| `src/site-metro-model.ts` | Finding the site's map |
| `src/site-areas-data.ts` | The areas and the trip's events, written by hand |
| `src/site-areas-model.ts` | Filtering areas, dates in words, which labels fit |
| `src/site-transit-data.ts` | Asking for an area, shrinking the answer, merging lines and stations, finding track under the pointer, Google Maps links |
| `src/site-bridge.ts` | The fetch, server fallback and request checks |
| `background.js` | Metro's 30-day cache, and the Lights and Marks menu, shortcuts, stylesheet fetch and first-frame registrations |
| `src/site-tools.ts` | Entry for Lights and Marks on every website. Answers the menu and shortcuts. |
| `src/site-lights.ts` | Lights on the page: modes, Auto's choice, inline styles, settings |
| `src/site-lights-sheets.ts` | Reading stylesheets: the Smart and Site copies, finding a site's dark switch |
| `src/site-lights-color.ts` | Moving one colour for a dark page, and which properties hold which kind |
| `assets/site-tools/early-*.css` | The first-frame stylesheets |
| `src/site-marks.ts` | Comments, pins, highlights and the note card |
| `src/site-marks-anchor.ts` | Finding a comment's words again, and the address marks are kept under |
| `src/site-tools-overlay.ts`, `src/site-tools-panel.ts` | The layer bfb draws on a page, and the page panel |
| `src/site-lights-settings.ts` | The saved modes, read the same way by pages and Settings |
| `src/settings-web.ts` | The Web pages tab in Settings |
| `options.html`, `options.js` | Chrome's Options item, which sends its tab to Settings |

## Checks

| Run | Covers |
|---|---|
| `npx vitest run tests/site-metro-model.test.ts tests/site-transit-data.test.ts` | Finding the map, which lines show, merging stations, stop order, track lookup, requests, links |
| `node e2e/site-metro-walk.mjs` | The real manifest on a stand-in page: hosts, on and off, staged loading, server fallback, failure and Retry, hover, popups, Esc, cache |
| `npx vitest run tests/site-lights-color.test.ts tests/site-lights-sheets.test.ts tests/site-marks-anchor.test.ts` | Colour moves, finding dark switches, finding a comment's words again, page addresses |
| `node e2e/site-tools-walk.mjs` | Lights and Marks in real Chrome on stand-in sites, with a stylesheet from a second origin: every mode, Auto's choices, the first frame, Off putting the page back, comments, pins, dragging, the panel, Undo |

The site tools walk sends actions the way the menu and shortcuts do. It does not
press the shortcuts or click Chrome's menu. It pins the stand-in pages to a light
system theme, since on a Mac in dark mode they would already be dark.

The walk uses stand-ins for Google's map and the servers, with a trimmed real answer
in `e2e/fixtures/overpass-tokyo.json`. It has two blind spots:

- It cannot notice a site moving its map out of React.
- It cannot tell how slow a real server is.

So if either site changes its map, or the switch goes missing, open a real search and
try it. Use a normal window for Booking, because headless Chrome gets a different
page with no live map.
