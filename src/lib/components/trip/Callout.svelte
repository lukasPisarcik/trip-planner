<script lang="ts">
	let { html }: { html: string } = $props();
</script>

<div
	class="callout mb-6 rounded-[10px] border border-[var(--trip-accent-md,var(--sage-md))] bg-[var(--trip-accent-lt,var(--sage-lt))] px-4 py-3 text-[13px] leading-normal text-[var(--trip-accent,var(--sage))]"
>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html html}
</div>

<style>
	/* Bold text inside the {@html}-injected content — utilities can't reach it. */
	.callout :global(strong) {
		font-weight: 700;
		color: var(--trip-accent, var(--sage));
	}
</style>
