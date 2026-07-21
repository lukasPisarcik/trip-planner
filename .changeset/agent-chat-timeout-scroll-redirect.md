---
'trip-planner': minor
---

Fix the co-pilot's turn loop so long builds stop timing out mid-work, and smooth out three rough edges around it.

- **No more false timeouts.** The stall watchdog is now paused while a tool is executing — a legitimately slow batch of image fetches or web searches (worse on a slow connection) no longer aborts a working turn. The stall timer only guards a genuinely dead stream; the max-runtime timer stays the backstop for a truly hung tool or a crashed subprocess. Defaults are raised to sane values (stall 90s → 180s, max 10m → 20m, both still env-overridable), and the SSE stream now sends a keepalive so an idle proxy can't drop a long quiet tool phase. A timed-out/errored turn shows a one-click **Continue** button that resumes the persisted session without retyping and survives a reload.
- **Run timer.** A live `m:ss` counter ticks next to the working indicator while a turn streams, and a settled reply shows a persisted "Ran for `m:ss`" that survives reload.
- **Autoscroll follows streaming.** The message list now keeps the latest content in view while a thinking block or reply streams, and pauses when you scroll up to read — resuming when you return to the bottom.
- **Early redirect from `/agent`.** Starting a build on the new-trip view now flips the URL to `/agent/[sessionId]` as soon as the session id is known (trip created or not), so the run keeps streaming in the real chat view with a durable "View trip" card instead of stranding you on the new-trip screen.
