import { describe, expect, test } from 'bun:test';
import { wikiThumb } from './wikiThumb';

const THUMB = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Foo.jpg/1024px-Foo.jpg';

describe('wikiThumb', () => {
	test('rewrites the width segment of a Wikimedia thumb', () => {
		expect(wikiThumb(THUMB, 96)).toBe(
			'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Foo.jpg/96px-Foo.jpg'
		);
	});

	test('handles prefixed width segments (pdf/tiff page thumbs)', () => {
		const pdf =
			'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Doc.pdf/lossy-page1-1024px-Doc.pdf.jpg';
		expect(wikiThumb(pdf, 96)).toBe(
			'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Doc.pdf/lossy-page1-96px-Doc.pdf.jpg'
		);
	});

	test('is idempotent and never upscales', () => {
		const small = wikiThumb(THUMB, 96);
		expect(wikiThumb(small, 96)).toBe(small);
		expect(wikiThumb(small, 512)).toBe(small);
	});

	test('leaves non-thumb and non-Wikimedia URLs unchanged', () => {
		const original = 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Foo.jpg';
		expect(wikiThumb(original, 96)).toBe(original);
		const other = 'https://example.com/thumb/1024px-Foo.jpg';
		expect(wikiThumb(other, 96)).toBe(other);
		expect(wikiThumb('not a url', 96)).toBe('not a url');
	});
});
