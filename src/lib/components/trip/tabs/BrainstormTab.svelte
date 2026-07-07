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

<div class="flex flex-col gap-3.5">
	<div class="flex items-start justify-between gap-3">
		<div>
			<div class="text-[16px] font-bold text-(--ink)">💭 Brainstorm</div>
			<div class="mt-[3px] max-w-[60ch] text-[12.5px] leading-normal text-(--ink3)">
				Dump ideas, links, and findings here — the AI co-pilot reads this when planning. Auto-saves
				as you type.
			</div>
		</div>
		<span
			class="pt-[3px] text-[11px] font-semibold whitespace-nowrap text-(--ink3) data-[status=saved]:text-(--sage)"
			data-status={status}
		>
			{#if status === 'saving'}Saving…{:else if status === 'saved'}Saved ✓{/if}
		</span>
	</div>

	<textarea
		class="min-h-[60vh] w-full resize-y rounded-xl border border-(--trip-border) bg-(--white) px-[18px] py-4 text-sm leading-[1.7] text-(--ink) placeholder:text-(--ink3) focus:border-[var(--trip-accent,var(--sage))] focus:shadow-[0_0_0_3px_var(--trip-accent-lt,var(--sage-lt))] focus:outline-none"
		bind:value={draft}
		oninput={onInput}
		onblur={onBlur}
		placeholder="Must-see spots, TikTok/Instagram links, hikes, restaurant names, budget caps, packing reminders, open questions…"
	></textarea>
</div>
