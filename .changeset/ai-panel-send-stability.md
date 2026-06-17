---
'trip-planner': patch
---

Fix the AI side panel losing its conversation when you send a message or expand it
into the agent workspace. Three issues compounded:

- The panel is gated on `aiPanelAvailable`, derived from the live `listTrips`
  Convex subscription. A co-pilot turn briefly drove that query's data to
  `undefined`, collapsing `currentTrip` and unmounting/remounting the whole panel
  mid-conversation (resetting it to the conversation list). `currentTrip` now holds
  its last resolved value through a transient `undefined`.
- `ChatSession.reset()` called into `chatActivityStore`, which made the panel's
  trip-switch `$effect` reactively depend on the active session. Registering a turn
  then re-fired that effect, aborting the request that had just started. `reset()`
  no longer touches the store.
- Navigating to the standalone `/agent` workspace emptied the trip slug, firing the
  same trip-switch effect and stopping the in-flight turn — so the expanded page had
  nothing live to show. The effect now resets only on an actual trip→trip switch.

With these, sending keeps the panel on the streaming turn, and expanding mid-run
carries the live turn (output, tools, loading) into the agent workspace.
