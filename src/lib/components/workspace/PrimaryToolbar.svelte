<script lang="ts">
	import { editorState, getCompatibleEditorMode, type EditMode } from '$lib/state/editor.svelte';
	import { environmentState } from '$lib/state/environment.svelte';
	import { ToggleGroup, ToggleGroupItem } from '$lib/components/ui/toggle-group';
	import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover';
	import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '$lib/components/ui/tooltip';

	import MousePointer2 from '@lucide/svelte/icons/mouse-pointer-2';
	import Eraser from '@lucide/svelte/icons/eraser';
	import Flag from '@lucide/svelte/icons/flag';
	import Target from '@lucide/svelte/icons/target';
	import Weight from '@lucide/svelte/icons/weight';
	import Circle from '@lucide/svelte/icons/circle';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Move from '@lucide/svelte/icons/move';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import Save from '@lucide/svelte/icons/save';
	import FolderOpen from '@lucide/svelte/icons/folder-open';
	import Columns2 from '@lucide/svelte/icons/columns-2';
	import { Button } from '$lib/components/ui/button';
	import { serializeWorkspace, deserializeWorkspace } from '$lib/persistence/save-load';
	import { executionStore } from '$lib/state/execution-store.svelte';
	import { comparePlaybackStates } from '$lib/state/playback.svelte';

	import CostBrushPanel from './CostBrushPanel.svelte';

	let fileInput = $state<HTMLInputElement | null>(null);
	let loadError = $state<string | null>(null);

	/**
	 * The tool strip is family-aware: a game tree is edited by selecting a node
	 * rather than painting, so the wall/erase tools only exist for grids, and the
	 * cost brush is shown wherever the family has something to cost.
	 */
	let isGrid = $derived(
		!environmentState.isAdversarialFamily && environmentState.environmentType !== 'graph'
	);
	let isPathfindingGraph = $derived(environmentState.isPathfindingGraph);
	let showCostBrush = $derived(!environmentState.isAdversarialFamily);
	let showMarkers = $derived(!environmentState.isAdversarialFamily);

	function handleSave() {
		const json = serializeWorkspace(environmentState);
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `graphtrace-workspace-${new Date().toISOString().slice(0, 10)}.json`;
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 0);
	}

	function handleLoad(e: Event) {
		loadError = null;
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onerror = () => {
			loadError = 'Unable to read the selected workspace file.';
		};
		reader.onload = (e) => {
			try {
				const json = e.target?.result as string;
				deserializeWorkspace(json, environmentState);
				editorState.mode = getCompatibleEditorMode(editorState.mode, environmentState.environmentType);
			} catch (err) {
				loadError = err instanceof Error ? err.message : 'Unable to load the selected workspace.';
			}
		};
		reader.readAsText(file);
		// Reset input so the same file can be loaded again if needed
		target.value = '';
	}

	function toggleComparison() {
		if (!executionStore.isComparing) {
			for (const pane of comparePlaybackStates) pane.pause();
		}
		executionStore.isComparing = !executionStore.isComparing;
	}
</script>

<div class="relative flex flex-wrap items-center gap-1 border-b bg-card p-2">
	{#if loadError}
		<p class="absolute right-2 top-14 z-30 max-w-[min(90vw,28rem)] rounded-md border border-destructive/30 bg-background px-3 py-2 text-xs text-destructive shadow-lg" role="alert">
			{loadError}
		</p>
	{/if}
	<TooltipProvider delayDuration={300}>
		<ToggleGroup
			type="single"
			value={editorState.mode}
			onValueChange={(v) => { if (v) editorState.mode = v as EditMode; }}			class="justify-start flex-wrap gap-1"
		>
			{#if isPathfindingGraph}
				<ToggleGroupItem value="move" aria-label="Move Node" title="Move Node">
					<Move class="h-4 w-4" />
				</ToggleGroupItem>
				<ToggleGroupItem value="node" aria-label="Add Node" title="Add Node">
					<Circle class="h-4 w-4" />
				</ToggleGroupItem>
				<ToggleGroupItem value="edge" aria-label="Add Edge" title="Add Edge">
					<ArrowRight class="h-4 w-4" />
				</ToggleGroupItem>
				<ToggleGroupItem value="remove" aria-label="Remove" title="Remove">
					<Trash2 class="h-4 w-4" />
				</ToggleGroupItem>
			{:else if isGrid}
				<ToggleGroupItem value="wall" aria-label="Draw Walls" title="Draw Walls">
					<MousePointer2 class="h-4 w-4" />
				</ToggleGroupItem>
				<ToggleGroupItem value="erase" aria-label="Erase" title="Erase">
					<Eraser class="h-4 w-4" />
				</ToggleGroupItem>
			{:else}
				<!--
					A game tree has no paint modes: adding a move, re-rooting and removing
					are actions on a selected node, driven from the tree canvas panel.
				-->
				<ToggleGroupItem value="remove" aria-label="Remove Node" title="Remove Node">
					<Trash2 class="h-4 w-4" />
				</ToggleGroupItem>
			{/if}

			{#if showMarkers}
				<div class="mx-1 h-6 w-px bg-border"></div>
				<ToggleGroupItem value="start" aria-label="Set Start" title="Set Start">
					<Flag class="h-4 w-4" />
				</ToggleGroupItem>
				<ToggleGroupItem value="goal" aria-label="Set Goal" title="Set Goal">
					<Target class="h-4 w-4" />
				</ToggleGroupItem>
			{/if}

			{#if showCostBrush}
				<div class="mx-1 h-6 w-px bg-border"></div>
				<ToggleGroupItem value="cost" aria-label="Cost Brush" title="Cost Brush">
					<Weight class="h-4 w-4" />
				</ToggleGroupItem>
				<Popover>
					<PopoverTrigger aria-label="Open cost brush settings" class="flex h-10 items-center justify-center rounded-md px-2 gt-transition-feedback hover:bg-accent hover:text-accent-foreground sm:h-9">
						<SlidersHorizontal class="h-3.5 w-3.5" />
					</PopoverTrigger>
					<PopoverContent class="w-80" side="bottom" align="start">
						<CostBrushPanel />
					</PopoverContent>
				</Popover>
			{/if}
		</ToggleGroup>

		<div class="flex-1"></div>

		<div class="flex items-center gap-2 pr-1">
		<Tooltip>
			<!-- The trigger is the button; see FamilySwitcher for why. -->
			<TooltipTrigger
				class="inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-xs font-medium gt-transition-feedback hover:bg-accent hover:text-accent-foreground"
				aria-pressed={executionStore.isComparing}
				onclick={toggleComparison}
			>
				<Columns2 class="h-4 w-4" />
				Compare
			</TooltipTrigger>
			<TooltipContent side="bottom">
				<span class="block max-w-56">
					Run a second algorithm to fill a comparison pane. Up to four panes, each
					driven from the same transport.
				</span>
			</TooltipContent>
		</Tooltip>

		<div class="mx-1 h-6 w-px bg-border"></div>

		<input type="file" accept=".json" class="hidden" bind:this={fileInput} onchange={handleLoad} />
		<Button variant="outline" size="sm" class="h-10 gap-1 sm:h-8" onclick={() => fileInput?.click()}>
			<FolderOpen class="h-3.5 w-3.5" />
			Load
		</Button>
		<Button variant="default" size="sm" class="h-10 gap-1 sm:h-8" onclick={handleSave}>
			<Save class="h-3.5 w-3.5" />
			Save
		</Button>
		</div>
	</TooltipProvider>
</div>
