<script lang="ts">
	import type { AccommodationTab, AccommodationPlace, AccommodationType } from '$lib/trips';
	import { gmapsSearchUrl } from '$lib/helpers/gmaps';
	import Callout from '../Callout.svelte';
	import SectionNote from '../SectionNote.svelte';

	// AI-populated mapUrl wins; fall back to a built Google Maps link.
	function mapUrlFor(place: AccommodationPlace, city: string): string | null {
		return place.mapUrl ?? gmapsSearchUrl({ coords: place.coords, name: place.name, city });
	}

	let { data }: { data: AccommodationTab | undefined } = $props();

	const typeMeta: Record<AccommodationType, { icon: string; label: string }> = {
		hostel: { icon: '🛏️', label: 'Hostel' },
		hotel: { icon: '🏨', label: 'Hotel' },
		airbnb: { icon: '🏠', label: 'Airbnb' },
		apartment: { icon: '🏢', label: 'Apartment' },
		guesthouse: { icon: '🏡', label: 'Guesthouse' },
		camping: { icon: '⛺', label: 'Camping' }
	};

	// Type accent — colors the 3px top border of the card (mirrors RestaurantCard).
	const typeTone: Record<AccommodationType, string> = {
		hostel: 'border-t-(--sage)',
		hotel: 'border-t-(--vc-violet)',
		airbnb: 'border-t-(--rose)',
		apartment: 'border-t-(--vc-sky)',
		guesthouse: 'border-t-(--amber)',
		camping: 'border-t-(--orange)'
	};

	// Rank by both quality and popularity, like restaurants (0–10 scale here).
	function score(p: AccommodationPlace): number {
		return p.rating * Math.log10(p.ratingCount + 10);
	}

	const cities = $derived(
		(data?.cities ?? [])
			.map((c) => ({
				city: c.city,
				flag: c.flag,
				nights: c.nights,
				places: [...c.places].sort((a, b) => score(b) - score(a))
			}))
			.filter((c) => c.places.length > 0)
	);
</script>

{#if cities.length === 0}
	<Callout
		html="🛏️ <strong>No places to stay yet.</strong> Ask the co-pilot to research the best hostels, hotels, and Airbnbs for this trip — it compares Hostelworld, Booking, and Airbnb picks with prices and ratings."
	/>
{:else}
	{#if data?.callout}
		<Callout html={data.callout} />
	{/if}

	{#each cities as city, ci (ci)}
		<div
			class="mt-2 mb-3.5 flex items-center gap-2 border-b border-(--trip-border) pb-2 not-first:mt-7"
		>
			{#if city.flag}<span class="text-[20px] leading-none">{city.flag}</span>{/if}
			<span class="text-[16px] font-bold text-(--ink)">{city.city}</span>
			{#if city.nights}
				<span class="ml-auto text-[11px] font-medium text-(--ink3)">{city.nights}</span>
			{/if}
		</div>

		<div class="mb-[22px] grid grid-cols-[1fr_1fr] gap-2.5 max-[600px]:grid-cols-[1fr]">
			{#each city.places as place, i (i)}
				{@const mapUrl = mapUrlFor(place, city.city)}
				<div
					class="relative overflow-hidden rounded-[10px] border border-t-[3px] border-(--trip-border) bg-(--white) p-4 {typeTone[
						place.type
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
						title="{place.rating.toFixed(1)}/10 from {place.ratingCount} reviews"
					>
						★ {place.rating.toFixed(1)} · {place.ratingCount.toLocaleString()}
					</span>

					<div class="mb-2 flex items-start gap-2.5 pr-16">
						<div class="shrink-0 text-[22px] leading-none">{typeMeta[place.type].icon}</div>
						<div>
							<div class="text-[13.5px] font-semibold text-(--ink)">{place.name}</div>
							<div class="mt-0.5 text-[11px] text-(--ink3)">{place.location}</div>
							<div class="mt-0.5 text-[11px] text-(--ink3) italic">
								{typeMeta[place.type].label}
								<span class="font-bold text-(--sage) not-italic">· {place.pricePerNight}</span>
							</div>
						</div>
					</div>

					<div class="mb-[9px] text-[12px] leading-[1.5] text-(--ink2)">{place.description}</div>

					{#if place.tags.length}
						<div class="mb-[9px] flex flex-wrap gap-[5px]">
							{#each place.tags as tag, ti (ti)}
								<span
									class="rounded-[10px] border border-(--trip-border) bg-(--cream) px-2 py-0.5 text-[10.5px] text-(--ink3)"
									>{tag}</span
								>
							{/each}
						</div>
					{/if}

					{#if place.bookingUrl || mapUrl}
						<div class="flex flex-wrap items-center gap-2">
							{#if place.bookingUrl}
								<!-- External booking link (Hostelworld/Booking/Airbnb) — not SvelteKit navigation -->
								<!-- eslint-disable svelte/no-navigation-without-resolve -->
								<a
									class="rounded-[8px] border border-(--sage-md) bg-(--sage-lt) px-2 py-0.5 text-[10px] font-bold text-(--sage) no-underline hover:brightness-[0.97]"
									href={place.bookingUrl}
									target="_blank"
									rel="noopener noreferrer">🔗 Book</a
								>
								<!-- eslint-enable svelte/no-navigation-without-resolve -->
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
			{/each}
		</div>
	{/each}

	{#if data?.note}
		<SectionNote html={data.note} marginTop="8px" />
	{/if}
{/if}
