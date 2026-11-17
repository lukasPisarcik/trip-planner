# `src/convex/` is frozen

From milestone 1 of the Expo port on, the **`trip-planner-expo` repository owns and
deploys this Convex deployment's functions**. Its `convex/` folder is the source of
truth: user-scoped queries and mutations, plus re-exports of the legacy secret-gated
functions this SvelteKit server still calls while it acts as the bridge.

- Do not edit the files in this folder.
- Do not run `bunx convex dev` or `bunx convex deploy` from this repository — it would
  overwrite the newer functions on the shared deployment.
- `_generated/` stays committed so this app keeps type-checking against the legacy
  function signatures it calls.

This server stamps the owner's user id on its writes only when `BRIDGE_OWNER_USER_ID`
is set (see `src/lib/server/data/convex.ts`); with it unset its requests are identical
to what these legacy functions expect. The folder is deleted with the bridge in the
port's last milestone.
