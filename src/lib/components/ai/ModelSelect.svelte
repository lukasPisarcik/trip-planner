<script lang="ts">
	import { Check, ChevronDown } from '@lucide/svelte';
	import {
		DropdownMenu,
		DropdownMenuTrigger,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuGroup,
		DropdownMenuGroupHeading,
		DropdownMenuSeparator
	} from '$lib/components/ui/dropdown-menu';
	import {
		CHAT_MODELS,
		modelMeta,
		type ChatProvider,
		type ProviderAvailability
	} from '$lib/schemas';
	import { modelStore } from '$lib/stores';
	import { page } from '$app/state';
	import ClaudeMark from './ClaudeMark.svelte';
	import OpenAiMark from './OpenAiMark.svelte';

	let { disabled = false }: { disabled?: boolean } = $props();

	const current = $derived(modelMeta(modelStore.current));
	// Provider licences from the layout load. Default to all-available so the
	// picker isn't disabled before the server flag arrives.
	const avail = $derived(
		(page.data.providerAvailability ?? { anthropic: true, openai: true }) as ProviderAvailability
	);

	// Vendor groups in display order. Models without a detected licence stay
	// visible but disabled (with a "not signed in" hint on the heading).
	const GROUPS: ReadonlyArray<{ provider: ChatProvider; heading: string }> = [
		{ provider: 'anthropic', heading: 'Anthropic' },
		{ provider: 'openai', heading: 'OpenAI' }
	];
</script>

<DropdownMenu>
	<DropdownMenuTrigger
		{disabled}
		class="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 py-1 pr-2 pl-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
	>
		{#if current.provider === 'openai'}
			<OpenAiMark class="size-3.5 shrink-0" />
		{:else}
			<ClaudeMark class="size-3.5 shrink-0" />
		{/if}
		<span class="max-w-[11rem] truncate">{current.vendor} {current.label}</span>
		<ChevronDown class="size-3.5 shrink-0 opacity-60" />
	</DropdownMenuTrigger>
	<DropdownMenuContent side="top" align="start" class="w-64">
		{#each GROUPS as g, i (g.provider)}
			{#if i > 0}
				<DropdownMenuSeparator />
			{/if}
			<DropdownMenuGroup>
				<DropdownMenuGroupHeading class="text-xs text-muted-foreground">
					{g.heading}
					{#if !avail[g.provider]}
						<span class="ml-1 font-normal opacity-70">· not signed in</span>
					{/if}
				</DropdownMenuGroupHeading>
				{#each CHAT_MODELS.filter((m) => m.provider === g.provider) as m (m.id)}
					<DropdownMenuItem
						class="cursor-pointer gap-2.5 py-2"
						disabled={!avail[g.provider]}
						onSelect={() => modelStore.set(m.id)}
					>
						{#if m.provider === 'openai'}
							<OpenAiMark class="size-4 shrink-0" />
						{:else}
							<ClaudeMark class="size-4 shrink-0" />
						{/if}
						<span class="flex flex-col">
							<span class="text-sm leading-tight">{m.vendor} {m.label}</span>
							<span class="text-xs text-muted-foreground">{m.blurb}</span>
						</span>
						{#if m.id === modelStore.current}
							<Check class="ml-auto size-4" />
						{/if}
					</DropdownMenuItem>
				{/each}
			</DropdownMenuGroup>
		{/each}
	</DropdownMenuContent>
</DropdownMenu>
