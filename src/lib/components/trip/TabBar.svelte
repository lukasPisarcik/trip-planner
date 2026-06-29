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

<div class="tab-wrap" class:glass-mode={glass} data-at-start={atStart} data-at-end={atEnd}>
	<div class="tabs" bind:this={scroller} onscroll={updateEdges}>
		{#each tabs as tab (tab.id)}
			<button
				type="button"
				class="tab"
				class:active={active === tab.id}
				data-id={tab.id}
				onclick={() => onselect(tab.id)}
			>
				{tab.label}
			</button>
		{/each}
	</div>
</div>

<style>
	.tab-wrap {
		/* `--tab-bar-top` lets the parent pin the bar below the collapsed map peek;
		   falls back to the header height when there's no backdrop. */
		position: sticky;
		top: var(--tab-bar-top, 3.5rem); /* header h-14 */
		z-index: 15;
		background: var(--white);
		border-bottom: 1px solid var(--trip-border);
		--tab-fade-color: var(--white);
	}
	.tab-wrap.glass-mode {
		background: var(--glass-bg);
		-webkit-backdrop-filter: blur(var(--glass-blur)) saturate(160%);
		backdrop-filter: blur(var(--glass-blur)) saturate(160%);
		border-bottom: 1px solid var(--glass-stroke);
		--tab-fade-color: var(--glass-bg);
	}
	.tabs {
		display: flex;
		gap: 0;
		padding: 0 40px;
		overflow-x: auto;
		overscroll-behavior-x: contain;
		scroll-behavior: smooth;
		scrollbar-width: none;
	}
	.tabs::-webkit-scrollbar {
		display: none;
	}
	.tab {
		flex: 0 0 auto; /* never shrink — overflow scrolls instead of squishing labels */
		appearance: none;
		background: none;
		border: 0;
		font-family: inherit;
		padding: 14px 18px;
		font-size: 13px;
		font-weight: 500;
		color: var(--ink3);
		cursor: pointer;
		border-bottom: 2px solid transparent;
		white-space: nowrap;
		transition:
			color 0.15s,
			border-color 0.15s;
	}
	.tab:hover {
		color: var(--ink2);
	}
	.tab.active {
		color: var(--trip-accent, var(--sage));
		border-bottom-color: var(--trip-accent, var(--sage));
	}

	/* Fade hints that more tabs exist beyond the scroll edges. */
	.tab-wrap::before,
	.tab-wrap::after {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		width: 28px;
		pointer-events: none;
		z-index: 1;
		opacity: 0;
		transition: opacity 0.15s;
	}
	.tab-wrap::before {
		left: 0;
		background: linear-gradient(to right, var(--tab-fade-color), transparent);
	}
	.tab-wrap::after {
		right: 0;
		background: linear-gradient(to left, var(--tab-fade-color), transparent);
	}
	.tab-wrap:not([data-at-start='true'])::before {
		opacity: 1;
	}
	.tab-wrap:not([data-at-end='true'])::after {
		opacity: 1;
	}

	@media (max-width: 640px) {
		.tabs {
			padding: 0 16px;
		}
		.tab {
			padding: 12px 14px;
		}
	}
</style>
