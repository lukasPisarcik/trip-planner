# Environment variables

Applies to: anything that reads env at runtime.

## Rule

All env vars are declared in `src/lib/server/env.server.ts` with Zod validation. Read them via `PrivateEnvValue('VAR_NAME')`. **Never read `Bun.env`, `process.env`, or `$env/*` modules directly elsewhere.**

## Adding a new env var

1. Add the var to `.env.example` with a placeholder value:

   ```
   STRIPE_API_KEY=sk_test_...
   ```

2. Add it to the Zod schema in `src/lib/server/env.server.ts`:

   ```ts
   const PrivateEnvSchema = z.object({
   	EXAMPLE_VAR: z.string().min(1),
   	STRIPE_API_KEY: z.string().regex(/^sk_/, 'must start with sk_')
   });
   ```

3. Use it in code:

   ```ts
   import { PrivateEnvValue } from '$lib/server/env.server';
   const apiKey = PrivateEnvValue('STRIPE_API_KEY');
   ```

4. If running tests that exercise this code, stub the env in `tests/setup-server.ts` or per-test with `vi.stubEnv('STRIPE_API_KEY', '...')`.

5. If deploying, make the var available in your host's environment (your platform's env or secret settings).

## Sanctioned exceptions (Convex)

The "declare in `env.server.ts`" rule governs **server/private** vars. Two Convex vars
legitimately live outside it because they belong to different runtimes:

- **`PUBLIC_CONVEX_URL`** is a **browser** var — the reactive `convex-svelte` client needs
  it on the client. Read it via `$env/static/public` (only in `src/routes/+layout.svelte`,
  where `setupConvex` runs). Its server-side twin `CONVEX_URL` _is_ declared in
  `env.server.ts` as usual.
- **`OWNER_WRITE_SECRET` inside `src/convex/*` functions** is read with `process.env`
  because Convex functions run in Convex's own V8 runtime, not the SvelteKit server. It's
  set on the deployment with `bunx convex env set OWNER_WRITE_SECRET …`. The SvelteKit
  server's copy of the same secret _is_ declared in `env.server.ts`.

Everywhere else, the rule stands: declare in `env.server.ts`, read via `PrivateEnvValue`.

## Why this pattern

- **Type-safe:** `PrivateEnvValue('UNKNOWN')` is a TypeScript error.
- **Boot-time validation:** missing or malformed env vars fail loudly instead of producing `undefined` errors deep in the request path.
- **One place to scan** for what config the app needs.
