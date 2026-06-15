---
'trip-planner': minor
---

Rework the AI assistant to be trip-scoped, with a per-trip conversation picker.

- **The slide-in AI assistant is now only available on a trip page** — so you chat with the co-pilot and see the trip side by side. It no longer appears on the home page.
- **Planning a new trip opens the standalone `/agent` workspace** (sidebar "New trip" / ⌘E / the command palette) instead of the slide-in panel.
- **Opening the assistant shows the trip's past conversations** with a "New chat" button: pick one to resume its history, or start fresh. "Open in agent workspace" expands the current conversation (or a trip-scoped new chat) into `/agent`.
- **Fixed the off-center `/agent` view** — the content no longer reserved the panel's 380px width on routes where the panel isn't shown.
- The AI panel was rebuilt with Tailwind utility classes (no scoped `<style>`).
