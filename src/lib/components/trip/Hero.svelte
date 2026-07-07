<script lang="ts">
	import type { Trip } from '$lib/trips';
	import type { Accent } from '$lib/trips/types';

	let {
		trip,
		glass = false,
		compact = false
	}: {
		trip: Trip;
		/** Render as a translucent overlay floating on the map (vs. a solid banner). */
		glass?: boolean;
		/** Condense to title + dates once the page is scrolled / the map collapses. */
		compact?: boolean;
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
	<!-- Floats over the live map: a narrow, left-anchored card so most of the map
	     stays visible. Sticky below the app header, so it rides along into the
	     collapsed peek instead of scrolling out of view. -->
	<div class="pointer-events-none sticky top-(--header-h) z-2 self-start p-4 max-sm:p-3">
		<div
			class="glass pointer-events-auto max-w-md rounded-2xl transition-[padding] duration-300 motion-reduce:transition-none {compact
				? 'px-4 py-2.5'
				: 'px-5 py-4'}"
		>
			{#if !compact}
				<div class="mb-1.5 {eyebrowClass}">{trip.eyebrow}</div>
			{/if}
			<h1
				class="font-serif leading-[1.15] font-normal text-(--ink) transition-[font-size] duration-300 motion-reduce:transition-none {compact
					? 'mb-0.5 text-xl'
					: 'mb-1 text-[1.75rem] max-sm:text-[1.45rem]'}"
			>
				{trip.title}
				{#if trip.titleEmphasis}<em class="text-(--trip-accent) italic">{trip.titleEmphasis}</em
					>{/if}
			</h1>
			<p class="text-sm font-light text-(--ink2) {compact ? '' : 'mb-2.5'}">
				{trip.subtitle} · {trip.dateRange}
			</p>
			{#if !compact}
				<p class="mb-3 max-w-[48ch] text-sm text-(--ink2) italic">
					{trip.tagline}
				</p>
				<div class={pillRowClass}>
					{#each trip.heroPills as p, i (i)}
						<span class="{pillClass} {pillTone[p.tone]}">{p.label}</span>
					{/each}
				</div>
			{/if}
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
