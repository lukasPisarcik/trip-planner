/**
 * Cryptographic utilities for JWT and session management.
 */

/**
 * Convert a hex-encoded string to a Uint8Array buffer.
 */
export function hexToBuffer(hex: string): Uint8Array {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < hex.length; i += 2) {
		bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
	}
	return bytes;
}

/**
 * Convert a byte buffer to a lowercase hex string.
 */
export function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
	const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
	return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// Site-gate session tokens (see src/hooks.server.ts).
//
// The session cookie value is an HMAC-SHA256 tag over a fixed message, keyed by
// SITE_PASSWORD. Deterministic on purpose: no server-side session store, and
// rotating the password invalidates every outstanding session at once.
// ---------------------------------------------------------------------------

/** Name of the site-gate session cookie (shared by the hook and the /login action). */
export const SESSION_COOKIE = 'tp_session';

const SESSION_MESSAGE = 'trip-planner-session-v1';

async function hmacTag(password: string, message: string): Promise<Uint8Array> {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(password),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
}

/** Constant-time comparison of two byte arrays (length leak is fine — tags are fixed-size). */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
	return diff === 0;
}

/** Mint the session-cookie value proving knowledge of the site password. */
export async function mintSessionToken(password: string): Promise<string> {
	return bufferToHex(await hmacTag(password, SESSION_MESSAGE));
}

/** Verify a session-cookie value against the current site password, timing-safely. */
export async function verifySessionToken(
	token: string | undefined,
	password: string
): Promise<boolean> {
	if (!token) return false;
	const expected = await hmacTag(password, SESSION_MESSAGE);
	let provided: Uint8Array;
	try {
		if (token.length !== expected.length * 2 || /[^0-9a-f]/.test(token)) return false;
		provided = hexToBuffer(token);
	} catch {
		return false;
	}
	return timingSafeEqual(provided, expected);
}

/** Constant-time comparison of two strings (the submitted vs. configured password). */
export async function passwordsMatch(submitted: string, configured: string): Promise<boolean> {
	// Compare HMAC tags instead of raw strings so length differences don't leak.
	const a = await hmacTag(configured, submitted);
	const b = await hmacTag(configured, configured);
	return timingSafeEqual(a, b);
}
