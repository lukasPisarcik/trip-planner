<script lang="ts">
	import type { Trip } from '$lib/trips';
	import type { Accent } from '$lib/trips/types';

	let {
		trip,
		glass = false,
		overlayHeight = $bindable(0)
	}: {
		trip: Trip;
		/** Render as a title-only glass card floating on the map (vs. a solid banner). */
		glass?: boolean;
		/** Measured height (px) of the glass card, for map fit padding (bindable). */
		overlayHeight?: number;
	} = $props();

	// The sage pill follows the trip accent (it's the "default" tone).
	const pillTone: Record<Accent, string> = {
		sage: 'border-(--sage-md) bg-(--sage-lt) text-(--trip-accent)',
		amber: 'border-(--amber-md) bg-(--amber-lt) text-(--amber)',
		sky: 'border-(--sky-md) bg-(--sky-lt) text-(--sky)',
		rose: 'border-(--rose-md) bg-(--rose-lt) text-(--rose)',
		violet: 'border-(--violet-md) bg-(--violet-lt) text-(--violet)'
	};

	const eyebrowClass = 'text-[11px] font-semibold tracking-[0.12em] uppercase text-(--trip-accent)';
	const pillRowClass = 'flex flex-wrap gap-2';
	const pillClass =
		'inline-flex items-center gap-[5px] rounded-full border px-3 py-1 text-xs font-medium';
</script>

{#if glass}
	<!-- Title-only card floating over the live map. The parent positions it; the
	     wrapper lets clicks fall through to the map everywhere but the card. -->
	<div class="pointer-events-none" bind:clientHeight={overlayHeight}>
		<div
			class="glass pointer-events-auto inline-block max-w-[min(28rem,calc(100vw-24px))] rounded-2xl px-4 py-2.5"
		>
			<h1
				class="font-serif text-xl leading-[1.15] font-normal text-(--ink) max-sm:line-clamp-2 max-sm:text-lg"
			>
				{trip.title}
				{#if trip.titleEmphasis}<em class="text-(--trip-accent) italic">{trip.titleEmphasis}</em
					>{/if}
			</h1>
		</div>
	</div>
{:else}
	<!-- Solid banner (trips without map coordinates). -->
	<div
		class="border-b border-(--trip-border) bg-(--white) px-10 pt-12 pb-10 max-sm:px-5 max-sm:pt-8 max-sm:pb-7"
	>
		<div class="mx-auto max-w-[860px]">
			<div class="mb-3 {eyebrowClass}">{trip.eyebrow}</div>
			<h1
				class="mb-2.5 font-serif text-[2.6rem] leading-[1.15] font-normal text-(--ink) max-sm:text-[2rem]"
			>
				{trip.title}
				{#if trip.titleEmphasis}<em class="text-(--trip-accent) italic">{trip.titleEmphasis}</em
					>{/if}
			</h1>
			<p class="mb-1.5 text-sm font-light text-(--ink2)">
				{trip.subtitle} · {trip.dateRange}
			</p>
			<p class="mb-[22px] max-w-[60ch] text-sm text-(--ink2) italic">
				{trip.tagline}
			</p>
			<div class={pillRowClass}>
				{#each trip.heroPills as p, i (i)}
					<span class="{pillClass} {pillTone[p.tone]}">{p.label}</span>
				{/each}
			</div>
		</div>
	</div>
{/if}
