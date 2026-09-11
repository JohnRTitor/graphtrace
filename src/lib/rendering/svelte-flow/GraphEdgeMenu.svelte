<script lang="ts">
	import * as ContextMenu from '$lib/components/ui/context-menu';
	import { environmentState } from '$lib/state/environment.svelte';
	import { invalidatePlaybackIfNeeded } from '$lib/state/invalidate';
	import CostPresetSubmenu from '$lib/components/CostPresetSubmenu.svelte';
	import Trash2 from '@lucide/svelte/icons/trash-2';

	let { edgeId }: { edgeId: string } = $props();

	let edge = $derived(environmentState.graph.edges.get(edgeId));

	function run(action: () => void) {
		invalidatePlaybackIfNeeded();
		action();
	}
</script>

{#if edge}
	<CostPresetSubmenu
		label="Edit Cost"
		currentCost={edge.weight}
		onSelect={(w) => run(() => environmentState.setGraphWeight(edgeId, w))}
	/>
	<ContextMenu.Item
		onSelect={() => run(() => environmentState.setGraphEdgeDirected(edgeId, !edge!.directed))}
	>
		{edge.directed ? 'Make Undirected' : 'Make Directed'}
	</ContextMenu.Item>


	<ContextMenu.Separator />
	<ContextMenu.Item
		variant="destructive"
		onSelect={() => run(() => environmentState.removeGraphEdge(edgeId))}
	>
		<Trash2 />
		Delete Edge
	</ContextMenu.Item>
{/if}
