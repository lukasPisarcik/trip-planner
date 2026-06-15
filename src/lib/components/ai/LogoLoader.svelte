<script lang="ts">
	// A small branded "working" animation built from the logo's three route stops
	// (teal → amber → purple) hopping along a faint route track, left to right —
	// a trip being planned. Replaces the generic three-dot typing indicator.
	let { size = 7, class: className = '' }: { size?: number; class?: string } = $props();
</script>

<span class={'route-loader ' + className} style="--dot: {size}px" aria-hidden="true">
	<span class="track"></span>
	<span class="stop teal"></span>
	<span class="stop amber"></span>
	<span class="stop purple"></span>
</span>

<style>
	.route-loader {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: calc(var(--dot) * 0.85);
		padding: calc(var(--dot) * 0.5) 0; /* headroom for the hop */
	}
	/* The route the stops sit on. */
	.track {
		position: absolute;
		left: 8%;
		right: 8%;
		top: 50%;
		height: max(1px, calc(var(--dot) * 0.28));
		transform: translateY(-50%);
		background: currentColor;
		opacity: 0.16;
		border-radius: 999px;
	}
	.stop {
		width: var(--dot);
		height: var(--dot);
		border-radius: 999px;
		position: relative;
		animation: hop 1.25s cubic-bezier(0.45, 0, 0.55, 1) infinite;
	}
	.teal {
		background: #1d9e75;
		animation-delay: 0s;
	}
	.amber {
		background: #ef9f27;
		animation-delay: 0.16s;
	}
	.purple {
		background: #534ab7;
		animation-delay: 0.32s;
	}
	@keyframes hop {
		0%,
		65%,
		100% {
			transform: translateY(0) scale(0.7);
			opacity: 0.45;
		}
		32% {
			transform: translateY(calc(var(--dot) * -0.6)) scale(1.12);
			opacity: 1;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.stop {
			animation: none;
			transform: none;
			opacity: 0.85;
		}
	}
</style>
