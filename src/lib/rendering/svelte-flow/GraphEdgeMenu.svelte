<script lang="ts">
	import * as ContextMenu from '$lib/components/ui/context-menu';
	import { environmentState } from '$lib/state/environment.svelte';
	import { invalidatePlaybackIfNeeded } from '$lib/state/invalidate';
	import WeightPresetSubmenu from '$lib/components/WeightPresetSubmenu.svelte';
	import ArrowRightLeft from '@lucide/svelte/icons/arrow-right-left';
	import Trash2 from '@lucide/svelte/icons/trash-2';

	let { edgeId }: { edgeId: string } = $props();

	let edge = $derived(environmentState.graph.edges.get(edgeId));

	function run(action: () => void) {
		invalidatePlaybackIfNeeded();
		action();
	}
</script>

{#if edge}
	<WeightPresetSubmenu
		label="Edit Weight"
		currentWeight={edge.weight}
		onSelect={(w) => run(() => environmentState.setGraphWeight(edgeId, w))}
	/>

	{#if environmentState.graphDirected}
		<ContextMenu.Separator />
		<ContextMenu.Item onSelect={() => run(() => environmentState.reverseGraphEdge(edgeId))}>
			<ArrowRightLeft />
			Reverse Direction
		</ContextMenu.Item>
	{/if}

	<ContextMenu.Separator />
	<ContextMenu.Item
		variant="destructive"
		onSelect={() => run(() => environmentState.removeGraphEdge(edgeId))}
	>
		<Trash2 />
		Delete Edge
	</ContextMenu.Item>
{/if}
