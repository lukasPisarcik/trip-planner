<script lang="ts">
	import type { TipsTab } from '$lib/trips';
	import SectionNote from '../SectionNote.svelte';

	let { data }: { data: TipsTab } = $props();
</script>

<div class="section-label">{data.sectionLabel}</div>

<div class="tips-grid">
	{#each data.cards as card, i (i)}
		<div class="tip-card">
			<h4>{card.icon} {card.title}</h4>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			<p>{@html card.body}</p>
		</div>
	{/each}
</div>

<SectionNote html={data.note} marginTop="16px" />

<style>
	.section-label {
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--ink3);
		margin-bottom: 16px;
	}
	.tips-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
	@media (max-width: 580px) {
		.tips-grid {
			grid-template-columns: 1fr;
		}
	}
	.tip-card {
		background: var(--white);
		border: 1px solid var(--trip-border);
		border-radius: 10px;
		padding: 14px;
	}
	.tip-card h4 {
		font-size: 12.5px;
		font-weight: 600;
		color: var(--ink);
		margin-bottom: 5px;
	}
	.tip-card p {
		font-size: 12px;
		color: var(--ink2);
		line-height: 1.55;
	}
	.tip-card p :global(strong) {
		font-weight: 600;
		color: var(--ink);
	}
</style>
