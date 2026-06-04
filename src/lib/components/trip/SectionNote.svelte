<script lang="ts">
	let { html, marginTop }: { html: string; marginTop?: string } = $props();
</script>

<!-- eslint-disable-next-line svelte/no-at-html-tags -->
<div class="tip-note" style:margin-top={marginTop}>{@html html}</div>

<style>
	.tip-note {
		background: var(--amber-lt);
		border: 1px solid var(--amber-md);
		border-radius: 10px;
		padding: 13px 16px;
		font-size: 12.5px;
		color: var(--amber-strong);
		line-height: 1.55;
	}
	.tip-note :global(strong) {
		color: var(--amber);
		font-weight: 700;
	}
</style>
