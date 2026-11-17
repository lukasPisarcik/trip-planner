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

## Sanctioned exceptions (browser vars + Convex)

The "declare in `env.server.ts`" rule governs **server/private** vars. A few vars
legitimately live outside it because they belong to different runtimes:

- **`PUBLIC_CONVEX_URL`** is a **browser** var — the reactive `convex-svelte` client needs
  it on the client. Read it via `$env/static/public` (only in `src/routes/+layout.svelte`,
  where `setupConvex` runs). Its server-side twin `CONVEX_URL` _is_ declared in
  `env.server.ts` as usual.
- **`PUBLIC_GOOGLE_MAPS_API_KEY`** and **`PUBLIC_GOOGLE_MAPS_MAP_ID`** are **browser**
  vars — the browser itself loads the Maps JavaScript API. Read via `$env/dynamic/public`
  (dynamic, because they're optional — a keyless checkout must still build) in exactly one
  module: the `<script module>` block of `src/lib/components/trip/TripMap.svelte`, which
  exports `hasGoogleMapsKey` for the keyless solid-hero fallback. The key is public by
  design; referrer restriction + quota caps in the Google Cloud console are the containment.
- **`OWNER_WRITE_SECRET` inside `src/convex/*` functions** is read with `process.env`
  because Convex functions run in Convex's own V8 runtime, not the SvelteKit server. It's
  set on the deployment with `bunx convex env set OWNER_WRITE_SECRET …`. The SvelteKit
  server's copy of the same secret _is_ declared in `env.server.ts`.

Everywhere else, the rule stands: declare in `env.server.ts`, read via `PrivateEnvValue`.

## Expo bridge vars (temporary)

Three optional server vars exist only while this app serves as the bridge for the Expo
port (removed in that port's milestone 3). They follow the normal rule — declared in
`env.server.ts`, read via `PrivateEnvValue`:

- **`BRIDGE_SECRET`** — bearer the Expo app sends to `/api/ai/chat` and `/api/bridge/*`.
  Unset → the bridge is disabled: every bearer is rejected and `/api/bridge/*` answers 401.
- **`BRIDGE_ALLOWED_ORIGINS`** — comma-separated CORS allow-list for those routes. The
  schema parses it, so `PrivateEnvValue('BRIDGE_ALLOWED_ORIGINS')` is a normalized
  `string[]` (empty when unset).
- **`BRIDGE_OWNER_USER_ID`** — the owner's Clerk user id. When set,
  `src/lib/server/data/convex.ts` adds it as `userId` to every secret-gated Convex
  mutation. Leave it unset until the Expo repo's Convex functions are deployed; the
  legacy functions in the (frozen) `src/convex/` reject the extra argument.

The pure bearer/CORS decision logic lives in `src/lib/server/utils/bridge.ts` (Bun test
alongside); the hook and the routes pass it these values.

## Why this pattern

- **Type-safe:** `PrivateEnvValue('UNKNOWN')` is a TypeScript error.
- **Boot-time validation:** missing or malformed env vars fail loudly instead of producing `undefined` errors deep in the request path.
- **One place to scan** for what config the app needs.
