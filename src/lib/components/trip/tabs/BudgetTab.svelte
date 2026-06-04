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
</script>

<div class="style-row">
	{#each data.variants as v (v.id)}
		<button
			type="button"
			class="sbtn"
			class:active={v.id === activeId}
			onclick={() => (activeId = v.id)}
		>
			{v.label}
		</button>
	{/each}
</div>

{#if active}
	<div class="total-hero">
		<div>
			<div class="lbl">Estimated total · solo</div>
			<div class="big">{active.total}</div>
		</div>
		<div class="info">
			<div class="note">{active.daily}</div>
			<div class="note tiny">{data.totalNote}</div>
		</div>
	</div>

	<div class="brow">
		<div class="brow-head">
			<div>Category</div>
			<div>Details</div>
			<div>Cost</div>
		</div>
		{#each active.rows as row, i (i)}
			<div class="brow-row">
				<div>{row.category}</div>
				<div>{row.details}</div>
				<div>{row.amount}</div>
			</div>
		{/each}
		<div class="brow-row brow-total">
			<div>Total</div>
			<div>All-in estimate (solo)</div>
			<div>{active.total}</div>
		</div>
	</div>

	<div class="bar-section">
		<h4>Spending breakdown</h4>
		{#each bars as bar, i (i)}
			<div class="bar-row">
				<div class="bar-lbl">{bar.label}</div>
				<div class="bar-track">
					<div class="bar-fill" style:width="{bar.pct}%" style:background={bar.color}></div>
				</div>
				<div class="bar-val">{bar.amount}</div>
			</div>
		{/each}
	</div>
{/if}

<style>
	.style-row {
		display: flex;
		gap: 8px;
		margin-bottom: 20px;
		flex-wrap: wrap;
	}
	.sbtn {
		padding: 6px 16px;
		border-radius: 20px;
		border: 1px solid var(--trip-border);
		background: var(--white);
		color: var(--ink2);
		font-size: 12.5px;
		font-family: inherit;
		cursor: pointer;
		transition: all 0.15s;
	}
	.sbtn.active {
		background: var(--trip-accent, var(--sage));
		border-color: var(--trip-accent, var(--sage));
		color: #ffffff;
	}
	.total-hero {
		background: var(--total-bg);
		color: var(--white);
		border-radius: 10px;
		padding: 20px 24px;
		margin-bottom: 24px;
		display: flex;
		align-items: center;
		gap: 24px;
		flex-wrap: wrap;
	}
	.total-hero .big {
		font-family: var(--font-serif);
		font-size: 2.8rem;
		color: var(--trip-accent-strong, var(--total-amount));
	}
	.total-hero .lbl {
		font-size: 11px;
		color: var(--ink3);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.total-hero .info {
		flex: 1;
	}
	.total-hero .note {
		font-size: 12px;
		color: var(--total-info);
		margin-top: 4px;
	}
	.total-hero .note.tiny {
		font-size: 11px;
		color: var(--total-meta);
		margin-top: 8px;
	}

	.brow {
		display: grid;
		grid-template-columns: 1fr 2fr auto;
		gap: 0;
		width: 100%;
		border: 1px solid var(--trip-border);
		border-radius: 10px;
		overflow: hidden;
		margin-bottom: 20px;
	}
	.brow-head {
		display: contents;
	}
	.brow-head > div {
		background: var(--cream);
		padding: 8px 14px;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink3);
		border-bottom: 1px solid var(--trip-border);
	}
	.brow-row {
		display: contents;
	}
	.brow-row > div {
		padding: 10px 14px;
		font-size: 12.5px;
		border-bottom: 1px solid var(--trip-border);
		background: var(--white);
	}
	.brow-row:last-child > div {
		border-bottom: none;
	}
	.brow-row > div:first-child {
		font-weight: 600;
		color: var(--ink);
	}
	.brow-row > div:nth-child(2) {
		color: var(--ink2);
	}
	.brow-row > div:last-child {
		color: var(--trip-accent, var(--sage));
		font-weight: 700;
		text-align: right;
	}
	.brow-total > div {
		background: var(--trip-accent-lt, var(--sage-lt)) !important;
		font-weight: 700 !important;
		color: var(--ink) !important;
		border-top: 2px solid var(--trip-accent-md, var(--sage-md)) !important;
	}
	.brow-total > div:last-child {
		color: var(--trip-accent, var(--sage)) !important;
	}

	.bar-section h4 {
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--ink3);
		margin-bottom: 12px;
	}
	.bar-row {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 8px;
	}
	.bar-lbl {
		font-size: 12px;
		color: var(--ink2);
		width: 130px;
		flex-shrink: 0;
	}
	.bar-track {
		flex: 1;
		height: 7px;
		background: var(--cream);
		border-radius: 4px;
		overflow: hidden;
		border: 1px solid var(--trip-border);
	}
	.bar-fill {
		height: 100%;
		border-radius: 4px;
		transition: width 0.5s ease;
	}
	.bar-val {
		font-size: 12px;
		font-weight: 600;
		color: var(--trip-accent, var(--sage));
		width: 60px;
		text-align: right;
		flex-shrink: 0;
	}
</style>
