<script lang="ts">
	import * as ContextMenu from '$lib/components/ui/context-menu';
	import { environmentState } from '$lib/state/environment.svelte';
	import { invalidatePlaybackIfNeeded } from '$lib/state/invalidate';
	import CirclePlus from '@lucide/svelte/icons/circle-plus';
	import Maximize from '@lucide/svelte/icons/maximize';
	import X from '@lucide/svelte/icons/x';

	let {
		flowX,
		flowY,
		onFitView,
		onClearSelection
	}: {
		flowX: number;
		flowY: number;
		onFitView: () => void;
		onClearSelection: () => void;
	} = $props();

	function addNode() {
		invalidatePlaybackIfNeeded();
		environmentState.addGraphNode(flowX, flowY, `N${environmentState.graph.nodes.size + 1}`);
	}
</script>

<ContextMenu.Item onSelect={addNode}>
	<CirclePlus />
	Add Node
</ContextMenu.Item>

<ContextMenu.Separator />

<ContextMenu.Item onSelect={onFitView}>
	<Maximize />
	Fit View
</ContextMenu.Item>
<ContextMenu.Item onSelect={onClearSelection}>
	<X />
	Clear Selection
</ContextMenu.Item>
