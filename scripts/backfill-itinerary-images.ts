// One-off: give existing trips' itinerary stops their Wikimedia photo tiles.
// New/edited itineraries are backfilled automatically on write; trips saved
// before that existed need this once. Goes through the service layer, so the
// same relevance + generic-stop guards apply and the Convex mutation validates.
//
//   bun run backfill:images                 # every trip
//   bun run backfill:images -- <slug> ...   # specific trips
//   bun run backfill:images -- --dry-run    # report only, write nothing
//
// Needs CONVEX_URL + OWNER_WRITE_SECRET in .env.local (loaded by bun) and
// network access to en.wikipedia.org.
import { backfillItineraryImages } from '../src/lib/server/services/images.service';
import { getTrip, listTrips, replaceTripTab } from '../src/lib/server/services/trips.service';
import type { ItineraryTab, Trip } from '../src/lib/trips';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const slugs = args.filter((a) => !a.startsWith('--'));

function countImages(tab: ItineraryTab): { withCoords: number; withImage: number } {
	let withCoords = 0;
	let withImage = 0;
	for (const day of tab.days) {
		for (const item of day.items) {
			if (item.kind !== 'activity' || !item.coords) continue;
			withCoords += 1;
			if (item.image) withImage += 1;
		}
	}
	return { withCoords, withImage };
}

const trips: Trip[] = slugs.length
	? (await Promise.all(slugs.map((s) => getTrip(s)))).filter((t): t is Trip => t !== null)
	: await listTrips();

if (trips.length === 0) {
	console.log('No trips found.');
	process.exit(0);
}

for (const trip of trips) {
	const before = countImages(trip.itinerary);
	// Preview what the service-side backfill will do; replaceTripTab runs the
	// same backfill again on the (already filled) payload, which is a no-op.
	const filled = (await backfillItineraryImages(trip.itinerary)) as ItineraryTab;
	const after = countImages(filled);
	const added = after.withImage - before.withImage;
	const line = `${trip.slug}: ${after.withImage}/${after.withCoords} coord stops have a photo (+${added})`;
	if (dryRun || added === 0) {
		console.log(`${line}${dryRun ? ' [dry-run]' : ''}`);
		continue;
	}
	await replaceTripTab(trip.slug, 'itinerary', filled);
	console.log(`${line} — written`);
}
