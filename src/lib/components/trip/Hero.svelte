<script lang="ts">
	import type { Trip } from '$lib/trips';
	import { updateTripFields } from '$lib/remote/trips.remote';
	import { toast } from '$lib';
	import EditableText from './EditableText.svelte';

	let { trip }: { trip: Trip } = $props();

	async function save(field: 'title' | 'titleEmphasis' | 'dateRange' | 'tagline', next: string) {
		try {
			await updateTripFields({ slug: trip.slug, fields: { [field]: next } });
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Failed to save');
		}
	}
</script>

<div class="hero">
	<div class="hero-inner">
		<div class="hero-eyebrow">{trip.eyebrow}</div>
		<h1>
			<EditableText
				value={trip.title}
				tag="span"
				onsave={(v) => save('title', v)}
				placeholder="Trip title"
			/>
			{#if trip.titleEmphasis}
				<em>
					<EditableText
						value={trip.titleEmphasis}
						tag="span"
						onsave={(v) => save('titleEmphasis', v)}
					/>
				</em>
			{/if}
		</h1>
		<p class="hero-sub">
			{trip.subtitle} ·
			<EditableText
				value={trip.dateRange}
				tag="span"
				onsave={(v) => save('dateRange', v)}
				placeholder="Date range"
			/>
		</p>
		<p class="hero-tagline">
			<EditableText
				value={trip.tagline}
				tag="span"
				onsave={(v) => save('tagline', v)}
				placeholder="One-sentence vibe"
			/>
		</p>
		<div class="pill-row">
			{#each trip.heroPills as p, i (i)}
				<span class="pill pill-{p.tone}">{p.label}</span>
			{/each}
		</div>
	</div>
</div>

<style>
	.hero {
		background: var(--white);
		border-bottom: 1px solid var(--trip-border);
		padding: 48px 40px 40px;
	}
	.hero-inner {
		max-width: 860px;
		margin: 0 auto;
	}
	.hero-eyebrow {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--trip-accent, var(--sage));
		margin-bottom: 12px;
	}
	h1 {
		font-family: var(--font-serif);
		font-size: 2.6rem;
		font-weight: 400;
		color: var(--ink);
		line-height: 1.15;
		margin-bottom: 10px;
	}
	h1 em {
		font-style: italic;
		color: var(--trip-accent, var(--sage));
	}
	.hero-sub {
		color: var(--ink2);
		font-size: 14px;
		font-weight: 300;
		margin-bottom: 6px;
	}
	.hero-tagline {
		color: var(--ink2);
		font-size: 14px;
		font-style: italic;
		margin-bottom: 22px;
		max-width: 60ch;
	}
	.pill-row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 4px 12px;
		border-radius: 20px;
		font-size: 12px;
		font-weight: 500;
		border: 1px solid;
	}
	.pill-sage {
		background: var(--sage-lt);
		color: var(--trip-accent, var(--sage));
		border-color: var(--sage-md);
	}
	.pill-amber {
		background: var(--amber-lt);
		color: var(--amber);
		border-color: var(--amber-md);
	}
	.pill-sky {
		background: var(--sky-lt);
		color: var(--sky);
		border-color: var(--sky-md);
	}
	.pill-rose {
		background: var(--rose-lt);
		color: var(--rose);
		border-color: var(--rose-md);
	}
	.pill-violet {
		background: var(--violet-lt);
		color: var(--violet);
		border-color: var(--violet-md);
	}
	@media (max-width: 640px) {
		.hero {
			padding: 32px 20px 28px;
		}
		h1 {
			font-size: 2rem;
		}
	}
</style>
