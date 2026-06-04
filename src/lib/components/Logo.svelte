<script lang="ts">
	import logo from '$lib/assets/logo.svg';
	let { class: className = '', alt = 'Trip Planner' }: { class?: string; alt?: string } = $props();
</script>

<img src={logo} {alt} class={className} draggable="false" />
