<script lang="ts">
	import type { ViralSpot, RestaurantSource } from '$lib/trips';
	import { gmapsSearchUrl } from '$lib/helpers/gmaps';
	let { spot }: { spot: ViralSpot } = $props();

	// Google Maps hand-off: name search anchored at the coords → the actual
	// place listing, not a bare dropped pin.
	const mapUrl = $derived(
		spot.coords ? gmapsSearchUrl({ coords: spot.coords, name: spot.title }) : null
	);

	const heatLabel: Record<ViralSpot['heat'], string> = {
		fire: '🔥 on fire',
		hot: '🌶 trending',
		rising: '📈 rising'
	};

	const heatTone: Record<ViralSpot['heat'], string> = {
		fire: 'border-(--fire-md) bg-(--fire-lt) text-(--fire)',
		hot: 'border-(--amber-md) bg-(--amber-lt) text-(--amber)',
		rising: 'border-(--sage-md) bg-(--sage-lt) text-(--sage)'
	};

	// Card accent — colors the 3px top border of the card.
	const colorTone: Record<ViralSpot['color'], string> = {
		fire: 'border-t-(--fire)',
		orange: 'border-t-(--orange)',
		sky: 'border-t-(--vc-sky)',
		violet: 'border-t-(--vc-violet)'
	};

	// Source badge — mirrors RestaurantCard so an imported reel reads consistently.
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
		spot.source ? { ...sourceMeta[spot.source], tone: srcTone[spot.source] } : null
	);
</script>

<div
	class="relative overflow-hidden rounded-[10px] border border-t-[3px] border-(--trip-border) bg-(--white) p-4 {colorTone[
		spot.color
	]}"
>
	{#if spot.image}
		<div class="relative -mx-4 -mt-4 mb-3 aspect-video overflow-hidden bg-(--cream)">
			<img
				class="block h-full w-full object-cover"
				src={spot.image.url}
				alt={spot.image.alt}
				loading="lazy"
			/>
			{#if spot.image.credit}
				<span
					class="absolute right-1.5 bottom-1 rounded-[4px] bg-[rgba(0,0,0,0.4)] px-[5px] py-px text-[9px] leading-[1.4] text-[rgba(255,255,255,0.85)]"
					>{spot.image.credit}</span
				>
			{/if}
		</div>
	{/if}
	<span
		class="absolute top-3 right-3.5 rounded-[8px] border px-2 py-0.5 text-[10px] font-bold {heatTone[
			spot.heat
		]}">{heatLabel[spot.heat]}</span
	>
	<div class="mb-2 flex items-start gap-2.5">
		<div class="shrink-0 text-[22px] leading-none">{spot.icon}</div>
		<div>
			<div class="text-[13.5px] font-semibold text-(--ink)">{spot.title}</div>
			<div class="mt-0.5 text-[11px] text-(--ink3)">{spot.location}</div>
		</div>
	</div>
	<div class="mb-[9px] text-[12px] leading-[1.5] text-(--ink2)">{spot.description}</div>
	<div class="flex flex-wrap gap-[5px]">
		{#each spot.tags as tag, i (i)}
			<span
				class="rounded-[10px] border border-(--trip-border) bg-(--cream) px-2 py-0.5 text-[10.5px] text-(--ink3)"
				>{tag}</span
			>
		{/each}
	</div>
	{#if source || mapUrl}
		<div class="mt-[9px] flex flex-wrap items-center gap-2">
			{#if source}
				{#if spot.socialUrl}
					<!-- External social link (TikTok/Instagram) — not SvelteKit navigation -->
					<!-- eslint-disable svelte/no-navigation-without-resolve -->
					<a
						class="{srcBadgeClass} {source.tone} hover:brightness-[0.97]"
						href={spot.socialUrl}
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
