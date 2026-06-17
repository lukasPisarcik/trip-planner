import type { SocialPost, SocialPlatform } from '$lib/schemas';

// Extracts caption/author/thumbnail metadata from a TikTok or Instagram post URL,
// so the co-pilot can turn a pasted reel link into a restaurant or viral spot.
//
// Everything here is best-effort: a failed/blocked lookup returns null and never
// throws into the agent path. TikTok uses the official, keyless oEmbed endpoint;
// Instagram has no usable public metadata API, so we parse OpenGraph tags off the
// public reel page — which Instagram often hides behind a login wall, in which
// case we return null and the agent asks the traveler to paste the caption.
//
// Kept dependency-light on purpose (only Zod types) so it stays runnable under
// `bun test` — importing the pino logger would pull in `$app/environment`.

// A browser-ish UA — Instagram is more likely to serve OG tags than a login wall.
const USER_AGENT = 'Mozilla/5.0 (compatible; trip-planner/0.1; +https://github.com/)';
const FETCH_TIMEOUT_MS = 6000;
// Cap a caption so a runaway description doesn't bloat the agent's context.
const MAX_CAPTION = 600;

/**
 * Detect the platform from a pasted URL, or null if it isn't a supported host.
 * Doubles as an SSRF guard: only these hosts are ever fetched.
 */
export function detectPlatform(rawUrl: string): SocialPlatform | null {
	let host: string;
	try {
		host = new URL(rawUrl.trim()).hostname.replace(/^www\./, '').toLowerCase();
	} catch {
		return null;
	}
	if (host === 'tiktok.com' || host.endsWith('.tiktok.com') || host === 'vm.tiktok.com')
		return 'tiktok';
	if (host === 'instagram.com' || host.endsWith('.instagram.com') || host === 'instagr.am')
		return 'instagram';
	return null;
}

/** Trim, collapse whitespace, and cap length. Returns undefined for empty input. */
function cleanText(value: string | undefined): string | undefined {
	if (!value) return undefined;
	const cleaned = value.replace(/\s+/g, ' ').trim();
	if (!cleaned) return undefined;
	return cleaned.length > MAX_CAPTION ? cleaned.slice(0, MAX_CAPTION).trimEnd() + '…' : cleaned;
}

/** Keep an image URL only if it's a valid http(s) URL (CDN hosts vary; no host allowlist). */
function safeImageUrl(value: string | undefined): string | undefined {
	if (!value) return undefined;
	try {
		const u = new URL(value);
		return u.protocol === 'https:' || u.protocol === 'http:' ? value : undefined;
	} catch {
		return undefined;
	}
}

/** Minimal HTML-entity decode for OpenGraph content (which is HTML-escaped). */
function decodeEntities(value: string | undefined): string | undefined {
	if (!value) return undefined;
	return value
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#0?39;/g, "'")
		.replace(/&apos;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>');
}

/** Instagram's og:title is usually "<name> on Instagram: …" — pull the handle/name. */
function parseInstagramAuthor(title: string | undefined): string | undefined {
	if (!title) return undefined;
	const m = title.match(/^(.+?)\s+on Instagram/i);
	return cleanText(m?.[1]);
}

/** TikTok oEmbed — public, keyless. Returns title (caption), author_name, thumbnail_url. */
async function extractTikTok(url: string): Promise<SocialPost | null> {
	const api = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
	try {
		const res = await fetch(api, {
			headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
		});
		if (!res.ok) return null;
		const data = (await res.json()) as {
			title?: string;
			author_name?: string;
			thumbnail_url?: string;
		};
		return {
			platform: 'tiktok',
			sourceUrl: url,
			caption: cleanText(data.title),
			author: cleanText(data.author_name),
			thumbnailUrl: safeImageUrl(data.thumbnail_url)
		};
	} catch {
		return null;
	}
}

/** Find the `content` of an `<meta property="og:<prop>">` tag in raw HTML. */
function ogTag(html: string, prop: string): string | undefined {
	const re = new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']*)["']`, 'i');
	return html.match(re)?.[1];
}

/**
 * Instagram — fetch the public reel/post page and parse OpenGraph tags. Best-effort:
 * Instagram frequently serves a login wall to servers (no OG tags), so a null here
 * is expected and handled gracefully upstream.
 */
async function extractInstagram(url: string): Promise<SocialPost | null> {
	try {
		const res = await fetch(url, {
			headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
		});
		if (!res.ok) return null;
		const html = await res.text();
		const title = decodeEntities(ogTag(html, 'title'));
		const description = decodeEntities(ogTag(html, 'description'));
		const image = ogTag(html, 'image');
		// No OG data at all → almost certainly a login wall; give up gracefully.
		if (!title && !description && !image) return null;
		return {
			platform: 'instagram',
			sourceUrl: url,
			caption: cleanText(description ?? title),
			author: parseInstagramAuthor(title),
			thumbnailUrl: safeImageUrl(image)
		};
	} catch {
		return null;
	}
}

/**
 * Public entry point used by the `extract_social_post` tool. Returns structured
 * post metadata or null (unsupported host, private/removed post, login wall, or
 * any network error).
 */
export async function extractSocialPost(rawUrl: string): Promise<SocialPost | null> {
	const platform = detectPlatform(rawUrl);
	if (!platform) return null;
	const url = rawUrl.trim();
	return platform === 'tiktok' ? extractTikTok(url) : extractInstagram(url);
}
