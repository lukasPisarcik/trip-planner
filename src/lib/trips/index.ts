import type { Trip } from './types';

// Seed trips are strictly local and never committed — drop any number of
// `*.ts` modules into ./local (gitignored) that export a `Trip`, and they
// seed `.data/trips.json` on first run. A fresh checkout has no local files,
// so `trips` is empty and you build your own via the AI co-pilot.
const localModules = import.meta.glob<Record<string, Trip>>('./local/*.ts', { eager: true });

export const trips: Trip[] = Object.values(localModules).flatMap((mod) => Object.values(mod));

export const tripsBySlug: Record<string, Trip> = Object.fromEntries(trips.map((t) => [t.slug, t]));

export function getTrip(slug: string): Trip | undefined {
	return tripsBySlug[slug];
}

export type { Trip } from './types';
export * from './types';
