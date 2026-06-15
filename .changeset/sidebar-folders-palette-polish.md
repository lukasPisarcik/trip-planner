---
'trip-planner': minor
---

Sidebar folders, a bottom "New trip" button, and palette/theme polish.

- **Trip folders (one level).** Group trips into folders from the sidebar — create/rename/delete folders, and move trips in either by drag-and-drop (`svelte-dnd-action`) or a "Move to folder ▸" submenu on each trip. Folders are collapsible rows; favorited trips now show in **both** the Favorites group and their folder. Folders persist in `.data/folders.json` (and ride into the read-only viewer snapshot). The AI is unaffected — `folderId` is an optional Trip field it never sets.
- **"New trip" moved to the sidebar footer** with a `⌘E` shortcut (⌘N is the browser's reserved "new window"); the top "+" is now a "New folder" action.
- **Command palette is now fixed.** It anchors near the top with a constant height and scrolls internally instead of resizing/recentering with the result count, shows a "No results" state, and offers a "Suggested" list (favorites + recent conversations) when the query is empty.
- **Sidebar search removed** — the ⌘K palette in the navbar covers it.
- **Dark-mode pink fix.** Pink (primary/accent) backgrounds now use white text in dark mode instead of dark maroon (command palette selection, primary buttons, dropdown hovers).
- Added README showcase screenshots.
