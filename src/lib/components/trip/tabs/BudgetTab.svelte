<script lang="ts">
	import type { BudgetTab } from '$lib/trips';

	let { data }: { data: BudgetTab } = $props();

	// svelte-ignore state_referenced_locally
	let activeId = $state(data.variants[0]?.id ?? '');
	const active = $derived(data.variants.find((v) => v.id === activeId) ?? data.variants[0]);

	const barColors = [
		'#4a7c59',
		'#0369a1',
		'#b45309',
		'#be185d',
		'#6d28d9',
		'#0891b2',
		'#c2410c',
		'#7c3aed',
		'#0f766e',
		'#b91c1c'
	];

	function amountToNumber(s: string): number {
		const m = s.match(/[\d,]+/);
		return m ? parseInt(m[0].replace(/,/g, ''), 10) : 0;
	}

	const bars = $derived.by(() => {
		if (!active) return [];
		const values = active.rows.map((r) => amountToNumber(r.amount));
		const max = Math.max(...values, 1);
		return active.rows.map((row, i) => ({
			label: row.category,
			amount: row.amount,
			pct: Math.round((amountToNumber(row.amount) / max) * 100),
			color: barColors[i % barColors.length]
		}));
	});

	const headCellClass =
		'border-b border-(--trip-border) bg-(--cream) px-3.5 py-2 text-[10px] font-bold tracking-[0.08em] uppercase text-(--ink3)';
	const rowCellClass = 'border-b border-(--trip-border) bg-(--white) px-3.5 py-2.5 text-[12.5px]';
	const totalCellClass =
		'border-t-2 border-t-[var(--trip-accent-md,var(--sage-md))] bg-[var(--trip-accent-lt,var(--sage-lt))] px-3.5 py-2.5 text-[12.5px] font-bold text-(--ink)';
</script>

<div class="mb-5 flex flex-wrap gap-2">
	{#each data.variants as v (v.id)}
		<button
			type="button"
			class="cursor-pointer rounded-[20px] border px-4 py-1.5 text-[12.5px] [transition:all_0.15s] {v.id ===
			activeId
				? 'border-[var(--trip-accent,var(--sage))] bg-[var(--trip-accent,var(--sage))] text-white'
				: 'border-(--trip-border) bg-(--white) text-(--ink2)'}"
			onclick={() => (activeId = v.id)}
		>
			{v.label}
		</button>
	{/each}
</div>

{#if active}
	<div
		class="mb-6 flex flex-wrap items-center gap-6 rounded-[10px] bg-(--total-bg) px-6 py-5 text-(--white)"
	>
		<div>
			<div class="text-[11px] tracking-[0.08em] text-(--ink3) uppercase">
				Estimated total · solo
			</div>
			<div class="font-serif text-[2.8rem] text-[var(--trip-accent-strong,var(--total-amount))]">
				{active.total}
			</div>
		</div>
		<div class="flex-1">
			<div class="mt-1 text-[12px] text-(--total-info)">{active.daily}</div>
			<div class="mt-2 text-[11px] text-(--total-meta)">{data.totalNote}</div>
		</div>
	</div>

	<div
		class="mb-5 grid w-full grid-cols-[1fr_2fr_auto] overflow-hidden rounded-[10px] border border-(--trip-border)"
	>
		<div class="contents">
			<div class={headCellClass}>Category</div>
			<div class={headCellClass}>Details</div>
			<div class={headCellClass}>Cost</div>
		</div>
		{#each active.rows as row, i (i)}
			<div class="contents">
				<div class="{rowCellClass} font-semibold text-(--ink)">{row.category}</div>
				<div class="{rowCellClass} text-(--ink2)">{row.details}</div>
				<div class="{rowCellClass} text-right font-bold text-[var(--trip-accent,var(--sage))]">
					{row.amount}
				</div>
			</div>
		{/each}
		<div class="contents">
			<div class={totalCellClass}>Total</div>
			<div class={totalCellClass}>All-in estimate (solo)</div>
			<div class="{totalCellClass} text-right text-[var(--trip-accent,var(--sage))]">
				{active.total}
			</div>
		</div>
	</div>

	<div>
		<h4 class="mb-3 text-[10px] font-bold tracking-[0.1em] text-(--ink3) uppercase">
			Spending breakdown
		</h4>
		{#each bars as bar, i (i)}
			<div class="mb-2 flex items-center gap-2.5">
				<div class="w-[130px] shrink-0 text-[12px] text-(--ink2)">{bar.label}</div>
				<div
					class="h-[7px] flex-1 overflow-hidden rounded-sm border border-(--trip-border) bg-(--cream)"
				>
					<div
						class="h-full rounded-sm [transition:width_0.5s_ease]"
						style:width="{bar.pct}%"
						style:background={bar.color}
					></div>
				</div>
				<div
					class="w-[60px] shrink-0 text-right text-[12px] font-semibold text-[var(--trip-accent,var(--sage))]"
				>
					{bar.amount}
				</div>
			</div>
		{/each}
	</div>
{/if}
