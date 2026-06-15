---
'trip-planner': minor
---

Quick navigation, conversation deletion, and a tablet responsiveness fix.

- **⌘K command palette** — a global quick-switcher (⌘K / Ctrl-K, or the new header search button) that fuzzy-searches every trip and conversation and offers the top actions (All trips, Plan a new trip, New conversation). Navigates on Enter, closes on Escape.
- **Delete a conversation** — sidebar chat sessions (both the ones nested under a trip and the Drafts group) now expose a trash action on hover, behind a confirmation dialog. Deleting the conversation you're viewing returns you to its trip (or the agent home) so the route can't 404 on a dead session.
- **Tablet overflow fix** — at the ~768–1023px range the expanded sidebar used to push trip pages and the agent workspace into horizontal overflow (clipping the tab bar, day cards, and chat bubbles). The main content now shrinks correctly (`min-w-0`), so wide pieces scroll/wrap inside it instead of overflowing the page; tool chips also truncate their labels.
