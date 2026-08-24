# Dev-cycle project binding — Trip Planner

The **project-specific** half of the dev-cycle contract. The generic contract
(`~/.claude/docs/dev-cycle.md`, or a repo copy if one is added) defines the stages,
handoff, branching, validation loop, and severity taxonomy. **This file is
authoritative for everything concrete in _this_ repo**: the commands that run, the
paths that matter, the hard rules, how the UI is verified, and how PRs are opened.

Stack: SvelteKit 2 + Svelte 5 (runes) + Bun + Tailwind 4 + shadcn-svelte, with Zod
validation, Convex persistence, and Changesets. Use Bun everywhere (`bun run`,
`bunx`, `Bun.env`, `Bun.file`).

## Validation gate

Run cheap checks before slow ones. The full gate is exactly these two commands
(both must be green — never weaken them to pass):

```bash
bun run check   # bunx svelte-kit sync && bunx svelte-check --tsconfig ./tsconfig.json  (types)
bun run lint    # bunx prettier --check . && bunx eslint .                              (format + lint)
```

- `bun run test` is an **alias for `check && lint`** — there is no separate unit/E2E
  suite. Despite `CLAUDE.md` / `.claude/docs/testing.md` describing a three-runner
  setup (`*.test.ts` in Bun, `*.svelte.test.ts` in Vitest/Chromium, Cypress E2E),
  **no Vitest or Cypress config is currently wired**. Treat those runners as
  aspirational: if a change genuinely needs an automated test, standing up the runner
  is its own scoped task — don't assume `bun run test:unit` / `cypress` exist.
- `bunx prettier --write .` auto-fixes formatting failures from `lint`.
- CI additionally runs `bunx changeset status --since=origin/main` on source PRs — a
  source change without a changeset fails CI (see "Change-documentation").

## UI verification

The Playwright MCP is the primary tool for user-facing changes; the dev server is
`bun run dev` on **http://localhost:5173** (start it detached, e.g. into
`$CLAUDE_JOB_DIR/tmp/dev.log`).

- Drive the affected flow live and assert against the plan's Acceptance Criteria —
  prefer `browser_evaluate` to measure real geometry/state (e.g. `document.scrollHeight`,
  `getComputedStyle`, `classList`) over eyeballing, and capture a screenshot for proof.
- The richest reproduction trip is `/trips/japan-christmas-3weeks` (a 21-day itinerary
  with many coord-bearing stops — good for map/scroll/layout bugs).
- There is **no automated browser-test harness** to fall back to (see the gate above),
  so the live Playwright drive _is_ the regression check. Clean up: stop the dev server
  and delete any screenshot artifact from the repo root when done.

## Bug telemetry

**None connected.** No observability/telemetry MCP (Dash0 etc.) is wired, and the
public build is a read-only viewer. Ground bug root-cause analysis in a **local
reproduction + code reading** (and live Playwright measurement for client-side
defects), and state that telemetry was not consulted.

## VCS, branch base & PR mechanism

- **Host:** GitHub (`github.com:lukasPisarcik/trip-planner`). PR tool: **`gh`**.
- **Base branch:** `main`. Never commit/push to `main` directly.
- **Branch naming:** `<type>/<slug>` from the plan's `#plan-meta` — `feat/…`,
  `fix/…`, `chore/…`. Branch off **fresh `origin/main`** (`git switch -c <branch>
origin/main`) so the branch isn't based on a stale local `main` or a prior merged
  feature branch.
- **Commit style:** Conventional Commits, type from `#plan-meta`. End the message
  with the `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
  trailer.
- **Opening the PR:** `gh pr create --base main --head <branch>` with a title (the
  commit summary) and a body = summary + plan path + Acceptance-Criteria checklist +
  validation results. End the body with the `🤖 Generated with [Claude Code]` line.
  **Open but never auto-merge**; only push the feature branch, never force-push,
  never `--no-verify`. If `gh` is unavailable, the push prints a
  `pull/new/<branch>` URL — surface that instead of hard-failing.

## Change-documentation convention

**Changesets** (`.changeset/*.md`). Required for any user-facing behavior change;
CI enforces it via `bunx changeset status --since=origin/main`.

- Create with `bun changeset` (or write the file directly, matching existing entries).
- Format: frontmatter `'trip-planner': <bump>` then a short enriched paragraph — what
  changed **and why** (existing entries are a single paragraph, not bullet lists).
- Bump scheme: **major** = breaking, **minor** = new additive feature, **patch** =
  bug fix / no-user-visible refactor.
- **Exempt** (no changeset): pure docs (`README`, `.claude/docs/*`), test-only
  changes, CI/CD tweaks, and internal refactors that change nothing for users.
- Commit the `.changeset/*.md` **together with** the code in the Ship stage.

## Hard rules (from CLAUDE.md — read before editing)

1. **All Zod schemas** live in `src/lib/schemas/schemas.ts` — never inline or in
   feature folders.
2. **All env vars** are declared and Zod-validated in `src/lib/server/env.server.ts`
   — never read `Bun.env` / `process.env` / `$env/*` directly elsewhere.
3. **Never edit `src/lib/components/ui/`** — those are shadcn-svelte generated;
   override in your own components or use the CLI.
4. **Server logic** goes in `src/lib/server/services/`, called from thin remote
   functions (`command`s). Never call Convex from feature code — go through the
   service layer (which uses the secret-gated `ConvexHttpClient`).
5. **Tests:** `*.test.ts` = Bun (server, plain TS), `*.svelte.test.ts` = Vitest
   browser (Svelte) — _when a runner exists_ (see the gate note above).
6. **No plain CSS** — Tailwind utilities only; no scoped `<style>`, new CSS files, or
   static inline `style`. Use design-token arbitrary values (`bg-(--cream)`,
   `text-(--ink2)`) and the shared `.glass` class. **Only exception:**
   map-provider-injected DOM (e.g. Google Maps info-window chrome/controls) that
   utilities can't reach — style it in a minimal scoped `<style>` block with
   `:global(...)`. Advanced-marker content is our own DOM — utilities apply normally.

## Persistence note

Trips, folders, and chat threads live in **Convex** (shared deployment, not in git).
Schema + functions in `src/convex/`; writes are secret-gated mutations reached only
through the service layer. `VIEWER_MODE=true` (Vercel) blocks writes and hides the
co-pilot. Deploy = merge to `main` + push Convex functions. No env/schema/Convex
change is needed for pure client-side fixes.
