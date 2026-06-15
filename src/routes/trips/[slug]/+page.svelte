<script lang="ts">
	import TripView from '$lib/components/trip/TripView.svelte';
	import { useQuery } from 'convex-svelte';
	import { api } from '$convex/_generated/api';
	import type { Trip } from '$lib/trips';

	let { data } = $props();

	// Reactive trip, seeded with the SSR-loaded copy so first paint is instant and
	// there's no hydration flash; live updates arrive over the Convex subscription.
	const tripQuery = useQuery(
		api.trips.getTrip,
		() => ({ slug: data.slug }),
		() => ({ initialData: data.trip })
	);
	const trip = $derived<Trip>((tripQuery.data as Trip | null) ?? data.trip);
</script>

<svelte:head>
	<title>{trip.title}{trip.titleEmphasis ? ` ${trip.titleEmphasis}` : ''} · Trip Planner</title>
</svelte:head>

<TripView {trip} viewerMode={data.viewerMode ?? false} />
