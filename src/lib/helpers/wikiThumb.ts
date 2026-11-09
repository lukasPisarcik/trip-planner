/**
 * Rewrite a Wikimedia thumbnail URL to a narrower width — the images service
 * stores 1024px thumbs, while a map marker tile needs ≤ 96px:
 *
 *   …/thumb/4/4c/Foo.jpg/1024px-Foo.jpg  →  …/thumb/4/4c/Foo.jpg/96px-Foo.jpg
 *
 * Only ever shrinks (Wikimedia refuses to upscale past the original), and
 * returns non-Wikimedia or non-thumb URLs unchanged.
 */
export function wikiThumb(url: string, px: number): string {
	try {
		const u = new URL(url);
		if (!u.hostname.endsWith('wikimedia.org') || !u.pathname.includes('/thumb/')) return url;
		const next = u.pathname.replace(/(\d+)px-([^/]*)$/, (match, width: string, rest: string) =>
			Number(width) > px ? `${px}px-${rest}` : match
		);
		if (next === u.pathname) return url;
		u.pathname = next;
		return u.toString();
	} catch {
		return url;
	}
}
