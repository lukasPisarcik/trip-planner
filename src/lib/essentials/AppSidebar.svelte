<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { Sidebar } from '$lib/components';
	import {
		DropdownMenu,
		DropdownMenuTrigger,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuSeparator,
		DropdownMenuSub,
		DropdownMenuSubTrigger,
		DropdownMenuSubContent
	} from '$lib/components/ui/dropdown-menu';
	import { cn } from '$lib/utils';
	import Logo from '$lib/components/Logo.svelte';
	import { listTrips, setTripFavorite, moveTripToFolder } from '$lib/remote/trips.remote';
	import { listChats } from '$lib/remote/chats.remote';
	import { listFolders } from '$lib/remote/folders.remote';
	import { chatActivityStore } from '$lib/stores';
	import {
		House,
		Plus,
		Trash2,
		Star,
		ChevronRight,
		MoreHorizontal,
		SquarePen,
		FolderPlus,
		FolderInput,
		Folder as FolderIcon,
		Pencil
	} from '@lucide/svelte';
	import type { Trip } from '$lib/trips';
	import type { ChatMessage, Folder } from '$lib/schemas';
	import DeleteTripConfirm from '$lib/components/trip/DeleteTripConfirm.svelte';
	import DeleteSessionConfirm from '$lib/components/ai/DeleteSessionConfirm.svelte';
	import CreateFolderDialog from '$lib/components/trip/CreateFolderDialog.svelte';
	import RenameFolderDialog from '$lib/components/trip/RenameFolderDialog.svelte';
	import DeleteFolderConfirm from '$lib/components/trip/DeleteFolderConfirm.svelte';
	import { dndzone, type DndEvent } from 'svelte-dnd-action';

	interface SessionRecord {
		sessionId: string;
		tripSlug: string | null;
		messages: ChatMessage[];
		updatedAt: number;
	}

	const SESSION_CAP = 5;
	const UNGROUPED = '__ungrouped__';
	const FLIP_MS = 150;
	const DROP_STYLE = { outline: '2px dashed hsl(var(--sidebar-ring))', borderRadius: '0.5rem' };

	const sidebar = Sidebar.useSidebar();

	const tripsQuery = listTrips({});
	const trips = $derived<Trip[]>(tripsQuery.current ?? []);
	const favorites = $derived(trips.filter((t) => t.favorite));

	const foldersQuery = listFolders({});
	const folders = $derived<Folder[]>(foldersQuery.current ?? []);
	const folderIdSet = $derived(new Set(folders.map((f) => f.id)));

	// Trips grouped by folder, and the ungrouped remainder (favorites are NOT
	// excluded — a favorited trip shows in both Favorites and its folder).
	const foldersWithTrips = $derived(
		folders.map((f) => ({ folder: f, trips: trips.filter((t) => t.folderId === f.id) }))
	);
	const ungrouped = $derived(trips.filter((t) => !t.folderId || !folderIdSet.has(t.folderId)));

	const viewerMode = $derived(page.data.viewerMode ?? false);
	const dndDisabled = $derived(viewerMode || sidebar.state === 'collapsed');

	const chatsQuery = listChats({});
	const sessions = $derived<SessionRecord[]>(chatsQuery.current ?? []);

	// Sessions grouped under the trip they belong to (newest first — listAllChats
	// already sorts by updatedAt desc). Null-slug conversations are "drafts".
	const sessionsByTrip = $derived.by(() => {
		const m: Record<string, SessionRecord[]> = {};
		for (const s of sessions) {
			if (!s.tripSlug) continue;
			(m[s.tripSlug] ??= []).push(s);
		}
		return m;
	});
	const drafts = $derived(sessions.filter((s) => !s.tripSlug));

	// Manual expand toggles + "show all sessions" per trip + folder open state.
	let manualOpen = $state<Record<string, boolean>>({});
	let showAll = $state<Record<string, boolean>>({});
	let folderOpen = $state<Record<string, boolean>>({});

	let confirmSlug = $state<string | null>(null);
	const confirmTrip = $derived(trips.find((t) => t.slug === confirmSlug) ?? null);

	// Conversation pending deletion (full record so we know where to navigate after).
	let confirmSession = $state<SessionRecord | null>(null);
	const confirmSessionView = $derived(
		confirmSession
			? { sessionId: confirmSession.sessionId, title: sessionTitle(confirmSession.messages) }
			: null
	);

	// Folder dialog state.
	let createFolderOpen = $state(false);
	let renameTarget = $state<Folder | null>(null);
	let deleteFolderTarget = $state<Folder | null>(null);
	// Trip awaiting a move when "New folder…" is picked from a trip's move submenu.
	let pendingMoveSlug = $state<string | null>(null);

	function tripHref(slug: string): string {
		return resolve('/trips/[slug]', { slug });
	}
	function sessionHref(id: string): string {
		return resolve('/agent/[sessionId]', { sessionId: id });
	}

	function sessionTitle(messages: ChatMessage[]): string {
		const first = messages.find((m) => m.role === 'user');
		const text = first?.content.trim().replace(/\s+/g, ' ') ?? 'New conversation';
		return text.length > 34 ? text.slice(0, 34) + '…' : text;
	}
	function relativeTime(ts: number): string {
		const m = Math.round((Date.now() - ts) / 60000);
		if (m < 1) return 'now';
		if (m < 60) return `${m}m`;
		const h = Math.round(m / 60);
		if (h < 24) return `${h}h`;
		return `${Math.round(h / 24)}d`;
	}

	// T3-style session status: a live "Working…" while the session streams, else
	// the settled outcome derived from the last persisted message.
	type SessionStatus = { label: string; dotClass: string; textClass: string; pulse: boolean };
	function sessionStatus(messages: ChatMessage[], streaming: boolean): SessionStatus | null {
		if (streaming)
			return {
				label: 'Working…',
				dotClass: 'bg-amber-500',
				textClass: 'text-amber-600 dark:text-amber-500',
				pulse: true
			};
		if (messages.length === 0) return null;
		switch (messages[messages.length - 1].role) {
			case 'assistant':
				return {
					label: 'Completed',
					dotClass: 'bg-[hsl(142_45%_45%)]',
					textClass: 'text-[hsl(142_45%_45%)]',
					pulse: false
				};
			case 'error':
				return {
					label: 'Failed',
					dotClass: 'bg-destructive',
					textClass: 'text-destructive',
					pulse: false
				};
			default:
				// Last message is user/tool/thinking — the turn was cut off mid-flight.
				return {
					label: 'Interrupted',
					dotClass: 'bg-muted-foreground/40',
					textClass: 'text-muted-foreground',
					pulse: false
				};
		}
	}

	function allSessionsFor(slug: string): SessionRecord[] {
		return sessionsByTrip[slug] ?? [];
	}
	function tripOpen(t: Trip): boolean {
		return (
			manualOpen[t.slug] ??
			(page.url.pathname === tripHref(t.slug) ||
				allSessionsFor(t.slug).some((s) => page.url.pathname === sessionHref(s.sessionId)))
		);
	}
	function toggleTrip(t: Trip) {
		manualOpen[t.slug] = !tripOpen(t);
	}
	function folderIsOpen(id: string): boolean {
		return folderOpen[id] ?? true;
	}
	function toggleFolder(id: string) {
		folderOpen[id] = !folderIsOpen(id);
	}

	// --- Drag and drop -------------------------------------------------------
	// svelte-dnd-action mutates the array it's given, so each zone needs a mutable
	// $state mirror. Rebuild them from the persisted data whenever it changes
	// (only happens after a move finalizes + refreshes — never mid-drag).
	type TripEntry = { id: string; trip: Trip };
	let zoneItems = $state<Record<string, TripEntry[]>>({});

	$effect(() => {
		const next: Record<string, TripEntry[]> = {};
		for (const { folder, trips: ft } of foldersWithTrips) {
			next[folder.id] = ft.map((t) => ({ id: t.slug, trip: t }));
		}
		next[UNGROUPED] = ungrouped.map((t) => ({ id: t.slug, trip: t }));
		zoneItems = next;
	});

	function handleConsider(zoneId: string, e: CustomEvent<DndEvent<TripEntry>>) {
		zoneItems[zoneId] = e.detail.items;
	}
	async function handleFinalize(zoneId: string, e: CustomEvent<DndEvent<TripEntry>>) {
		zoneItems[zoneId] = e.detail.items;
		const movedId = e.detail.info.id;
		const targetFolderId = zoneId === UNGROUPED ? null : zoneId;
		const trip = trips.find((t) => t.slug === movedId);
		if (!trip) return;
		const current = trip.folderId && folderIdSet.has(trip.folderId) ? trip.folderId : null;
		if (current === targetFolderId) return; // same zone → reorder only, not persisted
		await moveTripToFolder({ slug: movedId, folderId: targetFolderId });
		await tripsQuery.refresh();
	}

	// --- Actions -------------------------------------------------------------
	async function startNewTrip() {
		// Planning a new trip happens in the standalone agent workspace.
		await goto(resolve('/agent'));
	}
	async function newAgentChat(slug?: string) {
		// resolve() has no query-param form; the /agent page reads ?slug itself.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		await goto(slug ? `${resolve('/agent')}?slug=${encodeURIComponent(slug)}` : resolve('/agent'));
	}
	async function toggleFavorite(trip: Trip) {
		await setTripFavorite({ slug: trip.slug, favorite: !trip.favorite });
		await tripsQuery.refresh();
	}
	async function moveTrip(trip: Trip, folderId: string | null) {
		await moveTripToFolder({ slug: trip.slug, folderId });
		await tripsQuery.refresh();
		if (folderId) folderOpen[folderId] = true;
	}
	function closeCreateFolder() {
		createFolderOpen = false;
		pendingMoveSlug = null;
	}
	async function onFolderCreated(id: string) {
		await foldersQuery.refresh();
		if (pendingMoveSlug) {
			const slug = pendingMoveSlug;
			pendingMoveSlug = null;
			await moveTripToFolder({ slug, folderId: id });
			await tripsQuery.refresh();
		}
		folderOpen[id] = true;
	}
	async function onFolderRenamed() {
		await foldersQuery.refresh();
	}
	async function onFolderDeleted() {
		await Promise.all([foldersQuery.refresh(), tripsQuery.refresh()]);
	}
	async function onDeleted(slug: string) {
		await tripsQuery.refresh();
		if (page.url.pathname === tripHref(slug)) await goto(resolve('/'));
	}
	async function onSessionDeleted(sessionId: string) {
		const deleted = confirmSession;
		await chatsQuery.refresh();
		// If we're not viewing the conversation that just vanished, stay put.
		if (page.url.pathname !== sessionHref(sessionId)) return;
		// Otherwise fall back to its trip (or the agent home) so the route doesn't
		// 404 on a now-dead session.
		if (deleted?.tripSlug) await goto(resolve('/trips/[slug]', { slug: deleted.tripSlug }));
		else await goto(resolve('/agent'));
	}

	// ⌘E / Ctrl+E → new trip. (⌘N is the browser's reserved "new window"; ⌘E is
	// free in Chrome/Firefox and only acts on a text selection in Safari.)
	function onWindowKeydown(e: KeyboardEvent) {
		if (e.key.toLowerCase() !== 'e' || !(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;
		if (viewerMode) return;
		const t = e.target;
		if (t instanceof HTMLElement && t.closest('input, textarea, [contenteditable="true"]')) return;
		e.preventDefault();
		startNewTrip();
	}
</script>

<svelte:window onkeydown={onWindowKeydown} />

{#snippet sessionRow(s: SessionRecord)}
	{@const href = sessionHref(s.sessionId)}
	{@const status = sessionStatus(s.messages, chatActivityStore.isStreaming(s.sessionId))}
	<Sidebar.MenuSubItem class="group/sub relative">
		<Sidebar.MenuSubButton
			{href}
			isActive={page.url.pathname === href}
			title={`Updated ${relativeTime(s.updatedAt)} ago`}
			class={!viewerMode ? 'pr-7' : ''}
		>
			{#if status}
				<span
					class={cn(
						'size-1.5 shrink-0 rounded-full',
						status.dotClass,
						status.pulse && 'animate-pulse'
					)}
				></span>
			{/if}
			<span class="truncate">{sessionTitle(s.messages)}</span>
			<span
				class={cn(
					'ml-auto shrink-0 pl-2 text-[10px]',
					status ? status.textClass : 'text-muted-foreground',
					!viewerMode && 'group-hover/sub:opacity-0'
				)}
			>
				{status ? status.label : relativeTime(s.updatedAt)}
			</span>
		</Sidebar.MenuSubButton>
		{#if !viewerMode}
			<button
				type="button"
				class="absolute top-1/2 right-1 z-10 flex size-5 -translate-y-1/2 items-center justify-center rounded-md text-sidebar-foreground/60 opacity-0 group-focus-within/sub:opacity-100 group-hover/sub:opacity-100 hover:bg-sidebar-accent hover:text-destructive focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
				title="Delete conversation"
				aria-label="Delete conversation"
				onclick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					confirmSession = s;
				}}
			>
				<Trash2 class="size-3.5" />
			</button>
		{/if}
	</Sidebar.MenuSubItem>
{/snippet}

{#snippet tripRow(trip: Trip)}
	{@const open = tripOpen(trip)}
	{@const sess = allSessionsFor(trip.slug)}
	{@const capped = showAll[trip.slug] ? sess : sess.slice(0, SESSION_CAP)}
	<Sidebar.MenuItem class="relative">
		<button
			type="button"
			class="absolute top-1.5 left-1 z-10 flex size-5 items-center justify-center rounded-md text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
			aria-label="Toggle sessions"
			aria-expanded={open}
			onclick={() => toggleTrip(trip)}
		>
			<ChevronRight class={cn('size-3.5 transition-transform', open && 'rotate-90')} />
		</button>
		<Sidebar.MenuButton isActive={page.url.pathname === tripHref(trip.slug)} class="pl-7">
			{#snippet child({ props })}
				<a href={resolve('/trips/[slug]', { slug: trip.slug })} {...props}>
					<span class="text-base leading-none">{trip.flag}</span>
					<span class="truncate">
						{trip.title}{#if trip.titleEmphasis}&nbsp;{trip.titleEmphasis}{/if}
					</span>
				</a>
			{/snippet}
		</Sidebar.MenuButton>

		{#if !viewerMode}
			<Sidebar.MenuAction
				showOnHover
				class="right-7"
				title="New conversation"
				aria-label="New conversation"
				onclick={() => newAgentChat(trip.slug)}
			>
				<Plus />
			</Sidebar.MenuAction>
			<DropdownMenu>
				<DropdownMenuTrigger>
					{#snippet child({ props })}
						<Sidebar.MenuAction {...props} showOnHover title="More" aria-label="More">
							<MoreHorizontal />
						</Sidebar.MenuAction>
					{/snippet}
				</DropdownMenuTrigger>
				<DropdownMenuContent side="right" align="start" class="w-48">
					<DropdownMenuItem class="cursor-pointer" onSelect={() => toggleFavorite(trip)}>
						<Star class={cn('size-4', trip.favorite && 'fill-current')} />
						{trip.favorite ? 'Remove favorite' : 'Add to favorites'}
					</DropdownMenuItem>
					<DropdownMenuSub>
						<DropdownMenuSubTrigger>
							<FolderInput class="size-4" />
							Move to folder
						</DropdownMenuSubTrigger>
						<DropdownMenuSubContent class="w-48">
							{#each folders as f (f.id)}
								<DropdownMenuItem
									class="cursor-pointer"
									disabled={trip.folderId === f.id}
									onSelect={() => moveTrip(trip, f.id)}
								>
									<FolderIcon class="size-4" />
									<span class="truncate">{f.name}</span>
								</DropdownMenuItem>
							{/each}
							{#if trip.folderId}
								<DropdownMenuSeparator />
								<DropdownMenuItem class="cursor-pointer" onSelect={() => moveTrip(trip, null)}>
									Remove from folder
								</DropdownMenuItem>
							{/if}
							<DropdownMenuSeparator />
							<DropdownMenuItem
								class="cursor-pointer"
								onSelect={() => {
									pendingMoveSlug = trip.slug;
									createFolderOpen = true;
								}}
							>
								<FolderPlus class="size-4" />
								New folder…
							</DropdownMenuItem>
						</DropdownMenuSubContent>
					</DropdownMenuSub>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						variant="destructive"
						class="cursor-pointer"
						onSelect={() => (confirmSlug = trip.slug)}
					>
						<Trash2 class="size-4" />
						Delete trip
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		{/if}

		{#if open}
			<Sidebar.MenuSub>
				{#each capped as s (s.sessionId)}
					{@render sessionRow(s)}
				{/each}
				{#if sess.length > capped.length}
					<Sidebar.MenuSubItem>
						<button
							type="button"
							class="px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
							onclick={() => (showAll[trip.slug] = true)}
						>
							Show {sess.length - capped.length} more
						</button>
					</Sidebar.MenuSubItem>
				{/if}
				{#if !viewerMode && sess.length === 0}
					<Sidebar.MenuSubItem>
						<Sidebar.MenuSubButton
							class="cursor-pointer text-muted-foreground"
							onclick={() => newAgentChat(trip.slug)}
						>
							<Plus class="size-3.5" />
							<span>New conversation</span>
						</Sidebar.MenuSubButton>
					</Sidebar.MenuSubItem>
				{/if}
			</Sidebar.MenuSub>
		{/if}
	</Sidebar.MenuItem>
{/snippet}

<!-- A draggable trip list (dnd zone). Plain <ul> because `use:` actions can't
     attach to the Sidebar.Menu component; classes mirror it. -->
{#snippet tripList(zoneId: string)}
	<ul
		class={cn(
			'flex w-full min-w-0 flex-col gap-1',
			(zoneItems[zoneId]?.length ?? 0) === 0 && 'min-h-[0.5rem]'
		)}
		data-slot="sidebar-menu"
		data-sidebar="menu"
		use:dndzone={{
			items: zoneItems[zoneId] ?? [],
			type: 'sidebar-trips',
			dragDisabled: dndDisabled,
			flipDurationMs: FLIP_MS,
			dropTargetStyle: DROP_STYLE
		}}
		onconsider={(e) => handleConsider(zoneId, e)}
		onfinalize={(e) => handleFinalize(zoneId, e)}
	>
		{#each zoneItems[zoneId] ?? [] as entry (entry.id)}
			{@render tripRow(entry.trip)}
		{/each}
	</ul>
{/snippet}

{#snippet folderGroup(folder: Folder, count: number)}
	{@const fOpen = folderIsOpen(folder.id)}
	<Sidebar.Group class="py-1">
		<div class="group/folder relative flex items-center pr-7">
			<button
				type="button"
				class="flex h-8 flex-1 items-center gap-1.5 truncate rounded-md px-1 text-xs font-medium text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden hover:text-sidebar-foreground"
				aria-expanded={fOpen}
				onclick={() => toggleFolder(folder.id)}
			>
				<ChevronRight class={cn('size-3.5 shrink-0 transition-transform', fOpen && 'rotate-90')} />
				<FolderIcon class="size-3.5 shrink-0" />
				<span class="truncate">{folder.name}</span>
				{#if count > 0}
					<span class="text-sidebar-foreground/40">{count}</span>
				{/if}
			</button>
			{#if !viewerMode}
				<DropdownMenu>
					<DropdownMenuTrigger>
						{#snippet child({ props })}
							<button
								{...props}
								class="absolute top-1.5 right-1 flex size-5 items-center justify-center rounded-md text-sidebar-foreground/60 opacity-0 group-focus-within/folder:opacity-100 group-hover/folder:opacity-100 group-data-[collapsible=icon]:hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:opacity-100"
								title="Folder options"
								aria-label="Folder options"
							>
								<MoreHorizontal class="size-4" />
							</button>
						{/snippet}
					</DropdownMenuTrigger>
					<DropdownMenuContent side="right" align="start" class="w-40">
						<DropdownMenuItem class="cursor-pointer" onSelect={() => (renameTarget = folder)}>
							<Pencil class="size-4" />
							Rename
						</DropdownMenuItem>
						<DropdownMenuItem
							variant="destructive"
							class="cursor-pointer"
							onSelect={() => (deleteFolderTarget = folder)}
						>
							<Trash2 class="size-4" />
							Delete folder
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			{/if}
		</div>
		{#if fOpen}
			<Sidebar.GroupContent>
				{@render tripList(folder.id)}
				{#if count === 0}
					<p class="px-2 py-1 text-xs text-sidebar-foreground/40">Empty — drag a trip here</p>
				{/if}
			</Sidebar.GroupContent>
		{/if}
	</Sidebar.Group>
{/snippet}

<Sidebar.Root collapsible="icon">
	<Sidebar.Header>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton size="lg">
					{#snippet child({ props })}
						<a href={resolve('/')} {...props}>
							<Logo class="size-8 shrink-0 rounded-lg" />
							<div
								class="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden"
							>
								<span class="truncate font-semibold">Trip Planner</span>
								<span class="truncate text-xs text-muted-foreground">Personal travel notes</span>
							</div>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Header>

	<Sidebar.Content>
		<Sidebar.Group>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton isActive={page.url.pathname === '/'}>
							{#snippet child({ props })}
								<a href={resolve('/')} {...props}>
									<House class="size-4" />
									<span>All trips</span>
								</a>
							{/snippet}
						</Sidebar.MenuButton>
					</Sidebar.MenuItem>
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>

		{#if favorites.length > 0}
			<Sidebar.Group>
				<Sidebar.GroupLabel>Favorites</Sidebar.GroupLabel>
				<Sidebar.GroupContent>
					<Sidebar.Menu>
						{#each favorites as trip (trip.slug)}
							{@render tripRow(trip)}
						{/each}
					</Sidebar.Menu>
				</Sidebar.GroupContent>
			</Sidebar.Group>
		{/if}

		{#each foldersWithTrips as { folder, trips: ft } (folder.id)}
			{@render folderGroup(folder, ft.length)}
		{/each}

		<Sidebar.Group>
			<Sidebar.GroupLabel>Trips</Sidebar.GroupLabel>
			{#if !viewerMode}
				<Sidebar.GroupAction title="New folder" onclick={() => (createFolderOpen = true)}>
					<FolderPlus class="size-4" />
					<span class="sr-only">New folder</span>
				</Sidebar.GroupAction>
			{/if}
			<Sidebar.GroupContent>
				{@render tripList(UNGROUPED)}
				{#if !viewerMode && ungrouped.length === 0 && folders.length === 0}
					<Sidebar.Menu>
						<Sidebar.MenuItem>
							<Sidebar.MenuButton onclick={startNewTrip}>
								<Plus class="size-4" />
								<span>Plan a new trip</span>
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					</Sidebar.Menu>
				{/if}
			</Sidebar.GroupContent>
		</Sidebar.Group>

		{#if !viewerMode && drafts.length > 0}
			<Sidebar.Group>
				<Sidebar.GroupLabel>Drafts</Sidebar.GroupLabel>
				<Sidebar.GroupContent>
					<Sidebar.Menu>
						{#each drafts as s (s.sessionId)}
							{@const href = resolve('/agent/[sessionId]', { sessionId: s.sessionId })}
							<Sidebar.MenuItem>
								<Sidebar.MenuButton isActive={page.url.pathname === href}>
									{#snippet child({ props })}
										<a
											href={resolve('/agent/[sessionId]', { sessionId: s.sessionId })}
											{...props}
											title={relativeTime(s.updatedAt)}
										>
											<span class="truncate">{sessionTitle(s.messages)}</span>
										</a>
									{/snippet}
								</Sidebar.MenuButton>
								<Sidebar.MenuAction
									showOnHover
									title="Delete conversation"
									aria-label="Delete conversation"
									class="hover:text-destructive"
									onclick={() => (confirmSession = s)}
								>
									<Trash2 />
								</Sidebar.MenuAction>
							</Sidebar.MenuItem>
						{/each}
					</Sidebar.Menu>
				</Sidebar.GroupContent>
			</Sidebar.Group>
		{/if}
	</Sidebar.Content>

	{#if !viewerMode}
		<Sidebar.Footer class="border-t border-sidebar-border">
			<Sidebar.Menu>
				<Sidebar.MenuItem>
					<Sidebar.MenuButton
						onclick={startNewTrip}
						tooltipContent="New trip (⌘E)"
						class="h-11 justify-center gap-2 rounded-xl border border-sidebar-border bg-background font-medium shadow-sm transition-colors group-data-[collapsible=icon]:rounded-lg hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
					>
						<SquarePen class="size-4" />
						<span>New trip</span>
						<kbd
							class="inline-flex h-5 items-center rounded border border-sidebar-border bg-sidebar-accent px-1.5 font-mono text-[10px] font-medium text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden"
						>
							⌘E
						</kbd>
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
			</Sidebar.Menu>
		</Sidebar.Footer>
	{/if}

	<Sidebar.Rail />
</Sidebar.Root>

{#if !viewerMode}
	<DeleteTripConfirm
		trip={confirmTrip}
		onclose={() => (confirmSlug = null)}
		ondeleted={onDeleted}
	/>
	<DeleteSessionConfirm
		session={confirmSessionView}
		onclose={() => (confirmSession = null)}
		ondeleted={onSessionDeleted}
	/>
	<CreateFolderDialog
		open={createFolderOpen}
		onclose={closeCreateFolder}
		oncreated={onFolderCreated}
	/>
	<RenameFolderDialog
		folder={renameTarget}
		onclose={() => (renameTarget = null)}
		onrenamed={onFolderRenamed}
	/>
	<DeleteFolderConfirm
		folder={deleteFolderTarget}
		onclose={() => (deleteFolderTarget = null)}
		ondeleted={onFolderDeleted}
	/>
{/if}
