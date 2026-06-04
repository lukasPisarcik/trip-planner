<script lang="ts">
	import type { FlightCard } from '$lib/trips';
	let { card }: { card: FlightCard } = $props();
</script>

<div class="flight-card">
	<h3>{card.heading}</h3>
	{#if card.from && card.to}
		<div class="flight-route">
			<div class="iata">{card.from}</div>
			<div class="arrow">✈</div>
			<div class="iata">{card.to}</div>
		</div>
	{/if}
	{#each card.lines as l, i (i)}
		<div class="fd"><span>{l.label}</span><span>{l.value}</span></div>
	{/each}
	{#if card.price}
		<div class="price-row">
			<div class="lbl">{card.price.label}</div>
			<div class="val">{card.price.value}</div>
			<div class="note">{card.price.note}</div>
		</div>
	{/if}
</div>

<style>
	.flight-card {
		background: var(--white);
		border: 1px solid var(--trip-border);
		border-radius: 10px;
		padding: 18px;
	}
	.flight-card h3 {
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--ink3);
		margin-bottom: 12px;
	}
	.flight-route {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 12px;
	}
	.iata {
		background: var(--ink);
		color: var(--white);
		border-radius: 6px;
		padding: 6px 11px;
		font-family: var(--font-serif);
		font-size: 1.3rem;
		letter-spacing: -0.5px;
	}
	.arrow {
		flex: 1;
		text-align: center;
		color: var(--ink3);
		font-size: 16px;
	}
	.fd {
		display: flex;
		justify-content: space-between;
		font-size: 12px;
		color: var(--ink3);
		margin-bottom: 4px;
		gap: 12px;
	}
	.fd span:last-child {
		color: var(--ink);
		font-weight: 500;
		text-align: right;
	}
	.price-row {
		margin-top: 12px;
		padding-top: 12px;
		border-top: 1px solid var(--trip-border);
	}
	.price-row .lbl {
		font-size: 10px;
		color: var(--ink3);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.price-row .val {
		font-family: var(--font-serif);
		font-size: 1.6rem;
		color: var(--trip-accent, var(--sage));
	}
	.price-row .note {
		font-size: 11px;
		color: var(--ink3);
		margin-top: 1px;
	}
</style>
