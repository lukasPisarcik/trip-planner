<script lang="ts">
	// Claude/Anthropic vendor mark — a coral sunburst. Inline SVG so it inherits
	// sizing via the `class` prop (e.g. `size-4`).
	let { class: className = '' }: { class?: string } = $props();
</script>

<svg
	class={className}
	viewBox="0 0 24 24"
	fill="none"
	xmlns="http://www.w3.org/2000/svg"
	aria-hidden="true"
>
	<g stroke="#D97757" stroke-width="2.3" stroke-linecap="round">
		<line x1="12" y1="2.5" x2="12" y2="21.5" />
		<line x1="2.5" y1="12" x2="21.5" y2="12" />
		<line x1="5.2" y1="5.2" x2="18.8" y2="18.8" />
		<line x1="18.8" y1="5.2" x2="5.2" y2="18.8" />
	</g>
</svg>
