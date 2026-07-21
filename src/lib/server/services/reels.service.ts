import { api } from '$convex/_generated/api';
import type { Reel, VisualExtraction } from '$lib/schemas';
import { detectPlatform, extractSocialPost } from './social.service';
import { transcribeReel } from './transcribe.service';

// Reels library service. Owns the WRITE path (save/CRUD + the background extraction
// job) and the server-side read used by the chat route to fold a reel's text into a
// prompt. Browser reads go straight through convex-svelte `useQuery` — never here.
//
// The heavy singletons (the Convex client and env.server) transitively pull in the
// pino logger -> `$app/environment`, which isn't resolvable under `bun test`. So they
// live behind an injectable `ReelServiceDeps` seam (mirroring transcribe.service's
// injectable `run`): the real dependencies are loaded lazily via dynamic import the
// first time a function runs in the app, while tests inject fakes and never touch the
// SvelteKit-only modules. `social.service`/`transcribe.service` are dependency-light,
// so they're imported directly.

/** Best-effort cover-thumbnail download budget. */
const THUMBNAIL_TIMEOUT_MS = 6000;

/** Env keys the extraction job reads (via the injectable `env` seam). */
type ReelEnvKey =
	| 'YT_DLP_PATH'
	| 'WHISPER_CLI_PATH'
	| 'WHISPER_MODEL_PATH'
	| 'FFMPEG_PATH'
	| 'CLAUDE_CODE_PATH'
	| 'ANTHROPIC_MODEL';

/** Minimal slice of the server-side Convex client the service actually calls. */
export interface ConvexLike {
	query(ref: unknown, args: Record<string, unknown>): Promise<unknown>;
	mutation(ref: unknown, args: Record<string, unknown>): Promise<unknown>;
}

/** Options accepted by the vision pass (subset of vision.service's `VisionOptions`). */
interface VisionOptions {
	ytDlpPath?: string;
	ffmpegPath?: string;
	claudeCodePath?: string;
	model?: string;
	maxFrames?: number;
	timeoutMs?: number;
}

/**
 * Injectable dependency seam. Defaults are the real app singletons, loaded lazily so
 * importing this module never evaluates `$app/environment`; tests pass fakes.
 */
export interface ReelServiceDeps {
	convex(): ConvexLike;
	ownerSecret(): string;
	/** Throws when the deployment is read-only (VIEWER_MODE). */
	assertWritable(): void;
	env(key: ReelEnvKey): string | undefined;
	analyzeReelVisuals(rawUrl: string, opts?: VisionOptions): Promise<VisualExtraction | null>;
	fetch: typeof fetch;
	logError(err: unknown, message: string): void;
}

let cachedDeps: ReelServiceDeps | null = null;

/** Resolve dependencies: an injected set (tests) or the lazily-loaded real ones. */
async function resolveDeps(injected?: ReelServiceDeps): Promise<ReelServiceDeps> {
	if (injected) return injected;
	if (cachedDeps) return cachedDeps;
	const [convexMod, envMod, visionMod, loggerMod] = await Promise.all([
		import('../data/convex'),
		import('../env.server'),
		import('./vision.service'),
		import('$lib/helpers/logger')
	]);
	cachedDeps = {
		// The real client is structurally compatible; the narrower FunctionReference
		// arg types on ConvexHttpClient don't unify with `unknown`, so cast through.
		convex: () => convexMod.convex() as unknown as ConvexLike,
		ownerSecret: convexMod.ownerSecret,
		assertWritable: () => {
			if (envMod.isViewerMode()) throw new Error('This deployment is read-only');
		},
		env: (key) => envMod.PrivateEnvValue(key),
		analyzeReelVisuals: visionMod.analyzeReelVisuals,
		fetch: globalThis.fetch.bind(globalThis),
		logError: (err, message) => loggerMod.log.error({ err }, message)
	};
	return cachedDeps;
}

/**
 * Save a pasted reel URL. Inserts a `processing` row synchronously, then kicks off the
 * extraction job fire-and-forget (so the request returns immediately) and returns the
 * new reel's slug id. The background job later fills the fields via `runReelExtraction`.
 */
