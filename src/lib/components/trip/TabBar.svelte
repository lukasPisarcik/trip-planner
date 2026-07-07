<script lang="ts">
	interface TabDef {
		id: string;
		label: string;
	}
	let {
		tabs,
		active,
		onselect,
		glass = false
	}: {
		tabs: TabDef[];
		active: string;
		onselect: (id: string) => void;
		/** Frosted translucent styling, for when the bar floats over the map backdrop. */
		glass?: boolean;
	} = $props();

	let scroller = $state<HTMLDivElement>();
	// Whether the strip is scrolled to its start / end — drives the edge fades.
	let atStart = $state(true);
	let atEnd = $state(true);

	function updateEdges() {
		const el = scroller;
		if (!el) return;
		atStart = el.scrollLeft <= 1;
		atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
	}

	// Keep the selected tab visible (it may be off-screen on a scrolled strip) and
	// recompute the fades whenever the selection changes.
	$effect(() => {
		// Referencing `active` in the selector both tracks the dependency and finds
		// the selected button.
		scroller?.querySelector<HTMLElement>(`[data-id="${active}"]`)?.scrollIntoView({
			inline: 'nearest',
			block: 'nearest',
			behavior: 'smooth'
		});
		updateEdges();
	});

	// Recompute fades on mount and whenever the viewport resizes (e.g. opening the
	// AI panel changes the available width).
	$effect(() => {
		updateEdges();
		const onResize = () => updateEdges();
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	});
</script>

<!-- `--tab-bar-top` lets the parent pin the bar below the collapsed map peek;
     falls back to the header height (h-14) when there's no backdrop. The
     before/after gradients are fade hints that more tabs exist beyond the
     scroll edges. -->
<div
	class="sticky top-[var(--tab-bar-top,3.5rem)] z-15 border-b before:pointer-events-none before:absolute before:top-0 before:bottom-0 before:left-0 before:z-1 before:w-7 before:bg-[linear-gradient(to_right,var(--tab-fade-color),transparent)] before:opacity-0 before:content-[''] before:[transition:opacity_0.15s] after:pointer-events-none after:absolute after:top-0 after:right-0 after:bottom-0 after:z-1 after:w-7 after:bg-[linear-gradient(to_left,var(--tab-fade-color),transparent)] after:opacity-0 after:content-[''] after:[transition:opacity_0.15s] data-[at-end=false]:after:opacity-100 data-[at-start=false]:before:opacity-100 {glass
		? 'border-(--glass-stroke) bg-(--glass-bg) backdrop-blur-[var(--glass-blur)] backdrop-saturate-160 [--tab-fade-color:var(--glass-bg)]'
		: 'border-(--trip-border) bg-(--white) [--tab-fade-color:var(--white)]'}"
	data-at-start={atStart}
	data-at-end={atEnd}
>
	<div
		class="flex [scrollbar-width:none] overflow-x-auto overscroll-x-contain scroll-smooth px-10 max-sm:px-4 [&::-webkit-scrollbar]:hidden"
		bind:this={scroller}
		onscroll={updateEdges}
	>
		{#each tabs as tab (tab.id)}
			<!-- flex-none: never shrink — overflow scrolls instead of squishing labels -->
			<button
				type="button"
				class="flex-none cursor-pointer appearance-none border-0 border-b-2 bg-transparent px-[18px] py-3.5 text-[13px] font-medium whitespace-nowrap [transition:color_0.15s,border-color_0.15s] max-sm:px-3.5 max-sm:py-3 {active ===
				tab.id
					? 'border-b-[var(--trip-accent,var(--sage))] text-[var(--trip-accent,var(--sage))]'
					: 'border-b-transparent text-(--ink3) hover:text-(--ink2)'}"
				data-id={tab.id}
				onclick={() => onselect(tab.id)}
			>
				{tab.label}
			</button>
		{/each}
	</div>
</div>
