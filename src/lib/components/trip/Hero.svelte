<script lang="ts">
	import type { Trip } from '$lib/trips';

	let {
		trip,
		glass = false,
		compact = false
	}: {
		trip: Trip;
		/** Render as a translucent overlay floating on the map (vs. a solid banner). */
		glass?: boolean;
		/** Condense to title + dates once the page is scrolled / the map collapses. */
		compact?: boolean;
	} = $props();
</script>

<div class="hero" class:glass-mode={glass} class:compact>
	<div class="hero-inner" class:glass class:glass-card={glass}>
		<div class="hero-eyebrow">{trip.eyebrow}</div>
		<h1>
			{trip.title}
			{#if trip.titleEmphasis}<em>{trip.titleEmphasis}</em>{/if}
		</h1>
		<p class="hero-sub">
			{trip.subtitle} · {trip.dateRange}
		</p>
		{#if !compact}
			<p class="hero-tagline">
				{trip.tagline}
			</p>
		{/if}
		<div class="pill-row">
			{#each trip.heroPills as p, i (i)}
				<span class="pill pill-{p.tone}">{p.label}</span>
			{/each}
		</div>
	</div>
</div>

<style>
	.hero {
		background: var(--white);
		border-bottom: 1px solid var(--trip-border);
		padding: 48px 40px 40px;
	}
	.hero-inner {
		max-width: 860px;
		margin: 0 auto;
	}
	.hero-eyebrow {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--trip-accent, var(--sage));
		margin-bottom: 12px;
	}
	h1 {
		font-family: var(--font-serif);
		font-size: 2.6rem;
		font-weight: 400;
		color: var(--ink);
		line-height: 1.15;
		margin-bottom: 10px;
	}
	h1 em {
		font-style: italic;
		color: var(--trip-accent, var(--sage));
	}
	.hero-sub {
		color: var(--ink2);
		font-size: 14px;
		font-weight: 300;
		margin-bottom: 6px;
	}
	.hero-tagline {
		color: var(--ink2);
		font-size: 14px;
		font-style: italic;
		margin-bottom: 22px;
		max-width: 60ch;
	}
	.pill-row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 4px 12px;
		border-radius: 20px;
		font-size: 12px;
		font-weight: 500;
		border: 1px solid;
	}
	.pill-sage {
		background: var(--sage-lt);
		color: var(--trip-accent, var(--sage));
		border-color: var(--sage-md);
	}
	.pill-amber {
		background: var(--amber-lt);
		color: var(--amber);
		border-color: var(--amber-md);
	}
	.pill-sky {
		background: var(--sky-lt);
		color: var(--sky);
		border-color: var(--sky-md);
	}
	.pill-rose {
		background: var(--rose-lt);
		color: var(--rose);
		border-color: var(--rose-md);
	}
	.pill-violet {
		background: var(--violet-lt);
		color: var(--violet);
		border-color: var(--violet-md);
	}

	/* ── Glass overlay variant (floats over the live map) ─────────────── */
	.hero.glass-mode {
		background: transparent;
		border-bottom: none;
		padding: 16px;
		pointer-events: none; /* let map drags pass through the gaps… */
	}
	.hero-inner.glass-card {
		pointer-events: auto; /* …but keep the panel itself interactive */
		border-radius: 16px;
		padding: 16px 20px;
		transition:
			padding 0.3s ease,
			background-color 0.3s ease;
	}
	.hero.glass-mode h1 {
		font-size: 1.75rem;
		margin-bottom: 4px;
		transition: font-size 0.3s ease;
	}
	.hero.glass-mode .hero-eyebrow {
		margin-bottom: 6px;
	}
	.hero.glass-mode .hero-sub {
		margin-bottom: 10px;
	}
	.hero.glass-mode .pill-row {
		margin-top: 2px;
	}

	/* Condensed (scrolled): just the title + dates in a slim bar. */
	.hero.glass-mode.compact .hero-inner.glass-card {
		padding: 10px 16px;
	}
	.hero.glass-mode.compact h1 {
		font-size: 1.25rem;
		margin-bottom: 2px;
	}
	.hero.glass-mode.compact .hero-eyebrow,
	.hero.glass-mode.compact .pill-row {
		display: none;
	}
	.hero.glass-mode.compact .hero-sub {
		margin-bottom: 0;
	}

	@media (max-width: 640px) {
		.hero {
			padding: 32px 20px 28px;
		}
		h1 {
			font-size: 2rem;
		}
		.hero.glass-mode {
			padding: 12px;
		}
		.hero.glass-mode h1 {
			font-size: 1.45rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.hero-inner.glass-card,
		.hero.glass-mode h1 {
			transition: none;
		}
	}
</style>
