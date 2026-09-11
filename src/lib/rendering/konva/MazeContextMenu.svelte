<script lang="ts">
	import * as ContextMenu from '$lib/components/ui/context-menu';
	import { environmentState } from '$lib/state/environment.svelte';
	import { invalidatePlaybackIfNeeded } from '$lib/state/invalidate';
	import CostPresetSubmenu from '$lib/components/CostPresetSubmenu.svelte';
	import type { NodeId } from '$lib/graph/types';
	import Flag from '@lucide/svelte/icons/flag';
	import Target from '@lucide/svelte/icons/target';
	import Square from '@lucide/svelte/icons/square';
	import SquareX from '@lucide/svelte/icons/square-x';
	import Weight from '@lucide/svelte/icons/weight';
	import Eraser from '@lucide/svelte/icons/eraser';
	import EditCostDialog from '$lib/components/workspace/EditCostDialog.svelte';

	let { cellId }: { cellId: NodeId } = $props();

	let showCostDialog = $state(false);

	let node = $derived(environmentState.grid.nodes.get(cellId));
	let isStart = $derived(environmentState.gridStart === cellId);
	let isGoal = $derived(environmentState.gridGoal === cellId);
	let isWall = $derived(node ? !node.walkable : false);
	let hasCost = $derived(node ? node.cost > 1 : false);
	let supportsWeights = $derived(!!environmentState.currentAlgorithm?.supportsWeights);

	function run(action: () => void) {
		invalidatePlaybackIfNeeded();
		action();
	}
</script>

{#if node}
	{#if isStart}
		<ContextMenu.Item onSelect={() => run(() => environmentState.clearGridStart())}>
			<Flag class="text-green-500" />
			Clear Start
		</ContextMenu.Item>
	{:else if !isWall}
		<ContextMenu.Item onSelect={() => run(() => environmentState.setGridStart(cellId))}>
			<Flag class="text-green-500" />
			Set as Start
		</ContextMenu.Item>
	{/if}

	{#if isGoal}
		<ContextMenu.Item onSelect={() => run(() => environmentState.clearGridGoal())}>
			<Target class="text-red-500" />
			Clear Goal
		</ContextMenu.Item>
	{:else if !isWall}
		<ContextMenu.Item onSelect={() => run(() => environmentState.setGridGoal(cellId))}>
			<Target class="text-red-500" />
			Set as Goal
		</ContextMenu.Item>
	{/if}

	{#if !isStart && !isGoal}
		<ContextMenu.Separator />

		{#if isWall}
			<ContextMenu.Item onSelect={() => run(() => environmentState.toggleGridWall(cellId))}>
				<SquareX />
				Remove Wall
			</ContextMenu.Item>
		{:else}
			<ContextMenu.Item onSelect={() => run(() => environmentState.toggleGridWall(cellId))}>
				<Square />
				Toggle Wall
			</ContextMenu.Item>

			{#if supportsWeights}
				<CostPresetSubmenu
					currentCost={node.cost}
					onSelect={(w) => run(() => environmentState.setGridCost(cellId, w))}
					onCustom={() => (showCostDialog = true)}
				/>
				{#if hasCost}
					<ContextMenu.Item onSelect={() => run(() => environmentState.setGridCost(cellId, 1))}>
						<Weight class="opacity-50" />
						Remove Weight
					</ContextMenu.Item>
				{/if}
			{/if}
		{/if}

		<ContextMenu.Separator />
		<ContextMenu.Item
			variant="destructive"
			onSelect={() => run(() => environmentState.clearGridCell(cellId))}
		>
			<Eraser />
			Clear Cell
		</ContextMenu.Item>
	{/if}
{/if}

<EditCostDialog
	bind:open={showCostDialog}
	initialCost={node?.cost ?? 1}
	onSave={(val) => run(() => environmentState.setGridCost(cellId, val))}
/>
