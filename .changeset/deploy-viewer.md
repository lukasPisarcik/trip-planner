---
'trip-planner': minor
---

Add a read-only public deployment mode so trips can be viewed on a phone during the trip. Setting `VIEWER_MODE=true` (e.g. on Vercel) serves trips from a committed snapshot (`src/lib/trips/data/snapshot.json`), blocks all writes at the service layer, returns 404 from the AI chat endpoint, and hides the AI co-pilot, create/delete actions, and the Brainstorm tab in the UI. Locally the app is unchanged (full AI + editing). Run `bun run snapshot` to bake the current local trips into the snapshot, then commit + push to publish. Switched the adapter from `adapter-node` to `adapter-vercel` and made the env loader cross-runtime (`process.env`).
