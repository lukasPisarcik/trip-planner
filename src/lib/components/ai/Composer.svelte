<script lang="ts">
	import { ArrowUp, Square, X } from '@lucide/svelte';
	import { useQuery } from 'convex-svelte';
	import { api } from '$convex/_generated/api';
	import { MAX_REEL_ATTACHMENTS, type Reel } from '$lib/schemas';
	import type { ReelChip } from '$lib/stores/chatSession.svelte';
	import ModelSelect from './ModelSelect.svelte';
	import ReelPicker from './ReelPicker.svelte';

	let {
		onsend,
		onstop,
		streaming = false,
		disabled = false,
		showModel = false,
		usage = null,
		placeholder = 'Plan a trip…',
		value = $bindable(''),
		attachments = $bindable<ReelChip[]>([])
	}: {
		onsend: (text: string, attachments: ReelChip[]) => void;
		onstop?: () => void;
		streaming?: boolean;
		disabled?: boolean;
		showModel?: boolean;
		/** Context-window footprint of the conversation so far (drives the gauge). */
		usage?: { used: number; total: number } | null;
		placeholder?: string;
		/** Two-way bound draft text, so a parent can prefill it (e.g. a starter prompt). */
		value?: string;
		/** Reels attached from the /library "Build trip" handoff (seeded by the parent). */
		attachments?: ReelChip[];
	} = $props();

	// Resolve each attached reel's live thumbnail/platform for the chip. The parent
	// seeds ids (+ platform from the id prefix); this fills the durable thumbnail as
	// the public listReels query loads, and the enriched chips ride along on send.
	const reelsQuery = useQuery(api.reels.listReels, {});
	const reels = $derived((reelsQuery.data ?? []) as Reel[]);
	const chips = $derived(
		attachments.map((a): ReelChip => {
			const r = reels.find((x) => x.id === a.reelId);
			return {
				reelId: a.reelId,
				platform: r?.platform ?? a.platform,
				thumbnailUrl: r?.thumbnailUrl ?? a.thumbnailUrl
			};
		})
	);

	function removeAttachment(id: string) {
		attachments = attachments.filter((a) => a.reelId !== id);
	}

	// Pick reels straight from the composer (beside the model selector). Toggling an
	// id adds/removes it from `attachments`; adds are capped so the send body never
	// exceeds the server's attachment limit. Thumbnail/platform enrich via `chips`.
	function toggleAttachment(id: string) {
		if (attachments.some((a) => a.reelId === id)) {
			attachments = attachments.filter((a) => a.reelId !== id);
			return;
		}
		if (attachments.length >= MAX_REEL_ATTACHMENTS) return;
		const r = reels.find((x) => x.id === id);
		attachments = [
			...attachments,
			{ reelId: id, platform: r?.platform ?? 'reel', thumbnailUrl: r?.thumbnailUrl }
		];
	}

	let ta = $state<HTMLTextAreaElement | null>(null);

	// When a parent prefills the draft, grow the textarea to fit it.
	$effect(() => {
		void value;
		queueMicrotask(autoresize);
	});

	const canSend = $derived(value.trim().length > 0 && !disabled && !streaming);

	// Context-usage ring geometry. stroke-dashoffset fills the circle clockwise.
	const RING_CIRC = 2 * Math.PI * 7;
	const usagePct = $derived(
		usage ? Math.min(100, Math.round((usage.used / usage.total) * 100)) : 0
	);

	function fmtTokens(n: number): string {
		if (n < 1000) return String(n);
		const k = n / 1000;
		return (k >= 100 ? Math.round(k) : Math.round(k * 10) / 10) + 'k';
	}

	function autoresize() {
		if (!ta) return;
		ta.style.height = 'auto';
		ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
	}

	function send() {
		if (!canSend) return;
		onsend(value.trim(), chips);
		value = '';
		attachments = [];
		queueMicrotask(autoresize);
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			send();
		} else if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			send();
		}
	}
</script>

<div class="p-3">
	<div
		class="flex flex-col gap-2 rounded-2xl border bg-background px-2.5 pt-2.5 pb-2 transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/15"
	>
		{#if chips.length > 0}
			<div class="flex flex-wrap gap-1.5 px-1">
				{#each chips as chip (chip.reelId)}
					<span
						class="inline-flex items-center gap-1.5 rounded-lg border bg-muted/40 py-1 pr-1 pl-1 text-[11.5px] leading-none text-foreground"
					>
						{#if chip.thumbnailUrl}
							<img src={chip.thumbnailUrl} alt="" class="size-5 rounded object-cover" />
						{:else}
							<span
								class="grid size-5 place-items-center rounded bg-muted text-[9px] text-muted-foreground"
								aria-hidden="true">▶</span
							>
						{/if}
						<span class="capitalize">{chip.platform}</span>
						<button
							type="button"
							class="inline-flex size-4 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
							onclick={() => removeAttachment(chip.reelId)}
							aria-label={`Remove ${chip.platform} reel`}
						>
							<X class="size-3" />
						</button>
					</span>
				{/each}
			</div>
		{/if}
		<textarea
			bind:this={ta}
			bind:value
			oninput={autoresize}
			{onkeydown}
			{placeholder}
			{disabled}
			rows="1"
			class="max-h-[200px] min-h-6 w-full resize-none border-0 bg-transparent px-1 py-0.5 [font-family:inherit] text-[13.5px] leading-normal text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-60"
		></textarea>
		<div class="flex items-center gap-2">
			{#if showModel}
				<ModelSelect disabled={streaming} />
				<ReelPicker
					{reels}
					selectedIds={attachments.map((a) => a.reelId)}
					ontoggle={toggleAttachment}
					disabled={streaming}
				/>
			{/if}
			<div class="flex-1"></div>
			{#if usage}
				<div
					class="flex items-center gap-1 text-[11px] tabular-nums {usagePct >= 85
						? 'text-destructive'
						: 'text-muted-foreground'}"
					title={`${fmtTokens(usage.used)} / ${fmtTokens(usage.total)} tokens`}
				>
					<svg viewBox="0 0 20 20" class="size-3.5 -rotate-90" aria-hidden="true">
						<circle
							cx="10"
							cy="10"
							r="7"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
							class="text-border"
						/>
						<circle
							cx="10"
							cy="10"
							r="7"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
							stroke-linecap="round"
							class={usagePct >= 85 ? 'text-destructive' : 'text-primary'}
							stroke-dasharray={RING_CIRC}
							stroke-dashoffset={RING_CIRC * (1 - usagePct / 100)}
						/>
					</svg>
					<span>{usagePct}%</span>
				</div>
			{/if}
			{#if streaming}
				<button
					type="button"
					class="inline-flex size-[30px] items-center justify-center rounded-full bg-muted text-foreground transition active:scale-95"
					onclick={() => onstop?.()}
					aria-label="Stop"
				>
					<Square class="size-4" />
				</button>
			{:else}
				<button
					type="button"
					class="inline-flex size-[30px] items-center justify-center rounded-full bg-primary text-primary-foreground transition active:scale-95 disabled:cursor-default disabled:opacity-35"
					onclick={send}
					disabled={!canSend}
					aria-label="Send"
				>
					<ArrowUp class="size-4" />
				</button>
			{/if}
		</div>
	</div>
</div>
