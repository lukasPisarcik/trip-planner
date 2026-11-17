import { describe, expect, test } from 'bun:test';
import {
	bearerStatus,
	constantTimeEqual,
	corsHeaders,
	decideBridgeRequest,
	isOriginAllowed,
	parseAllowedOrigins,
	withOwnerUserId,
	type BridgeRequestInfo
} from './bridge';

const SECRET = 'bridge-secret-for-tests';
const ORIGINS = parseAllowedOrigins('http://localhost:8081, https://app.example.com/');

function req(overrides: Partial<BridgeRequestInfo>): BridgeRequestInfo {
	return {
		method: 'POST',
		pathname: '/api/bridge/reels/save',
		origin: null,
		authorization: null,
		secret: SECRET,
		allowedOrigins: ORIGINS,
		...overrides
	};
}

describe('parseAllowedOrigins', () => {
	test('splits, trims, lower-cases and drops trailing slashes and blanks', () => {
		expect(parseAllowedOrigins(' http://LOCALHOST:8081 ,, https://app.example.com/ ')).toEqual([
			'http://localhost:8081',
			'https://app.example.com'
		]);
	});

	test('unset or empty means no origin is allowed', () => {
		expect(parseAllowedOrigins(undefined)).toEqual([]);
		expect(parseAllowedOrigins('')).toEqual([]);
	});
});

describe('constantTimeEqual', () => {
	test('matches equal strings and rejects different ones of any length', () => {
		expect(constantTimeEqual('abc', 'abc')).toBe(true);
		expect(constantTimeEqual('abc', 'abd')).toBe(false);
		expect(constantTimeEqual('abc', 'abcd')).toBe(false);
		expect(constantTimeEqual('', 'abc')).toBe(false);
	});
});

describe('bearerStatus', () => {
	test('absent when no header is sent', () => {
		expect(bearerStatus(null, SECRET)).toBe('absent');
		expect(bearerStatus(undefined, SECRET)).toBe('absent');
		expect(bearerStatus('', SECRET)).toBe('absent');
	});

	test('valid only for the exact secret', () => {
		expect(bearerStatus(`Bearer ${SECRET}`, SECRET)).toBe('valid');
		expect(bearerStatus(`bearer ${SECRET}`, SECRET)).toBe('valid');
		expect(bearerStatus(`Bearer ${SECRET}x`, SECRET)).toBe('invalid');
		expect(bearerStatus('Bearer wrong', SECRET)).toBe('invalid');
	});

	test('non-bearer schemes and empty tokens are invalid', () => {
		expect(bearerStatus(`Basic ${SECRET}`, SECRET)).toBe('invalid');
		expect(bearerStatus('Bearer', SECRET)).toBe('invalid');
		expect(bearerStatus('Bearer ', SECRET)).toBe('invalid');
	});

	test('every bearer is invalid while the bridge is disabled (secret unset)', () => {
		expect(bearerStatus('Bearer anything', undefined)).toBe('invalid');
		expect(bearerStatus('Bearer undefined', undefined)).toBe('invalid');
		expect(bearerStatus('Bearer ', undefined)).toBe('invalid');
	});
});

describe('origin allow-list', () => {
	test('exact match after normalization only', () => {
		expect(isOriginAllowed('http://localhost:8081', ORIGINS)).toBe(true);
		expect(isOriginAllowed('https://APP.example.com', ORIGINS)).toBe(true);
		expect(isOriginAllowed('http://localhost:8082', ORIGINS)).toBe(false);
		expect(isOriginAllowed('https://evil.example.com', ORIGINS)).toBe(false);
		expect(isOriginAllowed('https://app.example.com.evil.io', ORIGINS)).toBe(false);
		expect(isOriginAllowed(null, ORIGINS)).toBe(false);
	});

	test('corsHeaders echoes an allowed origin and is empty otherwise', () => {
		expect(corsHeaders('http://localhost:8081', ORIGINS)).toEqual({
			'access-control-allow-origin': 'http://localhost:8081',
			vary: 'Origin'
		});
		expect(corsHeaders('https://evil.example.com', ORIGINS)).toEqual({});
		expect(corsHeaders(null, ORIGINS)).toEqual({});
		expect(corsHeaders('http://localhost:8081', [])).toEqual({});
	});
});

