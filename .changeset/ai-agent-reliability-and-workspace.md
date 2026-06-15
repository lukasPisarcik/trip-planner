---
'trip-planner': minor
---

Make the AI co-pilot reliable and transparent. A stalled model stream used to hang forever and orphan the CLI subprocess; turns now have a stall/max-runtime watchdog (`AGENT_STALL_TIMEOUT_MS`, `AGENT_MAX_TURN_MS`) and the request signal + stream cancellation are wired through so navigating away or pressing the new Stop button tears the agent down. The agent's reasoning now streams as a collapsible "Thinking" block, tool actions render as friendly chips with an expandable plain-language summary (no more raw JSON dumps), and a contextual status line ("Thinking…", "Creating your trip…") replaces the content-free typing dots.

Adds a standalone agent workspace at `/agent` (and `/agent/[sessionId]` to revisit a past conversation) sharing one streaming engine with the side panel. The composer is a single embedded input box with a Claude-branded model dropdown (Opus 4.8 / Sonnet 4.6 / Haiku 4.5) and a circular send/stop control. The sidebar gains collapsible Trips, a Favorites section (star a trip to pin it), and an AI sessions list with its own "new conversation" action that opens the workspace; the collapse chevrons sit on the left so they no longer collide with the section's add button.

Starting a new conversation now always begins a fresh thread instead of resurrecting the most recent unlinked one — the active session id is tracked per conversation and resumed explicitly on follow-up turns.
