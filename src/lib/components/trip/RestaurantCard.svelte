<script lang="ts">
	import type { Restaurant, RestaurantCategory, RestaurantSource } from '$lib/trips';

	let { place }: { place: Restaurant } = $props();

	const categoryIcon: Record<RestaurantCategory, string> = {
		food: '🍽️',
		coffee: '☕',
		bar: '🍸'
	};

	const sourceMeta: Record<RestaurantSource, { icon: string; label: string }> = {
		tiktok: { icon: '🎵', label: 'TikTok' },
		instagram: { icon: '📸', label: 'Instagram' },
		google: { icon: '⭐', label: 'Google' },
		local: { icon: '📍', label: 'Local pick' }
	};

	const source = $derived(place.source ? sourceMeta[place.source] : null);
</script>

<div class="rest-card rc-{place.category}">
	{#if place.image}
		<div class="rest-photo">
			<img src={place.image.url} alt={place.image.alt} loading="lazy" />
			{#if place.image.credit}
				<span class="rest-credit">{place.image.credit}</span>
			{/if}
		</div>
	{/if}

	<span class="rating" title="{place.rating.toFixed(1)} from {place.ratingCount} reviews">
		★ {place.rating.toFixed(1)} · {place.ratingCount.toLocaleString()}
	</span>

	<div class="rest-top">
		<div class="rest-icon">{categoryIcon[place.category]}</div>
		<div>
			<div class="r-title">{place.name}</div>
			<div class="r-loc">{place.location}</div>
			{#if place.cuisine}
				<div class="r-cuisine">
					{place.cuisine}{#if place.priceLevel}<span class="r-price">
							· {place.priceLevel}</span
						>{/if}
				</div>
			{:else if place.priceLevel}
				<div class="r-cuisine"><span class="r-price">{place.priceLevel}</span></div>
			{/if}
		</div>
	</div>

	<div class="rest-desc">{place.description}</div>

	{#if place.tags.length}
		<div class="rest-tags">
			{#each place.tags as tag, i (i)}
				<span class="rtag">{tag}</span>
			{/each}
		</div>
	{/if}

	{#if source || place.mapUrl}
		<div class="rest-footer">
			{#if source}
				{#if place.socialUrl}
					<!-- External social link (TikTok/Instagram/etc.) — not SvelteKit navigation -->
					<!-- eslint-disable svelte/no-navigation-without-resolve -->
					<a
						class="src-badge src-{place.source}"
						href={place.socialUrl}
						target="_blank"
						rel="noopener noreferrer"
					>
						{source.icon}
						{source.label}
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				{:else}
					<span class="src-badge src-{place.source}">{source.icon} {source.label}</span>
				{/if}
			{/if}
			{#if place.mapUrl}
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
				<a class="map-link" href={place.mapUrl} target="_blank" rel="noopener noreferrer">📍 Map</a>
			{/if}
		</div>
	{/if}
</div>

<style>
	.rest-card {
		background: var(--white);
		border: 1px solid var(--trip-border);
		border-radius: 10px;
		padding: 16px;
		position: relative;
		border-top: 3px solid;
		overflow: hidden;
	}
	.rest-photo {
		position: relative;
		margin: -16px -16px 12px;
		aspect-ratio: 16 / 9;
		overflow: hidden;
		background: var(--cream);
	}
	.rest-photo img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.rest-credit {
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

	.rc-food {
		border-top-color: var(--orange);
	}
	.rc-coffee {
		border-top-color: var(--amber);
	}
	.rc-bar {
		border-top-color: var(--vc-violet);
	}

	.rating {
		position: absolute;
		top: 12px;
		right: 14px;
		font-size: 10px;
		font-weight: 700;
		padding: 2px 8px;
		border-radius: 8px;
		background: var(--cream);
		border: 1px solid var(--trip-border);
		color: var(--amber-strong);
		white-space: nowrap;
	}

	.rest-top {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		margin-bottom: 8px;
		padding-right: 64px;
	}
	.rest-icon {
		font-size: 22px;
		flex-shrink: 0;
		line-height: 1;
	}
	.r-title {
		font-size: 13.5px;
		font-weight: 600;
		color: var(--ink);
	}
	.r-loc {
		font-size: 11px;
		color: var(--ink3);
		margin-top: 2px;
	}
	.r-cuisine {
		font-size: 11px;
		color: var(--ink3);
		font-style: italic;
		margin-top: 2px;
	}
	.r-price {
		font-style: normal;
		font-weight: 700;
		color: var(--sage);
	}
	.rest-desc {
		font-size: 12px;
		color: var(--ink2);
		line-height: 1.5;
		margin-bottom: 9px;
	}
	.rest-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
		margin-bottom: 9px;
	}
	.rtag {
		font-size: 10.5px;
		padding: 2px 8px;
		border-radius: 10px;
		background: var(--cream);
		border: 1px solid var(--trip-border);
		color: var(--ink3);
	}
	.rest-footer {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
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
	.map-link {
		font-size: 10.5px;
		font-weight: 600;
		color: var(--ink3);
		text-decoration: none;
	}
	.map-link:hover {
		color: var(--ink2);
		text-decoration: underline;
	}
</style>
