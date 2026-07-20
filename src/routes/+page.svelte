<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { useQuery } from 'convex-svelte';
	import { api } from '$convex/_generated/api';
	import type { Trip } from '$lib/trips';
	import { Trash2 } from '@lucide/svelte';
	import DeleteTripConfirm from '$lib/components/trip/DeleteTripConfirm.svelte';

	// Reactive: the grid live-updates when trips change in Convex (no manual refresh).
	const tripsQuery = useQuery(api.trips.listTrips, {});
	const trips = $derived<Trip[]>((tripsQuery.data ?? []) as Trip[]);

	const viewerMode = $derived(page.data.viewerMode ?? false);

	let confirmSlug = $state<string | null>(null);
	const confirmTrip = $derived(trips.find((t) => t.slug === confirmSlug) ?? null);

	function cardStyle(accent: Trip['accent']) {
		return [
			`--card-accent: var(--${accent})`,
			`--card-accent-lt: var(--${accent}-lt)`,
			`--card-accent-md: var(--${accent}-md)`
		].join('; ');
	}
</script>

<svelte:head>
	<title>Trip Planner</title>
</svelte:head>

<div
	class="mx-auto max-w-[1200px] px-10 pt-14 pb-16 max-[700px]:px-5 max-[700px]:pt-8 max-[700px]:pb-12"
>
	<div class="mb-6 text-[11px] font-semibold tracking-[0.16em] text-(--ink3) uppercase">
		Choose a trip
	</div>

	<div class="grid grid-cols-[repeat(auto-fit,minmax(360px,1fr))] gap-6">
		{#each trips as trip (trip.slug)}
			<article
				class="group relative flex flex-col gap-4 overflow-hidden rounded-[18px] border border-(--trip-border) bg-(--white) px-8 pt-8 pb-7 transition-[box-shadow,transform] duration-200 ease-[ease] before:absolute before:inset-x-0 before:top-0 before:h-[5px] before:bg-[linear-gradient(to_right,var(--card-accent),var(--card-accent)_30%,color-mix(in_srgb,var(--card-accent)_35%,transparent))] before:content-[''] hover:-translate-y-0.5 hover:shadow-(--trip-shadow) max-[700px]:px-[22px] max-[700px]:pt-6 max-[700px]:pb-[22px]"
				style={cardStyle(trip.accent)}
			>
				{#if !viewerMode}
					<button
						class="absolute top-3.5 right-3.5 z-2 inline-flex size-[30px] cursor-pointer items-center justify-center rounded-lg border border-(--trip-border) bg-(--white) text-(--ink3) opacity-50 transition-[opacity,color,background] duration-150 ease-[ease] group-hover:opacity-100 hover:bg-(--cream) hover:text-[#dc2626] focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--card-accent)"
						title="Delete trip"
						aria-label="Delete trip"
						onclick={() => (confirmSlug = trip.slug)}
					>
						<Trash2 class="size-4" />
					</button>
				{/if}
				<div class="mt-1 flex gap-2.5">
					{#each trip.flags as f, i (i)}
						<span class="text-[26px] leading-none">{f}</span>
					{/each}
				</div>

				<h2
					class="font-serif text-[2.6rem] leading-[1.05] font-normal text-(--ink) max-[700px]:text-[2rem]"
				>
					{trip.title}
					{#if trip.titleEmphasis}<em class="text-(--card-accent) italic">{trip.titleEmphasis}</em
						>{/if}
				</h2>

				<p class="text-sm leading-[1.55] text-(--ink2)">{trip.tagline}</p>

				<div class="flex flex-wrap gap-2">
					{#each trip.cardPills as p, i (i)}
						<span
							class="rounded-[20px] border border-(--card-accent-md) bg-(--card-accent-lt) px-3.5 py-[5px] text-[12.5px] font-medium whitespace-nowrap text-(--card-accent)"
							>{p.label}</span
						>
					{/each}
				</div>

				<div class="mt-1 text-[10.5px] font-bold tracking-[0.16em] text-(--ink3) uppercase">
					Highlights
				</div>
				<ul class="flex flex-col gap-2">
					{#each trip.highlights as h, i (i)}
						<li class="flex items-start gap-3 text-[13.5px] leading-[1.5] text-(--ink)">
							<span class="mt-[7px] size-[7px] shrink-0 rounded-full bg-(--card-accent)"></span>
							<span>{h}</span>
						</li>
					{/each}
				</ul>

				<a
					class="group/cta mt-3 inline-flex items-center justify-center gap-2 rounded-[999px] bg-(--card-accent) px-[22px] py-3.5 text-sm font-medium text-white no-underline transition-[filter,transform] duration-150 ease-[ease] hover:brightness-95 active:translate-y-px"
					href={resolve('/trips/[slug]', { slug: trip.slug })}
				>
					Open planner <span
						class="transition-transform duration-150 ease-[ease] group-hover/cta:translate-x-[3px]"
						>→</span
					>
				</a>
			</article>
		{/each}
	</div>
</div>

{#if !viewerMode}
	<DeleteTripConfirm trip={confirmTrip} onclose={() => (confirmSlug = null)} ondeleted={() => {}} />
{/if}
