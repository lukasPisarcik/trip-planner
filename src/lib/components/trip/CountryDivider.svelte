<script lang="ts">
	import type { CountryHeader } from '$lib/trips';
	let { header }: { header: CountryHeader } = $props();
</script>

<div class="country-divider">
	<div class="flag">{header.flag}</div>
	<div class="name">{header.name}</div>
	<div class="nights">{header.nights}</div>
	<div class="rule"></div>
</div>

<style>
	.country-divider {
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 24px 0 12px;
	}
	.flag {
		font-size: 22px;
		line-height: 1;
	}
	.name {
		font-family: var(--font-serif);
		font-size: 1.2rem;
		color: var(--ink);
	}
	.nights {
		font-size: 11px;
		font-weight: 600;
		padding: 2px 10px;
		border-radius: 10px;
		background: var(--trip-accent-lt, var(--sage-lt));
		color: var(--trip-accent, var(--sage));
		border: 1px solid var(--trip-accent-md, var(--sage-md));
	}
	.rule {
		flex: 1;
		height: 1px;
		background: var(--trip-border);
	}
	.country-divider:first-child {
		margin-top: 0;
	}
</style>
