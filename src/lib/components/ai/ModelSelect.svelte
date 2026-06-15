<script lang="ts">
	import { Check, ChevronDown } from '@lucide/svelte';
	import {
		DropdownMenu,
		DropdownMenuTrigger,
		DropdownMenuContent,
		DropdownMenuItem
	} from '$lib/components/ui/dropdown-menu';
	import { CHAT_MODELS } from '$lib/schemas';
	import { modelStore } from '$lib/stores';
	import ClaudeMark from './ClaudeMark.svelte';

	let { disabled = false }: { disabled?: boolean } = $props();

	const current = $derived(CHAT_MODELS.find((m) => m.id === modelStore.current) ?? CHAT_MODELS[0]);
</script>

<DropdownMenu>
	<DropdownMenuTrigger
		{disabled}
		class="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 py-1 pr-2 pl-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
	>
		<ClaudeMark class="size-3.5 shrink-0" />
		<span class="max-w-[10rem] truncate">Claude {current.label}</span>
		<ChevronDown class="size-3.5 shrink-0 opacity-60" />
	</DropdownMenuTrigger>
	<DropdownMenuContent side="top" align="start" class="w-60">
		{#each CHAT_MODELS as m (m.id)}
			<DropdownMenuItem class="cursor-pointer gap-2.5 py-2" onSelect={() => modelStore.set(m.id)}>
				<ClaudeMark class="size-4 shrink-0" />
				<span class="flex flex-col">
					<span class="text-sm leading-tight">Claude {m.label}</span>
					<span class="text-xs text-muted-foreground">{m.blurb}</span>
				</span>
				{#if m.id === modelStore.current}
					<Check class="ml-auto size-4" />
				{/if}
			</DropdownMenuItem>
		{/each}
	</DropdownMenuContent>
</DropdownMenu>
