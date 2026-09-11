<script lang="ts">
	import { editorState } from '$lib/state/editor.svelte';
	import { environmentState } from '$lib/state/environment.svelte';
	import { playbackState } from '$lib/state/playback.svelte';
	import { Label } from '$lib/components/ui/label';
	import { Separator } from '$lib/components/ui/separator';
	
	let selection = $derived(editorState.selection);
	
	// Cell selection
	let cell = $derived(selection?.type === 'cell' ? environmentState.grid.nodes.get(selection.id) : null);
	let isStart = $derived(selection && selection.id === (environmentState.environmentType === 'graph' ? environmentState.graphStart : environmentState.gridStart));
	let isGoal = $derived(selection && selection.id === (environmentState.environmentType === 'graph' ? environmentState.graphGoal : environmentState.gridGoal));
	
	// Graph selection
	let node = $derived(selection?.type === 'node' ? environmentState.graph.nodes.get(selection.id) : null);
	let edge = $derived(selection?.type === 'edge' ? environmentState.graph.edges.get(selection.id) : null);
	
	// Execution state
	let vizState = $derived(selection?.id ? playbackState.vizState.cellStates.get(selection.id) : undefined);
	let costData = $derived(selection?.id ? playbackState.vizState.costData.get(selection.id) : undefined);
</script>

<div class="flex h-full w-full flex-col gap-4 p-4">
	<h2 class="text-sm font-semibold tracking-tight">Inspector</h2>
	<Separator />
	
	{#if !selection}
		<div class="text-sm text-muted-foreground text-center py-8">
			Select an element to view properties.
		</div>
	{:else if selection.type === 'cell' && cell}
		<div class="space-y-4">
			<div class="grid grid-cols-2 gap-2">
				<Label class="text-xs text-muted-foreground">ID</Label>
				<div class="text-xs font-mono">{cell.id}</div>
				
				<Label class="text-xs text-muted-foreground">Type</Label>
				<div class="text-xs">{cell.walkable ? 'Path' : 'Wall'}</div>
				
				{#if cell.walkable}
					<Label class="text-xs text-muted-foreground">Cost/Weight</Label>
					<div class="text-xs">{cell.cost}</div>
				{/if}
				
				<Label class="text-xs text-muted-foreground">Special</Label>
				<div class="text-xs">
					{#if isStart} Start {:else if isGoal} Goal {:else} None {/if}
				</div>
			</div>
		</div>
	{:else if selection.type === 'node' && node}
		<div class="space-y-4">
			<div class="grid grid-cols-2 gap-2">
				<Label class="text-xs text-muted-foreground">ID</Label>
				<div class="text-xs font-mono">{node.id}</div>
				
				<Label class="text-xs text-muted-foreground">Label</Label>
				<div class="text-xs font-medium">{node.label}</div>
				
				<Label class="text-xs text-muted-foreground">Cost</Label>
				<div class="text-xs">{node.cost ?? 0}</div>
				
				<Label class="text-xs text-muted-foreground">Special</Label>
				<div class="text-xs">
					{#if isStart} Start {:else if isGoal} Goal {:else} None {/if}
				</div>
			</div>
		</div>
	{:else if selection.type === 'edge' && edge}
		<div class="space-y-4">
			<div class="grid grid-cols-2 gap-2">
				<Label class="text-xs text-muted-foreground">ID</Label>
				<div class="text-xs font-mono truncate" title={edge.id}>{edge.id}</div>
				
				<Label class="text-xs text-muted-foreground">Source</Label>
				<div class="text-xs font-mono">{edge.source}</div>
				
				<Label class="text-xs text-muted-foreground">Target</Label>
				<div class="text-xs font-mono">{edge.target}</div>
				
				<Label class="text-xs text-muted-foreground">Weight</Label>
				<div class="text-xs">{edge.weight}</div>
				
				<Label class="text-xs text-muted-foreground">Direction</Label>
				<div class="text-xs">{edge.directed ? 'Directed' : 'Undirected'}</div>
			</div>
		</div>
	{/if}

	{#if vizState || costData}
		<Separator />
		<div class="space-y-3 pt-2">
			<h3 class="text-xs font-medium">Execution State</h3>
			<div class="grid grid-cols-2 gap-2">
				{#if vizState}
					<Label class="text-xs text-muted-foreground">State</Label>
					<div class="text-xs capitalize">{vizState}</div>
				{/if}
				
				{#if costData?.g !== undefined}
					<Label class="text-xs text-muted-foreground">G-Cost (from start)</Label>
					<div class="text-xs">{costData.g !== Infinity ? costData.g : '∞'}</div>
				{/if}
				
				{#if costData?.f !== undefined}
					<Label class="text-xs text-muted-foreground">F-Cost (total)</Label>
					<div class="text-xs">{costData.f !== Infinity ? costData.f : '∞'}</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
