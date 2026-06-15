---
'trip-planner': minor
---

Polish the AI chat and harden the agent runtime. Messages adopt a T3/Claude-style layout: assistant replies render bare on the page (no bubble) while your own messages sit in a soft-pink bubble (the ⌘E badge color) so the two are easy to tell apart. The composer gains a context-usage gauge next to Send — a small ring + percent (with a `used / total` tokens tooltip) fed by the SDK's own per-turn accounting — and turns that fail now raise a toast in addition to the inline alert. When the agent finishes planning a brand-new trip, a "View your trip →" card appears with a direct link (plus a success toast) instead of silently navigating away.

Fixes the agent reliability issues behind a stuck run: the SDK turn now runs in isolation (`settingSources: []`, `strictMcpConfig: true`, and a built-in `disallowedTools` list) so the host's globally-configured MCP servers (e.g. Playwright) and tool allow-lists no longer leak in and stall the turn. The per-turn budget (`AGENT_MAX_TURN_MS`) default is raised from 5 to 10 minutes so research-heavy first builds finish instead of being aborted mid-plan. A turn that errors before producing any reply now persists an `error` message, so reloading a conversation shows what went wrong rather than a dangling, unanswered question.
