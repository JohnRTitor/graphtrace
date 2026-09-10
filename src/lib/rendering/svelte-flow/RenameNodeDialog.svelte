<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { environmentState } from '$lib/state/environment.svelte';
	import { invalidatePlaybackIfNeeded } from '$lib/state/invalidate';
	import type { NodeId } from '$lib/graph/types';

	let {
		open = $bindable(false),
		nodeId,
		initialLabel
	}: {
		open: boolean;
		nodeId: NodeId;
		initialLabel: string;
	} = $props();

	let value = $state('');

	// Reset the draft whenever the dialog is (re)opened for a node.
	$effect(() => {
		if (open) {
			value = initialLabel;
		}
	});

	function confirm() {
		invalidatePlaybackIfNeeded();
		environmentState.renameGraphNode(nodeId, value);
		open = false;
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') confirm();
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Rename node</Dialog.Title>
		</Dialog.Header>
		<div class="flex flex-col gap-2">
			<Label for="node-rename-input">Label</Label>
			<input
				id="node-rename-input"
				class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
				bind:value
				onkeydown={onKeydown}
			/>
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
			<Button onclick={confirm} disabled={!value.trim()}>Save</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
