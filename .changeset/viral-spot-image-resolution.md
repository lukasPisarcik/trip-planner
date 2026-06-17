---
'trip-planner': minor
---

Make viral-spot (and restaurant) photos reliably fill in. The agent could only find images with `WebSearch`/`WebFetch`, which return page text — never the exact hotlinkable `upload.wikimedia.org` thumbnail URL — so, told never to invent a URL, it omitted the image almost every time.

Adds a Wikimedia-backed image resolver (`src/lib/server/services/images.service.ts`) wired up two ways: a new `find_image` agent tool (available to both the Claude and Codex providers via MCP) that returns a real `{ url, alt, credit }` to drop straight into a spot or restaurant, and a server-side safety net that backfills any image the agent still left empty when a viral/restaurants tab or new trip is saved. Restaurant backfill applies a relevance guard (the matched Wikipedia page must share a significant token with the place name) since restaurant names resolve poorly on Wikimedia; viral-spot landmarks are filled directly. The prompts and tool descriptions now steer the agent to `find_image` instead of hand-writing URLs, and the duplicated image object is extracted into a shared `ImageSchema`.