export async function saveReel(
	url: string,
	folderId?: string | null,
	deps?: ReelServiceDeps
): Promise<string> {
	const d = await resolveDeps(deps);
	d.assertWritable();

	const platform = detectPlatform(url);
	if (!platform) throw new Error(`Unsupported reel URL (not TikTok or Instagram): ${url}`);

	// `crypto.randomUUID()`'s first 8 chars are hex → matches ReelSchema's /^[a-z0-9-]+$/.
	const id = `${platform}-${crypto.randomUUID().slice(0, 8)}`;
	const reel: Reel = {
		id,
		platform,
		sourceUrl: url,
		folderId: folderId ?? null,
		status: 'processing'
	};
	await d.convex().mutation(api.reels.saveReel, { secret: d.ownerSecret(), reel });

	// Fire-and-forget: never let a slow/failed extraction crash the save request.
	void runReelExtraction(id, url, deps).catch((err) =>
		d.logError(err, `reel extraction crashed for ${id}`)
	);
	return id;
}

/** Fetch the cover image and upload it to Convex file storage; returns its storageId. */
async function uploadThumbnail(d: ReelServiceDeps, imageUrl: string): Promise<string | undefined> {
	try {
		const img = await d.fetch(imageUrl, { signal: AbortSignal.timeout(THUMBNAIL_TIMEOUT_MS) });
		if (!img.ok) return undefined;
		const bytes = await img.arrayBuffer();
		if (!bytes.byteLength) return undefined;
		const contentType = img.headers.get('content-type') ?? 'image/jpeg';

		d.assertWritable();
		const uploadUrl = (await d
			.convex()
			.mutation(api.reels.generateThumbnailUploadUrl, { secret: d.ownerSecret() })) as string;
		const res = await d.fetch(uploadUrl, {
			method: 'POST',
			headers: { 'Content-Type': contentType },
			body: bytes
		});
		if (!res.ok) return undefined;
		const json = (await res.json()) as { storageId?: string };
		return json.storageId;
	} catch {
		// Durable thumbnail is a nicety; a failure just falls back to the CDN URL.
		return undefined;
	}
}

/**
 * Background extraction: run the caption, transcript, and vision passes concurrently,
 * store a durable cover thumbnail, and merge the results into the reel (`ready`, or
 * `error` when nothing could be extracted). Never throws to its caller.
 */
export async function runReelExtraction(
	id: string,
	url: string,
	deps?: ReelServiceDeps
): Promise<void> {
	const d = await resolveDeps(deps);
	try {
		// Refuse before spending the whole download/transcribe/vision pipeline. Callers
		// (saveReel/retryReelExtraction) already gate, so this is defense-in-depth.
		d.assertWritable();
		const [postR, transcriptR, visualR] = await Promise.allSettled([
			extractSocialPost(url),
			transcribeReel(url, {
				ytDlpPath: d.env('YT_DLP_PATH'),
				whisperCliPath: d.env('WHISPER_CLI_PATH'),
				modelPath: d.env('WHISPER_MODEL_PATH')
			}),
			d.analyzeReelVisuals(url, {
				ytDlpPath: d.env('YT_DLP_PATH'),
				ffmpegPath: d.env('FFMPEG_PATH'),
				claudeCodePath: d.env('CLAUDE_CODE_PATH'),
				model: d.env('ANTHROPIC_MODEL')
			})
		]);
		const post = postR.status === 'fulfilled' ? postR.value : null;
		const transcript = transcriptR.status === 'fulfilled' ? transcriptR.value : null;
		const visual = visualR.status === 'fulfilled' ? visualR.value : null;

		const fields: Partial<Reel> = {};
		if (post?.author) fields.author = post.author;
		if (post?.caption) fields.caption = post.caption;
		if (transcript) fields.transcript = transcript;
		if (visual?.onScreenText) fields.onScreenText = visual.onScreenText;
		if (visual?.visualDescription) fields.visualDescription = visual.visualDescription;

		if (post?.thumbnailUrl) {
			const storageId = await uploadThumbnail(d, post.thumbnailUrl);
			if (storageId) fields.thumbnailStorageId = storageId;
		}

		// Nothing usable came back (login wall, no transcript, no vision) → mark error so
		// the UI can offer a retry; otherwise the reel is ready to attach.
		fields.status = Object.keys(fields).length > 0 ? 'ready' : 'error';

		d.assertWritable();
		await d.convex().mutation(api.reels.setReelExtraction, {
			secret: d.ownerSecret(),
			id,
			fields
		});
	} catch (err) {
		d.logError(err, `reel extraction failed for ${id}`);
		// Best-effort: flip to `error` so the reel isn't stuck spinning in `processing`.
		try {
			d.assertWritable();
			await d.convex().mutation(api.reels.setReelExtraction, {
				secret: d.ownerSecret(),
				id,
				fields: { status: 'error' }
			});
		} catch {
			// Give up quietly — the row stays `processing` and stays retryable.
		}
	}
}

