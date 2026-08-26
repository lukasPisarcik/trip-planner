---
'trip-planner': minor
---

Make big multi-country, many-reel builds routine: the co-pilot now builds trips in small checkpointed stages instead of one giant fragile write, and the turn watchdog stops killing long builds.

- **Staged builds.** `create_trip` now takes a skeleton (headline fields only — the six core tabs default to empty shells), so the trip page renders seconds into a build. A new `upsert_itinerary_days` tool writes the itinerary in chunks of up to 5 days, merged atomically by day number inside a single Convex mutation (replace matching numbers, append new ones in numeric order); every chunk persists immediately, so an aborted turn loses at most one chunk. The new-trip prompt directs this flow: skeleton → day chunks → one call per remaining tab → review.
- **No more truncated tool calls.** The spawned Claude CLI gets `CLAUDE_CODE_MAX_OUTPUT_TOKENS` from a new `AGENT_MAX_OUTPUT_TOKENS` (default 64K — the CLI's 32K default truncated a ~50KB itinerary call mid-JSON), and thinking is budgeted via `AGENT_MAX_THINKING_TOKENS` (default 16K).
- **Graceful turn cap.** `AGENT_MAX_TURN_MS` rises to 30 minutes, and at the cap the Claude runner now calls `query.interrupt()` (ends the turn like Esc, keeping the session cleanly resumable) with a 30s hard-abort backstop instead of killing the subprocess mid-flight. A new first-event grace (`AGENT_FIRST_EVENT_TIMEOUT_MS`, default 8 min) lets resumes survive cold-cache time-to-first-token and silent rate-limit backoff; the 180s mid-stream stall detector is unchanged.
- **25 reels, no duplicate context.** The attachment cap rises from 12 to 25, and chats persist which reel ids were already hydrated into the provider's native thread — a same-provider resume no longer re-injects the same reel blocks (a provider switch starts a fresh thread and re-hydrates everything).
