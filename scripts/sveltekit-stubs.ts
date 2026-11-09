// Bun preload that stubs SvelteKit's virtual `$app/environment` module so the
// server service layer (which logs through $lib/helpers/logger) can run under a
// plain `bun` script outside Vite. Use: `bun --preload ./scripts/sveltekit-stubs.ts <script>`.
import { plugin } from 'bun';

plugin({
	name: 'sveltekit-stubs',
	setup(build) {
		build.module('$app/environment', () => ({
			exports: { browser: false, dev: true, building: false, version: 'script' },
			loader: 'object'
		}));
	}
});