/**
 * Server-side hydration for the chat route: resolve a list of reel ids to their stored
 * bodies, dropping unknown ids and preserving the requested order.
 */
export async function hydrateReels(ids: string[], deps?: ReelServiceDeps): Promise<Reel[]> {
	const d = await resolveDeps(deps);
	const secret = d.ownerSecret();
	const reels = await Promise.all(
		ids.map((id) => d.convex().query(api.reels.getReel, { secret, id }) as Promise<Reel | null>)
	);
	return reels.filter((r): r is Reel => r != null);
}

/** Re-run extraction for an existing reel (look it up, reset to `processing`, extract). */
export async function retryReelExtraction(id: string, deps?: ReelServiceDeps): Promise<void> {
	const d = await resolveDeps(deps);
	d.assertWritable();
	const reel = (await d
		.convex()
		.query(api.reels.getReel, { secret: d.ownerSecret(), id })) as Reel | null;
	if (!reel) throw new Error(`Reel "${id}" not found`);

	await d.convex().mutation(api.reels.setReelExtraction, {
		secret: d.ownerSecret(),
		id,
		fields: { status: 'processing' }
	});
	void runReelExtraction(id, reel.sourceUrl, deps).catch((err) =>
		d.logError(err, `reel extraction crashed on retry for ${id}`)
	);
}

// ---- CRUD (secret-gated thin wrappers, mirroring folders.service.ts) ----

export async function moveReelToFolder(
	id: string,
	folderId: string | null,
	deps?: ReelServiceDeps
): Promise<void> {
	const d = await resolveDeps(deps);
	d.assertWritable();
	await d.convex().mutation(api.reels.moveReelToFolder, { secret: d.ownerSecret(), id, folderId });
}

export async function deleteReel(id: string, deps?: ReelServiceDeps): Promise<void> {
	const d = await resolveDeps(deps);
	d.assertWritable();
	await d.convex().mutation(api.reels.deleteReel, { secret: d.ownerSecret(), id });
}

export async function createReelFolder(name: string, deps?: ReelServiceDeps): Promise<string> {
	const d = await resolveDeps(deps);
	d.assertWritable();
	// Slug generation + uniqueness happen inside the Convex mutation.
	return (await d
		.convex()
		.mutation(api.reels.createReelFolder, { secret: d.ownerSecret(), name })) as string;
}

export async function renameReelFolder(
	id: string,
	name: string,
	deps?: ReelServiceDeps
): Promise<void> {
	const d = await resolveDeps(deps);
	d.assertWritable();
	await d.convex().mutation(api.reels.renameReelFolder, { secret: d.ownerSecret(), id, name });
}

export async function deleteReelFolder(id: string, deps?: ReelServiceDeps): Promise<void> {
	const d = await resolveDeps(deps);
	d.assertWritable();
	// The Convex mutation cascades: it unassigns the folder's reels in the same
	// transaction, so there are never dangling folderId references.
	await d.convex().mutation(api.reels.deleteReelFolder, { secret: d.ownerSecret(), id });
}
