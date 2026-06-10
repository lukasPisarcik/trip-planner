<script lang="ts">
	import { Dialog, Button } from '$lib/components';
	import { deleteTrip } from '$lib/remote/trips.remote';
	import { toast } from '$lib';

	type DeletableTrip = { slug: string; title: string; titleEmphasis?: string };

	let {
		trip,
		onclose,
		ondeleted
	}: {
		/** The trip pending deletion, or `null` when the dialog is closed. */
		trip: DeletableTrip | null;
		onclose: () => void;
		ondeleted: (slug: string) => void | Promise<void>;
	} = $props();

	let deleting = $state(false);

	const fullTitle = $derived(
		trip ? `${trip.title}${trip.titleEmphasis ? ' ' + trip.titleEmphasis : ''}` : ''
	);

	async function confirm() {
		if (!trip) return;
		const slug = trip.slug;
		deleting = true;
		try {
			await deleteTrip({ slug });
			toast.success('Trip deleted');
			await ondeleted(slug);
			onclose();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Failed to delete trip');
		} finally {
			deleting = false;
		}
	}
</script>

<Dialog.Root
	open={trip !== null}
	onOpenChange={(o) => {
		if (!o) onclose();
	}}
>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Delete {fullTitle}?</Dialog.Title>
			<Dialog.Description>
				This trip will be permanently removed. This can't be undone.
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" onclick={onclose} disabled={deleting}>Cancel</Button>
			<Button variant="destructive" onclick={confirm} disabled={deleting}>
				{deleting ? 'Deleting…' : 'Delete trip'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
