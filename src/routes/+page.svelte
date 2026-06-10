<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { listTrips } from '$lib/remote/trips.remote';
	import type { Trip } from '$lib/trips';
	import { Trash2 } from '@lucide/svelte';
	import DeleteTripConfirm from '$lib/components/trip/DeleteTripConfirm.svelte';

	const tripsQuery = listTrips({});
	const trips = $derived<Trip[]>(tripsQuery.current ?? []);

	const viewerMode = $derived(page.data.viewerMode ?? false);

	let confirmSlug = $state<string | null>(null);
	const confirmTrip = $derived(trips.find((t) => t.slug === confirmSlug) ?? null);

	async function onDeleted() {
		await tripsQuery.refresh();
	}

	function cardStyle(accent: Trip['accent']) {
		return [
			`--card-accent: var(--${accent})`,
			`--card-accent-lt: var(--${accent}-lt)`,
			`--card-accent-md: var(--${accent}-md)`
		].join('; ');
	}
</script>

<svelte:head>
	<title>Trip Planner</title>
</svelte:head>

<div class="page">
	<div class="eyebrow">Choose a trip</div>

	<div class="grid">
		{#each trips as trip (trip.slug)}
			<article class="card" style={cardStyle(trip.accent)}>
				{#if !viewerMode}
					<button
						class="del"
						title="Delete trip"
						aria-label="Delete trip"
						onclick={() => (confirmSlug = trip.slug)}
					>
						<Trash2 class="size-4" />
					</button>
				{/if}
				<div class="flags">
					{#each trip.flags as f, i (i)}
						<span class="flag">{f}</span>
					{/each}
				</div>

				<h2>
					{trip.title}
					{#if trip.titleEmphasis}<em>{trip.titleEmphasis}</em>{/if}
				</h2>

				<p class="tagline">{trip.tagline}</p>

				<div class="pills">
					{#each trip.cardPills as p, i (i)}
						<span class="pill">{p.label}</span>
					{/each}
				</div>

				<div class="hl-label">Highlights</div>
				<ul class="hl-list">
					{#each trip.highlights as h, i (i)}
						<li><span class="dot"></span><span>{h}</span></li>
					{/each}
				</ul>

				<a class="cta" href={resolve('/trips/[slug]', { slug: trip.slug })}>
					Open planner <span class="arrow">→</span>
				</a>
			</article>
		{/each}
	</div>
</div>

{#if !viewerMode}
	<DeleteTripConfirm
		trip={confirmTrip}
		onclose={() => (confirmSlug = null)}
		ondeleted={onDeleted}
	/>
{/if}

<style>
	.page {
		max-width: 1200px;
		margin: 0 auto;
		padding: 56px 40px 64px;
	}
	.eyebrow {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--ink3);
		margin-bottom: 24px;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
		gap: 24px;
	}

	.card {
		position: relative;
		background: var(--white);
		border: 1px solid var(--trip-border);
		border-radius: 18px;
		padding: 32px 32px 28px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		overflow: hidden;
		transition:
			box-shadow 0.2s,
			transform 0.2s;
	}
	.card::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 5px;
		background: linear-gradient(
			to right,
			var(--card-accent),
			var(--card-accent) 30%,
			color-mix(in srgb, var(--card-accent) 35%, transparent)
		);
	}
	.card:hover {
		box-shadow: var(--trip-shadow);
		transform: translateY(-2px);
	}

	.del {
		position: absolute;
		top: 14px;
		right: 14px;
		z-index: 2;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		border-radius: 8px;
		border: 1px solid var(--trip-border);
		background: var(--white);
		color: var(--ink3);
		cursor: pointer;
		opacity: 0.5;
		transition:
			opacity 0.15s,
			color 0.15s,
			background 0.15s;
	}
	.card:hover .del,
	.del:focus-visible {
		opacity: 1;
	}
	.del:hover {
		color: #dc2626;
		background: var(--cream);
	}
	.del:focus-visible {
		outline: 2px solid var(--card-accent);
		outline-offset: 2px;
	}

	.flags {
		display: flex;
		gap: 10px;
		margin-top: 4px;
	}
	.flag {
		font-size: 26px;
		line-height: 1;
	}

	h2 {
		font-family: var(--font-serif);
		font-size: 2.6rem;
		font-weight: 400;
		color: var(--ink);
		line-height: 1.05;
		margin: 0;
	}
	h2 em {
		font-style: italic;
		color: var(--card-accent);
	}

	.tagline {
		color: var(--ink2);
		font-size: 14px;
		line-height: 1.55;
	}

	.pills {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.pill {
		font-size: 12.5px;
		font-weight: 500;
		padding: 5px 14px;
		border-radius: 20px;
		background: var(--card-accent-lt);
		color: var(--card-accent);
		border: 1px solid var(--card-accent-md);
		white-space: nowrap;
	}

	.hl-label {
		font-size: 10.5px;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--ink3);
		margin-top: 4px;
	}
	.hl-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.hl-list li {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		font-size: 13.5px;
		color: var(--ink);
		line-height: 1.5;
	}
	.dot {
		flex-shrink: 0;
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--card-accent);
		margin-top: 7px;
	}

	.cta {
		margin-top: 12px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		background: var(--card-accent);
		color: #ffffff;
		font-size: 14px;
		font-weight: 500;
		padding: 14px 22px;
		border-radius: 999px;
		text-decoration: none;
		transition:
			filter 0.15s,
			transform 0.15s;
	}
	.cta:hover {
		filter: brightness(0.95);
	}
	.cta:active {
		transform: translateY(1px);
	}
	.cta .arrow {
		transition: transform 0.15s;
	}
	.cta:hover .arrow {
		transform: translateX(3px);
	}

	@media (max-width: 700px) {
		.page {
			padding: 32px 20px 48px;
		}
		.card {
			padding: 24px 22px 22px;
		}
		h2 {
			font-size: 2rem;
		}
	}
</style>
