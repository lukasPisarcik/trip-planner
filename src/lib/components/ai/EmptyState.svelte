<script lang="ts">
	import { Sparkles } from '@lucide/svelte';

	let {
		mode,
		tripTitle
	}: {
		mode: 'new-trip' | 'edit-trip';
		tripTitle?: string;
	} = $props();
</script>

<div class="empty">
	<div class="icon-wrap">
		<Sparkles class="size-7" />
	</div>
	<h3>{mode === 'new-trip' ? 'Plan a new trip' : 'Edit this trip'}</h3>
	<p>
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

	<div class="examples">
		{#if mode === 'new-trip'}
			<button type="button" class="example"
				>10 days in Portugal in October, flying from Vienna</button
			>
			<button type="button" class="example">A long weekend in Lisbon next month</button>
			<button type="button" class="example">3-week Japan + Korea trip in spring</button>
		{:else}
			<button type="button" class="example">Add a day in Sintra</button>
			<button type="button" class="example">Swap the night train for a flight</button>
			<button type="button" class="example">Shorten this trip by 2 days</button>
		{/if}
	</div>
</div>

<style>
	.empty {
		padding: 24px 20px;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 8px;
	}
	.icon-wrap {
		width: 44px;
		height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 12px;
		background: var(--trip-accent-lt, hsl(var(--muted) / 0.5));
		color: var(--trip-accent, hsl(var(--primary)));
		margin-bottom: 4px;
	}
	h3 {
		font-family: var(--font-serif, inherit);
		font-size: 1.4rem;
		font-weight: 400;
		margin: 0;
	}
	p {
		font-size: 13.5px;
		line-height: 1.55;
		color: hsl(var(--muted-foreground));
		margin: 0 0 8px;
	}
	.examples {
		display: flex;
		flex-direction: column;
		gap: 6px;
		width: 100%;
	}
	.example {
		text-align: left;
		font-size: 12.5px;
		padding: 8px 12px;
		border: 1px solid hsl(var(--border));
		background: hsl(var(--background));
		border-radius: 10px;
		color: hsl(var(--foreground));
		cursor: pointer;
		font-family: inherit;
	}
	.example:hover {
		background: hsl(var(--muted) / 0.4);
		border-color: var(--trip-accent-md, hsl(var(--border)));
	}
</style>
