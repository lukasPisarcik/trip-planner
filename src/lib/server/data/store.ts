import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const DATA_DIR = resolve(process.cwd(), '.data');

export interface FileStore<T> {
	read(): Promise<T>;
	write(value: T): Promise<void>;
}

// Lazy JSON-file store. Reads cache in memory after the first hit; writes
// serialize through a queue so concurrent callers can't tear the file.
// `fallback` runs once if the file is missing and seeds the initial content.
export function createFileStore<T>(filename: string, fallback: () => T | Promise<T>): FileStore<T> {
	const path = resolve(DATA_DIR, filename);
	let cache: T | null = null;
	let writeQueue: Promise<void> = Promise.resolve();

	const writeFile = async (value: T) => {
		await mkdir(dirname(path), { recursive: true });
		await Bun.write(path, JSON.stringify(value, null, 2));
	};

	const store: FileStore<T> = {
		async read() {
			if (cache !== null) return cache;
			const file = Bun.file(path);
			if (await file.exists()) {
				cache = (await file.json()) as T;
			} else {
				const seeded = await fallback();
				cache = seeded;
				await writeFile(seeded);
			}
			return cache;
		},
		async write(value: T) {
			cache = value;
			writeQueue = writeQueue.then(() => writeFile(value));
			await writeQueue;
		}
	};

	return store;
}
