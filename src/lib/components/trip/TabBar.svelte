<script lang="ts">
	interface TabDef {
		id: string;
		label: string;
	}
	let {
		tabs,
		active,
		onselect
	}: {
		tabs: TabDef[];
		active: string;
		onselect: (id: string) => void;
	} = $props();
</script>

<div class="tabs">
	{#each tabs as tab (tab.id)}
		<button
			type="button"
			class="tab"
			class:active={active === tab.id}
			onclick={() => onselect(tab.id)}
		>
			{tab.label}
		</button>
	{/each}
</div>

<style>
	.tabs {
		position: sticky;
		top: 3.5rem; /* header h-14 */
		z-index: 15;
		background: var(--white);
		border-bottom: 1px solid var(--trip-border);
		display: flex;
		padding: 0 40px;
		gap: 0;
		overflow-x: auto;
		scrollbar-width: none;
	}
	.tabs::-webkit-scrollbar {
		display: none;
	}
	.tab {
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
	@media (max-width: 640px) {
		.tabs {
			padding: 0 16px;
		}
		.tab {
			padding: 12px 14px;
		}
	}
</style>
