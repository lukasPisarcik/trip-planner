<script lang="ts">
	import type { FlightCard } from '$lib/trips';
	let { card }: { card: FlightCard } = $props();

	const iataClass =
		'rounded-[6px] bg-(--ink) px-[11px] py-1.5 font-serif text-[1.3rem] tracking-[-0.5px] text-(--white)';
</script>

<div class="rounded-[10px] border border-(--trip-border) bg-(--white) p-[18px]">
	<h3 class="mb-3 text-[10px] font-bold tracking-[0.1em] text-(--ink3) uppercase">
		{card.heading}
	</h3>
	{#if card.from && card.to}
		<div class="mb-3 flex items-center gap-2">
			<div class={iataClass}>{card.from}</div>
			<div class="flex-1 text-center text-[16px] text-(--ink3)">✈</div>
			<div class={iataClass}>{card.to}</div>
		</div>
	{/if}
	{#each card.lines as l, i (i)}
		<div class="mb-1 flex justify-between gap-3 text-[12px] text-(--ink3)">
			<span>{l.label}</span><span class="text-right font-medium text-(--ink)">{l.value}</span>
		</div>
	{/each}
	{#if card.price}
		<div class="mt-3 border-t border-(--trip-border) pt-3">
			<div class="text-[10px] tracking-[0.08em] text-(--ink3) uppercase">{card.price.label}</div>
			<div class="font-serif text-[1.6rem] text-[var(--trip-accent,var(--sage))]">
				{card.price.value}
			</div>
			<div class="mt-px text-[11px] text-(--ink3)">{card.price.note}</div>
		</div>
	{/if}
</div>
