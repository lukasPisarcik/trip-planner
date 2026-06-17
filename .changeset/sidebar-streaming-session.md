---
'trip-planner': patch
---

Show a brand-new chat in the conversation list (with a live "Working…" indicator) while its turn is still streaming. The chat record is created before streaming but the rest of its messages are only persisted when the turn settles, and `listChats` hides empty threads — so a freshly-started session had no list row until it finished, making an in-progress run invisible. The server now persists the user's message up front, so once the client learns the new session id and refreshes the chat lists the row appears mid-run and reflects its streaming status.
