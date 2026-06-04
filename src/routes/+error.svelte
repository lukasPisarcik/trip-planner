<script lang="ts">
	import { page } from '$app/state';
	import { House, RefreshCw } from '@lucide/svelte';
	import { Button } from '$lib/components';
	import { getStatusText } from '$lib/errors';

	const status = $derived(page.status);
	const error = $derived(page.error);

	const statusText = $derived(getStatusText(status));
	const description = $derived(error?.message ?? '');

	function handleRetry() {
		window.location.reload();
	}
</script>

<svelte:head>
	<title>{status} — {statusText} | Trip Planner</title>
</svelte:head>

<div class="flex min-h-screen w-full items-center justify-center bg-background p-4">
	<div class="mx-auto w-full max-w-lg space-y-8">
		<div class="text-center">
			<h1 class="text-9xl font-bold tracking-tighter text-primary/20">{status}</h1>
			<h2 class="mt-2 text-2xl font-semibold tracking-tight">{statusText}</h2>
			<p class="mt-2 text-muted-foreground">{description}</p>
		</div>

		<div class="flex flex-col gap-3 sm:flex-row sm:justify-center">
			<Button variant="default" href="/">
				<House class="mr-2 h-4 w-4" />
				Go home
			</Button>
			<Button variant="outline" onclick={handleRetry}>
				<RefreshCw class="mr-2 h-4 w-4" />
				Try again
			</Button>
		</div>
	</div>
</div>
