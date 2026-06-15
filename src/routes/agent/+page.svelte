<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AgentChat from '$lib/components/ai/AgentChat.svelte';
	import { getTrip } from '$lib/remote/trips.remote';

	// Optional trip context: /agent?slug=paris opens the workspace scoped to a trip.
	const slug = $derived(page.url.searchParams.get('slug'));
	const tripQuery = $derived(slug ? getTrip({ slug }) : null);
	const tripTitle = $derived(tripQuery?.current?.title);

	async function onDone(sessionId: string | null) {
		// Once the first turn has persisted, continue in the session-scoped view so
		// the conversation reloads from history on refresh.
		if (sessionId) await goto(resolve('/agent/[sessionId]', { sessionId }), { replaceState: true });
	}
</script>

<svelte:head>
	<title>Agent workspace · Trip Planner</title>
</svelte:head>

<AgentChat tripSlug={slug ?? null} mode={slug ? 'edit-trip' : 'new-trip'} {tripTitle} {onDone} />
