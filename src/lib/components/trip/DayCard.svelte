<script lang="ts">
	import type { Day } from '$lib/trips';

	let { day }: { day: Day } = $props();
	// svelte-ignore state_referenced_locally
	let open = $state(day.defaultOpen ?? false);
</script>

<div class="day-card" class:open>
	<button type="button" class="day-header" onclick={() => (open = !open)} aria-expanded={open}>
		<div class="day-pill">
			{day.number}<span>{day.date}</span>
		</div>
		<div class="day-meta">
			<div class="day-title">{day.title}</div>
			<div class="day-sub">{day.subtitle}</div>
		</div>
		<div class="day-flag">{day.flag}</div>
		<div class="day-chev">▶</div>
	</button>
	{#if open}
		<div class="day-body">
			{#each day.items as item, i (i)}
				{#if item.kind === 'leg'}
					<div class="leg">
						<div class="leg-icon">{item.icon}</div>
						<div class="leg-body">
							<strong>{item.title}</strong>
							<span>{item.description}</span>
						</div>
						{#if item.price}
							<div class="leg-price">{item.price}</div>
						{/if}
					</div>
				{:else}
					<div class="activity">
						<div class="act-icon">{item.icon}</div>
						<div class="act-body">
							<h4>{item.title}</h4>
							<p>{item.description}</p>
							{#if item.tag}<span class="ctag">{item.tag}</span>{/if}
						</div>
					</div>
				{/if}
			{/each}
		</div>
	{/if}
</div>

<style>
	.day-card {
		background: var(--white);
		border: 1px solid var(--trip-border);
		border-radius: 10px;
		margin-bottom: 10px;
		overflow: hidden;
		transition: box-shadow 0.15s;
	}
	.day-card:hover {
		box-shadow: var(--trip-shadow);
	}
	.day-header {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 14px 18px;
		cursor: pointer;
		user-select: none;
		width: 100%;
		background: none;
		border: 0;
		font-family: inherit;
		text-align: left;
		color: inherit;
	}
	.day-pill {
		min-width: 52px;
		text-align: center;
		background: var(--trip-accent-lt, var(--sage-lt));
		border: 1px solid var(--trip-accent-md, var(--sage-md));
		border-radius: 7px;
		padding: 5px 10px;
		font-size: 11px;
		font-weight: 700;
		color: var(--trip-accent, var(--sage));
		flex-shrink: 0;
		line-height: 1.2;
	}
	.day-pill span {
		display: block;
		font-weight: 400;
		font-size: 10px;
		color: var(--trip-accent, var(--sage));
		opacity: 0.7;
	}
	.day-meta {
		flex: 1;
		min-width: 0;
	}
	.day-title {
		font-weight: 600;
		font-size: 14px;
		color: var(--ink);
	}
	.day-sub {
		font-size: 12px;
		color: var(--ink3);
		margin-top: 1px;
	}
	.day-flag {
		font-size: 18px;
		line-height: 1;
	}
	.day-chev {
		font-size: 11px;
		color: var(--ink3);
		transition: transform 0.2s;
		flex-shrink: 0;
	}
	.day-card.open .day-chev {
		transform: rotate(90deg);
	}
	.day-body {
		padding: 4px 18px 16px 84px;
	}
	.activity {
		display: flex;
		gap: 10px;
		margin-bottom: 7px;
		padding: 9px 12px;
		border-radius: 8px;
		background: var(--cream);
		border: 1px solid var(--trip-border);
	}
	.act-icon {
		font-size: 16px;
		flex-shrink: 0;
		margin-top: 1px;
		line-height: 1.2;
	}
	.act-body h4 {
		font-size: 13px;
		font-weight: 600;
		color: var(--ink);
	}
	.act-body p {
		font-size: 12px;
		color: var(--ink2);
		margin-top: 2px;
		line-height: 1.45;
	}
	.ctag {
		display: inline-block;
		margin-top: 4px;
		padding: 1px 8px;
		border-radius: 5px;
		font-size: 11px;
		font-weight: 500;
		background: var(--trip-accent-lt, var(--sage-lt));
		color: var(--trip-accent, var(--sage));
		border: 1px solid var(--trip-accent-md, var(--sage-md));
	}
	.leg {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		margin: 6px 0;
		padding: 9px 12px;
		border-radius: 8px;
		background: var(--sky-lt);
		border: 1px solid var(--sky-md);
	}
	.leg-icon {
		font-size: 15px;
		flex-shrink: 0;
		margin-top: 1px;
		line-height: 1.2;
	}
	.leg-body {
		flex: 1;
		min-width: 0;
	}
	.leg-body strong {
		font-size: 12.5px;
		color: var(--sky);
		display: block;
		font-weight: 600;
	}
	.leg-body span {
		font-size: 11.5px;
		color: var(--ink2);
		display: block;
		margin-top: 2px;
		line-height: 1.4;
	}
	.leg-price {
		font-size: 12px;
		font-weight: 700;
		color: var(--sky);
		white-space: nowrap;
		margin-top: 2px;
	}
	@media (max-width: 640px) {
		.day-body {
			padding: 4px 14px 14px 14px;
		}
	}
</style>
