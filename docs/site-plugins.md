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

| Choice | Reason |
|---|---|
| Google's transit layer draws the lines | It appears instantly and matches the map, but it is only a picture: it reports no hover, click or line name. |
| OpenStreetMap supplies stations and details | It is free, needs no key, and carries line colours, codes, stops, hours and frequency. |
| Three separate requests per square | Public servers often refuse one big question but answer these. Stations come first because they are small and most wanted. |
| Named express trains are left out | Tokyo Station otherwise lists about 30 services, mostly Shinkansen and limited expresses. A train counts as a city line only with a line colour or a short line code. |
| Through services are left out | A code like `DT;Z` is a train running across two lines already shown. |
| The tip and popup float above the map and never move it | Panning makes Airbnb search again. |
| Clicking a dot does not reach the map | Airbnb would otherwise open its own card on top of the popup. |
| An open popup takes Esc first | Booking closes its whole map on Esc. |
| The overlay runs in the page, the fetch outside it | Only the page can reach the site's map. A site's security policy can block the page's own requests, and the worker cannot fetch: Chrome stops a worker whose fetch takes over 30 seconds. |
| The map is found by its shape in the React tree | Google offers no way from an element back to its map. Searching for anything map-shaped survives a site renaming its fields. |

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
event. Centres and radii are approximate. Another trip means replacing that file;
`tests/site-areas.test.ts` fails if an event falls outside the dates it names.

## Adding a site plugin

1. Write the plugin in its own `src/site-<name>.ts`, with a `start()` function.
   Keep the parts that need no page in a separate file, so they can be unit tested.
2. Add it to `PLUGINS` in `src/site-plugins.ts`, with the hosts it runs on.
3. Add the same hosts to both `site-plugins.js` and `site-bridge.js` in
   `manifest.json`. Chrome will not load them anywhere else. A match pattern cannot
   wildcard a country ending, so each Airbnb country site is listed; a site missing
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
| `background.js` | The 30-day cache (`bfb-transit-get`, `bfb-transit-put`) |

## Checks

| Run | Covers |
|---|---|
| `npx vitest run tests/site-metro-model.test.ts tests/site-transit-data.test.ts` | Finding the map, which lines show, merging stations, stop order, track lookup, requests, links |
| `node e2e/site-metro-walk.mjs` | The real manifest on a stand-in page: hosts, on and off, staged loading, server fallback, failure and Retry, hover, popups, Esc, cache |

The walk uses stand-ins for Google's map and the servers, with a trimmed real answer
in `e2e/fixtures/overpass-tokyo.json`. It has two blind spots:

- It cannot notice a site moving its map out of React.
- It cannot tell how slow a real server is.

So if either site changes its map, or the switch goes missing, open a real search and
try it. Use a normal window for Booking, because headless Chrome gets a different
page with no live map.
