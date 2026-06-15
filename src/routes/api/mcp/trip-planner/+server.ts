import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { McpServer, type ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { ZodRawShape } from 'zod';
import { tripToolDefs } from '$lib/server/ai/tools';
import { isViewerMode, PrivateEnvValue } from '$lib/server/env.server';

// The trip tools are defined once (src/lib/server/ai/tools.ts) as Anthropic SDK
// `tool()` objects. The Claude path passes them in-process; the Codex path can't
// reach an in-process server, so this endpoint re-serves the SAME definitions over
// MCP's streamable-HTTP transport for the local Codex CLI to connect to. The
// Anthropic tool def and MCP's registerTool share Zod raw-shape input schemas and
// CallToolResult handlers — bridge them with one localized cast at the array.
type McpToolDef = {
	name: string;
	description: string;
	inputSchema: ZodRawShape;
	handler: ToolCallback<ZodRawShape>;
};

export const POST: RequestHandler = async ({ request }) => {
	// Read-only public deployment has no co-pilot, and these tools mutate trips.
	if (isViewerMode()) throw error(404, 'Not found');

	// Only this server's own Codex subprocess may reach the trip tools. The SDK
	// sends the same secret as a bearer (see providers/codex.ts). Skipped if unset,
	// since the endpoint is loopback-only in practice.
	const secret = PrivateEnvValue('MCP_BRIDGE_SECRET');
	if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
		throw error(401, 'Unauthorized');
	}

	const server = new McpServer({ name: 'trip-planner', version: '0.1.0' });
	for (const t of tripToolDefs as unknown as McpToolDef[]) {
		server.registerTool(
			t.name,
			{ description: t.description, inputSchema: t.inputSchema },
			t.handler
		);
	}

	// Stateless (fresh server+transport per request) with JSON responses — the
	// serverless-friendly mode, fine for a loopback bridge.
	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
		enableJsonResponse: true
	});
	await server.connect(transport);
	return transport.handleRequest(request);
};
