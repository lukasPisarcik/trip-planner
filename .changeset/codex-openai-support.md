---
'trip-planner': minor
---

Add OpenAI / Codex models to the AI co-pilot, alongside Claude.

The model picker now offers two providers, each running the agent the same way —
through a locally-installed CLI authenticated by a local login: **Claude** via the
Claude Code SDK and **OpenAI / Codex** via the Codex SDK (`~/.codex/auth.json`).

- **Local-licence detection.** The server checks each provider's local CLI login and
  surfaces availability to the client. A provider's models stay visible in the picker
  but **disabled** when its login isn't detected (with a "not signed in" hint and a
  provider-specific prompt — `claude login` / `codex login`). Detection is best-effort
  UX; the request-time auth error remains authoritative.
- **Same picker, real logos.** The existing composer dropdown is reused, grouped by
  vendor, showing the official OpenAI mark next to the Claude mark.
- **Full execution.** Selecting a GPT/Codex model routes the turn through the Codex CLI.
  Both providers are normalized to a single internal event stream, so streaming text,
  thinking, tool calls, the `ask_user` form, `create_trip` linking, usage, and timeouts
  all behave the same regardless of provider. The trip tools are shared with Codex over
  an in-app MCP endpoint (`/api/mcp/trip-planner`), and Codex threads resume via new
  optional `provider` / `providerThreadId` columns on the `chats` table.

New optional env vars (see `.env.example`): `OPENAI_MODEL`, `CODEX_PATH`,
`MCP_BRIDGE_SECRET`. Sign in with `codex login` to enable the OpenAI models.
