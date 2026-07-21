---
'trip-planner': patch
---

Fix the map backdrop breaking page scroll when a day is opened in the itinerary. Focusing a day flies the persistent Leaflet map to that day's stops, and its zoom-animation proxy element could escape an unclipped container and inflate `document.scrollHeight` (measured lurching from ~3.4k to 13k px on a single focus), leaving part of the itinerary unreachable. The container now always clips its contents (`overflow-hidden`), and the reactive `pointer-events` state moved from the class string into `class:` directives so Svelte no longer rewrites the whole `class` attribute and strips the `leaflet-container`/`leaflet-touch`/`leaflet-fade-anim` classes Leaflet adds imperatively.
