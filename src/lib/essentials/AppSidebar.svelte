<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { Sidebar } from '$lib/components';
	import Logo from '$lib/components/Logo.svelte';
	import { listTrips } from '$lib/remote/trips.remote';
	import { aiPanelStore } from '$lib/stores';
	import { House, Plus } from '@lucide/svelte';
	import type { Trip } from '$lib/trips';

	const tripsQuery = listTrips({});
	const trips = $derived<Trip[]>(tripsQuery.current ?? []);

	async function startNewTrip() {
		if (page.url.pathname !== '/') await goto(resolve('/'));
		aiPanelStore.set(true);
	}
</script>

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

		<Sidebar.Group>
			<Sidebar.GroupLabel>Trips</Sidebar.GroupLabel>
			<Sidebar.GroupAction title="Plan a new trip with AI" onclick={startNewTrip}>
				<Plus class="size-4" />
				<span class="sr-only">Plan a new trip with AI</span>
			</Sidebar.GroupAction>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					{#each trips as trip (trip.slug)}
						{@const href = resolve('/trips/[slug]', { slug: trip.slug })}
						<Sidebar.MenuItem>
							<Sidebar.MenuButton isActive={page.url.pathname === href}>
								{#snippet child({ props })}
									<a {href} {...props}>
										<span class="text-base leading-none">{trip.flag}</span>
										<span class="truncate">
											{trip.title}{#if trip.titleEmphasis}&nbsp;{trip.titleEmphasis}{/if}
										</span>
									</a>
								{/snippet}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					{/each}
					<Sidebar.MenuItem>
						<Sidebar.MenuButton onclick={startNewTrip}>
							<Plus class="size-4" />
							<span>Plan a new trip</span>
						</Sidebar.MenuButton>
					</Sidebar.MenuItem>
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>
	</Sidebar.Content>

	<Sidebar.Rail />
</Sidebar.Root>
