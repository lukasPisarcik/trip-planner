<script lang="ts">
	import type { Day } from '$lib/trips';
	import { gmapsSearchUrl } from '$lib/helpers/gmaps';
	import { dayKey } from './tabs/mapLayers';

	let {
		day,
		focused = false,
		colorVar,
		onfocuschange,
		scrollRequested = false,
		onscrolled
	}: {
		day: Day;
		/** True while this day is the map's focused day (set from the card, the
		 * map or the legend) — keeps the card open. */
		focused?: boolean;
		/** '--day-N' palette token of this day's map layer (undefined = no map). */
		colorVar?: string;
		/** Opening a day with stops focuses it on the map; closing the focused day unfocuses. */
		onfocuschange?: (key: string | null) => void;
		/** One-shot from a map/legend focus: scroll this card into view, then
		 * report back via onscrolled so a later remount doesn't scroll again. */
		scrollRequested?: boolean;
		onscrolled?: (key: string) => void;
	} = $props();

	const mapLinkClass =
		'mt-1 inline-block text-[10.5px] font-semibold text-(--ink3) no-underline hover:text-(--ink2) hover:underline';

	/** Activities search by name (anchored at coords → real place listing);
	 * transit legs keep the plain coordinate pin — "Vienna → Tokyo" isn't a place. */
	function itemMapUrl(item: Day['items'][number]): string | null {
		if (!item.coords) return null;
		return gmapsSearchUrl(
			item.kind === 'activity' ? { coords: item.coords, name: item.title } : { coords: item.coords }
		);
	}
	let open = $state(false);
	let el = $state<HTMLDivElement | undefined>(undefined);

	const key = $derived(dayKey(day));

	// Number the coord-bearing stops (in itinerary order) so the badges match the
	// numbered markers the map backdrop draws for this day.
	const numbers = $derived.by(() => {
		const out: (number | null)[] = [];
		let n = 0;
		for (const item of day.items) out.push(item.coords ? (n += 1) : null);
		return out;
	});

	const hasCoords = $derived(day.items.some((i) => i.coords));

	// Badge colour mirrors the day's markers: primary while focused, else the
	// day's palette token, else the trip accent when there is no map at all.
	const dayColor = $derived(
		focused ? 'var(--day-focus)' : colorVar ? `var(${colorVar})` : 'var(--trip-accent, var(--sage))'
	);

	function toggle() {
		open = !open;
		if (!hasCoords) return;
		if (open) onfocuschange?.(key);
		else if (focused) onfocuschange?.(null);
	}

	// A focused day's card is always open (focus can arrive from the map/legend).
	$effect(() => {
		if (focused) open = true;
	});

	// Map focus: bring the card into view inside the nearest scroll container
	// (the content panel's body, or the page in the no-map layout), landing at
	// the wrapper's scroll-mt, then release the one-shot request so a tab switch
	// that remounts this card doesn't scroll again.
	$effect(() => {
		if (!scrollRequested) return;
		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		el?.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
		onscrolled?.(key);
	});

	// Numbered badge mirroring the matching marker on the map.
	const stopNumClass =
		'mt-px inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-(--day) text-[11px] leading-none font-bold text-white';
</script>

<!-- The 3px left stripe in the day's route colour makes the card the map's
     legend, open or closed. `--card-scroll-mt` is set by the map layout (8px
     inside the panel); the default clears the no-map layout's sticky tab bar. -->
<div
	bind:this={el}
	class="mb-2.5 scroll-mt-[var(--card-scroll-mt,calc(3.5rem+56px))] overflow-hidden rounded-[10px] border border-l-[3px] border-l-(--day) bg-(--card-fill) transition-shadow duration-150 ease-[ease] hover:shadow-(--trip-shadow) {focused
		? 'border-(--day)'
		: 'border-(--trip-border)'}"
	style="--day: {dayColor}"
	data-day-card={key}
