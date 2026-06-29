---
'trip-planner': minor
---

Make the map a persistent liquid-glass backdrop for the whole trip view, replacing
the per-day inline maps.

- **One map, always present.** A single Leaflet map mounts once in `TripView` —
  outside the tab switch — so it never remounts or reloads when you change tabs. It
  shows every coord-bearing spot at once (itinerary stops + restaurants + viral
  spots) as a constant marker set, refactored onto a new shared `TripMap` primitive
  (the old `DayMap` is removed).
- **Liquid glass over the live map.** A condensed, translucent hero, tab bar and
  content panels float over the map (`backdrop-filter`), driven by new `--glass-*`
  tokens that flip per theme so everything stays legible in light and dark.
- **Collapses on scroll, expands on demand.** Scrolling shrinks the backdrop to a
  peek (and condenses the hero); scrolling back up re-expands it, with
  `invalidateSize()` keeping tiles correct through the resize. An expand control
  blows the map up to a near-fullscreen, fully-interactive view (and back), with the
  background made `inert` while it's open and `prefers-reduced-motion` respected.
- **Opening a day flies there.** Clicking a day flies the backdrop to that day's
  stops and draws its numbered route; "Show all spots" returns to the full cloud.
- **Backward-compatible data.** `RestaurantSchema` and `ViralSpotSchema` gain an
  optional `coords` field (coord-less trips still validate and simply fall back to
  the original solid hero with no map). Coordinate population (geocoding) remains a
  separate, later phase.
