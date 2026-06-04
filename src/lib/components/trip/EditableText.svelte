<script lang="ts">
	let {
		value,
		onsave,
		tag = 'span',
		placeholder = ''
	}: {
		value: string;
		onsave: (next: string) => void | Promise<void>;
		tag?: 'span' | 'h1' | 'em';
		placeholder?: string;
	} = $props();

	let editing = $state(false);
	let draft = $state('');
	let saving = $state(false);

	function start() {
		draft = value;
		editing = true;
	}

	async function commit() {
		const next = draft.trim();
		if (next.length === 0 || next === value) {
			editing = false;
			return;
		}
		saving = true;
		try {
			await onsave(next);
		} finally {
			saving = false;
			editing = false;
		}
	}

	function cancel() {
		editing = false;
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			commit();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			cancel();
		}
	}
</script>

{#if editing}
	<!-- svelte-ignore a11y_autofocus -->
	<input
		class="editable input"
		bind:value={draft}
		{onkeydown}
		onblur={commit}
		{placeholder}
		disabled={saving}
		autofocus
	/>
{:else}
	<svelte:element
		this={tag}
		class="editable display"
		role="button"
		tabindex="0"
		onclick={start}
		onkeydown={(e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && start()}
		title="Click to edit"
	>
		{value}
	</svelte:element>
{/if}

<style>
	.editable {
		font: inherit;
		color: inherit;
		background: transparent;
		border: none;
		padding: 0;
		margin: 0;
		display: inline;
		font-style: inherit;
		font-weight: inherit;
		font-family: inherit;
	}
	.display {
		cursor: text;
		border-radius: 4px;
		padding: 0 2px;
		margin: 0 -2px;
		transition: background 0.1s;
	}
	.display:hover {
		background: var(--trip-accent-lt, hsl(0 0% 0% / 0.05));
	}
	.input {
		outline: none;
		box-shadow: inset 0 -2px 0 var(--trip-accent, currentColor);
		min-width: 4ch;
	}
</style>
