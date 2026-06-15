---
'trip-planner': minor
---

Move persistence from local JSON files to **Convex**, with live reactive reads.

Trips, folders, and chat threads now live in a hosted Convex deployment instead of
`.data/*.json` + a committed snapshot. One deployment is shared by local dev and the
deployed app, so data no longer lives in git and edits show up everywhere instantly —
the `bun run snapshot` + commit dance is gone.

- **Reactive UI:** trips and folders are read in the browser via `convex-svelte`
  `useQuery`, so the sidebar, home grid, command palette, and trip pages live-update
  after any write — the old manual `.refresh()` calls are removed.
- **Owner-only writes, no user auth:** writes flow through the SvelteKit `command`s →
  service layer → a server-side `ConvexHttpClient` that attaches a shared
  `OWNER_WRITE_SECRET`. Public Convex queries serve reads; mutations reject anyone
  without the secret. The read-only public deployment (`VIEWER_MODE`) is simply not given
  the secret, so it can read live data but cannot write — enforced at the backend, not
  just hidden in the UI. Chats stay private (their queries are secret-gated and read only
  server-side).
- **Schema:** Convex functions + schema live in `src/convex/` (committed `_generated/`).
  Nested trip/chat bodies are stored loosely and validated by the existing Zod schemas in
  `src/lib/schemas/schemas.ts`, which remain the single source of truth.

Setup now requires a Convex account: run `bunx convex dev`, then set `OWNER_WRITE_SECRET`
on the deployment and in `.env.local` (`CONVEX_URL` + `OWNER_WRITE_SECRET`). See the
README for full first-time and deployment instructions.
