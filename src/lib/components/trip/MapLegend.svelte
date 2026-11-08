<script lang="ts">
	import type { DayRoute } from './tabs/mapLayers';

	let {
		days,
		focusedKey = null,
		onselect,
		class: className = ''
	}: {
		/** Every drawn day, in itinerary order (see buildDayRoutes). */
		days: DayRoute[];
		/** The focused day's key, or null in the all-days view. */
		focusedKey?: string | null;
		/** Row click: focus that day; re-clicking the focused row (or "All days") exits. */
		onselect?: (key: string | null) => void;
		class?: string;
	} = $props();

	const rowClass =
		'flex w-full cursor-pointer items-center gap-2 rounded-[8px] px-2 py-1 text-left text-[12px] ' +
		'leading-tight text-(--ink) transition-opacity hover:bg-(--white)/50 motion-reduce:transition-none';
</script>

<!-- Glass panel listing one row per drawn day; doubles as the only on-map day
     control. Capped to 45% of the stage and scrollable so long trips never
     cover the Google logo / attribution (the caller adds the bottom offset). -->
<div
	class="glass flex max-h-[45%] w-max max-w-[min(260px,calc(100%-24px))] flex-col overflow-y-auto rounded-[12px] p-1.5 {className}"
	role="group"
	aria-label="Days on the map"
>
	{#each days as day (day.key)}
		{@const focused = focusedKey === day.key}
		<button
			type="button"
			class="{rowClass} {focused ? 'font-bold' : ''} {focusedKey !== null && !focused
				? 'opacity-50'
				: ''}"
			style="--swatch: var({focused ? '--day-focus' : day.colorVar})"
			aria-pressed={focused}
			onclick={() => onselect?.(focused ? null : day.key)}
		>
			<span
				class="h-3 w-3 shrink-0 rounded-full border border-white/80 bg-(--swatch) shadow-[0_0_0_1px_rgba(0,0,0,0.08)]"
			></span>
			<span class="whitespace-nowrap">Day {day.number}</span>
			<span class="max-w-[150px] truncate text-(--ink2) max-sm:hidden">{day.title}</span>
		</button>
	{/each}
	{#if focusedKey !== null}
		<button
			type="button"
			class="{rowClass} mt-0.5 border-t border-(--trip-border) pt-1.5 font-semibold text-(--ink2)"
			onclick={() => onselect?.(null)}
		>
			<span class="h-3 w-3 shrink-0"></span>
			<span>All days</span>
		</button>
	{/if}
</div>
