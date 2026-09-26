<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
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
		environmentState.setGraphLabel(nodeId, value);
		open = false;
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			confirm();
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Rename node</Dialog.Title>
			<Dialog.Description>
				The label is drawn on the node in the canvas.
			</Dialog.Description>
		</Dialog.Header>
		<div class="flex flex-col gap-2">
			<Label for="node-rename-input">Label</Label>
			<Input
				id="node-rename-input"
				autofocus
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
