<script lang="ts">
	import type { ViralSpot, RestaurantSource } from '$lib/trips';
	let { spot }: { spot: ViralSpot } = $props();

	const heatLabel: Record<ViralSpot['heat'], string> = {
		fire: '🔥 on fire',
		hot: '🌶 trending',
		rising: '📈 rising'
	};

	const sourceMeta: Record<RestaurantSource, { icon: string; label: string }> = {
		tiktok: { icon: '🎵', label: 'TikTok' },
		instagram: { icon: '📸', label: 'Instagram' },
		google: { icon: '⭐', label: 'Google' },
		local: { icon: '📍', label: 'Local pick' }
	};

	const source = $derived(spot.source ? sourceMeta[spot.source] : null);
</script>

<div class="viral-card vc-{spot.color}">
	{#if spot.image}
		<div class="viral-photo">
			<img src={spot.image.url} alt={spot.image.alt} loading="lazy" />
			{#if spot.image.credit}
				<span class="viral-credit">{spot.image.credit}</span>
			{/if}
		</div>
	{/if}
	<span class="heat h-{spot.heat}">{heatLabel[spot.heat]}</span>
	<div class="viral-top">
		<div class="viral-icon">{spot.icon}</div>
		<div>
			<div class="v-title">{spot.title}</div>
			<div class="v-loc">{spot.location}</div>
		</div>
	</div>
	<div class="viral-desc">{spot.description}</div>
	<div class="viral-tags">
		{#each spot.tags as tag, i (i)}
			<span class="vtag">{tag}</span>
		{/each}
	</div>
	{#if source}
		<div class="viral-footer">
			{#if spot.socialUrl}
				<!-- External social link (TikTok/Instagram) — not SvelteKit navigation -->
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					class="src-badge src-{spot.source}"
					href={spot.socialUrl}
					target="_blank"
					rel="noopener noreferrer"
				>
					{source.icon}
					{source.label}
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{:else}
				<span class="src-badge src-{spot.source}">{source.icon} {source.label}</span>
			{/if}
		</div>
	{/if}
</div>

<style>
	.viral-card {
		background: var(--white);
		border: 1px solid var(--trip-border);
		border-radius: 10px;
		padding: 16px;
		position: relative;
		border-top: 3px solid;
		overflow: hidden;
	}
	.viral-photo {
		position: relative;
		margin: -16px -16px 12px;
		aspect-ratio: 16 / 9;
		overflow: hidden;
		background: var(--cream);
	}
	.viral-photo img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.viral-credit {
		position: absolute;
		bottom: 4px;
		right: 6px;
		font-size: 9px;
		color: rgba(255, 255, 255, 0.85);
		background: rgba(0, 0, 0, 0.4);
		padding: 1px 5px;
		border-radius: 4px;
		line-height: 1.4;
	}
	.vc-fire {
		border-top-color: var(--fire);
	}
	.vc-orange {
		border-top-color: var(--orange);
	}
	.vc-sky {
		border-top-color: var(--vc-sky);
	}
	.vc-violet {
		border-top-color: var(--vc-violet);
	}

	.viral-top {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		margin-bottom: 8px;
	}
	.viral-icon {
		font-size: 22px;
		flex-shrink: 0;
		line-height: 1;
	}
	.v-title {
		font-size: 13.5px;
		font-weight: 600;
		color: var(--ink);
	}
	.v-loc {
		font-size: 11px;
		color: var(--ink3);
		margin-top: 2px;
	}
	.viral-desc {
		font-size: 12px;
		color: var(--ink2);
		line-height: 1.5;
		margin-bottom: 9px;
	}
	.viral-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
	}
	.vtag {
		font-size: 10.5px;
		padding: 2px 8px;
		border-radius: 10px;
		background: var(--cream);
		border: 1px solid var(--trip-border);
		color: var(--ink3);
	}
	/* Source badge — mirrors RestaurantCard so an imported reel reads consistently. */
	.viral-footer {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
		margin-top: 9px;
	}
	.src-badge {
		font-size: 10px;
		font-weight: 700;
		padding: 2px 8px;
		border-radius: 8px;
		border: 1px solid;
		text-decoration: none;
	}
	.src-tiktok {
		background: var(--fire-lt);
		color: var(--fire);
		border-color: var(--fire-md);
	}
	.src-instagram {
		background: var(--rose-lt);
		color: var(--rose);
		border-color: var(--rose-md);
	}
	.src-google {
		background: var(--sky-lt);
		color: var(--sky);
		border-color: var(--sky-md);
	}
	.src-local {
		background: var(--sage-lt);
		color: var(--sage);
		border-color: var(--sage-md);
	}
	a.src-badge:hover {
		filter: brightness(0.97);
	}
	.heat {
		position: absolute;
		top: 12px;
		right: 14px;
		font-size: 10px;
		font-weight: 700;
		padding: 2px 8px;
		border-radius: 8px;
		border: 1px solid;
	}
	.h-fire {
		background: var(--fire-lt);
		color: var(--fire);
		border-color: var(--fire-md);
	}
	.h-hot {
		background: var(--amber-lt);
		color: var(--amber);
		border-color: var(--amber-md);
	}
	.h-rising {
		background: var(--sage-lt);
		color: var(--sage);
		border-color: var(--sage-md);
	}
</style>
