<script lang="ts">
	import type { TransportRoute } from '$lib/trips';

	let { route }: { route: TransportRoute } = $props();
	// svelte-ignore state_referenced_locally
	let open = $state(route.defaultOpen ?? false);

	const modeTone: Record<TransportRoute['mode'], string> = {
		bus: 'border-(--sage-md) bg-(--sage-lt) text-(--sage)',
		train: 'border-(--sky-md) bg-(--sky-lt) text-(--sky)',
		metro: 'border-(--violet-md) bg-(--violet-lt) text-(--violet)',
		taxi: 'border-(--rose-md) bg-(--rose-lt) text-(--rose)'
	};

	const chipTone: Record<'default' | 'warn' | 'good', string> = {
		default: 'border-(--trip-border) bg-(--cream) text-(--ink2)',
		warn: 'border-(--amber-md) bg-(--amber-lt) text-(--amber)',
		good: 'border-(--sage-md) bg-(--sage-lt) text-(--sage)'
	};
</script>

<div class="mb-2 overflow-hidden rounded-[10px] border border-(--trip-border) bg-(--white)">
	<button
		type="button"
		class="flex w-full cursor-pointer items-center gap-2.5 px-4 py-3 text-left select-none"
		onclick={() => (open = !open)}
		aria-expanded={open}
	>
		<div class="min-w-0 flex-1">
			<strong class="text-[13px] text-(--ink)">{route.title}</strong>
			<span class="mt-px block text-[11.5px] text-(--ink3)">{route.subtitle}</span>
		</div>
		<span
			class="rounded-[10px] border px-[9px] py-0.5 text-[10.5px] font-semibold whitespace-nowrap {modeTone[
				route.mode
			]}">{route.modeLabel}</span
		>
		<span class="text-[12px] font-bold whitespace-nowrap text-[var(--trip-accent,var(--sage))]"
			>{route.price}</span
		>
		<div
			class="shrink-0 text-[10px] text-(--ink3) transition-transform duration-200 ease-[ease] {open
				? 'rotate-90'
				: ''}"
		>
			▶
		</div>
	</button>
	{#if open}
		<div class="px-4 pb-3.5">
			{#each route.steps as step, i (i)}
				<div class="mb-1.5 flex items-start gap-2.5">
					<div
						class="mt-px flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full border border-[var(--trip-accent-md,var(--sage-md))] bg-[var(--trip-accent-lt,var(--sage-lt))] text-[10px] font-bold text-[var(--trip-accent,var(--sage))]"
					>
						{i + 1}
					</div>
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					<div class="stxt text-[12.5px] leading-[1.5] text-(--ink2)">{@html step.text}</div>
				</div>
			{/each}
			{#if route.chips.length}
				<div class="mt-2 flex flex-wrap gap-[5px]">
					{#each route.chips as chip, i (i)}
						<span
							class="rounded-[6px] border px-[9px] py-0.5 text-[11px] {chipTone[
								chip.tone ?? 'default'
							]}"
						>
							{chip.label}
						</span>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	/* Targets <b> inside runtime-injected {@html step.text} — utility classes can't reach it. */
	.stxt :global(b) {
		color: var(--ink);
		font-weight: 600;
	}
</style>
