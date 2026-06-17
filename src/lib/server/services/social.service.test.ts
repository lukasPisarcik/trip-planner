import { afterEach, describe, expect, test } from 'bun:test';
import { SocialPostSchema } from '$lib/schemas';
import { detectPlatform, extractSocialPost } from './social.service';

const realFetch = global.fetch;
afterEach(() => {
	global.fetch = realFetch;
});

/** Stub global fetch; `handler` maps the request URL to a response (or throws). */
function stubFetch(
	handler: (url: string) => { ok?: boolean; json?: unknown; text?: string } | 'throw'
) {
	global.fetch = (async (input: string | URL) => {
		const url = typeof input === 'string' ? input : input.toString();
		const r = handler(url);
		if (r === 'throw') throw new Error('network down');
		return {
			ok: r.ok ?? true,
			json: async () => r.json,
			text: async () => r.text ?? ''
		} as Response;
	}) as unknown as typeof fetch;
}

describe('detectPlatform', () => {
	test('detects TikTok hosts', () => {
		expect(detectPlatform('https://www.tiktok.com/@chef/video/123')).toBe('tiktok');
		expect(detectPlatform('https://tiktok.com/@chef/video/123')).toBe('tiktok');
		expect(detectPlatform('https://vm.tiktok.com/ZMabc/')).toBe('tiktok');
	});
	test('detects Instagram hosts', () => {
		expect(detectPlatform('https://www.instagram.com/reel/abc/')).toBe('instagram');
		expect(detectPlatform('https://instagram.com/p/abc/')).toBe('instagram');
		expect(detectPlatform('https://instagr.am/p/abc/')).toBe('instagram');
	});
	test('returns null for other or invalid URLs', () => {
		expect(detectPlatform('https://youtube.com/watch?v=x')).toBeNull();
		expect(detectPlatform('not a url')).toBeNull();
		expect(detectPlatform('')).toBeNull();
	});
});

describe('extractSocialPost — TikTok', () => {
	const url = 'https://www.tiktok.com/@chef/video/123';

	test('maps oEmbed fields and hits the oEmbed endpoint', async () => {
		let fetched = '';
		stubFetch((u) => {
			fetched = u;
			return {
				json: {
					title: 'Best khinkali in Tbilisi  ',
					author_name: '@chef',
					thumbnail_url: 'https://p16.tiktokcdn.com/x.jpg'
				}
			};
		});
		const post = await extractSocialPost(url);
		expect(fetched).toBe(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
		expect(post?.platform).toBe('tiktok');
		expect(post?.sourceUrl).toBe(url);
		expect(post?.caption).toBe('Best khinkali in Tbilisi');
		expect(post?.author).toBe('@chef');
		expect(post?.thumbnailUrl).toBe('https://p16.tiktokcdn.com/x.jpg');
		expect(SocialPostSchema.safeParse(post).success).toBe(true);
	});

	test('missing fields leave optionals undefined but keep sourceUrl', async () => {
		stubFetch(() => ({ json: {} }));
		const post = await extractSocialPost(url);
		expect(post?.sourceUrl).toBe(url);
		expect(post?.caption).toBeUndefined();
		expect(post?.author).toBeUndefined();
		expect(post?.thumbnailUrl).toBeUndefined();
		expect(SocialPostSchema.safeParse(post).success).toBe(true);
	});

	test('drops a non-http(s) thumbnail', async () => {
		stubFetch(() => ({ json: { thumbnail_url: 'ftp://x/y.jpg' } }));
		const post = await extractSocialPost(url);
		expect(post?.thumbnailUrl).toBeUndefined();
		expect(SocialPostSchema.safeParse(post).success).toBe(true);
	});

	test('returns null on a non-OK response', async () => {
		stubFetch(() => ({ ok: false, json: {} }));
		expect(await extractSocialPost(url)).toBeNull();
	});

	test('returns null when the request throws', async () => {
		stubFetch(() => 'throw');
		expect(await extractSocialPost(url)).toBeNull();
	});
});

describe('extractSocialPost — Instagram', () => {
	const url = 'https://www.instagram.com/reel/abc/';
	const ogHtml = `<html><head>
		<meta property="og:title" content="alice &amp; bob on Instagram: Sunset at Kazbegi" />
		<meta property="og:description" content="Best viewpoint in Georgia &#39;26" />
		<meta property="og:image" content="https://scontent.cdninstagram.com/x.jpg" />
	</head></html>`;

	test('parses OG tags, decodes entities, and parses the author', async () => {
		stubFetch(() => ({ text: ogHtml }));
		const post = await extractSocialPost(url);
		expect(post?.platform).toBe('instagram');
		expect(post?.sourceUrl).toBe(url);
		expect(post?.caption).toBe("Best viewpoint in Georgia '26");
		expect(post?.author).toBe('alice & bob');
		expect(post?.thumbnailUrl).toBe('https://scontent.cdninstagram.com/x.jpg');
		expect(SocialPostSchema.safeParse(post).success).toBe(true);
	});

	test('returns null on a login wall (no OG tags)', async () => {
		stubFetch(() => ({ text: '<html><head><title>Login • Instagram</title></head></html>' }));
		expect(await extractSocialPost(url)).toBeNull();
	});

	test('returns null on a non-OK response', async () => {
		stubFetch(() => ({ ok: false, text: '' }));
		expect(await extractSocialPost(url)).toBeNull();
	});

	test('returns null when the request throws', async () => {
		stubFetch(() => 'throw');
		expect(await extractSocialPost(url)).toBeNull();
	});
});

test('unsupported host returns null without fetching', async () => {
	let called = false;
	global.fetch = (async () => {
		called = true;
		return { ok: true, json: async () => ({}), text: async () => '' } as Response;
	}) as unknown as typeof fetch;
	expect(await extractSocialPost('https://youtube.com/watch?v=1')).toBeNull();
	expect(called).toBe(false);
});
