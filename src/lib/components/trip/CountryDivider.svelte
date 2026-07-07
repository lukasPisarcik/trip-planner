<script lang="ts">
	import type { CountryHeader } from '$lib/trips';
	let { header }: { header: CountryHeader } = $props();
</script>

<div class="mt-6 mb-3 flex items-center gap-3 first:mt-0">
	<div class="text-[22px] leading-none">{header.flag}</div>
	<div class="font-serif text-[1.2rem] text-(--ink)">{header.name}</div>
	<div
		class="rounded-[10px] border border-[var(--trip-accent-md,var(--sage-md))] bg-[var(--trip-accent-lt,var(--sage-lt))] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--trip-accent,var(--sage))]"
	>
		{header.nights}
	</div>
	<div class="h-px flex-1 bg-(--trip-border)"></div>
</div>
