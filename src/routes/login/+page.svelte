<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let submitting = $state(false);
</script>

<svelte:head>
	<title>Sign in · Trip Planner</title>
</svelte:head>

<div class="flex min-h-[calc(100vh-56px)] items-center justify-center bg-(--cream) px-5">
	<div class="glass w-full max-w-sm rounded-2xl px-7 py-8 max-sm:px-5 max-sm:py-6">
		<div class="mb-1.5 text-[11px] font-semibold tracking-[0.12em] text-(--trip-accent) uppercase">
			Private site
		</div>
		<h1 class="mb-2 font-serif text-[1.75rem] leading-[1.15] font-normal text-(--ink)">
			Trip Planner
		</h1>
		<p class="mb-5 text-sm font-light text-(--ink2)">
			This planner is password-protected. Enter the shared password to continue.
		</p>

		<form
			method="POST"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					submitting = false;
					await update();
				};
			}}
		>
			<label class="mb-1.5 block text-xs font-semibold text-(--ink2)" for="password">
				Password
			</label>
			<input
				id="password"
				name="password"
				type="password"
				required
				autocomplete="current-password"
				class="mb-3 w-full rounded-[10px] border border-(--trip-border) bg-(--white) px-3.5 py-2.5
					text-sm text-(--ink) outline-none focus:border-(--trip-accent)"
			/>
			{#if form?.error}
				<p
					class="mb-3 rounded-[8px] border border-(--fire-md) bg-(--fire-lt) px-3 py-2 text-xs font-medium text-(--fire)"
				>
					{form.error}
				</p>
			{/if}
			<button
				type="submit"
				disabled={submitting}
				class="w-full cursor-pointer rounded-[10px] bg-(--ink) px-4 py-2.5 text-sm font-semibold
					text-(--cream) transition-transform hover:-translate-y-px disabled:cursor-default
					disabled:opacity-60 motion-reduce:transition-none"
			>
				{submitting ? 'Checking…' : 'Enter'}
			</button>
		</form>
	</div>
</div>
