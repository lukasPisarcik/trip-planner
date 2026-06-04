<script lang="ts">
	let { html }: { html: string } = $props();
</script>

<!-- eslint-disable-next-line svelte/no-at-html-tags -->
<div class="callout">{@html html}</div>

<style>
	.callout {
		background: var(--trip-accent-lt, var(--sage-lt));
		border: 1px solid var(--trip-accent-md, var(--sage-md));
		border-radius: 10px;
		padding: 12px 16px;
		font-size: 13px;
		color: var(--trip-accent, var(--sage));
		margin-bottom: 24px;
		line-height: 1.5;
	}
	.callout :global(strong) {
		font-weight: 700;
		color: var(--trip-accent, var(--sage));
	}
</style>
