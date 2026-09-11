<script lang="ts">
	import * as ContextMenu from '$lib/components/ui/context-menu';
	import { environmentState } from '$lib/state/environment.svelte';
	import { editorState } from '$lib/state/editor.svelte';
	import { invalidatePlaybackIfNeeded } from '$lib/state/invalidate';
	import type { NodeId } from '$lib/graph/types';
	import Flag from '@lucide/svelte/icons/flag';
	import Target from '@lucide/svelte/icons/target';
	import Route from '@lucide/svelte/icons/route';
	import SquarePen from '@lucide/svelte/icons/square-pen';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Weight from '@lucide/svelte/icons/weight';
	import EditCostDialog from '$lib/components/workspace/EditCostDialog.svelte';

	let {
		nodeId,
		onRename
	}: {
		nodeId: NodeId;
		onRename: (nodeId: NodeId, currentLabel: string) => void;
	} = $props();

	let node = $derived(environmentState.graph.nodes.get(nodeId));
	let isStart = $derived(environmentState.graphStart === nodeId);
	let isGoal = $derived(environmentState.graphGoal === nodeId);
	
	let showCostDialog = $state(false);

	function run(action: () => void) {
		invalidatePlaybackIfNeeded();
		action();
	}
</script>

{#if node}
	{#if isStart}
		<ContextMenu.Item onSelect={() => run(() => environmentState.setGraphStart(null))}>
			<Flag class="text-green-500" />
			Clear Start
		</ContextMenu.Item>
	{:else}
		<ContextMenu.Item onSelect={() => run(() => environmentState.setGraphStart(nodeId))}>
			<Flag class="text-green-500" />
			Set as Start
		</ContextMenu.Item>
	{/if}

	{#if isGoal}
		<ContextMenu.Item onSelect={() => run(() => environmentState.setGraphGoal(null))}>
			<Target class="text-red-500" />
			Clear Goal
		</ContextMenu.Item>
	{:else}
		<ContextMenu.Item onSelect={() => run(() => environmentState.setGraphGoal(nodeId))}>
			<Target class="text-red-500" />
			Set as Goal
		</ContextMenu.Item>
	{/if}

	<ContextMenu.Separator />

	<ContextMenu.Item onSelect={() => (editorState.mode = 'edge')}>
		<Route />
		Add Edge From Here
	</ContextMenu.Item>

	<ContextMenu.Separator />

	<ContextMenu.Item onSelect={() => (showCostDialog = true)}>
		<Weight />
		Edit Node Cost...
	</ContextMenu.Item>

	<ContextMenu.Separator />

	<ContextMenu.Item onSelect={() => onRename(nodeId, node.label)}>
		<SquarePen />
		Rename
	</ContextMenu.Item>
	<ContextMenu.Item
		variant="destructive"
		onSelect={() => run(() => environmentState.removeGraphNode(nodeId))}
	>
		<Trash2 />
		Delete
	</ContextMenu.Item>
{/if}

<EditCostDialog
	bind:open={showCostDialog}
	initialCost={node?.cost ?? 0}
	title="Edit Node Cost"
	onSave={(val) => run(() => environmentState.setGraphNodeCost(nodeId, val))}
/>