>
	<button
		type="button"
		class="flex w-full cursor-pointer items-center gap-3.5 px-3.5 py-3 text-left select-none"
		onclick={toggle}
		aria-expanded={open}
	>
		<div
			class="min-w-[52px] shrink-0 rounded-[7px] border border-[var(--trip-accent-md,var(--sage-md))] bg-[var(--trip-accent-lt,var(--sage-lt))] px-2.5 py-[5px] text-center text-[11px] leading-[1.2] font-bold text-[var(--trip-accent,var(--sage))]"
		>
			{day.number}<span
				class="block text-[10px] font-normal text-[var(--trip-accent,var(--sage))] opacity-70"
				>{day.date}</span
			>
		</div>
		<div class="min-w-0 flex-1">
			<div class="text-[14px] font-semibold text-(--ink)">{day.title}</div>
			<div class="mt-px text-[12px] text-(--ink3)">{day.subtitle}</div>
		</div>
		<div class="text-lg leading-none">{day.flag}</div>
		<div
			class="shrink-0 text-[11px] text-(--ink3) transition-transform duration-200 ease-[ease] {open
				? 'rotate-90'
				: ''}"
		>
			▶
		</div>
	</button>
	{#if open}
		<div class="pt-1 pr-[18px] pb-4 pl-[84px] max-sm:pr-3.5 max-sm:pb-3.5 max-sm:pl-3.5">
			{#each day.items as item, i (i)}
				{#if item.kind === 'leg'}
					<div
						class="my-1.5 flex items-start gap-2.5 rounded-[8px] border border-(--sky-md) bg-(--card-fill-sky) px-3 py-[9px]"
					>
						{#if numbers[i] != null}
							<div class={stopNumClass}>{numbers[i]}</div>
						{:else}
							<div class="mt-px shrink-0 text-[15px] leading-[1.2]">{item.icon}</div>
						{/if}
						<div class="min-w-0 flex-1">
							<strong class="block text-[12.5px] font-semibold text-(--sky)">{item.title}</strong>
							<span class="mt-0.5 block text-[11.5px] leading-[1.4] text-(--ink2)"
								>{item.description}</span
							>
							{#if item.coords}
								<!-- External Google Maps hand-off — not SvelteKit navigation -->
								<!-- eslint-disable svelte/no-navigation-without-resolve -->
								<a
									class={mapLinkClass}
									href={itemMapUrl(item)}
									target="_blank"
									rel="noopener noreferrer">📍 Map</a
								>
								<!-- eslint-enable svelte/no-navigation-without-resolve -->
							{/if}
						</div>
						{#if item.price}
							<div class="mt-0.5 text-[12px] font-bold whitespace-nowrap text-(--sky)">
								{item.price}
							</div>
						{/if}
					</div>
				{:else}
					<div
						class="mb-[7px] flex gap-2.5 rounded-[8px] border border-(--trip-border) bg-(--card-fill-soft) px-3 py-[9px]"
					>
						{#if numbers[i] != null}
							<div class={stopNumClass}>{numbers[i]}</div>
						{:else}
							<div class="mt-px shrink-0 text-base leading-[1.2]">{item.icon}</div>
						{/if}
						<div>
							<h4 class="text-[13px] font-semibold text-(--ink)">{item.title}</h4>
							<p class="mt-0.5 text-[12px] leading-[1.45] text-(--ink2)">{item.description}</p>
							{#if item.tag}<span
									class="mt-1 inline-block rounded-[5px] border border-[var(--trip-accent-md,var(--sage-md))] bg-[var(--trip-accent-lt,var(--sage-lt))] px-2 py-px text-[11px] font-medium text-[var(--trip-accent,var(--sage))]"
									>{item.tag}</span
								>{/if}
							{#if item.coords}
								<!-- External Google Maps hand-off — not SvelteKit navigation -->
								<!-- eslint-disable svelte/no-navigation-without-resolve -->
								<a
									class="{mapLinkClass} {item.tag ? 'ml-2' : ''}"
									href={itemMapUrl(item)}
									target="_blank"
									rel="noopener noreferrer">📍 Map</a
								>
								<!-- eslint-enable svelte/no-navigation-without-resolve -->
							{/if}
						</div>
					</div>
				{/if}
			{/each}
		</div>
	{/if}
</div>
