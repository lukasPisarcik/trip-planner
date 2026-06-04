<script lang="ts">
	import type { TransportRoute } from '$lib/trips';

	let { route }: { route: TransportRoute } = $props();
	// svelte-ignore state_referenced_locally
	let open = $state(route.defaultOpen ?? false);
</script>

<div class="route-card" class:open>
	<button type="button" class="route-header" onclick={() => (open = !open)} aria-expanded={open}>
		<div class="rft">
			<strong>{route.title}</strong>
			<span>{route.subtitle}</span>
		</div>
		<span class="mbadge mb-{route.mode}">{route.modeLabel}</span>
		<span class="rpb">{route.price}</span>
		<div class="rchev">▶</div>
	</button>
	{#if open}
		<div class="route-body">
			{#each route.steps as step, i (i)}
				<div class="step">
					<div class="snum">{i + 1}</div>
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					<div class="stxt">{@html step.text}</div>
				</div>
			{/each}
			{#if route.chips.length}
				<div class="chips">
					{#each route.chips as chip, i (i)}
						<span class="chip" class:warn={chip.tone === 'warn'} class:good={chip.tone === 'good'}>
							{chip.label}
						</span>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.route-card {
		background: var(--white);
		border: 1px solid var(--trip-border);
		border-radius: 10px;
		margin-bottom: 8px;
		overflow: hidden;
	}
	.route-header {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 12px 16px;
		cursor: pointer;
		user-select: none;
		width: 100%;
		background: none;
		border: 0;
		font-family: inherit;
		text-align: left;
		color: inherit;
	}
	.rft {
		flex: 1;
		min-width: 0;
	}
	.rft strong {
		font-size: 13px;
		color: var(--ink);
	}
	.rft span {
		font-size: 11.5px;
		color: var(--ink3);
		display: block;
		margin-top: 1px;
	}
	.mbadge {
		font-size: 10.5px;
		padding: 2px 9px;
		border-radius: 10px;
		font-weight: 600;
		white-space: nowrap;
		border: 1px solid;
	}
	.mb-bus {
		background: var(--sage-lt);
		color: var(--sage);
		border-color: var(--sage-md);
	}
	.mb-train {
		background: var(--sky-lt);
		color: var(--sky);
		border-color: var(--sky-md);
	}
	.mb-metro {
		background: var(--violet-lt);
		color: var(--violet);
		border-color: var(--violet-md);
	}
	.mb-taxi {
		background: var(--rose-lt);
		color: var(--rose);
		border-color: var(--rose-md);
	}
	.rpb {
		font-size: 12px;
		font-weight: 700;
		color: var(--trip-accent, var(--sage));
		white-space: nowrap;
	}
	.rchev {
		font-size: 10px;
		color: var(--ink3);
		transition: transform 0.2s;
		flex-shrink: 0;
	}
	.route-card.open .rchev {
		transform: rotate(90deg);
	}
	.route-body {
		padding: 0 16px 14px;
	}
	.step {
		display: flex;
		gap: 10px;
		margin-bottom: 6px;
		align-items: flex-start;
	}
	.snum {
		min-width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--trip-accent-lt, var(--sage-lt));
		border: 1px solid var(--trip-accent-md, var(--sage-md));
		color: var(--trip-accent, var(--sage));
		font-size: 10px;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		margin-top: 1px;
	}
	.stxt {
		font-size: 12.5px;
		color: var(--ink2);
		line-height: 1.5;
	}
	.stxt :global(b) {
		color: var(--ink);
		font-weight: 600;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
		margin-top: 8px;
	}
	.chip {
		font-size: 11px;
		padding: 2px 9px;
		border-radius: 6px;
		border: 1px solid var(--trip-border);
		background: var(--cream);
		color: var(--ink2);
	}
	.chip.warn {
		background: var(--amber-lt);
		color: var(--amber);
		border-color: var(--amber-md);
	}
	.chip.good {
		background: var(--sage-lt);
		color: var(--sage);
		border-color: var(--sage-md);
	}
</style>
