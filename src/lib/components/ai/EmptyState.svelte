<script lang="ts">
	import { Sparkles } from '@lucide/svelte';

	let {
		mode,
		tripTitle,
		onExample
	}: {
		mode: 'new-trip' | 'edit-trip';
		tripTitle?: string;
		/** Click handler for an example chip — fills the composer with the text. */
		onExample?: (text: string) => void;
	} = $props();

	const examples = $derived(
		mode === 'new-trip'
			? [
					'10 days in Portugal in October, flying from Vienna',
					'A long weekend in Lisbon next month',
					'3-week Japan + Korea trip in spring'
				]
			: [
					'Add a day in Sintra',
					'Swap the night train for a flight',
					'Go through my brainstorm notes and update the plan — import any TikTok/Instagram links as restaurants or viral spots'
				]
	);
</script>

<div class="flex flex-col items-start gap-2 px-5 py-6">
	<div class="mb-1 flex size-11 items-center justify-center rounded-xl bg-muted/50 text-primary">
		<Sparkles class="size-7" />
	</div>
	<h3 class="m-0 font-serif text-[1.4rem] font-normal">
		{mode === 'new-trip' ? 'Plan a new trip' : 'Edit this trip'}
	</h3>
	<p class="m-0 mb-2 text-[13.5px] leading-[1.55] text-muted-foreground">
		{#if mode === 'new-trip'}
			Tell me where you'd like to go — countries, dates, where you're flying from. I'll ask the rest
			and draft a trip you can refine.
		{:else}
			Ask me to add a day, swap a route, change the tagline, anything. I'll update <em
				>{tripTitle}</em
			>
			as we go.
		{/if}
	</p>

	<div class="flex w-full flex-col gap-1.5">
		{#each examples as example (example)}
			<button
				type="button"
				onclick={() => onExample?.(example)}
				class="cursor-pointer rounded-[10px] border bg-background px-3 py-2 text-left text-[12.5px] text-foreground transition-colors hover:border-primary/40 hover:bg-muted/40"
			>
				{example}
			</button>
		{/each}
	</div>
</div>
