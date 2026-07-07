<script lang="ts">
	let { html, marginTop }: { html: string; marginTop?: string } = $props();
</script>

<div
	class="tip-note rounded-[10px] border border-(--amber-md) bg-(--amber-lt) px-4 py-[13px] text-[12.5px] leading-[1.55] text-(--amber-strong)"
	style:margin-top={marginTop}
>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html html}
</div>

<style>
	/* Bold text inside the {@html}-injected content — utilities can't reach it. */
	.tip-note :global(strong) {
		color: var(--amber);
		font-weight: 700;
	}
</style>
