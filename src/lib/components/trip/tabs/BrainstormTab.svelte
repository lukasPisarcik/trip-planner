<script lang="ts">
	import { saveBrainstorm } from '$lib/remote/trips.remote';
	import { toast } from '$lib';

	let { slug, content }: { slug: string; content: string | undefined } = $props();

	// Seed the editor from the trip's saved notes; the $effect below re-seeds it
	// whenever we navigate to a different trip (so initial-value capture is intended).
	// svelte-ignore state_referenced_locally
	let draft = $state(content ?? '');
	// svelte-ignore state_referenced_locally
	let status = $state<'idle' | 'saving' | 'saved'>(content ? 'saved' : 'idle');
	// svelte-ignore state_referenced_locally
	let loadedSlug = $state(slug);
	let timer: ReturnType<typeof setTimeout> | undefined;

	// When the user navigates to a different trip, reset the editor to that trip's
	// notes. Guarded on slug so typing (which changes `draft`, not `slug`) never
	// clobbers in-progress edits.
	$effect(() => {
		if (slug !== loadedSlug) {
			loadedSlug = slug;
			draft = content ?? '';
			status = content ? 'saved' : 'idle';
			clearTimeout(timer);
		}
	});

	async function persist() {
		try {
			await saveBrainstorm({ slug, content: draft });
			status = 'saved';
		} catch (e) {
			status = 'idle';
			toast.error(e instanceof Error ? e.message : 'Failed to save notes');
		}
	}

	function onInput() {
		status = 'saving';
		clearTimeout(timer);
		timer = setTimeout(persist, 700);
	}

	// Flush a pending debounce immediately when the field loses focus (e.g. the
	// user clicks away to another trip before the 700ms timer fires).
	function onBlur() {
		if (status !== 'saving') return;
		clearTimeout(timer);
		persist();
	}
</script>

<div class="bs">
	<div class="bs-head">
		<div>
			<div class="bs-title">💭 Brainstorm</div>
			<div class="bs-sub">
				Dump ideas, links, and findings here — the AI co-pilot reads this when planning. Auto-saves
				as you type.
			</div>
		</div>
		<span class="bs-status" data-status={status}>
			{#if status === 'saving'}Saving…{:else if status === 'saved'}Saved ✓{/if}
		</span>
	</div>

	<textarea
		class="bs-area"
		bind:value={draft}
		oninput={onInput}
		onblur={onBlur}
		placeholder="Must-see spots, TikTok/Instagram links, hikes, restaurant names, budget caps, packing reminders, open questions…"
	></textarea>
</div>

<style>
	.bs {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.bs-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
	}
	.bs-title {
		font-size: 16px;
		font-weight: 700;
		color: var(--ink);
	}
	.bs-sub {
		font-size: 12.5px;
		color: var(--ink3);
		margin-top: 3px;
		max-width: 60ch;
		line-height: 1.5;
	}
	.bs-status {
		font-size: 11px;
		font-weight: 600;
		color: var(--ink3);
		white-space: nowrap;
		padding-top: 3px;
	}
	.bs-status[data-status='saved'] {
		color: var(--sage);
	}
	.bs-area {
		width: 100%;
		min-height: 60vh;
		resize: vertical;
		background: var(--white);
		border: 1px solid var(--trip-border);
		border-radius: 12px;
		padding: 16px 18px;
		font-family: inherit;
		font-size: 14px;
		line-height: 1.7;
		color: var(--ink);
	}
	.bs-area:focus {
		outline: none;
		border-color: var(--trip-accent, var(--sage));
		box-shadow: 0 0 0 3px var(--trip-accent-lt, var(--sage-lt));
	}
	.bs-area::placeholder {
		color: var(--ink3);
	}
</style>
