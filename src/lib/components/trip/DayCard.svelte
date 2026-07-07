<script lang="ts">
	import type { Day } from '$lib/trips';

	let { day, onfocusday }: { day: Day; onfocusday?: (day: Day) => void } = $props();
	// svelte-ignore state_referenced_locally
	let open = $state(day.defaultOpen ?? false);

	// Number the coord-bearing stops (in itinerary order) so the badges match the
	// numbered markers the map backdrop draws when this day is focused.
	const numbers = $derived.by(() => {
		const out: (number | null)[] = [];
		let n = 0;
		for (const item of day.items) out.push(item.coords ? (n += 1) : null);
		return out;
	});

	const hasCoords = $derived(day.items.some((i) => i.coords));

	function toggle() {
		open = !open;
		// Opening a day with stops flies the persistent backdrop to that day's route.
		if (open && hasCoords) onfocusday?.(day);
	}

	// Numbered badge mirroring the matching marker on the day map.
	const stopNumClass =
		'mt-px inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[var(--trip-accent,var(--sage))] text-[11px] leading-none font-bold text-white';
</script>

<div
	class="mb-2.5 overflow-hidden rounded-[10px] border border-(--trip-border) bg-(--white) transition-shadow duration-150 ease-[ease] hover:shadow-(--trip-shadow)"
>
	<button
		type="button"
		class="flex w-full cursor-pointer items-center gap-3.5 px-[18px] py-3.5 text-left select-none"
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
						class="my-1.5 flex items-start gap-2.5 rounded-[8px] border border-(--sky-md) bg-(--sky-lt) px-3 py-[9px]"
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
						</div>
						{#if item.price}
							<div class="mt-0.5 text-[12px] font-bold whitespace-nowrap text-(--sky)">
								{item.price}
							</div>
						{/if}
					</div>
				{:else}
					<div
						class="mb-[7px] flex gap-2.5 rounded-[8px] border border-(--trip-border) bg-(--cream) px-3 py-[9px]"
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
						</div>
					</div>
				{/if}
			{/each}
		</div>
	{/if}
</div>
