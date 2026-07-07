<script lang="ts">
	// A small branded "working" animation built from the logo's three route stops
	// (teal → amber → purple) hopping along a faint route track, left to right —
	// a trip being planned. Replaces the generic three-dot typing indicator.
	let { size = 7, class: className = '' }: { size?: number; class?: string } = $props();

	const stopClass =
		'relative size-(--dot) rounded-[999px] animate-hop motion-reduce:animate-none motion-reduce:transform-none motion-reduce:opacity-85';
</script>

<span
	class={'relative inline-flex items-center gap-[calc(var(--dot)*0.85)] py-[calc(var(--dot)*0.5)] ' +
		className}
	style="--dot: {size}px"
	aria-hidden="true"
>
	<!-- The route the stops sit on. -->
	<span
		class="absolute inset-x-[8%] top-1/2 h-[max(1px,calc(var(--dot)*0.28))] -translate-y-1/2 rounded-[999px] bg-current opacity-16"
	></span>
	<span class="{stopClass} bg-[#1d9e75]"></span>
	<span class="{stopClass} bg-[#ef9f27] [animation-delay:0.16s]"></span>
	<span class="{stopClass} bg-[#534ab7] [animation-delay:0.32s]"></span>
</span>
