<script lang="ts">
	import type { TurnItem } from '$lib/stores';
	import { formatDuration } from '$lib/ai/formatDuration';

	let {
		items,
		elapsed = 0,
		streaming = false
	}: {
		items: TurnItem[];
		/** Live elapsed run time (ms) of the in-flight turn. */
		elapsed?: number;
		streaming?: boolean;
	} = $props();

	// Whole-chat run time: the sum of every settled turn's duration. The in-flight
	// turn has no persisted duration yet, so while streaming we add its live elapsed
	// for a continuously-ticking total — cumulative working time, not wall-clock
	// (idle gaps between turns are excluded). Distinct from the per-turn "Ran for".
	const chatTotalMs = $derived(
		items.reduce((n, i) => n + (i.kind === 'assistant' && i.durationMs ? i.durationMs : 0), 0)
	);
	const chatTotalLive = $derived(chatTotalMs + (streaming ? elapsed : 0));
</script>

{#if chatTotalLive > 0}
	<div
		class="inline-flex w-fit items-center gap-1 rounded-full border border-(--rose-md) bg-(--rose-lt) px-2.5 py-1 text-[11px] font-medium text-(--rose)"
		title="Total time the agent has spent working in this chat"
	>
		Chat total · {formatDuration(chatTotalLive)}
	</div>
{/if}
