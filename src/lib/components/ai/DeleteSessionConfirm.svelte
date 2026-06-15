<script lang="ts">
	import { Dialog, Button } from '$lib/components';
	import { deleteChat } from '$lib/remote/chats.remote';
	import { toast } from '$lib';

	type DeletableSession = { sessionId: string; title: string };

	let {
		session,
		onclose,
		ondeleted
	}: {
		/** The conversation pending deletion, or `null` when the dialog is closed. */
		session: DeletableSession | null;
		onclose: () => void;
		ondeleted: (sessionId: string) => void | Promise<void>;
	} = $props();

	let deleting = $state(false);

	async function confirm() {
		if (!session) return;
		const sessionId = session.sessionId;
		deleting = true;
		try {
			await deleteChat({ sessionId });
			toast.success('Conversation deleted');
			await ondeleted(sessionId);
			onclose();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Failed to delete conversation');
		} finally {
			deleting = false;
		}
	}
</script>

<Dialog.Root
	open={session !== null}
	onOpenChange={(o) => {
		if (!o) onclose();
	}}
>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Delete this conversation?</Dialog.Title>
			<Dialog.Description>
				{#if session}
					“{session.title}” will be permanently removed. This can't be undone.
				{:else}
					This conversation will be permanently removed. This can't be undone.
				{/if}
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" onclick={onclose} disabled={deleting}>Cancel</Button>
			<Button variant="destructive" onclick={confirm} disabled={deleting}>
				{deleting ? 'Deleting…' : 'Delete conversation'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
