---
'trip-planner': minor
---

Reshape the sidebar around a trip → session hierarchy (T3-style) and sharpen trip generation.

Sidebar: AI chat sessions now nest **under the trip they belong to** — each trip is an expandable row (chevron on
the left, name still links to the trip, hover `+` starts a new conversation scoped to that trip, and a `⋯` menu
holds favorite/delete). The standalone "AI sessions" section is gone; unlinked conversations collect in a
**Drafts** group at the bottom, and Favorites stay pinned on top. A **search box** live-filters trips and session
titles, auto-expanding matches, and long session lists collapse behind "Show more".

Trip quality: the agent can now **research the web** (`WebSearch`/`WebFetch` are enabled), so itineraries use
current hours, prices, ratings and trending spots instead of stale memory — surfaced as 🔎/🌐 activity chips. New
trips default to **Opus 4.8** (until you pick another model), and the system prompt was rewritten for better
discovery questions, geographic day-clustering, realistic pacing/timings, web-grounded facts, and a self-review
pass before finishing.
