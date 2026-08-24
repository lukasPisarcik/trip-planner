<script lang="ts">
	import type { Restaurant, RestaurantCategory, RestaurantSource } from '$lib/trips';
	import { gmapsSearchUrl } from '$lib/helpers/gmaps';

	let { place }: { place: Restaurant } = $props();

	// AI-populated mapUrl wins; fall back to a built Google Maps link when the
	// place has coords (or at least a name + location to search for).
	const mapUrl = $derived(
		place.mapUrl ?? gmapsSearchUrl({ coords: place.coords, name: place.name, city: place.location })
	);

	const categoryIcon: Record<RestaurantCategory, string> = {
		food: '🍽️',
		coffee: '☕',
		bar: '🍸'
	};

	// Category accent — colors the 3px top border of the card.
	const categoryTone: Record<RestaurantCategory, string> = {
		food: 'border-t-(--orange)',
		coffee: 'border-t-(--amber)',
		bar: 'border-t-(--vc-violet)'
	};

	const srcBadgeClass = 'rounded-[8px] border px-2 py-0.5 text-[10px] font-bold no-underline';
	const srcTone: Record<RestaurantSource, string> = {
		tiktok: 'border-(--fire-md) bg-(--fire-lt) text-(--fire)',
		instagram: 'border-(--rose-md) bg-(--rose-lt) text-(--rose)',
		google: 'border-(--sky-md) bg-(--sky-lt) text-(--sky)',
		local: 'border-(--sage-md) bg-(--sage-lt) text-(--sage)'
	};

	const sourceMeta: Record<RestaurantSource, { icon: string; label: string }> = {
		tiktok: { icon: '🎵', label: 'TikTok' },
		instagram: { icon: '📸', label: 'Instagram' },
		google: { icon: '⭐', label: 'Google' },
		local: { icon: '📍', label: 'Local pick' }
	};

	const source = $derived(
		place.source ? { ...sourceMeta[place.source], tone: srcTone[place.source] } : null
	);

	const cuisineClass = 'mt-0.5 text-[11px] text-(--ink3) italic';
	const priceClass = 'font-bold not-italic text-(--sage)';
</script>

<div
	class="relative overflow-hidden rounded-[10px] border border-t-[3px] border-(--trip-border) bg-(--white) p-4 {categoryTone[
		place.category
	]}"
>
	{#if place.image}
		<div class="relative -mx-4 -mt-4 mb-3 aspect-video overflow-hidden bg-(--cream)">
			<img
				class="block h-full w-full object-cover"
				src={place.image.url}
				alt={place.image.alt}
				loading="lazy"
			/>
			{#if place.image.credit}
				<span
					class="absolute right-1.5 bottom-1 rounded-[4px] bg-[rgba(0,0,0,0.4)] px-[5px] py-px text-[9px] leading-[1.4] text-[rgba(255,255,255,0.85)]"
					>{place.image.credit}</span
				>
			{/if}
		</div>
	{/if}

	<span
		class="absolute top-3 right-3.5 rounded-[8px] border border-(--trip-border) bg-(--cream) px-2 py-0.5 text-[10px] font-bold whitespace-nowrap text-(--amber-strong)"
		title="{place.rating.toFixed(1)} from {place.ratingCount} reviews"
	>
		★ {place.rating.toFixed(1)} · {place.ratingCount.toLocaleString()}
	</span>

	<div class="mb-2 flex items-start gap-2.5 pr-16">
		<div class="shrink-0 text-[22px] leading-none">{categoryIcon[place.category]}</div>
		<div>
			<div class="text-[13.5px] font-semibold text-(--ink)">{place.name}</div>
			<div class="mt-0.5 text-[11px] text-(--ink3)">{place.location}</div>
			{#if place.cuisine}
				<div class={cuisineClass}>
					{place.cuisine}{#if place.priceLevel}<span class={priceClass}>
							· {place.priceLevel}</span
						>{/if}
				</div>
			{:else if place.priceLevel}
				<div class={cuisineClass}><span class={priceClass}>{place.priceLevel}</span></div>
			{/if}
		</div>
	</div>

	<div class="mb-[9px] text-[12px] leading-[1.5] text-(--ink2)">{place.description}</div>

	{#if place.tags.length}
		<div class="mb-[9px] flex flex-wrap gap-[5px]">
			{#each place.tags as tag, i (i)}
				<span
					class="rounded-[10px] border border-(--trip-border) bg-(--cream) px-2 py-0.5 text-[10.5px] text-(--ink3)"
					>{tag}</span
				>
			{/each}
		</div>
	{/if}

	{#if source || mapUrl}
		<div class="flex flex-wrap items-center gap-2">
			{#if source}
				{#if place.socialUrl}
					<!-- External social link (TikTok/Instagram/etc.) — not SvelteKit navigation -->
					<!-- eslint-disable svelte/no-navigation-without-resolve -->
					<a
						class="{srcBadgeClass} {source.tone} hover:brightness-[0.97]"
						href={place.socialUrl}
						target="_blank"
						rel="noopener noreferrer"
					>
						{source.icon}
						{source.label}
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				{:else}
					<span class="{srcBadgeClass} {source.tone}">{source.icon} {source.label}</span>
				{/if}
			{/if}
			{#if mapUrl}
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					class="text-[10.5px] font-semibold text-(--ink3) no-underline hover:text-(--ink2) hover:underline"
					href={mapUrl}
					target="_blank"
					rel="noopener noreferrer">📍 Map</a
				>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{/if}
		</div>
	{/if}
</div>
