<script lang="ts">
	import { environmentState } from '$lib/state/environment.svelte';
	import { inspectorFieldValue } from '$lib/families/types';
	import { editorState } from "$lib/state/editor.svelte";
	import TraceReadout from './TraceReadout.svelte';
	import { Separator } from '$lib/components/ui/separator';
	import { Input } from '$lib/components/ui/input';
	import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '$lib/components/ui/empty';

	let family = $derived(environmentState.family);
	let fields = $derived(family?.inspectorSchema() ?? []);
	let selectedCell = $derived(
		editorState.selection?.type === 'cell' ? environmentState.grid.nodes.get(editorState.selection.id) : null
	);
	let selectedNode = $derived(
		editorState.selection?.type === 'node' ? environmentState.graph.nodes.get(editorState.selection.id) : null
	);
	let selectedEdge = $derived(
		editorState.selection?.type === 'edge' ? environmentState.graph.edges.get(editorState.selection.id) : null
	);

	let selectedGameNode = $derived.by(() => {
		if (!editorState.selection || editorState.selection.type !== 'node') return null;
		return environmentState.gameTree.nodes.get(editorState.selection.id) ?? null;
	});
</script>

<div class="space-y-4 p-3 sm:space-y-4 sm:p-4">
	<h2 class="text-sm font-semibold tracking-tight">Inspector</h2>
	<Separator />

	{#if fields.length === 0}
		<Empty class="py-6">
			<EmptyHeader>
				<EmptyTitle class="text-xs font-medium text-foreground">Nothing selected</EmptyTitle>
				<EmptyDescription class="text-xs">
					{family?.status === 'planned'
						? `${family.name} is registered but not built yet.`
						: 'Click a cell, node or edge on the canvas to inspect it.'}
				</EmptyDescription>
			</EmptyHeader>
		</Empty>
	{/if}

	{#if fields.length > 0}
		<dl class="grid grid-cols-[minmax(0,auto)_1fr] items-center gap-x-3 gap-y-1.5 text-xs">
			{#each fields as field (field.id)}
				<dt class="truncate text-muted-foreground">{field.label}</dt>
				<dd class="gt-mono truncate text-right" class:opacity-70={field.kind === 'readonly'}>
					{#if field.kind === 'text' && field.write}
						<Input
							class="gt-mono h-9 text-right text-xs sm:h-7"
							value={String(field.read())}
							onchange={(event) => field.write?.(event.currentTarget.value)}
						/>
					{:else}
						<span title={'hint' in field ? field.hint : undefined}>{inspectorFieldValue(field)}</span>
					{/if}
				</dd>
			{/each}
		</dl>
	{/if}

	<!-- Selection detail, when something is selected and the family has one. -->
	{#if selectedCell}
		<Separator />
		<div class="space-y-2">
			<h3 class="text-xs font-medium">Cell</h3>
			<dl class="grid grid-cols-[minmax(0,auto)_1fr] items-center gap-x-3 gap-y-1 text-xs">
				<dt class="truncate text-muted-foreground">id</dt>
				<dd class="gt-mono truncate">{selectedCell.id}</dd>
				<dt class="truncate text-muted-foreground">terrain</dt>
				<dd>{selectedCell.walkable ? 'Path' : 'Wall'}</dd>
				{#if selectedCell.walkable}
					<dt class="truncate text-muted-foreground">cost</dt>
					<dd class="gt-mono">{selectedCell.cost}</dd>
				{/if}
			</dl>
		</div>
	{:else if selectedNode && !selectedGameNode}
		<Separator />
		<div class="space-y-2">
			<h3 class="text-xs font-medium">Node</h3>
			<dl class="grid grid-cols-[minmax(0,auto)_1fr] items-center gap-x-3 gap-y-1 text-xs">
				<dt class="truncate text-muted-foreground">id</dt>
				<dd class="gt-mono truncate">{selectedNode.id}</dd>
				<dt class="truncate text-muted-foreground">label</dt>
				<dd>{selectedNode.label}</dd>
				<dt class="truncate text-muted-foreground">cost</dt>
				<dd class="gt-mono">{selectedNode.cost ?? 0}</dd>
			</dl>
		</div>
	{:else if selectedEdge}
		<Separator />
		<div class="space-y-2">
			<h3 class="text-xs font-medium">Edge</h3>
			<dl class="grid grid-cols-[minmax(0,auto)_1fr] items-center gap-x-3 gap-y-1 text-xs">
				<dt class="truncate text-muted-foreground">id</dt>
				<dd class="gt-mono truncate">{selectedEdge.id}</dd>
				<dt class="truncate text-muted-foreground">weight</dt>
				<dd class="gt-mono">{selectedEdge.weight}</dd>
				<dt class="truncate text-muted-foreground">direction</dt>
				<dd>{selectedEdge.directed ? 'Directed' : 'Undirected'}</dd>
			</dl>
		</div>
	{:else if selectedGameNode}
		<Separator />
		<div class="space-y-2">
			<h3 class="text-xs font-medium">Game node</h3>
			<dl class="grid grid-cols-[minmax(0,auto)_1fr] items-center gap-x-3 gap-y-1 text-xs">
				<dt class="truncate text-muted-foreground">id</dt>
				<dd class="gt-mono truncate">{selectedGameNode.id}</dd>
				<dt class="truncate text-muted-foreground">depth</dt>
				<dd class="gt-mono">{selectedGameNode.depth}</dd>
				<dt class="truncate text-muted-foreground">role</dt>
				<dd>{selectedGameNode.player}</dd>
				{#if selectedGameNode.utility !== null}
					<dt class="truncate text-muted-foreground">utility</dt>
					<dd class="gt-mono">{selectedGameNode.utility}</dd>
				{/if}
				{#if selectedGameNode.state}
					<dt class="truncate text-muted-foreground">position</dt>
					<dd class="gt-mono truncate">{selectedGameNode.state}</dd>
				{/if}
			</dl>
		</div>
	{/if}


	<!--
		Live trace readout, isolated in its own component so that advancing a
		playback step re-renders only this. Keeping it inline made the whole
		inspector - including the family schema's thunks, one of which walks every
		cell in the grid - a per-step dependency.
	-->
	<TraceReadout />
</div>