describe('decideBridgeRequest', () => {
	test('ignores every non-bridge route, even with a valid bearer', () => {
		for (const pathname of ['/', '/trips/japan', '/api/mcp/trip-planner', '/api/ai/chatx']) {
			expect(decideBridgeRequest(req({ pathname, authorization: `Bearer ${SECRET}` }))).toEqual({
				action: 'ignore'
			});
		}
	});

	test('bridge-only routes: valid bearer is allowed, with CORS for a listed origin', () => {
		expect(
			decideBridgeRequest(
				req({ authorization: `Bearer ${SECRET}`, origin: 'http://localhost:8081' })
			)
		).toEqual({
			action: 'allow',
			cors: { 'access-control-allow-origin': 'http://localhost:8081', vary: 'Origin' }
		});
	});

	test('bridge-only routes: valid bearer from an unlisted origin gets no CORS headers', () => {
		expect(
			decideBridgeRequest(
				req({ authorization: `Bearer ${SECRET}`, origin: 'https://evil.example.com' })
			)
		).toEqual({ action: 'allow', cors: {} });
	});

	test('bridge-only routes: missing or wrong bearer is unauthorized', () => {
		expect(decideBridgeRequest(req({})).action).toBe('unauthorized');
		expect(decideBridgeRequest(req({ authorization: 'Bearer nope' })).action).toBe('unauthorized');
		expect(
			decideBridgeRequest(req({ pathname: '/api/bridge/reels/retry', authorization: 'Bearer' }))
				.action
		).toBe('unauthorized');
	});

	test('bridge disabled (no secret): bridge-only routes reject every caller', () => {
		expect(decideBridgeRequest(req({ secret: undefined })).action).toBe('unauthorized');
		expect(
			decideBridgeRequest(req({ secret: undefined, authorization: 'Bearer anything' })).action
		).toBe('unauthorized');
	});

	test('chat: valid bearer is allowed, no bearer falls through to the session gate', () => {
		const pathname = '/api/ai/chat';
		expect(decideBridgeRequest(req({ pathname, authorization: `Bearer ${SECRET}` })).action).toBe(
			'allow'
		);
		expect(decideBridgeRequest(req({ pathname }))).toEqual({ action: 'session' });
		expect(decideBridgeRequest(req({ pathname, secret: undefined }))).toEqual({
			action: 'session'
		});
	});

	test('chat: a presented-but-wrong bearer is unauthorized, never downgraded to session', () => {
		const pathname = '/api/ai/chat';
		expect(decideBridgeRequest(req({ pathname, authorization: 'Bearer wrong' })).action).toBe(
			'unauthorized'
		);
		expect(
			decideBridgeRequest(req({ pathname, secret: undefined, authorization: `Bearer ${SECRET}` }))
				.action
		).toBe('unauthorized');
	});

	test('preflight from an allowed origin is answered 204 with the CORS grant', () => {
		for (const pathname of ['/api/ai/chat', '/api/bridge/reels/save']) {
			expect(
				decideBridgeRequest(req({ method: 'OPTIONS', pathname, origin: 'http://localhost:8081' }))
			).toEqual({
				action: 'preflight',
				status: 204,
				headers: {
					'access-control-allow-origin': 'http://localhost:8081',
					vary: 'Origin',
					'access-control-allow-methods': 'POST, OPTIONS',
					'access-control-allow-headers': 'authorization, content-type, accept',
					'access-control-max-age': '600'
				}
			});
		}
	});

	test('preflight from an unlisted or missing origin gets 403 and no CORS headers', () => {
		expect(
			decideBridgeRequest(req({ method: 'OPTIONS', origin: 'https://evil.example.com' }))
		).toEqual({ action: 'preflight', status: 403, headers: {} });
		expect(decideBridgeRequest(req({ method: 'OPTIONS' }))).toEqual({
			action: 'preflight',
			status: 403,
			headers: {}
		});
		expect(
			decideBridgeRequest(
				req({ method: 'OPTIONS', origin: 'http://localhost:8081', allowedOrigins: [] })
			)
		).toEqual({ action: 'preflight', status: 403, headers: {} });
	});
});

describe('withOwnerUserId', () => {
	test('returns the very same args object while no owner id is configured', () => {
		const args = { secret: 's', name: 'Japan' };
		expect(withOwnerUserId(args, undefined)).toBe(args);
		expect(withOwnerUserId(args, '')).toBe(args);
	});

	test('stamps secret-gated writes only, without mutating the input', () => {
		const args = { secret: 's', name: 'Japan' };
		const stamped: Record<string, unknown> = withOwnerUserId(args, 'user_1');
		expect(stamped).toEqual({ secret: 's', name: 'Japan', userId: 'user_1' });
		expect(args).toEqual({ secret: 's', name: 'Japan' });

		const ungated = { name: 'Japan' };
		expect(withOwnerUserId(ungated, 'user_1')).toBe(ungated);
		expect(withOwnerUserId(undefined, 'user_1')).toBeUndefined();
	});
});
