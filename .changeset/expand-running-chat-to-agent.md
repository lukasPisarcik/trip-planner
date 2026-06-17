---
'trip-planner': patch
---

Expanding a streaming chat into the agent workspace now follows the live turn.
The "Open in agent workspace" icon navigated by the panel's `selectedSessionId`,
which isn't set until a new chat's first turn settles, so expanding mid-run opened
a fresh `/agent` chat and orphaned the running one. It now prefers the session id
learned from the in-flight turn.

The agent workspace also renders the in-flight turn itself — the streaming reply,
tool calls, and loading state — instead of just the user's message. The active
`ChatSession` is registered on `chatActivityStore`, so a surface that didn't start
the turn (the agent page opened from the panel or sidebar) reads its live items and
status. The user message is persisted with the client-supplied id so its live echo
and the loaded copy dedupe, and the session-scoped page holds the live turn until
it settles before falling back to persisted history.
