<script lang="ts">
	import type { TipsTab } from '$lib/trips';
	import SectionNote from '../SectionNote.svelte';

	let { data }: { data: TipsTab } = $props();
</script>

<div class="mb-4 text-[10px] font-bold tracking-[0.12em] text-(--ink3) uppercase">
	{data.sectionLabel}
</div>

<div class="grid grid-cols-[1fr_1fr] gap-2.5 max-[580px]:grid-cols-[1fr]">
	{#each data.cards as card, i (i)}
		<div class="rounded-[10px] border border-(--trip-border) bg-(--white) p-3.5">
			<h4 class="mb-[5px] text-[12.5px] font-semibold text-(--ink)">{card.icon} {card.title}</h4>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			<p class="tip-body text-xs leading-[1.55] text-(--ink2)">{@html card.body}</p>
		</div>
	{/each}
</div>

<SectionNote html={data.note} marginTop="16px" />

<style>
	/* Bold text inside the {@html}-injected card body — utilities can't reach it. */
	.tip-body :global(strong) {
		font-weight: 600;
		color: var(--ink);
	}
</style>
