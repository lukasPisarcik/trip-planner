---
'trip-planner': minor
---

Sharpen the AI co-pilot: interactive clarifying-questions form, photos & map links, live progress, and reactive sessions.

- **"Grill-me" question form.** Before planning a new trip, the agent now calls an `ask_user` tool
  with a focused batch of mostly multiple-choice questions (single/multi-select with smart preset
  options + hints, plus free-text and an "Other" field), rendered as an interactive in-chat
  **multistep wizard** — one question at a time with a progress bar and Back/Next. Hitting "Send
  answers" feeds the choices back as the next turn, so trips start from real preferences.
- **Branded loading animation.** The generic three-dot "working" indicator is replaced by a custom
  animation built from the logo's three route stops (teal → amber → purple) hopping along a route,
  used in the chat status line and the session-loading state.
- **Real photos on viral spots.** The agent fills viral-spot images from stable, hotlinkable sources
  (prefer Wikimedia/Wikipedia), with alt text + credit; spots with no reliable image are simply left
  without a photo (no invented URLs, no broken images).
- **Google Maps links on every restaurant.** Each restaurant now gets a `mapUrl` (a Google Maps
  search link), rendered as the existing "📍 Map" link.
- **Live "working" indicator during the build.** The status line now shows "Creating your trip…"
  while the model generates the (long) `create_trip` payload — closing the dead gap after
  "…Let me build it" (driven by a new `tool-pending` event on `content_block_start`).
- **Reactive session discovery.** Newly created agent sessions appear in the sidebar / command
  palette / AI panel immediately via a chats-changed signal, instead of only after a page reload;
  a session that plans a trip moves out of Drafts and nests under the new trip live.
- **"New chat" really starts fresh.** Starting a new conversation on a trip (AI panel or
  `/agent?slug=`) no longer silently resumes that trip's latest thread — it creates a new session
  (a `newChat` flag overrides the resume-latest default).
