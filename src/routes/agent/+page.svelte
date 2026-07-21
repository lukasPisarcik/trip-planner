<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AgentChat from '$lib/components/ai/AgentChat.svelte';
	import { useQuery } from 'convex-svelte';
	import { api } from '$convex/_generated/api';

	// Optional trip context: /agent?slug=paris opens the workspace scoped to a trip.
	const slug = $derived(page.url.searchParams.get('slug'));
	// 'skip' avoids subscribing when there's no slug (new-trip mode).
	const tripQuery = useQuery(api.trips.getTrip, () => (slug ? { slug } : 'skip'));
	const tripTitle = $derived(tripQuery.data?.title as string | undefined);

	async function onSession(sessionId: string) {
		// Hand off to the session-scoped view as soon as the id is known (not at turn
		// end) so the run keeps streaming there and a refresh reloads from history.
		// The streaming session survives this navigation (held by chatActivityStore);
		// the session view adopts it via liveTurnFor.
		await goto(resolve('/agent/[sessionId]', { sessionId }), { replaceState: true });
	}
</script>

<svelte:head>
	<title>Agent workspace · Trip Planner</title>
</svelte:head>

<AgentChat tripSlug={slug ?? null} mode={slug ? 'edit-trip' : 'new-trip'} {tripTitle} {onSession} />
