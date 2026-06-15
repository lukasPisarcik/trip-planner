<script lang="ts">
	import { fly } from 'svelte/transition';
	import { CircleCheck, ArrowLeft, ArrowRight } from '@lucide/svelte';
	import type { TurnItem } from '$lib/stores';

	let {
		item,
		onsubmit
	}: {
		item: Extract<TurnItem, { kind: 'questions' }>;
		onsubmit?: (text: string) => void;
	} = $props();

	const OTHER = '__other__';
	const questions = $derived(item.payload.questions ?? []);
	const total = $derived(questions.length);

	// One question at a time. Answer state (keyed by question id) is preserved as
	// the user steps back and forth.
	let step = $state(0);
	let single = $state<Record<string, string>>({});
	let multi = $state<Record<string, string[]>>({});
	let text = $state<Record<string, string>>({});
	let other = $state<Record<string, string>>({});

	const current = $derived(questions[Math.min(step, total - 1)]);
	const isLast = $derived(step >= total - 1);

	function toggleMulti(qid: string, value: string) {
		const arr = multi[qid] ?? [];
		multi[qid] = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
	}

	function answerFor(q: (typeof questions)[number]): string {
		if (q.kind === 'text') return text[q.id]?.trim() ?? '';
		if (q.kind === 'single') {
			const v = single[q.id];
			if (!v) return '';
			if (v === OTHER) return other[q.id]?.trim() ?? '';
			return q.options?.find((o) => o.value === v)?.label ?? v;
		}
		const vals = multi[q.id] ?? [];
		const labels = vals
			.filter((v) => v !== OTHER)
			.map((v) => q.options?.find((o) => o.value === v)?.label ?? v);
		if (vals.includes(OTHER) && other[q.id]?.trim()) labels.push(other[q.id].trim());
		return labels.join(', ');
	}

	const hasAnyAnswer = $derived(questions.some((q) => answerFor(q) !== ''));

	function next() {
		if (step < total - 1) step++;
	}
	function back() {
		if (step > 0) step--;
	}
	function submit() {
		const lines = questions.map((q) => `- ${q.question} → ${answerFor(q) || '(skipped)'}`);
		item.answered = true; // optimistic lock so the form goes read-only immediately
		onsubmit?.(`Here are my answers:\n${lines.join('\n')}`);
	}
</script>

{#if item.answered}
	<!-- Read-only once answered; the user's answer message renders right below. -->
	<div
		class="flex items-center gap-2 rounded-[10px] border border-primary/25 bg-primary/5 px-3 py-2 text-[12.5px] text-muted-foreground"
	>
		<CircleCheck class="size-4 shrink-0 text-primary" />
		<span>Answered{total ? ` · ${total} question${total > 1 ? 's' : ''}` : ''}</span>
	</div>
{:else if current}
	<div class="rounded-[14px] border bg-muted/30 px-4 py-3.5">
		{#if item.payload.intro}
			<p class="m-0 mb-3 text-[13px] leading-[1.5] text-muted-foreground">{item.payload.intro}</p>
		{/if}

		<!-- Progress: one segment per question, filled up to the current step. -->
		<div class="mb-3 flex items-center gap-2">
			<div class="flex flex-1 gap-1">
				{#each questions as _q, i (i)}
					<span
						class="h-1 flex-1 rounded-full transition-colors duration-200 {i <= step
							? 'bg-primary'
							: 'bg-border'}"
					></span>
				{/each}
			</div>
			<span class="shrink-0 text-[11px] font-medium text-muted-foreground tabular-nums">
				{step + 1} / {total}
			</span>
		</div>

		<!-- Current question (animates in on step change). -->
		{#key step}
			<div in:fly={{ x: 14, duration: 160 }} class="min-h-[3.5rem]">
				<p class="m-0 mb-2 text-[13.5px] font-medium text-foreground">{current.question}</p>

				{#if current.kind === 'text'}
					<input
						type="text"
						bind:value={text[current.id]}
						placeholder="Type your answer…"
						class="w-full rounded-md border bg-background px-2.5 py-1.5 text-[13px] text-foreground outline-none focus:ring-2 focus:ring-ring"
					/>
				{:else}
					<div class="flex flex-col gap-1">
						{#each current.options ?? [] as opt (opt.value)}
							<label
								class="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors hover:bg-primary/5 has-[:checked]:bg-primary/10"
							>
								{#if current.kind === 'single'}
									<input
										type="radio"
										name={current.id}
										value={opt.value}
										bind:group={single[current.id]}
										class="mt-0.5 accent-primary"
									/>
								{:else}
									<input
										type="checkbox"
										checked={(multi[current.id] ?? []).includes(opt.value)}
										onchange={() => toggleMulti(current.id, opt.value)}
										class="mt-0.5 accent-primary"
									/>
								{/if}
								<span class="min-w-0 flex-1">
									<span class="text-foreground">{opt.label}</span>
									{#if opt.hint}
										<span class="block text-[11.5px] text-muted-foreground">{opt.hint}</span>
									{/if}
								</span>
							</label>
						{/each}

						{#if current.allowOther}
							<label
								class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors hover:bg-primary/5 has-[:checked]:bg-primary/10"
							>
								{#if current.kind === 'single'}
									<input
										type="radio"
										name={current.id}
										value={OTHER}
										bind:group={single[current.id]}
										class="accent-primary"
									/>
								{:else}
									<input
										type="checkbox"
										checked={(multi[current.id] ?? []).includes(OTHER)}
										onchange={() => toggleMulti(current.id, OTHER)}
										class="accent-primary"
									/>
								{/if}
								<span class="text-muted-foreground">Other</span>
							</label>
							{#if (current.kind === 'single' && single[current.id] === OTHER) || (current.kind === 'multi' && (multi[current.id] ?? []).includes(OTHER))}
								<input
									type="text"
									bind:value={other[current.id]}
									placeholder="Tell me more…"
									class="ml-6 w-[calc(100%-1.5rem)] rounded-md border bg-background px-2.5 py-1.5 text-[13px] text-foreground outline-none focus:ring-2 focus:ring-ring"
								/>
							{/if}
						{/if}
					</div>
				{/if}
			</div>
		{/key}

		<!-- Navigation -->
		<div class="mt-3.5 flex items-center justify-between">
			<button
				type="button"
				onclick={back}
				class="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[12.5px] font-medium text-muted-foreground transition hover:text-foreground {step ===
				0
					? 'invisible'
					: ''}"
			>
				<ArrowLeft class="size-3.5" /> Back
			</button>

			{#if isLast}
				<button
					type="button"
					onclick={submit}
					disabled={!hasAnyAnswer}
					class="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-[12.5px] font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
				>
					Send answers
				</button>
			{:else}
				<button
					type="button"
					onclick={next}
					class="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-[12.5px] font-medium text-primary-foreground transition hover:opacity-90"
				>
					Next <ArrowRight class="size-3.5" />
				</button>
			{/if}
		</div>
	</div>
{/if}
